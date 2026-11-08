import { and, count, desc, eq, gte, ilike, isNull, like, lt, notInArray, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, events } from "@/db/schema";
import { AUDIT_GROUPS, LOG_RANGES, ROUTINE_ACTIONS, isAuditAction, type AuditChange, type LogFilters } from "@/lib/audit-actions";

export { isFiltered, logQuery, type LogFilters } from "@/lib/audit-actions";

// Reading ประวัติการใช้งาน (หลังบ้าน /admin/logs, its CSV, and the ประวัติ of an event or a member). Server only;
// writing is lib/audit.ts.

export const LOGS_PER_PAGE = 50;
/** The most rows one CSV holds; narrow the filters for more */
export const LOGS_CSV_LIMIT = 10_000;

export type LogRow = {
  id: string;
  at: string;
  actor: { id: string | null; name: string; email: string; role: string };
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  eventId: string | null;
  /** The event's title now, if it still exists */
  eventTitle: string | null;
  subjectUserId: string | null;
  changes: AuditChange[];
  details: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** The filters as they came in the URL, with anything malformed dropped */
export function readFilters(params: Record<string, string | string[] | undefined>): LogFilters {
  const one = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value.trim() : "";
  };
  const action = one("action");
  const group = action.startsWith("group:") && AUDIT_GROUPS.some((g) => `group:${g.key}` === action);
  return {
    q: one("q").slice(0, 100) || undefined,
    actor: /^[\w-]{1,64}$/.test(one("actor")) ? one("actor") : undefined,
    user: /^[\w-]{1,64}$/.test(one("user")) ? one("user") : undefined,
    action: group || isAuditAction(action) ? action : undefined,
    eventId: UUID.test(one("event")) ? one("event") : undefined,
    range: LOG_RANGES.find((r) => r.value === one("range"))?.value,
    from: STAMP.test(one("from")) ? one("from") : undefined,
    to: STAMP.test(one("to")) ? one("to") : undefined,
    all: one("all") === "1" || undefined,
  };
}

function where(f: LogFilters): SQL | undefined {
  const parts: (SQL | undefined)[] = [];
  if (f.q) {
    // Escaped, so a % or _ typed in the box matches itself
    const pattern = `%${f.q.replace(/[\\%_]/g, "\\$&")}%`;
    parts.push(
      or(
        ilike(auditLogs.actorName, pattern),
        ilike(auditLogs.actorEmail, pattern),
        ilike(auditLogs.targetLabel, pattern),
        ilike(auditLogs.targetId, pattern),
        ilike(auditLogs.action, pattern),
        ilike(auditLogs.ip, pattern),
        sql`${auditLogs.changes}::text ilike ${pattern}`,
        sql`${auditLogs.details}::text ilike ${pattern}`,
      ),
    );
  }
  if (f.actor === "system") parts.push(and(isNull(auditLogs.actorId), eq(auditLogs.actorRole, "ระบบ")));
  else if (f.actor === "anon") parts.push(and(isNull(auditLogs.actorId), sql`${auditLogs.actorRole} <> 'ระบบ'`));
  else if (f.actor) parts.push(eq(auditLogs.actorId, f.actor));
  if (f.user) parts.push(or(eq(auditLogs.actorId, f.user), eq(auditLogs.subjectUserId, f.user), and(eq(auditLogs.targetType, "user"), eq(auditLogs.targetId, f.user))));
  if (f.action?.startsWith("group:")) {
    const group = f.action.slice(6);
    const prefixes: Record<string, string[]> = {
      auth: ["auth."],
      member: ["member."],
      role: ["role."],
      event: ["event."],
      merch: ["merch.", "shipment."],
      order: ["order."],
      door: ["ticket."],
      token: ["token."],
      shop: ["shop.", "shop_item.", "shop_staff.", "sale."],
      system: ["export.", "outbox."],
    };
    parts.push(or(...(prefixes[group] ?? []).map((prefix) => like(auditLogs.action, `${prefix}%`))));
  } else if (f.action) parts.push(eq(auditLogs.action, f.action));
  // Routine ones stay hidden unless asked for, by "everything" or by picking one of them
  if (!f.all && !(f.action && !f.action.startsWith("group:"))) parts.push(notInArray(auditLogs.action, [...ROUTINE_ACTIONS]));
  if (f.eventId) parts.push(eq(auditLogs.eventId, f.eventId));
  if (f.range === "today") parts.push(sql`${auditLogs.createdAt} >= date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok'`);
  else if (f.range) parts.push(sql`${auditLogs.createdAt} >= now() - ${f.range === "7d" ? sql`interval '7 days'` : sql`interval '30 days'`}`);
  if (f.from && !f.range) parts.push(gte(auditLogs.createdAt, new Date(`${f.from}:00+07:00`)));
  // Up to the end of that minute
  if (f.to && !f.range) parts.push(lt(auditLogs.createdAt, new Date(new Date(`${f.to}:00+07:00`).getTime() + 60_000)));
  return and(...parts);
}

