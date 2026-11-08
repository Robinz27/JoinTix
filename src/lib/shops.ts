import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { events, shopItems, shopSaleItems, shopSales, shopStaff, shops, tickets, tokenTransactions, user } from "@/db/schema";
import { auditQuery } from "@/lib/audit";
import { attendeeName } from "@/lib/event-fields";
import { lookupTicket } from "@/lib/orders";
import { can, type AdminAccess } from "@/lib/permissions";
import { uuidv7 } from "@/lib/uuid";

// Tokens at the event: the top-up desk (/admin/tokens) and the shops' tills (/admin/till). A customer is found
// from the QR on their ticket, the same one the door scans. Server only.
//
// Every ticket is its own wallet: the QR a person shows is theirs, whoever bought it (token_transactions.ticket_id).
//
// Nothing here may spend tokens twice. The balance is a sum of rows, so a plain "is there enough?" can't see
// another till's sale still in flight. Taking tokens away therefore runs in one transaction that first takes
// an advisory lock on this ticket; the next till waits there, then counts what's really left. Only หลังบ้าน's
// correction (adjustTokens) may take a wallet below zero.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[\w-]{16,80}$/;
/** The most tokens one top-up can add; a typo shouldn't be able to book a fortune */
export const MAX_TOPUP = 100_000;

const lockTokens = (ticketId: string) => getDb().execute(sql`select pg_advisory_xact_lock(hashtextextended(${`tokens:${ticketId}`}, 0))`);

const balanceSql = (ticketId: string) => sql`(select coalesce(sum(${tokenTransactions.amount}), 0) from ${tokenTransactions} where ${tokenTransactions.ticketId} = ${ticketId}::uuid)`;

/** A ticket's tokens now */
export async function tokenBalance(ticketId: string) {
  const [row] = await getDb()
    .select({ n: sql<number>`coalesce(sum(${tokenTransactions.amount}), 0)`.mapWith(Number) })
    .from(tokenTransactions)
    .where(eq(tokenTransactions.ticketId, ticketId));
  return row.n;
}

/** `id` is the account that bought the ticket; `name` the person it's for (who stands at the counter) */
export type Customer = { id: string; ticketId: string; name: string; buyer: string; email: string; phone: string; ticketCode: string; zone: string; tokens: number };

export type CustomerAnswer = { customer: Customer; error?: undefined } | { customer?: undefined; error: string };

/** Who a scanned ticket belongs to, as long as it is a live ticket of this event */
export async function findCustomer(scanned: string, eventId: string): Promise<CustomerAnswer> {
  const found = await lookupTicket(scanned);
  if (!found) return { error: "ไม่พบบัตรนี้ QR หรือรหัสไม่ใช่บัตรของ JoinTix" };
  if (found.ticket.status === "void") return { error: "บัตรใบนี้ถูกยกเลิกแล้ว" };
  if (found.event.id !== eventId) return { error: `บัตรนี้เป็นของงาน ${found.event.title} โทเคนใช้ข้ามงานไม่ได้` };
  return {
    customer: {
      id: found.holder.id,
      ticketId: found.ticket.id,
      name: attendeeName(found.attendee) || found.holder.name,
      buyer: found.holder.name,
      email: found.attendee.email || found.holder.email,
      phone: found.holder.phone,
      ticketCode: found.ticket.code,
      zone: found.zone.name,
      tokens: found.tokens,
    },
  };
}

/* ─────────────── เติมโทเคน ─────────────── */

export type TopUpEntry = { id: string; at: string; reason: "topup" | "adjust"; tokens: number; baht: number; customer: string; ticketCode: string; by: string | null; undone: boolean; note: string; slip: string };

