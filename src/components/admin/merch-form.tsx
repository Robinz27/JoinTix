"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Cancel01Icon, Delete02Icon, ImageAdd01Icon, Loading03Icon, Package01Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import type { AdminFormState } from "@/lib/form";
import { saveMerch, type MerchInput } from "@/app/actions/admin-merch";
import { Notice, hint, label } from "@/components/admin/form";
import { Empty, card, iconButton, input, pill, pillPrimary } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { Switch } from "@/components/ui/switch";
import { shrinkImage } from "@/lib/shrink-image";

// สินค้าของอีเวนต์ (app/admin/events/[id]/merch): anything sold with the tickets, with its price and picture.
// An item either has one stock of its own, or options (ไซส์, สี, แบบ: the event names them) each with its own.
// Everything is edited here and saved at once, as the event form does with ticket zones.

export type MerchRow = Omit<MerchInput, "file" | "options"> & { options: { id?: string; option: string; capacity: number; sold: number }[] };

type Option = MerchRow["options"][number] & { key: string };
type Item = Omit<MerchRow, "options"> & { key: string; options: Option[]; picked: { file: File; url: string } | null };

const TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;
// Saved rows key on their id. New ones count from here, only in the browser, so hydration has nothing to differ on
let added = 0;

const newOption = (option = ""): Option => ({ key: `new-${added++}`, option, capacity: 50, sold: 0 });
const newItem = (): Item => ({ key: `new-${added++}`, name: "", note: "", image: "", price: 0, optionLabel: "", maxPerOrder: 0, active: true, options: [newOption()], picked: null });

export function MerchForm({ eventId, items, shippingFee }: { eventId: string; items: MerchRow[]; /** null: no posting */ shippingFee: number | null }) {
  const [state, setState] = useState<AdminFormState>({});
  // Once saved, new rows have ids and new pictures have paths: the editor starts over from them, or saving again
  // would add them twice
  const saved = items.flatMap((item) => [item.id, item.image, ...item.options.map((option) => option.id)]).join();
  return (
    <div className="space-y-4">
      <Notice state={state} />
      <Editor key={saved} eventId={eventId} items={items} shippingFee={shippingFee} onAnswer={setState} />
    </div>
  );
}

