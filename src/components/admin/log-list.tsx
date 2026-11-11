import Link from "next/link";
import { ArrowRight01Icon, ComputerIcon, SmartPhone01Icon, WorkHistoryIcon } from "@hugeicons/core-free-icons";
import { DayLabel, TimeAgo } from "@/components/admin/relative-time";
import { dayKey, fullDateTime as full } from "@/lib/format";
import { Empty } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { AUDIT_ACTIONS, DETAIL_LABELS, deviceLabel, ipLabel, isAuditAction, isFiltered, logQuery, showValue, targetHref, type AuditChange, type LogFilters } from "@/lib/audit-actions";
import type { LogRow } from "@/lib/audit-log";

// The rows of ประวัติการใช้งาน, shared by /admin/logs, an event's ประวัติ tab and a member's page. Each row is one
// sentence ("สมชาย แก้ไขอีเวนต์ Midnight Echo") and how long ago, grouped under วันนี้ / เมื่อวาน / the date.
// Opening it shows what changed, before → after, in plain words. The technical part (ids, the browser's full
// string) is for a super admin only. A plain <details>, so it needs no JavaScript.


const DOT = { muted: "bg-muted-foreground/40", good: "bg-emerald-500", warn: "bg-amber-500", danger: "bg-red-500" } as const;

/** A map pin is two numbers; shown as one line, "moved", rather than latitude and longitude apart */
function readableChanges(changes: AuditChange[]): AuditChange[] {
  const out: AuditChange[] = [];
  for (const change of changes) {
    if (change.field.endsWith("longitude")) continue;
    if (change.field.endsWith("latitude")) {
      const lng = changes.find((c) => c.field === change.field.replace(/latitude$/, "longitude"));
      const pin = (lat: unknown, long: unknown) => (lat === null || lat === undefined ? null : `${lat}, ${long ?? ""}`);
      out.push({ field: "pin", label: "หมุดแผนที่", from: pin(change.from, lng?.from), to: pin(change.to, lng?.to) });
      continue;
    }
    out.push(change);
  }
  return out;
}

/** A value; long text shows its start, the rest one click away */
function Value({ value, className = "" }: { value: unknown; className?: string }) {
  const text = showValue(value);
  if (text.length <= 140) return <span className={className}>{text}</span>;
  return (
    <details className={`group/v inline ${className}`}>
      <summary className="inline cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {text.slice(0, 120)}… <span className="text-2xs text-muted-foreground underline group-open/v:hidden">ดูทั้งหมด</span>
      </summary>
      <span className="mt-1 block whitespace-pre-wrap">{text}</span>
    </details>
  );
}

