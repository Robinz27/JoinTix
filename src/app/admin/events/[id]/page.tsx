import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { DeleteEventPanel } from "@/components/admin/event-delete-panel";
import { EventForm } from "@/components/admin/event-form";
import { Icon } from "@/components/icon";
import { eventFormValues, getAdminEvent, listPosters } from "@/lib/admin-events";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "แก้ไขอีเวนต์" };

const when = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

export default async function EditEvent({ params, searchParams }: PageProps<"/admin/events/[id]">) {
  const { id } = await params;
  await requirePermission("events.manage", `/admin/events/${id}`);
  const [event, posters, { created }] = await Promise.all([getAdminEvent(id), listPosters(), searchParams]);
  if (!event) notFound();

  return (
    <>
      {created && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
          <Icon icon={CheckmarkCircle02Icon} className="size-4 shrink-0" />
          สร้างอีเวนต์แล้ว {event.status === "draft" ? "ยังเป็นฉบับร่าง เปลี่ยนสถานะเป็นเผยแพร่เมื่อพร้อม" : ""}
        </p>
      )}

      <EventForm part="details" posters={posters} event={eventFormValues(event)} />

      <p className="mt-3 px-1 text-2xs text-muted-foreground">แก้ไขล่าสุด {when.format(new Date(event.updatedAt))}</p>
      <DeleteEventPanel event={{ id: event.id, slug: event.slug, title: event.title, status: event.status, sold: event.sold }} />
    </>
  );
}
