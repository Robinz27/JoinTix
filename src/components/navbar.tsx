"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Book02Icon,
  Cancel01Icon,
  Home01Icon,
  Login03Icon,
  Menu01Icon,
  Search01Icon,
  Ticket02Icon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons";
import { Icon, type IconSvgElement } from "@/components/icon";
import { SearchDialog } from "@/components/search-dialog";
import { ThemeToggle } from "@/components/theme-toggle";

type NavLink = { href: string; label: string; icon: IconSvgElement };

const LINKS: NavLink[] = [
  { href: "/", label: "หน้าแรก", icon: Home01Icon },
  { href: "/events", label: "อีเวนต์", icon: Ticket02Icon },
  { href: "/docs", label: "คู่มือการใช้งาน", icon: Book02Icon },
];

/** Matches menu-lift + the row exit in globals.css */
const MENU_EXIT_MS = 190;

const outlineButton =
  "flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary";
const primaryButton =
  "flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover";
const iconButton =
  "grid size-9 shrink-0 place-items-center rounded-full border border-border text-foreground transition-colors hover:bg-secondary";

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // The panel stays mounted while it animates out, so closing is as smooth as opening
  const [menuClosing, setMenuClosing] = useState(false);
  const closeTimer = useRef(0);
  const [searchOpen, setSearchOpen] = useState(false);

  const closeMenu = useCallback(() => {
    setMenuOpen((open) => {
      if (!open) return false;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
      setMenuClosing(true);
      window.clearTimeout(closeTimer.current);
      closeTimer.current = window.setTimeout(() => {
        setMenuClosing(false);
        setMenuOpen(false);
      }, MENU_EXIT_MS);
      return true;
    });
  }, []);

  const toggleMenu = () => {
    if (menuOpen && !menuClosing) {
      closeMenu();
      return;
    }
    window.clearTimeout(closeTimer.current);
    setMenuClosing(false);
    setMenuOpen(true);
  };

  const openSearch = useCallback(() => {
    closeMenu();
    setSearchOpen(true);
  }, [closeMenu]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // Past the first few pixels the full-width bar turns into a floating pill
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Ctrl/⌘ + K opens search from anywhere
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSearch]);

  return (
    // Outer header keeps a fixed height so the page never jumps when the bar turns into a pill
    <header className="sticky top-0 z-50 h-14">
      <div
        className={`transition-all duration-300 ease-out min-[920px]:mx-auto ${
          scrolled
            ? "mx-3 mt-3 max-w-4xl rounded-full border border-border bg-card/75 px-1 shadow-lg shadow-black/10 backdrop-blur-md dark:shadow-black/40"
            : "mx-auto mt-0 max-w-full border-b border-border bg-background px-0"
        }`}
      >
        <nav
          className={`mx-auto flex max-w-5xl items-center gap-4 px-3 transition-all duration-300 sm:gap-6 sm:px-4 lg:gap-8 xl:max-w-6xl ${
            scrolled ? "h-12 pr-1.5" : "h-14"
          }`}
        >
          <Link href="/" aria-label="JoinTix หน้าแรก" className="flex min-w-0 items-center text-foreground">
            <span className={`font-semibold transition-all duration-300 ${scrolled ? "text-base" : "text-base min-[400px]:text-lg"}`}>
              JoinTix
            </span>
          </Link>

          <ul className="hidden shrink-0 items-center gap-5 text-sm whitespace-nowrap md:flex lg:gap-6">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`flex items-center gap-1.5 transition-colors hover:text-foreground ${
                    isActive(pathname, link.href) ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Icon icon={link.icon} className="size-4" />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="ml-auto hidden shrink-0 items-center gap-2 md:flex">
            {/* Full search field only when there's room, otherwise an icon; both open the search dialog */}
            {!scrolled && (
              <button
                type="button"
                onClick={openSearch}
                aria-label="ค้นหาอีเวนต์ (Ctrl K)"
                aria-haspopup="dialog"
                className="group hidden h-9 w-48 items-center gap-2 rounded-full border border-border bg-secondary/60 pr-3 pl-4 text-left transition-colors hover:border-muted-foreground/60 hover:bg-secondary lg:flex xl:w-56"
              >
                <span className="flex-1 truncate text-sm text-muted-foreground">ค้นหาอีเวนต์...</span>
                <Icon icon={Search01Icon} className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
              </button>
            )}
            <button
              type="button"
              onClick={openSearch}
              aria-label="ค้นหาอีเวนต์ (Ctrl K)"
              aria-haspopup="dialog"
              className={`${iconButton} ${scrolled ? "" : "lg:hidden"}`}
            >
              <Icon icon={Search01Icon} className="size-4" />
            </button>
            <ThemeToggle />
            <Link href="/login" className={outlineButton}>
              <Icon icon={Login03Icon} className="size-4" />
              เข้าสู่ระบบ
            </Link>
            <Link href="/register" className={primaryButton}>
              <Icon icon={UserAdd01Icon} className="size-4" />
              สมัครสมาชิก
            </Link>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 min-[400px]:gap-2 md:hidden">
            <button type="button" onClick={openSearch} aria-label="ค้นหาอีเวนต์" aria-haspopup="dialog" className={iconButton}>
              <Icon icon={Search01Icon} className="size-4" />
            </button>
            {/* Below 400px the toggle lives in the menu so the name has room */}
            <ThemeToggle className="max-[399px]:hidden" />
            <button
              type="button"
              onClick={toggleMenu}
              aria-label={menuOpen && !menuClosing ? "ปิดเมนู" : "เปิดเมนู"}
              aria-expanded={menuOpen && !menuClosing}
              className={iconButton}
            >
              <Icon icon={menuOpen && !menuClosing ? Cancel01Icon : Menu01Icon} className="size-4" />
            </button>
          </div>
        </nav>
      </div>

      {menuOpen && (
        <div
          // --rows lets the exit run bottom-first (globals.css)
          style={{ "--rows": LINKS.length + 2 } as React.CSSProperties}
          className={`mx-3 mt-2 max-h-[min(75dvh,calc(100dvh-6rem))] space-y-2 overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card/95 p-2 shadow-lg shadow-black/10 backdrop-blur-md md:hidden ${
            menuClosing ? "menu-lift" : "menu-drop"
          }`}
        >
          <div>
            {LINKS.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                style={{ "--i": i } as React.CSSProperties}
                className={`menu-row flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-secondary ${
                  isActive(pathname, link.href) ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <Icon icon={link.icon} className="size-4" />
                {link.label}
              </Link>
            ))}
            <ThemeToggle
              variant="row"
              style={{ "--i": LINKS.length } as React.CSSProperties}
              className="menu-row min-[400px]:hidden"
            />
          </div>
          <div className="menu-row flex gap-2 border-t border-border pt-2" style={{ "--i": LINKS.length + 1 } as React.CSSProperties}>
            <Link href="/login" onClick={closeMenu} className={`${outlineButton} flex-1 justify-center`}>
              <Icon icon={Login03Icon} className="size-4" />
              เข้าสู่ระบบ
            </Link>
            <Link href="/register" onClick={closeMenu} className={`${primaryButton} flex-1 justify-center`}>
              <Icon icon={UserAdd01Icon} className="size-4" />
              สมัครสมาชิก
            </Link>
          </div>
        </div>
      )}
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}

/** The link's own page or anything under it (/events/abc lights up อีเวนต์) */
function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
