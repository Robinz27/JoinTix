"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown01Icon, Calendar03Icon, Globe02Icon, Search01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { tile } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { FadeImage } from "@/components/ui/fade-image";
import type { DoorEvent } from "@/lib/checkins";
import { isRemote } from "@/lib/poster";

// Which event this door scans for (components/admin/ticket-scanner.tsx): a list of the events with their
// posters and dates, in หลังบ้าน's own look rather than the browser's grey drop-down. Typing narrows it by name or
// venue, arrow keys move, Enter picks, Escape closes.

// No weekday: Node and the browsers abbreviate Thai weekdays differently (จันทร์ / จ.), which breaks hydration
const day = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
const time = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

/** Whether an event day is today in Thai time, or already over */
function when(iso: string): "today" | "past" | "soon" {
  const key = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
  const at = new Date(iso);
  const today = key(new Date());
  if (key(at) === today) return "today";
  return key(at) < today ? "past" : "soon";
}

export function DoorPicker({
  events,
  value,
  onChange,
  label = "ประตูนี้สแกนบัตรของงาน",
  allowAll = true,
}: {
  events: DoorEvent[];
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  /** Offers "ทุกงาน" on top; pages that are always about one event leave it out */
  allowAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const ids = useId();
  // "ทุกงาน" first, then each event
  const options: (DoorEvent | null)[] = allowAll ? [null, ...events] : events;
  const chosen = events.find((e) => e.id === value) ?? null;
  const needle = query.trim().toLowerCase();
  const shown = needle ? options.filter((o) => (o ? `${o.title} ${o.venue}` : "ทุกงาน").toLowerCase().includes(needle)) : options;

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
    setActive(Math.max(0, options.findIndex((o) => (o?.id ?? null) === value)));
    setOpen(true);
  };
  const pick = (option: DoorEvent | null) => {
    onChange(option?.id ?? null);
    setOpen(false);
    trigger.current?.focus();
  };
  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setActive((i) => Math.min(shown.length - 1, i + 1));
    else if (e.key === "ArrowUp") setActive((i) => Math.max(0, i - 1));
    else if (e.key === "Enter") {
      if (shown[active] !== undefined) pick(shown[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      trigger.current?.focus();
    } else return;
    e.preventDefault();
  };

  return (
    <div ref={box} className="relative min-w-0 flex-1">
      <p id={`${ids}-label`} className="mb-1.5 text-2xs text-muted-foreground">
        {label}
      </p>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${ids}-label ${ids}-value`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            show();
          }
        }}
        className={`flex w-full items-center gap-3 rounded-xl border bg-input px-2.5 py-2 text-left transition-colors hover:border-muted-foreground ${
          open ? "border-muted-foreground" : "border-border"
        }`}
      >
        <Thumb event={chosen} className="size-11" />
        <span id={`${ids}-value`} className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{chosen ? chosen.title : "ทุกงาน"}</span>
          <span className="block truncate text-2xs text-muted-foreground">
            {chosen ? `${day.format(new Date(chosen.startsAt))} · ${time.format(new Date(chosen.startsAt))} น. · ${chosen.venue}` : "ไม่ตรวจว่าบัตรเป็นของงานไหน"}
          </span>
        </span>
        <Icon icon={ArrowDown01Icon} className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="dialog-pop absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/20">
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
              onKeyDown={onSearchKey}
              placeholder="ค้นหาชื่องานหรือสถานที่..."
              aria-label="ค้นหางาน"
              autoComplete="off"
              className="h-11 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul ref={list} role="listbox" aria-labelledby={`${ids}-label`} className="max-h-72 overflow-y-auto overscroll-contain p-1.5">
          {shown.length === 0 && <li className="px-2 py-6 text-center text-xs text-muted-foreground">ไม่พบงานที่ตรงกับ “{query.trim()}”</li>}
          {shown.map((option, i) => {
            const selected = (option?.id ?? null) === value;
            const tag = option ? when(option.startsAt) : null;
            return (
              <li key={option?.id ?? "all"} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => pick(option)}
                  onPointerMove={() => setActive(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${i === active ? "bg-secondary" : ""}`}
                >
                  <Thumb event={option} className="size-10" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className={`truncate text-sm ${selected ? "font-semibold text-foreground" : "text-foreground"}`}>{option ? option.title : "ทุกงาน"}</span>
                      {tag === "today" && <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-px text-[10px] font-medium text-emerald-700 dark:text-emerald-400">วันนี้</span>}
                      {tag === "past" && <span className="shrink-0 rounded-full bg-secondary px-1.5 py-px text-[10px] text-muted-foreground">จบแล้ว</span>}
                    </span>
                    <span className="block truncate text-2xs text-muted-foreground">
                      {option ? `${day.format(new Date(option.startsAt))} · ${option.venue}` : "ไม่ตรวจว่าบัตรเป็นของงานไหน"}
                    </span>
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

/** The event's poster, or for "ทุกงาน" a plain tile */
function Thumb({ event, className }: { event: DoorEvent | null; className: string }) {
  if (!event)
    return (
      <span className={`${tile} ${className}`}>
        <Icon icon={Globe02Icon} className="size-5" />
      </span>
    );
  return (
    <span className={`relative shrink-0 overflow-hidden rounded-lg bg-secondary ${className}`}>
      {event.poster ? (
        <FadeImage src={event.poster} alt="" fill sizes="44px" unoptimized={isRemote(event.poster)} className="object-cover" />
      ) : (
        <Icon icon={Calendar03Icon} className="absolute inset-0 m-auto size-5 text-muted-foreground" />
      )}
    </span>
  );
}
