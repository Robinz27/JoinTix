"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { EVENTS_TAG } from "@/lib/events";
import { admitAtDoor, doorStats, scanAtDoor, scanLog, undoCheckIn, type DoorScan, type DoorStats, type LogEntry } from "@/lib/checkins";
import { cancelOrder, holdTickets, payOrder } from "@/lib/orders";
import { processOutbox } from "@/lib/outbox";
import { getSession, requireSuperAdmin } from "@/lib/session";

// Buying tickets (components/ticket-panel.tsx → app/(site)/checkout/[id]) and letting people in at the
// door (app/admin/scan, app/admin/events/[id]/checkins). The rules live in lib/orders.ts and lib/checkins.ts;
// these check who is asking.

/** ซื้อบัตร: holds the tickets, then on to checkout. Needs a signed-in account with a verified email */
export async function startCheckout(input: { slug: string; zoneId: string; quantity: number; key: string }): Promise<{ error: string }> {
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

/** ยืนยันชำระเงิน (simulated) → tickets, tokens, and the email sent after the response */
export async function confirmPayment(orderId: string): Promise<{ error: string }> {
  const session = await getSession();
  if (!session) return { error: "เข้าสู่ระบบก่อน" };
  const paid = await payOrder(orderId, session.user.id);
  if (!paid.ok) return { error: paid.error };
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
  const { user } = await requireSuperAdmin("/admin/scan");
  return scanAtDoor(scanned, user.id, doorEventId);
}

/** ให้เข้างาน: marks the ticket used (once, at its own event's door) and answers with it as it is now */
export async function admitTicket(ticketId: string, scanned: string, doorEventId: string | null): Promise<DoorScan> {
  const { user } = await requireSuperAdmin("/admin/scan");
  const answer = await admitAtDoor(ticketId, scanned, user.id, doorEventId);
  refresh();
  return answer;
}

/** ยกเลิกการเช็กอิน: back to not-yet-in; logged with who did it */
export async function undoAdmit(ticketId: string): Promise<boolean> {
  const { user } = await requireSuperAdmin("/admin/scan");
  const undone = await undoCheckIn(ticketId, user.id);
  refresh();
  return undone;
}

/** What the scan page shows beside the camera: the door's counts and its latest scans */
export async function doorFeed(doorEventId: string | null): Promise<{ stats: DoorStats | null; log: LogEntry[] }> {
  await requireSuperAdmin("/admin/scan");
  const [stats, log] = await Promise.all([doorEventId ? doorStats(doorEventId) : null, scanLog(doorEventId, 10)]);
  return { stats, log };
}
