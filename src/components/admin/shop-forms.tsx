"use client";

import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { Delete02Icon, Loading03Icon, PencilEdit02Icon, PlusSignIcon, Store01Icon } from "@hugeicons/core-free-icons";
import { addShopStaff, createShop, deleteShop, deleteShopItem, removeShopStaff, saveShopItem, setShopItemAvailable, updateShop } from "@/app/actions/shops";
import { AdminDialog } from "@/components/admin/dialog";
import { Notice, label } from "@/components/admin/form";
import { iconButton, input, pill, pillPrimary } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { Switch } from "@/components/ui/switch";
import { Hint } from "@/components/ui/hint";
import type { ShopDetail, ShopMenuItem, ShopRole } from "@/lib/shops";
import { num } from "@/lib/format";

// The forms of ร้านค้า (app/admin/shops): add a shop, and on its page change it, its menu and its staff.


function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={pending} className={pillPrimary}>
      {pending && <Icon icon={Loading03Icon} className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function NewShopButton({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${pillPrimary} max-sm:flex-1 max-sm:justify-center`}>
        <Icon icon={PlusSignIcon} className="size-4" />
        เพิ่มร้าน
      </button>
      {open && <NewShopDialog eventId={eventId} onClose={() => setOpen(false)} />}
    </>
  );
}

function NewShopDialog({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const [state, action, pending] = useActionState(createShop, {});
  const ids = useId();
  return (
    <AdminDialog onClose={onClose} icon={Store01Icon} title="เพิ่มร้าน" subtitle="เพิ่มเมนูและพนักงานได้ในขั้นถัดไป" width="28rem">
      <form action={action} className="space-y-4">
        <input type="hidden" name="eventId" value={eventId} />
        <Notice state={state} />
        <div>
          <label htmlFor={`${ids}-name`} className={label}>
            ชื่อร้าน
          </label>
          <input id={`${ids}-name`} name="name" required maxLength={80} placeholder="ร้านข้าวมันไก่ป้าศรี" className={input} />
        </div>
        <div>
          <label htmlFor={`${ids}-note`} className={label}>
            รายละเอียด (ไม่บังคับ)
          </label>
          <input id={`${ids}-note`} name="note" maxLength={200} placeholder="บูธ A3" className={input} />
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" onClick={onClose} className={pill}>
            ยกเลิก
          </button>
          <Submit pending={pending}>เพิ่มร้าน</Submit>
        </div>
      </form>
    </AdminDialog>
  );
}

export function ShopSettings({ shop, sold }: { shop: Pick<ShopDetail, "id" | "name" | "note" | "active">; sold: number }) {
  const [state, action, pending] = useActionState(updateShop, {});
  const [removal, remove, removing] = useActionState(deleteShop, {});
  const ids = useId();
  return (
    <div className="space-y-3 p-4 sm:p-5">
      <form action={action} className="space-y-4">
        <input type="hidden" name="shopId" value={shop.id} />
        <Notice state={state} />
        <div>
          <label htmlFor={`${ids}-name`} className={label}>
            ชื่อร้าน
          </label>
          <input id={`${ids}-name`} name="name" required maxLength={80} defaultValue={shop.name} className={input} />
        </div>
        <div>
          <label htmlFor={`${ids}-note`} className={label}>
            รายละเอียด
          </label>
          <input id={`${ids}-note`} name="note" maxLength={200} defaultValue={shop.note} className={input} />
        </div>
        <Switch boxed name="active" value="1" defaultChecked={shop.active} label="เปิดร้าน" hint="ปิดแล้วขายไม่ได้ แต่ยอดยังอยู่ในรายงาน" className="text-sm text-foreground" />
        <Submit pending={pending}>บันทึก</Submit>
      </form>
      <form action={remove} className="border-t border-border pt-3">
        <input type="hidden" name="shopId" value={shop.id} />
        <input type="hidden" name="from" value="edit" />
        <Notice state={removal} />
        <button
          type="submit"
          disabled={removing || sold > 0}
          className="text-xs text-red-600 hover:underline disabled:text-muted-foreground disabled:no-underline dark:text-red-400"
        >
          {sold > 0 ? "ร้านที่มีรายการขายแล้วลบไม่ได้ ให้ปิดร้านแทน" : "ลบร้านนี้"}
        </button>
      </form>
    </div>
  );
}

/** Adds a menu item, or with `item` changes it. `tokensOnly`: the shop owner's form, the name fixed */
function ItemForm({ shopId, item, onDone, tokensOnly = false }: { shopId: string; item?: ShopMenuItem; onDone?: () => void; tokensOnly?: boolean }) {
  const [state, action, pending] = useActionState(saveShopItem, {});
  const form = useRef<HTMLFormElement>(null);
  const ids = useId();

  useEffect(() => {
    if (!state.ok) return;
    if (onDone) onDone();
    else form.current?.reset();
  }, [state, onDone]);

  return (
    <form ref={form} action={action} className="space-y-2">
      <input type="hidden" name="shopId" value={shopId} />
      {item && <input type="hidden" name="itemId" value={item.id} />}
      {state.error && <Notice state={state} />}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <label htmlFor={`${ids}-name`} className={label}>
            รายการ
          </label>
          <input
            id={`${ids}-name`}
            name="name"
            required
            maxLength={80}
            defaultValue={item?.name}
            placeholder="ข้าวมันไก่"
            readOnly={tokensOnly}
            className={`${input} ${tokensOnly ? "bg-secondary text-muted-foreground" : ""}`}
          />
        </div>
        <div className="w-28">
          <label htmlFor={`${ids}-tokens`} className={label}>
            โทเคน
          </label>
          <input id={`${ids}-tokens`} name="tokens" type="number" inputMode="numeric" required min={1} defaultValue={item?.tokens} className={`${input} tabular-nums`} />
        </div>
        <Submit pending={pending}>{item ? "บันทึก" : "เพิ่ม"}</Submit>
        {onDone && (
          <button type="button" onClick={onDone} className={pill}>
            ยกเลิก
          </button>
        )}
      </div>
    </form>
  );
}

/** `ownerView`: the shop's own owner, who only changes how many tokens each item takes */
export function ShopMenu({ shopId, items, tokenPrice, ownerView = false }: { shopId: string; items: ShopMenuItem[]; tokenPrice: number; ownerView?: boolean }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      {items.length > 0 && (
        <ul className="divide-y divide-border">
          {items.map((item) =>
            editing === item.id ? (
              <li key={item.id} className="px-4 py-3 sm:px-5">
                <ItemForm shopId={shopId} item={item} onDone={() => setEditing(null)} tokensOnly={ownerView} />
              </li>
            ) : (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${item.available ? "text-foreground" : "text-muted-foreground line-through"}`}>{item.name}</p>
                  <p className="text-2xs text-muted-foreground tabular-nums">
                    <span className="text-amber-600 dark:text-amber-400">{num.format(item.tokens)} โทเคน</span> · มูลค่า ฿{num.format(item.tokens * tokenPrice)}
                  </p>
                </div>
                {!ownerView && (
                  <Switch
                    label="มีขาย"
                    checked={item.available}
                    disabled={pending}
                    onChange={(e) => {
                      const available = e.target.checked;
                      start(() => setShopItemAvailable(item.id, available));
                    }}
                    className="gap-1.5 text-2xs text-muted-foreground"
                  />
                )}
                <Hint label={ownerView ? "แก้จำนวนโทเคน" : "แก้ไข"}>
                  <button type="button" aria-label={`แก้ไข ${item.name}`} onClick={() => setEditing(item.id)} className={iconButton}>
                    <Icon icon={PencilEdit02Icon} className="size-4" />
                  </button>
                </Hint>
                {!ownerView && (
                  <Hint label="ลบ">
                    <button
                      type="button"
                      aria-label={`ลบ ${item.name}`}
                      disabled={pending}
                      onClick={() => start(() => deleteShopItem(item.id))}
                      className={`${iconButton} hover:border-red-500/40 hover:text-red-500`}
                    >
                      <Icon icon={Delete02Icon} className="size-4" />
                    </button>
                  </Hint>
                )}
              </li>
            ),
          )}
        </ul>
      )}
      {ownerView ? (
        <p className="border-t border-border px-4 py-3 text-2xs text-muted-foreground sm:px-5">
          {items.length ? "แก้ได้เฉพาะจำนวนโทเคน" : "ยังไม่มีรายการ"} เพิ่ม ลบ หรือเปลี่ยนชื่อรายการได้ที่ผู้จัดงาน
        </p>
      ) : (
        <div className="border-t border-border p-4 sm:px-5">
          <ItemForm shopId={shopId} />
        </div>
      )}
    </>
  );
}

