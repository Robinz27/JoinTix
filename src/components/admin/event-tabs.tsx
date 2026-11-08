"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartHistogramIcon, DeliveryTruck01Icon, InformationCircleIcon, Package01Icon, Store01Icon, Ticket02Icon, UserCheck01Icon, WorkHistoryIcon } from "@hugeicons/core-free-icons";
import { Icon, type IconSvgElement } from "@/components/icon";
import { can, type AdminAccess, type Permission } from "@/lib/permissions";

// The tabs of one event (app/admin/events/[id]/layout.tsx). A new part of running an event goes here, with the
// permission its page asks for.

const TABS: { path: string; label: string; icon: IconSvgElement; needs: Permission }[] = [
  { path: "", label: "ข้อมูลงาน", icon: InformationCircleIcon, needs: "events.manage" },
  { path: "/tickets", label: "บัตร", icon: Ticket02Icon, needs: "events.manage" },
  { path: "/merch", label: "สินค้า", icon: Package01Icon, needs: "events.manage" },
  { path: "/shipments", label: "จัดส่ง", icon: DeliveryTruck01Icon, needs: "merch.ship" },
  { path: "/shops", label: "ร้านค้า", icon: Store01Icon, needs: "shops.manage" },
  { path: "/checkins", label: "ผู้เข้างาน", icon: UserCheck01Icon, needs: "attendees.view" },
  { path: "/reports", label: "รายงาน", icon: ChartHistogramIcon, needs: "reports.view" },
  { path: "/logs", label: "ประวัติ", icon: WorkHistoryIcon, needs: "logs.view" },
];

export function EventTabs({ eventId, access }: { eventId: string; access: AdminAccess }) {
  const pathname = usePathname();
  const base = `/admin/events/${eventId}`;
  const nav = useRef<HTMLElement>(null);
  // On a phone the tabs scroll sideways: keep the one you're on in view
  useEffect(() => {
    nav.current?.querySelector("[aria-current]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);
  return (
    // Scrolls sideways on a phone rather than wrapping, so the page below stays where it is
    <nav ref={nav} aria-label="จัดการอีเวนต์" className="mb-5 flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]">
      {TABS.filter((tab) => can(access, tab.needs)).map((tab) => {
        const href = base + tab.path;
        const on = tab.path ? pathname.startsWith(href) : pathname === href;
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
          </Link>
        );
      })}
    </nav>
  );
}
