import { and, asc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db";
import { events, merchItems, merchVariants, ticketZones } from "@/db/schema";
import type { EventStatus } from "@/lib/event-fields";

// Events for the storefront, from the events / ticket_zones tables (managed in หลังบ้าน /admin/events).
// Reads are cached under EVENTS_TAG; every admin save calls updateTag(EVENTS_TAG) so the site shows it at
// once. The cache also refreshes each minute, so a sale that opens by the clock flips on its own.

export const EVENTS_TAG = "events";

export { PUBLISH_STATES, SLUG_PATTERN, isBuyable, type EventStatus, type PublishState } from "@/lib/event-fields";

export type EventSummary = {
  id: string;
  slug: string;
  title: string;
  /** ISO date-time of the show */
  startsAt: string;
  venue: string;
  /** Cheapest ticket in baht; 0 is a free event */
  priceFrom: number;
  status: EventStatus;
  /** 4:5 poster, e.g. 800×1000 */
  poster: string;
  href: string;
};

export type TicketZone = {
  id: string;
  name: string;
  /** Baht per ticket; 0 is free */
  price: number;
  /** What the ticket includes, e.g. standing or a numbered seat */
  note: string;
  /** Tickets left; 0 is sold out */
  remaining: number;
  /** Tokens each ticket comes with, to spend at the event */
  tokens: number;
};

/** Merchandise on sale with the tickets, and what's left of each option */
export type EventMerch = {
  id: string;
  name: string;
  note: string;
  /** Empty for none */
  image: string;
  /** Baht each */
  price: number;
  /** What the options are called (ไซส์, สี); empty for an item with no options, which has one with no name */
  optionLabel: string;
  /** Most of it in one order; 0 is no limit of its own */
  maxPerOrder: number;
  options: { id: string; option: string; remaining: number }[];
};

export type EventDetail = EventSummary & {
  organizer: string;
  /** ISO date-time the doors open */
  doorsAt: string;
  /** ISO date-time sales start, shown while the event is coming soon */
  salesStartAt: string;
  description: string[];
  /** The district / province under the venue's name; may be empty */
  venueArea: string;
  /** The venue's map pin, when the event has one */
  pin: { lat: number; lng: number } | null;
  /** Every picture of the event, the poster first */
  images: string[];
  /** Most tickets one account may take per order (anti-scalper) */
  maxPerOrder: number;
  zones: TicketZone[];
  merch: EventMerch[];
  /** Baht to post the merchandise; 0 is free, null means it's only picked up at the event */
  shippingFee: number | null;
};

/** At or under this share of tickets left, an event on sale shows as ใกล้หมด */
const SELLING_FAST = 0.2;

/** The sale status for the site, from the admin's setting, the clock and what's left */
export function saleStatus(
  event: { status: string; startsAt: Date; salesStartAt: Date; salesEndAt: Date | null },
  zones: { capacity: number; sold: number }[],
  now = Date.now(),
): EventStatus {
  if (event.status === "closed" || now >= (event.salesEndAt ?? event.startsAt).getTime()) return "closed";
  const capacity = zones.reduce((sum, zone) => sum + zone.capacity, 0);
  const left = zones.reduce((sum, zone) => sum + zone.capacity - zone.sold, 0);
  if (now < event.salesStartAt.getTime()) return "coming-soon";
  if (left <= 0) return "sold-out";
  return left / capacity <= SELLING_FAST ? "selling-fast" : "on-sale";
}

type EventRow = typeof events.$inferSelect;
type ZoneRow = typeof ticketZones.$inferSelect;

function summarize(event: EventRow, zones: ZoneRow[]): EventSummary {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    startsAt: event.startsAt.toISOString(),
    venue: event.venue,
    priceFrom: zones.length ? Math.min(...zones.map((zone) => zone.price)) : 0,
    status: saleStatus(event, zones),
    poster: event.poster,
    href: `/events/${event.slug}`,
  };
}

async function zonesOf(eventIds: string[]) {
  if (eventIds.length === 0) return new Map<string, ZoneRow[]>();
  const rows = await getDb()
    .select()
    .from(ticketZones)
    .where(inArray(ticketZones.eventId, eventIds))
    .orderBy(asc(ticketZones.position), asc(ticketZones.createdAt));
  const byEvent = new Map<string, ZoneRow[]>();
  for (const row of rows) byEvent.set(row.eventId, [...(byEvent.get(row.eventId) ?? []), row]);
  return byEvent;
}

/** อีเวนต์แนะนำ on the home page: featured events on the site, soonest first */
export async function getFeaturedEvents(): Promise<EventSummary[]> {
  "use cache";
  cacheTag(EVENTS_TAG);
  cacheLife("minutes");
  const rows = await getDb()
    .select()
    .from(events)
    .where(and(eq(events.featured, true), inArray(events.status, ["published", "closed"])))
    .orderBy(asc(events.startsAt))
    .limit(8);
  const zones = await zonesOf(rows.map((row) => row.id));
  return rows.map((row) => summarize(row, zones.get(row.id) ?? []));
}

