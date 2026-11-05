import { randomBytes, randomInt } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "@/db";
import { events, orders, outbox, ticketZones, tickets, tokenTransactions, user } from "@/db/schema";
import { saleStatus } from "@/lib/events";
import { isBuyable } from "@/lib/event-fields";
import { uuidv7 } from "@/lib/uuid";

// Buying tickets, without a payment provider yet (HANDOFF section 3): an order holds its tickets for
// HOLD_MINUTES, the checkout page "pays" it, and paying issues the tickets and tokens and queues the
// email (lib/outbox.ts), all in one transaction. Server only.
//
// No double selling (HANDOFF section 7): a hold is one SQL statement that adds to ticket_zones.sold only
// while there's room and the account is within the event's limit, so two people pressing at once can't
// both get the last ticket. The Redis layer in front of it comes later.

export const HOLD_MINUTES = 10;

/** Letters that can't be misread for one another (no 0/O, 1/I/L) */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const pick = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
/** JT-7KQ3M9XA, what the buyer quotes about an order */
const orderCode = () => `JT-${pick(8)}`;
/** 7KQ3-M9XA, printed under a ticket's QR and typed in when a camera can't read it */
const ticketCode = () => `${pick(4)}-${pick(4)}`;
/** The QR's content: long and random, so nobody can make one up */
const ticketSecret = () => `JTX1.${randomBytes(24).toString("base64url")}`;

/**
 * Gives back what lapsed holds took: marks them expired and takes their quantities off the zones, in one
 * statement so a hold is never given back twice. Run before anything that counts what's left.
 */
export async function releaseExpired() {
  await getDb().execute(sql`
    with lapsed as (
      update ${orders} set status = 'expired'
      where ${orders.status} = 'pending' and ${orders.expiresAt} < now()
      returning ${orders.zoneId} as zone_id, ${orders.quantity} as quantity
    ), back as (
      select zone_id, sum(quantity)::int as quantity from lapsed group by zone_id
    )
    update ${ticketZones} set sold = ${ticketZones.sold} - back.quantity
    from back where ${ticketZones.id} = back.zone_id`);
}

export type HoldResult = { ok: true; orderId: string } | { ok: false; error: string };

