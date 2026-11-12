import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";
import { asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { events, merchItems, merchVariants, ticketZones } from "@/db/schema";
import type { DoorEvent } from "@/lib/checkins";
import { saleStatus } from "@/lib/events";
import type { EventStatus, PublishState } from "@/lib/event-fields";
import { deleteUploadedImage, isUploadPath } from "@/lib/uploads";
import { isUuid } from "@/lib/uuid";

// What หลังบ้าน reads about events: every row whatever its status, fresh each request (never the
// storefront's cache in lib/events.ts). Server only.

export type AdminZone = { id: string; name: string; note: string; price: number; capacity: number; sold: number; tokens: number };

export type AdminEvent = {
  id: string;
  slug: string;
  title: string;
  organizer: string;
  venue: string;
  venueArea: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  poster: string;
  startsAt: string;
  doorsAt: string;
  salesStartAt: string;
  salesEndAt: string | null;
  status: PublishState;
  featured: boolean;
  maxPerOrder: number;
  /** Baht per token at this event */
  tokenPrice: number;
  promptpayId: string;
  promptpayName: string;
  slipCheck: "api" | "manual";
  allowReentry: boolean;
  shippingFee: number | null;
  createdAt: string;
  updatedAt: string;
  /** More pictures after the poster, in order */
  gallery: string[];
  zones: AdminZone[];
  /** What the site shows now; drafts get what it would show once published */
  sale: EventStatus;
  capacity: number;
  sold: number;
  /** Baht taken so far: sold × price, zone by zone */
  revenue: number;
};


function shape(event: typeof events.$inferSelect, zoneRows: (typeof ticketZones.$inferSelect)[]): AdminEvent {
  const zones = zoneRows.map(({ id, name, note, price, capacity, sold, tokens }) => ({ id, name, note, price, capacity, sold, tokens }));
  return {
    ...event,
    status: event.status as PublishState,
    slipCheck: event.slipCheck === "manual" ? "manual" : "api",
    startsAt: event.startsAt.toISOString(),
    doorsAt: event.doorsAt.toISOString(),
    salesStartAt: event.salesStartAt.toISOString(),
    salesEndAt: event.salesEndAt?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    zones,
    sale: saleStatus({ ...event, status: event.status === "draft" ? "published" : event.status }, zones),
    capacity: zones.reduce((n, zone) => n + zone.capacity, 0),
    sold: zones.reduce((n, zone) => n + zone.sold, 0),
    revenue: zones.reduce((n, zone) => n + zone.sold * zone.price, 0),
  };
}

/** The list on /admin/events: optionally matching `q` (title, slug, venue, organizer), newest show first */
export async function listAdminEvents(q = ""): Promise<AdminEvent[]> {
  const db = getDb();
  const term = q.trim();
  let where: SQL | undefined;
  if (term) {
    const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
    where = or(ilike(events.title, pattern), ilike(events.slug, pattern), ilike(events.venue, pattern), ilike(events.organizer, pattern));
  }
  const [rows, zones] = await Promise.all([
    db.select().from(events).where(where).orderBy(desc(events.startsAt)).limit(200),
    db.select().from(ticketZones).orderBy(asc(ticketZones.position), asc(ticketZones.createdAt)),
  ]);
  return rows.map((row) =>
    shape(
      row,
      zones.filter((zone) => zone.eventId === row.id),
    ),
  );
}

/** One event for its edit page; anything that isn't an existing id is undefined */
export const getAdminEvent = cache(async (id: string): Promise<AdminEvent | undefined> => {
  if (!isUuid(id)) return undefined;
  const db = getDb();
  const [[row], zones] = await Promise.all([
    db.select().from(events).where(eq(events.id, id)).limit(1),
    db.select().from(ticketZones).where(eq(ticketZones.eventId, id)).orderBy(asc(ticketZones.position), asc(ticketZones.createdAt)),
  ]);
  return row ? shape(row, zones) : undefined;
});

/** What the event form starts from (components/admin/event-form.tsx) */
export function eventFormValues(event: AdminEvent) {
  const { id, slug, title, organizer, venue, venueArea, latitude, longitude, description, poster, gallery, startsAt, doorsAt, salesStartAt, salesEndAt, status, featured, maxPerOrder, tokenPrice, promptpayId, promptpayName, slipCheck, allowReentry, zones } = event;
  return { id, slug, title, organizer, venue, venueArea, latitude, longitude, description, poster, gallery, startsAt, doorsAt, salesStartAt, salesEndAt, status, featured, maxPerOrder, tokenPrice, promptpayId, promptpayName, slipCheck, allowReentry, zones };
}

/** An event's merchandise with each option's stock, for its สินค้า tab */
export async function adminMerch(eventId: string) {
  const db = getDb();
  const items = await db.select().from(merchItems).where(eq(merchItems.eventId, eventId)).orderBy(asc(merchItems.position), asc(merchItems.createdAt));
  const options = items.length ? await db.select().from(merchVariants).where(inArray(merchVariants.itemId, items.map((item) => item.id))).orderBy(asc(merchVariants.position)) : [];
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    note: item.note,
    image: item.image,
    price: item.price,
    optionLabel: item.optionLabel,
    maxPerOrder: item.maxPerOrder,
    active: item.active,
    options: options.filter((row) => row.itemId === item.id).map(({ id, option, capacity, sold }) => ({ id, option, capacity, sold })),
  }));
}

/** Uploaded pictures nothing shows any more are deleted (ทำสำเนา shares pictures between events and their merchandise) */
export async function dropIfUnused(pictures: string[]) {
  const db = getDb();
  for (const picture of pictures.filter(isUploadPath)) {
    const [[event], [item]] = await Promise.all([
      db.select({ id: events.id }).from(events).where(or(eq(events.poster, picture), sql`${picture} = any(${events.gallery})`)).limit(1),
      db.select({ id: merchItems.id }).from(merchItems).where(eq(merchItems.image, picture)).limit(1),
    ]);
    if (!event && !item) await deleteUploadedImage(picture);
  }
}

/** Every event for a picker in หลังบ้าน, drafts too (a shop can be set up before the event goes live), newest show first */
export async function adminEventOptions(): Promise<DoorEvent[]> {
  const rows = await getDb()
    .select({ id: events.id, title: events.title, startsAt: events.startsAt, venue: events.venue, poster: events.poster })
    .from(events)
    .orderBy(desc(events.startsAt))
    .limit(200);
  return rows.map((row) => ({ ...row, startsAt: row.startsAt.toISOString() }));
}

/** The pictures in public/posters, offered as one-click choices on the event form */
export async function listPosters(): Promise<string[]> {
  try {
    const files = await readdir(join(process.cwd(), "public", "posters"));
    return files.filter((file) => /\.(svg|png|jpe?g|webp|avif)$/i.test(file)).map((file) => `/posters/${file}`);
  } catch {
    return [];
  }
}
