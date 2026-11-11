import { addressLine, attendeeName, merchLabel } from "@/lib/event-fields";
import { and, asc, eq, isNull, lt, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { getDb } from "@/db";
import { events, orderItems, orderShipments, orders, outbox, ticketZones, tickets, user } from "@/db/schema";
import { audit } from "@/lib/audit";
import { button, escape, layout, sendMail } from "@/lib/mail";
import { mapsLink } from "@/lib/map";
import { bahtOrFree } from "@/lib/format";

// The outbox (HANDOFF section 7): work that follows a payment but mustn't slow it down or fail it, done
// after the response (after() in app/actions/orders.ts) and again on the next pass if it failed. Jobs:
// ticket_email (to the buyer: the whole order, every ticket's QR) and attendee_ticket_email (to someone a ticket
// was bought for: their own ticket's QR). Server only.

const MAX_ATTEMPTS = 5;

const dateFormat = new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });
const timeFormat = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

/** Runs what's waiting, oldest first; a job another pass already took is skipped */
export async function processOutbox(limit = 10) {
  const db = getDb();
  const jobs = await db
    .select()
    .from(outbox)
    .where(and(isNull(outbox.doneAt), lt(outbox.attempts, MAX_ATTEMPTS)))
    .orderBy(asc(outbox.createdAt))
    .limit(limit);
  for (const job of jobs) {
    // Take it: only one pass gets to count this attempt
    const [taken] = await db
      .update(outbox)
      .set({ attempts: sql`${outbox.attempts} + 1` })
      .where(and(eq(outbox.id, job.id), eq(outbox.attempts, job.attempts), isNull(outbox.doneAt)))
      .returning({ id: outbox.id });
    if (!taken) continue;
    const orderId = (job.payload as { orderId?: string }).orderId ?? "";
    const [order] = orderId ? await db.select({ code: orders.code, eventId: orders.eventId, userId: orders.userId }).from(orders).where(eq(orders.id, orderId)).limit(1) : [];
    const about = { target: { type: "order", id: orderId, label: order?.code ?? "" }, eventId: order?.eventId, subjectUserId: order?.userId, actor: "system" as const };
    try {
      if (job.kind === "ticket_email") await sendTicketEmail(orderId);
      else if (job.kind === "attendee_ticket_email") await sendAttendeeEmail(orderId, Number((job.payload as { seq?: unknown }).seq) || 0);
      await db.update(outbox).set({ doneAt: new Date(), lastError: null }).where(eq(outbox.id, job.id));
      await audit({ ...about, action: "outbox.sent", details: { kind: job.kind, attempt: job.attempts + 1, jobId: job.id } });
    } catch (e) {
      console.error(`[outbox] ${job.kind} failed`, e);
      await db.update(outbox).set({ lastError: String(e).slice(0, 500) }).where(eq(outbox.id, job.id));
      await audit({ ...about, action: "outbox.failed", details: { kind: job.kind, attempt: job.attempts + 1, of: MAX_ATTEMPTS, error: String(e).slice(0, 500), jobId: job.id } });
    }
  }
}

