import { merchLabel } from "@/lib/event-fields";
import { getAdminEvent } from "@/lib/admin-events";
import { audit } from "@/lib/audit";
import { checkinList } from "@/lib/checkins";
import { csvResponse } from "@/lib/csv";
import { merchOf } from "@/lib/orders";
import { can } from "@/lib/permissions";
import { getAdminAccess } from "@/lib/session";

// รายชื่อผู้ลงทะเบียน as a CSV: every ticket of the event, its holder, their merchandise and whether they came in.
// Anyone without the permission gets the same 404 as the rest of หลังบ้าน.

const when = new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Bangkok" });

export async function GET(_: Request, { params }: RouteContext<"/admin/events/[id]/checkins/csv">) {
  const access = await getAdminAccess();
  if (!access || !can(access, "attendees.view")) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const event = await getAdminEvent(id);
  if (!event) return new Response("Not found", { status: 404 });

  const rows = await checkinList(event.id);
  await audit({ action: "export.csv", target: { type: "event", id: event.id, label: `รายชื่อผู้ลงทะเบียน ${event.title}` }, eventId: event.id, details: { file: `checkins-${event.slug}.csv`, rows: rows.length } });
  const merch = await merchOf([...new Set(rows.map((r) => r.orderId))]);
  return csvResponse(
    `checkins-${event.slug}.csv`,
    ["ชื่อผู้เข้างาน", "อีเมลผู้เข้างาน", "เบอร์โทรผู้ซื้อ", "ผู้ซื้อ", "อีเมลผู้ซื้อ", "โซน", "รหัสบัตร", "ใบที่", "คำสั่งซื้อ", "สินค้าในคำสั่งซื้อ", "สถานะ", "เวลาเข้างาน", "สแกนโดย"],
    rows.map((r) => [
      r.holder.name,
      r.holder.email,
      r.holder.phone,
      r.buyer?.name ?? r.holder.name,
      r.buyer?.email ?? r.holder.email,
      r.zone,
      r.code,
      `${r.seq}/${r.quantity}`,
      r.orderCode,
      (merch.get(r.orderId) ?? []).map((s) => `${merchLabel(s)} x${s.quantity}`).join(", "),
      r.status === "used" ? "เข้างานแล้ว" : r.status === "void" ? "ยกเลิก" : "ยังไม่เข้า",
      r.checkedInAt ? when.format(new Date(r.checkedInAt)) : "",
      r.checkedInBy ?? "",
    ]),
  );
}
