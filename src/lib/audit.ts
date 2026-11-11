import { eq, sql, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { adminRoles, auditLogs, user } from "@/db/schema";
import type { AuditAction, AuditChange } from "@/lib/audit-actions";
import { getAdminAccess, getSession } from "@/lib/session";

// ประวัติการใช้งาน (หลังบ้าน /admin/logs): the one way anything writes to audit_logs. Server only.
//
// - `auditQuery()` gives the insert to put in the same db.batch as the change, so the two land together or not at
//   all; with `when`, the row is only written if that SQL is true inside the transaction (an order really made).
// - `audit()` writes on its own, for changes that aren't one batch. It never throws: a log that fails mustn't
//   undo what the person did.
//
// Who did it is the signed-in visitor unless told otherwise; "system" for what nobody pressed. Their name, email
// and role are copied in, with the IP and browser the request came from.
// Never logged: passwords, tokens, OTPs, QR secrets. scrub() takes out any key that sounds like one.

export type AuditActor = { id: string | null; name: string; email: string; role: string };

export const SYSTEM_ACTOR: AuditActor = { id: null, name: "ระบบ", email: "", role: "ระบบ" };

export type AuditEntry = {
  action: AuditAction;
  target?: { type: string; id?: string | null; label?: string | null };
  /** The event it belongs to, for the event's ประวัติ tab */
  eventId?: string | null;
  /** The customer it was about, for their ประวัติ */
  subjectUserId?: string | null;
  changes?: AuditChange[];
  details?: Record<string, unknown>;
  /** Default: whoever is signed in. "system" for jobs, or someone known some other way (signing up, a failed login) */
  actor?: AuditActor | "system" | null;
  /** The request's headers when next/headers can't reach them (Better Auth's own routes pass theirs) */
  requestHeaders?: Headers | null;
};

export type AuditRow = typeof auditLogs.$inferInsert;

// `token$`, not `token`: a key that *is* a token (token, resetToken) goes, while the event's tokens (tokens, tokenPrice) stay
const SECRET_KEY = /pass(word)?|token$|secret|otp|hash|cookie|authorization/i;

/** A copy with nothing secret in it: keys like `password` go, and a QR's content is never kept */
function scrub<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString() as T;
  if (typeof value === "string") return (value.startsWith("JTX1.") ? "[QR]" : value.length > 2000 ? `${value.slice(0, 2000)}…` : value) as T;
  if (Array.isArray(value)) return value.map(scrub) as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) if (!SECRET_KEY.test(key)) out[key] = scrub(inner);
    return out as T;
  }
  return value;
}

/** The role a person is shown with in the log */
export async function roleLabel(person: { role?: string | null; adminRoleId?: string | null }): Promise<string> {
  if (person.role === "super_admin") return "Super admin";
  if (person.adminRoleId) {
    const [row] = await getDb().select({ name: adminRoles.name }).from(adminRoles).where(eq(adminRoles.id, person.adminRoleId)).limit(1);
    if (row) return row.name;
  }
  return "ลูกค้า";
}

/** An account as an actor, found by id (Better Auth's hooks know only that) */
export async function actorById(userId: string): Promise<AuditActor | null> {
  const [row] = await getDb().select({ id: user.id, name: user.name, email: user.email, role: user.role, adminRoleId: user.adminRoleId }).from(user).where(eq(user.id, userId)).limit(1);
  return row ? { id: row.id, name: row.name, email: row.email, role: await roleLabel(row) } : null;
}

/** Whoever is signed in on this request, or null */
async function currentActor(): Promise<AuditActor | null> {
  try {
    const session = await getSession();
    if (!session) return null;
    const access = await getAdminAccess();
    return { id: session.user.id, name: session.user.name, email: session.user.email, role: access?.roleName ?? "ลูกค้า" };
  } catch {
    return null;
  }
}

