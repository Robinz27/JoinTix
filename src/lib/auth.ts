import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { actorById, audit, roleLabel, type AuditEntry } from "@/lib/audit";
import { resetPasswordMail, sendMail, verifyEmailCodeMail, verifyEmailLinkMail } from "@/lib/mail";

/** The headers of the request a Better Auth hook runs in, so the log knows the IP and browser */
type HookContext = { request?: Request; headers?: Headers; path?: string } | null;
const hookHeaders = (ctx: HookContext) => ctx?.request?.headers ?? ctx?.headers ?? null;
/** Logged from inside Better Auth, without holding up its answer */
const auditFromAuth = (entry: AuditEntry) => void audit(entry);

/**
 * Better Auth: email + password accounts with a phone number, sessions in Postgres (src/db/schema.ts).
 * Needs BETTER_AUTH_SECRET (signs the session cookie) and BETTER_AUTH_URL in .env.local; RESEND_API_KEY to
 * really send the password reset and email verification mails.
 */
export const auth = betterAuth({
  // The quick tunnel to the dev server (next.config.ts), so signing out and verifying an email work through it.
  // Dev only: on a real deployment anyone can get a trycloudflare.com address.
  // TRUSTED_ORIGINS in .env.local (comma separated, e.g. https://jointix.4tunez.cloud) adds the site's own
  // domains when it's served from somewhere other than BETTER_AUTH_URL, such as a named Cloudflare tunnel
  trustedOrigins: [
    ...(process.env.NODE_ENV === "development" ? ["https://*.trycloudflare.com"] : []),
    ...(process.env.TRUSTED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean),
  ],
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
    sendResetPassword: async ({ user, url }, request) => {
      auditFromAuth({
        action: "auth.password_reset_requested",
        actor: { id: user.id, name: user.name, email: user.email, role: await roleLabel(user as { role?: string; adminRoleId?: string | null }) },
        target: { type: "user", id: user.id, label: user.email },
        subjectUserId: user.id,
        requestHeaders: request?.headers,
      });
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
    sendVerificationEmail: async ({ user, url }, request) => {
      auditFromAuth({
        action: "auth.verification_sent",
        actor: { id: user.id, name: user.name, email: user.email, role: await roleLabel(user as { role?: string; adminRoleId?: string | null }) },
        target: { type: "user", id: user.id, label: user.email },
        subjectUserId: user.id,
        details: { method: "ลิงก์ทางอีเมล" },
        requestHeaders: request?.headers,
      });
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
      // รุ่น for a reunion; optional, so the site still suits an event that isn't one
      cohort: { type: "string", required: false, defaultValue: "", input: true },
      // input: false, so nobody can sign up as an admin; only a super admin changes it (app/admin/users)
      role: { type: "string", required: false, defaultValue: "user", input: false },
      // Staff's role (admin_roles): here only so the navbar knows to link to หลังบ้าน. What it allows is read
      // fresh on each request (getAdminAccess in lib/session.ts)
      adminRoleId: { type: "string", required: false, input: false },
    },
  },
  // ประวัติการใช้งาน (lib/audit.ts): signing up, signing in and out, and verifying an email, as Better Auth does them,
  // whichever page or route asked. A failed login and the password reset are logged in app/actions/auth.ts
  databaseHooks: {
    user: {
      create: {
        after: async (user, ctx) =>
          auditFromAuth({
            action: "auth.signup",
            actor: { id: user.id, name: user.name, email: user.email, role: "ลูกค้า" },
            target: { type: "user", id: user.id, label: user.email },
            subjectUserId: user.id,
            details: { name: user.name, email: user.email, phone: (user as { phone?: string }).phone },
            requestHeaders: hookHeaders(ctx),
          }),
      },
      update: {
        // Better Auth only updates an account itself here to verify its email (the profile can't be edited yet)
        after: async (user, ctx) => {
          if (ctx?.path !== "/verify-email" && ctx?.path !== "/email-otp/verify-email") return;
          auditFromAuth({
            action: "auth.email_verified",
            actor: await actorById(user.id),
            target: { type: "user", id: user.id, label: user.email },
            subjectUserId: user.id,
            changes: [{ field: "emailVerified", label: "ยืนยันอีเมลแล้ว", from: false, to: true }],
            details: { method: ctx.path === "/verify-email" ? "ลิงก์ทางอีเมล" : "รหัส 6 หลัก" },
            requestHeaders: hookHeaders(ctx),
          });
        },
      },
    },
    session: {
      create: {
        after: async (session, ctx) => {
          // Signing up signs in too; that one is the sign-up's row
          if (ctx?.path !== "/sign-in/email") return;
          auditFromAuth({
            action: "auth.login",
            actor: await actorById(session.userId),
            target: { type: "user", id: session.userId },
            subjectUserId: session.userId,
            details: { rememberMe: (ctx.body as { rememberMe?: boolean } | undefined)?.rememberMe ?? true, sessionExpiresAt: session.expiresAt },
            requestHeaders: hookHeaders(ctx),
          });
        },
      },
      delete: {
        after: async (session, ctx) => {
          if (ctx?.path !== "/sign-out") return;
          auditFromAuth({
            action: "auth.logout",
            actor: await actorById(session.userId),
            target: { type: "user", id: session.userId },
            subjectUserId: session.userId,
            details: { signedInAt: session.createdAt },
            requestHeaders: hookHeaders(ctx),
          });
        },
      },
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
        // The code itself is never logged
        auditFromAuth({ action: "auth.verification_sent", target: { type: "user", label: email }, details: { method: "รหัส 6 หลัก", email } });
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
