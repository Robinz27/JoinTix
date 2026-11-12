import { adminEventOptions } from "@/lib/admin-events";
import { audit } from "@/lib/audit";
import { csvResponse } from "@/lib/csv";
import { can } from "@/lib/permissions";
import { listRegistrants, type RegistrantFilter } from "@/lib/registrants";
import { getAdminAccess } from "@/lib/session";

// ผู้ลงทะเบียน as a CSV, with the page's filters: everyone who signed up, their รุ่น, what they bought and whether
// they came in. Anyone without the permission gets the same 404 as the rest of หลังบ้าน.

const when = new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok" });

export async function GET(request: Request) {
  const access = await getAdminAccess();
  if (!access || !can(access, "attendees.view")) return new Response("Not found", { status: 404 });
  const params = new URL(request.url).searchParams;
  const events = await adminEventOptions();
  const eventId = events.find((e) => e.id === params.get("event"))?.id ?? null;
  const boughtParam = params.get("bought");
  const bought: RegistrantFilter["bought"] = boughtParam === "yes" || boughtParam === "no" ? boughtParam : "all";
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  const { rows } = await listRegistrants({ q, eventId, bought }, 50_000);
  const event = events.find((e) => e.id === eventId);
  await audit({
    action: "export.csv",
    target: { type: "report", label: event ? `ผู้ลงทะเบียน ${event.title}` : "ผู้ลงทะเบียนทั้งหมด" },
    eventId,
    details: { file: "registrants.csv", rows: rows.length, q: q || null, bought },
  });
  return csvResponse(
    "registrants.csv",
    ["ชื่อ", "อีเมล", "เบอร์โทร", "รุ่น", "ยืนยันอีเมล", "สมัครเมื่อ", "คำสั่งซื้อที่ชำระแล้ว", "บัตร", "เข้างานแล้ว"],
    rows.map((r) => [r.name, r.email, r.phone, r.cohort, r.emailVerified ? "ใช่" : "ไม่", when.format(new Date(r.joinedAt)), r.orders, r.tickets, r.checkedIn]),
  );
}
