import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/** The signed-in visitor's session, or null. Once per request however many components ask. */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Where to go after signing in: only a path on this site, so ?next= can't send anyone elsewhere */
export function safeNext(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}
