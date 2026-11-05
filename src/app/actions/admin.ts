"use server";

import { and, desc, eq, gt, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb } from "@/db";
import { orders, session, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ROLES, type Role, requireSuperAdmin } from "@/lib/session";

// หลังบ้าน's member actions (app/admin/users, components/admin/member-actions.tsx). Each one checks for a
// super admin itself: a server action is a public endpoint, whatever page its button sits on.

export type AdminFormState = { ok?: string; error?: string };

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** แก้ไขสมาชิก: name, email, phone, whether the email counts as verified, role, and optionally a new password */
export async function updateMember(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const { user: me, session: mine } = await requireSuperAdmin("/admin/users");
  const id = text(form, "userId");
  const name = text(form, "name");
  const email = text(form, "email").toLowerCase();
  const phone = text(form, "phone").replace(/[\s-]/g, "");
  const password = String(form.get("password") ?? "");
  const emailVerified = form.get("emailVerified") === "1";
  const role = text(form, "role") as Role;
  const self = id === me.id;

  if (!id) return { error: "ไม่พบบัญชีนี้" };
  if (!name || name.length > 100) return { error: "กรอกชื่อ (ไม่เกิน 100 ตัวอักษร)" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "รูปแบบอีเมลไม่ถูกต้อง" };
  if (!/^0\d{8,9}$/.test(phone)) return { error: "เบอร์โทรต้องเป็นตัวเลข 9–10 หลัก ขึ้นต้นด้วย 0" };
  if (password && (password.length < 8 || password.length > 128)) return { error: "รหัสผ่านใหม่ต้องยาว 8–128 ตัวอักษร" };
  // Your own role stays put, so there's always someone who can get back in
  if (!self && !ROLES.includes(role)) return { error: "เลือกสิทธิ์ให้ถูกต้อง" };

  const db = getDb();
  const [taken] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.email, email), ne(user.id, id)))
    .limit(1);
  if (taken) return { error: "อีเมลนี้มีบัญชีอื่นใช้อยู่แล้ว" };

  const [updated] = await db
    .update(user)
    .set({ name, email, phone, emailVerified, ...(self ? {} : { role }) })
    .where(eq(user.id, id))
    .returning({ id: user.id });
  if (!updated) return { error: "ไม่พบบัญชีนี้ อาจถูกลบไปแล้ว" };

  if (password) {
    const ctx = await auth.$context;
    await ctx.internalAdapter.updatePassword(id, await ctx.password.hash(password));
    // Like a password reset: every device signs out (but not the admin's own one, editing themselves)
    await db.delete(session).where(self ? and(eq(session.userId, id), ne(session.id, mine.id)) : eq(session.userId, id));
  }

  refresh();
  return { ok: password ? "บันทึกแล้ว ตั้งรหัสผ่านใหม่และให้ออกจากระบบทุกเครื่องแล้ว" : "บันทึกแล้ว" };
}

export type MemberSession = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeen: string;
  current: boolean;
};

/** อุปกรณ์: the devices a member is signed in on now, most recently used first */
export async function memberSessions(userId: string): Promise<MemberSession[]> {
  const { session: mine } = await requireSuperAdmin("/admin/users");
  const rows = await getDb()
    .select()
    .from(session)
    .where(and(eq(session.userId, userId), gt(session.expiresAt, new Date())))
    .orderBy(desc(session.updatedAt));
  return rows.map((row) => ({
    id: row.id,
    userAgent: row.userAgent,
    ipAddress: row.ipAddress,
    createdAt: row.createdAt.toISOString(),
    lastSeen: row.updatedAt.toISOString(),
    current: row.id === mine.id,
  }));
}

/** Signs one device out, or with no sessionId every device (except the admin's own one) */
export async function signOutMember(userId: string, sessionId?: string): Promise<MemberSession[]> {
  const { session: mine } = await requireSuperAdmin("/admin/users");
  await getDb()
    .delete(session)
    .where(and(eq(session.userId, userId), sessionId ? eq(session.id, sessionId) : undefined, ne(session.id, mine.id)));
  return memberSessions(userId);
}

/** ลบบัญชี for good: the email typed back confirms it. Sessions and the login go with it (ON DELETE CASCADE) */
export async function deleteMember(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const { user: me } = await requireSuperAdmin("/admin/users");
  const id = text(form, "userId");
  if (id === me.id) return { error: "ลบบัญชีของตัวเองไม่ได้" };

  const db = getDb();
  const [target] = await db.select({ email: user.email }).from(user).where(eq(user.id, id)).limit(1);
  if (!target) return { error: "ไม่พบบัญชีนี้ อาจถูกลบไปแล้ว" };
  if (text(form, "confirm").toLowerCase() !== target.email) return { error: "พิมพ์อีเมลให้ตรงเพื่อยืนยัน" };
  // Orders and tickets are kept (they're the record of what was sold), so their owner is too
  const [bought] = await db.select({ id: orders.id }).from(orders).where(eq(orders.userId, id)).limit(1);
  if (bought) return { error: "บัญชีนี้มีประวัติการซื้อบัตร ลบไม่ได้" };

  await db.delete(user).where(eq(user.id, id));
  refresh();
  return { ok: "ลบบัญชีแล้ว" };
}
