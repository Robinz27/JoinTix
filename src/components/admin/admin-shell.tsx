"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cancel01Icon, Home01Icon, Logout03Icon, Menu01Icon, ShieldUserIcon } from "@hugeicons/core-free-icons";
import { ADMIN_NAV } from "@/components/admin/admin-nav";
import { Initials } from "@/components/admin/ui";
import { useSignOut } from "@/components/account-menu";
import { Icon } from "@/components/icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { Hint } from "@/components/ui/hint";

/**
 * The frame every หลังบ้าน page sits in, after next.js-shop's back office: a fixed menu on the left on a
 * desktop, and on a phone or tablet a top bar whose button slides the same menu in as a drawer.
 */
export function AdminShell({ admin, children }: { admin: { name: string; email: string }; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const signOut = useSignOut();
  // /admin is only the overview; any other link also owns the pages under it
  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <div className="flex min-h-svh">
      {/* Drawer backdrop, only while the menu is open on a small screen */}
      {open && <button type="button" aria-label="ปิดเมนู" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/50 lg:hidden" />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-border bg-secondary text-foreground">
            <Icon icon={ShieldUserIcon} className="size-4" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">JoinTix หลังบ้าน</span>
          <button type="button" onClick={() => setOpen(false)} aria-label="ปิดเมนู" className="text-muted-foreground lg:hidden">
            <Icon icon={Cancel01Icon} className="size-4.5" />
          </button>
        </div>

        <nav aria-label="เมนูหลังบ้าน" className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
          {ADMIN_NAV.map((group) => (
            <div key={group.label} className="mb-2 last:mb-0">
              <p className="px-2 py-1.5 text-2xs font-medium tracking-[0.16em] text-muted-foreground uppercase">{group.label}</p>
              <ul className="mt-0.5 space-y-0.5">
                {group.links.map((link) => {
                  const active = isActive(link.href);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors ${
                          active ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                        }`}
                      >
                        <Icon icon={link.icon} className="size-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{link.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-border p-2.5">
          <div className="flex items-center gap-1 rounded-lg px-1.5 py-1">
            <Initials name={admin.name} className="size-7" />
            <span className="ml-1 min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground">{admin.name}</span>
              <span className="block text-2xs text-muted-foreground">Super admin</span>
            </span>
            <Hint label="กลับหน้าเว็บ">
              <Link href="/" aria-label="กลับหน้าเว็บ" className={footerButton}>
                <Icon icon={Home01Icon} className="size-4" />
              </Link>
            </Hint>
            {/* Quiet like the buttons beside it: no ring, the same 32px */}
            <ThemeToggle className="size-8! border-transparent text-muted-foreground! hover:text-foreground!" />
            <Hint label="ออกจากระบบ">
              <button type="button" onClick={signOut} aria-label="ออกจากระบบ" className={`${footerButton} hover:bg-red-500/10 hover:text-red-500`}>
                <Icon icon={Logout03Icon} className="size-4" />
              </button>
            </Hint>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-3 backdrop-blur sm:px-5 lg:hidden">
          <button type="button" onClick={() => setOpen(true)} aria-label="เปิดเมนู" aria-expanded={open} className="text-foreground">
            <Icon icon={Menu01Icon} className="size-5" />
          </button>
          <span className="truncate text-sm font-semibold text-foreground">หลังบ้าน · JoinTix</span>
        </header>

        <main className="min-w-0 flex-1 px-3 py-5 sm:px-5 sm:py-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

const footerButton =
  "grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";
