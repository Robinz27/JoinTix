"use client";

import { useSyncExternalStore } from "react";
import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/icon";
import { DEFAULT_THEME, getTheme, setTheme, subscribeTheme } from "@/lib/theme";

export function ThemeToggle({
  variant = "icon",
  className = "",
  style,
}: {
  /** "row" is a full-width menu item with a label, for the phone menu. */
  variant?: "icon" | "row";
  className?: string;
  /** Used by the phone menu to give this row its place in the stagger */
  style?: React.CSSProperties;
}) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => DEFAULT_THEME);
  const next = theme === "dark" ? "light" : "dark";
  const label = theme === "dark" ? "เปลี่ยนเป็นธีมสว่าง" : "เปลี่ยนเป็นธีมมืด";
  // Both icons are drawn and CSS picks one from the <html> class, so the right icon shows before hydration
  const icons = (
    <>
      <Icon icon={Sun03Icon} className="hidden size-4 dark:block" />
      <Icon icon={Moon02Icon} className="size-4 dark:hidden" />
    </>
  );

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        style={style}
        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-secondary ${className}`}
      >
        {icons}
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={theme === "dark" ? "ธีมสว่าง" : "ธีมมืด"}
      style={style}
      className={`grid size-9 shrink-0 place-items-center rounded-full border border-border text-foreground transition-colors hover:bg-secondary ${className}`}
    >
      {icons}
    </button>
  );
}
