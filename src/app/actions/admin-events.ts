"use server";

import { and, eq, like, notInArray, sum } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { events, ticketZones } from "@/db/schema";
import type { AdminFormState } from "@/app/actions/admin";
import { EVENTS_TAG, PUBLISH_STATES, SLUG_PATTERN, type PublishState } from "@/lib/events";
import { isPosterSrc } from "@/lib/poster";
import { requireSuperAdmin } from "@/lib/session";
import { deleteUploadedImage, isUploadPath, saveUploadedImage } from "@/lib/uploads";
import { uuidv7 } from "@/lib/uuid";

// หลังบ้าน's event actions (app/admin/events, components/admin/event-form.tsx). Each checks for a super admin
// itself, and each save expires the storefront's cached events (lib/events.ts) so the change shows at once.

const MAX_ZONES = 20;
const MAX_TICKETS = 1_000_000;

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** A datetime-local value ("2026-12-14T19:00") is Thai time */
function thaiTime(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}:00+07:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** One zone row from the form; `id` is set for a zone that's already saved */
type ZoneInput = { id?: string; name: string; note: string; price: number; capacity: number };

function parseZones(raw: string): ZoneInput[] | string {
  let rows: unknown;
  try {
    rows = JSON.parse(raw);
  } catch {
    return "ข้อมูลโซนบัตรไม่ถูกต้อง";
  }
  if (!Array.isArray(rows) || rows.length === 0) return "ต้องมีโซนบัตรอย่างน้อย 1 โซน";
  if (rows.length > MAX_ZONES) return `มีโซนบัตรได้ไม่เกิน ${MAX_ZONES} โซน`;
  const zones: ZoneInput[] = [];
  for (const [i, row] of rows.entries()) {
    const zone = row as Record<string, unknown>;
    const name = String(zone.name ?? "").trim();
    const note = String(zone.note ?? "").trim();
    const price = Number(zone.price);
    const capacity = Number(zone.capacity);
    const where = `โซนที่ ${i + 1}`;
    if (!name || name.length > 60) return `${where}: กรอกชื่อโซน (ไม่เกิน 60 ตัวอักษร)`;
    if (note.length > 120) return `${where}: รายละเอียดยาวเกิน 120 ตัวอักษร`;
    if (!Number.isInteger(price) || price < 0 || price > MAX_TICKETS) return `${where}: ราคาต้องเป็นจำนวนเต็ม 0 ขึ้นไป (0 = ฟรี)`;
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_TICKETS) return `${where}: จำนวนบัตรต้องเป็นจำนวนเต็ม 1 ขึ้นไป`;
    zones.push({ id: typeof zone.id === "string" && zone.id ? zone.id : undefined, name, note, price, capacity });
  }
  return zones;
}

/** What saveEvent answers with: also each zone's id in form order, so new zones are known on the next save */
export type SaveEventState = AdminFormState & {
  zoneIds?: string[];
  /** The poster as saved, an uploaded picture's new path included, so the form stops sending the file */
  poster?: string;
};

