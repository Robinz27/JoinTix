"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import jsQR from "jsqr";
import {
  Alert02Icon,
  ArrowRight01Icon,
  Camera01Icon,
  CameraOff01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Coins01Icon,
  FullScreenIcon,
  Loading03Icon,
  QrCode01Icon,
  Search01Icon,
  Package01Icon,
  Ticket02Icon,
  Undo02Icon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";
import { attendeeName, merchLabel } from "@/lib/event-fields";
import { admitTicket, doorFeed, findPickup, giveMerch, givePickup, scanTicket, undoAdmit } from "@/app/actions/orders";
import { DoorPicker } from "@/components/admin/door-picker";
import { FlipCameraButton, ScanFlash, useCamera, useRepeatGuard } from "@/components/admin/qr-reader";
import { ScanBadge } from "@/components/admin/scan-badge";
import { card, input, pill, pillPrimary } from "@/components/admin/ui";
import { Icon, type IconSvgElement } from "@/components/icon";
import type { DoorEvent, DoorScan, DoorStats, LogEntry } from "@/lib/checkins";
import type { PickupResult } from "@/lib/orders";
import { bahtOrFree, num } from "@/lib/format";

// สแกนบัตร at the door: choose the event at this door, then the back camera reads a ticket's QR (jsQR, which
// every phone's browser can run, iPhones included) or the code under it is typed in. The ticket shows with
// its holder in full; "ให้เข้างาน" lets them in once, a ticket for another event is refused, and a mistake
// can be undone. Under the camera: how many are in, and the latest scans (scan_logs). Camera needs https
// (the tunnel) or localhost.
//
// โหมด kiosk: for a screen left at the entrance with its camera on all day. Full screen, the screen kept awake, and
// every good ticket let in by itself (a used one too, when the event allows coming back in): a big green or red
// answer and a sound, then ready for the next person after a few seconds. An order code (JT-XXXXXXXX, the QR on
// บัตรของฉัน for merchandise bought without a ticket) brings up that order to hand its merchandise over.

type Outcome = DoorScan & { scanned: string; undone?: boolean };

const when = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const clock = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Bangkok" });
const DOOR_KEY = "jointix-door-event";
const DOOR_MESSAGES = {
  unsupported: "เบราว์เซอร์นี้เปิดกล้องไม่ได้ (ต้องเปิดเว็บผ่าน https) พิมพ์รหัสบัตรด้านล่างแทน",
  denied: "ไม่ได้รับอนุญาตให้ใช้กล้อง เปิดสิทธิ์กล้องในเบราว์เซอร์ หรือพิมพ์รหัสบัตรด้านล่างแทน",
};
/** How long a kiosk shows its answer before it's ready for the next person */
const KIOSK_HOLD_MS = 3500;
const ORDER_CODE = /^JT-?[A-Z0-9]{8}$/i;

/** A short beep (high and twice for yes, low for no), made by the browser: no sound file to load */
function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = ok ? [880, 1320] : [220];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = ok ? "sine" : "square";
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + (ok ? 0.12 : 0.45));
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    // no sound: the colours still say it
  }
}

