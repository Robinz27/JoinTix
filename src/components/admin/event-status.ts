import type { EventStatus, PublishState } from "@/lib/event-fields";

// How หลังบ้าน labels an event: what the admin set (PUBLISH) and what the site shows from it (SALE)

type Tone = "muted" | "good" | "warn" | "strong";

export const PUBLISH: Record<PublishState, { label: string; tone: Tone; note: string }> = {
  draft: { label: "ฉบับร่าง", tone: "muted", note: "ซ่อนจากหน้าเว็บ เข้าลิงก์ตรงก็ไม่เจอ" },
  published: { label: "เผยแพร่", tone: "good", note: "แสดงบนเว็บ เปิดขายตามวันที่ตั้งไว้" },
  closed: { label: "ปิดการขาย", tone: "strong", note: "ยังแสดงบนเว็บ แต่ซื้อบัตรไม่ได้" },
};

export const SALE: Record<EventStatus, { label: string; tone: Tone }> = {
  "on-sale": { label: "เปิดขาย", tone: "good" },
  "selling-fast": { label: "ใกล้หมด", tone: "warn" },
  "coming-soon": { label: "รอเปิดขาย", tone: "muted" },
  "sold-out": { label: "หมดแล้ว", tone: "strong" },
  closed: { label: "ปิดการขาย", tone: "strong" },
};
