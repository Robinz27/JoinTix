import { merchLabel } from "@/lib/event-fields";
import { getAdminEvent } from "@/lib/admin-events";
import { audit } from "@/lib/audit";
import { csvResponse } from "@/lib/csv";
import { merchOf, shipmentsOf } from "@/lib/orders";
import { can } from "@/lib/permissions";
import { eventReport, orderRows, saleRows, tokenRows } from "@/lib/reports";
import { getAdminAccess } from "@/lib/session";

// รายงาน as CSV: /admin/reports/csv?event=<id>&kind=shops|sales|orders|tokens

const when = new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Bangkok" });
const REASONS: Record<string, string> = {
  ticket_purchase: "ได้จากบัตร",
  topup: "เติมโทเคน",
  topup_void: "ยกเลิกการเติม",
  shop_sale: "ใช้ที่ร้าน",
  shop_sale_void: "ยกเลิกรายการร้าน",
};

export async function GET(request: Request) {
  const access = await getAdminAccess();
  if (!access || !can(access, "reports.view")) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const event = await getAdminEvent(url.searchParams.get("event") ?? "");
  if (!event) return new Response("Not found", { status: 404 });
  const kind = url.searchParams.get("kind") ?? "";
  await audit({ action: "export.csv", target: { type: "report", id: event.id, label: `รายงาน ${event.title}` }, eventId: event.id, details: { kind } });

  switch (url.searchParams.get("kind")) {
    case "shops": {
      const { shops } = await eventReport(event.id);
      return csvResponse(
        `shops-${event.slug}.csv`,
        ["ร้าน", "รายละเอียด", "สถานะ", "รายการขาย", "โทเคน", "ต้องจ่ายร้าน (บาท)"],
        shops.map((s) => [s.name, s.note, s.active ? "เปิด" : "ปิด", s.sales, s.tokens, s.baht]),
      );
    }
    case "sales": {
      const rows = await saleRows(event.id);
      return csvResponse(
        `shop-sales-${event.slug}.csv`,
        ["เวลา", "ร้าน", "รายการ", "จำนวน", "โทเคนต่อชิ้น", "สถานะ", "ลูกค้า", "ขายโดย"],
        rows.map((r) => [when.format(r.at), r.shop, r.item, r.quantity, r.tokens, r.status === "voided" ? "ยกเลิก" : "สำเร็จ", r.customer, r.by ?? ""]),
      );
    }
    case "orders": {
      const rows = await orderRows(event.id);
      const [merch, shipments] = await Promise.all([merchOf(rows.map((r) => r.id)), shipmentsOf(rows.map((r) => r.id))]);
      return csvResponse(
        `orders-${event.slug}.csv`,
        ["เลขคำสั่งซื้อ", "ชำระเมื่อ", "ชื่อ", "อีเมล", "เบอร์โทร", "โซน", "จำนวนบัตร", "ราคาบัตร", "สินค้า", "การรับสินค้า", "ค่าจัดส่ง", "ยอดรวม", "โทเคนที่ได้"],
        rows.map((r) => [
          r.code,
          r.paidAt ? when.format(r.paidAt) : "",
          r.name,
          r.email,
          r.phone,
          r.zone ?? "สินค้าอย่างเดียว",
          r.quantity,
          r.unitPrice,
          (merch.get(r.id) ?? []).map((s) => `${merchLabel(s)} x${s.quantity}`).join(", "),
          merch.get(r.id)?.length ? (shipments.has(r.id) ? "จัดส่ง" : "รับที่งาน") : "",
          shipments.get(r.id)?.fee ?? 0,
          r.total,
          r.tokens,
        ]),
      );
    }
    case "tokens": {
      const rows = await tokenRows(event.id);
      return csvResponse(
        `tokens-${event.slug}.csv`,
        ["เวลา", "ประเภท", "โทเคน", "เงินสด (บาท)", "ลูกค้า", "เบอร์โทร", "ทำรายการโดย"],
        rows.map((r) => [when.format(r.at), REASONS[r.reason] ?? r.reason, r.amount, r.baht, r.customer, r.phone, r.by ?? ""]),
      );
    }
    default:
      return new Response("Not found", { status: 404 });
  }
}
