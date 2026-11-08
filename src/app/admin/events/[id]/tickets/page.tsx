import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Money03Icon, Ticket02Icon } from "@hugeicons/core-free-icons";
import { EventForm } from "@/components/admin/event-form";
import { Panel, td, tdMain, th } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { eventFormValues, getAdminEvent, listPosters } from "@/lib/admin-events";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "บัตร" };

const num = new Intl.NumberFormat("th-TH");

/** บัตร tab: what each zone has sold, and the zones themselves */
export default async function EventTickets({ params }: PageProps<"/admin/events/[id]/tickets">) {
  const { id } = await params;
  await requirePermission("events.manage", `/admin/events/${id}/tickets`);
  const [event, posters] = await Promise.all([getAdminEvent(id), listPosters()]);
  if (!event) notFound();

  return (
    <>
      <Panel icon={Money03Icon} title="ยอดขาย" subtitle={`${num.format(event.sold)} / ${num.format(event.capacity)} ใบ · ฿${num.format(event.revenue)}`} className="mb-4">
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
      </Panel>

      <EventForm part="tickets" posters={posters} event={eventFormValues(event)} />
    </>
  );
}
