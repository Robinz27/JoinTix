"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cancel01Icon, FilterHorizontalIcon, Loading03Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { DateTimeField } from "@/components/admin/date-time-field";
import { card, input, pill, pillPrimary } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { Select, type SelectOption } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AUDIT_ACTIONS, AUDIT_GROUPS, LOG_RANGES, isAuditAction, logQuery, type LogFilters as Filters, type LogRange } from "@/lib/audit-actions";

// The filters over ประวัติการใช้งาน. Only the search box shows until "ตัวกรอง" opens the rest; a choice applies at once
// (no extra button to press), and what's in use stays visible as chips with an ✕. Every view is a URL, so it can be
// bookmarked or sent to someone.

const stampLabel = (value: string) => {
  const [day, time] = value.split("T");
  const [y, m, d] = day.split("-").map(Number);
  return `${new Date(y, m - 1, d).toLocaleDateString("th-TH", { day: "numeric", month: "short" })} ${time}`;
};

export function LogFilters({
  action,
  filters,
  actors,
  events,
  hideEvent = false,
}: {
  /** The page it's on; filtered views are this path with a query */
  action: string;
  filters: Filters;
  actors: { id: string; name: string; email: string; role: string }[];
  events: { id: string; title: string; startsAt: string }[];
  /** On an event's own tab the event is already chosen */
  hideEvent?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(Boolean(filters.from || filters.to));
  const go = (next: Filters) => startTransition(() => router.push(`${action}${logQuery(next)}`));
  const set = (patch: Partial<Filters>) => go({ ...filters, ...patch });

  const group = filters.action?.startsWith("group:") ? filters.action.slice(6) : filters.action && isAuditAction(filters.action) ? AUDIT_ACTIONS[filters.action].group : "";
  const groupOptions: SelectOption[] = [{ value: "", label: "ทุกหมวด" }, ...AUDIT_GROUPS.map((g) => ({ value: g.key, label: g.label }))];
  const actionOptions: SelectOption[] = [
    { value: "", label: "ทุกอย่างในหมวดนี้" },
    ...Object.entries(AUDIT_ACTIONS)
      .filter(([, meta]) => meta.group === group)
      .map(([key, meta]) => ({ value: key, label: meta.label })),
  ];
  const actorOptions: SelectOption[] = [
    { value: "", label: "ทุกคน" },
    { value: "system", label: "ระบบ", hint: "งานอัตโนมัติ เช่น หมดเวลาชำระ ส่งอีเมล" },
    { value: "anon", label: "ผู้ที่ไม่ได้เข้าสู่ระบบ", hint: "เช่น ล็อกอินด้วยอีเมลที่ไม่มีบัญชี" },
    ...actors.map((a) => ({ value: a.id, label: a.name || a.email, hint: `${a.email} · ${a.role}` })),
  ];
  const eventOptions: SelectOption[] = [
    { value: "", label: "ทุกอีเวนต์" },
    ...events.map((e) => ({ value: e.id, label: e.title, hint: new Date(e.startsAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }) })),
  ];

  // What's in use, each with the view without it
  const chips: { label: string; without: Filters }[] = [];
  if (filters.q) chips.push({ label: `ค้นหา “${filters.q}”`, without: { ...filters, q: undefined } });
  if (filters.actor) chips.push({ label: `โดย ${actorOptions.find((o) => o.value === filters.actor)?.label ?? "บัญชีนี้"}`, without: { ...filters, actor: undefined } });
  if (filters.action)
    chips.push({
      label: filters.action.startsWith("group:") ? `หมวด ${groupOptions.find((o) => o.value === group)?.label}` : (AUDIT_ACTIONS[filters.action as keyof typeof AUDIT_ACTIONS]?.label ?? filters.action),
      without: { ...filters, action: undefined },
    });
  if (filters.eventId && !hideEvent) chips.push({ label: `งาน ${eventOptions.find((o) => o.value === filters.eventId)?.label ?? ""}`, without: { ...filters, eventId: undefined } });
  if (filters.range) chips.push({ label: LOG_RANGES.find((r) => r.value === filters.range)!.label, without: { ...filters, range: undefined } });
  if (!filters.range && (filters.from || filters.to))
    chips.push({ label: `${filters.from ? stampLabel(filters.from) : "เริ่มต้น"} – ${filters.to ? stampLabel(filters.to) : "ตอนนี้"}`, without: { ...filters, from: undefined, to: undefined } });
  if (filters.all) chips.push({ label: "แสดงทุกอย่าง", without: { ...filters, all: undefined } });
  const cleared: Filters = { user: filters.user, eventId: hideEvent ? filters.eventId : undefined };

  return (
    <div className={`${card} mb-4 p-3 sm:p-4`}>
      <div className="flex gap-2">
        <form
          role="search"
          className="relative min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            set({ q: String(new FormData(e.currentTarget).get("q") ?? "").trim() || undefined });
          }}
        >
          <Icon icon={pending ? Loading03Icon : Search01Icon} className={`pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground ${pending ? "animate-spin" : ""}`} />
          <input key={filters.q ?? ""} name="q" type="search" defaultValue={filters.q} placeholder="ค้นหาในประวัติ" aria-label="ค้นหาในประวัติ: ชื่อ อีเมล ชื่องาน รหัสบัตร หรือค่าที่เปลี่ยน" className={`${input} pl-9`} />
        </form>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`${open ? pillPrimary : pill} h-10`}>
          <Icon icon={FilterHorizontalIcon} className="size-4" />
          <span className="max-[379px]:sr-only">ตัวกรอง</span>
          {chips.length > 0 && <span className="tabular-nums">({chips.length})</span>}
        </button>
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <Link
              key={chip.label}
              href={`${action}${logQuery(chip.without)}`}
              aria-label={`เอาตัวกรอง ${chip.label} ออก`}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-secondary py-1 pr-1.5 pl-3 text-xs text-foreground transition-colors hover:border-muted-foreground"
            >
              <span className="truncate">{chip.label}</span>
              <Icon icon={Cancel01Icon} className="size-3.5 shrink-0 text-muted-foreground" />
            </Link>
          ))}
          <Link href={`${action}${logQuery(cleared)}`} className="px-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            ล้างทั้งหมด
          </Link>
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div className={`grid gap-3 sm:grid-cols-2 ${hideEvent ? "" : "lg:grid-cols-3"}`}>
            <Select label="ใครทำ" value={filters.actor ?? ""} options={actorOptions} onChange={(v) => set({ actor: v || undefined })} />
            {!hideEvent && <Select label="อีเวนต์" value={filters.eventId ?? ""} options={eventOptions} onChange={(v) => set({ eventId: v || undefined })} />}
            <Select label="หมวด" value={group} options={groupOptions} onChange={(v) => set({ action: v ? `group:${v}` : undefined })} />
            {group && (
              <Select label="การกระทำ" value={filters.action?.startsWith("group:") ? "" : (filters.action ?? "")} options={actionOptions} onChange={(v) => set({ action: v || `group:${group}` })} />
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">ช่วงเวลา</p>
            <div className="flex flex-wrap gap-1.5">
              {[{ value: "", label: "ทั้งหมด" }, ...LOG_RANGES].map((r) => {
                const on = !custom && (filters.range ?? "") === r.value && (r.value !== "" || !(filters.from || filters.to));
                return (
                  <button
                    key={r.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setCustom(false);
                      set({ range: (r.value || undefined) as LogRange | undefined, from: undefined, to: undefined });
                    }}
                    className={`${pill} h-8 px-3 text-xs ${on ? "border-foreground/40 bg-secondary text-foreground" : "text-muted-foreground"}`}
                  >
                    {r.label}
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={custom}
                onClick={() => setCustom(true)}
                className={`${pill} h-8 px-3 text-xs ${custom ? "border-foreground/40 bg-secondary text-foreground" : "text-muted-foreground"}`}
              >
                กำหนดเอง
              </button>
            </div>
            {custom && (
              <form
                className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  set({ range: undefined, from: String(form.get("from") || "") || undefined, to: String(form.get("to") || "") || undefined });
                }}
              >
                <DateTimeField id="log-from" name="from" label="ตั้งแต่" defaultValue={filters.from ?? ""} optional="ไม่กำหนด" />
                <DateTimeField id="log-to" name="to" label="ถึง" defaultValue={filters.to ?? ""} optional="ตอนนี้" />
                <button type="submit" className={`${pillPrimary} h-10 justify-center`}>
                  ใช้ช่วงนี้
                </button>
              </form>
            )}
          </div>

          <Switch
            boxed
            checked={Boolean(filters.all)}
            onChange={(e) => set({ all: e.currentTarget.checked || undefined })}
            label="แสดงทุกอย่าง"
            hint="ปกติซ่อนรายการที่เกิดบ่อยแต่ไม่ได้เปลี่ยนข้อมูล: สแกนบัตร เข้า/ออกจากระบบ ส่งอีเมล ดาวน์โหลด CSV"
          />
        </div>
      )}
    </div>
  );
}
