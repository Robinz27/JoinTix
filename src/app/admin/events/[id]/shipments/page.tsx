import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeliveryTruck01Icon, Download04Icon } from "@hugeicons/core-free-icons";
import { ShipmentCard } from "@/components/admin/shipment-card";
import { Empty, card, pill } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { getAdminEvent } from "@/lib/admin-events";
import { requirePermission } from "@/lib/session";
import { listShipments, type ShipmentState } from "@/lib/shipments";

export const metadata: Metadata = { title: "จัดส่ง" };

const STATES: { value: ShipmentState; label: string }[] = [
  { value: "waiting", label: "รอจัดส่ง" },
  { value: "shipped", label: "ส่งแล้ว" },
  { value: "all", label: "ทั้งหมด" },
];

/** จัดส่ง tab: the paid orders to post, and their tracking numbers */
export default async function EventShipments({ params, searchParams }: PageProps<"/admin/events/[id]/shipments">) {
  const { id } = await params;
  await requirePermission("merch.ship", `/admin/events/${id}/shipments`);
  const [event, query] = await Promise.all([getAdminEvent(id), searchParams]);
  if (!event) notFound();
  const state = STATES.find((s) => s.value === query.state)?.value ?? "waiting";
  const rows = await listShipments(event.id, state);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <nav className="flex gap-1.5" aria-label="สถานะการจัดส่ง">
          {STATES.map((s) => (
            <Link
              key={s.value}
              href={`/admin/events/${event.id}/shipments?state=${s.value}`}
              aria-current={s.value === state ? "page" : undefined}
              className={`${pill} h-8 px-3 text-xs ${s.value === state ? "border-foreground/40 bg-secondary" : "text-muted-foreground"}`}
            >
              {s.label}
            </Link>
          ))}
        </nav>
        <a href={`/admin/events/${event.id}/shipments/csv`} className={pill}>
          <Icon icon={Download04Icon} className="size-4" />
          ดาวน์โหลด CSV
        </a>
      </div>

      {rows.length === 0 ? (
        <section className={card}>
          <Empty icon={DeliveryTruck01Icon} title={state === "waiting" ? "ไม่มีรายการรอจัดส่ง" : "ยังไม่มีรายการ"} detail="คำสั่งซื้อที่เลือกจัดส่งและชำระเงินแล้วจะขึ้นที่นี่" />
        </section>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <ShipmentCard key={row.orderId} shipment={row} />
          ))}
        </ul>
      )}
    </>
  );
}
