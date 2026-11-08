import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventShops } from "@/components/admin/event-shops";
import { NewShopButton } from "@/components/admin/shop-forms";
import { getAdminEvent } from "@/lib/admin-events";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "ร้านค้า" };

/** ร้านค้า tab: the shops at this event */
export default async function EventShopsPage({ params }: PageProps<"/admin/events/[id]/shops">) {
  const { id } = await params;
  await requirePermission("shops.manage", `/admin/events/${id}/shops`);
  const event = await getAdminEvent(id);
  if (!event) notFound();

  return (
    <>
      <div className="mb-4 flex justify-end">
        <NewShopButton eventId={event.id} />
      </div>
      <EventShops eventId={event.id} />
    </>
  );
}
