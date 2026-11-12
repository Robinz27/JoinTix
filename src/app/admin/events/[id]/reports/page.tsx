import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventReportView } from "@/components/admin/event-report";
import { getAdminEvent } from "@/lib/admin-events";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "รายงาน" };

/** รายงาน tab: this event's figures */
export default async function EventReportPage({ params }: PageProps<"/admin/events/[id]/reports">) {
  const { id } = await params;
  await requirePermission("reports.view", `/admin/events/${id}/reports`);
  const event = await getAdminEvent(id);
  if (!event) notFound();

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">นับเฉพาะคำสั่งซื้อที่ชำระแล้ว และรายการขายที่ไม่ถูกยกเลิก</p>
      <EventReportView eventId={event.id} />
    </>
  );
}
