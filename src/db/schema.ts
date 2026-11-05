import { sql } from "drizzle-orm";
import { boolean, check, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// Better Auth's core tables (src/lib/auth.ts), in its default shape: singular names, text ids it generates
// itself. Then events and their ticket zones (หลังบ้าน /admin/events), and orders, tickets, tokens and the
// outbox (lib/orders.ts). Seats and real payments come later (HANDOFF section 8).

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  /** Thai mobile number, digits only (0812345678); asked for at sign-up (additionalFields in lib/auth.ts) */
  phone: text("phone").notNull(),
  /** "user" or "super_admin" (หลังบ้าน /admin); never set from sign-up (additionalFields in lib/auth.ts) */
  role: text("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

/** One row per way of signing in; the email + password login keeps its hashed password here */
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

/** Short-lived tokens (email verification, password reset) */
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

/**
 * An event as หลังบ้าน manages it. The sale status the storefront shows (on sale, coming soon, sold out…)
 * isn't stored: lib/events.ts works it out from `status`, the sale dates and what's left in the zones.
 * Times are timestamptz; forms read and write them in Thai time.
 */
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    /** The URL: /events/<slug> */
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    organizer: text("organizer").notNull(),
    venue: text("venue").notNull(),
    /** The district / province under the venue's name (เมืองทองธานี นนทบุรี); empty when not given */
    venueArea: text("venue_area").default("").notNull(),
    /** The venue's map pin (WGS84, as Google Maps gives it); both empty when the event has no pin */
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    /** Paragraphs split by a blank line */
    description: text("description").default("").notNull(),
    /** 4:5 poster, a path under public/ (/posters/x.svg) or an https URL */
    poster: text("poster").notNull(),
    /** More pictures shown after the poster on the event page, in order (same kinds of path as `poster`) */
    gallery: text("gallery").array().default(sql`'{}'::text[]`).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    doorsAt: timestamp("doors_at", { withTimezone: true }).notNull(),
    salesStartAt: timestamp("sales_start_at", { withTimezone: true }).notNull(),
    /** No end date: sales run until the show starts */
    salesEndAt: timestamp("sales_end_at", { withTimezone: true }),
    /** "draft" (hidden from the site), "published", or "closed" (shown, but sales stopped) */
    status: text("status").default("draft").notNull(),
    /** Shown under อีเวนต์แนะนำ on the home page */
    featured: boolean("featured").default(false).notNull(),
    /** Most tickets one account may take per order (anti-scalper) */
    maxPerOrder: integer("max_per_order").default(4).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("events_starts_at_idx").on(table.startsAt),
    check("events_status_check", sql`${table.status} in ('draft', 'published', 'closed')`),
    check("events_max_per_order_check", sql`${table.maxPerOrder} between 1 and 20`),
  ],
);

/** A kind of ticket within an event (VIP, zone A, early bird…), with its price and how many there are */
export const ticketZones = pgTable(
  "ticket_zones",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** What the ticket includes, e.g. standing or a numbered seat */
    note: text("note").default("").notNull(),
    /** Baht per ticket; 0 is free */
    price: integer("price").notNull(),
    capacity: integer("capacity").notNull(),
    /** Tickets taken so far, held ones (an order waiting for payment) included: lib/orders.ts keeps it */
    sold: integer("sold").default(0).notNull(),
    /** Tokens each ticket of this zone comes with, to spend at the event (token_transactions) */
    tokens: integer("tokens").default(0).notNull(),
    /** Order on the event page, lowest first */
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ticket_zones_event_id_idx").on(table.eventId),
    check("ticket_zones_price_check", sql`${table.price} >= 0`),
    check("ticket_zones_sold_check", sql`${table.sold} between 0 and ${table.capacity}`),
    check("ticket_zones_tokens_check", sql`${table.tokens} >= 0`),
  ],
);