/** The email after paying: the order in full, each ticket with its QR inline, and where the event is */
async function sendTicketEmail(orderId: string) {
  const db = getDb();
  const [row] = await db
    .select({ order: orders, event: events, zone: ticketZones, buyer: user })
    .from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .leftJoin(ticketZones, eq(ticketZones.id, orders.zoneId))
    .innerJoin(user, eq(user.id, orders.userId))
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!row) return;
  const [list, merch, [shipment]] = await Promise.all([
    db.select().from(tickets).where(eq(tickets.orderId, orderId)).orderBy(asc(tickets.seq)),
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.name), asc(orderItems.option)),
    db.select().from(orderShipments).where(eq(orderShipments.orderId, orderId)).limit(1),
  ]);
  const { order, event, zone, buyer } = row;
  const site = (process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  const when = `${dateFormat.format(event.startsAt)} เวลา ${timeFormat.format(event.startsAt)} น. (ประตูเปิด ${timeFormat.format(event.doorsAt)} น.)`;
  const where = [event.venue, event.venueArea].filter(Boolean).join(", ");
  const pin = event.latitude != null && event.longitude != null ? mapsLink({ lat: event.latitude, lng: event.longitude }) : null;

  const qrs = await Promise.all(list.map((t) => QRCode.toBuffer(t.secret, { width: 360, margin: 1, errorCorrectionLevel: "M" })));

  const facts: [string, string][] = [
    ["เลขที่คำสั่งซื้อ", order.code],
    ["อีเวนต์", event.title],
    ["วันเวลา", when],
    ["สถานที่", where],
    ...(zone
      ? ([
          ["ประเภทบัตร", `${zone.name}${zone.note ? ` (${zone.note})` : ""}`],
          ["จำนวน", `${order.quantity} ใบ × ${bahtOrFree(order.unitPrice)}`],
        ] as [string, string][])
      : ([["บัตร", "ไม่ได้ซื้อบัตร (สินค้าอย่างเดียว)"]] as [string, string][])),
    ...merch.map((s): [string, string] => [merchLabel(s), `${s.quantity} ชิ้น × ${bahtOrFree(s.unitPrice)}${shipment ? "" : " (รับที่หน้างาน)"}`]),
    ...(shipment
      ? ([
          ["ค่าจัดส่ง", bahtOrFree(shipment.fee)],
          ["จัดส่งถึง", `${shipment.name} · ${shipment.phone} · ${addressLine(shipment)}`],
        ] as [string, string][])
      : []),
    ["ยอดชำระ", bahtOrFree(order.total)],
    ...(order.tokens > 0 && order.quantity > 0
      ? ([["โทเคนที่ได้รับ", `ใบละ ${(order.tokens / order.quantity).toLocaleString("th-TH")} โทเคน (ใช้แลกสินค้าภายในงานด้วย QR ของบัตรใบนั้น)`]] as [string, string][])
      : []),
    ["ผู้ซื้อ", `${buyer.name} · ${buyer.phone}`],
  ];

  const ticketCards = list
    .map(
      (t, i) => `<div style="margin:0 0 16px;border:1px solid #e5e5e5;border-radius:14px;padding:16px;text-align:center">
        <p style="margin:0 0 2px;font-size:15px;font-weight:600">${escape(attendeeName({ firstName: t.attendeeFirstName, lastName: t.attendeeLastName, email: t.attendeeEmail }))}</p>
        <p style="margin:0 0 4px;font-size:12px;color:#737373">บัตรใบที่ ${t.seq} จาก ${list.length} · ${escape(zone?.name ?? "")}</p>
        <img src="cid:ticket-${i + 1}" width="200" height="200" alt="QR บัตรใบที่ ${t.seq}" style="display:block;margin:8px auto;width:200px;height:200px" />
        <p style="margin:4px 0 0;font-size:18px;font-weight:700;letter-spacing:3px;font-family:Consolas,monospace">${escape(t.code)}</p>
      </div>`,
    )
    .join("");

  await sendMail({
    to: buyer.email,
    subject: list.length ? `บัตรของคุณ: ${event.title} (${order.code})` : `ยืนยันคำสั่งซื้อ: ${event.title} (${order.code})`,
    text: [
      `สวัสดีคุณ ${buyer.name}`,
      "",
      "ชำระเงินเรียบร้อยแล้ว นี่คือบัตรของคุณ แสดง QR ให้เจ้าหน้าที่สแกนที่ทางเข้า",
      "",
      ...facts.map(([k, v]) => `${k}: ${v}`),
      "",
      ...list.map((t) => `บัตรใบที่ ${t.seq} (${attendeeName({ firstName: t.attendeeFirstName, lastName: t.attendeeLastName, email: t.attendeeEmail })}): รหัส ${t.code}`),
      "",
      `ดูบัตรและ QR ได้ที่ ${site}/tickets`,
      ...(pin ? [`แผนที่: ${pin}`] : []),
    ].join("\n"),
    html: layout(`<p style="margin:0 0 8px;font-size:16px">สวัสดีคุณ ${escape(buyer.name)}</p>
      <p style="margin:0 0 20px;font-size:14px;color:#525252;line-height:1.6">ชำระเงินเรียบร้อยแล้ว นี่คือบัตรของคุณ แสดง QR ให้เจ้าหน้าที่สแกนที่ทางเข้า บัตรหนึ่งใบเข้างานได้หนึ่งคน</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:13px">
        ${facts
          .map(
            ([k, v]) => `<tr>
          <td style="padding:7px 0;border-bottom:1px solid #f0f0f0;color:#737373;vertical-align:top;white-space:nowrap">${escape(k)}</td>
          <td style="padding:7px 0 7px 12px;border-bottom:1px solid #f0f0f0;text-align:right">${escape(v)}</td>
        </tr>`,
          )
          .join("")}
      </table>
      ${ticketCards}
      <p style="margin:20px 0 12px">${button(`${site}/tickets`, "ดูบัตรของฉัน")}</p>
      ${pin ? `<p style="margin:0 0 12px;font-size:13px"><a href="${escape(pin)}" style="color:#171717">เปิดแผนที่สถานที่จัดงาน</a></p>` : ""}
      <p style="margin:16px 0 0;font-size:12px;color:#737373;line-height:1.6">อย่าส่งต่อ QR ให้คนอื่น บัตรที่ถูกสแกนแล้วใช้ซ้ำไม่ได้</p>`),
    attachments: qrs.map((content, i) => ({ filename: `ticket-${i + 1}.png`, content, contentId: `ticket-${i + 1}` })),
  });
}

