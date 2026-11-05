import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Better Auth's core tables (src/lib/auth.ts), in its default shape: singular names, text ids it generates
// itself. Then events and their ticket zones (หลังบ้าน /admin/events); seat, ticket and order tables come
// later, once their design is agreed (HANDOFF section 8).

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
    /** Tickets taken so far; the booking API will keep this up to date */
    sold: integer("sold").default(0).notNull(),
    /** Order on the event page, lowest first */
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ticket_zones_event_id_idx").on(table.eventId),
    check("ticket_zones_price_check", sql`${table.price} >= 0`),
    check("ticket_zones_sold_check", sql`${table.sold} between 0 and ${table.capacity}`),
  ],
);
