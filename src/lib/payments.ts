import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { events, orders, payments, ticketZones, user } from "@/db/schema";
import { audit, auditQuery } from "@/lib/audit";
import { attendeesProblem } from "@/lib/event-fields";
import { HOLD_MINUTES, issueOrder, releaseExpired, releaseOrder } from "@/lib/orders";
import { isPromptPayTarget } from "@/lib/promptpay";
import { checkSlip, slip2goReady } from "@/lib/slip2go";
import { saveUploadedImage } from "@/lib/uploads";
import { uuidv7, isUuid } from "@/lib/uuid";

// Paying by bank transfer: the checkout shows a PromptPay QR with the amount filled in, the buyer pays in their
// banking app and sends the slip (from this device, or from their phone through a one-time link). Then:
//
//   - the event checks slips with Slip2Go ("api") and a key is set: the bank says yes → paid at once; the slip is
//     plainly wrong (someone else's account, not a real slip) → turned down and the buyer tries again; anything
//     the service can't settle (not found yet, quota, short amount) → waits for a person
//   - the event checks by hand ("manual"), or no QR could be read off the picture → waits for a person
//
// Waiting ("review") stops the hold's clock. หลังบ้าน /admin/payments approves (paid) or turns it down (back to
// pending for another slip, or cancelled). One transfer pays once: the slip's QR hash and the bank reference are
// unique among slips not turned down. Server only.

/** Turned-down slips one order may send in ten minutes, so the service isn't asked over and over */
const MAX_TRIES = 5;

const hash = (qr: string) => createHash("sha256").update(qr).digest("hex");

export type PaySettings = { promptpayId: string; promptpayName: string; slipCheck: "api" | "manual" };

/** The latest slip of an order, for its checkout page */
export type PaymentView = { id: string; status: "review" | "approved" | "rejected"; reason: string; createdAt: string };

export async function latestPayment(orderId: string): Promise<PaymentView | null> {
  const [row] = await getDb().select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.createdAt)).limit(1);
  return row ? { id: row.id, status: row.status as PaymentView["status"], reason: row.reason, createdAt: row.createdAt.toISOString() } : null;
}

export async function paySettings(eventId: string): Promise<PaySettings | null> {
  const [row] = await getDb().select({ promptpayId: events.promptpayId, promptpayName: events.promptpayName, slipCheck: events.slipCheck }).from(events).where(eq(events.id, eventId)).limit(1);
  return row ? { ...row, slipCheck: row.slipCheck === "manual" ? "manual" : "api" } : null;
}

export type SlipAnswer = { ok: true; status: "paid" | "review" } | { ok: false; error: string };

/**
 * แนบสลิป: `file` is the picture, `qr` what the browser read off it (null when it couldn't). `userId` is the buyer,
 * or null when the slip came from the buyer's phone through its link (which already proved whose order it is).
 */
