"use client";

import { useState, useTransition } from "react";
import { DeliveryTruck01Icon, Loading03Icon, Undo02Icon } from "@hugeicons/core-free-icons";
import type { AdminFormState } from "@/lib/form";
import { saveShipped, undoShipped } from "@/app/actions/shipments";
import { Notice } from "@/components/admin/form";
import { Badge, card, input, pill, pillPrimary } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { addressLine, merchLabel } from "@/lib/event-fields";
import type { ShipmentRow } from "@/lib/shipments";

// One order to post: who it goes to, what's in it, and the tracking number once it has gone

export function ShipmentCard({ shipment }: { shipment: ShipmentRow }) {
  const [carrier, setCarrier] = useState(shipment.carrier);
  const [tracking, setTracking] = useState(shipment.trackingNo);
  const [state, setState] = useState<AdminFormState>({});
  const [working, start] = useTransition();
  const shipped = Boolean(shipment.shippedAt);

  return (
    <li className={`${card} space-y-3 p-4 sm:p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs text-muted-foreground">{shipment.code}</p>
        <Badge tone={shipped ? "good" : "warn"}>{shipped ? "ส่งแล้ว" : "รอจัดส่ง"}</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 text-sm">
          <p className="font-medium text-foreground">
            {shipment.name} · {shipment.phone}
          </p>
          <p className="text-muted-foreground">{addressLine(shipment)}</p>
          {shipment.buyer !== shipment.name && <p className="mt-1 text-2xs text-muted-foreground">ผู้สั่งซื้อ {shipment.buyer}</p>}
        </div>
        <ul className="min-w-0 space-y-0.5 text-sm text-foreground">
          {shipment.merch.map((item) => (
            <li key={item.id}>
              {merchLabel(item)} × {item.quantity}
            </li>
          ))}
        </ul>
      </div>
      <Notice state={state} />
      <div className="flex flex-wrap gap-2">
        <input aria-label="ขนส่ง" value={carrier} maxLength={60} onChange={(e) => setCarrier(e.target.value)} placeholder="ขนส่ง เช่น ไปรษณีย์ไทย" className={`${input} min-w-0 flex-1 basis-40`} />
        <input aria-label="เลขพัสดุ" value={tracking} maxLength={60} onChange={(e) => setTracking(e.target.value)} placeholder="เลขพัสดุ" className={`${input} min-w-0 flex-1 basis-40 font-mono`} />
        <button
          type="button"
          disabled={working}
          onClick={() => start(async () => setState(await saveShipped(shipment.orderId, carrier, tracking)))}
          className={`${pillPrimary} max-sm:w-full max-sm:justify-center`}
        >
          <Icon icon={working ? Loading03Icon : DeliveryTruck01Icon} className={`size-4 ${working ? "animate-spin" : ""}`} />
          {shipped ? "บันทึกเลขพัสดุ" : "บันทึกว่าส่งแล้ว"}
        </button>
        {shipped && (
          <button type="button" disabled={working} onClick={() => start(() => undoShipped(shipment.orderId))} className={`${pill} max-sm:w-full max-sm:justify-center`}>
            <Icon icon={Undo02Icon} className="size-4" />
            ยังไม่ได้ส่ง
          </button>
        )}
      </div>
    </li>
  );
}
