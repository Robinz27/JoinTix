"use server";

import { and, asc, count, eq, sql } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { refresh } from "next/cache";
import { getDb } from "@/db";
import { events, shopItems, shopSales, shopStaff, shops, user } from "@/db/schema";
import type { AdminFormState } from "@/app/actions/admin";
import { adjustTokens, findCustomer, recentSales, shopRole, recentTopUps, sell, topUp, undoTopUp, voidSale, type CustomerAnswer, type SaleAnswer, type SaleEntry, type SaleLine, type TopUpEntry } from "@/lib/shops";
import { audit, auditQuery, changesOf } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { saveUploadedImage } from "@/lib/uploads";
import { uuidv7 } from "@/lib/uuid";
import { getAdminAccess, getSession, requirePermission } from "@/lib/session";

// Shops, their menus and people (app/admin/shops, and app/(site)/shop for their owners), the top-up desk
// (app/admin/tokens) and the tills. The rules live in lib/shops.ts; these check who is asking.

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Who may touch this shop: anyone in หลังบ้าน who manages shops, or the shop's own people, who need no role there.
 * `owner` keeps out its staff. Anyone else's shop is the same 404 as the rest of หลังบ้าน.
 */
async function shopAccess(shopId: string, need: "owner" | "member") {
  const session = await getSession();
  if (!session) redirect("/login?next=/shop");
  if (!UUID.test(shopId)) notFound();
  const access = await getAdminAccess();
  if (access && can(access, "shops.manage")) return { ...session, manager: true };
  const role = await shopRole(session.user.id, shopId);
  if (!role || (need === "owner" && role !== "owner")) notFound();
  return { ...session, manager: false };
}

/** The shop a menu item belongs to, so an owner reaches only their own */
async function shopOfItem(itemId: string) {
  if (!UUID.test(itemId)) notFound();
  const [item] = await getDb().select({ shopId: shopItems.shopId }).from(shopItems).where(eq(shopItems.id, itemId)).limit(1);
  if (!item) notFound();
  return item.shopId;
}

const SHOP_LABELS = { name: "ชื่อร้าน", note: "รายละเอียด", active: "เปิดร้าน" };
const ITEM_LABELS = { name: "ชื่อรายการ", tokens: "โทเคน", available: "มีขาย" };
const ROLE_NAMES = { owner: "เจ้าของร้าน", staff: "พนักงาน" } as const;

/** A shop's name and event, for the log */
async function shopInfo(shopId: string) {
  const [row] = await getDb().select({ name: shops.name, eventId: shops.eventId }).from(shops).where(eq(shops.id, shopId)).limit(1);
  return row;
}

function shopFields(form: FormData) {
  const name = text(form, "name");
  const note = text(form, "note");
  if (!name || name.length > 80) return { error: "กรอกชื่อร้าน (ไม่เกิน 80 ตัวอักษร)" };
  if (note.length > 200) return { error: "รายละเอียดยาวเกิน 200 ตัวอักษร" };
  return { name, note };
}

/** เพิ่มร้าน, then on to its menu */
export async function createShop(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await requirePermission("shops.manage", "/admin/shops");
  const fields = shopFields(form);
  if ("error" in fields) return fields;
  const eventId = text(form, "eventId");
  if (!UUID.test(eventId)) return { error: "เลือกอีเวนต์ก่อน" };
  const db = getDb();
  const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return { error: "ไม่พบอีเวนต์นี้" };
  const id = uuidv7();
  await db.batch([
    db.insert(shops).values({ id, ...fields, eventId }),
    ...(await auditQuery({ action: "shop.create", target: { type: "shop", id, label: fields.name }, eventId, changes: changesOf(null, fields, SHOP_LABELS) })),
  ]);
  redirect(`/admin/shops/${id}`);
}

/** แก้ไขร้าน: its name, and whether it is open */
export async function updateShop(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await requirePermission("shops.manage", "/admin/shops");
  const fields = shopFields(form);
  if ("error" in fields) return fields;
  const id = text(form, "shopId");
  if (!UUID.test(id)) return { error: "ไม่พบร้านนี้" };
  const db = getDb();
  const [before] = await db.select().from(shops).where(eq(shops.id, id)).limit(1);
  if (!before) return { error: "ไม่พบร้านนี้ อาจถูกลบไปแล้ว" };
  const after = { ...fields, active: form.get("active") === "1" };
  await db.batch([
    db.update(shops).set(after).where(eq(shops.id, id)),
    ...(await auditQuery({ action: "shop.update", target: { type: "shop", id, label: after.name }, eventId: before.eventId, changes: changesOf(before, after, SHOP_LABELS) })),
  ]);
  refresh();
  return { ok: "บันทึกแล้ว" };
}