export async function submitSlip(input: { orderId: string; userId: string | null; file: File; qr: string | null; from: "web" | "phone" }): Promise<SlipAnswer> {
  const { orderId, userId, file, from } = input;
  const qr = input.qr?.trim().slice(0, 1000) || null;
  if (!isUuid(orderId)) return { ok: false, error: "ไม่พบคำสั่งซื้อนี้" };
  const db = getDb();
  await releaseExpired();
  const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), userId ? eq(orders.userId, userId) : undefined)).limit(1);
  if (!order) return { ok: false, error: "ไม่พบคำสั่งซื้อนี้" };
  if (order.status === "review") return { ok: false, error: "ส่งสลิปแล้ว กำลังรอตรวจ" };
  if (order.status === "paid") return { ok: true, status: "paid" };
  if (order.status !== "pending") return { ok: false, error: order.status === "expired" ? "หมดเวลาชำระเงินแล้ว บัตรถูกปล่อยคืน ลองซื้อใหม่" : "คำสั่งซื้อนี้ถูกยกเลิกแล้ว" };
  if (order.total === 0) return { ok: false, error: "คำสั่งซื้อนี้ไม่ต้องชำระเงิน" };
  if (order.quantity > 0 && attendeesProblem(order.attendees, order.quantity)) return { ok: false, error: "กรอกข้อมูลผู้เข้างานให้ครบก่อนแนบสลิป" };
  const settings = await paySettings(order.eventId);
  if (!settings || !isPromptPayTarget(settings.promptpayId)) return { ok: false, error: "งานนี้ยังไม่ได้ตั้งบัญชีรับเงิน ติดต่อผู้จัดงาน" };

  const [{ tries }] = await db
    .select({ tries: sql<number>`count(*)`.mapWith(Number) })
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.status, "rejected"), gt(payments.createdAt, sql`now() - interval '10 minutes'`)));
  if (tries >= MAX_TRIES) return { ok: false, error: "ส่งสลิปไม่ผ่านหลายครั้งเกินไป รอสักครู่แล้วลองใหม่ หรือติดต่อผู้จัดงาน" };

  const saved = await saveUploadedImage(file, "slips");
  if (!saved.ok) return { ok: false, error: saved.error };
  const qrHash = qr ? hash(qr) : "";
  if (qrHash) {
    const [used] = await db.select({ id: payments.id }).from(payments).where(and(eq(payments.qrHash, qrHash), sql`${payments.status} <> 'rejected'`)).limit(1);
    if (used) return reject({ orderId, order, slip: saved.path, qrHash: "", reason: "สลิปนี้ถูกใช้ชำระไปแล้ว", code: "duplicate", from });
  }

  // What the bank says, when this event asks it
  let decision: "approve" | "review" = "review";
  let reason = settings.slipCheck === "manual" ? "งานนี้ตั้งให้ทีมงานตรวจสลิปเอง" : !slip2goReady() ? "ยังไม่ได้ตั้งค่าระบบตรวจสลิปอัตโนมัติ" : !qr ? "อ่าน QR บนสลิปไม่ได้" : "";
  let bank: { transRef: string; paidAmount: number | null; senderName: string; paidAt: Date | null; code: string } = { transRef: "", paidAmount: null, senderName: "", paidAt: null, code: "" };
  if (settings.slipCheck === "api" && slip2goReady() && qr) {
    const check = await checkSlip(qr, settings.promptpayId);
    if (check.ok) {
      const when = new Date(check.data.dateTime);
      bank = {
        transRef: String(check.data.transRef ?? "").slice(0, 100),
        paidAmount: Number(check.data.amount) || 0,
        senderName: String(check.data.sender?.account?.name ?? "").slice(0, 200),
        paidAt: Number.isNaN(when.getTime()) ? null : when,
        code: check.code,
      };
      if (bank.transRef) {
        const [used] = await db.select({ id: payments.id }).from(payments).where(and(eq(payments.transRef, bank.transRef), sql`${payments.status} <> 'rejected'`)).limit(1);
        if (used) return reject({ orderId, order, slip: saved.path, qrHash: "", reason: "สลิปนี้ถูกใช้ชำระไปแล้ว", code: "duplicate", from, bank: { ...bank, transRef: "" } });
      }
      // A transfer from before the order was made can't be for it (a minute's grace for clocks)
      if (bank.paidAt && bank.paidAt.getTime() < order.createdAt.getTime() - 60_000) reason = "เวลาโอนในสลิปเก่ากว่าคำสั่งซื้อ";
      else if ((bank.paidAmount ?? 0) + 0.005 < order.total) reason = `ยอดโอน ${bank.paidAmount?.toLocaleString("th-TH")} บาท น้อยกว่ายอดที่ต้องชำระ ${order.total.toLocaleString("th-TH")} บาท`;
      else decision = "approve";
    } else if (check.final) {
      return reject({ orderId, order, slip: saved.path, qrHash: "", reason: check.message, code: check.code, from });
    } else {
      reason = check.message;
      bank.code = check.code;
    }
  }

  const paymentId = uuidv7();
  const row = {
    id: paymentId,
    orderId,
    amount: order.total,
    slip: saved.path,
    qrHash,
    status: "review",
    transRef: bank.transRef,
    paidAmount: bank.paidAmount,
    senderName: bank.senderName,
    paidAt: bank.paidAt,
    checkCode: bank.code,
    reason: decision === "approve" ? "" : reason,
  } satisfies typeof payments.$inferInsert;
  const made = sql`exists (select 1 from ${payments} where ${payments.id} = ${paymentId}::uuid)`;
  try {
    await db.batch([
      db.insert(payments).values(row),
      // The clock stops while someone (or Slip2Go, a moment from now) looks at it
      db.update(orders).set({ status: "review" }).where(and(eq(orders.id, orderId), eq(orders.status, "pending"), sql`${orders.expiresAt} > now()`)),
      ...(await auditQuery(
        {
          action: "payment.submit",
          actor: userId ? undefined : { id: order.userId, ...(await buyerOf(order.userId)) },
          target: { type: "order", id: orderId, label: order.code },
          eventId: order.eventId,
          subjectUserId: order.userId,
          details: {
            amount: order.total,
            from: from === "phone" ? "มือถือ (ลิงก์จากหน้าชำระเงิน)" : "หน้าชำระเงิน",
            check: decision === "approve" ? "Slip2Go ยืนยันแล้ว" : `รอทีมงานตรวจ: ${reason}`,
            bankRef: bank.transRef || null,
            paidAmount: bank.paidAmount,
            sender: bank.senderName || null,
            paymentId,
          },
        },
        made,
      )),
    ]);
  } catch (e) {
    if (String((e as { cause?: unknown })?.cause ?? e).includes("payments_")) return { ok: false, error: "สลิปนี้ถูกใช้ชำระไปแล้ว" };
    throw e;
  }
  const [now] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (now?.status !== "review") {
    // The hold ran out a moment ago: nothing to pay for any more
    await db.update(payments).set({ status: "rejected", reason: "หมดเวลาชำระเงินก่อนส่งสลิป" }).where(eq(payments.id, paymentId));
    return { ok: false, error: "หมดเวลาชำระเงินแล้ว บัตรถูกปล่อยคืน ลองซื้อใหม่" };
  }
  if (decision === "review") return { ok: true, status: "review" };

  const issued = await issueOrder(orderId, {
    by: "api",
    paymentId,
    extra: [db.update(payments).set({ status: "approved", approvedVia: "api", reviewedAt: new Date() }).where(eq(payments.id, paymentId))],
  });
  return issued.ok ? { ok: true, status: "paid" } : { ok: false, error: issued.error };
}

