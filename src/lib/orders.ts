import { randomBytes, randomInt } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "@/db";
import { auditLogs, events, merchItems, merchVariants, orderItems, orderShipments, orders, outbox, ticketZones, tickets, tokenTransactions, user } from "@/db/schema";
import { audit, auditQuery, auditRow, SYSTEM_ACTOR } from "@/lib/audit";
import { saleStatus } from "@/lib/events";
import { addressProblem, attendeesProblem, isBuyable, type Attendee, type ShippingAddress } from "@/lib/event-fields";
import { uuidv7 } from "@/lib/uuid";

// Buying tickets (and merchandise, with or without tickets): an order holds what it takes for HOLD_MINUTES while
// the buyer says who each ticket is for and sends a transfer slip (lib/payments.ts). A slip sent in stops the
// clock ("review"); accepting it issues the tickets, each ticket's tokens and the emails (lib/outbox.ts), all in
// one transaction. Server only.
//
// No double selling (HANDOFF section 7): a hold is one SQL statement that adds to ticket_zones.sold only
// while there's room and the account is within the event's limit, so two people pressing at once can't
// both get the last ticket. The Redis layer in front of it comes later.

/** 15, not 10: the buyer types in everyone's details and pays in their banking app before it runs out */
export const HOLD_MINUTES = 15;

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
      returning ${orders.id} as id, ${orders.zoneId} as zone_id, ${orders.quantity} as quantity, ${orders.code} as code,
        ${orders.eventId} as event_id, ${orders.userId} as user_id, ${orders.total} as total, ${orders.expiresAt} as expires_at
    ), logged as (
      insert into ${auditLogs} (actor_name, actor_role, action, target_type, target_id, target_label, event_id, subject_user_id, details)
      select ${SYSTEM_ACTOR.name}, ${SYSTEM_ACTOR.role}, 'order.expire', 'order', lapsed.id::text, lapsed.code, lapsed.event_id, lapsed.user_id,
        jsonb_build_object('quantity', lapsed.quantity, 'total', lapsed.total, 'expiresAt', lapsed.expires_at, 'note', 'ไม่ชำระภายในเวลา บัตรและสินค้าคืนเข้าระบบ')
      from lapsed
    ), back as (
      select zone_id, sum(quantity)::int as quantity from lapsed group by zone_id
    ), zones_back as (
      update ${ticketZones} set sold = ${ticketZones.sold} - back.quantity
      from back where ${ticketZones.id} = back.zone_id
    ), addresses as (
      delete from ${orderShipments} using lapsed where ${orderShipments.orderId} = lapsed.id
    ), merch as (
      select ${orderItems.variantId} as variant_id, sum(${orderItems.quantity})::int as quantity
      from ${orderItems} join lapsed on lapsed.id = ${orderItems.orderId}
      group by ${orderItems.variantId}
    )
    update ${merchVariants} set sold = ${merchVariants.sold} - merch.quantity
    from merch where ${merchVariants.id} = merch.variant_id`);
}

/** One option of an item and how many, as picked on the event page */
export type MerchPick = { variantId: string; quantity: number };

/** Most of one option in an order, and of all merchandise together (order_items allows 20) */
const MAX_MERCH = 20;

export type HoldResult = { ok: true; orderId: string } | { ok: false; error: string };

/** ซื้อบัตร: holds `quantity` tickets of a zone for the account, or says why not */
export async function holdTickets({
  userId,
  slug,
  zoneId,
  quantity,
  merch = [],
  delivery = null,
  key,
}: {
  userId: string;
  slug: string;
  /** Empty with quantity 0: merchandise only */
  zoneId: string;
  quantity: number;
  /** Merchandise bought with the tickets (or alone), each option once */
  merch?: MerchPick[];
  /** Where to post the merchandise; null to pick it up at the event */
  delivery?: ShippingAddress | null;
  /** One per press of the button, from the browser: the same press twice is one order */
  key: string;
}): Promise<HoldResult> {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 20) return { ok: false, error: "จำนวนบัตรไม่ถูกต้อง" };
  if (quantity === 0 && (!Array.isArray(merch) || merch.length === 0)) return { ok: false, error: "เลือกบัตรหรือสินค้าอย่างน้อยหนึ่งอย่าง" };
  if (
    !Array.isArray(merch) ||
    merch.some((s) => !Number.isInteger(s?.quantity) || s.quantity < 1) ||
    merch.reduce((n, s) => n + s.quantity, 0) > MAX_MERCH ||
    new Set(merch.map((s) => s.variantId)).size !== merch.length
  )
    return { ok: false, error: `เลือกสินค้าได้รวมไม่เกิน ${MAX_MERCH} ชิ้นต่อคำสั่งซื้อ` };
  if (!/^[\w-]{16,80}$/.test(key)) return { ok: false, error: "คำขอไม่ถูกต้อง ลองรีเฟรชหน้าแล้วกดใหม่" };
  const db = getDb();
  await releaseExpired();

  const [again] = await db.select({ id: orders.id, userId: orders.userId }).from(orders).where(eq(orders.idempotencyKey, key)).limit(1);
  if (again) return again.userId === userId ? { ok: true, orderId: again.id } : { ok: false, error: "คำขอไม่ถูกต้อง ลองรีเฟรชหน้าแล้วกดใหม่" };

  const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
  if (!event || event.status === "draft") return { ok: false, error: "ไม่พบอีเวนต์นี้" };
  const zones = await db.select().from(ticketZones).where(eq(ticketZones.eventId, event.id));
  const zone = quantity > 0 ? zones.find((z) => z.id === zoneId) : null;
  if (quantity > 0 && !zone) return { ok: false, error: "ไม่พบโซนบัตรนี้ รีเฟรชหน้าแล้วเลือกใหม่" };
  if (!isBuyable(saleStatus(event, zones))) return { ok: false, error: "อีเวนต์นี้ไม่ได้เปิดขายอยู่" };
  if (quantity > event.maxPerOrder) return { ok: false, error: `ซื้อได้สูงสุด ${event.maxPerOrder} ใบต่อบัญชี` };

  // The merchandise as it is now: only what's on sale at this event, in a fixed order so two buyers lock alike
  const picked = merch.length
    ? await db
        .select({ variantId: merchVariants.id, option: merchVariants.option, itemId: merchItems.id, name: merchItems.name, optionLabel: merchItems.optionLabel, price: merchItems.price, limit: merchItems.maxPerOrder })
        .from(merchVariants)
        .innerJoin(merchItems, eq(merchItems.id, merchVariants.itemId))
        .where(and(inArray(merchVariants.id, merch.map((s) => s.variantId)), eq(merchItems.eventId, event.id), eq(merchItems.active, true)))
        .orderBy(asc(merchVariants.id))
    : [];
  if (picked.length !== merch.length) return { ok: false, error: "มีสินค้าที่เลิกขายไปแล้ว รีเฟรชหน้าแล้วเลือกใหม่" };
  const lines = picked.map((p) => ({ ...p, quantity: merch.find((s) => s.variantId === p.variantId)!.quantity }));
  for (const line of lines) {
    const together = lines.filter((other) => other.itemId === line.itemId).reduce((n, other) => n + other.quantity, 0);
    if (line.limit > 0 && together > line.limit) return { ok: false, error: `${line.name} ซื้อได้สูงสุด ${line.limit} ชิ้นต่อคำสั่งซื้อ` };
  }
  if (delivery) {
    if (lines.length === 0) return { ok: false, error: "เลือกสินค้าก่อนเลือกจัดส่ง" };
    if (event.shippingFee === null) return { ok: false, error: "งานนี้รับสินค้าที่หน้างานเท่านั้น รีเฟรชหน้าแล้วเลือกใหม่" };
    const problem = addressProblem(delivery);
    if (problem) return { ok: false, error: problem };
  }
  const shippingFee = delivery ? (event.shippingFee ?? 0) : 0;
  const merchTotal = lines.reduce((n, line) => n + line.price * line.quantity, 0) + shippingFee;

  const id = uuidv7();
  const code = orderCode();
  // Hold and order in one statement: the zone is only counted up while there's room and the account
  // stays within the limit (counting its other live orders for this event), and only then is the order made.
  // Merchandise alone has no zone to count: the order is simply made
  const hold = zone
    ? db.execute<{ held: number; id: string | null }>(sql`
    with held as (
      update ${ticketZones} set sold = ${ticketZones.sold} + ${quantity}
      where ${ticketZones.id} = ${zone.id}
        and ${ticketZones.sold} + ${quantity} <= ${ticketZones.capacity}
        and (
          select coalesce(sum(${orders.quantity}), 0) from ${orders}
          where ${orders.userId} = ${userId} and ${orders.eventId} = ${event.id} and ${orders.status} in ('pending', 'review', 'paid')
        ) + ${quantity} <= ${event.maxPerOrder}
      returning ${ticketZones.price} as price, ${ticketZones.tokens} as tokens
    ), made as (
      insert into ${orders} (id, code, user_id, event_id, zone_id, quantity, unit_price, total, tokens, idempotency_key, expires_at)
      select ${id}, ${code}, ${userId}, ${event.id}, ${zone.id}, ${quantity}, price, price * ${quantity} + ${merchTotal}, tokens * ${quantity}, ${key},
        now() + make_interval(mins => ${HOLD_MINUTES})
      from held
      on conflict (idempotency_key) do nothing
      returning id
    )
    select (select count(*) from held)::int as held, (select id from made) as id`)
    : db.execute<{ held: number; id: string | null }>(sql`
    with made as (
      insert into ${orders} (id, code, user_id, event_id, zone_id, quantity, unit_price, total, tokens, idempotency_key, expires_at)
      values (${id}, ${code}, ${userId}, ${event.id}, null, 0, 0, ${merchTotal}, 0, ${key}, now() + make_interval(mins => ${HOLD_MINUTES}))
      on conflict (idempotency_key) do nothing
      returning id
    )
    select 0 as held, (select id from made) as id`);

  // The merchandise rides in the same transaction, and only if the order was made. Past the last one in stock the
  // CHECK on merch_variants fails, which takes the ticket hold back with it
  const made = sql`exists (select 1 from ${orders} where ${orders.id} = ${id}::uuid)`;
  const queries: BatchItem<"pg">[] = [hold];
  for (const line of lines)
    queries.push(
      db.execute(sql`
        insert into ${orderItems} (order_id, variant_id, name, option_label, size, unit_price, quantity)
        select ${id}::uuid, ${line.variantId}::uuid, ${line.name}, ${line.optionLabel}, ${line.option}, ${line.price}::int, ${line.quantity}::int
        where ${made}`),
      db.update(merchVariants).set({ sold: sql`${merchVariants.sold} + ${line.quantity}` }).where(and(eq(merchVariants.id, line.variantId), made)),
    );
  if (delivery)
    queries.push(
      db.execute(sql`
        insert into ${orderShipments} (order_id, fee, name, phone, address, subdistrict, district, province, postcode)
        select ${id}::uuid, ${shippingFee}::int, ${delivery.name.trim()}, ${delivery.phone.replace(/[\s-]/g, "")}, ${delivery.address.trim()}, ${delivery.subdistrict.trim()}, ${delivery.district.trim()}, ${delivery.province.trim()}, ${delivery.postcode.trim()}
        where ${made}`),
    );
  // Logged in the same transaction, and only if the order was made
  queries.push(
    ...(await auditQuery(
      {
        action: "order.create",
        target: { type: "order", id, label: code },
        eventId: event.id,
        subjectUserId: userId,
        details: {
          event: event.title,
          zone: zone?.name ?? "ไม่ซื้อบัตร (สินค้าอย่างเดียว)",
          quantity,
          unitPrice: zone?.price ?? 0,
          merch: lines.map((line) => `${line.name}${line.option ? ` ${line.option}` : ""} × ${line.quantity}`),
          delivery: delivery ? `จัดส่ง (${delivery.province.trim()})` : lines.length ? "รับที่งาน" : null,
          shippingFee,
          total: (zone?.price ?? 0) * quantity + merchTotal,
          holdMinutes: HOLD_MINUTES,
        },
      },
      made,
    )),
  );
  let result: { held: number; id: string | null } | undefined;
  try {
    const [first] = (await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]])) as unknown as [{ rows: { held: number; id: string | null }[] }];
    result = first.rows[0];
  } catch (e) {
    if (violates(e, "merch_variants_sold_check")) return { ok: false, error: "สินค้าบางรายการที่เลือกหมดแล้ว ลดจำนวนหรือเลือกแบบอื่น" };
    throw e;
  }

  if (result?.id) return { ok: true, orderId: result.id };
  if (!zone) {
    const [made] = await db.select({ id: orders.id }).from(orders).where(eq(orders.idempotencyKey, key)).limit(1);
    return made ? { ok: true, orderId: made.id } : { ok: false, error: "ซื้อไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
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
    .where(and(eq(orders.userId, userId), eq(orders.eventId, event.id), sql`${orders.status} in ('pending', 'review', 'paid')`));
  if (taken + quantity > event.maxPerOrder)
    return { ok: false, error: `บัญชีนี้มีบัตรงานนี้แล้ว ${taken} ใบ ซื้อเพิ่มได้อีก ${Math.max(0, event.maxPerOrder - taken)} ใบ` };
  const left = zone.capacity - zone.sold;
  return { ok: false, error: left > 0 ? `โซนนี้เหลือ ${left} ใบ ลดจำนวนแล้วลองใหม่` : "บัตรโซนนี้หมดแล้ว" };
}

/** Whether a failed query broke this constraint (drizzle may wrap the database's error) */
function violates(error: unknown, constraint: string) {
  const e = error as { constraint?: string; message?: string; cause?: { constraint?: string; message?: string } };
  return [e?.constraint, e?.message, e?.cause?.constraint, e?.cause?.message].some((text) => text?.includes(constraint));
}

export type OrderMerch = { id: string; name: string; optionLabel: string; option: string; unitPrice: number; quantity: number; pickedUpAt: string | null };

/** The merchandise of some orders, by order */
export async function merchOf(orderIds: string[]): Promise<Map<string, OrderMerch[]>> {
  const byOrder = new Map<string, OrderMerch[]>();
  if (orderIds.length === 0) return byOrder;
  const rows = await getDb().select().from(orderItems).where(inArray(orderItems.orderId, orderIds)).orderBy(asc(orderItems.name), asc(orderItems.option));
  for (const row of rows)
    byOrder.set(row.orderId, [
      ...(byOrder.get(row.orderId) ?? []),
      { id: row.id, name: row.name, optionLabel: row.optionLabel, option: row.option, unitPrice: row.unitPrice, quantity: row.quantity, pickedUpAt: row.pickedUpAt?.toISOString() ?? null },
    ]);
  return byOrder;
}

export type OrderShipment = ShippingAddress & { fee: number; carrier: string; trackingNo: string; shippedAt: string | null };

/** Where some orders' merchandise is posted, by order; an order that isn't here picks it up at the event */
export async function shipmentsOf(orderIds: string[]): Promise<Map<string, OrderShipment>> {
  if (orderIds.length === 0) return new Map();
  const rows = await getDb().select().from(orderShipments).where(inArray(orderShipments.orderId, orderIds));
  return new Map(
    rows.map((row) => [
      row.orderId,
      {
        fee: row.fee,
        name: row.name,
        phone: row.phone,
        address: row.address,
        subdistrict: row.subdistrict,
        district: row.district,
        province: row.province,
        postcode: row.postcode,
        carrier: row.carrier,
        trackingNo: row.trackingNo,
        shippedAt: row.shippedAt?.toISOString() ?? null,
      },
    ]),
  );
}

export type OrderView = {
  id: string;
  code: string;
  status: "pending" | "review" | "paid" | "cancelled" | "expired";
  quantity: number;
  unitPrice: number;
  total: number;
  tokens: number;
  expiresAt: string;
  paidAt: string | null;
  createdAt: string;
  event: { id: string; slug: string; title: string; venue: string; venueArea: string; poster: string; startsAt: string; doorsAt: string };
  /** Null for an order of merchandise only */
  zone: { name: string; note: string } | null;
  /** Who each ticket is for, as typed at checkout; fewer than `quantity` until the buyer has filled them in */
  attendees: Attendee[];
  merch: OrderMerch[];
  /** Null: the merchandise, if any, is picked up at the event */
  shipment: OrderShipment | null;
};

type OrderRow = { order: typeof orders.$inferSelect; event: typeof events.$inferSelect; zone: typeof ticketZones.$inferSelect | null };

/** An order of this account, with what the checkout and tickets pages show about it */
export async function getOrder(orderId: string, userId: string): Promise<OrderView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  await releaseExpired();
  const [row] = await getDb()
    .select({ order: orders, event: events, zone: ticketZones })
    .from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .leftJoin(ticketZones, eq(ticketZones.id, orders.zoneId))
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  if (!row) return null;
  const [merch, shipments] = await Promise.all([merchOf([orderId]), shipmentsOf([orderId])]);
  return orderView(row, merch.get(orderId), shipments.get(orderId));
}

function orderView({ order, event, zone }: OrderRow, merch: OrderMerch[] = [], shipment: OrderShipment | null = null): OrderView {
  return {
    merch,
    shipment,
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
    attendees: Array.isArray(order.attendees) ? order.attendees : [],
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
    zone: zone ? { name: zone.name, note: zone.note } : null,
  };
}

/** ข้อมูลผู้เข้างาน: who each ticket of a pending order is for. Saved before the slip, copied onto the tickets when paid */
export async function saveAttendees(orderId: string, userId: string, list: Attendee[]): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return { ok: false, error: "ไม่พบคำสั่งซื้อนี้" };
  const db = getDb();
  await releaseExpired();
  const [order] = await db.select({ quantity: orders.quantity, status: orders.status }).from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1);
  if (!order) return { ok: false, error: "ไม่พบคำสั่งซื้อนี้" };
  if (order.status !== "pending") return { ok: false, error: order.status === "expired" ? "หมดเวลาชำระเงินแล้ว ลองซื้อใหม่" : "แก้ข้อมูลผู้เข้างานของคำสั่งซื้อนี้ไม่ได้แล้ว" };
  const problem = attendeesProblem(list, order.quantity);
  if (problem) return { ok: false, error: problem };
  const clean = list.map((a) => ({ firstName: a.firstName.trim(), lastName: a.lastName.trim(), email: a.email.trim().toLowerCase() }));
  await db.update(orders).set({ attendees: clean }).where(and(eq(orders.id, orderId), eq(orders.status, "pending")));
  return { ok: true };
}

/**
 * The slip was accepted (lib/payments.ts): pending or review → paid, then the tickets (each with who it's for), each
 * ticket's tokens and the email jobs, together. Issuing an order already paid just makes sure it was all issued.
 * `via` says who accepted it, for the log; `extra` rides in the same transaction (the payment row's own update).
 */
export async function issueOrder(orderId: string, via: { by: "api" | "admin"; paymentId: string; extra?: BatchItem<"pg">[] }): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();
  const [paid] = await db
    .update(orders)
    .set({ status: "paid", paidAt: new Date() })
    .where(and(eq(orders.id, orderId), or(eq(orders.status, "review"), and(eq(orders.status, "pending"), sql`${orders.expiresAt} > now()`))))
    .returning();
  const order = paid ?? (await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0];
  if (!order) return { ok: false, error: "ไม่พบคำสั่งซื้อนี้" };
  if (order.status !== "paid") return { ok: false, error: order.status === "expired" ? "คำสั่งซื้อหมดเวลาไปแล้ว บัตรถูกปล่อยคืน" : "คำสั่งซื้อนี้ถูกยกเลิกแล้ว" };

  const [buyer] = await db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, order.userId)).limit(1);
  const attendees = Array.isArray(order.attendees) ? order.attendees : [];
  const perTicket = order.quantity > 0 ? Math.floor(order.tokens / order.quantity) : 0;

  const queries: BatchItem<"pg">[] = [
    db
      .insert(outbox)
      .values({ kind: "ticket_email", payload: { orderId: order.id }, dedupeKey: `ticket_email:${order.id}` })
      .onConflictDoNothing({ target: outbox.dedupeKey }),
  ];
  if (order.quantity > 0 && order.zoneId) {
    const zoneId = order.zoneId;
    // One row per ticket; (order, seq) is unique, so running this again makes none twice
    queries.push(
      db
        .insert(tickets)
        .values(
          Array.from({ length: order.quantity }, (_, i) => {
            const who = attendees[i];
            return {
              orderId: order.id,
              seq: i + 1,
              eventId: order.eventId,
              zoneId,
              userId: order.userId,
              code: ticketCode(),
              secret: ticketSecret(),
              attendeeFirstName: who?.firstName ?? buyer?.name ?? "",
              attendeeLastName: who?.lastName ?? "",
              attendeeEmail: who?.email ?? buyer?.email ?? "",
            };
          }),
        )
        .onConflictDoNothing({ target: [tickets.orderId, tickets.seq] }),
    );
    // Each ticket is its own wallet; one purchase row per ticket, so this credits once however often it runs
    if (perTicket > 0)
      queries.push(
        db.execute(sql`
          insert into ${tokenTransactions} (user_id, event_id, ticket_id, amount, reason, order_id)
          select ${order.userId}, ${order.eventId}::uuid, t.id, ${perTicket}::int, 'ticket_purchase', ${order.id}::uuid
          from ${tickets} t where t.order_id = ${order.id}::uuid
          on conflict (ticket_id) where reason = 'ticket_purchase' do nothing`),
      );
    // A ticket for someone else goes to them too, with their QR alone
    const buyerEmail = buyer?.email.toLowerCase() ?? "";
    for (const [i, who] of attendees.entries())
      if (i < order.quantity && who.email && who.email.toLowerCase() !== buyerEmail)
        queries.push(
          db
            .insert(outbox)
            .values({ kind: "attendee_ticket_email", payload: { orderId: order.id, seq: i + 1 }, dedupeKey: `attendee_ticket_email:${order.id}:${i + 1}` })
            .onConflictDoNothing({ target: outbox.dedupeKey }),
        );
  }
  queries.push(...(via.extra ?? []));
  // Only the change that paid is logged; issuing again just makes sure everything was there
  if (paid)
    queries.push(
      ...(await auditQuery({
        action: "order.pay",
        actor: via.by === "api" ? SYSTEM_ACTOR : undefined,
        target: { type: "order", id: order.id, label: order.code },
        eventId: order.eventId,
        subjectUserId: order.userId,
        details: {
          total: order.total,
          quantity: order.quantity,
          ticketsIssued: order.quantity,
          tokens: order.tokens,
          tokensPerTicket: perTicket,
          attendees: attendees.map((a) => `${a.firstName} ${a.lastName} <${a.email}>`),
          payment: via.by === "api" ? "สลิปโอนเงิน ตรวจอัตโนมัติ (Slip2Go)" : "สลิปโอนเงิน ทีมงานตรวจ",
          paymentId: via.paymentId,
          heldSince: order.createdAt,
        },
      })),
    );
  await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  return { ok: true };
}

/** ยกเลิก: a pending order lets its tickets go at once instead of waiting out the hold */
export async function cancelOrder(orderId: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return;
  await releaseOrder(orderId, sql`${orders.userId} = ${userId} and ${orders.status} = 'pending'`, "order.cancel", "ยกเลิกก่อนชำระ บัตรและสินค้าคืนเข้าระบบทันที");
}

/**
 * Lets an unpaid order go: cancelled, its tickets and merchandise back on sale and its address forgotten, logged as
 * `action`, in one statement so it can only happen once. `where` says which orders may be let go this way
 */
export async function releaseOrder(orderId: string, where: SQL, action: "order.cancel" | "payment.reject", note: string, details: Record<string, unknown> = {}) {
  const who = await auditRow({ action });
  await getDb().execute(sql`
    with gone as (
      update ${orders} set status = 'cancelled'
      where ${orders.id} = ${orderId} and ${where}
      returning ${orders.id} as id, ${orders.zoneId} as zone_id, ${orders.quantity} as quantity, ${orders.code} as code,
        ${orders.eventId} as event_id, ${orders.total} as total, ${orders.userId} as user_id
    ), logged as (
      insert into ${auditLogs} (actor_id, actor_name, actor_email, actor_role, action, target_type, target_id, target_label, event_id, subject_user_id, details, ip, user_agent)
      select ${who.actorId ?? null}, ${who.actorName}, ${who.actorEmail}, ${who.actorRole}, ${action}, 'order', gone.id::text, gone.code, gone.event_id, gone.user_id,
        jsonb_build_object('quantity', gone.quantity, 'total', gone.total, 'note', ${note}::text) || ${JSON.stringify(details)}::jsonb, ${who.ip ?? null}, ${who.userAgent ?? null}
      from gone
    ), zones_back as (
      update ${ticketZones} set sold = ${ticketZones.sold} - gone.quantity
      from gone where ${ticketZones.id} = gone.zone_id
    ), addresses as (
      delete from ${orderShipments} using gone where ${orderShipments.orderId} = gone.id
    )
    update ${merchVariants} set sold = ${merchVariants.sold} - ${orderItems.quantity}
    from ${orderItems} join gone on gone.id = ${orderItems.orderId}
    where ${merchVariants.id} = ${orderItems.variantId}`);
}

export type TicketView = {
  id: string;
  seq: number;
  code: string;
  secret: string;
  status: "valid" | "used" | "void";
  checkedInAt: string | null;
  attendee: Attendee;
  /** This ticket's own tokens now */
  tokens: number;
};

export type TicketGroup = OrderView & { tickets: TicketView[] };

/** บัตรของฉัน: the account's paid orders with their tickets (and merchandise-only ones), soonest event first */
export async function listMyTickets(userId: string): Promise<TicketGroup[]> {
  const db = getDb();
  const rows = await db
    .select({ order: orders, event: events, zone: ticketZones })
    .from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .leftJoin(ticketZones, eq(ticketZones.id, orders.zoneId))
    .where(and(eq(orders.userId, userId), eq(orders.status, "paid")))
    .orderBy(asc(events.startsAt), desc(orders.paidAt));
  if (rows.length === 0) return [];
  const [all, wallets, merch, shipments] = await Promise.all([
    db.select().from(tickets).where(eq(tickets.userId, userId)).orderBy(asc(tickets.seq)),
    db
      .select({ ticketId: tokenTransactions.ticketId, n: sql<number>`sum(${tokenTransactions.amount})`.mapWith(Number) })
      .from(tokenTransactions)
      .where(eq(tokenTransactions.userId, userId))
      .groupBy(tokenTransactions.ticketId),
    merchOf(rows.map((row) => row.order.id)),
    shipmentsOf(rows.map((row) => row.order.id)),
  ]);
  return rows.map((row) => ({
    ...orderView(row, merch.get(row.order.id), shipments.get(row.order.id)),
    tickets: all
      .filter((t) => t.orderId === row.order.id)
      .map((t) => ({
        id: t.id,
        seq: t.seq,
        code: t.code,
        secret: t.secret,
        status: t.status as TicketView["status"],
        checkedInAt: t.checkedInAt?.toISOString() ?? null,
        attendee: { firstName: t.attendeeFirstName, lastName: t.attendeeLastName, email: t.attendeeEmail },
        tokens: wallets.find((w) => w.ticketId === t.id)?.n ?? 0,
      })),
  }));
}

/** Orders of this account still waiting: for a slip ("pending"), or for the slip to be checked ("review") */
export async function openOrders(userId: string): Promise<{ id: string; code: string; status: "pending" | "review"; total: number; title: string }[]> {
  await releaseExpired();
  const rows = await getDb()
    .select({ id: orders.id, code: orders.code, status: orders.status, total: orders.total, title: events.title })
    .from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .where(and(eq(orders.userId, userId), inArray(orders.status, ["pending", "review"])))
    .orderBy(desc(orders.createdAt));
  return rows.map((row) => ({ ...row, status: row.status as "pending" | "review" }));
}

export type TokenBalance = { eventId: string; title: string; slug: string; startsAt: string; balance: number };

/** Tokens per event on the tickets this account bought, and the total */
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

export type WalletTicket = { id: string; seq: number; code: string; secret: string; name: string; zone: string; used: boolean; tokens: number };
export type EventWallet = { id: string; title: string; slug: string; startsAt: string; total: number; tickets: WalletTicket[] };

/**
 * The navbar's token chip: every event the account holds live tickets for, each ticket's own tokens, the event
 * that's on now or next first (then past ones, latest first). The QR secret is the account's own, as on บัตรของฉัน.
 */
export async function myWallets(userId: string): Promise<EventWallet[]> {
  const db = getDb();
  const rows = await db
    .select({ ticket: tickets, event: events, zone: ticketZones.name })
    .from(tickets)
    .innerJoin(events, eq(events.id, tickets.eventId))
    .innerJoin(ticketZones, eq(ticketZones.id, tickets.zoneId))
    .where(and(eq(tickets.userId, userId), sql`${tickets.status} <> 'void'`))
    .orderBy(asc(tickets.seq));
  if (rows.length === 0) return [];
  const balances = await db
    .select({ ticketId: tokenTransactions.ticketId, n: sql<number>`sum(${tokenTransactions.amount})`.mapWith(Number) })
    .from(tokenTransactions)
    .where(inArray(tokenTransactions.ticketId, rows.map((r) => r.ticket.id)))
    .groupBy(tokenTransactions.ticketId);
  const byEvent = new Map<string, EventWallet>();
  for (const { ticket, event, zone } of rows) {
    const wallet = byEvent.get(event.id) ?? { id: event.id, title: event.title, slug: event.slug, startsAt: event.startsAt.toISOString(), total: 0, tickets: [] };
    const tokens = balances.find((b) => b.ticketId === ticket.id)?.n ?? 0;
    wallet.tickets.push({
      id: ticket.id,
      seq: ticket.seq,
      code: ticket.code,
      secret: ticket.secret,
      name: [ticket.attendeeFirstName, ticket.attendeeLastName].filter(Boolean).join(" ") || ticket.attendeeEmail,
      zone,
      used: ticket.status === "used",
      tokens,
    });
    wallet.total += tokens;
    byEvent.set(event.id, wallet);
  }
  // On now or coming (counted as on until 12 hours after it starts) soonest first, then past ones latest first
  const cutoff = Date.now() - 12 * 3_600_000;
  return [...byEvent.values()].sort((a, b) => {
    const at = Date.parse(a.startsAt);
    const bt = Date.parse(b.startsAt);
    const aLive = at >= cutoff;
    const bLive = bt >= cutoff;
    if (aLive !== bLive) return aLive ? -1 : 1;
    return aLive ? at - bt : bt - at;
  });
}

/* ─────────────── At the door (หลังบ้าน /admin/scan) ─────────────── */

export type ScanResult = {
  ticket: { id: string; code: string; seq: number; status: "valid" | "used" | "void"; checkedInAt: string | null; checkedInBy: string | null };
  order: { id: string; code: string; quantity: number; unitPrice: number; total: number; tokens: number; paidAt: string | null };
  event: { id: string; title: string; startsAt: string; venue: string };
  zone: { name: string; note: string; price: number };
  /** The account that bought it */
  holder: { id: string; name: string; email: string; phone: string; emailVerified: boolean };
  /** Who the ticket is for: the person standing at the door */
  attendee: Attendee;
  /** Merchandise bought in this ticket's order, to hand over at the door */
  merch: OrderMerch[];
  /** It's being posted instead, so the door has nothing to hand over */
  posted: boolean;
  /** This ticket's tokens now; then every ticket its buyer holds for the event */
  tokens: number;
  /** Whether this event lets a ticket in again once it has been used */
  allowReentry: boolean;
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

  const [[tokens], [counts], checker, merch, shipments] = await Promise.all([
    db
      .select({ n: sql<number>`coalesce(sum(${tokenTransactions.amount}), 0)`.mapWith(Number) })
      .from(tokenTransactions)
      .where(eq(tokenTransactions.ticketId, row.ticket.id)),
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
    merchOf([row.order.id]),
    shipmentsOf([row.order.id]),
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
      id: row.order.id,
      code: row.order.code,
      quantity: row.order.quantity,
      unitPrice: row.order.unitPrice,
      total: row.order.total,
      tokens: row.order.tokens,
      paidAt: row.order.paidAt?.toISOString() ?? null,
    },
    event: { id: row.event.id, title: row.event.title, startsAt: row.event.startsAt.toISOString(), venue: row.event.venue },
    zone: { name: row.zone.name, note: row.zone.note, price: row.zone.price },
    holder: { id: row.holder.id, name: row.holder.name, email: row.holder.email, phone: row.holder.phone, emailVerified: row.holder.emailVerified },
    attendee: { firstName: row.ticket.attendeeFirstName, lastName: row.ticket.attendeeLastName, email: row.ticket.attendeeEmail },
    allowReentry: row.event.allowReentry,
    merch: merch.get(row.order.id) ?? [],
    posted: shipments.has(row.order.id),
    tokens: tokens.n,
    ticketsForEvent: counts.all,
    checkedInForEvent: counts.used,
  };
}

/** ส่งมอบสินค้า: marks an order's merchandise handed over (found by one of its tickets, or the order itself); what was already given keeps its time */
export async function handOverMerch(of: { ticketId: string } | { orderId: string }, adminId: string) {
  const orderOf = "ticketId" in of ? sql`(select ${tickets.orderId} from ${tickets} where ${tickets.id} = ${of.ticketId})` : sql`${of.orderId}::uuid`;
  const given = await getDb()
    .update(orderItems)
    .set({ pickedUpAt: new Date(), pickedUpBy: adminId })
    .where(
      and(
        isNull(orderItems.pickedUpAt),
        sql`${orderItems.orderId} = ${orderOf}`,
        // Only paid orders, and what's being posted isn't handed over
        sql`exists (select 1 from ${orders} where ${orders.id} = ${orderItems.orderId} and ${orders.status} = 'paid')`,
        sql`not exists (select 1 from ${orderShipments} where ${orderShipments.orderId} = ${orderItems.orderId})`,
      ),
    )
    .returning({ orderId: orderItems.orderId, name: orderItems.name, option: orderItems.option, quantity: orderItems.quantity });
  if (given.length === 0) return;
  const [order] = await getDb().select({ code: orders.code, eventId: orders.eventId, userId: orders.userId }).from(orders).where(eq(orders.id, given[0].orderId)).limit(1);
  await audit({
    action: "merch.handover",
    target: { type: "order", id: given[0].orderId, label: order?.code ?? "" },
    eventId: order?.eventId,
    subjectUserId: order?.userId,
    details: { items: given.map((item) => `${item.name}${item.option ? ` ${item.option}` : ""} × ${item.quantity}`), ...("ticketId" in of ? { ticketId: of.ticketId } : { by: "เลขคำสั่งซื้อ" }) },
  });
}

export type PickupResult = {
  order: { id: string; code: string; status: string; quantity: number; total: number; paidAt: string | null };
  event: { id: string; title: string };
  buyer: { id: string; name: string; email: string; phone: string };
  merch: OrderMerch[];
  posted: boolean;
};

/** An order found by its code (JT-XXXXXXXX), for handing over merchandise bought without a ticket */
export async function lookupOrderByCode(value: string): Promise<PickupResult | null> {
  const code = value.trim().toUpperCase().replace(/^JT-?/, "JT-");
  if (!/^JT-[A-Z0-9]{8}$/.test(code)) return null;
  const db = getDb();
  const [row] = await db
    .select({ order: orders, event: events, buyer: user })
    .from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .innerJoin(user, eq(user.id, orders.userId))
    .where(eq(orders.code, code))
    .limit(1);
  if (!row) return null;
  const [merch, shipments] = await Promise.all([merchOf([row.order.id]), shipmentsOf([row.order.id])]);
  return {
    order: { id: row.order.id, code: row.order.code, status: row.order.status, quantity: row.order.quantity, total: row.order.total, paidAt: row.order.paidAt?.toISOString() ?? null },
    event: { id: row.event.id, title: row.event.title },
    buyer: { id: row.buyer.id, name: row.buyer.name, email: row.buyer.email, phone: row.buyer.phone },
    merch: merch.get(row.order.id) ?? [],
    posted: shipments.has(row.order.id),
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