/** ลบร้าน: one that has sold anything stays for the report, closed instead */
export async function deleteShop(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await requirePermission("shops.manage", "/admin/shops");
  const id = text(form, "shopId");
  if (!UUID.test(id)) return { error: "ไม่พบร้านนี้" };
  const db = getDb();
  const [{ n }] = await db.select({ n: count() }).from(shopSales).where(eq(shopSales.shopId, id));
  if (n > 0) return { error: `ร้านนี้มีรายการขาย ${n} รายการ ลบไม่ได้ ให้ปิดร้านแทน` };
  const [gone] = await db.select().from(shops).where(eq(shops.id, id)).limit(1);
  if (!gone) return { error: "ไม่พบร้านนี้ อาจถูกลบไปแล้ว" };
  const [menu, people] = await Promise.all([
    db.select({ name: shopItems.name, tokens: shopItems.tokens }).from(shopItems).where(eq(shopItems.shopId, id)),
    db.select({ email: user.email, role: shopStaff.role }).from(shopStaff).innerJoin(user, eq(user.id, shopStaff.userId)).where(eq(shopStaff.shopId, id)),
  ]);
  await db.batch([
    db.delete(shops).where(eq(shops.id, id)),
    ...(await auditQuery({
      action: "shop.delete",
      target: { type: "shop", id, label: gone.name },
      eventId: gone.eventId,
      details: { note: gone.note, menu: menu.map((m) => `${m.name} (${m.tokens} โทเคน)`), people: people.map((p) => `${p.email} (${ROLE_NAMES[p.role]})`) },
    })),
  ]);
  if (form.get("from") === "edit") redirect(`/admin/events/${gone.eventId}/shops`);
  refresh();
  return { ok: "ลบร้านแล้ว" };
}

/**
 * เมนู: adds one, or with `itemId` changes it. A shop's own owner may only change how many tokens an item takes
 * (the client's rule: หลังบ้าน sets up each shop and what it sells; the shop sets its price)
 */
export async function saveShopItem(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const shopId = text(form, "shopId");
  const { manager } = await shopAccess(shopId, "owner");
  const itemId = text(form, "itemId");
  if (!manager && !itemId) return { error: "เพิ่มรายการใหม่ได้ที่ผู้จัดงาน" };
  let name = text(form, "name");
  const tokens = Number(text(form, "tokens"));
  if (!UUID.test(shopId)) return { error: "ไม่พบร้านนี้" };
  if (!name || name.length > 80) return { error: "กรอกชื่อรายการ (ไม่เกิน 80 ตัวอักษร)" };
  if (!Number.isInteger(tokens) || tokens < 1 || tokens > 100_000) return { error: "โทเคนต้องเป็นจำนวนเต็ม 1 ขึ้นไป" };
  const db = getDb();
  const shop = await shopInfo(shopId);
  if (!shop) return { error: "ไม่พบร้านนี้" };
  const details = { shop: shop.name };
  if (itemId) {
    const [before] = UUID.test(itemId) ? await db.select().from(shopItems).where(and(eq(shopItems.id, itemId), eq(shopItems.shopId, shopId))).limit(1) : [];
    if (!before) return { error: "ไม่พบรายการนี้ อาจถูกลบไปแล้ว" };
    // The owner's form sends the name back unchanged; whatever it says, only หลังบ้าน renames
    if (!manager) name = before.name;
    await db.batch([
      db.update(shopItems).set({ name, tokens }).where(eq(shopItems.id, itemId)),
      ...(await auditQuery({ action: "shop_item.update", target: { type: "shop", id: shopId, label: `${shop.name} › ${name}` }, eventId: shop.eventId, changes: changesOf(before, { name, tokens }, ITEM_LABELS), details })),
    ]);
  } else {
    await db.batch([
      db.insert(shopItems).values({
        shopId,
        name,
        tokens,
        position: sql`(select coalesce(max(${shopItems.position}), -1) + 1 from ${shopItems} where ${shopItems.shopId} = ${shopId}::uuid)`,
      }),
      ...(await auditQuery({ action: "shop_item.create", target: { type: "shop", id: shopId, label: `${shop.name} › ${name}` }, eventId: shop.eventId, changes: changesOf(null, { name, tokens }, ITEM_LABELS), details })),
    ]);
  }
  refresh();
  return { ok: "บันทึกแล้ว" };
}

