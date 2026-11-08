import { sql } from "drizzle-orm";
import { boolean, check, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// Better Auth's core tables (src/lib/auth.ts), in its default shape: singular names, text ids it generates
// itself. Then events and their ticket zones (หลังบ้าน /admin/events), orders, tickets, tokens and the
// outbox (lib/orders.ts), merchandise sold with the tickets (app/admin/events/[id]/merch), and the shops at an event with what
// they sell for tokens (lib/shops.ts). Seats and real payments come later (HANDOFF section 8).

/**
 * What a member of staff may do in หลังบ้าน: a named set of permissions (lib/permissions.ts). A super admin
 * makes as many as needed at /admin/roles; the ones the migration adds are only a start and can be changed.
 */
export const adminRoles = pgTable("admin_roles", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  name: text("name").notNull().unique(),
  description: text("description").default("").notNull(),
  permissions: text("permissions").array().default(sql`'{}'::text[]`).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  /** Thai mobile number, digits only (0812345678); asked for at sign-up (additionalFields in lib/auth.ts) */
  phone: text("phone").notNull(),
  /** รุ่น / ปีที่จบ for a reunion ("วิศวะ 60", "2548"), as typed at sign-up; empty when not given (additionalFields in lib/auth.ts) */
  cohort: text("cohort").default("").notNull(),
  /** "user" or "super_admin" (หลังบ้าน /admin); never set from sign-up (additionalFields in lib/auth.ts) */
  role: text("role").default("user").notNull(),
  /** Staff: the role that says what they may do in หลังบ้าน. Empty for customers, unused for a super admin */
  adminRoleId: uuid("admin_role_id").references(() => adminRoles.id, { onDelete: "set null" }),
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
    maxPerOrder: integer("max_per_order").default(10).notNull(),
    /** Baht one token costs at this event's top-up desk, and what a shop is paid back for one */
    tokenPrice: integer("token_price").default(25).notNull(),
    /** Baht per order to post its merchandise; 0 is free, and empty means this event only hands it over at the door */
    shippingFee: integer("shipping_fee"),
    /** A ticket already scanned in may be scanned in again (someone stepping out and back); off warns "ใช้แล้ว" */
    allowReentry: boolean("allow_reentry").default(false).notNull(),
    /** Where buyers transfer to: a PromptPay phone / citizen id / e-wallet id. Empty: this event can't take payment yet */
    promptpayId: text("promptpay_id").default("").notNull(),
    /** The account's name, shown beside the QR so the buyer knows who they're paying */
    promptpayName: text("promptpay_name").default("").notNull(),
    /** "api": Slip2Go checks a slip, and what it can't settle goes to หลังบ้าน; "manual": every slip waits for หลังบ้าน */
    slipCheck: text("slip_check").default("api").notNull(),
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
    check("events_token_price_check", sql`${table.tokenPrice} >= 1`),
    check("events_shipping_fee_check", sql`${table.shippingFee} >= 0`),
    check("events_slip_check_check", sql`${table.slipCheck} in ('api', 'manual')`),
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
 * One purchase: some tickets of one zone, or merchandise alone (no zone, quantity 0). "pending" holds them
 * (counted in ticket_zones.sold) until `expires_at`; a slip sent in makes it "review" (held, no clock) until
 * the slip is accepted ("paid": tickets and tokens issued) or turned down (back to "pending" for another try);
 * "expired" / "cancelled" gives everything back. Prices and tokens are copied in when buying.
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
    /** Empty for an order of merchandise only */
    zoneId: uuid("zone_id").references(() => ticketZones.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    total: integer("total").notNull(),
    /** Tokens per ticket × quantity, credited when paid (to each ticket: tokens / quantity apiece) */
    tokens: integer("tokens").default(0).notNull(),
    status: text("status").default("pending").notNull(),
    /** Who each ticket is for, in seat order: [{ firstName, lastName, email }]; copied onto the tickets when paid */
    attendees: jsonb("attendees").$type<{ firstName: string; lastName: string; email: string }[]>().default(sql`'[]'::jsonb`).notNull(),
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
    check("orders_status_check", sql`${table.status} in ('pending', 'review', 'paid', 'cancelled', 'expired')`),
    check("orders_quantity_check", sql`${table.quantity} between 0 and 20`),
    check("orders_zone_check", sql`(${table.zoneId} is null) = (${table.quantity} = 0)`),
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
    /** Who the ticket is for, as the buyer typed it; the buyer's own name when bought before this was asked */
    attendeeFirstName: text("attendee_first_name").default("").notNull(),
    attendeeLastName: text("attendee_last_name").default("").notNull(),
    attendeeEmail: text("attendee_email").default("").notNull(),
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

/** Something on sale with an event's tickets; its options and how many of each are in merch_variants */
export const merchItems = pgTable(
  "merch_items",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    note: text("note").default("").notNull(),
    /** A picture for the event page; empty shows a plain tile */
    image: text("image").default("").notNull(),
    /** Baht each */
    price: integer("price").notNull(),
    /** What its options are called (ไซส์, สี, แบบ); empty for one with no options, which has a single variant */
    optionLabel: text("option_label").default("").notNull(),
    /** Most of it, all options together, in one order; 0 is no limit beyond the order's own */
    maxPerOrder: integer("max_per_order").default(0).notNull(),
    /** Off the event page without losing what was already sold */
    active: boolean("active").default(true).notNull(),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("merch_items_event_id_idx").on(table.eventId),
    check("merch_items_price_check", sql`${table.price} >= 0`),
    check("merch_items_max_per_order_check", sql`${table.maxPerOrder} >= 0`),
  ],
);

/** One option of an item (a size, a colour), with its own stock. `sold` counts held ones too, exactly like ticket_zones.sold, and the CHECK stops overselling */
export const merchVariants = pgTable(
  "merch_variants",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    itemId: uuid("item_id")
      .notNull()
      .references(() => merchItems.id, { onDelete: "cascade" }),
    /** The column kept its first name; empty when the item has no options */
    option: text("size").notNull(),
    capacity: integer("capacity").notNull(),
    sold: integer("sold").default(0).notNull(),
    position: integer("position").default(0).notNull(),
  },
  (table) => [
    index("merch_variants_item_id_idx").on(table.itemId),
    check("merch_variants_sold_check", sql`${table.sold} between 0 and ${table.capacity}`),
  ],
);

/**
 * Where an order's merchandise is posted to. No row means it's picked up at the event. The address is someone's
 * home, so it goes again when the order lapses or is cancelled.
 */
export const orderShipments = pgTable(
  "order_shipments",
  {
    orderId: uuid("order_id")
      .primaryKey()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Baht, as it was when ordered; already in orders.total */
    fee: integer("fee").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    /** House number, street, building */
    address: text("address").notNull(),
    subdistrict: text("subdistrict").notNull(),
    district: text("district").notNull(),
    province: text("province").notNull(),
    postcode: text("postcode").notNull(),
    carrier: text("carrier").default("").notNull(),
    trackingNo: text("tracking_no").default("").notNull(),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    shippedBy: text("shipped_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [check("order_shipments_fee_check", sql`${table.fee} >= 0`)],
);

/** Merchandise in an order. Name, option and price are copied in, so a later change to the item doesn't touch it */
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => merchVariants.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    optionLabel: text("option_label").default("").notNull(),
    option: text("size").notNull(),
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    /** Handed over at the event (หลังบ้าน /admin/scan) */
    pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
    pickedUpBy: text("picked_up_by").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("order_items_order_variant_idx").on(table.orderId, table.variantId),
    index("order_items_variant_id_idx").on(table.variantId),
    check("order_items_quantity_check", sql`${table.quantity} between 1 and 20`),
  ],
);

/** A shop at an event. One with sales is closed (`active` off) rather than deleted, to keep the report whole */
export const shops = pgTable(
  "shops",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    note: text("note").default("").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("shops_event_id_idx").on(table.eventId)],
);