/**
 * One purchase: some tickets of one zone. "pending" holds them (counted in ticket_zones.sold) until
 * `expires_at`, then "paid" issues the tickets and tokens, or "expired" / "cancelled" gives them back.
 * Prices and tokens are copied in at the time of buying, so a later change to the zone doesn't touch it.
 */
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    /** What the buyer sees and quotes: JT-XXXXXXXX */
    code: text("code").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "restrict" }),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => ticketZones.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    total: integer("total").notNull(),
    /** Tokens per ticket × quantity, credited when paid */
    tokens: integer("tokens").default(0).notNull(),
    status: text("status").default("pending").notNull(),
    /** One per press of "ซื้อบัตร" (HANDOFF section 7): pressing twice makes one order, not two */
    idempotencyKey: text("idempotency_key").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("orders_user_id_idx").on(table.userId),
    index("orders_event_id_idx").on(table.eventId),
    index("orders_pending_idx").on(table.expiresAt).where(sql`${table.status} = 'pending'`),
    check("orders_status_check", sql`${table.status} in ('pending', 'paid', 'cancelled', 'expired')`),
    check("orders_quantity_check", sql`${table.quantity} between 1 and 20`),
  ],
);

/** One ticket of a paid order, the thing scanned at the door */
export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** 1…quantity within its order; unique with it, so issuing the tickets twice makes no extra ones */
    seq: integer("seq").notNull(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "restrict" }),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => ticketZones.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    /** Printed under the QR, typed in when a camera can't read it: XXXX-XXXX */
    code: text("code").notNull().unique(),
    /** The QR's content: long and random, so a ticket can't be guessed from another */
    secret: text("secret").notNull().unique(),
    /** "valid", "used" once scanned in, or "void" */
    status: text("status").default("valid").notNull(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    checkedInBy: text("checked_in_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tickets_order_seq_idx").on(table.orderId, table.seq),
    index("tickets_user_id_idx").on(table.userId),
    index("tickets_event_id_idx").on(table.eventId),
    check("tickets_status_check", sql`${table.status} in ('valid', 'used', 'void')`),
  ],
);

/**
 * Every change to someone's tokens: + when tickets are paid for, − when spent at the event. The balance
 * is the sum, per event (tokens are spent at the event they came with).
 */
export const tokenTransactions = pgTable(
  "token_transactions",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    /** "ticket_purchase" for now; spending at the event comes later */
    reason: text("reason").notNull(),
    /** The order that earned them; unique, so one order credits once */
    orderId: uuid("order_id")
      .unique()
      .references(() => orders.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("token_transactions_user_event_idx").on(table.userId, table.eventId)],
);

/**
 * Work to do after a request, never in it (HANDOFF section 7): the ticket email for now. Written with the
 * thing it is about; lib/outbox.ts sends it and marks it done, and tries again on the next pass if it failed.
 */
export const outbox = pgTable(
  "outbox",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    kind: text("kind").notNull(),
    /** What the job is about, e.g. { orderId } */
    payload: jsonb("payload").notNull(),
    /** One job per thing: issuing an order's tickets twice queues one email */
    dedupeKey: text("dedupe_key").notNull().unique(),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("outbox_pending_idx").on(table.createdAt).where(sql`${table.doneAt} is null`)],
);

/**
 * Every look at a ticket at the door (หลังบ้าน /admin/scan), and every admission and undo: who, when,
 * which ticket, what came of it. Kept so a QR shown twice, or a mistaken check-in, can be traced. Never
 * the QR's secret: only the ticket's code, or the start of what was scanned when it matched nothing.
 */
export const scanLogs = pgTable(
  "scan_logs",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
    /** The ticket's event */
    eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
    /** The event the door was scanning for, when one was chosen */
    doorEventId: uuid("door_event_id").references(() => events.id, { onDelete: "set null" }),
    scannedBy: text("scanned_by").references(() => user.id, { onDelete: "set null" }),
    /** The ticket's code, or the first characters of an input that matched no ticket */
    input: text("input").notNull(),
    /** valid, used (scanned again), not_found, void, wrong_event, admitted, undone */
    result: text("result").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("scan_logs_event_idx").on(table.eventId, table.createdAt),
    index("scan_logs_door_event_idx").on(table.doorEventId, table.createdAt),
    check("scan_logs_result_check", sql`${table.result} in ('valid', 'used', 'not_found', 'void', 'wrong_event', 'admitted', 'undone')`),
  ],
);
