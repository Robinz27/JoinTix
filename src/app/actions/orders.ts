"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { EVENTS_TAG } from "@/lib/events";
import { cancelOrder, checkIn, holdTickets, lookupTicket, payOrder, type ScanResult } from "@/lib/orders";
import { processOutbox } from "@/lib/outbox";
import { getSession, requireSuperAdmin } from "@/lib/session";

// Buying tickets (components/ticket-panel.tsx → app/(site)/checkout/[id]) and letting people in at the
// door (app/admin/scan). The rules live in lib/orders.ts; these check who is asking.

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

/** สแกนบัตร: what the QR or typed code is, for a super admin at the door */
export async function scanTicket(scanned: string): Promise<ScanResult | null> {
  await requireSuperAdmin("/admin/scan");
  return lookupTicket(scanned);
}

/** ให้เข้างาน: marks the ticket used and answers with it as it is now */
export async function admitTicket(ticketId: string, scanned: string): Promise<{ admitted: boolean; result: ScanResult | null }> {
  const { user } = await requireSuperAdmin("/admin/scan");
  const admitted = await checkIn(ticketId, user.id);
  return { admitted, result: await lookupTicket(scanned) };
}