/** ซื้อบัตร: holds `quantity` tickets of a zone for the account, or says why not */
export async function holdTickets({
  userId,
  slug,
  zoneId,
  quantity,
  key,
}: {
  userId: string;
  slug: string;
  zoneId: string;
  quantity: number;
  /** One per press of the button, from the browser: the same press twice is one order */
  key: string;
}): Promise<HoldResult> {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return { ok: false, error: "จำนวนบัตรไม่ถูกต้อง" };
  if (!/^[\w-]{16,80}$/.test(key)) return { ok: false, error: "คำขอไม่ถูกต้อง ลองรีเฟรชหน้าแล้วกดใหม่" };
  const db = getDb();
  await releaseExpired();

  const [again] = await db.select({ id: orders.id, userId: orders.userId }).from(orders).where(eq(orders.idempotencyKey, key)).limit(1);
  if (again) return again.userId === userId ? { ok: true, orderId: again.id } : { ok: false, error: "คำขอไม่ถูกต้อง ลองรีเฟรชหน้าแล้วกดใหม่" };

  const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
  if (!event || event.status === "draft") return { ok: false, error: "ไม่พบอีเวนต์นี้" };
  const zones = await db.select().from(ticketZones).where(eq(ticketZones.eventId, event.id));
  const zone = zones.find((z) => z.id === zoneId);
  if (!zone) return { ok: false, error: "ไม่พบโซนบัตรนี้ รีเฟรชหน้าแล้วเลือกใหม่" };
  if (!isBuyable(saleStatus(event, zones))) return { ok: false, error: "อีเวนต์นี้ไม่ได้เปิดขายอยู่" };
  if (quantity > event.maxPerOrder) return { ok: false, error: `ซื้อได้สูงสุด ${event.maxPerOrder} ใบต่อบัญชี` };

  const id = uuidv7();
  // Hold and order in one statement: the zone is only counted up while there's room and the account
  // stays within the limit (counting its other live orders for this event), and only then is the order made
  const rows = await db.execute<{ held: number; id: string | null }>(sql`
    with held as (
      update ${ticketZones} set sold = ${ticketZones.sold} + ${quantity}
      where ${ticketZones.id} = ${zone.id}
        and ${ticketZones.sold} + ${quantity} <= ${ticketZones.capacity}
        and (
          select coalesce(sum(${orders.quantity}), 0) from ${orders}
          where ${orders.userId} = ${userId} and ${orders.eventId} = ${event.id} and ${orders.status} in ('pending', 'paid')
        ) + ${quantity} <= ${event.maxPerOrder}
      returning ${ticketZones.price} as price, ${ticketZones.tokens} as tokens
    ), made as (
      insert into ${orders} (id, code, user_id, event_id, zone_id, quantity, unit_price, total, tokens, idempotency_key, expires_at)
      select ${id}, ${orderCode()}, ${userId}, ${event.id}, ${zone.id}, ${quantity}, price, price * ${quantity}, tokens * ${quantity}, ${key},
        now() + make_interval(mins => ${HOLD_MINUTES})
      from held
      on conflict (idempotency_key) do nothing
      returning id
    )
    select (select count(*) from held)::int as held, (select id from made) as id`);
  const [result] = rows.rows;

  if (result?.id) return { ok: true, orderId: result.id };
  if (result?.held) {
    // The same press arrived twice at once: the other one made the order, so give this hold back
    await db.update(ticketZones).set({ sold: sql`${ticketZones.sold} - ${quantity}` }).where(eq(ticketZones.id, zone.id));
    const [made] = await db.select({ id: orders.id }).from(orders).where(eq(orders.idempotencyKey, key)).limit(1);
    return made ? { ok: true, orderId: made.id } : { ok: false, error: "ซื้อไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }

  // Nothing held: say which rule stopped it
  const [{ taken }] = await db
    .select({ taken: sql<number>`coalesce(sum(${orders.quantity}), 0)`.mapWith(Number) })
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.eventId, event.id), sql`${orders.status} in ('pending', 'paid')`));
  if (taken + quantity > event.maxPerOrder)
    return { ok: false, error: `บัญชีนี้มีบัตรงานนี้แล้ว ${taken} ใบ ซื้อเพิ่มได้อีก ${Math.max(0, event.maxPerOrder - taken)} ใบ` };
  const left = zone.capacity - zone.sold;
  return { ok: false, error: left > 0 ? `โซนนี้เหลือ ${left} ใบ ลดจำนวนแล้วลองใหม่` : "บัตรโซนนี้หมดแล้ว" };
}

export type OrderView = {
  id: string;
  code: string;
  status: "pending" | "paid" | "cancelled" | "expired";
  quantity: number;
  unitPrice: number;
  total: number;
  tokens: number;
  expiresAt: string;
  paidAt: string | null;
  createdAt: string;
  event: { id: string; slug: string; title: string; venue: string; venueArea: string; poster: string; startsAt: string; doorsAt: string };
  zone: { name: string; note: string };
};

/** An order of this account, with what the checkout and tickets pages show about it */
export async function getOrder(orderId: string, userId: string): Promise<OrderView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  await releaseExpired();
  const [row] = await getDb()
    .select({ order: orders, event: events, zone: ticketZones })
    .from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .innerJoin(ticketZones, eq(ticketZones.id, orders.zoneId))
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  return row ? orderView(row) : null;
}

function orderView({ order, event, zone }: { order: typeof orders.$inferSelect; event: typeof events.$inferSelect; zone: typeof ticketZones.$inferSelect }): OrderView {
  return {
    id: order.id,
    code: order.code,
    status: order.status as OrderView["status"],
    quantity: order.quantity,
    unitPrice: order.unitPrice,
    total: order.total,
    tokens: order.tokens,
    expiresAt: order.expiresAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    event: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      venue: event.venue,
      venueArea: event.venueArea,
      poster: event.poster,
      startsAt: event.startsAt.toISOString(),
      doorsAt: event.doorsAt.toISOString(),
    },
    zone: { name: zone.name, note: zone.note },
  };
}

/**
 * ยืนยันชำระเงิน (simulated): pending → paid while the hold lasts, then the tickets, the tokens and the
 * email job, together. Paying an order already paid just makes sure it was all issued.
 */
