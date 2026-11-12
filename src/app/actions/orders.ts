"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { EVENTS_TAG } from "@/lib/events";
import type { Attendee, ShippingAddress } from "@/lib/event-fields";
import { admitAtDoor, doorStats, scanAtDoor, scanLog, undoCheckIn, type DoorScan, type DoorStats, type LogEntry } from "@/lib/checkins";
import { audit } from "@/lib/audit";
import { cancelOrder, handOverMerch, holdTickets, lookupOrderByCode, saveAttendees, type MerchPick, type PickupResult } from "@/lib/orders";
import { confirmFree, openSlipLink, orderStatus, slipLink, spendSlipLink, submitSlip, type SlipAnswer } from "@/lib/payments";
import { processOutbox } from "@/lib/outbox";
import { getSession, requirePermission } from "@/lib/session";

// Buying tickets (components/ticket-panel.tsx → app/(site)/checkout/[id]) and letting people in at the
// door (app/admin/scan, app/admin/events/[id]/checkins). The rules live in lib/orders.ts and lib/checkins.ts;
// these check who is asking.

/** ซื้อบัตร: holds the tickets, then on to checkout. Needs a signed-in account with a verified email */
export async function startCheckout(input: { slug: string; zoneId: string; quantity: number; merch: MerchPick[]; delivery: ShippingAddress | null; key: string }): Promise<{ error: string }> {
  const session = await getSession();
  if (!session) return { error: "เข้าสู่ระบบก่อนซื้อบัตร" };
  // Tickets go to this email, so it has to be the buyer's
  if (!session.user.emailVerified) return { error: "ยืนยันอีเมลก่อนซื้อบัตร" };
  const held = await holdTickets({ userId: session.user.id, ...input });
  if (!held.ok) return { error: held.error };
  // What's left changed: the event page and cards show it
  updateTag(EVENTS_TAG);
  redirect(`/checkout/${held.orderId}`);
}

/** ข้อมูลผู้เข้างาน: who each ticket is for, before paying */
export async function saveCheckoutAttendees(orderId: string, attendees: Attendee[]): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "เข้าสู่ระบบก่อน" };
  const saved = await saveAttendees(orderId, session.user.id, attendees);
  if (!saved.ok) return { error: saved.error };
  await audit({
    action: "order.attendees",
    target: { type: "order", id: orderId },
    subjectUserId: session.user.id,
    details: { attendees: attendees.map((a) => `${a.firstName.trim()} ${a.lastName.trim()} <${a.email.trim().toLowerCase()}>`) },
  });
  refresh();
  return {};
}

/** แนบสลิป from the checkout page: the picture and what the browser read off its QR */
export async function sendSlip(orderId: string, form: FormData): Promise<SlipAnswer> {
  const session = await getSession();
  if (!session) return { ok: false, error: "เข้าสู่ระบบก่อน" };
  const file = form.get("slip");
  if (!(file instanceof File)) return { ok: false, error: "เลือกรูปสลิปก่อน" };
  const qr = form.get("qr");
  const answer = await submitSlip({ orderId, userId: session.user.id, file, qr: typeof qr === "string" ? qr : null, from: "web" });
  if (answer.ok && answer.status === "paid") after(() => processOutbox());
  return answer;
}

/** แนบสลิปผ่านมือถือ: a one-time link for the phone to open (lib/payments.ts) */
export async function openPhoneSlip(orderId: string): Promise<{ token?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "เข้าสู่ระบบก่อน" };
  const status = await orderStatus(orderId, session.user.id);
  if (status !== "pending") return { error: "คำสั่งซื้อนี้แนบสลิปไม่ได้แล้ว รีเฟรชหน้า" };
  return { token: openSlipLink(orderId, session.user.id) };
}

