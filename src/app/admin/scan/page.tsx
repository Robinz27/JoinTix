import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { TicketScanner } from "@/components/admin/ticket-scanner";
import { doorEvents } from "@/lib/checkins";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "สแกนบัตร" };

export default async function ScanPage({ searchParams }: PageProps<"/admin/scan">) {
  await requirePermission("door.scan", "/admin/scan");
  const [events, params] = await Promise.all([doorEvents(), searchParams]);
  // ?event= from the check-in page, else the soonest event still to come
  const asked = typeof params.event === "string" ? params.event : "";
  const initial = events.find((e) => e.id === asked)?.id ?? events[0]?.id ?? null;
  return (
    <>
      <PageHeader eyebrow="Check-in" title="สแกนบัตรเข้างาน" description="เลือกงานของประตูนี้ ส่อง QR จากหน้าบัตรของฉันหรือจากอีเมลของลูกค้า ตรวจข้อมูลแล้วกดให้เข้างาน" />
      <TicketScanner events={events} initialEvent={initial} />
    </>
  );
}
