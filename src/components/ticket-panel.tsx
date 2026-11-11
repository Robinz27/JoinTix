"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { InformationCircleIcon, Loading03Icon, MinusSignIcon, Package01Icon, PlusSignIcon, Ticket02Icon } from "@hugeicons/core-free-icons";
import { DeliveryPicker } from "@/components/delivery-picker";
import { Icon } from "@/components/icon";
import { startCheckout } from "@/app/actions/orders";
import { VerifyEmailCode } from "@/components/verify-email-code";
import { authClient } from "@/lib/auth-client";
import { EMPTY_ADDRESS, addressProblem, isBuyable, merchLabel, type EventStatus, type ShippingAddress } from "@/lib/event-fields";
import type { EventMerch, TicketZone } from "@/lib/events";
import { isRemote } from "@/lib/poster";
import { num } from "@/lib/format";

/** At or under this many left, the zone says how many */
const FEW_LEFT = 20;
/** All merchandise together in one order (lib/orders.ts) */
const MAX_MERCH = 20;

function price(value: number) {
  return value === 0 ? "ฟรี" : `฿${num.format(value)}`;
}

/**
 * Ticket picker on the event page: choose a zone and how many (or no ticket, just merchandise), see the total, then
 * on to checkout, where the buyer says who each ticket is for and pays. Buying needs a signed-in account with a
 * verified email (components/verify-email-code.tsx asks for it here).
 */
