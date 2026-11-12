import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { events, orders, scanLogs, ticketZones, tickets, user } from "@/db/schema";
import { audit } from "@/lib/audit";
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

const OUTCOME_TH: Record<ScanOutcome, string> = {
  valid: "บัตรใช้ได้",
  used: "บัตรเคยเข้างานแล้ว",
  not_found: "ไม่พบบัตร",
  void: "บัตรถูกยกเลิก",
  wrong_event: "ผิดงาน",
  admitted: "ให้เข้างานแล้ว",
  undone: "ยกเลิกเช็กอินแล้ว",
};

/** The same look in ประวัติการใช้งาน, with who the ticket belongs to */
function auditDoor(action: "ticket.scan" | "ticket.admit" | "ticket.undo_admit" | "ticket.reenter", outcome: ScanOutcome, result: ScanResult | null, input: string, doorEventId: string | null) {
  return audit({
    action,
    target: { type: "ticket", id: result?.ticket.id ?? "", label: result?.ticket.code ?? input },
    eventId: result?.event.id ?? doorEventId,
    subjectUserId: result?.holder.id,
    details: {
      result: OUTCOME_TH[outcome],
      ...(result && {
        attendee: `${[result.attendee.firstName, result.attendee.lastName].filter(Boolean).join(" ")} <${result.attendee.email}>`,
        buyer: `${result.holder.name} <${result.holder.email}>`,
        zone: result.zone.name,
        order: result.order.code,
        event: result.event.title,
      }),
      ...(doorEventId && doorEventId !== result?.event.id && { doorEventId }),
    },
  });
}

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
  const input = result?.ticket.code ?? masked(scanned);
  await Promise.all([log({ ticketId: result?.ticket.id, eventId: result?.event.id, doorEventId, scannedBy: adminId, input, result: outcome }), auditDoor("ticket.scan", outcome, result, input, doorEventId)]);
  return { result, outcome };
}

/**
 * ให้เข้างาน: once, and only at its own event's door. An event that lets people back in (events.allow_reentry) admits a
 * used ticket again: logged as a re-entry, the first check-in time kept
 */
export async function admitAtDoor(ticketId: string, scanned: string, adminId: string, doorEventId: string | null): Promise<DoorScan> {
  const before = await lookupTicket(scanned);
  if (!before || before.ticket.id !== ticketId) return { result: before, outcome: "not_found" };
  if (doorEventId && before.event.id !== doorEventId) return { result: before, outcome: "wrong_event" };
  if (before.ticket.status === "used" && before.allowReentry) {
    await Promise.all([
      log({ ticketId, eventId: before.event.id, doorEventId, scannedBy: adminId, input: before.ticket.code, result: "admitted" }),
      auditDoor("ticket.reenter", "admitted", before, before.ticket.code, doorEventId),
    ]);
    return { result: before, outcome: "admitted" };
  }
  const admitted = await checkIn(ticketId, adminId);
  const result = await lookupTicket(scanned);
  if (admitted)
    await Promise.all([
      log({ ticketId, eventId: before.event.id, doorEventId, scannedBy: adminId, input: before.ticket.code, result: "admitted" }),
      auditDoor("ticket.admit", "admitted", result ?? before, before.ticket.code, doorEventId),
    ]);
  return { result, outcome: admitted ? "admitted" : (result?.ticket.status === "used" ? "used" : "void") };
}

/** ยกเลิกการเช็กอิน: a ticket let in by mistake goes back to not-yet-in, and the log says who undid it */
export async function undoCheckIn(ticketId: string, adminId: string): Promise<boolean> {
  const [undone] = await getDb()
    .update(tickets)
    .set({ status: "valid", checkedInAt: null, checkedInBy: null })
    .where(and(eq(tickets.id, ticketId), eq(tickets.status, "used")))
    .returning({ id: tickets.id, code: tickets.code, eventId: tickets.eventId });
  if (undone) {
    const result = await lookupTicket(undone.code);
    await Promise.all([log({ ticketId, eventId: undone.eventId, scannedBy: adminId, input: undone.code, result: "undone" }), auditDoor("ticket.undo_admit", "undone", result, undone.code, null)]);
  }
  return Boolean(undone);
}

export type DoorEvent = { id: string; title: string; startsAt: string; venue: string; poster: string };