export async function setShopItemAvailable(itemId: string, available: boolean) {
  const shopId = await shopOfItem(itemId);
  const { manager } = await shopAccess(shopId, "owner");
  if (!manager) notFound();
  const db = getDb();
  const [[before], shop] = await Promise.all([db.select().from(shopItems).where(eq(shopItems.id, itemId)).limit(1), shopInfo(shopId)]);
  if (!before || !shop) return;
  await db.batch([
    db.update(shopItems).set({ available: Boolean(available) }).where(eq(shopItems.id, itemId)),
    ...(await auditQuery({
      action: "shop_item.update",
      target: { type: "shop", id: shopId, label: `${shop.name} › ${before.name}` },
      eventId: shop.eventId,
      changes: changesOf(before, { available: Boolean(available) }, { available: ITEM_LABELS.available }),
      details: { shop: shop.name },
    })),
  ]);
  refresh();
}

/** Past sales keep their copy of the name and tokens, so a menu item can always go */
export async function deleteShopItem(itemId: string) {
  const shopId = await shopOfItem(itemId);
  const { manager } = await shopAccess(shopId, "owner");
  if (!manager) notFound();
  const db = getDb();
  const [[item], shop] = await Promise.all([db.select().from(shopItems).where(eq(shopItems.id, itemId)).limit(1), shopInfo(shopId)]);
  if (!item || !shop) return;
  await db.batch([
    db.delete(shopItems).where(eq(shopItems.id, itemId)),
    ...(await auditQuery({ action: "shop_item.delete", target: { type: "shop", id: shopId, label: `${shop.name} › ${item.name}` }, eventId: shop.eventId, details: { shop: shop.name, name: item.name, tokens: item.tokens } })),
  ]);
  refresh();
}

/** คนของร้าน: found by email, any account at all. Owners are named from หลังบ้าน; an owner adds their own staff */
export async function addShopStaff(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const shopId = text(form, "shopId");
  const { manager } = await shopAccess(shopId, "owner");
  // Who works at a shop is หลังบ้าน's to decide, owners and staff alike
  if (!manager) notFound();
  const role = text(form, "role") === "owner" ? "owner" : "staff";
  const email = text(form, "email").toLowerCase();
  const db = getDb();
  const [member] = await db.select({ id: user.id, name: user.name }).from(user).where(eq(user.email, email)).limit(1);
  if (!member) return { error: "ไม่พบบัญชีที่ใช้อีเมลนี้ ให้เขาสมัครสมาชิกก่อน" };
  const [shop, [was]] = await Promise.all([
    shopInfo(shopId),
    db.select({ role: shopStaff.role }).from(shopStaff).where(and(eq(shopStaff.shopId, shopId), eq(shopStaff.userId, member.id))).limit(1),
  ]);
  if (manager) {
    await db.insert(shopStaff).values({ shopId, userId: member.id, role }).onConflictDoUpdate({ target: [shopStaff.shopId, shopStaff.userId], set: { role } });
  } else {
    // An owner can't turn a fellow owner into staff by adding them again
    await db.insert(shopStaff).values({ shopId, userId: member.id, role }).onConflictDoNothing();
  }
  const now = manager || !was ? role : was.role;
  if (now !== was?.role)
    await audit({
      action: "shop_staff.add",
      target: { type: "shop", id: shopId, label: `${shop?.name ?? ""} › ${email}` },
      eventId: shop?.eventId,
      subjectUserId: member.id,
      changes: changesOf({ role: was ? ROLE_NAMES[was.role] : null }, { role: ROLE_NAMES[now] }, { role: "หน้าที่ในร้าน" }),
      details: { shop: shop?.name, person: `${member.name} <${email}>` },
    });
  refresh();
  return { ok: role === "owner" ? "เพิ่มเจ้าของร้านแล้ว" : "เพิ่มพนักงานแล้ว" };
}

export async function removeShopStaff(shopId: string, userId: string) {
  const { manager } = await shopAccess(shopId, "owner");
  if (!manager) notFound();
  // Only หลังบ้าน takes an owner off, so a shop can't lose its owners from inside
  const db = getDb();
  const [gone] = await db
    .delete(shopStaff)
    .where(and(eq(shopStaff.shopId, shopId), eq(shopStaff.userId, userId), manager ? undefined : eq(shopStaff.role, "staff")))
    .returning({ role: shopStaff.role });
  if (gone) {
    const [[person], shop] = await Promise.all([db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, userId)).limit(1), shopInfo(shopId)]);
    await audit({
      action: "shop_staff.remove",
      target: { type: "shop", id: shopId, label: `${shop?.name ?? ""} › ${person?.email ?? userId}` },
      eventId: shop?.eventId,
      subjectUserId: userId,
      changes: [{ field: "role", label: "หน้าที่ในร้าน", from: ROLE_NAMES[gone.role], to: null }],
      details: { shop: shop?.name, person: person ? `${person.name} <${person.email}>` : userId },
    });
  }
  refresh();
}