async function buyerOf(userId: string) {
  const [row] = await getDb().select({ name: user.name, email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
  return { name: row?.name ?? "", email: row?.email ?? "", role: "ลูกค้า" };
}

/** A slip turned down straight away: kept (with why) for the record, and the order stays as it was */
async function reject(input: {
  orderId: string;
  order: typeof orders.$inferSelect;
  slip: string;
  qrHash: string;
  reason: string;
  code: string;
  from: "web" | "phone";
  bank?: { transRef: string; paidAmount: number | null; senderName: string; paidAt: Date | null };
}): Promise<SlipAnswer> {
  const id = uuidv7();
  await getDb().insert(payments).values({
    id,
    orderId: input.orderId,
    amount: input.order.total,
    slip: input.slip,
    qrHash: input.qrHash,
    status: "rejected",
    checkCode: input.code,
    reason: input.reason,
    transRef: input.bank?.transRef ?? "",
    paidAmount: input.bank?.paidAmount ?? null,
    senderName: input.bank?.senderName ?? "",
    paidAt: input.bank?.paidAt ?? null,
    reviewedAt: new Date(),
  });
  await audit({
    action: "payment.reject",
    actor: "system",
    target: { type: "order", id: input.orderId, label: input.order.code },
    eventId: input.order.eventId,
    subjectUserId: input.order.userId,
    details: { reason: input.reason, code: input.code || null, from: input.from === "phone" ? "มือถือ" : "หน้าชำระเงิน", by: "ตรวจอัตโนมัติ", paymentId: id },
  });
  return { ok: false, error: `${input.reason} ลองแนบสลิปใหม่อีกครั้ง` };
}

/** Free orders (total 0) have nothing to transfer: confirming issues the tickets */
export async function confirmFree(orderId: string, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isUuid(orderId)) return { ok: false, error: "ไม่พบคำสั่งซื้อนี้" };
  await releaseExpired();
  const [order] = await getDb().select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1);
  if (!order) return { ok: false, error: "ไม่พบคำสั่งซื้อนี้" };
  if (order.total !== 0) return { ok: false, error: "คำสั่งซื้อนี้ต้องชำระเงิน" };
  if (order.quantity > 0) {
    const problem = attendeesProblem(order.attendees, order.quantity);
    if (problem) return { ok: false, error: problem };
  }
  return issueOrder(orderId, { by: "admin", paymentId: "ฟรี (ไม่ต้องชำระ)" });
}

