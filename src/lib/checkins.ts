import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { events, orders, scanLogs, ticketZones, tickets, user } from "@/db/schema";
import { checkIn, lookupTicket, type ScanResult } from "@/lib/orders";

// The door (หลังบ้าน /admin/scan and /admin/events/[id]/checkins): every scan written to scan_logs, letting
// a ticket in or undoing it, and who of an event has come in. Server only.

export type ScanOutcome = "valid" | "used" | "not_found" | "void" | "wrong_event" | "admitted" | "undone";

/** Into the log; for a ticket, its code only (the QR's secret never goes in a log) */
async function log(entry: { ticketId?: string; eventId?: string; doorEventId?: string | null; scannedBy: string; input: string; result: ScanOutcome }) {
  await getDb()
    .insert(scanLogs)
    .values({
      ticketId: entry.ticketId,
      eventId: entry.eventId,
      doorEventId: entry.doorEventId ?? null,
      scannedBy: entry.scannedBy,
      input: entry.input.slice(0, 40),
      result: entry.result,
    });
}

/** What was scanned matched nothing: keep only its start, so a log of junk can't hold a real secret */
const masked = (scanned: string) => (scanned.length > 12 ? `${scanned.slice(0, 12)}…` : scanned);

export type DoorScan = { result: ScanResult | null; outcome: ScanOutcome };

/** สแกน: looks the ticket up, says whether it may go in at this door, and logs the look */
export async function scanAtDoor(scanned: string, adminId: string, doorEventId: string | null): Promise<DoorScan> {
  const result = await lookupTicket(scanned);
  const outcome: ScanOutcome = !result
    ? "not_found"
    : result.ticket.status === "void"
      ? "void"
      : doorEventId && result.event.id !== doorEventId
        ? "wrong_event"
        : result.ticket.status === "used"
          ? "used"
          : "valid";
  await log({ ticketId: result?.ticket.id, eventId: result?.event.id, doorEventId, scannedBy: adminId, input: result?.ticket.code ?? masked(scanned), result: outcome });
  return { result, outcome };
}

/** ให้เข้างาน: once, and only at its own event's door */
export async function admitAtDoor(ticketId: string, scanned: string, adminId: string, doorEventId: string | null): Promise<DoorScan> {
  const before = await lookupTicket(scanned);
  if (!before || before.ticket.id !== ticketId) return { result: before, outcome: "not_found" };
  if (doorEventId && before.event.id !== doorEventId) return { result: before, outcome: "wrong_event" };
  const admitted = await checkIn(ticketId, adminId);
  const result = await lookupTicket(scanned);
  if (admitted) await log({ ticketId, eventId: before.event.id, doorEventId, scannedBy: adminId, input: before.ticket.code, result: "admitted" });
  return { result, outcome: admitted ? "admitted" : (result?.ticket.status === "used" ? "used" : "void") };
}

/** ยกเลิกการเช็กอิน: a ticket let in by mistake goes back to not-yet-in, and the log says who undid it */
export async function undoCheckIn(ticketId: string, adminId: string): Promise<boolean> {
  const [undone] = await getDb()
    .update(tickets)
    .set({ status: "valid", checkedInAt: null, checkedInBy: null })
    .where(and(eq(tickets.id, ticketId), eq(tickets.status, "used")))
    .returning({ id: tickets.id, code: tickets.code, eventId: tickets.eventId });
  if (undone) await log({ ticketId, eventId: undone.eventId, scannedBy: adminId, input: undone.code, result: "undone" });
  return Boolean(undone);
}

export type DoorEvent = { id: string; title: string; startsAt: string };

/** The events a door can be for: on the site, soonest first, ones over more than a day ago last */
export async function doorEvents(): Promise<DoorEvent[]> {
  const rows = await getDb()
    .select({ id: events.id, title: events.title, startsAt: events.startsAt })
    .from(events)
    .where(inArray(events.status, ["published", "closed"]))
    .orderBy(sql`${events.startsAt} < now() - interval '1 day'`, asc(events.startsAt));
  return rows.map((r) => ({ ...r, startsAt: r.startsAt.toISOString() }));
}

export type DoorStats = { tickets: number; checkedIn: number; people: number; peopleIn: number };

