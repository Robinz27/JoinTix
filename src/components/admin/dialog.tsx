"use client";

import { useEffect, useRef } from "react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { tile } from "@/components/admin/ui";
import { Icon, type IconSvgElement } from "@/components/icon";

/**
 * หลังบ้าน's dialog, after next.js-shop's: a real <dialog>, so the page behind goes inert, focus stays
 * inside and Escape closes it. Mounted means open. `m-auto` puts back the centring Tailwind's preflight
 * removes, and `text-left` stops it inheriting the right-aligned table cell it's rendered from.
 */
export function AdminDialog({
  onClose,
  title,
  subtitle,
  icon,
  /** Flips to true when whatever the dialog was for succeeded, which closes it */
  done = false,
  danger = false,
  width = "34rem",
  children,
}: {
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: IconSvgElement;
  done?: boolean;
  danger?: boolean;
  width?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  // showModal() is what makes it modal; the open attribute alone would only show it
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    if (done && ref.current?.open) ref.current.close();
  }, [done]);

  return (
    <dialog
      ref={ref}
      onClose={(e) => e.target === e.currentTarget && onClose()}
      // A click on the backdrop closes it; one inside the card doesn't
      onClick={(e) => e.target === ref.current && onClose()}
      style={{ width: `min(100% - 1.5rem, ${width})` }}
      className="dialog-pop m-auto rounded-2xl border border-border bg-card p-0 text-left text-foreground shadow-2xl backdrop:bg-black/70"
    >
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className={`${tile} size-10 ${danger ? "border-red-500/30 bg-red-500/10 text-red-500" : ""}`}>
          <Icon icon={icon} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="ปิด"
          className="-mr-1.5 grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Icon icon={Cancel01Icon} className="size-5" />
        </button>
      </div>
      <div className="max-h-[80svh] overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
    </dialog>
  );
}
