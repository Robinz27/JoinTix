"use client";

import { useState } from "react";
import Link from "next/link";
import { InformationCircleIcon, MinusSignIcon, PlusSignIcon, Ticket02Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/icon";
import { VerifyEmailCode } from "@/components/verify-email-code";
import { authClient } from "@/lib/auth-client";
import { isBuyable, type EventStatus } from "@/lib/event-fields";
import type { TicketZone } from "@/lib/events";

const baht = new Intl.NumberFormat("th-TH");
/** At or under this many left, the zone says how many */
const FEW_LEFT = 20;

function price(value: number) {
  return value === 0 ? "ฟรี" : `฿${baht.format(value)}`;
}

/**
 * Ticket picker on the event page: choose a zone and how many, see the total, then go on to book.
 * Buying needs a signed-in account with a verified email (components/verify-email-code.tsx asks for it here).
 * Booking itself (Redis seat lock → order) isn't built yet, so "continue" only says so for now.
 */
export function TicketPanel({
  slug,
  status,
  zones,
  maxPerOrder,
  salesStart,
}: {
  /** For coming back here after signing in */
  slug: string;
  status: EventStatus;
  zones: TicketZone[];
  maxPerOrder: number;
  salesStart: string;
}) {
  const onSale = isBuyable(status);
  const [zoneId, setZoneId] = useState(() => (onSale ? zones.find((zone) => zone.remaining > 0)?.id : undefined));
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState(false);
  const { data: session, isPending, refetch } = authClient.useSession();

  const zone = zones.find((z) => z.id === zoneId);
  const maxQuantity = zone ? Math.min(maxPerOrder, zone.remaining) : 1;
  const total = zone ? zone.price * quantity : 0;

  function pick(id: string) {
    setZoneId(id);
    setNotice(false);
    // Keep the count within what the new zone allows
    const next = zones.find((z) => z.id === id);
    if (next) setQuantity((q) => Math.min(q, Math.min(maxPerOrder, next.remaining)));
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-medium text-foreground">
        <Icon icon={Ticket02Icon} className="size-5" />
        เลือกบัตร
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        {status === "coming-soon"
          ? `เปิดขาย ${salesStart}`
          : status === "sold-out"
            ? "บัตรงานนี้หมดแล้ว"
            : status === "closed"
              ? "ปิดการขายแล้ว"
            : `ซื้อได้สูงสุด ${maxPerOrder} ใบต่อบัญชี`}
      </p>

      <fieldset disabled={!onSale} className="space-y-2">
        <legend className="sr-only">โซนบัตร</legend>
        {zones.map((z) => {
          const soldOut = z.remaining === 0;
          const selected = z.id === zoneId;
          return (
            <label
              key={z.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-surface px-3.5 py-3 transition-colors has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foreground ${
                selected ? "border-foreground" : "border-border hover:border-muted-foreground"
              }`}
            >
              <input
                type="radio"
                name="zone"
                value={z.id}
                checked={selected}
                disabled={soldOut}
                onChange={() => pick(z.id)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${selected ? "border-foreground" : "border-muted-foreground"}`}
              >
                {selected && <span className="size-2 rounded-full bg-foreground" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{z.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{z.note}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-medium text-foreground">{price(z.price)}</span>
                <span className="block text-xs text-muted-foreground">
                  {soldOut ? "หมดแล้ว" : z.remaining <= FEW_LEFT ? `เหลือ ${z.remaining} ใบ` : "ว่าง"}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {onSale && zone && (
        <>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">จำนวน</span>
            <div className="flex items-center gap-1 rounded-full border border-border bg-surface p-1">
              <button
                type="button"
                aria-label="ลดจำนวน"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(q - 1, 1))}
                className="flex size-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Icon icon={MinusSignIcon} />
              </button>
              <output aria-live="polite" className="w-8 text-center text-sm font-medium tabular-nums text-foreground">
                {quantity}
              </output>
              <button
                type="button"
                aria-label="เพิ่มจำนวน"
                disabled={quantity >= maxQuantity}
                // Clamped too, since quick clicks can land before the button re-renders as disabled
                onClick={() => setQuantity((q) => Math.min(q + 1, maxQuantity))}
                className="flex size-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Icon icon={PlusSignIcon} />
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>
                {zone.name} × {quantity}
              </span>
              <span className="tabular-nums">{price(zone.price * quantity)}</span>
            </div>
            <div className="flex justify-between text-base font-medium text-foreground">
              <span>รวม</span>
              <span className="tabular-nums">{price(total)}</span>
            </div>
          </div>
        </>
      )}

      <div className="mt-4">
        {!onSale ? (
          <span className="btn-buy is-disabled flex h-11 items-center justify-center rounded-xl text-sm font-medium">
            {status === "sold-out" ? "บัตรหมดแล้ว" : status === "closed" ? "ปิดการขายแล้ว" : "ยังไม่เปิดขาย"}
          </span>
        ) : isPending ? (
          <span className="skeleton block h-11 rounded-xl" aria-hidden="true" />
        ) : !session ? (
          <Link
            href={`/login?next=${encodeURIComponent(`/events/${slug}`)}`}
            className="btn-buy flex h-11 items-center justify-center rounded-xl text-sm font-medium"
          >
            เข้าสู่ระบบเพื่อซื้อบัตร
          </Link>
        ) : !session.user.emailVerified ? (
          // Tickets go to this email, so it must be the buyer's: verify once, here or on /profile
          <VerifyEmailCode email={session.user.email} onVerified={() => refetch()} />
        ) : (
          <button
            type="button"
            disabled={!zone}
            onClick={() => setNotice(true)}
            className="btn-buy flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium disabled:cursor-not-allowed"
          >
            <Icon icon={Ticket02Icon} className="size-4" />
            ซื้อบัตร
          </button>
        )}
      </div>

      <p role="status" className="mt-3 flex gap-1.5 text-xs text-muted-foreground">
        <Icon icon={InformationCircleIcon} className="mt-px size-3.5 shrink-0" />
        {notice
          ? "ระบบจองและชำระเงินยังอยู่ระหว่างพัฒนา เร็วๆ นี้จะกดต่อไปหน้าชำระเงินได้"
          : "กดซื้อแล้วระบบจะล็อกบัตรไว้ให้ 10 นาที ระหว่างชำระเงิน"}
      </p>
    </div>
  );
}
