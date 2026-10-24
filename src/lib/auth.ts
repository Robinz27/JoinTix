import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db";
import * as schema from "@/db/schema";

/**
 * Better Auth: email + password accounts with a phone number, sessions in Postgres (src/db/schema.ts).
 * Needs BETTER_AUTH_SECRET (signs the session cookie) and BETTER_AUTH_URL in .env.local.
 */
export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema,
    // Neon's HTTP driver (src/db/index.ts) can't hold a transaction open across queries
    transaction: false,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Signed in straight after signing up
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      phone: { type: "string", required: true, input: true },
    },
  },
  session: {
    // 30 days, renewed once a day while in use
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  // Lets server actions (app/actions/auth.ts) set the session cookie; must stay the last plugin
  plugins: [nextCookies()],
});

export type SessionUser = typeof auth.$Infer.Session.user;
