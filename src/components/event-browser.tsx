"use client";

import { useDeferredValue, useState, type ReactNode } from "react";
import { Cancel01Icon, Search01Icon, Ticket02Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/icon";
import { isBuyable, type EventStatus } from "@/lib/event-fields";
import { num } from "@/lib/format";

// The /events page's list: a search box and status filters over every event, all in the browser
// (the site has tens of events, not thousands; lib/events.ts getAllEvents() sends them all, cached).
// The cards come already rendered from the server: the browser's Intl writes Thai weekdays differently
// from Node's ("จ." / "จันทร์"), so a card rendered here wouldn't match the HTML and React would complain

/** One event: what the filters look at, and its card (components/event-card.tsx) rendered on the server */
export type BrowsableEvent = { id: string; status: EventStatus; searchText: string; card: ReactNode };

type Filter = "all" | "on-sale" | "coming-soon" | "over";

const FILTERS: { id: Filter; label: string; match: (s: EventStatus) => boolean }[] = [
  { id: "all", label: "ทั้งหมด", match: () => true },
  { id: "on-sale", label: "เปิดขาย", match: isBuyable },
  { id: "coming-soon", label: "รอเปิดขาย", match: (s) => s === "coming-soon" },
  { id: "over", label: "ปิดขาย / บัตรหมด", match: (s) => s === "closed" || s === "sold-out" },
];

/** Every word typed has to be somewhere in the event, like the navbar's search (lib/events.ts searchEvents) */
const matches = (event: BrowsableEvent, words: string[]) => words.every((w) => event.searchText.includes(w));

export function EventBrowser({ events }: { events: BrowsableEvent[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const deferred = useDeferredValue(query);

  const words = deferred.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const found = words.length ? events.filter((e) => matches(e, words)) : events;
  const active = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
  const shown = found.filter((e) => active.match(e.status));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex min-w-0 flex-1 items-center">
          <span className="sr-only">ค้นหาอีเวนต์</span>
          <Icon icon={Search01Icon} className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่องาน สถานที่ ผู้จัด"
            className="h-10 w-full min-w-0 rounded-full border border-border bg-card pr-10 pl-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-foreground/40 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="ล้างคำค้น"
              className="absolute right-2 grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Icon icon={Cancel01Icon} className="size-4" />
            </button>
          )}
        </label>

        <div role="group" aria-label="สถานะการขาย" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const count = found.filter((e) => f.match(e.status)).length;
            const on = f.id === filter;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(f.id)}
                className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors sm:text-sm ${
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-secondary"
                }`}
              >
                {f.label}
                <span className={`tabular-nums ${on ? "opacity-70" : "text-muted-foreground"}`}>{num.format(count)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        พบ {shown.length} อีเวนต์
      </p>

      {shown.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
          <Icon icon={Ticket02Icon} className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">{events.length === 0 ? "ยังไม่มีอีเวนต์" : "ไม่พบอีเวนต์ที่ตรงกับที่ค้นหา"}</p>
          {(query || filter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
              className="mx-auto mt-4 flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              ดูอีเวนต์ทั้งหมด
            </button>
          )}
        </section>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {shown.map((event) => (
            <li key={event.id}>{event.card}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
