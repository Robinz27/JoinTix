"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins01Icon, ComputerIcon, Store01Icon, Ticket02Icon, UserIcon, WorkHistoryIcon } from "@hugeicons/core-free-icons";
import { Icon, type IconSvgElement } from "@/components/icon";

// The tabs of one member's page (app/admin/users/[id]/layout.tsx), the same strip as an event's tabs. Each says how
// many things are behind it, and ร้านค้า only shows for someone who works at a shop.

type Counts = { orders: number; tokens: number; shops: number; devices: number };

const TABS: { path: string; label: string; icon: IconSvgElement; count?: keyof Counts; logs?: boolean }[] = [
  { path: "", label: "ภาพรวม", icon: UserIcon },
  { path: "/orders", label: "คำสั่งซื้อและบัตร", icon: Ticket02Icon, count: "orders" },
  { path: "/tokens", label: "โทเคน", icon: Coins01Icon },
  { path: "/shops", label: "ร้านค้า", icon: Store01Icon, count: "shops" },
  { path: "/devices", label: "อุปกรณ์", icon: ComputerIcon, count: "devices" },
  { path: "/logs", label: "ประวัติ", icon: WorkHistoryIcon, logs: true },
];

export function MemberTabs({ memberId, logs, counts }: { memberId: string; logs: boolean; counts: Counts }) {
  const pathname = usePathname();
  const base = `/admin/users/${memberId}`;
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    nav.current?.querySelector("[aria-current]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);
  const shown = TABS.filter((tab) => (!tab.logs || logs) && (tab.path !== "/shops" || counts.shops > 0 || pathname.startsWith(`${base}/shops`)));
  return (
    <nav ref={nav} aria-label="ข้อมูลสมาชิก" className="mb-5 flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]">
      {shown.map((tab) => {
        const href = base + tab.path;
        const on = tab.path ? pathname.startsWith(href) : pathname === href;
        const n = tab.count ? counts[tab.count] : null;
        return (
          <Link
            key={tab.path}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors ${
              on ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon icon={tab.icon} className="size-4" />
            {tab.label}
            {n !== null && <span className={`rounded-full px-1.5 text-2xs tabular-nums ${on ? "bg-foreground text-background" : "bg-secondary"}`}>{n.toLocaleString("th-TH")}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