/** What the search shows before anything is typed: the next events on the site, soonest first */
export async function getUpcomingEvents(): Promise<EventSummary[]> {
  "use cache";
  cacheTag(EVENTS_TAG);
  cacheLife("minutes");
  const rows = await getDb()
    .select()
    .from(events)
    .where(and(eq(events.status, "published"), gte(events.startsAt, sql`now()`)))
    .orderBy(asc(events.startsAt))
    .limit(6);
  const zones = await zonesOf(rows.map((row) => row.id));
  return rows.map((row) => summarize(row, zones.get(row.id) ?? []));
}

const SEARCH_LIMIT = 20;
/** A % or _ typed in the box means itself, not "anything" */
const contains = (term: string) => `%${term.replace(/[\\%_]/g, "\\$&")}%`;

/**
 * The navbar's search: every word has to appear somewhere in the event's title, venue, area, organizer or
 * description (artists are usually named in those), so "คอนเสิร์ต บางนา" narrows as it should. Hits in the title
 * come first, then what's still to come. Not cached: each search is different, and the status must be fresh.
 */
export async function searchEvents(query: string): Promise<EventSummary[]> {
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 6);
  if (words.length === 0) return [];
  const rows = await getDb()
    .select()
    .from(events)
    .where(
      and(
        inArray(events.status, ["published", "closed"]),
        ...words.map((word) => {
          const like = contains(word);
          return or(ilike(events.title, like), ilike(events.venue, like), ilike(events.venueArea, like), ilike(events.organizer, like), ilike(events.description, like));
        }),
      ),
    )
    .orderBy(sql`${events.title} not ilike ${contains(words.join(" "))}`, sql`${events.startsAt} < now()`, asc(events.startsAt))
    .limit(SEARCH_LIMIT);
  const zones = await zonesOf(rows.map((row) => row.id));
  return rows.map((row) => summarize(row, zones.get(row.id) ?? []));
}

/** One event on the /events page: the card, plus what the page's search box also looks at */
export type EventListItem = EventSummary & { venueArea: string; organizer: string };

/**
 * Every event on the site for /events. Still on sale or coming up first, soonest first; then closed and
 * sold-out ones, most recent first, so last month's event isn't the first thing anyone sees.
 */
export async function getAllEvents(): Promise<EventListItem[]> {
  "use cache";
  cacheTag(EVENTS_TAG);
  cacheLife("minutes");
  const rows = await getDb()
    .select()
    .from(events)
    .where(inArray(events.status, ["published", "closed"]))
    .orderBy(asc(events.startsAt));
  const zones = await zonesOf(rows.map((row) => row.id));
  const list = rows.map((row) => ({ ...summarize(row, zones.get(row.id) ?? []), venueArea: row.venueArea, organizer: row.organizer }));
  const over = (e: EventListItem) => e.status === "closed" || e.status === "sold-out";
  return [...list.filter((e) => !over(e)), ...list.filter(over).reverse()];
}

/** Every slug on the site, for generateStaticParams */
export async function getEventSlugs(): Promise<string[]> {
  "use cache";
  cacheTag(EVENTS_TAG);
  cacheLife("minutes");
  const rows = await getDb()
    .select({ slug: events.slug })
    .from(events)
    .where(inArray(events.status, ["published", "closed"]));
  return rows.map((row) => row.slug);
}

/** One event for its page (/events/<slug>); drafts aren't found */
export async function getEvent(slug: string): Promise<EventDetail | undefined> {
  "use cache";
  cacheTag(EVENTS_TAG);
  cacheLife("minutes");
  const [event] = await getDb()
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), inArray(events.status, ["published", "closed"])))
    .limit(1);
  if (!event) return undefined;
  const [zoneMap, merchRows] = await Promise.all([
    zonesOf([event.id]),
    getDb()
      .select({ item: merchItems, variant: merchVariants })
      .from(merchItems)
      .innerJoin(merchVariants, eq(merchVariants.itemId, merchItems.id))
      .where(and(eq(merchItems.eventId, event.id), eq(merchItems.active, true)))
      .orderBy(asc(merchItems.position), asc(merchItems.createdAt), asc(merchVariants.position)),
  ]);
  const zones = zoneMap.get(event.id) ?? [];
  const merch = new Map<string, EventMerch>();
  for (const { item, variant } of merchRows) {
    const entry = merch.get(item.id) ?? { id: item.id, name: item.name, note: item.note, image: item.image, price: item.price, optionLabel: item.optionLabel, maxPerOrder: item.maxPerOrder, options: [] };
    entry.options.push({ id: variant.id, option: variant.option, remaining: variant.capacity - variant.sold });
    merch.set(item.id, entry);
  }
  return {
    ...summarize(event, zones),
    organizer: event.organizer,
    doorsAt: event.doorsAt.toISOString(),
    salesStartAt: event.salesStartAt.toISOString(),
    description: event.description
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
    venueArea: event.venueArea,
    pin: event.latitude != null && event.longitude != null ? { lat: event.latitude, lng: event.longitude } : null,
    images: [event.poster, ...event.gallery],
    maxPerOrder: event.maxPerOrder,
    zones: zones.map((zone) => ({ id: zone.id, name: zone.name, price: zone.price, note: zone.note, remaining: zone.capacity - zone.sold, tokens: zone.tokens })),
    merch: [...merch.values()],
    shippingFee: event.shippingFee,
  };
}
