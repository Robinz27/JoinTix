"use server";

import { and, desc, eq, gt, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { adminRoles, orders, session, user } from "@/db/schema";
import { audit, auditQuery, changesOf, roleLabel } from "@/lib/audit";
import { auth } from "@/lib/auth";
import type { AdminAccess } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { isUuid } from "@/lib/uuid";
import { formText, type AdminFormState } from "@/lib/form";

// หลังบ้าน's member actions (app/admin/users, components/admin/member-actions.tsx). Each one checks the
// permission itself: a server action is a public endpoint, whatever page its button sits on.
//
// จัดการสมาชิก reaches customers only. Staff accounts stay with the super admin, otherwise someone with this
// permission could set a super admin's password and sign in as them.



/** Whether this account may touch that member */
async function mayTouch(access: AdminAccess, memberId: string) {
  if (access.superAdmin) return true;
  const [member] = await getDb().select({ role: user.role, adminRoleId: user.adminRoleId }).from(user).where(eq(user.id, memberId)).limit(1);
  return Boolean(member) && member.role !== "super_admin" && !member.adminRoleId;
}

const NOT_YOURS = "บัญชีทีมงานแก้ได้เฉพาะ Super admin";

/** แก้ไขสมาชิก: name, email, phone, whether the email counts as verified, role, and optionally a new password */
export async function updateMember(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const { user: me, session: mine, access } = await requirePermission("members.manage", "/admin/users");
  const id = formText(form, "userId");
  const name = formText(form, "name");
  const email = formText(form, "email").toLowerCase();
  const phone = formText(form, "phone").replace(/[\s-]/g, "");
  const cohort = formText(form, "cohort").replace(/\s+/g, " ");
  const password = String(form.get("password") ?? "");
  const emailVerified = form.get("emailVerified") === "1";
  const role = formText(form, "role");
  const self = id === me.id;

  if (!id) return { error: "ไม่พบบัญชีนี้" };
  if (!(await mayTouch(access, id))) return { error: NOT_YOURS };
  if (!name || name.length > 100) return { error: "กรอกชื่อ (ไม่เกิน 100 ตัวอักษร)" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "รูปแบบอีเมลไม่ถูกต้อง" };
  if (!/^0\d{8,9}$/.test(phone)) return { error: "เบอร์โทรต้องเป็นตัวเลข 9–10 หลัก ขึ้นต้นด้วย 0" };
  if (cohort.length > 60) return { error: "รุ่นยาวเกิน 60 ตัวอักษร" };
  if (password && (password.length < 8 || password.length > 128)) return { error: "รหัสผ่านใหม่ต้องยาว 8–128 ตัวอักษร" };

  const db = getDb();
  const [before] = await db
    .select({ name: user.name, email: user.email, phone: user.phone, cohort: user.cohort, emailVerified: user.emailVerified, role: user.role, adminRoleId: user.adminRoleId })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  if (!before) return { error: "ไม่พบบัญชีนี้ อาจถูกลบไปแล้ว" };
  // Only a super admin hands out rights, and not to themselves: there's always someone who can get back in
  let rights: { role: string; adminRoleId: string | null } | undefined;
  if (access.superAdmin && !self) {
    if (role === "user" || role === "super_admin") rights = { role, adminRoleId: null };
    else {
      const [found] = await db.select({ id: adminRoles.id }).from(adminRoles).where(eq(adminRoles.id, isUuid(role) ? role : "00000000-0000-0000-0000-000000000000")).limit(1);
      if (!found) return { error: "เลือกสิทธิ์ให้ถูกต้อง" };
      rights = { role: "user", adminRoleId: found.id };
    }
  }

  const [taken] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.email, email), ne(user.id, id)))
    .limit(1);
  if (taken) return { error: "อีเมลนี้มีบัญชีอื่นใช้อยู่แล้ว" };

  const after = { name, email, phone, cohort, emailVerified, ...(rights ?? { role: before.role, adminRoleId: before.adminRoleId }) };
  // The role is logged by name, not by id
  const rightsOf = async (r: { role: string; adminRoleId: string | null }) => roleLabel(r).then((label) => (label === "ลูกค้า" ? "สมาชิก" : label));
  const changes = changesOf(
    { ...before, rights: await rightsOf(before) },
    { ...after, rights: await rightsOf(after) },
    { name: "ชื่อ", email: "อีเมล", phone: "เบอร์โทร", cohort: "รุ่น", emailVerified: "ยืนยันอีเมลแล้ว", rights: "สิทธิ์" },
  );
  const target = { type: "user", id, label: email };
  const [[updated]] = await db.batch([
    db.update(user).set(after).where(eq(user.id, id)).returning({ id: user.id }),
    ...(await auditQuery({ action: "member.update", target, subjectUserId: id, changes, details: changes.length ? undefined : { note: "บันทึกโดยไม่มีอะไรเปลี่ยน" } })),
  ]);
  if (!updated) return { error: "ไม่พบบัญชีนี้ อาจถูกลบไปแล้ว" };

  if (password) {
    const ctx = await auth.$context;
    await ctx.internalAdapter.updatePassword(id, await ctx.password.hash(password));
    // Like a password reset: every device signs out (but not the admin's own one, editing themselves)
    const signedOut = await db
      .delete(session)
      .where(self ? and(eq(session.userId, id), ne(session.id, mine.id)) : eq(session.userId, id))
      .returning({ id: session.id });
    // That a password was set, never what it is
    await audit({ action: "member.password_set", target, subjectUserId: id, details: { devicesSignedOut: signedOut.length } });
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
  const { session: mine, access } = await requirePermission("members.manage", "/admin/users");
  if (!(await mayTouch(access, userId))) return [];
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
  const { session: mine, access } = await requirePermission("members.manage", "/admin/users");
  if (!(await mayTouch(access, userId))) return [];
  const db = getDb();
  const gone = await db
    .delete(session)
    .where(and(eq(session.userId, userId), sessionId ? eq(session.id, sessionId) : undefined, ne(session.id, mine.id)))
    .returning({ ipAddress: session.ipAddress, userAgent: session.userAgent, createdAt: session.createdAt });
  const [member] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
  if (gone.length)
    await audit({
      action: "member.sessions_revoke",
      target: { type: "user", id: userId, label: member?.email ?? userId },
      subjectUserId: userId,
      details: {
        scope: sessionId ? "เครื่องเดียว" : "ทุกเครื่อง",
        devices: gone.map((s) => ({ ip: s.ipAddress, browser: s.userAgent, signedInAt: s.createdAt })),
      },
    });
  return memberSessions(userId);
}

