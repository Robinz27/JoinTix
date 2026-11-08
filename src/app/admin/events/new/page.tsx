import type { Metadata } from "next";
import { EventForm } from "@/components/admin/event-form";
import { BackLink, PageHeader } from "@/components/admin/ui";
import { listPosters } from "@/lib/admin-events";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "สร้างอีเวนต์" };

export default async function NewEvent() {
  await requirePermission("events.manage", "/admin/events/new");
  const posters = await listPosters();
  return (
    <>
      <BackLink href="/admin/events">อีเวนต์ทั้งหมด</BackLink>
      <PageHeader eyebrow="New event" title="สร้างอีเวนต์" description="กรอกข้อมูลงาน วันเวลา และโซนบัตร บันทึกเป็นฉบับร่างก่อนแล้วค่อยเผยแพร่ก็ได้" />
      <EventForm posters={posters} />
    </>
  );
}