/** เติมโทเคน: `tokens` at the event's price onto the scanned ticket. The press's key makes pressing twice one top-up */
export async function topUp(input: { scanned: string; eventId: string; tokens: number; key: string; by: string; slip?: string; note?: string }): Promise<CustomerAnswer> {
  const { scanned, eventId, tokens, key, by } = input;
  if (!Number.isInteger(tokens) || tokens < 1 || tokens > MAX_TOPUP) return { error: `จำนวนโทเคนต้องเป็นจำนวนเต็ม 1–${MAX_TOPUP.toLocaleString("th-TH")}` };
  if (!KEY.test(key)) return { error: "คำขอไม่ถูกต้อง สแกนใหม่อีกครั้ง" };
  const found = await findCustomer(scanned, eventId);
  if (!found.customer) return found;

  const db = getDb();
  const [event] = await db.select({ tokenPrice: events.tokenPrice, title: events.title }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return { error: "ไม่พบอีเวนต์นี้" };
  const id = uuidv7();
  const { customer } = found;
  const note = (input.note ?? "").trim().slice(0, 300);
  // Logged only if this press really topped up (the same press twice makes no second row)
  await db.batch([
    db
      .insert(tokenTransactions)
      .values({ id, userId: customer.id, eventId, ticketId: customer.ticketId, amount: tokens, baht: tokens * event.tokenPrice, reason: "topup", createdBy: by, idempotencyKey: key, slip: input.slip ?? "", note })
      .onConflictDoNothing({ target: tokenTransactions.idempotencyKey }),
    ...(await auditQuery(
      {
        action: "token.topup",
        target: { type: "token", id, label: `${customer.name} +${tokens.toLocaleString("th-TH")} โทเคน` },
        eventId,
        subjectUserId: customer.id,
        details: {
          tokens,
          baht: tokens * event.tokenPrice,
          tokenPrice: event.tokenPrice,
          ticketCode: customer.ticketCode,
          customer: `${customer.name} <${customer.email}>`,
          buyer: customer.buyer,
          balanceBefore: customer.tokens,
          slipPhoto: input.slip ? "มี" : "ไม่มี",
          note: note || null,
        },
      },
      sql`exists (select 1 from ${tokenTransactions} where ${tokenTransactions.id} = ${id}::uuid)`,
    )),
  ]);
  return { customer: { ...customer, tokens: await tokenBalance(customer.ticketId) } };
}

/** ยกเลิกการเติม: only while the ticket still has those tokens, and only once */
export async function undoTopUp(transactionId: string, by: string): Promise<{ error?: string }> {
  if (!UUID.test(transactionId)) return { error: "ไม่พบรายการนี้" };
  const db = getDb();
  const [top] = await db
    .select()
    .from(tokenTransactions)
    .where(and(eq(tokenTransactions.id, transactionId), eq(tokenTransactions.reason, "topup")))
    .limit(1);
  if (!top || !top.ticketId) return { error: "ไม่พบรายการนี้" };
  const ticketId = top.ticketId;
  const [customer] = await db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, top.userId)).limit(1);

  const id = uuidv7();
  const [, reversed] = (await db.batch([
    lockTokens(ticketId),
    db.execute(sql`
      insert into ${tokenTransactions} (id, user_id, event_id, ticket_id, amount, baht, reason, created_by, reverses)
      select ${id}::uuid, ${top.userId}, ${top.eventId}::uuid, ${ticketId}::uuid, ${-top.amount}::int, ${-top.baht}::int, 'topup_void', ${by}, ${top.id}::uuid
      where ${balanceSql(ticketId)} >= ${top.amount}
      on conflict (reverses) do nothing
      returning id`),
    ...(await auditQuery(
      {
        action: "token.topup_void",
        target: { type: "token", id: top.id, label: `${customer?.name ?? ""} −${top.amount.toLocaleString("th-TH")} โทเคน` },
        eventId: top.eventId,
        subjectUserId: top.userId,
        details: { tokens: top.amount, bahtReturned: top.baht, toppedUpAt: top.createdAt, toppedUpBy: top.createdBy, customer: customer ? `${customer.name} <${customer.email}>` : null },
      },
      sql`exists (select 1 from ${tokenTransactions} where ${tokenTransactions.id} = ${id}::uuid)`,
    )),
  ] as unknown as [BatchItem<"pg">, BatchItem<"pg">, BatchItem<"pg">])) as unknown as [unknown, { rows: unknown[] }];
  if (reversed.rows.length > 0) return {};

  const [already] = await db.select({ id: tokenTransactions.id }).from(tokenTransactions).where(eq(tokenTransactions.reverses, top.id)).limit(1);
  return { error: already ? "รายการนี้ถูกยกเลิกไปแล้ว" : "ลูกค้าใช้โทเคนไปแล้ว ยกเลิกไม่ได้ ใช้ “ปรับยอด” แทน (ยอดติดลบได้)" };
}

