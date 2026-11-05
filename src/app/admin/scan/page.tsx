import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { TicketScanner } from "@/components/admin/ticket-scanner";
import { requireSuperAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "สแกนบัตร" };

export default async function ScanPage() {
  await requireSuperAdmin("/admin/scan");
  return (
    <>
      <PageHeader eyebrow="Check-in" title="สแกนบัตรเข้างาน" description="ส่อง QR จากหน้าบัตรของฉันหรือจากอีเมลของลูกค้า ตรวจข้อมูลแล้วกดให้เข้างาน" />
      <TicketScanner />
    </>
  );
}
