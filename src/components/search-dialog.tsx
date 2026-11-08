"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight01Icon,
  Home01Icon,
  Loading03Icon,
  Login03Icon,
  Search01Icon,
  SearchRemoveIcon,
  Ticket01Icon,
  UserAdd01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { Icon, type IconSvgElement } from "@/components/icon";
import { FadeImage } from "@/components/ui/fade-image";
import { Skeleton } from "@/components/ui/skeleton";
import type { EventStatus } from "@/lib/event-fields";
import type { EventSummary } from "@/lib/events";
import { isRemote } from "@/lib/poster";

// The navbar's search (Ctrl/⌘ K), the palette from next.js-shop (4TUNEZ) for the whole site: results come as you
// type, the site's pages matched on Thai and English words, then events, each row the event card in one line.
// Arrow keys move, Enter opens. The events come from /api/search.

type PageLink = { href: string; label: string; hint: string; icon: IconSvgElement; words: string };

const PAGES: PageLink[] = [
  { href: "/tickets", label: "บัตรของฉัน", hint: "บัตรที่ซื้อแล้ว และ QR เข้างาน", icon: Ticket01Icon, words: "tickets ticket บัตร ตั๋ว qr คิวอาร์ คำสั่งซื้อ order" },
  { href: "/profile", label: "ข้อมูลบัญชี", hint: "โทเคนคงเหลือ และยืนยันอีเมล", icon: UserCircleIcon, words: "profile account บัญชี โปรไฟล์ โทเคน token อีเมล email" },
  { href: "/", label: "หน้าแรก", hint: "อีเวนต์แนะนำ", icon: Home01Icon, words: "home หน้าแรก" },
  { href: "/login", label: "เข้าสู่ระบบ", hint: "", icon: Login03Icon, words: "login signin เข้าสู่ระบบ ล็อกอิน" },
  { href: "/register", label: "สมัครสมาชิก", hint: "", icon: UserAdd01Icon, words: "register signup สมัคร" },
  { href: "/forgot-password", label: "ลืมรหัสผ่าน", hint: "ตั้งรหัสใหม่ทางอีเมล", icon: Login03Icon, words: "forgot password reset ลืม รหัสผ่าน" },
];

/** Shown before anything is typed */
const QUICK = ["/tickets", "/profile"];

type Entry = { kind: "page"; href: string; page: PageLink } | { kind: "event"; href: string; event: EventSummary };

function pageEntries(typed: string): Entry[] {
  const needle = typed.toLowerCase();
  const pages = needle ? PAGES.filter((p) => `${p.label} ${p.words}`.toLowerCase().includes(needle)).slice(0, 3) : PAGES.filter((p) => QUICK.includes(p.href));
  return pages.map((page) => ({ kind: "page", href: page.href, page }));
}

type State = { status: "loading" } | { status: "error"; message: string } | { status: "done"; keyword: string; items: EventSummary[] };

// Always Thai time, as on the event cards
const dateFormat = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });
const num = new Intl.NumberFormat("th-TH");