/** How many of an event's tickets have come in, and how many buyers */
export async function doorStats(eventId: string): Promise<DoorStats> {
  const [row] = await getDb()
    .select({
      tickets: sql<number>`count(*) filter (where ${tickets.status} <> 'void')`.mapWith(Number),
      checkedIn: sql<number>`count(*) filter (where ${tickets.status} = 'used')`.mapWith(Number),
      people: sql<number>`count(distinct ${tickets.userId})`.mapWith(Number),
      peopleIn: sql<number>`count(distinct ${tickets.userId}) filter (where ${tickets.status} = 'used')`.mapWith(Number),
    })
    .from(tickets)
    .where(eq(tickets.eventId, eventId));
  return row;
}

export type LogEntry = {
  id: string;
  at: string;
  result: ScanOutcome;
  input: string;
  by: string | null;
  holder: string | null;
  zone: string | null;
  event: string | null;
};

/** The log, newest first: for an event (scans of its tickets, or at its door), or every event */
export async function scanLog(eventId: string | null, limit = 50): Promise<LogEntry[]> {
  const admin = alias(user, "admin");
  const holder = alias(user, "holder");
  const rows = await getDb()
    .select({
      id: scanLogs.id,
      at: scanLogs.createdAt,
      result: scanLogs.result,
      input: scanLogs.input,
      by: admin.name,
      holder: holder.name,
      zone: ticketZones.name,
      event: events.title,
    })
    .from(scanLogs)
    .leftJoin(admin, eq(admin.id, scanLogs.scannedBy))
    .leftJoin(tickets, eq(tickets.id, scanLogs.ticketId))
    .leftJoin(holder, eq(holder.id, tickets.userId))
    .leftJoin(ticketZones, eq(ticketZones.id, tickets.zoneId))
    .leftJoin(events, eq(events.id, scanLogs.eventId))
    .where(eventId ? or(eq(scanLogs.eventId, eventId), eq(scanLogs.doorEventId, eventId)) : undefined)
    .orderBy(desc(scanLogs.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, at: r.at.toISOString(), result: r.result as ScanOutcome }));
}

export type CheckinRow = {
  ticketId: string;
  code: string;
  seq: number;
  status: "valid" | "used" | "void";
  checkedInAt: string | null;
  checkedInBy: string | null;
  zone: string;
  orderCode: string;
  quantity: number;
  holder: { name: string; email: string; phone: string };
};

/** รายชื่อเข้างาน: every ticket of an event with its holder; `q` matches name, email, phone, ticket or order code */
export async function checkinList(
  eventId: string,
  { q = "", state = "all", zoneId = "" }: { q?: string; state?: "all" | "in" | "out"; zoneId?: string } = {},
): Promise<CheckinRow[]> {
  const checker = alias(user, "checker");
  const filters: (SQL | undefined)[] = [eq(tickets.eventId, eventId)];
  if (state === "in") filters.push(eq(tickets.status, "used"));
  if (state === "out") filters.push(eq(tickets.status, "valid"));
  if (zoneId) filters.push(eq(tickets.zoneId, zoneId));
  const term = q.trim();
  if (term) {
    const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(
      or(ilike(user.name, pattern), ilike(user.email, pattern), ilike(user.phone, pattern), ilike(tickets.code, pattern), ilike(orders.code, pattern)),
    );
  }
  const rows = await getDb()
    .select({
      ticketId: tickets.id,
      code: tickets.code,
      seq: tickets.seq,
      status: tickets.status,
      checkedInAt: tickets.checkedInAt,
      checkedInBy: checker.name,
      zone: ticketZones.name,
      orderCode: orders.code,
      quantity: orders.quantity,
      name: user.name,
      email: user.email,
      phone: user.phone,
    })
    .from(tickets)
    .innerJoin(user, eq(user.id, tickets.userId))
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .innerJoin(ticketZones, eq(ticketZones.id, tickets.zoneId))
    .leftJoin(checker, eq(checker.id, tickets.checkedInBy))
    .where(and(...filters))
    // Who came in most recently on top, then everyone not in yet by name
    .orderBy(sql`${tickets.checkedInAt} desc nulls last`, asc(user.name), asc(orders.code), asc(tickets.seq))
    .limit(2000);
  return rows.map((r) => ({
    ticketId: r.ticketId,
    code: r.code,
    seq: r.seq,
    status: r.status as CheckinRow["status"],
    checkedInAt: r.checkedInAt?.toISOString() ?? null,
    checkedInBy: r.checkedInBy,
    zone: r.zone,
    orderCode: r.orderCode,
    quantity: r.quantity,
    holder: { name: r.name, email: r.email, phone: r.phone },
  }));
}