/** ลบบัญชี for good: the email typed back confirms it. Sessions and the login go with it (ON DELETE CASCADE) */
export async function deleteMember(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const { user: me, access } = await requirePermission("members.manage", "/admin/users");
  const id = formText(form, "userId");
  if (id === me.id) return { error: "ลบบัญชีของตัวเองไม่ได้" };
  if (!(await mayTouch(access, id))) return { error: NOT_YOURS };

  const db = getDb();
  const [target] = await db
    .select({ email: user.email, name: user.name, phone: user.phone, role: user.role, adminRoleId: user.adminRoleId, emailVerified: user.emailVerified, createdAt: user.createdAt })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  if (!target) return { error: "ไม่พบบัญชีนี้ อาจถูกลบไปแล้ว" };
  if (formText(form, "confirm").toLowerCase() !== target.email) return { error: "พิมพ์อีเมลให้ตรงเพื่อยืนยัน" };
  // Orders and tickets are kept (they're the record of what was sold), so their owner is too
  const [bought] = await db.select({ id: orders.id }).from(orders).where(eq(orders.userId, id)).limit(1);
  if (bought) return { error: "บัญชีนี้มีประวัติการซื้อบัตร ลบไม่ได้" };

  // What the account was, kept in the log since the account itself is gone
  await db.batch([
    db.delete(user).where(eq(user.id, id)),
    ...(await auditQuery({
      action: "member.delete",
      target: { type: "user", id, label: target.email },
      subjectUserId: id,
      details: { name: target.name, email: target.email, phone: target.phone, rights: await roleLabel(target), emailVerified: target.emailVerified, joinedAt: target.createdAt },
    })),
  ]);
  if (form.get("from") === "detail") redirect("/admin/users");
  refresh();
  return { ok: "ลบบัญชีแล้ว" };
}
