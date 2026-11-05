import type { Metadata } from "next";
import Link from "next/link";
import { Calendar03Icon, Money03Icon, PlusSignIcon, Search01Icon, StarIcon, Ticket02Icon } from "@hugeicons/core-free-icons";
import { EventActions } from "@/components/admin/event-actions";
import { PUBLISH, SALE } from "@/components/admin/event-status";
import { Badge, Empty, MiniStat, PageHeader, card, input, pill, pillPrimary, td, tdMain, tdTight, th } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { FadeImage } from "@/components/ui/fade-image";
import { listAdminEvents } from "@/lib/admin-events";
import { PUBLISH_STATES, type PublishState } from "@/lib/event-fields";
import { isRemote } from "@/lib/poster";
import { requireSuperAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "อีเวนต์" };

const num = new Intl.NumberFormat("th-TH");
const dateFormat = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });
const timeFormat = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

export default async function AdminEvents({ searchParams }: PageProps<"/admin/events">) {
  await requireSuperAdmin("/admin/events");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const filter = PUBLISH_STATES.find((state) => state === params.status);
  const all = await listAdminEvents(q);
  const shown = filter ? all.filter((event) => event.status === filter) : all;

  const live = all.filter((event) => event.status !== "draft");
  const selling = live.filter((event) => event.sale === "on-sale" || event.sale === "selling-fast").length;
  const sold = all.reduce((n, event) => n + event.sold, 0);
  const capacity = all.reduce((n, event) => n + event.capacity, 0);
  const revenue = all.reduce((n, event) => n + event.revenue, 0);

  const tab = (state?: PublishState) => {
    const query = new URLSearchParams({ ...(q && { q }), ...(state && { status: state }) }).toString();
    return `/admin/events${query ? `?${query}` : ""}`;
  };
  const tabs: { state?: PublishState; label: string; count: number }[] = [
    { label: "ทั้งหมด", count: all.length },
    ...PUBLISH_STATES.map((state) => ({ state, label: PUBLISH[state].label, count: all.filter((event) => event.status === state).length })),
  ];

  return (
    <>
      <PageHeader eyebrow="Events" title="อีเวนต์" description="สร้าง แก้ไข เปิด/ปิดการขาย และดูยอดบัตรของทุกงาน">
        <Link href="/admin/events/new" className={`${pillPrimary} max-sm:flex-1 max-sm:justify-center`}>
          <Icon icon={PlusSignIcon} className="size-4" />
          สร้างอีเวนต์
        </Link>
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <MiniStat icon={Calendar03Icon} label="อีเวนต์ทั้งหมด" value={num.format(all.length)} />
        <MiniStat icon={Ticket02Icon} label="กำลังเปิดขาย" value={num.format(selling)} />
        <MiniStat icon={Ticket02Icon} label="บัตรขายแล้ว" value={`${num.format(sold)} / ${num.format(capacity)}`} />
        <MiniStat icon={Money03Icon} label="ยอดขายรวม" value={`฿${num.format(revenue)}`} />
      </div>

      <section className={`${card} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <nav aria-label="กรองตามสถานะ" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
            {tabs.map(({ state, label, count }) => {
              const active = filter === state;
              return (
                <Link
                  key={label}
                  href={tab(state)}
                  aria-current={active ? "page" : undefined}
                  className={`${pill} h-8 px-3 text-xs ${active ? "border-foreground/40 bg-secondary text-foreground" : "text-muted-foreground"}`}
                >
                  {label}
                  <span className="tabular-nums opacity-70">{num.format(count)}</span>
                </Link>
              );
            })}
          </nav>
          <form className="relative sm:w-64" role="search">
            {filter && <input type="hidden" name="status" value={filter} />}
            <Icon icon={Search01Icon} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input name="q" type="search" defaultValue={q} placeholder="ค้นหาชื่องาน สถานที่ ผู้จัด" aria-label="ค้นหาอีเวนต์" className={`${input} h-9 pl-9`} />
          </form>
        </div>

        {shown.length === 0 ? (
          <Empty
            icon={Calendar03Icon}
            title={q ? `ไม่พบอีเวนต์ที่ตรงกับ “${q}”` : "ยังไม่มีอีเวนต์ในกลุ่มนี้"}
            detail={q ? "ลองค้นด้วยคำอื่น" : "กด “สร้างอีเวนต์” เพื่อเริ่ม"}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className={th}>อีเวนต์</th>
                <th className={`${th} hidden md:table-cell`}>วันงาน</th>
                <th className={`${th} hidden sm:table-cell`}>สถานะ</th>
                <th className={`${th} hidden lg:table-cell`}>ขายแล้ว</th>
                <th className={th}>
                  <span className="sr-only">จัดการ</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((event) => {
                const startsAt = new Date(event.startsAt);
                const share = event.capacity ? event.sold / event.capacity : 0;
                return (
                  <tr key={event.id} className="transition-colors hover:bg-secondary/40">
                    <td className={tdMain}>
                      <Link href={`/admin/events/${event.id}`} className="flex min-w-0 items-center gap-3">
                        <div className="relative aspect-[4/5] w-10 shrink-0 overflow-hidden rounded-lg bg-secondary sm:w-11">
                          <FadeImage src={event.poster} alt="" fill sizes="44px" unoptimized={isRemote(event.poster)} className="object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-foreground">
                            <span className="truncate">{event.title}</span>
                            {event.featured && <Icon icon={StarIcon} className="size-3.5 shrink-0 text-amber-500" aria-label="อีเวนต์แนะนำ" />}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{event.venue}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground tabular-nums md:hidden">
                            <span className="sm:hidden">
                              <Badge tone={event.status === "draft" ? PUBLISH.draft.tone : SALE[event.sale].tone}>
                                {event.status === "draft" ? PUBLISH.draft.label : SALE[event.sale].label}
                              </Badge>
                            </span>
                            {dateFormat.format(startsAt)}
                            <span className="lg:hidden">
                              · {num.format(event.sold)}/{num.format(event.capacity)} ใบ
                            </span>
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className={`${td} hidden whitespace-nowrap text-muted-foreground tabular-nums md:table-cell`}>
                      {dateFormat.format(startsAt)}
                      <span className="block text-xs">{timeFormat.format(startsAt)} น.</span>
                    </td>
                    <td className={`${tdTight} hidden sm:table-cell`}>
                      <div className="flex flex-col items-start gap-1">
                        <Badge tone={PUBLISH[event.status].tone}>{PUBLISH[event.status].label}</Badge>
                        {event.status === "published" && <Badge tone={SALE[event.sale].tone}>{SALE[event.sale].label}</Badge>}
                      </div>
                    </td>
                    <td className={`${td} hidden w-44 lg:table-cell`}>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        <span className="text-foreground">{num.format(event.sold)}</span> / {num.format(event.capacity)} ใบ · {event.zones.length} โซน
                      </p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-foreground/70" style={{ width: `${Math.min(100, share * 100)}%` }} />
                      </div>
                      <p className="mt-1 text-2xs text-muted-foreground tabular-nums">฿{num.format(event.revenue)}</p>
                    </td>
                    <td className={`${tdTight} text-right`}>
                      <EventActions event={{ id: event.id, slug: event.slug, title: event.title, status: event.status, sold: event.sold }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