/* ─────────────── เติมโทเคน / ปรับยอด ─────────────── */

const DESK = ["tokens.topup", "tokens.adjust"] as const;

export async function findForTopUp(scanned: string, eventId: string): Promise<CustomerAnswer> {
  await requirePermission(DESK, "/admin/tokens");
  return findCustomer(scanned, eventId);
}

/** A photo of the customer's slip, when one was taken: kept privately (lib/uploads.ts) for checking at the end */
async function slipOf(form: FormData): Promise<{ path?: string; error?: string }> {
  const file = form.get("slip");
  if (!(file instanceof File) || file.size === 0) return {};
  const saved = await saveUploadedImage(file, "slips");
  return saved.ok ? { path: saved.path } : { error: saved.error };
}

/** เติมโทเคน: scanned, eventId, tokens, key and an optional slip photo and note, as a form (the photo is a file) */
export async function topUpTokens(form: FormData): Promise<CustomerAnswer> {
  const { user: me } = await requirePermission("tokens.topup", "/admin/tokens");
  const slip = await slipOf(form);
  if (slip.error) return { error: slip.error };
  return topUp({ scanned: text(form, "scanned"), eventId: text(form, "eventId"), tokens: Number(text(form, "tokens")), key: text(form, "key"), note: text(form, "note"), slip: slip.path, by: me.id });
}

/** ปรับยอด: + or − tokens on a ticket with a reason; may go below zero (lib/shops.ts adjustTokens) */
export async function adjustTicketTokens(form: FormData): Promise<CustomerAnswer> {
  const { user: me } = await requirePermission("tokens.adjust", "/admin/tokens");
  const slip = await slipOf(form);
  if (slip.error) return { error: slip.error };
  return adjustTokens({
    scanned: text(form, "scanned"),
    eventId: text(form, "eventId"),
    tokens: Number(text(form, "tokens")),
    baht: Number(text(form, "baht") || 0),
    note: text(form, "note"),
    key: text(form, "key"),
    slip: slip.path,
    by: me.id,
  });
}

export async function undoTopUpTokens(transactionId: string): Promise<{ error?: string }> {
  const { user: me } = await requirePermission("tokens.topup", "/admin/tokens");
  return undoTopUp(transactionId, me.id);
}

export async function topUpFeed(eventId: string): Promise<TopUpEntry[]> {
  await requirePermission(DESK, "/admin/tokens");
  return UUID.test(eventId) ? recentTopUps(eventId) : [];
}

/* ─────────────── ขายที่ร้าน ─────────────── */

/** Every till action: this account, and this shop */
const tillAccess = (shopId: string) => shopAccess(shopId, "member");

export async function findAtTill(scanned: string, shopId: string): Promise<CustomerAnswer> {
  await tillAccess(shopId);
  const [shop] = await getDb().select({ eventId: shops.eventId }).from(shops).where(eq(shops.id, shopId)).limit(1);
  return shop ? findCustomer(scanned, shop.eventId) : { error: "ไม่พบร้านนี้" };
}

export async function chargeAtTill(input: { shopId: string; scanned: string; lines: SaleLine[]; key: string }): Promise<SaleAnswer> {
  const { user: me } = await tillAccess(input.shopId);
  return sell({ ...input, by: me.id });
}

export async function voidAtTill(shopId: string, saleId: string): Promise<{ error?: string }> {
  const { user: me } = await tillAccess(shopId);
  // Only a sale of this very shop: having one till doesn't reach another's
  const [sale] = await getDb()
    .select({ id: shopSales.id })
    .from(shopSales)
    .where(and(eq(shopSales.id, saleId), eq(shopSales.shopId, shopId)))
    .orderBy(asc(shopSales.createdAt))
    .limit(1);
  return sale ? voidSale(sale.id, me.id) : { error: "ไม่พบรายการนี้" };
}

export async function tillFeed(shopId: string): Promise<SaleEntry[]> {
  await tillAccess(shopId);
  return recentSales(shopId);
}