/**
 * ปรับยอดโทเคน (หลังบ้าน, tokens.adjust): + or − on the scanned ticket with a reason, for a top-up typed wrong after the
 * customer has spent it. Unlike everything else here it may leave the wallet below zero: the event chases it later,
 * and the log says who did it and why. `baht` is the cash it corrects (− when a top-up was typed too high), for the report.
 */
export async function adjustTokens(input: { scanned: string; eventId: string; tokens: number; baht: number; note: string; key: string; by: string; slip?: string }): Promise<CustomerAnswer> {
  const { scanned, eventId, tokens, baht, key, by } = input;
  const note = input.note.trim().slice(0, 300);
  if (!Number.isInteger(tokens) || tokens === 0 || Math.abs(tokens) > MAX_TOPUP) return { error: `จำนวนโทเคนต้องเป็นจำนวนเต็ม ไม่ใช่ 0 และไม่เกิน ${MAX_TOPUP.toLocaleString("th-TH")}` };
  if (!Number.isInteger(baht) || Math.abs(baht) > MAX_TOPUP * 1000) return { error: "จำนวนเงินไม่ถูกต้อง" };
  if (!note) return { error: "ใส่เหตุผลที่ปรับยอด เช่น เติมผิด กด 200 แทน 20" };
  if (!KEY.test(key)) return { error: "คำขอไม่ถูกต้อง สแกนใหม่อีกครั้ง" };
  const found = await findCustomer(scanned, eventId);
  if (!found.customer) return found;
  const { customer } = found;
  const db = getDb();
  const id = uuidv7();
  await db.batch([
    lockTokens(customer.ticketId),
    db
      .insert(tokenTransactions)
      .values({ id, userId: customer.id, eventId, ticketId: customer.ticketId, amount: tokens, baht, reason: "adjust", note, createdBy: by, idempotencyKey: key, slip: input.slip ?? "" })
      .onConflictDoNothing({ target: tokenTransactions.idempotencyKey }),
    ...(await auditQuery(
      {
        action: "token.adjust",
        target: { type: "token", id, label: `${customer.name} ${tokens > 0 ? "+" : "−"}${Math.abs(tokens).toLocaleString("th-TH")} โทเคน` },
        eventId,
        subjectUserId: customer.id,
        details: { tokens, baht, note, ticketCode: customer.ticketCode, customer: `${customer.name} <${customer.email}>`, buyer: customer.buyer, balanceBefore: customer.tokens, balanceAfter: customer.tokens + tokens },
      },
      sql`exists (select 1 from ${tokenTransactions} where ${tokenTransactions.id} = ${id}::uuid)`,
    )),
  ] as unknown as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  return { customer: { ...customer, tokens: await tokenBalance(customer.ticketId) } };
}

/** The latest top-ups and corrections of an event, undone ones marked */
export async function recentTopUps(eventId: string, limit = 15): Promise<TopUpEntry[]> {
  const staff = alias(user, "staff");
  const undo = alias(tokenTransactions, "undo");
  const rows = await getDb()
    .select({
      id: tokenTransactions.id,
      at: tokenTransactions.createdAt,
      reason: tokenTransactions.reason,
      tokens: tokenTransactions.amount,
      baht: tokenTransactions.baht,
      first: tickets.attendeeFirstName,
      last: tickets.attendeeLastName,
      email: tickets.attendeeEmail,
      ticketCode: tickets.code,
      by: staff.name,
      undoId: undo.id,
      note: tokenTransactions.note,
      slip: tokenTransactions.slip,
    })
    .from(tokenTransactions)
    .leftJoin(tickets, eq(tickets.id, tokenTransactions.ticketId))
    .leftJoin(staff, eq(staff.id, tokenTransactions.createdBy))
    .leftJoin(undo, eq(undo.reverses, tokenTransactions.id))
    .where(and(eq(tokenTransactions.eventId, eventId), inArray(tokenTransactions.reason, ["topup", "adjust"])))
    .orderBy(desc(tokenTransactions.createdAt))
    .limit(limit);
  return rows.map(({ undoId, first, last, email, ...row }) => ({
    ...row,
    reason: row.reason as TopUpEntry["reason"],
    at: row.at.toISOString(),
    customer: attendeeName({ firstName: first ?? "", lastName: last ?? "", email: email ?? "" }),
    ticketCode: row.ticketCode ?? "",
    undone: Boolean(undoId),
  }));
}

/* ─────────────── ร้านค้า ─────────────── */

export type ShopRow = { id: string; eventId: string; name: string; note: string; active: boolean; items: number; sales: number; tokens: number; baht: number };

/** The shops of an event with what they've sold; voided sales don't count */
export async function listShops(eventId: string): Promise<ShopRow[]> {
  const db = getDb();
  const [rows, items, sales] = await Promise.all([
    db.select().from(shops).where(eq(shops.eventId, eventId)).orderBy(asc(shops.createdAt)),
    db.select({ shopId: shopItems.shopId, n: sql<number>`count(*)`.mapWith(Number) }).from(shopItems).innerJoin(shops, eq(shops.id, shopItems.shopId)).where(eq(shops.eventId, eventId)).groupBy(shopItems.shopId),
    db
      .select({
        shopId: shopSales.shopId,
        n: sql<number>`count(*)`.mapWith(Number),
        tokens: sql<number>`sum(${shopSales.tokens})`.mapWith(Number),
        baht: sql<number>`sum(${shopSales.baht})`.mapWith(Number),
      })
      .from(shopSales)
      .where(and(eq(shopSales.eventId, eventId), eq(shopSales.status, "completed")))
      .groupBy(shopSales.shopId),
  ]);
  return rows.map((shop) => {
    const sold = sales.find((s) => s.shopId === shop.id);
    return {
      id: shop.id,
      eventId: shop.eventId,
      name: shop.name,
      note: shop.note,
      active: shop.active,
      items: items.find((i) => i.shopId === shop.id)?.n ?? 0,
      sales: sold?.n ?? 0,
      tokens: sold?.tokens ?? 0,
      baht: sold?.baht ?? 0,
    };
  });
}

export type ShopRole = "owner" | "staff";

export type ShopMenuItem = { id: string; name: string; tokens: number; available: boolean };
export type ShopDetail = {
  id: string;
  eventId: string;
  eventTitle: string;
  tokenPrice: number;
  name: string;
  note: string;
  active: boolean;
  items: ShopMenuItem[];
  /** Owners and staff together */
  staff: { id: string; name: string; email: string; role: ShopRole }[];
};

export async function getShop(id: string): Promise<ShopDetail | null> {
  if (!UUID.test(id)) return null;
  const db = getDb();
  const [row] = await db.select({ shop: shops, event: events }).from(shops).innerJoin(events, eq(events.id, shops.eventId)).where(eq(shops.id, id)).limit(1);
  if (!row) return null;
  const [items, staff] = await Promise.all([
    db.select().from(shopItems).where(eq(shopItems.shopId, id)).orderBy(asc(shopItems.position), asc(shopItems.createdAt)),
    db.select({ id: user.id, name: user.name, email: user.email, role: shopStaff.role }).from(shopStaff).innerJoin(user, eq(user.id, shopStaff.userId)).where(eq(shopStaff.shopId, id)).orderBy(asc(user.name)),
  ]);
  return {
    id: row.shop.id,
    eventId: row.shop.eventId,
    eventTitle: row.event.title,
    tokenPrice: row.event.tokenPrice,
    name: row.shop.name,
    note: row.shop.note,
    active: row.shop.active,
    items: items.map(({ id: itemId, name, tokens, available }) => ({ id: itemId, name, tokens, available })),
    staff,
  };
}

/** This account's place in a shop, if it has one. Nothing to do with หลังบ้าน's roles */
export async function shopRole(userId: string, shopId: string): Promise<ShopRole | null> {
  if (!UUID.test(shopId)) return null;
  const [row] = await getDb()
    .select({ role: shopStaff.role })
    .from(shopStaff)
    .where(and(eq(shopStaff.shopId, shopId), eq(shopStaff.userId, userId)))
    .limit(1);
  return row?.role ?? null;
}

export type MyShop = { id: string; name: string; note: string; active: boolean; role: ShopRole; eventTitle: string; startsAt: string };

/** ร้านของฉัน: every shop this account belongs to, the next event first */
export async function myShops(userId: string): Promise<MyShop[]> {
  const rows = await getDb()
    .select({ id: shops.id, name: shops.name, note: shops.note, active: shops.active, role: shopStaff.role, eventTitle: events.title, startsAt: events.startsAt })
    .from(shopStaff)
    .innerJoin(shops, eq(shops.id, shopStaff.shopId))
    .innerJoin(events, eq(events.id, shops.eventId))
    .where(eq(shopStaff.userId, userId))
    .orderBy(desc(events.startsAt), asc(shops.name));
  return rows.map((row) => ({ ...row, startsAt: row.startsAt.toISOString() }));
}

export type TillShop = { id: string; name: string; eventId: string; eventTitle: string; tokenPrice: number; items: ShopMenuItem[] };

/** The open shops this account can sell for, with what's on the menu. Without `access`, only its own */
export async function tillShops(access: AdminAccess | null, userId: string): Promise<TillShop[]> {
  const db = getDb();
  const all = access ? can(access, "shops.manage") : false;
  const rows = await db
    .select({ id: shops.id, name: shops.name, eventId: events.id, eventTitle: events.title, tokenPrice: events.tokenPrice })
    .from(shops)
    .innerJoin(events, eq(events.id, shops.eventId))
    .leftJoin(shopStaff, and(eq(shopStaff.shopId, shops.id), eq(shopStaff.userId, userId)))
    .where(and(eq(shops.active, true), inArray(events.status, ["published", "closed"]), all ? undefined : sql`${shopStaff.userId} is not null`))
    .orderBy(asc(events.startsAt), asc(shops.createdAt));
  if (rows.length === 0) return [];
  const items = await db
    .select()
    .from(shopItems)
    .where(and(inArray(shopItems.shopId, rows.map((r) => r.id)), eq(shopItems.available, true)))
    .orderBy(asc(shopItems.position), asc(shopItems.createdAt));
  return rows.map((row) => ({
    ...row,
    items: items.filter((i) => i.shopId === row.id).map(({ id, name, tokens, available }) => ({ id, name, tokens, available })),
  }));
}

export type SaleLine = { itemId: string; quantity: number };
export type SaleAnswer = { error: string; tokens?: undefined } | { error?: undefined; tokens: number; balance: number };

/** ตัดโทเคน: what's on the bill, priced from the database rather than the browser, all or nothing */
export async function sell(input: { shopId: string; scanned: string; lines: SaleLine[]; key: string; by: string }): Promise<SaleAnswer> {
  const { shopId, scanned, lines, key, by } = input;
  if (!KEY.test(key)) return { error: "คำขอไม่ถูกต้อง สแกนใหม่อีกครั้ง" };
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 50) return { error: "เลือกรายการก่อน" };
  if (lines.some((l) => !UUID.test(l?.itemId) || !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 99)) return { error: "จำนวนไม่ถูกต้อง" };
  if (new Set(lines.map((l) => l.itemId)).size !== lines.length) return { error: "รายการซ้ำกัน" };

  const db = getDb();
  const [row] = await db.select({ shop: shops, tokenPrice: events.tokenPrice }).from(shops).innerJoin(events, eq(events.id, shops.eventId)).where(eq(shops.id, shopId)).limit(1);
  if (!row) return { error: "ไม่พบร้านนี้" };
  if (!row.shop.active) return { error: "ร้านนี้ปิดอยู่" };
  const eventId = row.shop.eventId;
  const found = await findCustomer(scanned, eventId);
  if (!found.customer) return { error: found.error };

  const menu = await db
    .select()
    .from(shopItems)
    .where(and(eq(shopItems.shopId, shopId), inArray(shopItems.id, lines.map((l) => l.itemId))));
  if (menu.length !== lines.length) return { error: "มีรายการที่ไม่อยู่ในเมนูแล้ว รีเฟรชหน้าแล้วลองใหม่" };
  if (menu.some((item) => !item.available)) return { error: "มีรายการที่หมดแล้ว รีเฟรชหน้าแล้วลองใหม่" };
  const bill = lines.map((line) => ({ ...line, item: menu.find((m) => m.id === line.itemId)! }));
  const tokens = bill.reduce((n, line) => n + line.item.tokens * line.quantity, 0);
  const baht = tokens * row.tokenPrice;
  const userId = found.customer.id;
  const ticketId = found.customer.ticketId;

  const saleId = uuidv7();
  const made = sql`exists (select 1 from ${shopSales} where ${shopSales.id} = ${saleId}::uuid)`;
  const queries = [
    lockTokens(ticketId),
    db.execute(sql`
      insert into ${shopSales} (id, event_id, shop_id, user_id, ticket_id, tokens, baht, sold_by, idempotency_key)
      select ${saleId}::uuid, ${eventId}::uuid, ${shopId}::uuid, ${userId}, ${ticketId}::uuid, ${tokens}::int, ${baht}::int, ${by}, ${key}
      where ${balanceSql(ticketId)} >= ${tokens}
      on conflict (idempotency_key) do nothing
      returning id`),
    ...bill.map((line) =>
      db.execute(sql`
        insert into ${shopSaleItems} (sale_id, item_id, name, tokens, quantity)
        select ${saleId}::uuid, ${line.item.id}::uuid, ${line.item.name}, ${line.item.tokens}::int, ${line.quantity}::int
        where ${made}`),
    ),
    db.execute(sql`
      insert into ${tokenTransactions} (user_id, event_id, ticket_id, amount, reason, sale_id, created_by)
      select ${userId}, ${eventId}::uuid, ${ticketId}::uuid, ${-tokens}::int, 'shop_sale', ${saleId}::uuid, ${by}
      where ${made}`),
    ...(await auditQuery(
      {
        action: "sale.create",
        target: { type: "sale", id: saleId, label: `${row.shop.name} · ${tokens.toLocaleString("th-TH")} โทเคน` },
        eventId,
        subjectUserId: userId,
        details: {
          shop: { id: shopId, name: row.shop.name },
          items: bill.map((line) => `${line.item.name} × ${line.quantity} (${line.item.tokens * line.quantity} โทเคน)`),
          tokens,
          baht,
          tokenPrice: row.tokenPrice,
          ticketCode: found.customer.ticketCode,
          customer: `${found.customer.name} <${found.customer.email}>`,
          balanceBefore: found.customer.tokens,
        },
      },
      made,
    )),
  ];
  const [, sale] = (await db.batch(queries as unknown as [BatchItem<"pg">, ...BatchItem<"pg">[]])) as unknown as [unknown, { rows: unknown[] }];

  if (sale.rows.length === 0) {
    // The same press came in twice: the first one charged, this one has nothing to do
    const [again] = await db.select({ tokens: shopSales.tokens }).from(shopSales).where(eq(shopSales.idempotencyKey, key)).limit(1);
    if (!again) return { error: `โทเคนไม่พอ บัตรใบนี้มี ${(await tokenBalance(ticketId)).toLocaleString("th-TH")} ต้องใช้ ${tokens.toLocaleString("th-TH")}` };
    return { tokens: again.tokens, balance: await tokenBalance(ticketId) };
  }
  return { tokens, balance: await tokenBalance(ticketId) };
}

