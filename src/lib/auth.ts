import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { resetPasswordMail, sendMail } from "@/lib/mail";

/**
 * Better Auth: email + password accounts with a phone number, sessions in Postgres (src/db/schema.ts).
 * Needs BETTER_AUTH_SECRET (signs the session cookie) and BETTER_AUTH_URL in .env.local; RESEND_API_KEY to
 * really send the password reset email.
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
    // ลืมรหัสผ่าน: the link goes out by email (lib/mail.ts) and works once, for an hour
    resetPasswordTokenExpiresIn: 60 * 60,
    // A reset signs out every other device, in case someone else had the password
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // Not awaited: the answer comes back just as fast whether or not the address has an account
      void sendMail({ to: user.email, ...resetPasswordMail(user.name, url) }).catch((error) =>
        console.error("[auth] sending the password reset email failed", error),
      );
    },
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
