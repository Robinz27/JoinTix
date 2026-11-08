"use server";

import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { refresh, updateTag } from "next/cache";
import { getDb } from "@/db";
import { events, merchItems, merchVariants, orderItems } from "@/db/schema";
import type { AdminFormState } from "@/app/actions/admin";
import { dropIfUnused } from "@/lib/admin-events";
import { auditQuery, changesOf } from "@/lib/audit";
import type { AuditChange } from "@/lib/audit-actions";
import { merchLabel } from "@/lib/event-fields";
import { EVENTS_TAG } from "@/lib/events";
import { requirePermission } from "@/lib/session";
import { deleteUploadedImage, saveUploadedImage } from "@/lib/uploads";
import { uuidv7 } from "@/lib/uuid";

// สินค้าของอีเวนต์ (app/admin/events/[id]/merch): an event's whole list of merchandise and its options, saved
// together like its ticket zones. An option that has ever been in an order stays, because the order points at
// it; to stop selling an item, ปิดขาย takes it off the event page instead.

const MAX_ITEMS = 30;
const MAX_OPTIONS = 30;
const MAX_STOCK = 1_000_000;
/** An order holds 20 pieces at most (lib/orders.ts) */
const MAX_LIMIT = 20;

export type MerchInput = {
  id?: string;
  name: string;
  note: string;
  /** The saved picture to keep, or empty */
  image: string;
  /** Which of the sent "imageFile"s is its new picture */
  file?: number;
  price: number;
  /** What the options are called; empty for an item with no options */
  optionLabel: string;
  /** Most in one order; 0 is no limit of its own */
  maxPerOrder: number;
  active: boolean;
  /** An item with no options has one, with no name, that holds its stock */
  options: { id?: string; option: string; capacity: number }[];
};

const ITEM_LABELS = { name: "ชื่อ", note: "รายละเอียด", image: "รูป", price: "ราคา (บาท)", optionLabel: "ชื่อตัวเลือก", maxPerOrder: "จำกัดต่อคำสั่งซื้อ", active: "เปิดขาย", position: "ลำดับ" };
const OPTION_LABELS = { option: "ตัวเลือก", capacity: "จำนวน", position: "ลำดับ" };

function validate(items: MerchInput[]): string | null {
  if (!Array.isArray(items) || items.length > MAX_ITEMS) return `มีสินค้าได้ไม่เกิน ${MAX_ITEMS} รายการ`;
  for (const [i, item] of items.entries()) {
    const where = `สินค้ารายการที่ ${i + 1}`;
    const name = String(item.name ?? "").trim();
    const optionLabel = String(item.optionLabel ?? "").trim();
    if (!name || name.length > 80) return `${where}: กรอกชื่อ (ไม่เกิน 80 ตัวอักษร)`;
    if (String(item.note ?? "").length > 200) return `${where}: รายละเอียดยาวเกิน 200 ตัวอักษร`;
    if (!Number.isInteger(item.price) || item.price < 0 || item.price > MAX_STOCK) return `${where}: ราคาต้องเป็นจำนวนเต็ม 0 ขึ้นไป`;
    if (!Number.isInteger(item.maxPerOrder) || item.maxPerOrder < 0 || item.maxPerOrder > MAX_LIMIT) return `${where}: จำกัดต่อคำสั่งซื้อต้องเป็น 0–${MAX_LIMIT} ชิ้น (0 = ไม่จำกัด)`;
    if (optionLabel.length > 20) return `${where}: ชื่อตัวเลือกยาวเกิน 20 ตัวอักษร`;
    if (!Array.isArray(item.options) || item.options.length === 0 || item.options.length > MAX_OPTIONS) return `${where}: ต้องมี 1–${MAX_OPTIONS} ตัวเลือก`;
    if (item.options.some((o) => !Number.isInteger(o.capacity) || o.capacity < 0 || o.capacity > MAX_STOCK)) return `${where}: จำนวนต้องเป็นจำนวนเต็ม 0 ขึ้นไป`;
    if (!optionLabel) {
      if (item.options.length !== 1) return `${where}: ตั้งชื่อตัวเลือก เช่น ไซส์ หรือ สี`;
      continue;
    }
    const labels = item.options.map((o) => String(o.option ?? "").trim().toLowerCase());
    if (labels.some((label) => !label || label.length > 40)) return `${where}: กรอก${optionLabel}ให้ครบ (ไม่เกิน 40 ตัวอักษร)`;
    if (new Set(labels).size !== labels.length) return `${where}: มี${optionLabel}ซ้ำกัน`;
  }
  return null;
}

