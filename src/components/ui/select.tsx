"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown01Icon, Search01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/icon";

// The site's drop-down, in place of the browser's <select>, whose open list can't be styled. Same look as the event
// picker (components/admin/door-picker.tsx). Arrow keys move, Enter picks, Escape closes; a long list gets a search box.

export type SelectOption = { value: string; label: string; /** A smaller second line */ hint?: string };

const SEARCH_FROM = 7;

export function Select({ label, value, options, onChange }: { label: string; value: string; options: SelectOption[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const ids = useId();
  const chosen = options.find((option) => option.value === value);
  const needle = query.trim().toLowerCase();
  const shown = needle ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(needle)) : options;

  // Closes on a click anywhere else
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  // Keeps the highlighted row in view while moving with the keyboard
  useEffect(() => {
    if (open) list.current?.querySelectorAll("li")[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const show = () => {
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const pick = (option: SelectOption) => {
    onChange(option.value);
    close();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      show();
    } else if (e.key === "ArrowDown") setActive((i) => Math.min(shown.length - 1, i + 1));
    else if (e.key === "ArrowUp") setActive((i) => Math.max(0, i - 1));
    else if (e.key === "Enter") {
      if (shown[active]) pick(shown[active]);
    } else if (e.key === "Escape") close();
    else return;
    e.preventDefault();
  };

  return (
    <div ref={box} className="relative min-w-0">
      <p id={`${ids}-label`} className="mb-1.5 block text-xs text-muted-foreground">
        {label}
      </p>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${ids}-label ${ids}-value`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
        className={`flex min-h-10 w-full items-center gap-3 rounded-xl border bg-input px-3.5 py-2 text-left transition-colors hover:border-muted-foreground ${open ? "border-muted-foreground" : "border-border"}`}
      >
        <span id={`${ids}-value`} className="min-w-0 flex-1">
          <span className="block truncate text-sm text-foreground">{chosen?.label ?? "เลือก"}</span>
          {chosen?.hint && <span className="block truncate text-2xs text-muted-foreground">{chosen.hint}</span>}
        </span>
        <Icon icon={ArrowDown01Icon} className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="dialog-pop absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/20">
          {options.length >= SEARCH_FROM && (
            <div className="flex items-center gap-2 border-b border-border px-3.5">
              <Icon icon={Search01Icon} className="size-4 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKey}
                placeholder="ค้นหา..."
                aria-label={`ค้นหา${label}`}
                autoComplete="off"
                className="h-11 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}
          <ul ref={list} role="listbox" aria-labelledby={`${ids}-label`} className="max-h-72 overflow-y-auto overscroll-contain p-1.5">
            {shown.length === 0 && <li className="px-2 py-6 text-center text-xs text-muted-foreground">ไม่พบรายการ</li>}
            {shown.map((option, i) => {
              const selected = option.value === value;
              return (
                <li key={option.value} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => pick(option)}
                    onPointerMove={() => setActive(i)}
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${i === active ? "bg-secondary" : ""}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm text-foreground ${selected ? "font-semibold" : ""}`}>{option.label}</span>
                      {option.hint && <span className="block truncate text-2xs text-muted-foreground">{option.hint}</span>}
                    </span>
                    {selected && <Icon icon={Tick02Icon} className="size-4 shrink-0 text-foreground" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
