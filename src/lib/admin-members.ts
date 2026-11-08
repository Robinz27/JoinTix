import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { adminRoles, auditLogs, events, orders, session, shopSaleItems, shopSales, shopStaff, shops, ticketZones, tickets, tokenTransactions, user } from "@/db/schema";
import { merchOf, shipmentsOf, type OrderMerch, type OrderShipment } from "@/lib/orders";

// One member in full, for หลังบ้าน /admin/users/[id]: the account, what they bought, their tickets and whether they came
// in, their tokens, the shops they work at, and the devices they're signed in on. Server only. Never a ticket's QR secret.

export type MemberProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  cohort: string;
  emailVerified: boolean;
  role: string;
  adminRoleId: string | null;
  /** "Super admin", the name of their หลังบ้าน role, or null for a customer */
  staffRole: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MemberStats = {
  paidOrders: number;
  openOrders: number;
  tickets: number;
  checkedIn: number;
  spend: number;
  tokens: number;
  /** How many events those tokens are spread over: they can't be spent across events */
  tokenEvents: number;
  shopSpend: number;
  /** For the tabs: every order whatever its state, the shops they belong to, devices signed in now */
  orders: number;
  shops: number;
  devices: number;
  lastPaid: string | null;
  lastLogin: string | null;
  failedLogins30d: number;
};

