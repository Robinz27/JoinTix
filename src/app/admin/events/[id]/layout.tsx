import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { DuplicateButton } from "@/components/admin/event-actions";
import { PUBLISH, SALE } from "@/components/admin/event-status";
import { EventTabs } from "@/components/admin/event-tabs";
import { BackLink, Badge, PageHeader, pill } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { getAdminEvent } from "@/lib/admin-events";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";

// Everything about one event sits under this: its name, then a tab for each part of running it. A tab shows
// only to a role allowed its page, and each page checks again itself.

export default async function EventLayout({ children, params }: LayoutProps<"/admin/events/[id]">) {
  const { id } = await params;
  const { access } = await requirePermission(["events.manage", "merch.ship", "shops.manage", "attendees.view", "reports.view", "logs.view"], `/admin/events/${id}`);
  const event = await getAdminEvent(id);
  if (!event) notFound();
  const manages = can(access, "events.manage");

  return (
    <>
      <BackLink href={manages ? "/admin/events" : "/admin"}>{manages ? "อีเวนต์ทั้งหมด" : "ภาพรวม"}</BackLink>
      <PageHeader eyebrow="Event" title={event.title}>
        <Badge tone={PUBLISH[event.status].tone}>{PUBLISH[event.status].label}</Badge>
        {event.status === "published" && <Badge tone={SALE[event.sale].tone}>{SALE[event.sale].label}</Badge>}
        <span className="flex-1 sm:hidden" />
        {manages && (
          <DuplicateButton eventId={event.id} className={pill}>
            <span className="max-[379px]:sr-only">ทำสำเนา</span>
          </DuplicateButton>
        )}
        {event.status !== "draft" && (
          <Link href={`/events/${event.slug}`} target="_blank" className={pill}>
            <Icon icon={LinkSquare02Icon} className="size-4" />
            <span className="max-[379px]:sr-only">ดูหน้าขาย</span>
          </Link>
        )}
      </PageHeader>
      <EventTabs eventId={event.id} access={access} />
      {children}
    </>
  );
}