function toRow(row: { log: typeof auditLogs.$inferSelect; eventTitle: string | null }): LogRow {
  const { log } = row;
  return {
    id: log.id,
    at: log.createdAt.toISOString(),
    actor: { id: log.actorId, name: log.actorName, email: log.actorEmail, role: log.actorRole },
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    targetLabel: log.targetLabel,
    eventId: log.eventId,
    eventTitle: row.eventTitle,
    subjectUserId: log.subjectUserId,
    changes: Array.isArray(log.changes) ? (log.changes as AuditChange[]) : [],
    details: log.details && typeof log.details === "object" ? (log.details as Record<string, unknown>) : null,
    ip: log.ip,
    userAgent: log.userAgent,
  };
}

/** One page, newest first, and how many there are in all */
export async function listLogs(filters: LogFilters, page = 1, perPage = LOGS_PER_PAGE): Promise<{ rows: LogRow[]; total: number }> {
  const db = getDb();
  const condition = where(filters);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ log: auditLogs, eventTitle: events.title })
      .from(auditLogs)
      .leftJoin(events, eq(events.id, auditLogs.eventId))
      .where(condition)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(perPage)
      .offset((Math.max(1, page) - 1) * perPage),
    db.select({ total: count() }).from(auditLogs).where(condition),
  ]);
  return { rows: rows.map(toRow), total };
}

export type LogActor = { id: string; name: string; email: string; role: string };

/** The people who appear in the log, the most recently active first: the "who" filter */
export async function logActors(limit = 300): Promise<LogActor[]> {
  const rows = await getDb()
    .select({
      id: sql<string>`${auditLogs.actorId}`,
      name: sql<string>`(array_agg(${auditLogs.actorName} order by ${auditLogs.createdAt} desc))[1]`,
      email: sql<string>`(array_agg(${auditLogs.actorEmail} order by ${auditLogs.createdAt} desc))[1]`,
      role: sql<string>`(array_agg(${auditLogs.actorRole} order by ${auditLogs.createdAt} desc))[1]`,
    })
    .from(auditLogs)
    .where(sql`${auditLogs.actorId} is not null`)
    .groupBy(auditLogs.actorId)
    .orderBy(sql`max(${auditLogs.createdAt}) desc`)
    .limit(limit);
  return rows;
}

/** The figures over the log page: what staff changed today, failed logins today, and people at work today */
export async function logStats(): Promise<{ staffEdits: number; failedLogins: number; people: number }> {
  const [row] = await getDb()
    .select({
      staffEdits: sql<number>`count(*) filter (where ${auditLogs.actorRole} not in ('ลูกค้า', 'ระบบ', 'ไม่ได้เข้าสู่ระบบ') and ${auditLogs.action} not in (${sql.join(ROUTINE_ACTIONS.map((action) => sql`${action}`), sql`, `)}))`.mapWith(Number),
      failedLogins: sql<number>`count(*) filter (where ${auditLogs.action} = 'auth.login_failed')`.mapWith(Number),
      people: sql<number>`count(distinct ${auditLogs.actorId})`.mapWith(Number),
    })
    .from(auditLogs)
    .where(sql`${auditLogs.createdAt} >= date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok'`);
  return row;
}
