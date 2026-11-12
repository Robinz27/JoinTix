import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { orderShipments, orders, user } from "@/db/schema";
import { merchOf, type OrderMerch, type OrderShipment } from "@/lib/orders";

// จัดส่ง (app/admin/events/[id]/shipments): the paid orders of an event whose merchandise goes by post. Server only.

export type ShipmentRow = OrderShipment & { orderId: string; code: string; paidAt: string | null; buyer: string; email: string; merch: OrderMerch[] };

export type ShipmentState = "waiting" | "shipped" | "all";

/** Waiting ones oldest first, since those have waited longest; shipped ones newest first */
export async function listShipments(eventId: string, state: ShipmentState = "all"): Promise<ShipmentRow[]> {
  const rows = await getDb()
    .select({ shipment: orderShipments, code: orders.code, paidAt: orders.paidAt, buyer: user.name, email: user.email })
    .from(orderShipments)
    .innerJoin(orders, eq(orders.id, orderShipments.orderId))
    .innerJoin(user, eq(user.id, orders.userId))
    .where(
      and(
        eq(orders.eventId, eventId),
        eq(orders.status, "paid"),
        state === "waiting" ? isNull(orderShipments.shippedAt) : state === "shipped" ? isNotNull(orderShipments.shippedAt) : undefined,
      ),
    )
    .orderBy(state === "shipped" ? desc(orderShipments.shippedAt) : asc(orders.paidAt));
  const merch = await merchOf(rows.map((row) => row.shipment.orderId));
  return rows.map(({ shipment, code, paidAt, buyer, email }) => ({
    orderId: shipment.orderId,
    code,
    paidAt: paidAt?.toISOString() ?? null,
    buyer,
    email,
    merch: merch.get(shipment.orderId) ?? [],
    fee: shipment.fee,
    name: shipment.name,
    phone: shipment.phone,
    address: shipment.address,
    subdistrict: shipment.subdistrict,
    district: shipment.district,
    province: shipment.province,
    postcode: shipment.postcode,
    carrier: shipment.carrier,
    trackingNo: shipment.trackingNo,
    shippedAt: shipment.shippedAt?.toISOString() ?? null,
  }));
}

/** บันทึกว่าส่งแล้ว, or again to correct the tracking number. Keeps the first time it went out */
export async function markShipped(orderId: string, by: string, carrier: string, trackingNo: string) {
  const db = getDb();
  const [row] = await db.select({ shippedAt: orderShipments.shippedAt }).from(orderShipments).where(eq(orderShipments.orderId, orderId)).limit(1);
  if (!row) return false;
  await db
    .update(orderShipments)
    .set({ carrier, trackingNo, shippedAt: row.shippedAt ?? new Date(), shippedBy: by })
    .where(eq(orderShipments.orderId, orderId));
  return true;
}

/** ยังไม่ได้ส่ง: marked by mistake */
export async function unmarkShipped(orderId: string) {
  await getDb().update(orderShipments).set({ shippedAt: null, shippedBy: null }).where(eq(orderShipments.orderId, orderId));
}
