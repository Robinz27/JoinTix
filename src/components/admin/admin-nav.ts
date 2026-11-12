import {
  Calendar03Icon,
  ChartHistogramIcon,
  Coins01Icon,
  Invoice03Icon,
  DashboardSquare01Icon,
  QrCode01Icon,
  SearchList01Icon,
  ShieldKeyIcon,
  ShoppingBasket01Icon,
  Store01Icon,
  UserMultipleIcon,
  WorkHistoryIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@/components/icon";
import { canAny, type AdminAccess, type Permission } from "@/lib/permissions";

// หลังบ้าน's menu, in groups like next.js-shop's back office. A new admin page adds its link here, with
// what it takes to see it: any one of `needs`, or `superAdmin`. No `needs` means every member of staff.
// Hiding a link is only tidiness; the page checks for itself.

export type AdminLink = { href: string; label: string; icon: IconSvgElement; needs?: readonly Permission[]; superAdmin?: boolean };
export type AdminGroup = { label: string; links: AdminLink[] };

export const ADMIN_NAV: AdminGroup[] = [
  {
    label: "ทั่วไป",
    links: [
      { href: "/admin", label: "ภาพรวม", icon: DashboardSquare01Icon },
      { href: "/admin/reports", label: "รายงาน", icon: ChartHistogramIcon, needs: ["reports.view"] },
    ],
  },
  {
    label: "จัดการ",
    links: [
      { href: "/admin/events", label: "อีเวนต์", icon: Calendar03Icon, needs: ["events.manage"] },
      { href: "/admin/attendees", label: "ผู้ลงทะเบียน", icon: SearchList01Icon, needs: ["attendees.view"] },
      { href: "/admin/payments", label: "ตรวจสลิป", icon: Invoice03Icon, needs: ["payments.review"] },
      { href: "/admin/shops", label: "ร้านค้า", icon: Store01Icon, needs: ["shops.manage"] },
      { href: "/admin/users", label: "สมาชิก", icon: UserMultipleIcon, needs: ["members.manage"] },
      { href: "/admin/roles", label: "สิทธิ์ทีมงาน", icon: ShieldKeyIcon, superAdmin: true },
      { href: "/admin/logs", label: "ประวัติการใช้งาน", icon: WorkHistoryIcon, needs: ["logs.view"] },
    ],
  },
  {
    label: "หน้างาน",
    links: [
      { href: "/admin/scan", label: "สแกนบัตร", icon: QrCode01Icon, needs: ["door.scan"] },
      { href: "/admin/tokens", label: "เติมโทเคน", icon: Coins01Icon, needs: ["tokens.topup", "tokens.adjust"] },
      { href: "/admin/till", label: "ขายที่ร้าน", icon: ShoppingBasket01Icon, needs: ["shops.sell", "shops.manage"] },
    ],
  },
];

/** The menu as this account sees it; a group with nothing left goes too */
export function navFor(access: AdminAccess): AdminGroup[] {
  const allowed = (link: AdminLink) => (link.superAdmin ? access.superAdmin : !link.needs || canAny(access, link.needs));
  return ADMIN_NAV.map((group) => ({ ...group, links: group.links.filter(allowed) })).filter((group) => group.links.length > 0);
}
