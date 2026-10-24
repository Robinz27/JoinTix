import { neon } from "@neondatabase/serverless";
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
