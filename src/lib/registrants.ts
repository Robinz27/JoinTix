import { and, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, tickets, user } from "@/db/schema";

// ผู้ลงทะเบียน (หลังบ้าน /admin/attendees): everyone who signed up, the way the client counts them, not only those who
// bought. For each account: what they bought (paid only) and how many of their tickets came in, overall or for one
// event. Staff accounts (a หลังบ้าน role, or super admin) are left out unless they bought a ticket: then they're
// coming too. Server only.

export type RegistrantFilter = { q?: string; eventId?: string | null; bought?: "all" | "yes" | "no" };

export type Registrant = {
  id: string;
  name: string;
  email: string;
  phone: string;
  cohort: string;
  emailVerified: boolean;
  joinedAt: string;
  /** Paid orders, tickets in them, tickets that came in */
  orders: number;
  tickets: number;
  checkedIn: number;
};

export type RegistrantStats = { registered: number; buyers: number; tickets: number; checkedIn: number };

/** A customer account, or anyone at all who bought (staff who are coming too) */
const guestsOf = (bought: ReturnType<typeof purchases>) => or(and(eq(user.role, "user"), isNull(user.adminRoleId)), sql`${bought.orders} > 0`);

/** What each account bought: paid orders (of one event when asked) and their tickets */
function purchases(eventId: string | null | undefined) {
  const db = getDb();
  const paid = and(eq(orders.status, "paid"), eventId ? eq(orders.eventId, eventId) : undefined);
  return db
    .select({
      userId: orders.userId,
      orders: sql<number>`count(distinct ${orders.id})`.mapWith(Number).as("orders"),
      tickets: sql<number>`count(${tickets.id})`.mapWith(Number).as("tickets"),
      checkedIn: sql<number>`count(${tickets.id}) filter (where ${tickets.status} = 'used')`.mapWith(Number).as("checked_in"),
    })
    .from(orders)
    .leftJoin(tickets, and(eq(tickets.orderId, orders.id), sql`${tickets.status} <> 'void'`))
    .where(paid)
    .groupBy(orders.userId)
    .as("bought");
}

function filters(f: RegistrantFilter, bought: ReturnType<typeof purchases>): SQL | undefined {
  const parts: (SQL | undefined)[] = [guestsOf(bought)];
  const term = f.q?.trim();
  if (term) {
    const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
    parts.push(or(ilike(user.name, pattern), ilike(user.email, pattern), ilike(user.phone, pattern), ilike(user.cohort, pattern)));
  }
  if (f.bought === "yes") parts.push(sql`${bought.orders} > 0`);
  if (f.bought === "no") parts.push(sql`coalesce(${bought.orders}, 0) = 0`);
  return and(...parts);
}

export async function listRegistrants(f: RegistrantFilter, limit = 500): Promise<{ rows: Registrant[]; total: number }> {
  const db = getDb();
  const bought = purchases(f.eventId);
  const where = filters(f, bought);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        cohort: user.cohort,
        emailVerified: user.emailVerified,
        joinedAt: user.createdAt,
        orders: bought.orders,
        tickets: bought.tickets,
        checkedIn: bought.checkedIn,
      })
      .from(user)
      .leftJoin(bought, eq(bought.userId, user.id))
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(limit),
    db.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(user).leftJoin(bought, eq(bought.userId, user.id)).where(where),
  ]);
  return {
    total,
    rows: rows.map((r) => ({ ...r, joinedAt: r.joinedAt.toISOString(), orders: r.orders ?? 0, tickets: r.tickets ?? 0, checkedIn: r.checkedIn ?? 0 })),
  };
}

/** The numbers over the list: signed up, bought, tickets, came in (for one event when asked) */
export async function registrantStats(eventId?: string | null): Promise<RegistrantStats> {
  const bought = purchases(eventId);
  const [row] = await getDb()
    .select({
      registered: sql<number>`count(*)`.mapWith(Number),
      buyers: sql<number>`count(*) filter (where ${bought.orders} > 0)`.mapWith(Number),
      tickets: sql<number>`coalesce(sum(${bought.tickets}), 0)`.mapWith(Number),
      checkedIn: sql<number>`coalesce(sum(${bought.checkedIn}), 0)`.mapWith(Number),
    })
    .from(user)
    .leftJoin(bought, eq(bought.userId, user.id))
    .where(guestsOf(bought));
  return row;
}