const STATUS: Record<EventStatus, { label: string; tone: string }> = {
  "on-sale": { label: "เปิดขาย", tone: "text-emerald-600 dark:text-emerald-400" },
  "selling-fast": { label: "ใกล้หมด", tone: "text-amber-600 dark:text-amber-400" },
  "coming-soon": { label: "รอเปิดขาย", tone: "text-muted-foreground" },
  "sold-out": { label: "บัตรหมด", tone: "text-red-600 dark:text-red-400" },
  closed: { label: "ปิดการขาย", tone: "text-muted-foreground" },
};

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [state, setState] = useState<State>({ status: "loading" });
  const [active, setActive] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      inputRef.current?.select();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Debounced fetch; the previous request is aborted so a slow answer can't overwrite a newer one
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(
      async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(keyword.trim())}`, { signal: controller.signal });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setState({ status: "done", keyword: keyword.trim(), items: data.items });
          setActive(0);
        } catch (error) {
          if (controller.signal.aborted) return;
          setState({ status: "error", message: error instanceof Error && error.message ? error.message : "ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง" });
        }
      },
      keyword ? 250 : 0,
    );
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [keyword, open]);

  // One list for the arrow keys: pages, then events
  const typed = keyword.trim();
  const pages = pageEntries(typed);
  const found: Entry[] = state.status === "done" ? state.items.map((event) => ({ kind: "event", href: event.href, event })) : [];
  const entries = [...pages, ...found];
  const searching = state.status === "done" && state.keyword !== typed;

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    // On its own, Escape in a search field only clears it, and it takes a second press to close
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (!entries.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + entries.length) % entries.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      router.push(entries[Math.min(active, entries.length - 1)].href);
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      // A click on the backdrop lands on the <dialog> itself
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label="ค้นหาอีเวนต์"
      className="search-dialog m-auto mt-[10vh] w-[calc(100%-1.5rem)] max-w-2xl overflow-hidden rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl shadow-black/30 open:flex open:flex-col"
    >
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
        <Icon icon={Search01Icon} className="size-5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="ค้นหาอีเวนต์ ศิลปิน หรือสถานที่..."
          aria-label="ค้นหาอีเวนต์"
          aria-controls="search-results"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground sm:text-base"
        />
        {searching && <Icon icon={Loading03Icon} className="size-4 shrink-0 animate-spin text-muted-foreground" />}
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดการค้นหา"
          className="shrink-0 rounded-lg border border-border px-2 py-1 text-2xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          ESC
        </button>
      </div>

      <div ref={listRef} id="search-results" aria-live="polite" className="max-h-[min(65dvh,560px)] overflow-y-auto p-2 [scrollbar-width:thin]">
        {pages.length > 0 && (
          <Group title={typed ? "หน้าในเว็บ" : "ไปที่"}>
            {pages.map((entry, i) => (
              <Row key={entry.href} entry={entry} index={i} active={active} setActive={setActive} onClose={onClose} />
            ))}
          </Group>
        )}

        {state.status === "loading" && <ResultsSkeleton />}

        {state.status === "error" && <Empty title={state.message} />}

        {state.status === "done" && entries.length === 0 && <Empty title="ไม่พบสิ่งที่ค้นหา" hint={`ไม่มีอีเวนต์หรือหน้าที่ตรงกับ “${state.keyword}”`} />}

        {found.length > 0 && state.status === "done" && (
          <Group title={state.keyword ? `ผลการค้นหา ${num.format(found.length)} รายการ` : "อีเวนต์ที่กำลังจะมาถึง"}>
            {found.map((entry, i) => (
              <Row key={entry.href} entry={entry} index={pages.length + i} active={active} setActive={setActive} onClose={onClose} />
            ))}
          </Group>
        )}
      </div>

      <div className="hidden items-center gap-4 border-t border-border px-5 py-2.5 text-2xs text-muted-foreground sm:flex">
        <Keys keys={["↑", "↓"]}>เลื่อน</Keys>
        <Keys keys={["↵"]}>เปิด</Keys>
        <Keys keys={["esc"]}>ปิด</Keys>
      </div>
    </dialog>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pb-1">
      <p className="px-3 pt-1 pb-2 text-2xs text-muted-foreground sm:text-xs">{title}</p>
      <ul role="listbox" aria-label={title} className="space-y-1">
        {children}
      </ul>
    </div>
  );
}

function Row({ entry, index, active, setActive, onClose }: { entry: Entry; index: number; active: number; setActive: (i: number) => void; onClose: () => void }) {
  const on = index === active;
  return (
    <li role="option" aria-selected={on} data-index={index}>
      <Link
        href={entry.href}
        onClick={onClose}
        onMouseMove={() => setActive(index)}
        className={`flex items-center gap-3 rounded-xl border p-2 transition-colors ${on ? "border-border bg-secondary/60" : "border-transparent"}`}
      >
        {entry.kind === "event" ? (
          <EventRow event={entry.event} />
        ) : (
          <>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-secondary text-muted-foreground">
              <Icon icon={entry.page.icon} className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{entry.page.label}</p>
              {entry.page.hint && <p className="mt-0.5 truncate text-2xs text-muted-foreground sm:text-xs">{entry.page.hint}</p>}
            </div>
            <Icon icon={ArrowRight01Icon} className={`size-4 shrink-0 text-muted-foreground transition-opacity ${on ? "opacity-100" : "opacity-0"}`} />
          </>
        )}
      </Link>
    </li>
  );
}

function EventRow({ event }: { event: EventSummary }) {
  const status = STATUS[event.status];
  return (
    <>
      <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-secondary">
        <FadeImage src={event.poster} alt="" fill sizes="44px" unoptimized={isRemote(event.poster)} className="object-cover" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{event.title}</p>
        <p className="mt-0.5 truncate text-2xs text-muted-foreground sm:text-xs">
          {dateFormat.format(new Date(event.startsAt))} · {event.venue}
        </p>
      </div>
      <p className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-sm font-semibold whitespace-nowrap tabular-nums">{event.priceFrom === 0 ? "ฟรี" : `฿${num.format(event.priceFrom)}`}</span>
        <span className={`text-2xs whitespace-nowrap ${status.tone}`}>{status.label}</span>
      </p>
    </>
  );
}

function Keys({ keys, children }: { keys: string[]; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex gap-1">
        {keys.map((key) => (
          <kbd key={key} className="grid h-5 min-w-5 place-items-center rounded-md border border-border bg-secondary px-1 font-sans text-2xs text-foreground">
            {key}
          </kbd>
        ))}
      </span>
      {children}
    </span>
  );
}

function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl border border-border bg-secondary text-muted-foreground">
        <Icon icon={SearchRemoveIcon} className="size-6" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-full px-4 text-xs break-words text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-1">
      <Skeleton className="mx-3 mt-1 mb-3 h-3 w-48" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <Skeleton className="h-14 w-11 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-48 max-w-[70%]" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  );
}