/** ยกเลิกรายการ: the tokens go back and the report leaves the sale out */
export async function voidSale(saleId: string, by: string): Promise<{ error?: string }> {
  if (!UUID.test(saleId)) return { error: "ไม่พบรายการนี้" };
  const db = getDb();
  const [sale] = await db
    .select({ tokens: shopSales.tokens, baht: shopSales.baht, eventId: shopSales.eventId, userId: shopSales.userId, createdAt: shopSales.createdAt, shop: shops.name, shopId: shops.id, customer: user.name })
    .from(shopSales)
    .innerJoin(shops, eq(shops.id, shopSales.shopId))
    .innerJoin(user, eq(user.id, shopSales.userId))
    .where(eq(shopSales.id, saleId))
    .limit(1);
  if (!sale) return { error: "ไม่พบรายการนี้" };
  const backId = uuidv7();
  const voided = sql`select ${shopSales.userId}, ${shopSales.eventId}, ${shopSales.ticketId}, ${shopSales.tokens} from ${shopSales} where ${shopSales.id} = ${saleId}::uuid and ${shopSales.status} = 'voided'`;
  const [marked] = (await db.batch([
    db
      .update(shopSales)
      .set({ status: "voided", voidedAt: new Date(), voidedBy: by })
      .where(and(eq(shopSales.id, saleId), eq(shopSales.status, "completed")))
      .returning({ id: shopSales.id }),
    // Once per sale: a second press finds the row already there
    db.execute(sql`
      insert into ${tokenTransactions} (id, user_id, event_id, ticket_id, amount, reason, sale_id, created_by)
      select ${backId}::uuid, sold.user_id, sold.event_id, sold.ticket_id, sold.tokens, 'shop_sale_void', ${saleId}::uuid, ${by}
      from (${voided}) as sold
      where not exists (select 1 from ${tokenTransactions} where ${tokenTransactions.saleId} = ${saleId}::uuid and ${tokenTransactions.reason} = 'shop_sale_void')`),
    // Only the press that gave the tokens back is logged
    ...(await auditQuery(
      {
        action: "sale.void",
        target: { type: "sale", id: saleId, label: `${sale.shop} · ${sale.tokens.toLocaleString("th-TH")} โทเคน` },
        eventId: sale.eventId,
        subjectUserId: sale.userId,
        details: { shop: { id: sale.shopId, name: sale.shop }, tokensReturned: sale.tokens, baht: sale.baht, soldAt: sale.createdAt, customer: sale.customer },
      },
      sql`exists (select 1 from ${tokenTransactions} where ${tokenTransactions.id} = ${backId}::uuid)`,
    )),
  ] as unknown as [BatchItem<"pg">, BatchItem<"pg">, BatchItem<"pg">])) as unknown as [{ id: string }[]];
  return marked.length ? {} : { error: "รายการนี้ถูกยกเลิกไปแล้ว" };
}

