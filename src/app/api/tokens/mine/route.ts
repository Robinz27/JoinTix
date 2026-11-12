import { connection } from "next/server";
import { myWallets } from "@/lib/orders";
import { getSession } from "@/lib/session";

/** The signed-in account's tokens, ticket by ticket and event by event, for the navbar's token chip */
export async function GET() {
  await connection();
  const session = await getSession();
  if (!session) return Response.json({ events: [] }, { headers: { "Cache-Control": "private, no-store" } });
  return Response.json({ events: await myWallets(session.user.id) }, { headers: { "Cache-Control": "private, no-store" } });
}