/** What a shop sells and how many tokens it takes */
export const shopItems = pgTable(
  "shop_items",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokens: integer("tokens").notNull(),
    /** Off = sold out for now: not offered at the till, still in the report */
    available: boolean("available").default(true).notNull(),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("shop_items_shop_id_idx").on(table.shopId), check("shop_items_tokens_check", sql`${table.tokens} >= 1`)],
);

/**
 * The people of a shop, apart from หลังบ้าน's roles: any account can be one, and they work from /shop. An owner runs
 * its menu and staff and sees what it has earned; staff only sell.
 */
export const shopStaff = pgTable(
  "shop_staff",
  {
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "staff"] }).default("staff").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.shopId, table.userId] }),
    index("shop_staff_user_id_idx").on(table.userId),
    check("shop_staff_role_check", sql`${table.role} in ('owner', 'staff')`),
  ],
);

/**
 * One sale at a shop's till, paid in tokens. `baht` is what the shop is owed: tokens × the event's token
 * price at that moment. "voided" gives the tokens back, and the report leaves it out.
 */
export const shopSales = pgTable(
  "shop_sales",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The ticket whose tokens paid; a void gives them back to it */
    ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
    tokens: integer("tokens").notNull(),
    baht: integer("baht").notNull(),
    status: text("status").default("completed").notNull(),
    soldBy: text("sold_by").references(() => user.id, { onDelete: "set null" }),
    voidedBy: text("voided_by").references(() => user.id, { onDelete: "set null" }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    /** One per press of "ตัดโทเคน": pressing twice charges once */
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("shop_sales_shop_idx").on(table.shopId, table.createdAt),
    index("shop_sales_event_idx").on(table.eventId, table.createdAt),
    check("shop_sales_status_check", sql`${table.status} in ('completed', 'voided')`),
    check("shop_sales_tokens_check", sql`${table.tokens} >= 1`),
  ],
);

