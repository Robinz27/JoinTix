"use client";

import { useSyncExternalStore } from "react";

// "12 นาทีที่แล้ว" and "วันนี้ / เมื่อวาน" for ประวัติการใช้งาน. The server can't know when the page will be read, so it
// sends the clock time and the date; the browser swaps in the relative words and keeps them current, once a minute.

const TZ = "Asia/Bangkok";
const clock = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const full = new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeStyle: "medium", timeZone: TZ });
const dayFormat = new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });
const dayKey = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: TZ });

/** The current minute, shared by every timestamp on the page; null while rendering on the server */
const minute = {
  subscribe(change: () => void) {
    const timer = setInterval(change, 30_000);
    return () => clearInterval(timer);
  },
  now: () => Math.floor(Date.now() / 60_000) * 60_000,
  server: () => null,
};
const useNow = () => useSyncExternalStore(minute.subscribe, minute.now, minute.server);

export function TimeAgo({ iso }: { iso: string }) {
  const now = useNow();
  const at = new Date(iso);
  let text = `${clock.format(at)} น.`;
  if (now !== null) {
    const minutes = Math.floor((now - at.getTime()) / 60_000);
    if (minutes < 1) text = "เมื่อสักครู่";
    else if (minutes < 60) text = `${minutes} นาทีที่แล้ว`;
    else if (minutes < 6 * 60) text = `${Math.floor(minutes / 60)} ชั่วโมงที่แล้ว`;
  }
  return (
    <time dateTime={iso} title={full.format(at)} className="tabular-nums">
      {text}
    </time>
  );
}

/** A day's heading: วันนี้, เมื่อวาน, or the date. `day` is YYYY-MM-DD in Thai time */
export function DayLabel({ day }: { day: string }) {
  const now = useNow();
  const [y, m, d] = day.split("-").map(Number);
  const date = dayFormat.format(new Date(Date.UTC(y, m - 1, d, 5)));
  if (now === null) return <>{date}</>;
  if (day === dayKey(new Date(now))) return <>วันนี้</>;
  if (day === dayKey(new Date(now - 86_400_000))) return <>เมื่อวาน</>;
  return <>{date}</>;
}
