import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tokenTransactions } from "@/db/schema";
import { isKnownSlip } from "@/lib/payments";
import { can } from "@/lib/permissions";
import { getAdminAccess } from "@/lib/session";
import { readPrivateUpload } from "@/lib/uploads";

// /admin/slips/<file>.webp — a transfer slip (lib/uploads.ts keeps them out of the public /uploads route). Only staff
// who check payments see checkout slips; the top-up desk's slip photos also to those who top up or correct tokens.

export async function GET(_: Request, { params }: RouteContext<"/admin/slips/[...path]">) {
  const { path } = await params;
  const stored = `/uploads/images/slips/${path.join("/")}`;
  const access = await getAdminAccess();
  const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  if (!access || path.length !== 1) return notFound();

  const allowed =
    (can(access, "payments.review") && (await isKnownSlip(stored))) ||
    ((can(access, "tokens.topup") || can(access, "tokens.adjust")) &&
      (await getDb().select({ id: tokenTransactions.id }).from(tokenTransactions).where(and(eq(tokenTransactions.slip, stored))).limit(1)).length > 0);
  if (!allowed) return notFound();

  const file = await readPrivateUpload(stored);
  if (!file) return notFound();
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(file.length),
      // Someone's bank details: never kept by a shared cache
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