export function TicketScanner({ events, initialEvent }: { events: DoorEvent[]; initialEvent: string | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const busy = useRef(false);
  const [door, setDoor] = useState<string | null>(initialEvent);
  const { video, camera, mirrored, error: cameraError, canSwitch, start: startCamera, stop: stopCamera, flip } = useCamera(DOOR_MESSAGES);
  const [flash, setFlash] = useState(0);
  const isNew = useRepeatGuard();
  const [typed, setTyped] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pickup, setPickup] = useState<{ code: string; result: PickupResult | null } | null>(null);
  const [kiosk, setKiosk] = useState(false);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const shell = useRef<HTMLDivElement>(null);
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


  const check = useCallback(
    (scanned: string) => {
      if (busy.current) return;
      busy.current = true;
      navigator.vibrate?.(60);
      startChecking(async () => {
        try {
          // Merchandise bought without a ticket is picked up by its order code
          if (ORDER_CODE.test(scanned)) {
            setOutcome(null);
            setPickup({ code: scanned, result: await findPickup(scanned) });
            return;
          }
          setPickup(null);
          let answer = await scanTicket(scanned, door);
          // A kiosk lets a good ticket in by itself
          if (kiosk && answer.result && (answer.outcome === "valid" || (answer.outcome === "used" && answer.result.allowReentry))) answer = await admitTicket(answer.result.ticket.id, scanned, door);
          setOutcome({ scanned, ...answer });
          if (kiosk) beep(answer.outcome === "admitted");
        } catch {
          setOutcome({ scanned, result: null, outcome: "not_found" });
          if (kiosk) beep(false);
        } finally {
          busy.current = false;
          reload();
        }
      });
    },
    [door, reload, kiosk],
  );

  // A kiosk clears its answer by itself, ready for the next person
  useEffect(() => {
    if (!kiosk || (!outcome && !pickup)) return;
    const timer = setTimeout(() => {
      setOutcome(null);
      setPickup(null);
      setTyped("");
    }, KIOSK_HOLD_MS);
    return () => clearTimeout(timer);
  }, [kiosk, outcome, pickup]);

  async function enterKiosk() {
    setKiosk(true);
    setOutcome(null);
    setPickup(null);
    try {
      await shell.current?.requestFullscreen?.();
    } catch {
      // some browsers (iPhone) have no full screen for a page: it still works, just with the bars showing
    }
    try {
      const lock = (navigator as unknown as { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      wakeLock.current = (await lock?.request("screen")) ?? null;
    } catch {
      // the screen may dim on its own: set it never to sleep in the device's settings
    }
    if (camera === "off") void startCamera();
  }

  function leaveKiosk() {
    setKiosk(false);
    void wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }

  // Leaving full screen with Esc ends kiosk mode too
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && kiosk) {
        setKiosk(false);
        void wakeLock.current?.release().catch(() => {});
        wakeLock.current = null;
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [kiosk]);

  // While the camera is on and nothing is showing, read frames for a QR
  useEffect(() => {
    if (camera !== "on" || outcome || pickup) return;
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
          if (found?.data && isNew(found.data)) {
            setFlash((n) => n + 1);
            check(found.data);
            return;
          }
        }
      }
      frame = requestAnimationFrame(read);
    };
    frame = requestAnimationFrame(read);
    return () => cancelAnimationFrame(frame);
  }, [camera, outcome, pickup, check, isNew, video]);

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

  function handOver() {
    if (!outcome?.result) return;
    const { scanned, result } = outcome;
    startWorking(async () => {
      setOutcome({ scanned, ...(await giveMerch(result.ticket.id, scanned, door)) });
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

  function handOverPickup() {
    if (!pickup?.result) return;
    const { code, result } = pickup;
    startWorking(async () => {
      setPickup({ code, result: await givePickup(result.order.id, code) });
    });
  }

  const next = () => {
    setOutcome(null);
    setPickup(null);
    setTyped("");
  };
  const doorEvent = events.find((e) => e.id === door);

  return (
    <div ref={shell} className={kiosk ? "fixed inset-0 z-50 space-y-4 overflow-auto bg-background p-3 sm:p-6" : "space-y-4"}>
      {kiosk && (
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-lg font-semibold text-foreground">{doorEvent ? doorEvent.title : "สแกนบัตรเข้างาน"}</p>
          <button type="button" onClick={leaveKiosk} className={`${pill} h-9 shrink-0 text-xs`}>
            ออกจากโหมด kiosk
          </button>
        </div>
      )}
      <section className={`${card} flex flex-wrap items-center gap-3 p-3 sm:p-4 ${kiosk ? "hidden" : ""}`}>
        <DoorPicker events={events} value={door} onChange={chooseDoor} />
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
        <button type="button" onClick={enterKiosk} disabled={!door} className={`${pill} h-9 text-xs`} title={door ? undefined : "เลือกงานของประตูก่อน"}>
          <Icon icon={FullScreenIcon} className="size-3.5" />
          โหมด kiosk
        </button>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <section className={`${card} overflow-hidden`}>
            <div className="relative aspect-square w-full bg-black sm:aspect-[4/3]">
              <video ref={video} muted playsInline className={`size-full object-cover ${mirrored ? "-scale-x-100" : ""} ${camera === "on" ? "" : "hidden"}`} />
              <canvas ref={canvas} className="hidden" />
              {camera === "on" && <ScanFlash flash={flash} />}
              {/* A kiosk usually faces the guest with its front camera: switch here, and it's remembered on this device */}
              {camera === "on" && canSwitch && <FlipCameraButton onClick={flip} />}
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
                    placeholder="หรือพิมพ์รหัสบัตร / เลขคำสั่งซื้อ"
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
                <button type="button" onClick={stopCamera} className={`${pill} h-10 w-full justify-center`}>
                  <Icon icon={CameraOff01Icon} className="size-4" />
                  ปิดกล้อง
                </button>
              )}
            </div>
          </section>

          {!kiosk && <RecentScans log={feed.log} door={door} />}
        </div>

        <section aria-live="polite" className="min-w-0">
          {pickup ? (
            <Pickup code={pickup.code} result={pickup.result} working={working} onHandOver={handOverPickup} onNext={next} />
          ) : outcome ? (
            <Result outcome={outcome} working={working} kiosk={kiosk} onAdmit={admit} onUndo={undo} onHandOver={handOver} onNext={next} />
          ) : kiosk ? (
            <div className={`${card} flex h-full min-h-72 flex-col items-center justify-center gap-3 p-6 text-center`}>
              <Icon icon={QrCode01Icon} className="size-16 text-muted-foreground" />
              <p className="text-2xl font-semibold text-foreground">ส่อง QR บัตรเข้างานที่กล้อง</p>
              <p className="text-sm text-muted-foreground">QR อยู่ในอีเมลและหน้า “บัตรของฉัน”</p>
            </div>
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
  kiosk,
  onAdmit,
  onUndo,
  onHandOver,
  onNext,
}: {
  outcome: Outcome;
  working: boolean;
  kiosk: boolean;
  onAdmit: () => void;
  onUndo: () => void;
  onHandOver: () => void;
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
      detail: `เข้างานเมื่อ ${checkedIn}${result?.ticket.checkedInBy ? ` โดย ${result.ticket.checkedInBy}` : ""}${result?.allowReentry ? " · งานนี้ให้กลับเข้างานได้" : ""}`,
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
  const reentry = outcome.outcome === "used" && result?.allowReentry;
  const name = result ? attendeeName(result.attendee) || result.holder.name : "";

  // A kiosk shows the answer big enough to read from where the guest stands, and nothing else
  if (kiosk)
    return (
      <div className={`${card} flex min-h-72 flex-col items-center justify-center gap-3 overflow-hidden border-2 p-6 text-center ${tones[verdict.tone]}`}>
        <Icon icon={verdict.icon} className="size-20" />
        <p className="text-3xl font-bold">{outcome.outcome === "admitted" ? "ยินดีต้อนรับ" : verdict.title}</p>
        {result && <p className="text-2xl font-semibold text-foreground">{name}</p>}
        {result && <p className="text-base text-muted-foreground">{result.zone.name}</p>}
        <p className="text-sm opacity-90">{outcome.outcome === "admitted" ? "เข้างานได้เลย" : verdict.detail}</p>
        {outcome.outcome !== "admitted" && <p className="text-xs text-muted-foreground">ติดต่อเจ้าหน้าที่</p>}
      </div>
    );

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
            <p className="text-2xs text-muted-foreground">ผู้เข้างาน</p>
            <p className="text-xl font-semibold text-foreground">{name}</p>
            <p className="text-sm break-all text-muted-foreground">{result.attendee.email || result.holder.email}</p>
            {name !== result.holder.name && (
              <p className="mt-0.5 text-xs break-all text-muted-foreground">
                ซื้อโดย {result.holder.name} · {result.holder.email} · {result.holder.phone}
              </p>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Fact label="อีเวนต์" wide>
              {result.event.title}
            </Fact>
            <Fact label="ประเภทบัตร">
              {result.zone.name}
              {result.zone.note && <span className="block text-2xs text-muted-foreground">{result.zone.note}</span>}
            </Fact>
            <Fact label="ราคาบัตร">{bahtOrFree(result.order.unitPrice)}</Fact>
            <Fact label="รหัสบัตร">
              <span className="font-mono tracking-wider">{result.ticket.code}</span>
              <span className="block text-2xs text-muted-foreground">
                ใบที่ {result.ticket.seq} จาก {result.order.quantity} ของคำสั่งซื้อ
              </span>
            </Fact>
            <Fact label="คำสั่งซื้อ">
              {result.order.code}
              <span className="block text-2xs text-muted-foreground">
                {result.order.quantity} ใบ · {bahtOrFree(result.order.total)}
              </span>
            </Fact>
            <Fact label="บัตรงานนี้ทั้งหมด">
              {num.format(result.ticketsForEvent)} ใบ
              <span className="block text-2xs text-muted-foreground">เข้างานแล้ว {num.format(result.checkedInForEvent)} ใบ</span>
            </Fact>
            <Fact label="โทเคนบัตรใบนี้">
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Icon icon={Coins01Icon} className="size-4" />
                {num.format(result.tokens)}
              </span>
            </Fact>
          </dl>

          {result.merch.length > 0 && outcome.outcome !== "wrong_event" && (
            <div className="rounded-xl border border-border p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Icon icon={Package01Icon} className="size-4 text-muted-foreground" />
                สินค้าในคำสั่งซื้อนี้
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {result.merch.map((item) => (
                  <li key={item.id} className="flex justify-between gap-3">
                    <span className="min-w-0 text-foreground">
                      {merchLabel(item)} × {item.quantity}
                    </span>
                    <span className={`shrink-0 text-xs ${item.pickedUpAt ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                      {result.posted ? "จัดส่งทางพัสดุ" : item.pickedUpAt ? `รับแล้ว ${clock.format(new Date(item.pickedUpAt))}` : "ยังไม่รับ"}
                    </span>
                  </li>
                ))}
              </ul>
              {!result.posted && result.merch.some((item) => !item.pickedUpAt) && (
                <button type="button" onClick={onHandOver} disabled={working} className={`${pill} mt-3 w-full justify-center`}>
                  <Icon icon={working ? Loading03Icon : Package01Icon} className={`size-4 ${working ? "animate-spin" : ""}`} />
                  ส่งมอบสินค้าแล้ว
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border p-4 sm:p-5">
        {(outcome.outcome === "valid" || reentry) && (
          <button type="button" onClick={onAdmit} disabled={working} className={`${pillPrimary} h-11 flex-1 justify-center text-base`}>
            <Icon icon={working ? Loading03Icon : UserCheck01Icon} className={`size-5 ${working ? "animate-spin" : ""}`} />
            {reentry ? "ให้กลับเข้างาน" : "ให้เข้างาน"}
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

/** An order found by its code at the door: merchandise bought without a ticket, handed over from here */
function Pickup({ code, result, working, onHandOver, onNext }: { code: string; result: PickupResult | null; working: boolean; onHandOver: () => void; onNext: () => void }) {
  const waiting = result?.merch.filter((item) => !item.pickedUpAt) ?? [];
  const problem = !result ? "ไม่พบคำสั่งซื้อนี้" : result.order.status !== "paid" ? "คำสั่งซื้อนี้ยังไม่ได้ชำระเงิน" : result.posted ? "สินค้าของคำสั่งซื้อนี้จัดส่งทางพัสดุ ไม่ได้รับที่งาน" : result.merch.length === 0 ? "คำสั่งซื้อนี้ไม่มีสินค้า" : null;
  return (
    <div className={`${card} overflow-hidden`}>
      <div className={`flex items-center gap-3 border-b p-4 sm:p-5 ${problem ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`}>
        <Icon icon={problem ? CancelCircleIcon : Package01Icon} className="size-9 shrink-0" />
        <div className="min-w-0">
          <p className="text-lg font-semibold">{problem ?? (waiting.length ? "รับสินค้า" : "รับสินค้าครบแล้ว")}</p>
          <p className="font-mono text-xs opacity-90">{result?.order.code ?? code.toUpperCase()}</p>
        </div>
      </div>
      {result && (
        <div className="space-y-3 p-4 sm:p-5">
          <div>
            <p className="text-2xs text-muted-foreground">ผู้ซื้อ</p>
            <p className="text-xl font-semibold text-foreground">{result.buyer.name}</p>
            <p className="text-sm break-all text-muted-foreground">
              {result.buyer.email} · {result.buyer.phone}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{result.event.title}</p>
          </div>
          {result.merch.length > 0 && (
            <ul className="space-y-1 rounded-xl border border-border p-3 text-sm">
              {result.merch.map((item) => (
                <li key={item.id} className="flex justify-between gap-3">
                  <span className="min-w-0 text-foreground">
                    {merchLabel(item)} × {item.quantity}
                  </span>
                  <span className={`shrink-0 text-xs ${item.pickedUpAt ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>{item.pickedUpAt ? `รับแล้ว ${clock.format(new Date(item.pickedUpAt))}` : "ยังไม่รับ"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2 border-t border-border p-4 sm:p-5">
        {!problem && waiting.length > 0 && (
          <button type="button" onClick={onHandOver} disabled={working} className={`${pillPrimary} h-11 flex-1 justify-center`}>
            <Icon icon={working ? Loading03Icon : Package01Icon} className={`size-4 ${working ? "animate-spin" : ""}`} />
            ส่งมอบสินค้าแล้ว
          </button>
        )}
        <button type="button" onClick={onNext} className={`${pill} h-11 flex-1 justify-center`}>
          สแกนใบถัดไป
        </button>
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
