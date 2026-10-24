"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { safeNext } from "@/lib/session";

export type LoginState = { error?: string; email?: string };
export type SignupState = { error?: string; name?: string; email?: string; phone?: string };
export type ForgotState = { error?: string; sentTo?: string };
export type ResetState = { error?: string };

// Better Auth's error codes, in words a visitor can act on
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  USER_ALREADY_EXISTS: "อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทน",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทน",
  INVALID_EMAIL: "รูปแบบอีเมลไม่ถูกต้อง",
  PASSWORD_TOO_SHORT: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร",
  PASSWORD_TOO_LONG: "รหัสผ่านยาวเกินไป",
  INVALID_TOKEN: "ลิงก์รีเซ็ตรหัสผ่านนี้หมดอายุหรือถูกใช้ไปแล้ว ขอลิงก์ใหม่อีกครั้ง",
};

function messageFor(error: unknown) {
  if (error instanceof APIError) {
    const code = (error.body as { code?: string } | undefined)?.code;
    if (code && MESSAGES[code]) return MESSAGES[code];
    if (error.status === "TOO_MANY_REQUESTS") return "ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่";
  }
  console.error("[auth]", error);
  return "ระบบขัดข้อง ลองใหม่อีกครั้ง";
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function signIn(_: LoginState, form: FormData): Promise<LoginState> {
  const email = text(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "กรอกอีเมลและรหัสผ่าน", email };

  try {
    await auth.api.signInEmail({
      body: { email, password, rememberMe: form.get("remember") === "on" },
      headers: await headers(),
    });
  } catch (error) {
    return { error: messageFor(error), email };
  }
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: SignupState, form: FormData): Promise<SignupState> {
  const name = text(form, "name");
  const email = text(form, "email").toLowerCase();
  // Dashes and spaces are fine to type; the number is kept as digits only
  const phone = text(form, "phone").replace(/[\s-]/g, "");
  const password = String(form.get("password") ?? "");
  const back = { name, email, phone };

  if (name.length < 2) return { ...back, error: "กรอกชื่อ-นามสกุลอย่างน้อย 2 ตัวอักษร" };
  if (!/^0\d{8,9}$/.test(phone)) return { ...back, error: "เบอร์โทรต้องเป็นตัวเลข 9–10 หลัก ขึ้นต้นด้วย 0" };
  if (password.length < 8) return { ...back, error: MESSAGES.PASSWORD_TOO_SHORT };
  if (password !== String(form.get("confirm") ?? "")) return { ...back, error: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" };

  try {
    await auth.api.signUpEmail({ body: { name, email, password, phone }, headers: await headers() });
  } catch (error) {
    return { ...back, error: messageFor(error) };
  }
  redirect(safeNext(form.get("next")));
}

/**
 * ลืมรหัสผ่าน: asks Better Auth to email a reset link. The answer is the same whether or not the address
 * has an account, so the form can't be used to find out who has one.
 */
export async function requestPasswordReset(_: ForgotState, form: FormData): Promise<ForgotState> {
  const email = text(form, "email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: MESSAGES.INVALID_EMAIL };

  try {
    // The emailed link checks the token, then lands on /reset-password?token=… (or ?error=INVALID_TOKEN)
    await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" }, headers: await headers() });
  } catch (error) {
    return { error: messageFor(error) };
  }
  return { sentTo: email };
}

export async function resetPassword(_: ResetState, form: FormData): Promise<ResetState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (!token) return { error: MESSAGES.INVALID_TOKEN };
  if (password.length < 8) return { error: MESSAGES.PASSWORD_TOO_SHORT };
  if (password !== String(form.get("confirm") ?? "")) return { error: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" };

  try {
    await auth.api.resetPassword({ body: { newPassword: password, token }, headers: await headers() });
  } catch (error) {
    return { error: messageFor(error) };
  }
  redirect("/login?reset=1");
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}