/** บันทึกสินค้า: everything on the tab in one transaction. `form` carries "items" as JSON and the new pictures */
export async function saveMerch(eventId: string, form: FormData): Promise<AdminFormState> {
  await requirePermission("events.manage", `/admin/events/${eventId}/merch`);
  let items: MerchInput[];
  try {
    items = JSON.parse(String(form.get("items") ?? ""));
  } catch {
    return { error: "ข้อมูลสินค้าไม่ถูกต้อง รีเฟรชหน้าแล้วลองใหม่" };
  }
  const invalid = validate(items);
  if (invalid) return { error: invalid };
  // Empty: no posting at this event
  const feeRaw = String(form.get("shippingFee") ?? "");
  const shippingFee = feeRaw === "" ? null : Number(feeRaw);
  if (shippingFee !== null && (!Number.isInteger(shippingFee) || shippingFee < 0 || shippingFee > MAX_STOCK)) return { error: "ค่าจัดส่งต้องเป็นจำนวนเต็ม 0 ขึ้นไป (0 = ส่งฟรี)" };
  const files = form.getAll("imageFile").filter((f): f is File => f instanceof File && f.size > 0);

  const db = getDb();
  const [event] = await db.select({ id: events.id, title: events.title, shippingFee: events.shippingFee }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return { error: "ไม่พบอีเวนต์นี้ อาจถูกลบไปแล้ว" };

  const savedItems = await db.select().from(merchItems).where(eq(merchItems.eventId, eventId));
  const itemIds = savedItems.map((item) => item.id);
  const savedOptions = itemIds.length ? await db.select().from(merchVariants).where(inArray(merchVariants.itemId, itemIds)).orderBy(asc(merchVariants.position)) : [];
  const ordered = savedOptions.length
    ? new Set(
        (await db.selectDistinct({ id: orderItems.variantId }).from(orderItems).where(inArray(orderItems.variantId, savedOptions.map((o) => o.id)))).map((row) => row.id),
      )
    : new Set<string>();

  const keptOptions = new Set(items.flatMap((item) => item.options.map((o) => o.id)).filter(Boolean));
  const keptItems = new Set(items.map((item) => item.id).filter(Boolean));
  for (const option of savedOptions) {
    if (!keptOptions.has(option.id) && ordered.has(option.id)) {
      const item = savedItems.find((row) => row.id === option.itemId)!;
      return { error: `ลบ ${merchLabel({ ...item, option: option.option })} ไม่ได้ เพราะมีคำสั่งซื้อแล้ว ให้ปิดขายแทน` };
    }
  }
  for (const item of items) {
    if (item.id && !savedItems.some((row) => row.id === item.id)) return { error: "มีสินค้าที่ถูกลบไปแล้ว รีเฟรชหน้าแล้วลองใหม่" };
    for (const option of item.options) {
      const saved = savedOptions.find((row) => row.id === option.id);
      if (option.id && !saved) return { error: "มีตัวเลือกที่ถูกลบไปแล้ว รีเฟรชหน้าแล้วลองใหม่" };
      if (saved && option.capacity < saved.sold) return { error: `${item.name} ${option.option} ขายไปแล้ว ${saved.sold} ชิ้น ตั้งจำนวนต่ำกว่านั้นไม่ได้` };
    }
  }

  // Pictures last, once nothing else can turn the save down; any stored for a save that then fails go again
  const stored: string[] = [];
  const discard = async (error: string): Promise<AdminFormState> => {
    await Promise.all(stored.map(deleteUploadedImage));
    return { error };
  };
  const images = new Map<MerchInput, string>();
  for (const item of items) {
    // Only ever the picture this item already has: a path can't be pointed at another file
    let image = savedItems.find((row) => row.id === item.id && row.image === item.image)?.image ?? "";
    if (typeof item.file === "number") {
      const file = files[item.file];
      if (!file) return discard("ส่งรูปสินค้าไม่ครบ ลองเลือกรูปใหม่อีกครั้ง");
      const saved = await saveUploadedImage(file, "merch");
      if (!saved.ok) return discard(`${item.name}: ${saved.error}`);
      image = saved.path;
      stored.push(image);
    }
    images.set(item, image);
  }

  const queries: BatchItem<"pg">[] = [db.update(events).set({ shippingFee }).where(eq(events.id, eventId))];
  const keepOptionIds = [...keptOptions] as string[];
  // Options first: an item is only deleted once nothing of it is left
  if (itemIds.length) queries.push(db.delete(merchVariants).where(and(inArray(merchVariants.itemId, itemIds), keepOptionIds.length ? notInArray(merchVariants.id, keepOptionIds) : undefined)));
  const goneItems = itemIds.filter((id) => !keptItems.has(id));
  if (goneItems.length) queries.push(db.delete(merchItems).where(inArray(merchItems.id, goneItems)));

  items.forEach((item, position) => {
    const optionLabel = item.optionLabel.trim();
    const row = { name: item.name.trim(), note: String(item.note ?? "").trim(), image: images.get(item)!, price: item.price, optionLabel, maxPerOrder: item.maxPerOrder, active: Boolean(item.active), position };
    const itemId = item.id ?? uuidv7();
    queries.push(item.id ? db.update(merchItems).set(row).where(eq(merchItems.id, item.id)) : db.insert(merchItems).values({ ...row, id: itemId, eventId }));
    item.options.forEach((option, order) => {
      const optionRow = { option: optionLabel ? option.option.trim() : "", capacity: option.capacity, position: order };
      queries.push(option.id ? db.update(merchVariants).set(optionRow).where(eq(merchVariants.id, option.id)) : db.insert(merchVariants).values({ ...optionRow, itemId }));
    });
  });
  // Item by item and option by option, what this save changed
  const changes: AuditChange[] = changesOf({ shippingFee: event.shippingFee }, { shippingFee }, { shippingFee: "ค่าจัดส่ง (ว่าง = รับที่งานเท่านั้น)" });
  items.forEach((item, position) => {
    const saved = savedItems.find((row) => row.id === item.id);
    const name = item.name.trim();
    const optionLabel = item.optionLabel.trim();
    const label = saved ? `สินค้า ${saved.name}` : `สินค้า ${name} (ใหม่)`;
    const field = `merch.${item.id ?? name}`;
    changes.push(
      ...changesOf(saved, { name, note: String(item.note ?? "").trim(), image: images.get(item)!, price: item.price, optionLabel, maxPerOrder: item.maxPerOrder, active: Boolean(item.active), position }, saved ? ITEM_LABELS : { ...ITEM_LABELS, position: undefined }, { field, label }),
    );
    item.options.forEach((option, order) => {
      const was = savedOptions.find((row) => row.id === option.id);
      const optionName = optionLabel ? option.option.trim() : "";
      changes.push(
        ...changesOf(was, { option: optionName, capacity: option.capacity, position: order }, was ? OPTION_LABELS : { ...OPTION_LABELS, position: undefined }, {
          field: `${field}.${option.id ?? optionName}`,
          label: `${label} › ${was ? was.option || "สต็อก" : `${optionName || "สต็อก"} (ใหม่)`}`,
        }),
      );
    });
    for (const gone of savedOptions.filter((row) => row.itemId === item.id && !keptOptions.has(row.id)))
      changes.push({ field: `${field}.${gone.id}`, label: `${label} › ${gone.option || "สต็อก"} (ลบ)`, from: `${gone.capacity} ชิ้น`, to: null });
  });
  for (const gone of savedItems.filter((row) => !keptItems.has(row.id)))
    changes.push({ field: `merch.${gone.id}`, label: `สินค้า ${gone.name} (ลบ)`, from: `฿${gone.price.toLocaleString("th-TH")}`, to: null });
  queries.push(...(await auditQuery({ action: "merch.save", target: { type: "merch", id: eventId, label: event.title }, eventId, changes, details: stored.length ? { uploadedPictures: stored } : undefined })));

  try {
    await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  } catch (e) {
    console.error("[saveMerch]", e);
    return discard("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
  }
  updateTag(EVENTS_TAG);
  const now = new Set(images.values());
  await dropIfUnused(savedItems.map((item) => item.image).filter((image) => image && !now.has(image)));
  refresh();
  return { ok: "บันทึกแล้ว หน้าเว็บอัปเดตทันที" };
}