/**
 * A shop's owners or its staff. `role` is which, and the form adds that kind. `readOnly` is the list as an owner
 * sees their fellow owners, who only หลังบ้าน can change.
 */
export function ShopStaff({ shopId, staff, role = "staff", readOnly }: { shopId: string; staff: ShopDetail["staff"]; role?: ShopRole; readOnly?: boolean }) {
  const [state, action, pending] = useActionState(addShopStaff, {});
  const [removing, start] = useTransition();
  const ids = useId();
  const noun = role === "owner" ? "เจ้าของร้าน" : "พนักงาน";
  return (
    <>
      {staff.length > 0 ? (
        <ul className="divide-y divide-border">
          {staff.map((member) => (
            <li key={member.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{member.name}</p>
                <p className="truncate text-2xs text-muted-foreground">{member.email}</p>
              </div>
              {!readOnly && (
                <Hint label="เอาออกจากร้าน">
                  <button
                    type="button"
                    aria-label={`เอา ${member.name} ออกจากร้าน`}
                    disabled={removing}
                    onClick={() => start(() => removeShopStaff(shopId, member.id))}
                    className={`${iconButton} hover:border-red-500/40 hover:text-red-500`}
                  >
                    <Icon icon={Delete02Icon} className="size-4" />
                  </button>
                </Hint>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-xs text-muted-foreground sm:px-5">ยังไม่มี{noun}</p>
      )}
      {!readOnly && (
        <form action={action} className="border-t border-border p-4 sm:px-5">
          <input type="hidden" name="shopId" value={shopId} />
          <input type="hidden" name="role" value={role} />
          <Notice state={state} />
          <label htmlFor={`${ids}-email`} className={label}>
            เพิ่ม{noun}ด้วยอีเมลของบัญชี
          </label>
          <div className="flex gap-2">
            <input id={`${ids}-email`} name="email" type="email" required autoComplete="off" className={`${input} min-w-0 flex-1`} />
            <Submit pending={pending}>เพิ่ม</Submit>
          </div>
        </form>
      )}
    </>
  );
}