export function TicketPanel({
  slug,
  status,
  zones,
  merch,
  shippingFee,
  maxPerOrder,
  salesStart,
  children,
}: {
  /** For coming back here after signing in */
  slug: string;
  status: EventStatus;
  zones: TicketZone[];
  /** What can be added to the order */
  merch: EventMerch[];
  /** Baht to post it; null when it's only picked up at the event */
  shippingFee: number | null;
  maxPerOrder: number;
  salesStart: string;
  /** Under everything else in the card (the share row) */
  children?: React.ReactNode;
}) {
  const onSale = isBuyable(status);
  const [zoneId, setZoneId] = useState(() => (onSale ? zones.find((zone) => zone.remaining > 0)?.id : undefined));
  const [quantity, setQuantity] = useState(1);
  /** How many of each option, by its id */
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [posting, setPosting] = useState(false);
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS);
  const [error, setError] = useState<string>();
  const [buying, startBuying] = useTransition();
  // One per press of ซื้อบัตร, so a double press makes one order (lib/orders.ts)
  const [key, setKey] = useState(() => crypto.randomUUID());
  const { data: session, isPending, refetch } = authClient.useSession();

  // With merchandise on sale, no ticket at all is a choice too: someone who only wants the shirt
  const minQuantity = merch.length > 0 ? 0 : 1;
  const zone = zones.find((z) => z.id === zoneId);
  const tickets = zone ? quantity : 0;
  const maxQuantity = zone ? Math.min(maxPerOrder, zone.remaining) : 1;
  const merchLines = merch.flatMap((item) =>
    item.options.filter((o) => picks[o.id] > 0).map((o) => ({ id: o.id, label: merchLabel({ ...item, option: o.option }), quantity: picks[o.id], price: item.price })),
  );
  const merchCount = merchLines.reduce((n, line) => n + line.quantity, 0);
  // Only something to post once something's picked
  const delivery = posting && shippingFee !== null && merchLines.length > 0;
  const total = (zone ? zone.price * tickets : 0) + merchLines.reduce((n, line) => n + line.price * line.quantity, 0) + (delivery ? shippingFee : 0);

  function pick(id: string) {
    setZoneId(id);
    setError(undefined);
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
                {z.tokens > 0 && <span className="mt-0.5 block text-2xs font-medium text-amber-600 dark:text-amber-400">+{num.format(z.tokens)} โทเคน / ใบ</span>}
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

      {onSale && (zone || merch.length > 0) && (
        <>
          {zone && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                จำนวนบัตร
                {minQuantity === 0 && quantity === 0 && <span className="block text-2xs">ไม่ซื้อบัตร ซื้อสินค้าอย่างเดียว</span>}
              </span>
              <Stepper label="บัตร" value={quantity} min={minQuantity} max={maxQuantity} onChange={setQuantity} />
            </div>
          )}

          {merch.length > 0 && (
            <div className="mt-4 space-y-4 border-t border-border pt-4">
              <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Icon icon={Package01Icon} className="size-4 text-muted-foreground" />
                สินค้าเพิ่มเติม
                {shippingFee === null && <span className="text-xs font-normal text-muted-foreground">รับที่หน้างาน</span>}
              </p>
              {merch.map((item) => (
                <MerchPicker key={item.id} item={item} picks={picks} room={MAX_MERCH - merchCount} onPick={(id, value) => setPicks((all) => ({ ...all, [id]: value }))} />
              ))}
              {shippingFee !== null && merchLines.length > 0 && (
                <DeliveryPicker
                  fee={shippingFee}
                  posting={posting}
                  onPosting={(next) => {
                    setPosting(next);
                    setError(undefined);
                    // Most people post to themselves
                    if (next && session) setAddress((a) => ({ ...a, name: a.name || session.user.name, phone: a.phone || ((session.user as { phone?: string }).phone ?? "") }));
                  }}
                  address={address}
                  onAddress={setAddress}
                />
              )}
            </div>
          )}

          <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
            {zone && tickets > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>
                  {zone.name} × {tickets}
                </span>
                <span className="tabular-nums">{price(zone.price * tickets)}</span>
              </div>
            )}
            {merchLines.map((line) => (
              <div key={line.id} className="flex justify-between gap-3 text-muted-foreground">
                <span className="min-w-0">
                  {line.label} × {line.quantity}
                </span>
                <span className="shrink-0 tabular-nums">{price(line.price * line.quantity)}</span>
              </div>
            ))}
            {delivery && (
              <div className="flex justify-between text-muted-foreground">
                <span>ค่าจัดส่ง</span>
                <span className="tabular-nums">{price(shippingFee)}</span>
              </div>
            )}
            {zone && zone.tokens > 0 && tickets > 0 && (
              <div className="flex justify-between text-amber-600 dark:text-amber-400">
                <span>ได้รับโทเคน (ใบละ {num.format(zone.tokens)})</span>
                <span className="tabular-nums">+{num.format(zone.tokens * tickets)}</span>
              </div>
            )}
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
            disabled={(tickets === 0 && merchLines.length === 0) || buying}
            onClick={() =>
              startBuying(async () => {
                const problem = delivery ? addressProblem(address) : null;
                setError(problem ?? undefined);
                if (problem) return;
                const result = await startCheckout({
                  slug,
                  zoneId: tickets > 0 ? zone!.id : "",
                  quantity: tickets,
                  merch: merchLines.map((line) => ({ variantId: line.id, quantity: line.quantity })),
                  delivery: delivery ? address : null,
                  key,
                });
                // Only an answer that isn't the redirect to checkout arrives here
                if (result?.error) setError(result.error);
                setKey(crypto.randomUUID());
              })
            }
            className="btn-buy flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium disabled:cursor-not-allowed"
          >
            <Icon icon={buying ? Loading03Icon : Ticket02Icon} className={`size-4 ${buying ? "animate-spin" : ""}`} />
            {buying ? "กำลังล็อกให้…" : tickets === 0 ? "ซื้อสินค้า" : "ซื้อบัตร"}
          </button>
        )}
      </div>

      <p role="status" className={`mt-3 flex gap-1.5 text-xs ${error ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
        <Icon icon={InformationCircleIcon} className="mt-px size-3.5 shrink-0" />
        {error ?? "กดซื้อแล้วระบบจะล็อกไว้ให้ 15 นาที ระหว่างกรอกข้อมูลผู้เข้างานและชำระเงิน โทเคนใช้แทนเงินสดในงาน แลกคืนเป็นเงินไม่ได้"}
      </p>
      {children}
    </div>
  );
}

/** One item on sale with the tickets: its options, or a single count when it has none */
function MerchPicker({ item, picks, room, onPick }: { item: EventMerch; picks: Record<string, number>; /** How many more the order can take */ room: number; onPick: (id: string, value: number) => void }) {
  const inItem = item.options.reduce((n, o) => n + (picks[o.id] ?? 0), 0);
  const left = (remaining: number) => (remaining === 0 ? "หมดแล้ว" : remaining <= FEW_LEFT ? `เหลือ ${remaining}` : "");
  const stepper = (option: EventMerch["options"][number]) => {
    const count = picks[option.id] ?? 0;
    const itemRoom = item.maxPerOrder > 0 ? item.maxPerOrder - inItem : Infinity;
    const label = merchLabel({ ...item, option: option.option });
    return <Stepper label={label} value={count} min={0} max={count + Math.max(0, Math.min(option.remaining - count, room, itemRoom))} onChange={(value) => onPick(option.id, value)} />;
  };
  const single = item.optionLabel === "" ? item.options[0] : null;

  return (
    <div>
      <div className="flex gap-3">
        <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-secondary text-muted-foreground">
          {item.image ? <Image src={item.image} alt="" fill sizes="56px" unoptimized={isRemote(item.image)} className="object-cover" /> : <Icon icon={Package01Icon} className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline justify-between gap-3 text-sm font-medium text-foreground">
            <span className="min-w-0">{item.name}</span>
            <span className="shrink-0 tabular-nums">{price(item.price)}</span>
          </p>
          {item.note && <p className="mt-0.5 text-xs text-muted-foreground">{item.note}</p>}
          {item.maxPerOrder > 0 && <p className="mt-0.5 text-2xs text-muted-foreground">ไม่เกิน {item.maxPerOrder} ชิ้นต่อคำสั่งซื้อ</p>}
        </div>
      </div>
      {single ? (
        <div className="mt-2 flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{left(single.remaining)}</span>
          {stepper(single)}
        </div>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {item.options.map((option) => (
            <li key={option.id} className="flex items-center justify-between gap-3 text-sm">
              <span className={`min-w-0 ${option.remaining === 0 ? "text-muted-foreground" : "text-foreground"}`}>
                {item.optionLabel} {option.option}
                {left(option.remaining) && ` · ${left(option.remaining)}`}
              </span>
              {stepper(option)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** − n + */
function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const step = "flex size-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-surface p-1">
      <button type="button" aria-label={`ลดจำนวน ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(value - 1, min))} className={step}>
        <Icon icon={MinusSignIcon} />
      </button>
      <output aria-live="polite" className="w-8 text-center text-sm font-medium tabular-nums text-foreground">
        {value}
      </output>
      {/* Clamped too, since quick clicks can land before the button re-renders as disabled */}
      <button type="button" aria-label={`เพิ่มจำนวน ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(value + 1, max))} className={step}>
        <Icon icon={PlusSignIcon} />
      </button>
    </div>
  );
}
