import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { adminRoles, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { canAny, type AdminAccess, type Permission } from "@/lib/permissions";

/** The signed-in visitor's session, or null. Once per request however many components ask. */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Where to go after signing in: only a path on this site, so ?next= can't send anyone elsewhere */
export function safeNext(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function isSuperAdmin(user: { role?: string | null } | null | undefined) {
  return user?.role === "super_admin";
}

/**
 * What the signed-in account may do in หลังบ้าน. Read from the database on every request rather than kept
 * in the session, so changing a role takes effect at once. null: not signed in, or not staff.
 */
export const getAdminAccess = cache(async (): Promise<AdminAccess | null> => {
  const session = await getSession();
  if (!session) return null;
  if (isSuperAdmin(session.user)) return { superAdmin: true, roleName: "Super admin", permissions: [] };
  const [row] = await getDb()
    .select({ name: adminRoles.name, permissions: adminRoles.permissions })
    .from(user)
    .innerJoin(adminRoles, eq(adminRoles.id, user.adminRoleId))
    .where(eq(user.id, session.user.id))
    .limit(1);
  return row ? { superAdmin: false, roleName: row.name, permissions: row.permissions } : null;
});

/**
 * Signed out goes to log in; signed in without the right gets a 404, so หลังบ้าน doesn't show it exists.
 * Every page and action under /admin goes through one of the three below: a server action is a public
 * endpoint, whatever page its button sits on.
 */
async function requireAccess(next: string, allowed: (access: AdminAccess) => boolean) {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  const access = await getAdminAccess();
  if (!access || !allowed(access)) notFound();
  return { ...session, access };
}

/** Anyone with a place in หลังบ้าน at all */
export const requireStaff = (next = "/admin") => requireAccess(next, () => true);

/** Staff whose role allows any one of `permissions` (a super admin always passes) */
export const requirePermission = (permissions: Permission | readonly Permission[], next = "/admin") =>
  requireAccess(next, (access) => canAny(access, typeof permissions === "string" ? [permissions] : permissions));

/** Roles, and who has them, stay with the super admin: anyone else could hand themselves everything */
export const requireSuperAdmin = (next = "/admin") => requireAccess(next, (access) => access.superAdmin);
