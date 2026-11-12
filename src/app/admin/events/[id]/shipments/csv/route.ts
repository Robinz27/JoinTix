import { getAdminEvent } from "@/lib/admin-events";
import { audit } from "@/lib/audit";
import { csvResponse } from "@/lib/csv";
import { addressLine, merchLabel } from "@/lib/event-fields";
import { can } from "@/lib/permissions";
import { getAdminAccess } from "@/lib/session";
import { listShipments } from "@/lib/shipments";

// ที่อยู่จัดส่ง as a CSV, for printing labels. Anyone without the permission gets the same 404 as the rest of หลังบ้าน.

export async function GET(_: Request, { params }: RouteContext<"/admin/events/[id]/shipments/csv">) {
  const access = await getAdminAccess();
  if (!access || !can(access, "merch.ship")) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const event = await getAdminEvent(id);
  if (!event) return new Response("Not found", { status: 404 });

  const rows = await listShipments(event.id);
  // Home addresses leaving the site: who took them, and when
  await audit({ action: "export.csv", target: { type: "shipment", id: event.id, label: `ที่อยู่จัดส่ง ${event.title}` }, eventId: event.id, details: { file: `shipments-${event.slug}.csv`, rows: rows.length } });
  return csvResponse(
    `shipments-${event.slug}.csv`,
    ["คำสั่งซื้อ", "ผู้รับ", "เบอร์โทร", "ที่อยู่", "สินค้า", "สถานะ", "ขนส่ง", "เลขพัสดุ"],
    rows.map((r) => [
      r.code,
      r.name,
      r.phone,
      addressLine(r),
      r.merch.map((item) => `${merchLabel(item)} x${item.quantity}`).join(", "),
      r.shippedAt ? "ส่งแล้ว" : "รอจัดส่ง",
      r.carrier,
      r.trackingNo,
    ]),
  );
}
