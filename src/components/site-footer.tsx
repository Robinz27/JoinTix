import Link from "next/link";
import {
  Book02Icon,
  CustomerService01Icon,
  Home01Icon,
  HelpCircleIcon,
  LockPasswordIcon,
  Login03Icon,
  MoneyReceive02Icon,
  Ticket01Icon,
  Ticket02Icon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons";
import { FooterWordmark } from "@/components/footer-wordmark";
import { Icon, type IconSvgElement } from "@/components/icon";

// Site footer, from next.js-shop (after Aceternity's "simple footer with four grids"): name and copyright
// on the left, link groups on the right, and the name as a big faded wordmark underneath.

type FooterLink = { label: string; href: string; icon: IconSvgElement };

const SITE_NAME = "JoinTix";

const GROUPS: { title: string; links: FooterLink[] }[] = [
  {
    title: "เมนู",
    links: [
      { label: "หน้าแรก", href: "/", icon: Home01Icon },
      { label: "อีเวนต์ทั้งหมด", href: "/events", icon: Ticket02Icon },
      { label: "บัตรของฉัน", href: "/tickets", icon: Ticket01Icon },
    ],
  },
  {
    title: "ช่วยเหลือ",
    links: [
      { label: "คู่มือการใช้งาน", href: "/docs", icon: Book02Icon },
      { label: "คำถามที่พบบ่อย", href: "/faq", icon: HelpCircleIcon },
      { label: "นโยบายการคืนบัตร", href: "/refund-policy", icon: MoneyReceive02Icon },
      { label: "ติดต่อเรา", href: "/contact", icon: CustomerService01Icon },
    ],
  },
  {
    title: "บัญชีของฉัน",
    links: [
      { label: "สมัครสมาชิก", href: "/register", icon: UserAdd01Icon },
      { label: "เข้าสู่ระบบ", href: "/login", icon: Login03Icon },
      { label: "ลืมรหัสผ่าน", href: "/forgot-password", icon: LockPasswordIcon },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-border bg-background">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 pt-12 pb-6 sm:px-6 md:flex-row md:justify-between md:pt-16 xl:max-w-6xl">
        <div className="max-w-sm space-y-3">
          <Link href="/" className="inline-flex font-semibold text-foreground">
            {SITE_NAME}
          </Link>
          <p className="text-sm text-muted-foreground">
            © <CopyrightYear /> {SITE_NAME}. สงวนลิขสิทธิ์
          </p>
          <p className="text-sm text-muted-foreground">กดบัตรคอนเสิร์ต อีเวนต์ และงานเลี้ยงรุ่น ไว ไม่มีซ้ำ</p>
        </div>

        <nav aria-label="ลิงก์ท้ายเว็บ" className="grid grid-cols-2 gap-x-10 gap-y-8 sm:gap-x-16 lg:grid-cols-3 lg:gap-x-12">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="mb-3 text-sm font-semibold text-foreground">{group.title}</h2>
              <ul className="space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    {/* Most of these pages aren't built yet: don't prefetch them (a 404 prefetch logs an error) */}
                    <Link
                      href={link.href}
                      prefetch={false}
                      className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Icon icon={link.icon} className="size-4 shrink-0" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <FooterWordmark text={SITE_NAME} />
    </footer>
  );
}

/** Cached, so the footer stays part of the static page; a new year shows up once the cache refreshes */
async function CopyrightYear() {
  "use cache";
  return <>{new Date().getFullYear()}</>;
}
