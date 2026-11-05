"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft01Icon, ArrowRight01Icon, Calendar03Icon, Cancel01Icon, Clock01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { AdminDialog } from "@/components/admin/dialog";
import { iconButton, pill, pillPrimary, tile } from "@/components/admin/ui";
import { Icon } from "@/components/icon";

// A day and a time picked off หลังบ้าน's own calendar instead of the browser's datetime box (which can't be
// styled, and shows AM/PM or mm/dd on some machines). The calendar, the hour and minute columns and the
// field that opens them are next.js-shop's (components/admin/period-picker.tsx there), so both back offices
// pick dates the same way. Values are "YYYY-MM-DDTHH:mm" in Thai time, the same as a datetime-local input,
// and the field submits one through a hidden input under `name`.

const WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

type DayTone = "picked" | "today" | "plain" | "muted";

const DAY_TONE: Record<DayTone, string> = {
  picked: "bg-primary font-semibold text-primary-foreground",
  today: "text-foreground ring-1 ring-border hover:bg-secondary/70",
  plain: "text-foreground hover:bg-secondary/70",
  muted: "text-muted-foreground/60 hover:bg-secondary/50",
};

/** Now in Thai time, as "YYYY-MM-DDTHH:mm", whatever the computer's own time zone */
const thaiNow = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" }).replace(" ", "T").slice(0, 16);
const isPast = (value: string) => Date.parse(`${value}:00+07:00`) < Date.now();

