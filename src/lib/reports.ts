import { and, asc, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { attendeeName } from "@/lib/event-fields";
import { orderItems, orderShipments, orders, shopSaleItems, shopSales, shops, ticketZones, tickets, tokenTransactions, user } from "@/db/schema";
import { doorStats, type DoorStats } from "@/lib/checkins";
import { listShops, type ShopRow } from "@/lib/shops";

// รายงาน (app/admin/reports): what an event has done, counted from orders and token_transactions, never from
// the running totals on ticket_zones (those include holds not yet paid for). Server only.

export type EventReport = {
  door: DoorStats;
  orders: { paid: number; pending: number; lapsed: number };
  zones: { name: string; price: number; capacity: number; sold: number; revenue: number }[];
  merch: { name: string; optionLabel: string; option: string; sold: number; revenue: number; pickedUp: number }[];
  /** Orders being posted, what they paid for it, and how many are still to go out */
  shipping: { orders: number; fees: number; waiting: number };
  tokens: {
    /** Given with tickets */
    withTickets: number;
    /** Bought at the desk, undone ones taken off */
    toppedUp: number;
    /** Cash the desk should hold */
    cash: number;
    /** Spent at shops, voided sales taken off */
    spent: number;
    /** Corrected by หลังบ้าน (tokens.adjust), + and − together */
    adjusted: number;
    /** Still in customers' hands */
    outstanding: number;
    /** Tickets whose wallet went below zero after a correction: who still owes the event */
    owing: { ticketCode: string; name: string; balance: number }[];
  };
  shops: ShopRow[];
  topItems: { shop: string; name: string; quantity: number; tokens: number }[];
};

export async function eventReport(eventId: string): Promise<EventReport> {
  const db = getDb();
  const [door, statuses, zones, zoneSales, merch, [shipping], tokenRows, shopRows, topItems, owing] = await Promise.all([
    doorStats(eventId),
    db.select({ status: orders.status, n: sql<number>`count(*)`.mapWith(Number) }).from(orders).where(eq(orders.eventId, eventId)).groupBy(orders.status),
    db.select().from(ticketZones).where(eq(ticketZones.eventId, eventId)).orderBy(asc(ticketZones.position), asc(ticketZones.createdAt)),
    db
      .select({
        zoneId: orders.zoneId,
        sold: sql<number>`sum(${orders.quantity})`.mapWith(Number),
        revenue: sql<number>`sum(${orders.quantity} * ${orders.unitPrice})`.mapWith(Number),
      })
      .from(orders)
      .where(and(eq(orders.eventId, eventId), eq(orders.status, "paid")))
      .groupBy(orders.zoneId),
    db
      .select({
        name: orderItems.name,
        optionLabel: orderItems.optionLabel,
        option: orderItems.option,
        sold: sql<number>`sum(${orderItems.quantity})`.mapWith(Number),
        revenue: sql<number>`sum(${orderItems.quantity} * ${orderItems.unitPrice})`.mapWith(Number),
        pickedUp: sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orderItems.pickedUpAt} is not null), 0)`.mapWith(Number),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orders.eventId, eventId), eq(orders.status, "paid")))
      .groupBy(orderItems.name, orderItems.optionLabel, orderItems.option)
      .orderBy(asc(orderItems.name), asc(orderItems.option)),
    db
      .select({
        orders: sql<number>`count(*)`.mapWith(Number),
        fees: sql<number>`coalesce(sum(${orderShipments.fee}), 0)`.mapWith(Number),
        waiting: sql<number>`count(*) filter (where ${orderShipments.shippedAt} is null)`.mapWith(Number),
      })
      .from(orderShipments)
      .innerJoin(orders, eq(orders.id, orderShipments.orderId))
      .where(and(eq(orders.eventId, eventId), eq(orders.status, "paid"))),
    db
      .select({
        reason: tokenTransactions.reason,
        amount: sql<number>`sum(${tokenTransactions.amount})`.mapWith(Number),
        baht: sql<number>`sum(${tokenTransactions.baht})`.mapWith(Number),
      })
      .from(tokenTransactions)
      .where(eq(tokenTransactions.eventId, eventId))
      .groupBy(tokenTransactions.reason),
    listShops(eventId),
    db
      .select({
        shop: shops.name,
        name: shopSaleItems.name,
        quantity: sql<number>`sum(${shopSaleItems.quantity})`.mapWith(Number),
        tokens: sql<number>`sum(${shopSaleItems.quantity} * ${shopSaleItems.tokens})`.mapWith(Number),
      })
      .from(shopSaleItems)
      .innerJoin(shopSales, eq(shopSales.id, shopSaleItems.saleId))
      .innerJoin(shops, eq(shops.id, shopSales.shopId))
      .where(and(eq(shopSales.eventId, eventId), eq(shopSales.status, "completed")))
      .groupBy(shops.name, shopSaleItems.name)
      .orderBy(desc(sql`sum(${shopSaleItems.quantity})`))
      .limit(10),
    db
      .select({
        ticketCode: tickets.code,
        first: tickets.attendeeFirstName,
        last: tickets.attendeeLastName,
        email: tickets.attendeeEmail,
        balance: sql<number>`sum(${tokenTransactions.amount})`.mapWith(Number),
      })
      .from(tokenTransactions)
      .innerJoin(tickets, eq(tickets.id, tokenTransactions.ticketId))
      .where(eq(tokenTransactions.eventId, eventId))
      .groupBy(tickets.id)
      .having(sql`sum(${tokenTransactions.amount}) < 0`)
      .orderBy(sql`sum(${tokenTransactions.amount})`),
  ]);

  const count = (status: string) => statuses.find((s) => s.status === status)?.n ?? 0;
  const amount = (...reasons: string[]) => tokenRows.filter((t) => reasons.includes(t.reason)).reduce((n, t) => n + t.amount, 0);
  return {
    door,
    orders: { paid: count("paid"), pending: count("pending"), lapsed: count("expired") + count("cancelled") },
    zones: zones.map((zone) => {
      const sold = zoneSales.find((z) => z.zoneId === zone.id);
      return { name: zone.name, price: zone.price, capacity: zone.capacity, sold: sold?.sold ?? 0, revenue: sold?.revenue ?? 0 };
    }),
    merch,
    shipping,
    tokens: {
      withTickets: amount("ticket_purchase"),
      toppedUp: amount("topup", "topup_void"),
      cash: tokenRows.filter((t) => t.reason === "topup" || t.reason === "topup_void" || t.reason === "adjust").reduce((n, t) => n + t.baht, 0),
      spent: -amount("shop_sale", "shop_sale_void"),
      adjusted: amount("adjust"),
      outstanding: tokenRows.reduce((n, t) => n + t.amount, 0),
      owing: owing.map((row) => ({ ticketCode: row.ticketCode, name: attendeeName({ firstName: row.first, lastName: row.last, email: row.email }), balance: row.balance })),
    },
    shops: shopRows,
    topItems,
  };
}

/** Every paid order of an event, for the download */
export async function orderRows(eventId: string) {
  const db = getDb();
  return db
    .select({
      id: orders.id,
      code: orders.code,
      paidAt: orders.paidAt,
      name: user.name,
      email: user.email,
      phone: user.phone,
      zone: ticketZones.name,
      quantity: orders.quantity,
      unitPrice: orders.unitPrice,
      total: orders.total,
      tokens: orders.tokens,
    })
    .from(orders)
    .innerJoin(user, eq(user.id, orders.userId))
    .leftJoin(ticketZones, eq(ticketZones.id, orders.zoneId))
    .where(and(eq(orders.eventId, eventId), eq(orders.status, "paid")))
    .orderBy(asc(orders.paidAt));
}

/** Every sale at the event's shops, voided ones included and marked, for the download */
export async function saleRows(eventId: string) {
  const customer = alias(user, "customer");
  const staff = alias(user, "staff");
  return getDb()
    .select({
      at: shopSales.createdAt,
      shop: shops.name,
      item: shopSaleItems.name,
      quantity: shopSaleItems.quantity,
      tokens: shopSaleItems.tokens,
      status: shopSales.status,
      customer: customer.name,
      by: staff.name,
      saleTokens: shopSales.tokens,
      saleBaht: shopSales.baht,
    })
    .from(shopSaleItems)
    .innerJoin(shopSales, eq(shopSales.id, shopSaleItems.saleId))
    .innerJoin(shops, eq(shops.id, shopSales.shopId))
    .innerJoin(customer, eq(customer.id, shopSales.userId))
    .leftJoin(staff, eq(staff.id, shopSales.soldBy))
    .where(eq(shopSales.eventId, eventId))
    .orderBy(asc(shopSales.createdAt));
}

/** Every change to tokens at the event, for the download */
export async function tokenRows(eventId: string) {
  const customer = alias(user, "customer");
  const staff = alias(user, "staff");
  return getDb()
    .select({
      at: tokenTransactions.createdAt,
      reason: tokenTransactions.reason,
      amount: tokenTransactions.amount,
      baht: tokenTransactions.baht,
      customer: customer.name,
      phone: customer.phone,
      by: staff.name,
    })
    .from(tokenTransactions)
    .innerJoin(customer, eq(customer.id, tokenTransactions.userId))
    .leftJoin(staff, eq(staff.id, tokenTransactions.createdBy))
    .where(eq(tokenTransactions.eventId, eventId))
    .orderBy(asc(tokenTransactions.createdAt));
}
