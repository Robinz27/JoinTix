import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { resetPasswordMail, sendMail, verifyEmailCodeMail, verifyEmailLinkMail } from "@/lib/mail";

/**
 * Better Auth: email + password accounts with a phone number, sessions in Postgres (src/db/schema.ts).
 * Needs BETTER_AUTH_SECRET (signs the session cookie) and BETTER_AUTH_URL in .env.local; RESEND_API_KEY to
 * really send the password reset and email verification mails.
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
  // ยืนยันอีเมล by link, from the profile page (app/profile): opening it marks the email verified and lands
  // back on /profile. Not sent at sign-up, and not needed to sign in; only buying tickets asks for it.
  emailVerification: {
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      void sendMail({ to: user.email, ...verifyEmailLinkMail(user.name, url) }).catch((error) =>
        console.error("[auth] sending the verification link failed", error),
      );
    },
  },
  // Plugin routes we don't use: the code is only for verifying the email, not for signing in or resetting
  disabledPaths: [
    "/sign-in/email-otp",
    "/forget-password/email-otp",
    "/email-otp/request-password-reset",
    "/email-otp/reset-password",
    "/email-otp/request-email-change",
    "/email-otp/change-email",
  ],
  user: {
    additionalFields: {
      phone: { type: "string", required: true, input: true },
      // input: false, so nobody can sign up as an admin; only a super admin changes it (app/admin/users)
      role: { type: "string", required: false, defaultValue: "user", input: false },
    },
  },
  session: {
    // 30 days, renewed once a day while in use
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    // ยืนยันอีเมล by a 6-digit code typed on the event page (components/ticket-panel.tsx): 10 minutes, 5 tries
    emailOTP({
      expiresIn: 60 * 10,
      allowedAttempts: 5,
      storeOTP: "hashed",
      disableSignUp: true,
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "email-verification") return;
        void sendMail({ to: email, ...verifyEmailCodeMail(otp) }).catch((error) =>
          console.error("[auth] sending the verification code failed", error),
        );
      },
    }),
    // Lets server actions (app/actions/auth.ts) set the session cookie; must stay the last plugin
    nextCookies(),
  ],
});

export type SessionUser = typeof auth.$Infer.Session.user;