/** The phone's part: the slip goes straight to the order the link is for */
export async function sendSlipFromPhone(token: string, form: FormData): Promise<SlipAnswer> {
  const link = slipLink(token);
  if (!link) return { ok: false, error: "ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว สร้างคิวอาร์โค้ดใหม่ที่หน้าชำระเงิน" };
  const file = form.get("slip");
  if (!(file instanceof File)) return { ok: false, error: "เลือกรูปสลิปก่อน" };
  const qr = form.get("qr");
  const answer = await submitSlip({ orderId: link.orderId, userId: link.userId, file, qr: typeof qr === "string" ? qr : null, from: "phone" });
  // A slip that went in uses the link up; one turned down may be tried again from the same phone
  if (answer.ok) spendSlipLink(token);
  if (answer.ok && answer.status === "paid") after(() => processOutbox());
  return answer;
}

/** What the checkout page polls while the phone is busy */
export async function checkoutStatus(orderId: string): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  return orderStatus(orderId, session.user.id);
}

/** ยืนยันรับบัตร: a free order has nothing to transfer */
export async function confirmFreeOrder(orderId: string): Promise<{ error: string }> {
  const session = await getSession();
  if (!session) return { error: "เข้าสู่ระบบก่อน" };
  const done = await confirmFree(orderId, session.user.id);
  if (!done.ok) return { error: done.error };
  after(() => processOutbox());
  redirect(`/tickets?paid=${orderId}`);
}

/** ยกเลิกคำสั่งซื้อ: the held tickets go back at once */
export async function cancelCheckout(orderId: string) {
  const session = await getSession();
  if (!session) return;
  await cancelOrder(orderId, session.user.id);
  updateTag(EVENTS_TAG);
  refresh();
}

/** สแกนบัตร: what the QR or typed code is, whether it may go in at this door; logged */
export async function scanTicket(scanned: string, doorEventId: string | null): Promise<DoorScan> {
  const { user } = await requirePermission("door.scan", "/admin/scan");
  return scanAtDoor(scanned, user.id, doorEventId);
}

/** ให้เข้างาน: marks the ticket used (once, at its own event's door) and answers with it as it is now */
export async function admitTicket(ticketId: string, scanned: string, doorEventId: string | null): Promise<DoorScan> {
  const { user } = await requirePermission("door.scan", "/admin/scan");
  const answer = await admitAtDoor(ticketId, scanned, user.id, doorEventId);
  refresh();
  return answer;
}

/** ยกเลิกการเช็กอิน: back to not-yet-in; logged with who did it */
export async function undoAdmit(ticketId: string): Promise<boolean> {
  const { user } = await requirePermission("door.scan", "/admin/scan");
  const undone = await undoCheckIn(ticketId, user.id);
  refresh();
  return undone;
}

/** ส่งมอบสินค้า: all the merchandise of this ticket's order, once, and the ticket as it is now */
export async function giveMerch(ticketId: string, scanned: string, doorEventId: string | null): Promise<DoorScan> {
  const { user } = await requirePermission("door.scan", "/admin/scan");
  await handOverMerch({ ticketId }, user.id);
  return scanAtDoor(scanned, user.id, doorEventId);
}

/** An order by its code (JT-XXXXXXXX): merchandise bought without a ticket is handed over from it */
export async function findPickup(code: string): Promise<PickupResult | null> {
  await requirePermission("door.scan", "/admin/scan");
  return lookupOrderByCode(code);
}

/** ส่งมอบสินค้า of an order found by its code */
export async function givePickup(orderId: string, code: string): Promise<PickupResult | null> {
  const { user } = await requirePermission("door.scan", "/admin/scan");
  await handOverMerch({ orderId }, user.id);
  return lookupOrderByCode(code);
}

/** What the scan page shows beside the camera: the door's counts and its latest scans */
export async function doorFeed(doorEventId: string | null): Promise<{ stats: DoorStats | null; log: LogEntry[] }> {
  await requirePermission("door.scan", "/admin/scan");
  const [stats, log] = await Promise.all([doorEventId ? doorStats(doorEventId) : null, scanLog(doorEventId, 10)]);
  return { stats, log };
}