export async function getMember(id: string): Promise<{ profile: MemberProfile; stats: MemberStats } | null> {
  if (!/^[\w-]{1,64}$/.test(id)) return null;
  const db = getDb();
  const [row] = await db
    .select({ member: user, roleName: adminRoles.name })
    .from(user)
    .leftJoin(adminRoles, eq(adminRoles.id, user.adminRoleId))
    .where(eq(user.id, id))
    .limit(1);
  if (!row) return null;
  const { member } = row;

  const [[money], [ticketCounts], [tokens], [shopSpend], [logins], [places]] = await Promise.all([
    db
      .select({
        all: sql<number>`count(*)`.mapWith(Number),
        paid: sql<number>`count(*) filter (where ${orders.status} = 'paid')`.mapWith(Number),
        open: sql<number>`count(*) filter (where (${orders.status} = 'pending' and ${orders.expiresAt} > now()) or ${orders.status} = 'review')`.mapWith(Number),
        spend: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.status} = 'paid'), 0)`.mapWith(Number),
        lastPaid: sql<Date | null>`max(${orders.paidAt})`,
      })
      .from(orders)
      .where(eq(orders.userId, id)),
    db
      .select({
        all: sql<number>`count(*) filter (where ${tickets.status} <> 'void')`.mapWith(Number),
        used: sql<number>`count(*) filter (where ${tickets.status} = 'used')`.mapWith(Number),
      })
      .from(tickets)
      .where(eq(tickets.userId, id)),
    db
      .select({
        n: sql<number>`coalesce(sum(balance), 0)`.mapWith(Number),
        events: sql<number>`count(*) filter (where balance <> 0)`.mapWith(Number),
      })
      .from(
        db
          .select({ balance: sql<number>`sum(${tokenTransactions.amount})`.as("balance") })
          .from(tokenTransactions)
          .where(eq(tokenTransactions.userId, id))
          .groupBy(tokenTransactions.eventId)
          .as("per_event"),
      ),
    db
      .select({ baht: sql<number>`coalesce(sum(${shopSales.baht}), 0)`.mapWith(Number) })
      .from(shopSales)
      .where(and(eq(shopSales.userId, id), eq(shopSales.status, "completed"))),
    db
      .select({
        lastLogin: sql<Date | null>`max(${auditLogs.createdAt}) filter (where ${auditLogs.action} = 'auth.login' and ${auditLogs.actorId} = ${id})`,
        failed: sql<number>`count(*) filter (where ${auditLogs.action} = 'auth.login_failed' and ${auditLogs.createdAt} > now() - interval '30 days')`.mapWith(Number),
      })
      .from(auditLogs)
      .where(eq(auditLogs.subjectUserId, id)),
    db
      .select({
        shops: sql<number>`(select count(*) from ${shopStaff} where ${shopStaff.userId} = ${id})`.mapWith(Number),
        devices: sql<number>`(select count(*) from ${session} where ${session.userId} = ${id} and ${session.expiresAt} > now())`.mapWith(Number),
      })
      .from(sql`(select 1) as one`),
  ]);
  // Before the log existed, the newest session is the best guess at the last sign-in
  const [newest] = logins.lastLogin ? [] : await db.select({ at: session.createdAt }).from(session).where(eq(session.userId, id)).orderBy(desc(session.createdAt)).limit(1);
  const iso = (value: Date | string | null | undefined) => (value ? new Date(value).toISOString() : null);

  return {
    profile: {
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      cohort: member.cohort,
      emailVerified: member.emailVerified,
      role: member.role,
      adminRoleId: member.adminRoleId,
      staffRole: member.role === "super_admin" ? "Super admin" : (row.roleName ?? null),
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    },
    stats: {
      paidOrders: money.paid,
      openOrders: money.open,
      tickets: ticketCounts.all,
      checkedIn: ticketCounts.used,
      spend: money.spend,
      tokens: tokens.n,
      tokenEvents: tokens.events,
      shopSpend: shopSpend.baht,
      orders: money.all,
      shops: places.shops,
      devices: places.devices,
      lastPaid: iso(money.lastPaid),
      lastLogin: iso(logins.lastLogin) ?? iso(newest?.at),
      failedLogins30d: logins.failed,
    },
  };
}

export type MemberTicket = { id: string; code: string; seq: number; status: "valid" | "used" | "void"; checkedInAt: string | null; checkedInBy: string | null };

export type MemberOrder = {
  id: string;
  code: string;
  status: "pending" | "review" | "paid" | "cancelled" | "expired";
  quantity: number;
  unitPrice: number;
  total: number;
  tokens: number;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string;
  event: { id: string; title: string; startsAt: string };
  /** Null for merchandise only */
  zone: string | null;
  merch: OrderMerch[];
  shipment: OrderShipment | null;
  tickets: MemberTicket[];
};

/** Every order of the account, newest first, with its tickets (codes only) and merchandise */
export async function memberOrders(userId: string): Promise<MemberOrder[]> {
  const db = getDb();
  const rows = await db
    .select({ order: orders, title: events.title, startsAt: events.startsAt, zone: ticketZones.name })
    .from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .leftJoin(ticketZones, eq(ticketZones.id, orders.zoneId))
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(300);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.order.id);
  const checker = alias(user, "checker");
  const [ticketRows, merch, shipments] = await Promise.all([
    db
      .select({ id: tickets.id, orderId: tickets.orderId, code: tickets.code, seq: tickets.seq, status: tickets.status, checkedInAt: tickets.checkedInAt, checkedInBy: checker.name })
      .from(tickets)
      .leftJoin(checker, eq(checker.id, tickets.checkedInBy))
      .where(inArray(tickets.orderId, ids))
      .orderBy(asc(tickets.seq)),
    merchOf(ids),
    shipmentsOf(ids),
  ]);
  return rows.map(({ order, title, startsAt, zone }) => ({
    id: order.id,
    code: order.code,
    status: order.status as MemberOrder["status"],
    quantity: order.quantity,
    unitPrice: order.unitPrice,
    total: order.total,
    tokens: order.tokens,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    expiresAt: order.expiresAt.toISOString(),
    event: { id: order.eventId, title, startsAt: startsAt.toISOString() },
    zone,
    merch: merch.get(order.id) ?? [],
    shipment: shipments.get(order.id) ?? null,
    tickets: ticketRows
      .filter((t) => t.orderId === order.id)
      .map((t) => ({ id: t.id, code: t.code, seq: t.seq, status: t.status as MemberTicket["status"], checkedInAt: t.checkedInAt?.toISOString() ?? null, checkedInBy: t.checkedInBy })),
  }));
}

export type MemberTokenRow = { id: string; at: string; amount: number; baht: number; reason: string; event: { id: string; title: string }; by: string | null; shop: string | null; items: string };
export type MemberTokenEvent = { eventId: string; title: string; balance: number; earned: number; toppedUp: number; spent: number };

/** Their tokens: the balance per event, and every movement, newest first */
export async function memberTokens(userId: string): Promise<{ events: MemberTokenEvent[]; rows: MemberTokenRow[] }> {
  const db = getDb();
  const staff = alias(user, "staff");
  const [perEvent, rows] = await Promise.all([
    db
      .select({
        eventId: events.id,
        title: events.title,
        balance: sql<number>`sum(${tokenTransactions.amount})`.mapWith(Number),
        earned: sql<number>`coalesce(sum(${tokenTransactions.amount}) filter (where ${tokenTransactions.reason} = 'ticket_purchase'), 0)`.mapWith(Number),
        toppedUp: sql<number>`coalesce(sum(${tokenTransactions.amount}) filter (where ${tokenTransactions.reason} in ('topup', 'topup_void')), 0)`.mapWith(Number),
        spent: sql<number>`coalesce(-sum(${tokenTransactions.amount}) filter (where ${tokenTransactions.reason} in ('shop_sale', 'shop_sale_void')), 0)`.mapWith(Number),
      })
      .from(tokenTransactions)
      .innerJoin(events, eq(events.id, tokenTransactions.eventId))
      .where(eq(tokenTransactions.userId, userId))
      .groupBy(events.id)
      .orderBy(desc(events.startsAt)),
    db
      .select({
        id: tokenTransactions.id,
        at: tokenTransactions.createdAt,
        amount: tokenTransactions.amount,
        baht: tokenTransactions.baht,
        reason: tokenTransactions.reason,
        eventId: events.id,
        title: events.title,
        by: staff.name,
        saleId: tokenTransactions.saleId,
        shop: shops.name,
      })
      .from(tokenTransactions)
      .innerJoin(events, eq(events.id, tokenTransactions.eventId))
      .leftJoin(staff, eq(staff.id, tokenTransactions.createdBy))
      .leftJoin(shopSales, eq(shopSales.id, tokenTransactions.saleId))
      .leftJoin(shops, eq(shops.id, shopSales.shopId))
      .where(eq(tokenTransactions.userId, userId))
      .orderBy(desc(tokenTransactions.createdAt))
      .limit(500),
  ]);
  const saleIds = [...new Set(rows.map((r) => r.saleId).filter((v): v is string => Boolean(v)))];
  const items = saleIds.length ? await db.select().from(shopSaleItems).where(inArray(shopSaleItems.saleId, saleIds)) : [];
  return {
    events: perEvent,
    rows: rows.map((r) => ({
      id: r.id,
      at: r.at.toISOString(),
      amount: r.amount,
      baht: r.baht,
      reason: r.reason,
      event: { id: r.eventId, title: r.title },
      by: r.by,
      shop: r.shop,
      items: items
        .filter((i) => i.saleId === r.saleId)
        .map((i) => `${i.name} × ${i.quantity}`)
        .join(", "),
    })),
  };
}

export type MemberShop = { id: string; name: string; active: boolean; role: "owner" | "staff"; event: { id: string; title: string }; sales: number; tokens: number };

/** The shops they belong to, and what they've sold at each */
export async function memberShops(userId: string): Promise<MemberShop[]> {
  const rows = await getDb()
    .select({
      id: shops.id,
      name: shops.name,
      active: shops.active,
      role: shopStaff.role,
      eventId: events.id,
      title: events.title,
      sales: sql<number>`(select count(*) from ${shopSales} where ${shopSales.shopId} = ${shops.id} and ${shopSales.soldBy} = ${userId} and ${shopSales.status} = 'completed')`.mapWith(Number),
      tokens: sql<number>`(select coalesce(sum(${shopSales.tokens}), 0) from ${shopSales} where ${shopSales.shopId} = ${shops.id} and ${shopSales.soldBy} = ${userId} and ${shopSales.status} = 'completed')`.mapWith(Number),
    })
    .from(shopStaff)
    .innerJoin(shops, eq(shops.id, shopStaff.shopId))
    .innerJoin(events, eq(events.id, shops.eventId))
    .where(eq(shopStaff.userId, userId))
    .orderBy(desc(events.startsAt), asc(shops.name));
  return rows.map(({ eventId, title, ...row }) => ({ ...row, event: { id: eventId, title } }));
}

export type MemberDevice = { id: string; ipAddress: string | null; userAgent: string | null; createdAt: string; lastSeen: string; expiresAt: string };

/** The devices signed in now, most recently used first */
export async function memberDevices(userId: string): Promise<MemberDevice[]> {
  const rows = await getDb()
    .select()
    .from(session)
    .where(and(eq(session.userId, userId), gt(session.expiresAt, new Date())))
    .orderBy(desc(session.updatedAt));
  return rows.map((row) => ({
    id: row.id,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
    lastSeen: row.updatedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  }));
}