function Editor({ eventId, items: saved, shippingFee, onAnswer }: { eventId: string; items: MerchRow[]; shippingFee: number | null; onAnswer: (state: AdminFormState) => void }) {
  const [ships, setShips] = useState(shippingFee !== null);
  const [fee, setFee] = useState(shippingFee ?? 50);
  const [items, setItems] = useState<Item[]>(() =>
    saved.map((item) => ({ ...item, key: item.id!, picked: null, options: item.options.map((option) => ({ ...option, key: option.id! })) })),
  );
  const [saving, start] = useTransition();

  const patch = (key: string, change: Partial<Item>) => setItems((rows) => rows.map((row) => (row.key === key ? { ...row, ...change } : row)));
  const patchOption = (item: Item, key: string, change: Partial<Option>) => patch(item.key, { options: item.options.map((o) => (o.key === key ? { ...o, ...change } : o)) });

  function save() {
    const form = new FormData();
    let files = 0;
    const rows = items.map(({ id, name, note, image, price, optionLabel, maxPerOrder, active, options, picked }): MerchInput => {
      if (picked) form.append("imageFile", picked.file);
      return { id, name, note, image, file: picked ? files++ : undefined, price, optionLabel, maxPerOrder, active, options: options.map((o) => ({ id: o.id, option: o.option, capacity: o.capacity })) };
    });
    form.set("items", JSON.stringify(rows));
    form.set("shippingFee", ships ? String(fee) : "");
    start(async () => {
      onAnswer({});
      onAnswer(await saveMerch(eventId, form));
    });
  }

  return (
    <div className="space-y-4">
      <section className={`${card} space-y-3 p-4 sm:p-5`}>
        <Switch label="จัดส่งสินค้าให้ลูกค้า" hint="เปิดแล้วลูกค้าเลือกได้ว่าจะรับที่งานหรือให้จัดส่ง ปิดไว้จะรับที่งานอย่างเดียว" checked={ships} onChange={(e) => setShips(e.target.checked)} className="text-sm text-foreground" />
        {ships && (
          <div className="sm:max-w-48">
            <label htmlFor={`${eventId}-fee`} className={label}>
              ค่าจัดส่งต่อคำสั่งซื้อ (บาท)
            </label>
            <input id={`${eventId}-fee`} type="number" inputMode="numeric" min={0} value={Number.isNaN(fee) ? "" : fee} onChange={(e) => setFee(e.target.valueAsNumber)} className={`${input} tabular-nums`} />
            <p className={hint}>0 = ส่งฟรี</p>
          </div>
        )}
      </section>

      {items.length === 0 && (
        <section className={card}>
          <Empty icon={Package01Icon} title="งานนี้ยังไม่มีสินค้า" detail="เช่น เสื้อ สายคล้อง โปสเตอร์ หรือบัตรจอดรถ เพิ่มแล้วลูกค้าเลือกซื้อพร้อมบัตรได้ที่หน้าอีเวนต์" />
        </section>
      )}

      {items.map((item, i) => {
        const sold = item.options.reduce((n, o) => n + o.sold, 0);
        const hasOptions = item.optionLabel !== "";
        const only = item.options[0];
        return (
          <section key={item.key} className={`${card} p-4 sm:p-5`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">{item.name || `สินค้ารายการที่ ${i + 1}`}</h2>
              <div className="flex shrink-0 items-center gap-2">
                {sold > 0 && <span className="text-2xs text-muted-foreground tabular-nums">ขายแล้ว {sold}</span>}
                <Switch label="เปิดขาย" checked={item.active} onChange={(e) => patch(item.key, { active: e.target.checked })} className="text-xs text-muted-foreground" />
                <button
                  type="button"
                  aria-label={`ลบสินค้ารายการที่ ${i + 1}`}
                  disabled={sold > 0}
                  onClick={() => setItems((rows) => rows.filter((row) => row.key !== item.key))}
                  className={iconButton}
                >
                  <Icon icon={Delete02Icon} className="size-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
              <Picture item={item} onChange={(change) => patch(item.key, change)} />
              <div className="min-w-0 space-y-4">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
                  <div>
                    <label htmlFor={`${item.key}-name`} className={label}>
                      ชื่อสินค้า
                    </label>
                    <input id={`${item.key}-name`} value={item.name} maxLength={80} onChange={(e) => patch(item.key, { name: e.target.value })} placeholder="เสื้องานรุ่น 2026" className={input} />
                  </div>
                  <div>
                    <label htmlFor={`${item.key}-price`} className={label}>
                      ราคา (บาท)
                    </label>
                    <input
                      id={`${item.key}-price`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={Number.isNaN(item.price) ? "" : item.price}
                      onChange={(e) => patch(item.key, { price: e.target.valueAsNumber })}
                      className={`${input} tabular-nums`}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor={`${item.key}-note`} className={label}>
                    รายละเอียด (ไม่บังคับ)
                  </label>
                  <input id={`${item.key}-note`} value={item.note} maxLength={200} onChange={(e) => patch(item.key, { note: e.target.value })} placeholder="ผ้าคอตตอน รับที่หน้างาน" className={input} />
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${item.key}-limit`} className={label}>
                  จำกัดต่อคำสั่งซื้อ (ชิ้น)
                </label>
                <input
                  id={`${item.key}-limit`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={20}
                  value={Number.isNaN(item.maxPerOrder) ? "" : item.maxPerOrder}
                  onChange={(e) => patch(item.key, { maxPerOrder: e.target.valueAsNumber })}
                  className={`${input} tabular-nums`}
                />
                <p className={hint}>0 = ไม่จำกัด (รวมทุกสินค้าได้สูงสุด 20 ชิ้นต่อคำสั่งซื้อ)</p>
              </div>
              {!hasOptions && (
                <div>
                  <label htmlFor={`${item.key}-stock`} className={label}>
                    จำนวนทั้งหมด
                  </label>
                  <input
                    id={`${item.key}-stock`}
                    type="number"
                    inputMode="numeric"
                    min={only.sold}
                    value={Number.isNaN(only.capacity) ? "" : only.capacity}
                    onChange={(e) => patchOption(item, only.key, { capacity: e.target.valueAsNumber })}
                    className={`${input} tabular-nums`}
                  />
                </div>
              )}
            </div>

            <Switch
              boxed
              label="มีตัวเลือก"
              hint="เช่น ไซส์ สี หรือแบบ แต่ละตัวเลือกมีจำนวนของตัวเอง"
              checked={hasOptions}
              // Options that have sold can't fold back into one stock
              disabled={hasOptions && item.options.filter((o) => o.sold > 0).length > 1}
              onChange={(e) => patch(item.key, e.target.checked ? { optionLabel: "ไซส์" } : { optionLabel: "", options: [item.options.find((o) => o.sold > 0) ?? only] })}
              className="mt-4 text-sm text-foreground"
            />

            {hasOptions && (
              <div className="mt-3 rounded-xl border border-border bg-background/40 p-3 sm:p-3.5">
                <div className="sm:max-w-48">
                  <label htmlFor={`${item.key}-label`} className={label}>
                    ชื่อตัวเลือก
                  </label>
                  <input
                    id={`${item.key}-label`}
                    value={item.optionLabel}
                    maxLength={20}
                    onChange={(e) => patch(item.key, { optionLabel: e.target.value })}
                    onBlur={(e) => !e.target.value.trim() && patch(item.key, { optionLabel: "ตัวเลือก" })}
                    placeholder="ไซส์"
                    className={input}
                  />
                </div>

                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_5.5rem_2.25rem] gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_5rem_2.25rem]">
                  <p className={`${label} mb-0`}>{item.optionLabel}</p>
                  <p className={`${label} mb-0`}>จำนวน</p>
                </div>
                <ul className="space-y-2">
                  {item.options.map((option) => (
                    <li key={option.key} className="grid grid-cols-[minmax(0,1fr)_5.5rem_2.25rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_5rem_2.25rem]">
                      <input
                        aria-label={item.optionLabel}
                        value={option.option}
                        maxLength={40}
                        onChange={(e) => patchOption(item, option.key, { option: e.target.value })}
                        placeholder="M หรือ ดำ / L"
                        className={input}
                      />
                      <input
                        aria-label={`จำนวน ${option.option}`}
                        type="number"
                        inputMode="numeric"
                        min={option.sold}
                        value={Number.isNaN(option.capacity) ? "" : option.capacity}
                        onChange={(e) => patchOption(item, option.key, { capacity: e.target.valueAsNumber })}
                        className={`${input} tabular-nums`}
                      />
                      <span className="text-right text-2xs text-muted-foreground tabular-nums max-sm:hidden">ขายแล้ว {option.sold}</span>
                      <button
                        type="button"
                        aria-label={`ลบ ${option.option}`}
                        disabled={option.sold > 0 || item.options.length === 1}
                        onClick={() => patch(item.key, { options: item.options.filter((o) => o.key !== option.key) })}
                        className={iconButton}
                      >
                        <Icon icon={Delete02Icon} className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => patch(item.key, { options: [...item.options, newOption()] })} className={`${pill} mt-3 h-8 px-3 text-xs`}>
                  <Icon icon={PlusSignIcon} className="size-3.5" />
                  เพิ่มตัวเลือก
                </button>
              </div>
            )}
            {sold > 0 && <p className={hint}>สินค้าที่ขายแล้วลบไม่ได้ เลิกติ๊ก “เปิดขาย” เพื่อเอาออกจากหน้าเว็บ</p>}
          </section>
        );
      })}

      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" onClick={() => setItems((rows) => [...rows, newItem()])} className={pill}>
          <Icon icon={PlusSignIcon} className="size-4" />
          เพิ่มสินค้า
        </button>
        <button type="button" onClick={save} disabled={saving} className={pillPrimary}>
          {saving && <Icon icon={Loading03Icon} className="size-4 animate-spin" />}
          บันทึก
        </button>
      </div>
    </div>
  );
}

/** The item's square picture: click to choose, sent with the save like the event's poster */
function Picture({ item, onChange }: { item: Item; onChange: (change: Partial<Item>) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const shown = item.picked?.url ?? item.image;

  async function take(file: File | undefined) {
    if (!file) return;
    if (!TYPES.includes(file.type)) return setProblem("รองรับเฉพาะ JPG, PNG, GIF และ WebP");
    setBusy(true);
    setProblem(undefined);
    try {
      const ready = await shrinkImage(file);
      if (ready.size > MAX_BYTES) return setProblem("ไฟล์ใหญ่เกิน 10 MB");
      if (item.picked) URL.revokeObjectURL(item.picked.url);
      onChange({ picked: { file: ready, url: URL.createObjectURL(ready) } });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-28">
      <div className="relative">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          aria-label={shown ? "เปลี่ยนรูปสินค้า" : "เพิ่มรูปสินค้า"}
          className={`relative grid size-28 place-items-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-secondary/60 text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground ${busy ? "cursor-wait opacity-60" : ""}`}
        >
          {item.picked ? (
            // A blob: URL for a file not sent yet; next/image has nothing to optimise here
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.picked.url} alt="รูปสินค้าที่เลือก" className="absolute inset-0 size-full object-cover" />
          ) : item.image ? (
            <Image src={item.image} alt="รูปสินค้า" fill sizes="112px" className="object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-center">
              <Icon icon={ImageAdd01Icon} className="size-6" />
              <span className="text-2xs">เพิ่มรูป</span>
            </span>
          )}
        </button>
        {shown && (
          <button
            type="button"
            aria-label="เอารูปสินค้าออก"
            onClick={() => {
              if (item.picked) URL.revokeObjectURL(item.picked.url);
              onChange(item.picked ? { picked: null } : { image: "" });
            }}
            className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/65 text-white transition-colors hover:bg-black/80"
          >
            <Icon icon={Cancel01Icon} className="size-3.5" />
          </button>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept={TYPES.join(",")}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // picking the same file again still counts
          void take(file);
        }}
      />
      {problem && <p className="mt-1 text-2xs text-red-500">{problem}</p>}
    </div>
  );
}
