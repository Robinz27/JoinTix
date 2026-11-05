import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { asc, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { events, ticketZones } from "@/db/schema";
import { saleStatus } from "@/lib/events";
import type { EventStatus, PublishState } from "@/lib/event-fields";

// What หลังบ้าน reads about events: every row whatever its status, fresh each request (never the
// storefront's cache in lib/events.ts). Server only.

export type AdminZone = { id: string; name: string; note: string; price: number; capacity: number; sold: number };

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function shape(event: typeof events.$inferSelect, zoneRows: (typeof ticketZones.$inferSelect)[]): AdminEvent {
  const zones = zoneRows.map(({ id, name, note, price, capacity, sold }) => ({ id, name, note, price, capacity, sold }));
  return {
    ...event,
    status: event.status as PublishState,
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
export async function getAdminEvent(id: string): Promise<AdminEvent | undefined> {
  if (!UUID.test(id)) return undefined;
  const db = getDb();
  const [[row], zones] = await Promise.all([
    db.select().from(events).where(eq(events.id, id)).limit(1),
    db.select().from(ticketZones).where(eq(ticketZones.eventId, id)).orderBy(asc(ticketZones.position), asc(ticketZones.createdAt)),
  ]);
  return row ? shape(row, zones) : undefined;
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