/** Where the request came from: the first address a proxy saw, and the browser */
async function origin(given?: Headers | null): Promise<{ ip: string | null; userAgent: string | null }> {
  let h = given ?? null;
  if (!h) {
    try {
      h = await headers();
    } catch {
      // Not in a request (a background job): nowhere to tell
      return { ip: null, userAgent: null };
    }
  }
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip") || h.get("cf-connecting-ip") || null;
  return { ip: ip?.slice(0, 64) ?? null, userAgent: h.get("user-agent")?.slice(0, 400) ?? null };
}

/** The row an entry becomes */
export async function auditRow(entry: AuditEntry): Promise<AuditRow> {
  const system = entry.actor === "system";
  const actor: AuditActor | null = entry.actor === "system" ? SYSTEM_ACTOR : entry.actor === undefined ? await currentActor() : entry.actor;
  const { ip, userAgent } = system && !entry.requestHeaders ? { ip: null, userAgent: null } : await origin(entry.requestHeaders);
  const changes = entry.changes?.length ? scrub(entry.changes) : null;
  const details = entry.details && Object.keys(entry.details).length ? scrub(entry.details) : null;
  return {
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? "",
    actorEmail: actor?.email ?? "",
    actorRole: actor?.role ?? "ไม่ได้เข้าสู่ระบบ",
    action: entry.action,
    targetType: entry.target?.type ?? "",
    targetId: entry.target?.id ?? "",
    targetLabel: (entry.target?.label ?? "").slice(0, 300),
    eventId: entry.eventId ?? null,
    subjectUserId: entry.subjectUserId ?? null,
    changes,
    details,
    ip,
    userAgent,
  };
}

/**
 * The insert, to run in the same db.batch as the change: `db.batch([change, ...(await auditQuery(entry))])`. With `when`, written only if that condition holds inside
 * the transaction, e.g. `exists (select 1 from orders where id = …)` for an order that may not have been made.
 */
export async function auditQuery(entry: AuditEntry, when?: SQL): Promise<[BatchItem<"pg">]> {
  const row = await auditRow(entry);
  const db = getDb();
  // In a one-item array: returned bare from an async function, a query would be awaited, which runs it on its own
  if (!when) return [db.insert(auditLogs).values(row)];
  const json = (value: unknown) => (value === null || value === undefined ? null : JSON.stringify(value));
  const statement = db.execute(sql`
    insert into ${auditLogs} (actor_id, actor_name, actor_email, actor_role, action, target_type, target_id, target_label, event_id, subject_user_id, changes, details, ip, user_agent)
    select ${row.actorId ?? null}, ${row.actorName}, ${row.actorEmail}, ${row.actorRole}, ${row.action}, ${row.targetType}, ${row.targetId}, ${row.targetLabel},
      ${row.eventId ?? null}::uuid, ${row.subjectUserId ?? null}, ${json(row.changes)}::jsonb, ${json(row.details)}::jsonb, ${row.ip ?? null}, ${row.userAgent ?? null}
    where ${when}`);
  return [statement as unknown as BatchItem<"pg">];
}

/** Writes one row on its own; never throws */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await getDb().insert(auditLogs).values(await auditRow(entry));
  } catch (error) {
    console.error("[audit] could not write", entry.action, error);
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(scrub(a) ?? null) === JSON.stringify(scrub(b) ?? null);

/**
 * Before → after of the fields named in `labels`, only those that changed. `prefix` names what they belong to
 * when it isn't the target itself ("โซน VIP › ราคา"). Without `before`, everything given counts as new.
 */
export function changesOf<T extends Record<string, unknown>>(
  before: Partial<T> | null | undefined,
  after: Partial<T> | null | undefined,
  labels: Partial<Record<keyof T & string, string>>,
  prefix?: { field: string; label: string },
): AuditChange[] {
  const out: AuditChange[] = [];
  for (const [field, label] of Object.entries(labels) as [keyof T & string, string][]) {
    if (!label) continue;
    const from = before ? before[field] ?? null : null;
    const to = after ? after[field] ?? null : null;
    if (same(from, to)) continue;
    out.push({
      field: prefix ? `${prefix.field}.${field}` : field,
      label: prefix ? `${prefix.label} › ${label}` : label,
      from: scrub(from),
      to: scrub(to),
    });
  }
  return out;
}