export function LogList({
  rows,
  showEvent = true,
  actorHref,
  technical = false,
  empty = "ยังไม่มีประวัติ",
  emptyDetail,
}: {
  rows: LogRow[];
  /** Whether to name the event on each row (not on the event's own tab) */
  showEvent?: boolean;
  /** Where a person's name links to */
  actorHref?: (actorId: string) => string;
  /** The ids and full browser string, for a super admin */
  technical?: boolean;
  empty?: string;
  emptyDetail?: string;
}) {
  if (rows.length === 0) return <Empty icon={WorkHistoryIcon} title={empty} detail={emptyDetail} />;
  const days: { key: string; rows: LogRow[] }[] = [];
  for (const row of rows) {
    const key = dayKey(new Date(row.at));
    if (days.at(-1)?.key === key) days.at(-1)!.rows.push(row);
    else days.push({ key, rows: [row] });
  }
  return (
    <div>
      {days.map((day) => (
        <section key={day.key}>
          <h3 className="sticky top-0 z-10 border-b border-border bg-secondary/80 px-4 py-1.5 text-2xs font-medium text-muted-foreground backdrop-blur sm:px-5">
            <DayLabel day={day.key} />
          </h3>
          <ul className="divide-y divide-border">
            {day.rows.map((row) => (
              <LogItem key={row.id} row={row} showEvent={showEvent} actorHref={actorHref} technical={technical} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function LogItem({ row, showEvent, actorHref, technical }: { row: LogRow; showEvent: boolean; actorHref?: (actorId: string) => string; technical: boolean }) {
  const meta = isAuditAction(row.action) ? AUDIT_ACTIONS[row.action] : null;
  const href = targetHref(row);
  const device = deviceLabel(row.userAgent);
  const phone = /iPhone|Android|iPad/.test(row.userAgent ?? "");
  const system = !row.actor.id && row.actor.role === "ระบบ";
  const changes = readableChanges(row.changes);
  const details = Object.entries(row.details ?? {});
  // Someone not signed in has no name: "มีคน" reads as a sentence where "ผู้ที่ไม่ได้เข้าสู่ระบบ" doesn't
  const who = row.actor.name || row.actor.email || (system ? "ระบบ" : "มีคน");
  const at = new Date(row.at);
  const target = row.targetLabel && row.targetLabel !== row.actor.email ? row.targetLabel : "";
  // The longer wording leads into the thing it names, so only when that thing is shown
  const verb = (target && meta && "sentence" in meta ? meta.sentence : undefined) ?? meta?.label ?? row.action;
  const staff = row.actor.role && !["ลูกค้า", "ระบบ", "ไม่ได้เข้าสู่ระบบ"].includes(row.actor.role);
  const open = changes.length + details.length > 0 || technical;

  return (
    <li className="flex gap-3 px-4 py-3 sm:px-5">
      <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT[meta?.tone ?? "muted"]}`} />
      <div className="min-w-0 flex-1">
        {/* The sentence: who, did what, to what */}
        <p className="text-sm break-words text-foreground">
          {row.actor.id && actorHref ? (
            <Link href={actorHref(row.actor.id)} className="font-semibold hover:underline">
              {who}
            </Link>
          ) : (
            <span className="font-semibold">{who}</span>
          )}
          {staff && <span className="text-xs text-muted-foreground"> ({row.actor.role})</span>} <span>{verb}</span>
          {target && (
            <>
              {" "}
              {href ? (
                <Link href={href} className="font-medium underline decoration-border underline-offset-2 hover:decoration-foreground">
                  {target}
                </Link>
              ) : (
                <span className="font-medium">{target}</span>
              )}
            </>
          )}
        </p>

        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-muted-foreground">
          <TimeAgo iso={row.at} />
          {showEvent && row.eventId && row.targetType !== "event" && (
            <Link href={`/admin/events/${row.eventId}/logs`} className="hover:text-foreground hover:underline">
              · งาน {row.eventTitle ?? "ที่ถูกลบแล้ว"}
            </Link>
          )}
          {device && (
            <span className="inline-flex items-center gap-1">
              · <Icon icon={phone ? SmartPhone01Icon : ComputerIcon} className="size-3" />
              {device}
            </span>
          )}
        </p>

        {open && (
          <details className="group mt-1.5">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full text-xs text-muted-foreground select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
              <Icon icon={ArrowRight01Icon} className="size-3.5 transition-transform group-open:rotate-90" />
              {changes.length > 0 ? `ดูที่เปลี่ยน ${changes.length} อย่าง` : "ดูรายละเอียด"}
            </summary>
            <div className="mt-2 space-y-3 rounded-xl border border-border bg-secondary/30 p-3 text-xs">
              {changes.length > 0 && (
                <dl className="space-y-2">
                  {changes.map((change, i) => (
                    <div key={`${change.field}-${i}`} className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
                      <dt className="font-medium break-words text-foreground">{change.label}</dt>
                      <dd className="min-w-0 break-words">
                        {change.from === null || change.from === undefined || change.from === "" ? (
                          <span className="text-foreground">
                            <span className="text-muted-foreground">ตั้งเป็น </span>
                            <Value value={change.to} />
                          </span>
                        ) : change.to === null || change.to === undefined || change.to === "" ? (
                          <span className="text-muted-foreground">
                            ลบ <Value value={change.from} className="line-through decoration-red-500/60" />
                          </span>
                        ) : (
                          <span className="flex flex-wrap items-baseline gap-x-1.5">
                            <Value value={change.from} className="text-muted-foreground line-through decoration-red-500/60" />
                            <span aria-label="เปลี่ยนเป็น" className="text-muted-foreground">
                              →
                            </span>
                            <Value value={change.to} className="font-medium text-foreground" />
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {details.length > 0 && (
                <dl className={`space-y-1.5 ${changes.length ? "border-t border-border pt-3" : ""}`}>
                  {details.map(([key, value]) => (
                    <div key={key} className="grid gap-x-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
                      <dt className="text-muted-foreground">{DETAIL_LABELS[key] ?? key}</dt>
                      <dd className="min-w-0 break-words text-foreground">
                        <Value value={value} />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="border-t border-border pt-2 text-2xs text-muted-foreground">
                {full.format(at)}
                {row.ip && <span> · IP {ipLabel(row.ip)}</span>}
              </p>
              {technical && (
                <p className="font-mono text-2xs break-all text-muted-foreground">
                  {row.action} · {row.targetType}:{row.targetId || "-"} · log {row.id}
                  {row.userAgent && <span className="block font-sans">{row.userAgent}</span>}
                </p>
              )}
            </div>
          </details>
        )}
      </div>
    </li>
  );
}

/** ← หน้าก่อน · หน้า x จาก y · หน้าถัดไป → */
export function LogPager({ page, total, perPage, href }: { page: number; total: number; perPage: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  const step = "inline-flex h-8 items-center rounded-full border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary";
  const off = "pointer-events-none opacity-40";
  return (
    <nav aria-label="แบ่งหน้า" className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-5">
      <Link href={href(page - 1)} aria-disabled={page <= 1} className={`${step} ${page <= 1 ? off : ""}`}>
        ก่อนหน้า
      </Link>
      <span className="text-xs text-muted-foreground tabular-nums">
        หน้า {page.toLocaleString("th-TH")} จาก {pages.toLocaleString("th-TH")}
      </span>
      <Link href={href(page + 1)} aria-disabled={page >= pages} className={`${step} ${page >= pages ? off : ""}`}>
        ถัดไป
      </Link>
    </nav>
  );
}

/** The line over the rows: how many, and a way to the routine ones the list is hiding */
export function LogCount({ total, page, perPage, filters, base }: { total: number; page: number; perPage: number; filters: LogFilters; base: string }) {
  const n = (v: number) => v.toLocaleString("th-TH");
  return (
    <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
      <span>
        {n(total)} รายการ{total > perPage && ` · แสดง ${n((page - 1) * perPage + 1)}–${n(Math.min(total, page * perPage))}`}
      </span>
      {!filters.all && (
        <Link href={`${base}${logQuery({ ...filters, all: true })}`} className="underline-offset-2 hover:text-foreground hover:underline">
          ซ่อนการสแกนบัตรและการเข้าสู่ระบบอยู่ · แสดงทุกอย่าง
        </Link>
      )}
    </p>
  );
}

/** What the empty list says, depending on why it's empty */
export function emptyDetail(filters: LogFilters) {
  if (isFiltered(filters)) return "ลองเอาตัวกรองบางอันออก หรือเปลี่ยนช่วงเวลา";
  if (!filters.all) return "ยังไม่มีการแก้ไขข้อมูล ถ้าจะดูการสแกนบัตรหรือการเข้าสู่ระบบ ให้เปิด “แสดงทุกอย่าง” ในตัวกรอง";
  return undefined;
}