export async function payOrder(orderId: string, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();
  await releaseExpired();
  const [paid] = await db
    .update(orders)
    .set({ status: "paid", paidAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId), eq(orders.status, "pending"), sql`${orders.expiresAt} > now()`))
    .returning();
  const order = paid ?? (await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1))[0];
  if (!order) return { ok: false, error: "ไม่พบคำสั่งซื้อนี้" };
  if (order.status !== "paid") return { ok: false, error: order.status === "expired" ? "หมดเวลาชำระเงินแล้ว บัตรถูกปล่อยคืน ลองซื้อใหม่" : "คำสั่งซื้อนี้ถูกยกเลิกแล้ว" };

  const queries: BatchItem<"pg">[] = [
    // One row per ticket; (order, seq) is unique, so running this again makes none twice
    db
      .insert(tickets)
      .values(
        Array.from({ length: order.quantity }, (_, i) => ({
          orderId: order.id,
          seq: i + 1,
          eventId: order.eventId,
          zoneId: order.zoneId,
          userId: order.userId,
          code: ticketCode(),
          secret: ticketSecret(),
        })),
      )
      .onConflictDoNothing({ target: [tickets.orderId, tickets.seq] }),
    db
      .insert(outbox)
      .values({ kind: "ticket_email", payload: { orderId: order.id }, dedupeKey: `ticket_email:${order.id}` })
      .onConflictDoNothing({ target: outbox.dedupeKey }),
  ];
  if (order.tokens > 0)
    queries.push(
      db
        .insert(tokenTransactions)
        .values({ userId: order.userId, eventId: order.eventId, amount: order.tokens, reason: "ticket_purchase", orderId: order.id })
        .onConflictDoNothing({ target: tokenTransactions.orderId }),
    );
  await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  return { ok: true };
}

/** ยกเลิก: a pending order lets its tickets go at once instead of waiting out the hold */
export async function cancelOrder(orderId: string, userId: string) {
  await getDb().execute(sql`
    with gone as (
      update ${orders} set status = 'cancelled'
      where ${orders.id} = ${orderId} and ${orders.userId} = ${userId} and ${orders.status} = 'pending'
      returning ${orders.zoneId} as zone_id, ${orders.quantity} as quantity
    )
    update ${ticketZones} set sold = ${ticketZones.sold} - gone.quantity
    from gone where ${ticketZones.id} = gone.zone_id`);
}

export type TicketView = {
  id: string;
  seq: number;
  code: string;
  secret: string;
  status: "valid" | "used" | "void";
  checkedInAt: string | null;
};

export type TicketGroup = OrderView & { tickets: TicketView[] };

/** บัตรของฉัน: the account's paid orders with their tickets, soonest event first */
export async function listMyTickets(userId: string): Promise<TicketGroup[]> {
  const db = getDb();
  const rows = await db
    .select({ order: orders, event: events, zone: ticketZones })
    .from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .innerJoin(ticketZones, eq(ticketZones.id, orders.zoneId))
    .where(and(eq(orders.userId, userId), eq(orders.status, "paid")))
    .orderBy(asc(events.startsAt), desc(orders.paidAt));
  if (rows.length === 0) return [];
  const all = await db.select().from(tickets).where(eq(tickets.userId, userId)).orderBy(asc(tickets.seq));
  return rows.map((row) => ({
    ...orderView(row),
    tickets: all
      .filter((t) => t.orderId === row.order.id)
      .map((t) => ({ id: t.id, seq: t.seq, code: t.code, secret: t.secret, status: t.status as TicketView["status"], checkedInAt: t.checkedInAt?.toISOString() ?? null })),
  }));
}

export type TokenBalance = { eventId: string; title: string; slug: string; startsAt: string; balance: number };

/** Tokens per event the account holds, and the total */
export async function tokenBalances(userId: string): Promise<{ total: number; events: TokenBalance[] }> {
  const rows = await getDb()
    .select({
      eventId: events.id,
      title: events.title,
      slug: events.slug,
      startsAt: events.startsAt,
      balance: sql<number>`sum(${tokenTransactions.amount})`.mapWith(Number),
    })
    .from(tokenTransactions)
    .innerJoin(events, eq(events.id, tokenTransactions.eventId))
    .where(eq(tokenTransactions.userId, userId))
    .groupBy(events.id)
    .orderBy(asc(events.startsAt));
  const list = rows.filter((r) => r.balance !== 0).map((r) => ({ ...r, startsAt: r.startsAt.toISOString() }));
  return { total: list.reduce((n, r) => n + r.balance, 0), events: list };
}

