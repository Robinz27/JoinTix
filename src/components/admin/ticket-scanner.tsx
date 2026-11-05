"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import jsQR from "jsqr";
import {
  Alert02Icon,
  ArrowRight01Icon,
  Camera01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Coins01Icon,
  Loading03Icon,
  QrCode01Icon,
  Search01Icon,
  Ticket02Icon,
  Undo02Icon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";
import { admitTicket, doorFeed, scanTicket, undoAdmit } from "@/app/actions/orders";
import { ScanBadge } from "@/components/admin/scan-badge";
import { card, input, pill, pillPrimary } from "@/components/admin/ui";
import { Icon, type IconSvgElement } from "@/components/icon";
import type { DoorEvent, DoorScan, DoorStats, LogEntry } from "@/lib/checkins";

// สแกนบัตร at the door: choose the event at this door, then the back camera reads a ticket's QR (jsQR, which
// every phone's browser can run, iPhones included) or the code under it is typed in. The ticket shows with
// its holder in full; "ให้เข้างาน" lets them in once, a ticket for another event is refused, and a mistake
// can be undone. Under the camera: how many are in, and the latest scans (scan_logs). Camera needs https
// (the tunnel) or localhost.

type Outcome = DoorScan & { scanned: string; undone?: boolean };

const when = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const clock = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Bangkok" });
const day = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });
const num = new Intl.NumberFormat("th-TH");
const baht = (n: number) => (n === 0 ? "ฟรี" : `฿${num.format(n)}`);
const DOOR_KEY = "jointix-door-event";

