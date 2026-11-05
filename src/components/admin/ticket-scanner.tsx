"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import jsQR from "jsqr";
import {
  Alert02Icon,
  Camera01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Coins01Icon,
  Loading03Icon,
  QrCode01Icon,
  Search01Icon,
  Ticket02Icon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";
import { admitTicket, scanTicket } from "@/app/actions/orders";
import { card, input, pill, pillPrimary } from "@/components/admin/ui";
import { Icon, type IconSvgElement } from "@/components/icon";
import type { ScanResult } from "@/lib/orders";

// สแกนบัตร at the door: the back camera reads a ticket's QR (jsQR, which every phone's browser can run,
// iPhones included), or the code under it is typed in; the ticket then shows with its holder in full,
// and "ให้เข้างาน" lets them in once. Camera needs https (the tunnel) or localhost.

type Outcome = { scanned: string; result: ScanResult | null; admitted?: boolean };

const when = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const num = new Intl.NumberFormat("th-TH");
const baht = (n: number) => (n === 0 ? "ฟรี" : `฿${num.format(n)}`);

export function TicketScanner() {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const busy = useRef(false);
  const [camera, setCamera] = useState<"off" | "starting" | "on">("off");
  const [cameraError, setCameraError] = useState<string>();
  const [typed, setTyped] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [checking, startChecking] = useTransition();
  const [admitting, startAdmitting] = useTransition();

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
  }, [camera, outcome]);

  function check(scanned: string) {
    if (busy.current) return;
    busy.current = true;
    navigator.vibrate?.(60);
    startChecking(async () => {
      try {
        setOutcome({ scanned, result: await scanTicket(scanned) });
      } catch {
        setOutcome({ scanned, result: null });
      } finally {
        busy.current = false;
      }
    });
  }

  function admit() {
    if (!outcome?.result) return;
    const { scanned, result } = outcome;
    startAdmitting(async () => {
      const answer = await admitTicket(result.ticket.id, scanned);
      setOutcome({ scanned, result: answer.result, admitted: answer.admitted });
      navigator.vibrate?.(answer.admitted ? [40, 60, 40] : 200);
    });
  }

  const next = () => {
    setOutcome(null);
    setTyped("");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className={`${card} overflow-hidden`}>
        <div className="relative aspect-square w-full bg-black sm:aspect-[4/3]">
          <video ref={video} muted playsInline className={`size-full object-cover ${camera === "on" ? "" : "hidden"}`} />
          <canvas ref={canvas} className="hidden" />
          {camera === "on" ? (
            // The square to hold the QR in
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
              <span className={`size-3/5 rounded-3xl border-4 transition-colors ${checking ? "border-amber-400" : "border-white/80"} shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]`} />
            </span>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white/80">
              <Icon icon={QrCode01Icon} className="size-12" />
              <p className="text-sm">เปิดกล้องแล้วส่อง QR บนบัตรของลูกค้า</p>
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

      <section aria-live="polite">
        {outcome ? (
          <Result outcome={outcome} admitting={admitting} onAdmit={admit} onNext={next} />
        ) : (
          <div className={`${card} flex h-full min-h-48 flex-col items-center justify-center gap-2 p-6 text-center`}>
            <Icon icon={Ticket02Icon} className="size-8 text-muted-foreground" />
            <p className="text-sm text-foreground">ผลการตรวจบัตรจะขึ้นที่นี่</p>
            <p className="text-xs text-muted-foreground">ชื่อลูกค้า ประเภทบัตร จำนวนบัตร โทเคน และสถานะการเข้างาน</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Result({ outcome, admitting, onAdmit, onNext }: { outcome: Outcome; admitting: boolean; onAdmit: () => void; onNext: () => void }) {
  const { result, admitted } = outcome;
  const verdict: { tone: "good" | "warn" | "bad"; icon: IconSvgElement; title: string; detail: string } = !result
    ? { tone: "bad", icon: CancelCircleIcon, title: "ไม่พบบัตรนี้", detail: "QR หรือรหัสไม่ใช่บัตรของ JoinTix อย่าให้เข้างาน" }
    : result.ticket.status === "void"
      ? { tone: "bad", icon: CancelCircleIcon, title: "บัตรถูกยกเลิก", detail: "บัตรใบนี้ใช้เข้างานไม่ได้" }
      : result.ticket.status === "used"
        ? admitted
          ? { tone: "good", icon: CheckmarkCircle02Icon, title: "เข้างานเรียบร้อย", detail: `บันทึกเวลาเข้างาน ${when.format(new Date(result.ticket.checkedInAt!))}` }
          : {
              tone: "warn",
              icon: Alert02Icon,
              title: "บัตรนี้ใช้เข้างานไปแล้ว",
              detail: `เข้างานเมื่อ ${result.ticket.checkedInAt ? when.format(new Date(result.ticket.checkedInAt)) : "-"}${result.ticket.checkedInBy ? ` โดย ${result.ticket.checkedInBy}` : ""}`,
            }
        : { tone: "good", icon: CheckmarkCircle02Icon, title: "บัตรถูกต้อง", detail: "ตรวจชื่อกับลูกค้า แล้วกดให้เข้างาน" };
  const tones = {
    good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    warn: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    bad: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
  };

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

      <div className="flex gap-2 border-t border-border p-4 sm:p-5">
        {result?.ticket.status === "valid" && (
          <button type="button" onClick={onAdmit} disabled={admitting} className={`${pillPrimary} h-11 flex-1 justify-center text-base`}>
            <Icon icon={admitting ? Loading03Icon : UserCheck01Icon} className={`size-5 ${admitting ? "animate-spin" : ""}`} />
            ให้เข้างาน
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