/* ─────────────── At the door (หลังบ้าน /admin/scan) ─────────────── */

export type ScanResult = {
  ticket: { id: string; code: string; seq: number; status: "valid" | "used" | "void"; checkedInAt: string | null; checkedInBy: string | null };
  order: { code: string; quantity: number; unitPrice: number; total: number; tokens: number; paidAt: string | null };
  event: { id: string; title: string; startsAt: string; venue: string };
  zone: { name: string; note: string; price: number };
  holder: { name: string; email: string; phone: string; emailVerified: boolean };
  /** The holder's tokens for this event now, and every ticket they hold for it */
  tokens: number;
  ticketsForEvent: number;
  checkedInForEvent: number;
};

/** What a scanned QR (or a typed code) is: the ticket, its order, and its holder in full */
export async function lookupTicket(scanned: string): Promise<ScanResult | null> {
  const value = scanned.trim();
  const byCode = /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/i.test(value);
  if (!byCode && !/^JTX1\.[\w-]{20,64}$/.test(value)) return null;
  const db = getDb();
  const code = byCode ? `${value.slice(0, 4)}-${value.slice(-4)}`.toUpperCase() : null;
  const [row] = await db
    .select({ ticket: tickets, order: orders, event: events, zone: ticketZones, holder: user })
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .innerJoin(events, eq(events.id, tickets.eventId))
    .innerJoin(ticketZones, eq(ticketZones.id, tickets.zoneId))
    .innerJoin(user, eq(user.id, tickets.userId))
    .where(code ? eq(tickets.code, code) : eq(tickets.secret, value))
    .limit(1);
  if (!row) return null;

  const [[tokens], [counts], checker] = await Promise.all([
    db
      .select({ n: sql<number>`coalesce(sum(${tokenTransactions.amount}), 0)`.mapWith(Number) })
      .from(tokenTransactions)
      .where(and(eq(tokenTransactions.userId, row.holder.id), eq(tokenTransactions.eventId, row.event.id))),
    db
      .select({
        all: sql<number>`count(*)`.mapWith(Number),
        used: sql<number>`count(*) filter (where ${tickets.status} = 'used')`.mapWith(Number),
      })
      .from(tickets)
      .where(and(eq(tickets.userId, row.holder.id), eq(tickets.eventId, row.event.id))),
    row.ticket.checkedInBy
      ? db.select({ name: user.name }).from(user).where(eq(user.id, row.ticket.checkedInBy)).limit(1)
      : Promise.resolve([]),
  ]);

  return {
    ticket: {
      id: row.ticket.id,
      code: row.ticket.code,
      seq: row.ticket.seq,
      status: row.ticket.status as ScanResult["ticket"]["status"],
      checkedInAt: row.ticket.checkedInAt?.toISOString() ?? null,
      checkedInBy: checker[0]?.name ?? null,
    },
    order: {
      code: row.order.code,
      quantity: row.order.quantity,
      unitPrice: row.order.unitPrice,
      total: row.order.total,
      tokens: row.order.tokens,
      paidAt: row.order.paidAt?.toISOString() ?? null,
    },
    event: { id: row.event.id, title: row.event.title, startsAt: row.event.startsAt.toISOString(), venue: row.event.venue },
    zone: { name: row.zone.name, note: row.zone.note, price: row.zone.price },
    holder: { name: row.holder.name, email: row.holder.email, phone: row.holder.phone, emailVerified: row.holder.emailVerified },
    tokens: tokens.n,
    ticketsForEvent: counts.all,
    checkedInForEvent: counts.used,
  };
}

/** ให้เข้างาน: valid → used, once; scanning the same ticket again says when it went in */
export async function checkIn(ticketId: string, adminId: string): Promise<boolean> {
  const [done] = await getDb()
    .update(tickets)
    .set({ status: "used", checkedInAt: new Date(), checkedInBy: adminId })
    .where(and(eq(tickets.id, ticketId), eq(tickets.status, "valid")))
    .returning({ id: tickets.id });
  return Boolean(done);
}
