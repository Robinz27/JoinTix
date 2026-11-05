import { Calendar03Icon, DashboardSquare01Icon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@/components/icon";

// หลังบ้าน's menu, in groups like next.js-shop's back office. A new admin page adds its link here.

export type AdminLink = { href: string; label: string; icon: IconSvgElement };
export type AdminGroup = { label: string; links: AdminLink[] };

export const ADMIN_NAV: AdminGroup[] = [
  { label: "ทั่วไป", links: [{ href: "/admin", label: "ภาพรวม", icon: DashboardSquare01Icon }] },
  {
    label: "จัดการ",
    links: [
      { href: "/admin/events", label: "อีเวนต์", icon: Calendar03Icon },
      { href: "/admin/users", label: "สมาชิก", icon: UserMultipleIcon },
    ],
  },
];
