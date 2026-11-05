import { getAdminEvent } from "@/lib/admin-events";
import { checkinList } from "@/lib/checkins";
import { getSession, isSuperAdmin } from "@/lib/session";

// รายชื่อเข้างาน as a CSV for Excel / Google Sheets: every ticket of the event, its holder and whether
// they came in. Super admins only; anyone else gets the same 404 as the rest of หลังบ้าน.

const when = new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Bangkok" });
const cell = (value: string | number) => {
  const text = String(value);
  // Quoted, and a leading = + - @ made harmless so a spreadsheet doesn't run it as a formula
  return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
};

export async function GET(_: Request, { params }: RouteContext<"/admin/events/[id]/checkins/csv">) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session.user)) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const event = await getAdminEvent(id);
  if (!event) return new Response("Not found", { status: 404 });

  const rows = await checkinList(event.id);
  const header = ["ชื่อ", "อีเมล", "เบอร์โทร", "โซน", "รหัสบัตร", "ใบที่", "คำสั่งซื้อ", "สถานะ", "เวลาเข้างาน", "สแกนโดย"];
  const lines = rows.map((r) =>
    [
      r.holder.name,
      r.holder.email,
      r.holder.phone,
      r.zone,
      r.code,
      `${r.seq}/${r.quantity}`,
      r.orderCode,
      r.status === "used" ? "เข้างานแล้ว" : r.status === "void" ? "ยกเลิก" : "ยังไม่เข้า",
      r.checkedInAt ? when.format(new Date(r.checkedInAt)) : "",
      r.checkedInBy ?? "",
    ]
      .map(cell)
      .join(","),
  );
  // The BOM makes Excel read the Thai as UTF-8
  const body = `﻿${[header.map(cell).join(","), ...lines].join("\r\n")}`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="checkins-${event.slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
