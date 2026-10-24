"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown01Icon, Logout03Icon, Ticket01Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/icon";
import { authClient } from "@/lib/auth-client";

export type Account = { name: string; email: string };

const LINKS = [
  { href: "/tickets", label: "บัตรของฉัน", icon: Ticket01Icon },
  { href: "/profile", label: "ข้อมูลบัญชี", icon: UserCircleIcon },
];

/** Signs out through Better Auth's client, so the navbar's session updates at once, then reloads the page data */
export function useSignOut() {
  const router = useRouter();
  return () =>
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/");
          router.refresh();
        },
      },
    });
}

function Avatar({ name, className = "size-6 text-2xs" }: { name: string; className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-foreground ${className}`}>
      {[...name.trim()][0]?.toUpperCase() ?? "?"}
    </span>
  );
}

/** The signed-in visitor's pill in the desktop navbar, opening a small menu */
export function AccountDropdown({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const signOut = useSignOut();

  // Closes on a click outside or Escape
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 max-w-44 shrink-0 items-center gap-2 rounded-full border border-border pr-3 pl-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        <Avatar name={account.name} />
        <span className="truncate">{account.name}</span>
        <Icon icon={ArrowDown01Icon} className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="menu" className="dropdown-pop absolute right-0 mt-2 w-64 rounded-2xl border border-border bg-card p-2 shadow-xl shadow-black/10 dark:shadow-black/40">
          <AccountSummary account={account} />
          <div className="my-1 h-px bg-border" />
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Icon icon={link.icon} className="size-4" />
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
          >
            <Icon icon={Logout03Icon} className="size-4" />
            ออกจากระบบ
          </button>
        </div>
      )}
    </div>
  );
}

/** Name and email with the initial, at the top of the menus */
export function AccountSummary({ account }: { account: Account }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <Avatar name={account.name} className="size-9 text-sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{account.name}</p>
        <p className="truncate text-xs text-muted-foreground">{account.email}</p>
      </div>
    </div>
  );
}

/** The same links as rows, for the phone menu */
export function AccountRows({ onNavigate }: { onNavigate: () => void }) {
  const signOut = useSignOut();
  return (
    <>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          prefetch={false}
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
        >
          <Icon icon={link.icon} className="size-4" />
          {link.label}
        </Link>
      ))}
      <button
        type="button"
        onClick={() => {
          onNavigate();
          signOut();
        }}
        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400"
      >
        <Icon icon={Logout03Icon} className="size-4" />
        ออกจากระบบ
      </button>
    </>
  );
}
