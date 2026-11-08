import type { Metadata } from "next";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { EventShops } from "@/components/admin/event-shops";
import { EventSwitcher } from "@/components/admin/event-switcher";
import { NewShopButton } from "@/components/admin/shop-forms";
import { Empty, PageHeader, card } from "@/components/admin/ui";
import { adminEventOptions } from "@/lib/admin-events";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "ร้านค้า" };

export default async function ShopsPage({ searchParams }: PageProps<"/admin/shops">) {
  await requirePermission("shops.manage", "/admin/shops");
  const [events, params] = await Promise.all([adminEventOptions(), searchParams]);
  const eventId = events.find((e) => e.id === params.event)?.id ?? events[0]?.id ?? null;

  return (
    <>
      <PageHeader eyebrow="Shops" title="ร้านค้า" description="เพิ่ม ลบ ร้านในงาน ตั้งเมนูและโทเคนของแต่ละร้าน">
        {eventId && <NewShopButton eventId={eventId} />}
      </PageHeader>

      {eventId ? (
        <>
          <EventSwitcher events={events} value={eventId} path="/admin/shops" label="ร้านค้าของงาน" />
          <EventShops eventId={eventId} />
        </>
      ) : (
        <section className={card}>
          <Empty icon={Calendar03Icon} title="ยังไม่มีอีเวนต์" detail="สร้างอีเวนต์ก่อน แล้วค่อยเพิ่มร้านค้า" />
        </section>
      )}
    </>
  );
}
