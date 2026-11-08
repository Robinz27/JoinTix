import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MerchForm } from "@/components/admin/merch-form";
import { adminMerch, getAdminEvent } from "@/lib/admin-events";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "สินค้า" };

/** สินค้า tab: whatever this event sells with its tickets */
export default async function EventMerch({ params }: PageProps<"/admin/events/[id]/merch">) {
  const { id } = await params;
  await requirePermission("events.manage", `/admin/events/${id}/merch`);
  const event = await getAdminEvent(id);
  if (!event) notFound();

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">ของที่ขายพร้อมบัตรในงานนี้ ลูกค้าเลือกซื้อที่หน้าอีเวนต์ แล้วรับตอนสแกนเข้างานหรือให้จัดส่ง</p>
      <MerchForm eventId={event.id} shippingFee={event.shippingFee} items={await adminMerch(event.id)} />
    </>
  );
}
