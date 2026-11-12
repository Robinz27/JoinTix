"use server";

import { after } from "next/server";
import { refresh, updateTag } from "next/cache";
import { EVENTS_TAG } from "@/lib/events";
import { processOutbox } from "@/lib/outbox";
import { approvePayment, rejectPayment } from "@/lib/payments";
import { requirePermission } from "@/lib/session";

// หลังบ้าน /admin/payments: a person decides on a slip Slip2Go couldn't (or wasn't asked to). Rules in lib/payments.ts.

export async function approveSlip(paymentId: string): Promise<{ error?: string }> {
  const { user } = await requirePermission("payments.review", "/admin/payments");
  const done = await approvePayment(paymentId, user.id);
  if (!done.error) after(() => processOutbox());
  refresh();
  return done;
}

export async function rejectSlip(paymentId: string, reason: string, then: "retry" | "cancel"): Promise<{ error?: string }> {
  const { user } = await requirePermission("payments.review", "/admin/payments");
  const done = await rejectPayment(paymentId, reason, then === "cancel" ? "cancel" : "retry", user.id);
  // A cancelled order puts its tickets back on sale
  if (!done.error && then === "cancel") updateTag(EVENTS_TAG);
  refresh();
  return done;
}