export function TicketScanner({ events, initialEvent }: { events: DoorEvent[]; initialEvent: string | null }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const busy = useRef(false);
  const [door, setDoor] = useState<string | null>(initialEvent);
  const [camera, setCamera] = useState<"off" | "starting" | "on">("off");
  const [cameraError, setCameraError] = useState<string>();
  const [typed, setTyped] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [feed, setFeed] = useState<{ stats: DoorStats | null; log: LogEntry[] }>({ stats: null, log: [] });
  const [checking, startChecking] = useTransition();
  const [working, startWorking] = useTransition();

  const reload = useCallback(() => {
    doorFeed(door)
      .then(setFeed)
      .catch(() => {});
  }, [door]);

  // The counts and the latest scans: now, and every few seconds while another door may be scanning too
  useEffect(() => {
    reload();
    const timer = setInterval(reload, 8000);
    return () => clearInterval(timer);
  }, [reload]);

  function chooseDoor(id: string | null) {
    setDoor(id);
    setOutcome(null);
    try {
      if (id) localStorage.setItem(DOOR_KEY, id);
      else localStorage.removeItem(DOOR_KEY);
    } catch {
      // private mode: the choice just isn't remembered
    }
  }

  // The door chosen last time on this device, if it is still one of the events
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DOOR_KEY);
      if (saved && saved !== initialEvent && events.some((e) => e.id === saved)) setTimeout(() => setDoor(saved), 0);
    } catch {
      // nothing remembered
    }
  }, [events, initialEvent]);

  function stopCamera() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setCamera("off");
  }

  async function startCamera() {
    setCameraError(undefined);
    if (!navigator.mediaDevices?.getUserMedia) return setCameraError("เบราว์เซอร์นี้เปิดกล้องไม่ได้ (ต้องเปิดเว็บผ่าน https) พิมพ์รหัสบัตรด้านล่างแทน");
    setCamera("starting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      stream.current = media;
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
      setCamera("on");
    } catch {
      setCamera("off");
      setCameraError("ไม่ได้รับอนุญาตให้ใช้กล้อง เปิดสิทธิ์กล้องในเบราว์เซอร์ หรือพิมพ์รหัสบัตรด้านล่างแทน");
    }
  }

  // Off when leaving the page
  useEffect(() => () => stream.current?.getTracks().forEach((track) => track.stop()), []);

  const check = useCallback(
    (scanned: string) => {
      if (busy.current) return;
      busy.current = true;
      navigator.vibrate?.(60);
      startChecking(async () => {
        try {
          setOutcome({ scanned, ...(await scanTicket(scanned, door)) });
        } catch {
          setOutcome({ scanned, result: null, outcome: "not_found" });
        } finally {
          busy.current = false;
          reload();
        }
      });
    },
    [door, reload],
  );

  // While the camera is on and nothing is showing, read frames for a QR
  useEffect(() => {
    if (camera !== "on" || outcome) return;
    let frame = 0;
    const read = () => {
      const v = video.current;
      const c = canvas.current;
      if (v && c && v.readyState >= 2 && !busy.current) {
        // A smaller copy is plenty for a QR and keeps an old phone quick
        const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
        c.width = Math.round(v.videoWidth * scale);
        c.height = Math.round(v.videoHeight * scale);
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, c.width, c.height);
          const found = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: "dontInvert" });
          if (found?.data) {
            check(found.data);
            return;
          }
        }
      }
      frame = requestAnimationFrame(read);
    };
    frame = requestAnimationFrame(read);
    return () => cancelAnimationFrame(frame);
  }, [camera, outcome, check]);

  function admit() {
    if (!outcome?.result) return;
    const { scanned, result } = outcome;
    startWorking(async () => {
      const answer = await admitTicket(result.ticket.id, scanned, door);
      setOutcome({ scanned, ...answer });
      navigator.vibrate?.(answer.outcome === "admitted" ? [40, 60, 40] : 200);
      reload();
    });
  }

  function undo() {
    if (!outcome?.result) return;
    const { scanned, result } = outcome;
    startWorking(async () => {
      const done = await undoAdmit(result.ticket.id);
      const fresh = await scanTicket(scanned, door);
      setOutcome({ scanned, ...fresh, undone: done });
      reload();
    });
  }

  const next = () => {
    setOutcome(null);
    setTyped("");
  };
  const doorEvent = events.find((e) => e.id === door);

  return (
    <div className="space-y-4">
      <section className={`${card} flex flex-wrap items-center gap-3 p-3 sm:p-4`}>
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-2xs text-muted-foreground">ประตูนี้สแกนบัตรของงาน</span>
          <select
            value={door ?? ""}
            onChange={(e) => chooseDoor(e.target.value || null)}
            className={`${input} cursor-pointer appearance-none pr-8`}
            aria-label="เลือกอีเวนต์ของประตูนี้"
          >
            <option value="">ทุกงาน (ไม่ตรวจว่าบัตรเป็นของงานไหน)</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} · {day.format(new Date(e.startsAt))}
              </option>
            ))}
          </select>
        </label>
        {feed.stats && (
          <div className="flex items-center gap-4">
            <Counter label="บัตรเข้างานแล้ว" value={feed.stats.checkedIn} total={feed.stats.tickets} />
            <Counter label="คนเข้างานแล้ว" value={feed.stats.peopleIn} total={feed.stats.people} />
          </div>
        )}
        {door && (
          <Link href={`/admin/events/${door}/checkins`} className={`${pill} h-9 text-xs`}>
            รายชื่อเข้างาน
            <Icon icon={ArrowRight01Icon} className="size-3.5" />
          </Link>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <section className={`${card} overflow-hidden`}>
            <div className="relative aspect-square w-full bg-black sm:aspect-[4/3]">
              <video ref={video} muted playsInline className={`size-full object-cover ${camera === "on" ? "" : "hidden"}`} />
              <canvas ref={canvas} className="hidden" />
              {camera === "on" ? (
                // The square to hold the QR in
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span
                    className={`size-3/5 rounded-3xl border-4 transition-colors ${checking ? "border-amber-400" : "border-white/80"} shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]`}
                  />
                </span>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white/80">
                  <Icon icon={QrCode01Icon} className="size-12" />
                  <p className="text-sm">{doorEvent ? `สแกนบัตรงาน ${doorEvent.title}` : "เปิดกล้องแล้วส่อง QR บนบัตรของลูกค้า"}</p>
                  <button type="button" onClick={startCamera} disabled={camera === "starting"} className={`${pillPrimary} h-10 px-5`}>
                    <Icon icon={camera === "starting" ? Loading03Icon : Camera01Icon} className={`size-4 ${camera === "starting" ? "animate-spin" : ""}`} />
                    {camera === "starting" ? "กำลังเปิดกล้อง…" : "เปิดกล้องสแกน"}
                  </button>
                </div>
              )}
              {checking && (
                <span className="absolute top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
                  <Icon icon={Loading03Icon} className="size-3.5 animate-spin" />
                  กำลังตรวจบัตร…
                </span>
              )}
            </div>

            <div className="space-y-3 p-4 sm:p-5">
              {cameraError && (
                <p className="flex gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <Icon icon={Alert02Icon} className="mt-px size-3.5 shrink-0" />
                  {cameraError}
                </p>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (typed.trim()) check(typed.trim());
                }}
                className="flex gap-2"
              >
                <div className="relative min-w-0 flex-1">
                  <Icon icon={Search01Icon} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value.toUpperCase())}
                    placeholder="หรือพิมพ์รหัสบัตร เช่น 7KQ3-M9XA"
                    aria-label="รหัสบัตร"
                    autoComplete="off"
                    spellCheck={false}
                    className={`${input} pl-9 font-mono tracking-wider`}
                  />
                </div>
                <button type="submit" disabled={!typed.trim() || checking} className={`${pill} h-10`}>
                  ตรวจบัตร
                </button>
              </form>
              {camera === "on" && (
                <button type="button" onClick={stopCamera} className="text-xs text-muted-foreground hover:text-foreground">
                  ปิดกล้อง
                </button>
              )}
            </div>
          </section>

          <RecentScans log={feed.log} door={door} />
        </div>

        <section aria-live="polite" className="min-w-0">
          {outcome ? (
            <Result outcome={outcome} working={working} onAdmit={admit} onUndo={undo} onNext={next} />
          ) : (
            <div className={`${card} flex h-full min-h-48 flex-col items-center justify-center gap-2 p-6 text-center`}>
              <Icon icon={Ticket02Icon} className="size-8 text-muted-foreground" />
              <p className="text-sm text-foreground">ผลการตรวจบัตรจะขึ้นที่นี่</p>
              <p className="text-xs text-muted-foreground">ชื่อลูกค้า ประเภทบัตร จำนวนบัตร โทเคน และสถานะการเข้างาน</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Counter({ label, value, total }: { label: string; value: number; total: number }) {
  return (
    <div className="text-right">
      <p className="text-2xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground tabular-nums">
        {num.format(value)}
        <span className="text-sm font-normal text-muted-foreground"> / {num.format(total)}</span>
      </p>
    </div>
  );
}

function RecentScans({ log, door }: { log: LogEntry[]; door: string | null }) {
  return (
    <section className={`${card} overflow-hidden`}>
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">สแกนล่าสุด</h2>
        {door && (
          <Link href={`/admin/events/${door}/checkins?tab=log`} className="text-2xs text-muted-foreground hover:text-foreground">
            ดูประวัติทั้งหมด
          </Link>
        )}
      </header>
      {log.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground sm:px-5">ยังไม่มีการสแกน</p>
      ) : (
        <ul className="divide-y divide-border">
          {log.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
              <span className="w-16 shrink-0 text-2xs text-muted-foreground tabular-nums">{clock.format(new Date(entry.at))}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{entry.holder ?? <span className="font-mono text-muted-foreground">{entry.input}</span>}</p>
                <p className="truncate text-2xs text-muted-foreground">
                  {[entry.zone, entry.holder ? entry.input : null, entry.by ? `โดย ${entry.by}` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              <ScanBadge result={entry.result} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Result({
  outcome,
  working,
  onAdmit,
  onUndo,
  onNext,
}: {
  outcome: Outcome;
  working: boolean;
  onAdmit: () => void;
  onUndo: () => void;
  onNext: () => void;
}) {
  const { result, undone } = outcome;
  const checkedIn = result?.ticket.checkedInAt ? when.format(new Date(result.ticket.checkedInAt)) : "-";
  const verdicts: Record<Outcome["outcome"], { tone: "good" | "warn" | "bad"; icon: IconSvgElement; title: string; detail: string }> = {
    not_found: { tone: "bad", icon: CancelCircleIcon, title: "ไม่พบบัตรนี้", detail: "QR หรือรหัสไม่ใช่บัตรของ JoinTix อย่าให้เข้างาน" },
    void: { tone: "bad", icon: CancelCircleIcon, title: "บัตรถูกยกเลิก", detail: "บัตรใบนี้ใช้เข้างานไม่ได้" },
    wrong_event: { tone: "bad", icon: CancelCircleIcon, title: "บัตรของงานอื่น", detail: `บัตรนี้เป็นของ ${result?.event.title ?? "งานอื่น"} ไม่ใช่งานของประตูนี้` },
    used: {
      tone: "warn",
      icon: Alert02Icon,
      title: "บัตรนี้ใช้เข้างานไปแล้ว",
      detail: `เข้างานเมื่อ ${checkedIn}${result?.ticket.checkedInBy ? ` โดย ${result.ticket.checkedInBy}` : ""}`,
    },
    admitted: { tone: "good", icon: CheckmarkCircle02Icon, title: "เข้างานเรียบร้อย", detail: `บันทึกเวลาเข้างาน ${checkedIn}` },
    valid: {
      tone: "good",
      icon: CheckmarkCircle02Icon,
      title: undone ? "ยกเลิกการเช็กอินแล้ว" : "บัตรถูกต้อง",
      detail: undone ? "บัตรกลับเป็นยังไม่เข้างาน ใช้สแกนเข้าได้อีกครั้ง" : "ตรวจชื่อกับลูกค้า แล้วกดให้เข้างาน",
    },
    undone: { tone: "good", icon: Undo02Icon, title: "ยกเลิกการเช็กอินแล้ว", detail: "บัตรกลับเป็นยังไม่เข้างาน" },
  };
  const verdict = verdicts[outcome.outcome];
  const tones = {
    good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    warn: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    bad: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
  };
  const canUndo = result?.ticket.status === "used" && (outcome.outcome === "admitted" || outcome.outcome === "used");

  return (
    <div className={`${card} overflow-hidden`}>
      <div className={`flex items-center gap-3 border-b p-4 sm:p-5 ${tones[verdict.tone]}`}>
        <Icon icon={verdict.icon} className="size-9 shrink-0" />
        <div className="min-w-0">
          <p className="text-lg font-semibold">{verdict.title}</p>
          <p className="text-xs opacity-90">{verdict.detail}</p>
        </div>
      </div>

      {result && (
        <div className="space-y-4 p-4 sm:p-5">
          <div>
            <p className="text-2xs text-muted-foreground">ผู้ถือบัตร</p>
            <p className="text-xl font-semibold text-foreground">{result.holder.name}</p>
            <p className="text-sm break-all text-muted-foreground">
              {result.holder.email} · {result.holder.phone}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Fact label="อีเวนต์" wide>
              {result.event.title}
            </Fact>
            <Fact label="ประเภทบัตร">
              {result.zone.name}
              {result.zone.note && <span className="block text-2xs text-muted-foreground">{result.zone.note}</span>}
            </Fact>
            <Fact label="ราคาบัตร">{baht(result.order.unitPrice)}</Fact>
            <Fact label="รหัสบัตร">
              <span className="font-mono tracking-wider">{result.ticket.code}</span>
              <span className="block text-2xs text-muted-foreground">
                ใบที่ {result.ticket.seq} จาก {result.order.quantity} ของคำสั่งซื้อ
              </span>
            </Fact>
            <Fact label="คำสั่งซื้อ">
              {result.order.code}
              <span className="block text-2xs text-muted-foreground">
                {result.order.quantity} ใบ · {baht(result.order.total)}
              </span>
            </Fact>
            <Fact label="บัตรงานนี้ทั้งหมด">
              {num.format(result.ticketsForEvent)} ใบ
              <span className="block text-2xs text-muted-foreground">เข้างานแล้ว {num.format(result.checkedInForEvent)} ใบ</span>
            </Fact>
            <Fact label="โทเคนคงเหลือ">
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Icon icon={Coins01Icon} className="size-4" />
                {num.format(result.tokens)}
              </span>
            </Fact>
          </dl>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border p-4 sm:p-5">
        {outcome.outcome === "valid" && (
          <button type="button" onClick={onAdmit} disabled={working} className={`${pillPrimary} h-11 flex-1 justify-center text-base`}>
            <Icon icon={working ? Loading03Icon : UserCheck01Icon} className={`size-5 ${working ? "animate-spin" : ""}`} />
            ให้เข้างาน
          </button>
        )}
        <button type="button" onClick={onNext} className={`${pill} h-11 flex-1 justify-center`}>
          สแกนใบถัดไป
        </button>
        {canUndo && (
          <button
            type="button"
            onClick={onUndo}
            disabled={working}
            className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            <Icon icon={Undo02Icon} className="size-4" />
            ยกเลิกการเช็กอิน (กดให้เข้างานผิดใบ)
          </button>
        )}
      </div>
    </div>
  );
}

function Fact({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 rounded-xl bg-secondary/50 px-3 py-2.5 ${wide ? "col-span-2" : ""}`}>
      <dt className="text-2xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{children}</dd>
    </div>
  );
}