/** What a sale was made of; name and tokens are copied in, as in order_items */
export const shopSaleItems = pgTable(
  "shop_sale_items",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => shopSales.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").references(() => shopItems.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    tokens: integer("tokens").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (table) => [index("shop_sale_items_sale_id_idx").on(table.saleId), check("shop_sale_items_quantity_check", sql`${table.quantity} >= 1`)],
);

/**
 * Every change to a ticket's tokens: + when it's paid for or at the top-up desk, − when spent at a shop, either
 * way when หลังบ้าน corrects a mistake ("adjust", which may leave it below zero). The balance is the sum per
 * ticket: each ticket's QR is its holder's own wallet at its event. `user_id` is the buyer, kept for the
 * buyer's pages. Taking tokens away goes through lib/shops.ts, which holds a lock so two tills can't spend the same ones.
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
    /** The wallet: the ticket these tokens belong to. Empty only on rows older than per-ticket wallets that had no ticket */
    ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    /** "ticket_purchase", "topup", "topup_void", "shop_sale", "shop_sale_void" or "adjust" */
    reason: text("reason").notNull(),
    /** The order that earned them; one "ticket_purchase" row per ticket, so paying twice credits once */
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    /** Why, for an adjustment (and optionally a top-up): what the staff member typed */
    note: text("note").default("").notNull(),
    /** A photo of the customer's transfer slip at the top-up desk, under storage/uploads; empty when none was taken */
    slip: text("slip").default("").notNull(),
    /** The shop sale this paid for, or gave back */
    saleId: uuid("sale_id").references(() => shopSales.id, { onDelete: "set null" }),
    /** Top-up: cash taken at the desk, − when undone. 0 for everything else */
    baht: integer("baht").default(0).notNull(),
    /** Staff who made the change; empty when the system did (tickets) */
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    /** One per press at the top-up desk: pressing twice tops up once */
    idempotencyKey: text("idempotency_key").unique(),
    /** A top-up taken back: points at the top-up, unique so it can only be undone once */
    reverses: uuid("reverses").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("token_transactions_user_event_idx").on(table.userId, table.eventId),
    index("token_transactions_event_idx").on(table.eventId, table.createdAt),
    index("token_transactions_ticket_idx").on(table.ticketId),
    uniqueIndex("token_transactions_ticket_purchase_idx").on(table.ticketId).where(sql`${table.reason} = 'ticket_purchase'`),
  ],
);

