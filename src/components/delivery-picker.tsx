"use client";

import { useId } from "react";
import { DeliveryTruck01Icon, Store01Icon } from "@hugeicons/core-free-icons";
import { Icon, type IconSvgElement } from "@/components/icon";
import type { ShippingAddress } from "@/lib/event-fields";

// How the merchandise reaches the buyer, in the ticket panel: picked up at the event, or posted to the address typed
// here. Only shown for an event that posts (events.shipping_fee) once something is picked.

const baht = new Intl.NumberFormat("th-TH");
const field = "h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-muted-foreground";

export function DeliveryPicker({
  fee,
  posting,
  onPosting,
  address,
  onAddress,
}: {
  fee: number;
  posting: boolean;
  onPosting: (posting: boolean) => void;
  address: ShippingAddress;
  onAddress: (address: ShippingAddress) => void;
}) {
  const ids = useId();
  const input = (key: keyof ShippingAddress, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="min-w-0">
      <label htmlFor={`${ids}-${key}`} className="mb-1 block text-xs text-muted-foreground">
        {label}
      </label>
      <input id={`${ids}-${key}`} value={address[key]} onChange={(e) => onAddress({ ...address, [key]: e.target.value })} className={field} {...props} />
    </div>
  );

  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-medium text-foreground">รับสินค้าแบบไหน</legend>
      <div className="grid grid-cols-2 gap-2">
        <Choice name={ids} icon={Store01Icon} title="รับที่งาน" note="ฟรี" checked={!posting} onChange={() => onPosting(false)} />
        <Choice name={ids} icon={DeliveryTruck01Icon} title="จัดส่ง" note={fee === 0 ? "ส่งฟรี" : `฿${baht.format(fee)}`} checked={posting} onChange={() => onPosting(true)} />
      </div>
      {posting && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {input("name", "ชื่อผู้รับ", { autoComplete: "name", maxLength: 100 })}
            {input("phone", "เบอร์โทร", { autoComplete: "tel", inputMode: "tel", maxLength: 15 })}
          </div>
          {input("address", "บ้านเลขที่ ถนน หรืออาคาร", { autoComplete: "street-address", maxLength: 300 })}
          <div className="grid grid-cols-2 gap-2">
            {input("subdistrict", "แขวง / ตำบล", { maxLength: 80 })}
            {input("district", "เขต / อำเภอ", { maxLength: 80 })}
            {input("province", "จังหวัด", { autoComplete: "address-level1", maxLength: 80 })}
            {input("postcode", "รหัสไปรษณีย์", { autoComplete: "postal-code", inputMode: "numeric", maxLength: 5 })}
          </div>
        </div>
      )}
    </fieldset>
  );
}

function Choice({ name, icon, title, note, checked, onChange }: { name: string; icon: IconSvgElement; title: string; note: string; checked: boolean; onChange: () => void }) {
  return (
    <label
      className={`relative flex cursor-pointer items-center gap-2.5 rounded-xl border bg-surface px-3 py-2.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foreground ${
        checked ? "border-foreground" : "border-border hover:border-muted-foreground"
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <Icon icon={icon} className="size-5 shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{note}</span>
      </span>
    </label>
  );
}
