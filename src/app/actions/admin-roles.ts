"use server";

import { and, eq, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb } from "@/db";
import { adminRoles, user } from "@/db/schema";
import type { AdminFormState } from "@/lib/form";
import { auditQuery, changesOf } from "@/lib/audit";
import { PERMISSIONS, PERMISSION_KEYS } from "@/lib/permissions";
import { requireSuperAdmin } from "@/lib/session";
import { uuidv7, isUuid } from "@/lib/uuid";
import { formText } from "@/lib/form";

// สิทธิ์ทีมงาน (app/admin/roles): roles are made, changed and removed freely, by a super admin only.

/** Permissions logged by their Thai names */
const named = (keys: string[]) => keys.map((key) => PERMISSIONS.find((p) => p.key === key)?.label ?? key).sort();
const LABELS = { name: "ชื่อโรล", description: "คำอธิบาย", permissions: "สิทธิ์" };


/** สร้าง / แก้ไขโรล: with `roleId` it changes that role, and everyone who has it gets the new rights at once */
export async function saveRole(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await requireSuperAdmin("/admin/roles");
  const id = formText(form, "roleId");
  const name = formText(form, "name");
  const description = formText(form, "description");
  const permissions = form.getAll("permissions").map(String);

  if (!name || name.length > 60) return { error: "กรอกชื่อโรล (ไม่เกิน 60 ตัวอักษร)" };
  if (description.length > 200) return { error: "คำอธิบายยาวเกิน 200 ตัวอักษร" };
  if (permissions.some((p) => !PERMISSION_KEYS.includes(p))) return { error: "มีสิทธิ์ที่ไม่รู้จัก รีเฟรชหน้าแล้วลองใหม่" };
  if (permissions.length === 0) return { error: "เลือกสิทธิ์อย่างน้อย 1 อย่าง" };

  const db = getDb();
  const [taken] = await db
    .select({ id: adminRoles.id })
    .from(adminRoles)
    .where(id ? and(eq(adminRoles.name, name), ne(adminRoles.id, id)) : eq(adminRoles.name, name))
    .limit(1);
  if (taken) return { error: "มีโรลชื่อนี้แล้ว" };

  if (id) {
    const [before] = await db.select().from(adminRoles).where(eq(adminRoles.id, id)).limit(1);
    if (!before) return { error: "ไม่พบโรลนี้ อาจถูกลบไปแล้ว" };
    const changes = changesOf({ ...before, permissions: named(before.permissions) }, { name, description, permissions: named(permissions) }, LABELS);
    await db.batch([
      db.update(adminRoles).set({ name, description, permissions }).where(eq(adminRoles.id, id)),
      ...(await auditQuery({ action: "role.update", target: { type: "role", id, label: name }, changes })),
    ]);
  } else {
    const newId = uuidv7();
    const changes = changesOf(null, { name, description, permissions: named(permissions) }, LABELS);
    await db.batch([
      db.insert(adminRoles).values({ id: newId, name, description, permissions }),
      ...(await auditQuery({ action: "role.create", target: { type: "role", id: newId, label: name }, changes })),
    ]);
  }
  refresh();
  return { ok: "บันทึกโรลแล้ว" };
}

/** ลบโรล: whoever had it goes back to being a customer (ON DELETE SET NULL) */
export async function deleteRole(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await requireSuperAdmin("/admin/roles");
  const id = formText(form, "roleId");
  const db = getDb();
  const [role] = isUuid(id) ? await db.select().from(adminRoles).where(eq(adminRoles.id, id)).limit(1) : [];
  if (!role) return { error: "ไม่พบโรลนี้ อาจถูกลบไปแล้ว" };
  const holders = await db.select({ id: user.id, email: user.email }).from(user).where(eq(user.adminRoleId, id));
  await db.batch([
    db.delete(adminRoles).where(eq(adminRoles.id, id)),
    ...(await auditQuery({
      action: "role.delete",
      target: { type: "role", id, label: role.name },
      details: { description: role.description, permissions: named(role.permissions), backToCustomer: holders.map((h) => h.email) },
    })),
  ]);
  refresh();
  return { ok: "ลบโรลแล้ว" };
}
