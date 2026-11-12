import { connection } from "next/server";
import { getSession } from "@/lib/session";
import { myShops } from "@/lib/shops";

/** Whether the signed-in account belongs to a shop, so the account menu knows to show ร้านของฉัน */
export async function GET() {
  await connection();
  const session = await getSession();
  if (!session) return Response.json({ hasShop: false });
  return Response.json({ hasShop: (await myShops(session.user.id)).length > 0 });
}
