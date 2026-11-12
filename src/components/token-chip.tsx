"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight01Icon, Coins01Icon, QrCodeIcon, Ticket01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/icon";
import { QrDialog } from "@/components/ticket-qr";
import type { EventWallet, WalletTicket } from "@/lib/orders";
import { num } from "@/lib/format";

// The token chip in the navbar: how many tokens the signed-in visitor has at the event that's on now (or next), always
// in sight while they buy food at the event. Opens a menu with each ticket's own tokens (every ticket is its own wallet)
// and its QR, for paying at a shop straight away. Hidden for anyone without a ticket. Asked for again on every page
// change and every 30 seconds while the tab is in view, so a top-up or a sale shows soon after it happens.

const REFRESH_MS = 30_000;

export function TokenChip({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const [wallets, setWallets] = useState<EventWallet[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<{ ticket: WalletTicket; title: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  // How far the menu moves right so it stays on screen: on a phone the chip sits away from the edge

  const [shift, setShift] = useState(0);

  const load = useCallback(() => {
    fetch("/api/tokens/mine", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { events: [] }))
      .then((data: { events: EventWallet[] }) => setWallets(Array.isArray(data.events) ? data.events : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load, pathname]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Closes on a click outside or Escape, like the account menu
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !menu.current) return;
    const left = menu.current.getBoundingClientRect().left - shift;
    const next = left < 12 ? 12 - left : 0;
    if (next !== shift) setShift(next);
  }, [open, shift]);

  if (wallets.length === 0) return null;
  // The event picked in the menu, or the one on now / next
  const wallet = wallets.find((w) => w.id === eventId) ?? wallets[0];
  const owing = wallet.total < 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`โทเคน ${num.format(wallet.total)} ของงาน ${wallet.title}`}
        className={`flex shrink-0 items-center gap-1.5 rounded-full border font-medium tabular-nums transition-colors ${
          compact ? "h-9 px-2.5 text-xs" : "h-9 px-3 text-sm"
        } ${
          owing
            ? "border-red-500/30 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-300"
            : "border-border bg-card text-foreground hover:bg-secondary"
        }`}
      >
        <Icon icon={Coins01Icon} className={`size-4 shrink-0 ${owing ? "" : "text-muted-foreground"}`} />
        {num.format(wallet.total)}
      </button>

      {open && (
        <div
          ref={menu}
          role="menu"
          // Sized like 4TUNEZ's account menu (next.js-shop components/account-menu.tsx): 256px wide, p-1.5, text-sm rows
          style={{ width: "min(16rem, calc(100vw - 1.5rem))", translate: shift ? `${shift}px 0` : undefined }}
          className="dropdown-pop absolute right-0 z-50 mt-2 rounded-2xl border border-border bg-card p-1.5 shadow-xl shadow-black/10 dark:shadow-black/40"
        >
          {wallets.length > 1 && (
            <div className="flex gap-1 overflow-x-auto px-1.5 pt-1.5 pb-1" role="group" aria-label="เลือกงาน">
              {wallets.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setEventId(w.id)}
                  className={`max-w-32 shrink-0 truncate rounded-full px-2 py-0.5 text-2xs transition-colors ${
                    w.id === wallet.id ? "bg-foreground font-medium text-background" : "border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {w.title}
                </button>
              ))}
            </div>
          )}

          <div className="px-3 py-2">
            <p className="truncate text-xs text-muted-foreground">โทเคนรวม · {wallet.title}</p>
            <p className={`mt-0.5 flex items-center gap-1.5 text-lg font-semibold tabular-nums ${owing ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
              <Icon icon={Coins01Icon} className="size-4" />
              {num.format(wallet.total)}
            </p>
            {owing && <p className="text-2xs text-red-600 dark:text-red-400">ยอดติดลบ ติดต่อเคาน์เตอร์เติมโทเคน</p>}
          </div>
          <div className="my-1 h-px bg-border" />

          {wallet.tickets.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setQr({ ticket, title: wallet.title });
              }}
              aria-label={`แสดง QR ของ ${ticket.name} (${num.format(ticket.tokens)} โทเคน)`}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left transition-colors hover:bg-secondary"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{ticket.name}</span>
                <span className="block truncate text-2xs text-muted-foreground">
                  {ticket.zone} · <span className="font-mono">{ticket.code}</span>
                </span>
              </span>
              <span className={`shrink-0 text-sm font-medium tabular-nums ${ticket.tokens < 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{num.format(ticket.tokens)}</span>
              <Icon icon={QrCodeIcon} className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}

          <div className="my-1 h-px bg-border" />
          <p className="px-3 py-1 text-2xs text-muted-foreground">กดที่บัตรเพื่อแสดง QR ให้ร้านสแกน แต่ละใบใช้โทเคนของตัวเอง แลกคืนเป็นเงินไม่ได้</p>
          <Link
            href="/tickets"
            prefetch={false}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Icon icon={Ticket01Icon} className="size-4" />
            <span className="flex-1">ดูบัตรทั้งหมด</span>
            <Icon icon={ArrowRight01Icon} className="size-4" />
          </Link>
        </div>
      )}

      {qr && (
        <QrDialog
          secret={qr.ticket.secret}
          code={qr.ticket.code}
          title={qr.title}
          label={`${qr.ticket.name} · ${qr.ticket.zone} · โทเคน ${num.format(qr.ticket.tokens)}`}
          used={false}
          note="ยื่นให้ร้านสแกนเพื่อตัดโทเคน หรือที่เคาน์เตอร์เพื่อเติม เพิ่มความสว่างหน้าจอถ้าสแกนไม่ติด"
          onClose={() => setQr(null)}
        />
      )}
    </div>
  );
}
