import { audit } from "@/lib/audit";
import { AUDIT_ACTIONS, DETAIL_LABELS, TARGET_TYPES, deviceLabel, isAuditAction, showValue } from "@/lib/audit-actions";
import { LOGS_CSV_LIMIT, listLogs, readFilters } from "@/lib/audit-log";
import { csvResponse } from "@/lib/csv";
import { can } from "@/lib/permissions";
import { getAdminAccess } from "@/lib/session";

// ประวัติการใช้งาน as a CSV, with the same filters as the page (/admin/logs/csv?actor=…&from=…). Anyone without the
// permission gets the same 404 as the rest of หลังบ้าน. Taking the log away is itself logged.

const when = new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Bangkok" });

export async function GET(request: Request) {
  const access = await getAdminAccess();
  if (!access || !can(access, "logs.view")) return new Response("Not found", { status: 404 });
  const filters = readFilters(Object.fromEntries(new URL(request.url).searchParams));
  const { rows, total } = await listLogs(filters, 1, LOGS_CSV_LIMIT);
  const stamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" }).slice(0, 16).replace(/[ :]/g, "-");
  await audit({ action: "export.csv", target: { type: "log", label: "ประวัติการใช้งาน" }, eventId: filters.eventId, details: { file: `activity-log-${stamp}.csv`, rows: rows.length, of: total, ...filters } });

  return csvResponse(
    `activity-log-${stamp}.csv`,
    ["เวลา", "ผู้ทำ", "อีเมล", "โรล", "การกระทำ", "รหัสการกระทำ", "ประเภท", "รายการ", "id รายการ", "อีเวนต์", "IP", "อุปกรณ์", "การเปลี่ยนแปลง", "รายละเอียด", "User agent", "id log"],
    rows.map((r) => [
      when.format(new Date(r.at)),
      r.actor.name || (r.actor.role === "ระบบ" ? "ระบบ" : ""),
      r.actor.email,
      r.actor.role,
      isAuditAction(r.action) ? AUDIT_ACTIONS[r.action].label : r.action,
      r.action,
      TARGET_TYPES[r.targetType] ?? r.targetType,
      r.targetLabel,
      r.targetId,
      r.eventTitle ?? r.eventId ?? "",
      r.ip ?? "",
      deviceLabel(r.userAgent),
      r.changes.map((c) => `${c.label}: ${showValue(c.from)} → ${showValue(c.to)}`).join("\n"),
      Object.entries(r.details ?? {})
        .map(([key, value]) => `${DETAIL_LABELS[key] ?? key}: ${showValue(value)}`)
        .join("\n"),
      r.userAgent ?? "",
      r.id,
    ]),
  );
}