/**
 * A transfer slip sent for an order (the checkout page, or the buyer's phone). Slip2Go reads it when the event
 * checks slips that way; what it can't settle, and every slip of an event that checks by hand, waits in
 * หลังบ้าน /admin/payments. The slip's QR, hashed, is unique among slips not turned down: one transfer pays once.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Baht the order asked for */
    amount: integer("amount").notNull(),
    /** The slip picture under storage/uploads (WebP); kept so a person can look at it */
    slip: text("slip").notNull(),
    /** sha256 of the QR printed on the slip; empty when none could be read off the picture */
    qrHash: text("qr_hash").default("").notNull(),
    /** "review" waiting for หลังบ้าน, "approved", or "rejected" */
    status: text("status").default("review").notNull(),
    /** What the bank says about the transfer, from Slip2Go: its reference, baht, sender, time */
    transRef: text("trans_ref").default("").notNull(),
    paidAmount: doublePrecision("paid_amount"),
    senderName: text("sender_name").default("").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** Slip2Go's answer code and why it was sent to a person (or turned down) */
    checkCode: text("check_code").default("").notNull(),
    reason: text("reason").default("").notNull(),
    /** "api" when Slip2Go accepted it, "admin" when a person did */
    approvedVia: text("approved_via"),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("payments_order_id_idx").on(table.orderId),
    index("payments_review_idx").on(table.createdAt).where(sql`${table.status} = 'review'`),
    uniqueIndex("payments_qr_once_idx").on(table.qrHash).where(sql`${table.qrHash} <> '' and ${table.status} <> 'rejected'`),
    uniqueIndex("payments_trans_ref_once_idx").on(table.transRef).where(sql`${table.transRef} <> '' and ${table.status} <> 'rejected'`),
    check("payments_status_check", sql`${table.status} in ('review', 'approved', 'rejected')`),
  ],
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

/**
 * ประวัติการใช้งาน (หลังบ้าน /admin/logs): who did what to what, when, from where, and what it changed. Written by
 * lib/audit.ts only, in the same batch as the change wherever it can be. Never a password, token or QR secret.
 *
 * The person and the thing are copied in as they were (name, email, role, label), and the ids carry no foreign key:
 * the record stays whole after the account, event or shop it mentions is gone.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    /** Who did it; empty for the system (a hold running out, the outbox) or someone not signed in (a failed login) */
    actorId: text("actor_id"),
    actorName: text("actor_name").default("").notNull(),
    actorEmail: text("actor_email").default("").notNull(),
    /** "Super admin", the name of their หลังบ้าน role, "ลูกค้า", or "ระบบ", as it was at the time */
    actorRole: text("actor_role").default("").notNull(),
    /** What was done, e.g. event.update (the list and its Thai names: lib/audit-actions.ts) */
    action: text("action").notNull(),
    /** What it was done to: event, zone, user, role, order, ticket, shop, shop_item, merch, shipment, token, sale, outbox */
    targetType: text("target_type").default("").notNull(),
    targetId: text("target_id").default("").notNull(),
    /** Its name or code at the time, shown when it no longer exists */
    targetLabel: text("target_label").default("").notNull(),
    /** The event it belongs to, for the event's own ประวัติ tab */
    eventId: uuid("event_id"),
    /** The customer it was about (the buyer, the ticket holder, the account edited), for the member's ประวัติ */
    subjectUserId: text("subject_user_id"),
    /** Before → after: [{ field, label, from, to }] */
    changes: jsonb("changes"),
    /** Anything else worth knowing: amounts, the scan's result, why it failed */
    details: jsonb("details"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_created_at_idx").on(table.createdAt),
    index("audit_logs_actor_idx").on(table.actorId, table.createdAt),
    index("audit_logs_event_idx").on(table.eventId, table.createdAt),
    index("audit_logs_subject_idx").on(table.subjectUserId, table.createdAt),
    index("audit_logs_target_idx").on(table.targetType, table.targetId),
    index("audit_logs_action_idx").on(table.action, table.createdAt),
  ],
);