/** "วันอาทิตย์ที่ 14 ธันวาคม 2569", built from the parts so it reads the same wherever it is rendered */
function dayLabel(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function DateTimeField({
  id,
  name,
  label,
  note,
  defaultValue = "",
  optional,
}: {
  id: string;
  name: string;
  label: string;
  note?: string;
  /** "YYYY-MM-DDTHH:mm" in Thai time, or "" for nothing chosen yet */
  defaultValue?: string;
  /** What an empty value means (e.g. "ขายจนถึงเวลาเริ่มงาน"); set it and the field can be cleared */
  optional?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [picking, setPicking] = useState(false);

  return (
    <div className="min-w-0">
      <p id={`${id}-label`} className="mb-1.5 block text-xs text-muted-foreground">
        {label}
      </p>
      <input type="hidden" name={name} value={value} />
      <div className="flex items-stretch gap-1.5">
        <button
          id={id}
          type="button"
          onClick={() => setPicking(true)}
          aria-labelledby={`${id}-label ${id}`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border bg-input px-3 py-2 text-left transition-colors hover:border-muted-foreground focus-visible:border-muted-foreground focus-visible:outline-none"
        >
          <span className={`${tile} size-8`}>
            <Icon icon={Calendar03Icon} className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-sm ${value ? "text-foreground" : "text-muted-foreground"}`}>
              {value ? `${dayLabel(value.slice(0, 10))}` : optional ? "ไม่กำหนด" : "เลือกวันและเวลา…"}
            </span>
            <span className="block truncate text-2xs text-muted-foreground tabular-nums">
              {value ? `เวลา ${value.slice(11, 16)} น.` : (optional ?? "กดเพื่อเปิดปฏิทิน")}
            </span>
          </span>
          <Icon icon={ArrowRight01Icon} className="size-4 shrink-0 text-muted-foreground" />
        </button>
        {optional && value && (
          <button type="button" onClick={() => setValue("")} aria-label={`ล้าง${label}`} className={`${iconButton} h-auto w-10 rounded-xl`}>
            <Icon icon={Cancel01Icon} className="size-4" />
          </button>
        )}
      </div>
      {note && <p className="mt-1.5 text-2xs text-muted-foreground">{note}</p>}

      {picking && (
        <DateTimeDialog
          value={value}
          title={label}
          onClose={() => setPicking(false)}
          onPick={(picked) => {
            setPicking(false);
            setValue(picked);
          }}
        />
      )}
    </div>
  );
}

function DateTimeDialog({
  value,
  title,
  onPick,
  onClose,
}: {
  value: string;
  title: string;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  const now = thaiNow();
  const opened = STAMP.test(value) ? value : `${now.slice(0, 10)}T19:00`;

  const [day, setDay] = useState(opened.slice(0, 10));
  const [time, setTime] = useState(opened.slice(11, 16));
  const [month, setMonth] = useState(() => new Date(Number(opened.slice(0, 4)), Number(opened.slice(5, 7)) - 1, 1));

  const today = now.slice(0, 10);
  const past = isPast(`${day}T${time}`);

  return (
    <AdminDialog icon={Calendar03Icon} title={title} subtitle="เวลาประเทศไทย (GMT+7)" width="24rem" onClose={onClose}>
      <Calendar
        month={month}
        onMonth={setMonth}
        toneOf={(key, thisMonth) => (key === day ? "picked" : key === today ? "today" : thisMonth ? "plain" : "muted")}
        onPick={(key) => {
          setDay(key);
          // A day that spills in from the month either side brings the calendar with it
          setMonth(new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1));
        }}
      />

      <div className="mt-4">
        <TimeField label="เวลา" value={time} onChange={setTime} />
      </div>

      <p
        className={`mt-3 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs ${
          past ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-secondary/60 text-muted-foreground"
        }`}
      >
        <Icon icon={Clock01Icon} className="mt-0.5 size-4 shrink-0" />
        {dayLabel(day)} {time} น.{past ? " — ผ่านมาแล้ว" : ""}
      </p>

      <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
        <button type="button" onClick={onClose} className={pill}>
          ยกเลิก
        </button>
        <button type="button" onClick={() => onPick(`${day}T${time}`)} className={pillPrimary}>
          <Icon icon={Tick02Icon} className="size-4" />
          ยืนยัน
        </button>
      </div>
    </AdminDialog>
  );
}

function Calendar({
  month,
  onMonth,
  toneOf,
  onPick,
}: {
  month: Date;
  onMonth: (month: Date) => void;
  toneOf: (day: string, thisMonth: boolean) => DayTone;
  onPick: (day: string) => void;
}) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" aria-label="เดือนก่อนหน้า" onClick={() => onMonth(addMonths(month, -1))} className={iconButton}>
          <Icon icon={ArrowLeft01Icon} className="size-4" />
        </button>
        <p className="text-sm font-semibold text-foreground">{month.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}</p>
        <button type="button" aria-label="เดือนถัดไป" onClick={() => onMonth(addMonths(month, 1))} className={iconButton}>
          <Icon icon={ArrowRight01Icon} className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((label) => (
          <span key={label} className="py-1 text-2xs text-muted-foreground">
            {label}
          </span>
        ))}
        {monthGrid(month).map(({ date, thisMonth }) => {
          const key = iso(date);
          const tone = toneOf(key, thisMonth);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(key)}
              aria-pressed={tone === "picked"}
              aria-label={dayLabel(key)}
              className={`h-9 rounded-xl text-sm tabular-nums transition-colors ${DAY_TONE[tone]}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

/** The time as an hour column and a minute column (every 5 minutes) that open underneath, 24-hour clock */
function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [h = "00", m = "00"] = value.split(":");
  return (
    <div className={`overflow-hidden rounded-xl border bg-secondary/40 transition-colors ${open ? "border-muted-foreground" : "border-border"}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 px-3 py-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground tabular-nums">
          {h}:{m} น.
          <Icon icon={Clock01Icon} className="size-3.5 text-muted-foreground" />
        </span>
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-1.5 border-t border-border p-1.5">
          <TimeColumn title="ชั่วโมง" values={HOURS} selected={h} onPick={(v) => onChange(`${v}:${m}`)} />
          <TimeColumn
            title="นาที"
            values={MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort()}
            selected={m}
            onPick={(v) => {
              onChange(`${h}:${v}`);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function TimeColumn({ title, values, selected, onPick }: { title: string; values: string[]; selected: string; onPick: (value: string) => void }) {
  const list = useRef<HTMLDivElement>(null);
  // Opens with the chosen value in the middle, not at 00
  useEffect(() => {
    const box = list.current;
    const chosen = box?.querySelector<HTMLElement>("[aria-pressed='true']");
    if (box && chosen) box.scrollTop = chosen.offsetTop - box.clientHeight / 2 + chosen.clientHeight / 2;
  }, []);
  return (
    <div>
      <p className="px-1 pb-1 text-center text-2xs text-muted-foreground">{title}</p>
      <div ref={list} className="relative max-h-40 space-y-0.5 overflow-y-auto overscroll-contain rounded-lg [scrollbar-width:thin]">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === selected}
            onClick={() => onPick(v)}
            className={`block h-8 w-full rounded-lg text-sm tabular-nums transition-colors ${
              v === selected ? "bg-primary font-semibold text-primary-foreground" : "text-foreground hover:bg-secondary"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Six weeks starting on the Sunday before the first of the month */
function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { date, thisMonth: date.getMonth() === month.getMonth() };
  });
}
