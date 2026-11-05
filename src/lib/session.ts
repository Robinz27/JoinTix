import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** The signed-in visitor's session, or null. Once per request however many components ask. */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Where to go after signing in: only a path on this site, so ?next= can't send anyone elsewhere */
export function safeNext(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export const ROLES = ["user", "super_admin"] as const;
export type Role = (typeof ROLES)[number];

export function isSuperAdmin(user: { role?: string | null } | null | undefined) {
  return user?.role === "super_admin";
}

/**
 * The session of a super admin, for every page and action under /admin. Signed out goes to log in;
 * anyone else gets a 404, so the back office doesn't show it exists.
 */
export async function requireSuperAdmin(next = "/admin") {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!isSuperAdmin(session.user)) notFound();
  return session;
}
