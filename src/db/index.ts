import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  return drizzle({ client: neon(process.env.DATABASE_URL), schema });
}

let instance: ReturnType<typeof createDb> | undefined;

// Created lazily so `next build` works without database credentials.
export function getDb() {
  instance ??= createDb();
  return instance;
}

/** Whether the database answers a trivial query, and why not if it doesn't. */
export async function checkConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getDb().execute(sql`select 1`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
