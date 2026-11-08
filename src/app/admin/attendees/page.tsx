import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight01Icon, Calendar03Icon, CheckmarkCircle02Icon, Download04Icon, Search01Icon, Ticket02Icon, UserAdd01Icon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { Badge, Empty, MiniStat, PageHeader, Panel, card, iconButton, input, td, tdMain, tdTight, th } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { adminEventOptions } from "@/lib/admin-events";
import { checkinList } from "@/lib/checkins";
import { can } from "@/lib/permissions";
import { listRegistrants, registrantStats, type RegistrantFilter } from "@/lib/registrants";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "ผู้ลงทะเบียน" };

const dateFormat = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });
const num = new Intl.NumberFormat("th-TH");
const BOUGHT = [
  { value: "all", label: "ทั้งหมด" },
  { value: "yes", label: "ซื้อบัตรแล้ว" },
  { value: "no", label: "ยังไม่ซื้อ" },
] as const;

/**
 * ผู้ลงทะเบียน as the client counts them: everyone who signed up (not only buyers), how many bought and how many came
 * in, for every event or one. Search by name, email, phone or รุ่น; download it as CSV. A search also finds tickets
 * (by attendee, ticket or order code) across every event, and each event's own check-in list is a click away.
 */
export default async function AttendeesPage({ searchParams }: PageProps<"/admin/attendees">) {
  const { access } = await requirePermission("attendees.view", "/admin/attendees");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const events = await adminEventOptions();
  const eventId = typeof params.event === "string" && events.some((e) => e.id === params.event) ? params.event : null;
  const bought = BOUGHT.some((b) => b.value === params.bought) ? (params.bought as RegistrantFilter["bought"]) : "all";
  const filter: RegistrantFilter = { q, eventId, bought };
  const [{ rows, total }, stats, tickets] = await Promise.all([listRegistrants(filter), registrantStats(eventId), q ? checkinList(null, { q }) : Promise.resolve([])]);
  const event = events.find((e) => e.id === eventId);
  const members = can(access, "members.manage");

  const href = (next: Partial<{ q: string; event: string | null; bought: string }>) => {
    const query = new URLSearchParams();
    const merged = { q, event: eventId, bought, ...next };
    if (merged.q) query.set("q", merged.q);
    if (merged.event) query.set("event", merged.event);
    if (merged.bought && merged.bought !== "all") query.set("bought", merged.bought);
    const text = query.toString();
    return text ? `?${text}` : "";
  };
  const chip = (on: boolean) =>
    `inline-flex h-8 shrink-0 items-center rounded-full px-3.5 text-xs transition-colors ${on ? "bg-foreground font-medium text-background" : "border border-border text-muted-foreground hover:text-foreground"}`;

  return (
    <>
      <PageHeader eyebrow="Registrants" title="ผู้ลงทะเบียน" description={event ? `สมาชิกทุกคนที่สมัคร และสิ่งที่ซื้อในงาน ${event.title}` : "สมาชิกทุกคนที่สมัคร รวมคนที่ยังไม่ซื้อบัตร ซื้อแล้วกี่คน และเข้างานแล้วกี่ใบ"}>
        <a href={`/admin/attendees/csv${href({})}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary max-sm:flex-1 max-sm:justify-center">
          <Icon icon={Download04Icon} className="size-4" />
          ดาวน์โหลด CSV
        </a>
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <MiniStat icon={UserAdd01Icon} label="สมัครแล้ว" value={`${num.format(stats.registered)} คน`} />
        <MiniStat icon={UserMultipleIcon} label="ซื้อบัตรแล้ว" value={`${num.format(stats.buyers)} คน`} />
        <MiniStat icon={Ticket02Icon} label="บัตรที่ขายได้" value={`${num.format(stats.tickets)} ใบ`} />
        <MiniStat icon={CheckmarkCircle02Icon} label="เข้างานแล้ว" value={`${num.format(stats.checkedIn)} ใบ`} />
      </div>

      <section className={`${card} mb-4 space-y-3 p-3 sm:p-4`}>
        <form role="search" className="relative">
          {eventId && <input type="hidden" name="event" value={eventId} />}
          {bought !== "all" && <input type="hidden" name="bought" value={bought} />}
          <Icon icon={Search01Icon} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input name="q" type="search" defaultValue={q} placeholder="ชื่อ อีเมล เบอร์ รุ่น หรือรหัสบัตร" aria-label="ค้นหาผู้ลงทะเบียน" className={`${input} pl-9`} />
        </form>
        <nav aria-label="งาน" className="flex gap-1.5 overflow-x-auto pb-0.5">
          <Link href={href({ event: null })} className={chip(!eventId)}>
            ทุกงาน
          </Link>
          {events.map((e) => (
            <Link key={e.id} href={href({ event: e.id })} className={`${chip(e.id === eventId)} max-w-56`}>
              <span className="truncate">{e.title}</span>
            </Link>
          ))}
        </nav>
        <nav aria-label="การซื้อ" className="flex flex-wrap gap-1.5">
          {BOUGHT.map((b) => (
            <Link key={b.value} href={href({ bought: b.value })} className={chip(b.value === bought)}>
              {b.label}
            </Link>
          ))}
        </nav>
      </section>

      <section className={`${card} mb-4 overflow-hidden`}>
        <p className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
          {num.format(total)} คน{total > rows.length ? ` · แสดง ${num.format(rows.length)} คนล่าสุด ดาวน์โหลด CSV เพื่อดูทั้งหมด` : ""}
        </p>
        {rows.length === 0 ? (
          <Empty icon={UserMultipleIcon} title={q ? `ไม่พบ “${q}”` : "ยังไม่มีผู้ลงทะเบียน"} detail={q ? "ลองค้นด้วยคำอื่น หรือดูบัตรที่ตรงกันด้านล่าง" : undefined} />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className={th}>ชื่อ</th>
                <th className={`${th} hidden md:table-cell`}>รุ่น</th>
                <th className={`${th} text-right`}>บัตร</th>
                <th className={`${th} hidden text-right sm:table-cell`}>เข้างาน</th>
                <th className={`${th} hidden lg:table-cell`}>สมัครเมื่อ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-secondary/40">
                  <td className={tdMain}>
                    {members ? (
                      <Link href={`/admin/users/${row.id}`} className="block truncate text-foreground hover:underline">
                        {row.name}
                      </Link>
                    ) : (
                      <p className="truncate text-foreground">{row.name}</p>
                    )}
                    <p className="truncate text-xs text-muted-foreground">
                      {row.phone} · {row.email}
                    </p>
                    {row.cohort && <p className="truncate text-2xs text-muted-foreground md:hidden">รุ่น {row.cohort}</p>}
                  </td>
                  <td className={`${td} hidden max-w-40 truncate text-muted-foreground md:table-cell`}>{row.cohort || "-"}</td>
                  <td className={`${tdTight} text-right tabular-nums`}>{row.tickets ? <span className="font-medium text-foreground">{num.format(row.tickets)}</span> : <Badge>ยังไม่ซื้อ</Badge>}</td>
                  <td className={`${tdTight} hidden text-right sm:table-cell`}>
                    {row.tickets ? row.checkedIn ? <Badge tone="good">{`${num.format(row.checkedIn)}/${num.format(row.tickets)}`}</Badge> : <span className="text-xs text-muted-foreground">ยังไม่เข้า</span> : null}
                  </td>
                  <td className={`${tdTight} hidden text-xs text-muted-foreground lg:table-cell`}>{dateFormat.format(new Date(row.joinedAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {q && tickets.length > 0 && (
        <Panel icon={Ticket02Icon} title="บัตรที่ตรงกับคำค้น" subtitle="ค้นจากชื่อผู้เข้างาน รหัสบัตร และเลขคำสั่งซื้อ ทุกงาน">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {tickets.map((row) => (
                <tr key={row.ticketId} className="transition-colors hover:bg-secondary/40">
                  <td className={tdMain}>
                    <p className="truncate text-foreground">{row.holder.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.holder.phone} · {row.holder.email}
                    </p>
                    {row.buyer && <p className="truncate text-2xs text-muted-foreground">ซื้อโดย {row.buyer.name}</p>}
                    <p className="mt-0.5 truncate text-2xs text-muted-foreground">
                      <Link href={`/admin/events/${row.event.id}/checkins?q=${encodeURIComponent(row.code)}`} className="hover:underline">
                        {row.event.title}
                      </Link>{" "}
                      · {row.zone} · <span className="font-mono">{row.code}</span>
                    </p>
                  </td>
                  <td className={tdTight}>{row.status === "used" ? <Badge tone="good">เข้างานแล้ว</Badge> : row.status === "void" ? <Badge tone="strong">ยกเลิก</Badge> : <Badge>ยังไม่เข้า</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <div className="mt-4">
        <Panel icon={Calendar03Icon} title="รายชื่อเข้างานแต่ละงาน" subtitle="บัตรทุกใบ ชื่อผู้เข้างาน สถานะเข้างาน และ CSV">
          {events.length === 0 ? (
            <Empty icon={Calendar03Icon} title="ยังไม่มีอีเวนต์" />
          ) : (
            <ul className="divide-y divide-border">
              {events.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/events/${e.id}/checkins`} className="block truncate text-sm text-foreground hover:underline">
                      {e.title}
                    </Link>
                    <p className="truncate text-2xs text-muted-foreground">
                      {dateFormat.format(new Date(e.startsAt))} · {e.venue}
                    </p>
                  </div>
                  <a href={`/admin/events/${e.id}/checkins/csv`} aria-label={`ดาวน์โหลดรายชื่อเข้างาน ${e.title}`} className={iconButton}>
                    <Icon icon={Download04Icon} className="size-4" />
                  </a>
                  <Link href={`/admin/events/${e.id}/checkins`} aria-label={`เปิดรายชื่อเข้างาน ${e.title}`} className={iconButton}>
                    <Icon icon={ArrowRight01Icon} className="size-4" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