/** To someone a ticket was bought for: just their ticket, its QR, and who bought it for them */
async function sendAttendeeEmail(orderId: string, seq: number) {
  const db = getDb();
  const [row] = await db
    .select({ ticket: tickets, event: events, zone: ticketZones, buyer: user })
    .from(tickets)
    .innerJoin(events, eq(events.id, tickets.eventId))
    .innerJoin(ticketZones, eq(ticketZones.id, tickets.zoneId))
    .innerJoin(user, eq(user.id, tickets.userId))
    .where(and(eq(tickets.orderId, orderId), eq(tickets.seq, seq)))
    .limit(1);
  if (!row || !row.ticket.attendeeEmail) return;
  const { ticket, event, zone, buyer } = row;
  const name = attendeeName({ firstName: ticket.attendeeFirstName, lastName: ticket.attendeeLastName, email: ticket.attendeeEmail });
  const when = `${dateFormat.format(event.startsAt)} เวลา ${timeFormat.format(event.startsAt)} น. (ประตูเปิด ${timeFormat.format(event.doorsAt)} น.)`;
  const where = [event.venue, event.venueArea].filter(Boolean).join(", ");
  const pin = event.latitude != null && event.longitude != null ? mapsLink({ lat: event.latitude, lng: event.longitude }) : null;
  const qr = await QRCode.toBuffer(ticket.secret, { width: 360, margin: 1, errorCorrectionLevel: "M" });
  const facts: [string, string][] = [
    ["อีเวนต์", event.title],
    ["วันเวลา", when],
    ["สถานที่", where],
    ["ประเภทบัตร", `${zone.name}${zone.note ? ` (${zone.note})` : ""}`],
    ["ซื้อให้โดย", buyer.name],
  ];
  await sendMail({
    to: ticket.attendeeEmail,
    subject: `บัตรเข้างานของคุณ: ${event.title}`,
    text: [`สวัสดีคุณ ${name}`, "", `${buyer.name} ซื้อบัตรงานนี้ให้คุณ แสดง QR ในอีเมลนี้ให้เจ้าหน้าที่สแกนที่ทางเข้า`, "", ...facts.map(([k, v]) => `${k}: ${v}`), "", `รหัสบัตร: ${ticket.code}`, ...(pin ? [`แผนที่: ${pin}`] : [])].join("\n"),
    html: layout(`<p style="margin:0 0 8px;font-size:16px">สวัสดีคุณ ${escape(name)}</p>
      <p style="margin:0 0 20px;font-size:14px;color:#525252;line-height:1.6">${escape(buyer.name)} ซื้อบัตรงานนี้ให้คุณ แสดง QR นี้ให้เจ้าหน้าที่สแกนที่ทางเข้า QR เดียวกันนี้ใช้เติมและจ่ายโทเคนภายในงานด้วย</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:13px">
        ${facts.map(([k, v]) => `<tr><td style="padding:7px 0;border-bottom:1px solid #f0f0f0;color:#737373;white-space:nowrap">${escape(k)}</td><td style="padding:7px 0 7px 12px;border-bottom:1px solid #f0f0f0;text-align:right">${escape(v)}</td></tr>`).join("")}
      </table>
      <div style="margin:0 0 16px;border:1px solid #e5e5e5;border-radius:14px;padding:16px;text-align:center">
        <img src="cid:ticket" width="200" height="200" alt="QR บัตร" style="display:block;margin:8px auto;width:200px;height:200px" />
        <p style="margin:4px 0 0;font-size:18px;font-weight:700;letter-spacing:3px;font-family:Consolas,monospace">${escape(ticket.code)}</p>
      </div>
      ${pin ? `<p style="margin:0 0 12px;font-size:13px"><a href="${escape(pin)}" style="color:#171717">เปิดแผนที่สถานที่จัดงาน</a></p>` : ""}
      <p style="margin:16px 0 0;font-size:12px;color:#737373;line-height:1.6">อย่าส่งต่อ QR ให้คนอื่น บัตรที่ถูกสแกนแล้วใช้ซ้ำไม่ได้</p>`),
    attachments: [{ filename: "ticket.png", content: qr, contentId: "ticket" }],
  });
}