/* ─────────────── หลังบ้าน /admin/payments ─────────────── */

export type ReviewRow = {
  id: string;
  status: "review" | "approved" | "rejected";
  amount: number;
  slip: string;
  reason: string;
  checkCode: string;
  transRef: string;
  paidAmount: number | null;
  senderName: string;
  paidAt: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewer: string | null;
  approvedVia: string | null;
  order: { id: string; code: string; status: string; quantity: number; total: number; expiresAt: string };
  event: { id: string; title: string };
  zone: string | null;
  buyer: { id: string; name: string; email: string; phone: string };
};

/** Slips waiting for a person (oldest first), or the latest decided ones */
export async function listPayments(filter: { status: "review" | "done"; eventId?: string | null; limit?: number }): Promise<ReviewRow[]> {
  const reviewer = alias(user, "reviewer");
  const rows = await getDb()
    .select({ payment: payments, order: orders, event: events, zone: ticketZones.name, buyer: user, reviewer: reviewer.name })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .innerJoin(events, eq(events.id, orders.eventId))
    .leftJoin(ticketZones, eq(ticketZones.id, orders.zoneId))
    .innerJoin(user, eq(user.id, orders.userId))
    .leftJoin(reviewer, eq(reviewer.id, payments.reviewedBy))
    .where(and(filter.status === "review" ? eq(payments.status, "review") : inArray(payments.status, ["approved", "rejected"]), filter.eventId ? eq(orders.eventId, filter.eventId) : undefined))
    .orderBy(filter.status === "review" ? asc(payments.createdAt) : desc(payments.createdAt))
    .limit(filter.limit ?? 100);
  return rows.map(({ payment: p, order, event, zone, buyer, reviewer: by }) => ({
    id: p.id,
    status: p.status as ReviewRow["status"],
    amount: p.amount,
    slip: p.slip,
    reason: p.reason,
    checkCode: p.checkCode,
    transRef: p.transRef,
    paidAmount: p.paidAmount,
    senderName: p.senderName,
    paidAt: p.paidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    reviewedAt: p.reviewedAt?.toISOString() ?? null,
    reviewer: by,
    approvedVia: p.approvedVia,
    order: { id: order.id, code: order.code, status: order.status, quantity: order.quantity, total: order.total, expiresAt: order.expiresAt.toISOString() },
    event: { id: event.id, title: event.title },
    zone,
    buyer: { id: buyer.id, name: buyer.name, email: buyer.email, phone: buyer.phone },
  }));
}

/** Whether `slip` (a stored path) belongs to some payment: the slip route serves nothing else */
export async function isKnownSlip(slip: string) {
  const [row] = await getDb().select({ id: payments.id }).from(payments).where(eq(payments.slip, slip)).limit(1);
  return Boolean(row);
}

/** อนุมัติสลิป: the order is paid and its tickets issued, by this member of staff */
export async function approvePayment(paymentId: string, adminId: string): Promise<{ error?: string }> {
  if (!isUuid(paymentId)) return { error: "ไม่พบรายการนี้" };
  const db = getDb();
  const [p] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!p) return { error: "ไม่พบรายการนี้" };
  if (p.status !== "review") return { error: p.status === "approved" ? "สลิปนี้อนุมัติไปแล้ว" : "สลิปนี้ถูกปฏิเสธไปแล้ว" };
  const [order] = await db.select({ code: orders.code, eventId: orders.eventId, userId: orders.userId }).from(orders).where(eq(orders.id, p.orderId)).limit(1);
  const issued = await issueOrder(p.orderId, {
    by: "admin",
    paymentId,
    extra: [
      db.update(payments).set({ status: "approved", approvedVia: "admin", reviewedBy: adminId, reviewedAt: new Date() }).where(and(eq(payments.id, paymentId), eq(payments.status, "review"))),
      ...(await auditQuery({
        action: "payment.approve",
        target: { type: "order", id: p.orderId, label: order?.code ?? "" },
        eventId: order?.eventId,
        subjectUserId: order?.userId,
        details: { amount: p.amount, paidAmount: p.paidAmount, bankRef: p.transRef || null, sender: p.senderName || null, waitedFor: p.reason || null, paymentId },
      })),
    ],
  });
  return issued.ok ? {} : { error: issued.error };
}