/** สร้าง / แก้ไขอีเวนต์: every field of the event and its whole list of zones, written together */
export async function saveEvent(_: SaveEventState, form: FormData): Promise<SaveEventState> {
  await requireSuperAdmin("/admin/events");
  const id = text(form, "eventId");
  const title = text(form, "title");
  const slug = text(form, "slug").toLowerCase();
  const organizer = text(form, "organizer");
  const venue = text(form, "venue");
  const description = String(form.get("description") ?? "").trim().replace(/\r\n/g, "\n");
  let poster = text(form, "poster");
  // A new picture from the form (components/admin/poster-field.tsx) wins over the path field
  const file = form.get("posterFile");
  const upload = file instanceof File && file.size > 0 ? file : null;
  const startsAt = thaiTime(text(form, "startsAt"));
  const doorsAt = thaiTime(text(form, "doorsAt"));
  const salesStartAt = thaiTime(text(form, "salesStartAt"));
  const salesEndRaw = text(form, "salesEndAt");
  const salesEndAt = salesEndRaw ? thaiTime(salesEndRaw) : null;
  const status = text(form, "status") as PublishState;
  const featured = form.get("featured") === "1";
  const maxPerOrder = Number(text(form, "maxPerOrder"));

  if (!title || title.length > 120) return { error: "กรอกชื่ออีเวนต์ (ไม่เกิน 120 ตัวอักษร)" };
  if (!new RegExp(`^${SLUG_PATTERN}$`).test(slug) || slug.length > 80)
    return { error: "ลิงก์ (slug) ใช้ได้แค่ a–z, 0–9 และขีด - เช่น midnight-echo-2026" };
  if (!organizer || organizer.length > 120) return { error: "กรอกชื่อผู้จัด (ไม่เกิน 120 ตัวอักษร)" };
  if (!venue || venue.length > 200) return { error: "กรอกสถานที่ (ไม่เกิน 200 ตัวอักษร)" };
  if (description.length > 5000) return { error: "รายละเอียดยาวเกิน 5,000 ตัวอักษร" };
  if (!upload && !isPosterSrc(poster)) return { error: "อัปโหลดโปสเตอร์ หรือเลือกรูปที่มีในเว็บก่อน (ที่อยู่รูปเองต้องเป็น /posters/x.svg หรือ https://)" };
  if (!startsAt || !doorsAt || !salesStartAt || salesEndAt === undefined) return { error: "กรอกวันและเวลาให้ครบ" };
  if (doorsAt > startsAt) return { error: "เวลาประตูเปิดต้องไม่ช้ากว่าเวลาเริ่มงาน" };
  if (salesStartAt >= startsAt) return { error: "วันเปิดขายต้องก่อนวันงาน" };
  if (salesEndAt && (salesEndAt <= salesStartAt || salesEndAt > startsAt)) return { error: "วันปิดขายต้องอยู่หลังวันเปิดขาย และไม่เกินเวลาเริ่มงาน" };
  if (!PUBLISH_STATES.includes(status)) return { error: "เลือกสถานะให้ถูกต้อง" };
  if (!Number.isInteger(maxPerOrder) || maxPerOrder < 1 || maxPerOrder > 20) return { error: "จำกัดต่อบัญชีต้องเป็น 1–20 ใบ" };
  const zones = parseZones(String(form.get("zones") ?? ""));
  if (typeof zones === "string") return { error: zones };

  const db = getDb();
  const [taken] = await db.select({ id: events.id }).from(events).where(eq(events.slug, slug)).limit(1);
  if (taken && taken.id !== id) return { error: "ลิงก์ (slug) นี้มีอีเวนต์อื่นใช้แล้ว" };

  let oldPoster: string | null = null;
  let savedZones: (typeof ticketZones.$inferSelect)[] = [];
  if (id) {
    const [existing] = await db.select({ poster: events.poster }).from(events).where(eq(events.id, id)).limit(1);
    if (!existing) return { error: "ไม่พบอีเวนต์นี้ อาจถูกลบไปแล้ว" };
    oldPoster = existing.poster;
    // A zone people have bought into can't go away, or shrink below what's sold
    savedZones = await db.select().from(ticketZones).where(eq(ticketZones.eventId, id));
  }
  const kept = new Set(zones.map((zone) => zone.id).filter(Boolean));
  const dropped = savedZones.find((zone) => !kept.has(zone.id) && zone.sold > 0);
  if (dropped) return { error: `ลบโซน "${dropped.name}" ไม่ได้ เพราะขายไปแล้ว ${dropped.sold} ใบ` };
  for (const zone of zones) {
    const saved = savedZones.find((row) => row.id === zone.id);
    if (zone.id && !saved) return { error: "มีโซนที่ถูกลบไปแล้ว รีเฟรชหน้าแล้วลองใหม่" };
    if (saved && zone.capacity < saved.sold) return { error: `โซน "${zone.name}" ขายไปแล้ว ${saved.sold} ใบ ตั้งจำนวนบัตรต่ำกว่านั้นไม่ได้` };
  }

  // The picture is stored last, once nothing else can turn the save down
  if (upload) {
    const stored = await saveUploadedImage(upload, "posters");
    if (!stored.ok) return { error: stored.error };
    poster = stored.path;
  }

  const values = { title, slug, organizer, venue, description, poster, startsAt, doorsAt, salesStartAt, salesEndAt, status, featured, maxPerOrder };
  const queries: BatchItem<"pg">[] = [];
  let eventId = id;

  if (id) {
    queries.push(db.update(events).set(values).where(eq(events.id, id)));
    const keepIds = [...kept] as string[];
    queries.push(
      db
        .delete(ticketZones)
        .where(and(eq(ticketZones.eventId, id), eq(ticketZones.sold, 0), keepIds.length ? notInArray(ticketZones.id, keepIds) : undefined)),
    );
  } else {
    eventId = uuidv7();
    queries.push(db.insert(events).values({ id: eventId, ...values }));
  }

  const zoneIds = zones.map((zone) => zone.id ?? uuidv7());
  zones.forEach((zone, position) => {
    const row = { name: zone.name, note: zone.note, price: zone.price, capacity: zone.capacity, position };
    queries.push(
      zone.id
        ? db
            .update(ticketZones)
            .set(row)
            .where(and(eq(ticketZones.id, zone.id), eq(ticketZones.eventId, eventId)))
        : db.insert(ticketZones).values({ ...row, id: zoneIds[position], eventId }),
    );
  });

  // One round trip, in one transaction: the event and its zones change together or not at all
  try {
    await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  } catch (e) {
    console.error("[saveEvent]", e);
    if (upload) await deleteUploadedImage(poster);
    return { error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  updateTag(EVENTS_TAG);
  if (oldPoster && oldPoster !== poster) await dropIfUnused(oldPoster);

  if (!id) redirect(`/admin/events/${eventId}?created=1`);
  refresh();
  return { ok: "บันทึกแล้ว หน้าเว็บอัปเดตทันที", zoneIds, poster };
}

/** An uploaded poster no event shows any more is deleted (ทำสำเนา shares one picture between events) */
async function dropIfUnused(poster: string) {
  if (!isUploadPath(poster)) return;
  const [used] = await getDb().select({ id: events.id }).from(events).where(eq(events.poster, poster)).limit(1);
  if (!used) await deleteUploadedImage(poster);
}

/** ทำสำเนา: a draft copy with the same details and zones, nothing sold, then straight to editing it */
export async function duplicateEvent(eventId: string): Promise<AdminFormState> {
  await requireSuperAdmin("/admin/events");
  const db = getDb();
  const [source] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!source) return { error: "ไม่พบอีเวนต์นี้ อาจถูกลบไปแล้ว" };
  const zones = await db.select().from(ticketZones).where(eq(ticketZones.eventId, eventId));

  // midnight-echo → midnight-echo-copy, -copy-2, …
  const base = `${source.slug.slice(0, 70)}-copy`;
  const used = new Set((await db.select({ slug: events.slug }).from(events).where(like(events.slug, `${base}%`))).map((row) => row.slug));
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;

  const id = uuidv7();
  const copy = {
    organizer: source.organizer,
    venue: source.venue,
    description: source.description,
    poster: source.poster,
    startsAt: source.startsAt,
    doorsAt: source.doorsAt,
    salesStartAt: source.salesStartAt,
    salesEndAt: source.salesEndAt,
    maxPerOrder: source.maxPerOrder,
  };
  const queries: BatchItem<"pg">[] = [db.insert(events).values({ ...copy, id, slug, title: `${source.title} (สำเนา)`, status: "draft", featured: false })];
  if (zones.length)
    queries.push(
      db.insert(ticketZones).values(
        zones.map((zone) => ({ eventId: id, name: zone.name, note: zone.note, price: zone.price, capacity: zone.capacity, position: zone.position })),
      ),
    );
  await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  updateTag(EVENTS_TAG);
  redirect(`/admin/events/${id}?created=1`);
}

/** ลบอีเวนต์ for good: the slug typed back confirms it. One with tickets sold is closed instead, not deleted */
export async function deleteEvent(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await requireSuperAdmin("/admin/events");
  const id = text(form, "eventId");
  const db = getDb();
  const [target] = await db.select({ slug: events.slug, poster: events.poster }).from(events).where(eq(events.id, id)).limit(1);
  if (!target) return { error: "ไม่พบอีเวนต์นี้ อาจถูกลบไปแล้ว" };
  if (text(form, "confirm").toLowerCase() !== target.slug) return { error: "พิมพ์ลิงก์ (slug) ให้ตรงเพื่อยืนยัน" };
  const [{ sold }] = await db.select({ sold: sum(ticketZones.sold).mapWith(Number) }).from(ticketZones).where(eq(ticketZones.eventId, id));
  if (sold > 0) return { error: `ขายบัตรไปแล้ว ${sold} ใบ ลบไม่ได้ ให้ตั้งสถานะเป็น "ปิดการขาย" แทน` };

  await db.delete(events).where(eq(events.id, id));
  await dropIfUnused(target.poster);
  updateTag(EVENTS_TAG);
  if (form.get("from") === "edit") redirect("/admin/events");
  refresh();
  return { ok: "ลบอีเวนต์แล้ว" };
}
