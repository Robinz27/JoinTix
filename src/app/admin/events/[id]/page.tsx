import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckmarkCircle02Icon, LinkSquare02Icon, Money03Icon, Ticket02Icon, UserCheck01Icon } from "@hugeicons/core-free-icons";
import { DuplicateButton } from "@/components/admin/event-actions";
import { DeleteEventPanel } from "@/components/admin/event-delete-panel";
import { EventForm } from "@/components/admin/event-form";
import { PUBLISH, SALE } from "@/components/admin/event-status";
import { BackLink, Badge, PageHeader, Panel, pill, td, tdMain, th } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { getAdminEvent, listPosters } from "@/lib/admin-events";
import { requireSuperAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "แก้ไขอีเวนต์" };

const num = new Intl.NumberFormat("th-TH");
const when = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

export default async function EditEvent({ params, searchParams }: PageProps<"/admin/events/[id]">) {
  const { id } = await params;
  await requireSuperAdmin(`/admin/events/${id}`);
  const [event, posters, { created }] = await Promise.all([getAdminEvent(id), listPosters(), searchParams]);
  if (!event) notFound();

  return (
    <>
      <BackLink href="/admin/events">อีเวนต์ทั้งหมด</BackLink>
      <PageHeader eyebrow="Edit event" title={event.title} description={`แก้ไขล่าสุด ${when.format(new Date(event.updatedAt))}`}>
        <Badge tone={PUBLISH[event.status].tone}>{PUBLISH[event.status].label}</Badge>
        {event.status === "published" && <Badge tone={SALE[event.sale].tone}>{SALE[event.sale].label}</Badge>}
        <span className="flex-1 sm:hidden" />
        <Link href={`/admin/events/${event.id}/checkins`} className={pill}>
          <Icon icon={UserCheck01Icon} className="size-4" />
          <span className="max-[379px]:sr-only">รายชื่อเข้างาน</span>
        </Link>
        <DuplicateButton eventId={event.id} className={pill}>
          <span className="max-[379px]:sr-only">ทำสำเนา</span>
        </DuplicateButton>
        {event.status !== "draft" && (
          <Link href={`/events/${event.slug}`} target="_blank" className={pill}>
            <Icon icon={LinkSquare02Icon} className="size-4" />
            <span className="max-[379px]:sr-only">ดูหน้าขาย</span>
          </Link>
        )}
      </PageHeader>

      {created && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
          <Icon icon={CheckmarkCircle02Icon} className="size-4 shrink-0" />
          สร้างอีเวนต์แล้ว {event.status === "draft" ? "ยังเป็นฉบับร่าง เปลี่ยนสถานะเป็นเผยแพร่เมื่อพร้อม" : ""}
        </p>
      )}

      <Panel
        icon={Money03Icon}
        title="ยอดขาย"
        subtitle={`${num.format(event.sold)} / ${num.format(event.capacity)} ใบ · ฿${num.format(event.revenue)}`}
        className="mb-4"
      >
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className={th}>โซน</th>
              <th className={`${th} hidden text-right! sm:table-cell`}>ราคา</th>
              <th className={`${th} text-right!`}>ขายแล้ว</th>
              <th className={`${th} hidden text-right! md:table-cell`}>รายได้</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {event.zones.map((zone) => (
              <tr key={zone.id}>
                <td className={tdMain}>
                  <p className="flex items-center gap-1.5 truncate text-foreground">
                    <Icon icon={Ticket02Icon} className="size-3.5 shrink-0 text-muted-foreground" />
                    {zone.name}
                  </p>
                  <div className="mt-1.5 h-1 max-w-48 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-foreground/70" style={{ width: `${Math.min(100, (zone.sold / zone.capacity) * 100)}%` }} />
                  </div>
                </td>
                <td className={`${td} hidden text-right text-muted-foreground tabular-nums sm:table-cell`}>{zone.price ? `฿${num.format(zone.price)}` : "ฟรี"}</td>
                <td className={`${td} text-right whitespace-nowrap tabular-nums`}>
                  {num.format(zone.sold)} <span className="text-muted-foreground">/ {num.format(zone.capacity)}</span>
                </td>
                <td className={`${td} hidden text-right text-muted-foreground tabular-nums md:table-cell`}>฿{num.format(zone.sold * zone.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-border px-4 py-3 text-2xs text-muted-foreground sm:px-5">ยอด “ขายแล้ว” จะนับจากระบบจองเมื่อ API กดบัตรเสร็จ</p>
      </Panel>

      <EventForm
        posters={posters}
        event={{
          id: event.id,
          slug: event.slug,
          title: event.title,
          organizer: event.organizer,
          venue: event.venue,
          venueArea: event.venueArea,
          latitude: event.latitude,
          longitude: event.longitude,
          description: event.description,
          poster: event.poster,
          gallery: event.gallery,
          startsAt: event.startsAt,
          doorsAt: event.doorsAt,
          salesStartAt: event.salesStartAt,
          salesEndAt: event.salesEndAt,
          status: event.status,
          featured: event.featured,
          maxPerOrder: event.maxPerOrder,
          zones: event.zones,
        }}
      />

      <DeleteEventPanel event={{ id: event.id, slug: event.slug, title: event.title, status: event.status, sold: event.sold }} />
    </>
  );
}
