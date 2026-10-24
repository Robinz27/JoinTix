import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db";

export async function GET() {
  await connection();
  try {
    const result = await getDb().execute(sql`select now() as now, version() as version`);
    return Response.json({ ok: true, db: result.rows[0] });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