export type SaleEntry = { id: string; at: string; tokens: number; baht: number; customer: string; by: string | null; voided: boolean; items: string };

/** The latest sales of a shop */
export async function recentSales(shopId: string, limit = 15): Promise<SaleEntry[]> {
  const customer = alias(user, "customer");
  const staff = alias(user, "staff");
  const db = getDb();
  const rows = await db
    .select({ id: shopSales.id, at: shopSales.createdAt, tokens: shopSales.tokens, baht: shopSales.baht, status: shopSales.status, customer: customer.name, by: staff.name })
    .from(shopSales)
    .innerJoin(customer, eq(customer.id, shopSales.userId))
    .leftJoin(staff, eq(staff.id, shopSales.soldBy))
    .where(eq(shopSales.shopId, shopId))
    .orderBy(desc(shopSales.createdAt))
    .limit(limit);
  if (rows.length === 0) return [];
  const items = await db.select().from(shopSaleItems).where(inArray(shopSaleItems.saleId, rows.map((r) => r.id)));
  return rows.map(({ status, ...row }) => ({
    ...row,
    at: row.at.toISOString(),
    voided: status === "voided",
    items: items
      .filter((i) => i.saleId === row.id)
      .map((i) => `${i.name} × ${i.quantity}`)
      .join(", "),
  }));
}
