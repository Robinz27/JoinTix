import type { Metadata } from "next";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { EventReportView } from "@/components/admin/event-report";
import { EventSwitcher } from "@/components/admin/event-switcher";
import { Empty, PageHeader, card } from "@/components/admin/ui";
import { adminEventOptions } from "@/lib/admin-events";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "รายงาน" };

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requirePermission("reports.view", "/admin/reports");
  const [events, params] = await Promise.all([adminEventOptions(), searchParams]);
  const eventId = events.find((e) => e.id === params.event)?.id ?? events[0]?.id ?? null;

  if (!eventId)
    return (
      <>
        <PageHeader eyebrow="Reports" title="รายงาน" />
        <section className={card}>
          <Empty icon={Calendar03Icon} title="ยังไม่มีอีเวนต์" />
        </section>
      </>
    );

  return (
    <>
      <PageHeader eyebrow="Reports" title="รายงาน" description="นับเฉพาะคำสั่งซื้อที่ชำระแล้ว และรายการขายที่ไม่ถูกยกเลิก" />
      <EventSwitcher events={events} value={eventId} path="/admin/reports" label="รายงานของงาน" />
      <EventReportView eventId={eventId} />
    </>
  );
}