/** The events a door can be for: on the site, soonest first, ones over more than a day ago last */
export async function doorEvents(): Promise<DoorEvent[]> {
  const rows = await getDb()
    .select({ id: events.id, title: events.title, startsAt: events.startsAt, venue: events.venue, poster: events.poster })
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
      // A person is who the ticket is for (by their email), or the buyer for tickets bought before that was asked
      people: sql<number>`count(distinct coalesce(nullif(lower(${tickets.attendeeEmail}), ''), ${tickets.userId}))`.mapWith(Number),
      peopleIn: sql<number>`count(distinct coalesce(nullif(lower(${tickets.attendeeEmail}), ''), ${tickets.userId})) filter (where ${tickets.status} = 'used')`.mapWith(Number),
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
      holder: sql<string | null>`coalesce(nullif(trim(${tickets.attendeeFirstName} || ' ' || ${tickets.attendeeLastName}), ''), ${holder.name})`,
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
  orderId: string;
  orderCode: string;
  quantity: number;
  event: { id: string; title: string };
  /** Who the ticket is for (as the buyer typed it); the phone is the buyer's, the only one asked for */
  holder: { name: string; email: string; phone: string };
  /** The account that bought it, when it isn't the same person */
  buyer: { name: string; email: string } | null;
};

/**
 * รายชื่อเข้างาน: every ticket with its holder; `q` matches name, email, phone, ticket or order code. For one
 * event, or with null across all of them (ค้นหาผู้ลงทะเบียน)
 */
export async function checkinList(
  eventId: string | null,
  { q = "", state = "all", zoneId = "" }: { q?: string; state?: "all" | "in" | "out"; zoneId?: string } = {},
): Promise<CheckinRow[]> {
  const checker = alias(user, "checker");
  const filters: (SQL | undefined)[] = [eventId ? eq(tickets.eventId, eventId) : undefined];
  if (state === "in") filters.push(eq(tickets.status, "used"));
  if (state === "out") filters.push(eq(tickets.status, "valid"));
  if (zoneId) filters.push(eq(tickets.zoneId, zoneId));
  const term = q.trim();
  if (term) {
    const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(
      or(
        ilike(sql`${tickets.attendeeFirstName} || ' ' || ${tickets.attendeeLastName}`, pattern),
        ilike(tickets.attendeeEmail, pattern),
        ilike(user.name, pattern),
        ilike(user.email, pattern),
        ilike(user.phone, pattern),
        ilike(tickets.code, pattern),
        ilike(orders.code, pattern),
      ),
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
      orderId: orders.id,
      orderCode: orders.code,
      quantity: orders.quantity,
      eventId: events.id,
      eventTitle: events.title,
      first: tickets.attendeeFirstName,
      last: tickets.attendeeLastName,
      attendeeEmail: tickets.attendeeEmail,
      name: user.name,
      email: user.email,
      phone: user.phone,
    })
    .from(tickets)
    .innerJoin(user, eq(user.id, tickets.userId))
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .innerJoin(events, eq(events.id, tickets.eventId))
    .innerJoin(ticketZones, eq(ticketZones.id, tickets.zoneId))
    .leftJoin(checker, eq(checker.id, tickets.checkedInBy))
    .where(and(...filters))
    // Who came in most recently on top, then everyone not in yet by name
    .orderBy(sql`${tickets.checkedInAt} desc nulls last`, asc(tickets.attendeeFirstName), asc(user.name), asc(orders.code), asc(tickets.seq))
    .limit(2000);
  return rows.map((r) => ({
    ticketId: r.ticketId,
    code: r.code,
    seq: r.seq,
    status: r.status as CheckinRow["status"],
    checkedInAt: r.checkedInAt?.toISOString() ?? null,
    checkedInBy: r.checkedInBy,
    zone: r.zone,
    orderId: r.orderId,
    orderCode: r.orderCode,
    quantity: r.quantity,
    event: { id: r.eventId, title: r.eventTitle },
    holder: { name: [r.first, r.last].filter(Boolean).join(" ") || r.name, email: r.attendeeEmail || r.email, phone: r.phone },
    buyer: (r.attendeeEmail || r.email).toLowerCase() === r.email.toLowerCase() ? null : { name: r.name, email: r.email },
  }));
}