/**
 * ปฏิเสธสลิป: `then` "retry" gives the buyer another HOLD_MINUTES to send a proper slip (the tickets stay held);
 * "cancel" lets the order go and its tickets back on sale
 */
export async function rejectPayment(paymentId: string, reason: string, then: "retry" | "cancel", adminId: string): Promise<{ error?: string }> {
  if (!isUuid(paymentId)) return { error: "ไม่พบรายการนี้" };
  const why = reason.trim().slice(0, 300);
  if (!why) return { error: "บอกเหตุผลที่ปฏิเสธ ลูกค้าจะเห็นข้อความนี้" };
  const db = getDb();
  const [marked] = await db
    .update(payments)
    .set({ status: "rejected", reason: why, reviewedBy: adminId, reviewedAt: new Date() })
    .where(and(eq(payments.id, paymentId), eq(payments.status, "review")))
    .returning();
  if (!marked) return { error: "สลิปนี้ถูกตรวจไปแล้ว" };
  if (then === "cancel") {
    await releaseOrder(marked.orderId, sql`${orders.status} = 'review'`, "payment.reject", "ทีมงานปฏิเสธสลิปและยกเลิกคำสั่งซื้อ บัตรและสินค้าคืนเข้าระบบ", { reason: why, paymentId });
    return {};
  }
  const [order] = await db
    .update(orders)
    .set({ status: "pending", expiresAt: sql`now() + make_interval(mins => ${HOLD_MINUTES})` })
    .where(and(eq(orders.id, marked.orderId), eq(orders.status, "review")))
    .returning({ code: orders.code, eventId: orders.eventId, userId: orders.userId });
  await audit({
    action: "payment.reject",
    target: { type: "order", id: marked.orderId, label: order?.code ?? "" },
    eventId: order?.eventId,
    subjectUserId: order?.userId,
    details: { reason: why, then: `ให้ลูกค้าแนบสลิปใหม่ภายใน ${HOLD_MINUTES} นาที`, amount: marked.amount, paymentId },
  });
  return {};
}

/* ─────────────── แนบสลิปผ่านมือถือ ─────────────── */

// The checkout shows a QR; the phone opens /pay/<token>, picks the slip from its photos and sends it straight to
// the order. The computer's page watches the order and moves on when it changes. A link lives ten minutes in this
// server's memory, is bound to one order and works once: it is the permission, the phone needn't sign in.

const LINK_MS = 10 * 60_000;
type Link = { orderId: string; userId: string; createdAt: number; used: boolean };
const g = globalThis as unknown as { slipLinks?: Map<string, Link> };
const links = (g.slipLinks ??= new Map());

const LINK_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function openSlipLink(orderId: string, userId: string): string {
  const now = Date.now();
  for (const [token, link] of links) if (now - link.createdAt > LINK_MS) links.delete(token);
  if (links.size > 5_000) links.delete(links.keys().next().value!);
  const token = randomBytes(32).toString("base64url");
  links.set(token, { orderId, userId, createdAt: now, used: false });
  return token;
}

/** The order a phone link is for, while it can still be used */
export function slipLink(token: string): Link | null {
  if (!LINK_TOKEN.test(token)) return null;
  const link = links.get(token);
  if (!link || link.used || Date.now() - link.createdAt > LINK_MS) return null;
  return link;
}

export function spendSlipLink(token: string) {
  const link = links.get(token);
  if (link) link.used = true;
}

/** What the checkout page needs to know while it waits for the phone */
export async function orderStatus(orderId: string, userId: string): Promise<string | null> {
  if (!isUuid(orderId)) return null;
  await releaseExpired();
  const [row] = await getDb().select({ status: orders.status }).from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1);
  return row?.status ?? null;
}

