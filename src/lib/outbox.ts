import { and, asc, eq, isNull, lt, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { getDb } from "@/db";
import { events, orders, outbox, ticketZones, tickets, user } from "@/db/schema";
import { button, escape, layout, sendMail } from "@/lib/mail";
import { mapsLink } from "@/lib/map";

// The outbox (HANDOFF section 7): work that follows a payment but mustn't slow it down or fail it, done
// after the response (after() in app/actions/orders.ts) and again on the next pass if it failed. One job
// for now: ticket_email, the email with every ticket's QR. Server only.

const MAX_ATTEMPTS = 5;

const dateFormat = new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });
const timeFormat = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
const baht = (n: number) => (n === 0 ? "ฟรี" : `฿${n.toLocaleString("th-TH")}`);

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
    try {
      if (job.kind === "ticket_email") await sendTicketEmail((job.payload as { orderId: string }).orderId);
      await db.update(outbox).set({ doneAt: new Date(), lastError: null }).where(eq(outbox.id, job.id));
    } catch (e) {
      console.error(`[outbox] ${job.kind} failed`, e);
      await db.update(outbox).set({ lastError: String(e).slice(0, 500) }).where(eq(outbox.id, job.id));
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
    .innerJoin(ticketZones, eq(ticketZones.id, orders.zoneId))
    .innerJoin(user, eq(user.id, orders.userId))
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!row) return;
  const list = await db.select().from(tickets).where(eq(tickets.orderId, orderId)).orderBy(asc(tickets.seq));
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
    ["ประเภทบัตร", `${zone.name}${zone.note ? ` (${zone.note})` : ""}`],
    ["จำนวน", `${order.quantity} ใบ × ${baht(order.unitPrice)}`],
    ["ยอดชำระ", baht(order.total)],
    ...(order.tokens > 0 ? ([["โทเคนที่ได้รับ", `${order.tokens.toLocaleString("th-TH")} โทเคน (ใช้แลกสินค้าภายในงาน)`]] as [string, string][]) : []),
    ["ผู้ซื้อ", `${buyer.name} · ${buyer.phone}`],
  ];

  const ticketCards = list
    .map(
      (t, i) => `<div style="margin:0 0 16px;border:1px solid #e5e5e5;border-radius:14px;padding:16px;text-align:center">
        <p style="margin:0 0 4px;font-size:12px;color:#737373">บัตรใบที่ ${t.seq} จาก ${list.length} · ${escape(zone.name)}</p>
        <img src="cid:ticket-${i + 1}" width="200" height="200" alt="QR บัตรใบที่ ${t.seq}" style="display:block;margin:8px auto;width:200px;height:200px" />
        <p style="margin:4px 0 0;font-size:18px;font-weight:700;letter-spacing:3px;font-family:Consolas,monospace">${escape(t.code)}</p>
      </div>`,
    )
    .join("");

  await sendMail({
    to: buyer.email,
    subject: `บัตรของคุณ: ${event.title} (${order.code})`,
    text: [
      `สวัสดีคุณ ${buyer.name}`,
      "",
      "ชำระเงินเรียบร้อยแล้ว นี่คือบัตรของคุณ แสดง QR ให้เจ้าหน้าที่สแกนที่ทางเข้า",
      "",
      ...facts.map(([k, v]) => `${k}: ${v}`),
      "",
      ...list.map((t) => `บัตรใบที่ ${t.seq}: รหัส ${t.code}`),
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
