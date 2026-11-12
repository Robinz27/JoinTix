"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb } from "@/db";
import { orderShipments, orders } from "@/db/schema";
import type { AdminFormState } from "@/lib/form";
import { audit, changesOf } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { markShipped, unmarkShipped } from "@/lib/shipments";
import { isUuid } from "@/lib/uuid";

// The จัดส่ง tab (app/admin/events/[id]/shipments)

const LABELS = { carrier: "ขนส่ง", trackingNo: "เลขพัสดุ", shipped: "ส่งแล้ว" };

/** The shipment as it is now, with its order, for the log */
async function shipmentOf(orderId: string) {
  const [row] = await getDb()
    .select({ carrier: orderShipments.carrier, trackingNo: orderShipments.trackingNo, shippedAt: orderShipments.shippedAt, code: orders.code, eventId: orders.eventId, userId: orders.userId })
    .from(orderShipments)
    .innerJoin(orders, eq(orders.id, orderShipments.orderId))
    .where(eq(orderShipments.orderId, orderId))
    .limit(1);
  return row;
}

export async function saveShipped(orderId: string, carrier: string, trackingNo: string): Promise<AdminFormState> {
  const { user } = await requirePermission("merch.ship", "/admin/events");
  const name = String(carrier ?? "").trim();
  const tracking = String(trackingNo ?? "").trim();
  if (!isUuid(orderId)) return { error: "ไม่พบคำสั่งซื้อนี้" };
  if (name.length > 60 || tracking.length > 60) return { error: "ขนส่งหรือเลขพัสดุยาวเกิน 60 ตัวอักษร" };
  const before = await shipmentOf(orderId);
  if (!before || !(await markShipped(orderId, user.id, name, tracking))) return { error: "ไม่พบคำสั่งซื้อนี้" };
  await audit({
    action: "shipment.ship",
    target: { type: "shipment", id: orderId, label: before.code },
    eventId: before.eventId,
    subjectUserId: before.userId,
    changes: changesOf({ ...before, shipped: Boolean(before.shippedAt) }, { carrier: name, trackingNo: tracking, shipped: true }, LABELS),
  });
  refresh();
  return { ok: "บันทึกแล้ว" };
}

export async function undoShipped(orderId: string) {
  await requirePermission("merch.ship", "/admin/events");
  if (!isUuid(orderId)) return;
  const before = await shipmentOf(orderId);
  if (!before) return;
  await unmarkShipped(orderId);
  await audit({
    action: "shipment.unship",
    target: { type: "shipment", id: orderId, label: before.code },
    eventId: before.eventId,
    subjectUserId: before.userId,
    changes: changesOf({ shipped: Boolean(before.shippedAt) }, { shipped: false }, LABELS),
    details: { carrier: before.carrier, trackingNo: before.trackingNo, shippedAt: before.shippedAt },
  });
  refresh();
}
