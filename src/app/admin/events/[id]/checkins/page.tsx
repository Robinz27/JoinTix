import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download04Icon, QrCode01Icon, Search01Icon, Ticket02Icon, UserCheck01Icon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { ScanBadge } from "@/components/admin/scan-badge";
import { Badge, Empty, MiniStat, card, input, pill, pillPrimary, td, tdMain, tdTight, th } from "@/components/admin/ui";
import { UndoCheckinButton } from "@/components/admin/undo-checkin-button";
import { Icon } from "@/components/icon";
import { getAdminEvent } from "@/lib/admin-events";
import { checkinList, doorStats, scanLog } from "@/lib/checkins";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "รายชื่อเข้างาน" };

const num = new Intl.NumberFormat("th-TH");
const when = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Bangkok" });

const STATES = [
  { value: "all", label: "ทั้งหมด" },
  { value: "in", label: "เข้างานแล้ว" },
  { value: "out", label: "ยังไม่เข้า" },
] as const;

export default async function CheckinsPage({ params, searchParams }: PageProps<"/admin/events/[id]/checkins">) {
  const { id } = await params;
  const { access } = await requirePermission("attendees.view", `/admin/events/${id}/checkins`);
  const canScan = can(access, "door.scan");
  const [event, query] = await Promise.all([getAdminEvent(id), searchParams]);
  if (!event) notFound();

  const tab = query.tab === "log" ? "log" : "list";
  const q = typeof query.q === "string" ? query.q.slice(0, 100) : "";
  const state = STATES.find((s) => s.value === query.state)?.value ?? "all";
  const zoneId = typeof query.zone === "string" && event.zones.some((z) => z.id === query.zone) ? query.zone : "";
  const [stats, rows, log] = await Promise.all([
    doorStats(event.id),
    tab === "list" ? checkinList(event.id, { q, state, zoneId }) : Promise.resolve([]),
    tab === "log" ? scanLog(event.id, 300) : Promise.resolve([]),
  ]);

  const href = (patch: Record<string, string>) => {
    const next = new URLSearchParams({ ...(q && { q }), ...(state !== "all" && { state }), ...(zoneId && { zone: zoneId }), ...(tab === "log" && { tab }), ...patch });
    for (const [k, v] of [...next]) if (!v) next.delete(k);
    const s = next.toString();
    return `/admin/events/${event.id}/checkins${s ? `?${s}` : ""}`;
  };
  const share = stats.tickets ? Math.round((stats.checkedIn / stats.tickets) * 100) : 0;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        {canScan && (
          <Link href={`/admin/scan?event=${event.id}`} className={`${pillPrimary} max-sm:flex-1 max-sm:justify-center`}>
            <Icon icon={QrCode01Icon} className="size-4" />
            สแกนบัตร
          </Link>
        )}
        <a href={`/admin/events/${event.id}/checkins/csv`} className={`${pill} max-sm:flex-1 max-sm:justify-center`}>
          <Icon icon={Download04Icon} className="size-4" />
          ดาวน์โหลด CSV
        </a>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <MiniStat icon={Ticket02Icon} label="บัตรทั้งหมด" value={num.format(stats.tickets)} />
        <MiniStat icon={UserCheck01Icon} label="บัตรเข้างานแล้ว" value={`${num.format(stats.checkedIn)} (${share}%)`} />
        <MiniStat icon={UserMultipleIcon} label="ผู้ซื้อ" value={num.format(stats.people)} />
        <MiniStat icon={UserCheck01Icon} label="คนเข้างานแล้ว" value={num.format(stats.peopleIn)} />
      </div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${share}%` }} />
      </div>

      <nav className="mb-3 flex gap-1.5" aria-label="มุมมอง">
        <Link href={href({ tab: "" })} aria-current={tab === "list" ? "page" : undefined} className={`${pill} h-8 px-3 text-xs ${tab === "list" ? "border-foreground/40 bg-secondary" : "text-muted-foreground"}`}>
          รายชื่อ
        </Link>
        <Link href={href({ tab: "log" })} aria-current={tab === "log" ? "page" : undefined} className={`${pill} h-8 px-3 text-xs ${tab === "log" ? "border-foreground/40 bg-secondary" : "text-muted-foreground"}`}>
          ประวัติการสแกน
        </Link>
      </nav>

      {tab === "list" ? (
        <section className={`${card} overflow-hidden`}>
          <div className="flex flex-col gap-3 border-b border-border p-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
              {STATES.map((s) => (
                <Link
                  key={s.value}
                  href={href({ state: s.value === "all" ? "" : s.value })}
                  aria-current={state === s.value ? "page" : undefined}
                  className={`${pill} h-8 px-3 text-xs ${state === s.value ? "border-foreground/40 bg-secondary text-foreground" : "text-muted-foreground"}`}
                >
                  {s.label}
                </Link>
              ))}
              {event.zones.length > 1 &&
                event.zones.map((z) => (
                  <Link
                    key={z.id}
                    href={href({ zone: zoneId === z.id ? "" : z.id })}
                    aria-current={zoneId === z.id ? "page" : undefined}
                    className={`${pill} h-8 px-3 text-xs ${zoneId === z.id ? "border-foreground/40 bg-secondary text-foreground" : "text-muted-foreground"}`}
                  >
                    {z.name}
                  </Link>
                ))}
            </div>
            <form className="relative lg:w-72" role="search">
              {state !== "all" && <input type="hidden" name="state" value={state} />}
              {zoneId && <input type="hidden" name="zone" value={zoneId} />}
              <Icon icon={Search01Icon} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input name="q" type="search" defaultValue={q} placeholder="ชื่อ อีเมล เบอร์ รหัสบัตร" aria-label="ค้นหาผู้ถือบัตร" className={`${input} h-9 pl-9`} />
            </form>
          </div>

          {rows.length === 0 ? (
            <Empty icon={Ticket02Icon} title={q ? `ไม่พบ “${q}”` : "ยังไม่มีบัตรในกลุ่มนี้"} />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className={th}>ผู้ถือบัตร</th>
                  <th className={`${th} hidden md:table-cell`}>บัตร</th>
                  <th className={th}>สถานะ</th>
                  <th className={th}>
                    <span className="sr-only">จัดการ</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.ticketId} className="transition-colors hover:bg-secondary/40">
                    <td className={tdMain}>
                      <p className="truncate text-foreground">{row.holder.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.holder.phone} · {row.holder.email}
                      </p>
                      {row.buyer && <p className="truncate text-2xs text-muted-foreground">ซื้อโดย {row.buyer.name}</p>}
                      <p className="mt-0.5 truncate text-2xs text-muted-foreground md:hidden">
                        {row.zone} · <span className="font-mono">{row.code}</span>
                      </p>
                    </td>
                    <td className={`${td} hidden whitespace-nowrap md:table-cell`}>
                      <p className="text-foreground">{row.zone}</p>
                      <p className="text-2xs text-muted-foreground">
                        <span className="font-mono">{row.code}</span> · ใบที่ {row.seq}/{row.quantity} · {row.orderCode}
                      </p>
                    </td>
                    <td className={tdTight}>
                      {row.status === "used" ? (
                        <>
                          <Badge tone="good">เข้างานแล้ว</Badge>
                          <p className="mt-1 text-2xs text-muted-foreground tabular-nums">{row.checkedInAt && when.format(new Date(row.checkedInAt))}</p>
                          {row.checkedInBy && <p className="text-2xs text-muted-foreground">โดย {row.checkedInBy}</p>}
                        </>
                      ) : row.status === "void" ? (
                        <Badge tone="strong">ยกเลิก</Badge>
                      ) : (
                        <Badge>ยังไม่เข้า</Badge>
                      )}
                    </td>
                    <td className={`${tdTight} text-right`}>{canScan && row.status === "used" && <UndoCheckinButton ticketId={row.ticketId} holder={row.holder.name} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : (
        <section className={`${card} overflow-hidden`}>
          {log.length === 0 ? (
            <Empty icon={QrCode01Icon} title="ยังไม่มีการสแกนงานนี้" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className={th}>เวลา</th>
                  <th className={th}>บัตร</th>
                  <th className={`${th} hidden sm:table-cell`}>ผล</th>
                  <th className={`${th} hidden md:table-cell`}>โดย</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {log.map((entry) => (
                  <tr key={entry.id}>
                    <td className={`${tdTight} text-xs text-muted-foreground tabular-nums`}>{when.format(new Date(entry.at))}</td>
                    <td className={tdMain}>
                      <p className="truncate text-foreground">{entry.holder ?? "ไม่พบบัตร"}</p>
                      <p className="truncate text-2xs text-muted-foreground">
                        <span className="font-mono">{entry.input}</span>
                        {entry.zone ? ` · ${entry.zone}` : ""}
                        {entry.event && entry.event !== event.title ? ` · บัตรงาน ${entry.event}` : ""}
                      </p>
                      <span className="mt-1 inline-block sm:hidden">
                        <ScanBadge result={entry.result} />
                      </span>
                    </td>
                    <td className={`${tdTight} hidden sm:table-cell`}>
                      <ScanBadge result={entry.result} />
                    </td>
                    <td className={`${td} hidden text-xs text-muted-foreground md:table-cell`}>{entry.by ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </>
  );
}
