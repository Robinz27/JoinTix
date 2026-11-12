"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  Alert02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  ImageUploadIcon,
  Loading03Icon,
  PencilEdit02Icon,
  RefreshIcon,
  SmartPhone01Icon,
  Tick02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { cancelCheckout, checkoutStatus, confirmFreeOrder, openPhoneSlip, saveCheckoutAttendees, sendSlip, sendSlipFromPhone } from "@/app/actions/orders";
import { Icon } from "@/components/icon";
import { attendeeName, attendeesProblem, EMPTY_ATTENDEE, type Attendee } from "@/lib/event-fields";
import { shrinkImage } from "@/lib/shrink-image";
import { readSlipQr } from "@/lib/slip-qr";
import { baht } from "@/lib/format";

// The checkout's lower half, in order: who each ticket is for, then the PromptPay QR and the slip (from this
// device, or the buyer's phone through a one-time QR), or "รอตรวจสลิป" once a slip is in. The rules are in
// lib/orders.ts and lib/payments.ts; this only asks.

/** True once in the browser: the dialog is portalled to document.body, which the server render doesn't have */
const noSubscribe = () => () => {};
const useClient = () => useSyncExternalStore(noSubscribe, () => true, () => false);

const pad = (n: number) => String(n).padStart(2, "0");
const field =
  "h-10 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-foreground/40";

export type CheckoutPay = { qr: string; name: string; account: string } | null;

export function CheckoutPanel({
  orderId,
  status,
  expiresAt,
  slug,
  total,
  quantity,
  attendees: saved,
  buyer,
  pay,
  rejected,
}: {
  orderId: string;
  status: "pending" | "review" | "cancelled" | "expired" | "paid";
  expiresAt: string;
  slug: string;
  total: number;
  quantity: number;
  attendees: Attendee[];
  buyer: { name: string; email: string };
  /** The PromptPay QR (a data: URL) and whose account it is; null when the event hasn't set one */
  pay: CheckoutPay;
  /** Why the last slip was turned down, when it was */
  rejected: string | null;
}) {
  const router = useRouter();
  const [left, setLeft] = useState<number | null>(null);
  const [cancelling, startCancelling] = useTransition();
  const ready = quantity === 0 || attendeesProblem(saved, quantity) === null;
  const [editing, setEditing] = useState(!ready);

  // Counted in the browser only, so the server's HTML and the first render agree
  useEffect(() => {
    if (status !== "pending") return;
    const tick = () => setLeft(Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, status]);

  // While a slip waits to be checked, look again every few seconds; the page moves on to the tickets when it's paid
  useEffect(() => {
    if (status !== "review") return;
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [status, router]);

  const lapsed = status === "expired" || (status === "pending" && left === 0);
  if (status === "cancelled" || lapsed) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 text-center sm:p-5">
        <Icon icon={Alert02Icon} className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium text-foreground">{status === "cancelled" ? "ยกเลิกคำสั่งซื้อแล้ว" : "หมดเวลาชำระเงิน"}</p>
        <p className="mt-1 text-xs text-muted-foreground">{rejected && status === "cancelled" ? `สลิปไม่ผ่านการตรวจ: ${rejected} ` : ""}บัตรและสินค้าที่ล็อกไว้ถูกปล่อยคืนแล้ว ซื้อใหม่ได้จากหน้าอีเวนต์</p>
        <Link href={`/events/${slug}`} className="btn-buy mt-4 flex h-11 items-center justify-center rounded-xl text-sm font-medium">
          กลับไปหน้าอีเวนต์
        </Link>
      </section>
    );
  }

  if (status === "review") {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 text-center sm:p-5">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-foreground">
          <Icon icon={Clock01Icon} className="size-6" />
        </span>
        <p className="mt-3 text-base font-semibold text-foreground">ได้รับสลิปแล้ว กำลังตรวจสอบ</p>
        <p className="mt-1 text-sm text-balance text-muted-foreground">
          บัตรและสินค้ายังล็อกไว้ให้คุณ ไม่ต้องรีบ เมื่อทีมงานยืนยันยอดโอนแล้ว ระบบจะออกบัตรและส่ง QR ไปที่อีเมลให้ หน้านี้จะเปลี่ยนเองเมื่อตรวจเสร็จ
        </p>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Icon icon={Loading03Icon} className="size-3.5 animate-spin" />
          กำลังรอผลการตรวจ…
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <p className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Icon icon={Clock01Icon} className="size-4" />
          ล็อกไว้ให้อีก
        </span>
        <span className={`font-semibold tabular-nums ${left !== null && left < 60 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
          {left === null ? "--:--" : `${pad(Math.floor(left / 60))}:${pad(left % 60)}`}
        </span>
      </p>

      {quantity > 0 && (
        <AttendeesStep orderId={orderId} quantity={quantity} saved={saved} buyer={buyer} editing={editing || !ready} onEdit={() => setEditing(true)} onSaved={() => setEditing(false)} />
      )}

      {total === 0 ? (
        <FreeStep orderId={orderId} ready={ready && !editing} />
      ) : (
        <PayStep orderId={orderId} total={total} pay={pay} ready={ready && !editing} rejected={rejected} />
      )}

      <button
        type="button"
        disabled={cancelling}
        onClick={() => startCancelling(() => cancelCheckout(orderId))}
        className="flex h-10 w-full items-center justify-center rounded-xl text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
      >
        {cancelling ? "กำลังยกเลิก…" : "ยกเลิกคำสั่งซื้อ"}
      </button>
    </div>
  );
}

function StepHeader({ n, title, done }: { n: number; title: string; done?: boolean }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs ${done ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-secondary text-foreground"}`}>
        {done ? <Icon icon={Tick02Icon} className="size-3.5" /> : n}
      </span>
      {title}
    </h2>
  );
}

function ErrorLine({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p role="alert" className="mt-3 flex gap-1.5 text-xs text-red-600 dark:text-red-400">
      <Icon icon={Alert02Icon} className="mt-px size-3.5 shrink-0" />
      {text}
    </p>
  );
}

/* ─────────────── 1. ข้อมูลผู้เข้างาน ─────────────── */

function AttendeesStep({
  orderId,
  quantity,
  saved,
  buyer,
  editing,
  onEdit,
  onSaved,
}: {
  orderId: string;
  quantity: number;
  saved: Attendee[];
  buyer: { name: string; email: string };
  editing: boolean;
  onEdit: () => void;
  onSaved: () => void;
}) {
  const [list, setList] = useState<Attendee[]>(() =>
    Array.from({ length: quantity }, (_, i) => {
      if (saved[i]) return saved[i];
      if (i > 0) return EMPTY_ATTENDEE;
      // The first ticket is usually the buyer's own
      const [firstName = "", ...rest] = buyer.name.trim().split(/\s+/);
      return { firstName, lastName: rest.join(" "), email: buyer.email };
    }),
  );
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();

  if (!editing) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <StepHeader n={1} title="ข้อมูลผู้เข้างาน" done />
          <button type="button" onClick={onEdit} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <Icon icon={PencilEdit02Icon} className="size-3.5" />
            แก้ไข
          </button>
        </div>
        <ol className="mt-3 space-y-1.5 text-sm">
          {saved.map((a, i) => (
            <li key={i} className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <span className="text-xs text-muted-foreground tabular-nums">ใบที่ {i + 1}</span>
              <span className="font-medium text-foreground">{attendeeName(a)}</span>
              <span className="min-w-0 truncate text-xs text-muted-foreground">{a.email}</span>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  const set = (i: number, key: keyof Attendee, value: string) => setList((all) => all.map((a, j) => (j === i ? { ...a, [key]: value } : a)));

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <StepHeader n={1} title="ข้อมูลผู้เข้างาน" />
      <p className="mt-1 text-xs text-muted-foreground">กรอกชื่อ นามสกุล และอีเมลของคนที่จะใช้บัตรแต่ละใบ เจ้าของบัตรจะได้ QR ของตัวเองทางอีเมลด้วย</p>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const problem = attendeesProblem(list, quantity);
          if (problem) return setError(problem);
          startSaving(async () => {
            setError(undefined);
            const result = await saveCheckoutAttendees(orderId, list);
            if (result.error) setError(result.error);
            else onSaved();
          });
        }}
      >
        {list.map((a, i) => (
          <fieldset key={i} className="min-w-0 space-y-2 rounded-xl border border-border p-3">
            <legend className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
              <Icon icon={UserGroupIcon} className="size-3.5" />
              บัตรใบที่ {i + 1}
              {i === 0 && <span className="font-normal">(ปกติคือตัวคุณเอง)</span>}
            </legend>
            <div className="grid gap-2 min-[420px]:grid-cols-2">
              <input className={field} placeholder="ชื่อ" autoComplete={i === 0 ? "given-name" : "off"} value={a.firstName} maxLength={80} onChange={(e) => set(i, "firstName", e.target.value)} aria-label={`ชื่อ บัตรใบที่ ${i + 1}`} />
              <input className={field} placeholder="นามสกุล" autoComplete={i === 0 ? "family-name" : "off"} value={a.lastName} maxLength={80} onChange={(e) => set(i, "lastName", e.target.value)} aria-label={`นามสกุล บัตรใบที่ ${i + 1}`} />
            </div>
            <input className={field} type="email" inputMode="email" placeholder="อีเมล" autoComplete={i === 0 ? "email" : "off"} value={a.email} maxLength={200} onChange={(e) => set(i, "email", e.target.value)} aria-label={`อีเมล บัตรใบที่ ${i + 1}`} />
          </fieldset>
        ))}
        <ErrorLine text={error} />
        <button type="submit" disabled={saving} className="btn-buy flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium disabled:cursor-wait">
          {saving && <Icon icon={Loading03Icon} className="size-4 animate-spin" />}
          {saving ? "กำลังบันทึก…" : "บันทึกข้อมูลผู้เข้างาน"}
        </button>
      </form>
    </section>
  );
}

/* ─────────────── 2. ชำระเงิน ─────────────── */

function FreeStep({ orderId, ready }: { orderId: string; ready: boolean }) {
  const [error, setError] = useState<string>();
  const [busy, start] = useTransition();
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <ErrorLine text={error} />
      <button
        type="button"
        disabled={!ready || busy}
        onClick={() =>
          start(async () => {
            setError(undefined);
            const result = await confirmFreeOrder(orderId);
            if (result?.error) setError(result.error);
          })
        }
        className="btn-buy flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy && <Icon icon={Loading03Icon} className="size-4 animate-spin" />}
        {busy ? "กำลังออกบัตร…" : "ยืนยันรับบัตร"}
      </button>
      {!ready && <p className="mt-2 text-center text-xs text-muted-foreground">กรอกข้อมูลผู้เข้างานก่อน</p>}
    </section>
  );
}

function PayStep({ orderId, total, pay, ready, rejected }: { orderId: string; total: number; pay: CheckoutPay; ready: boolean; rejected: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<"reading" | "sending" | null>(null);
  const [paid, setPaid] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const send = async (picked: File | undefined) => {
    if (!picked) return;
    setError(undefined);
    setBusy("reading");
    const read = await readSlipQr(picked);
    const file = await shrinkImage(picked, 2400);
    setBusy("sending");
    const form = new FormData();
    form.set("slip", file);
    if (read.ok) form.set("qr", read.qr);
    const result = await sendSlip(orderId, form).catch(() => ({ ok: false as const, error: "ส่งสลิปไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่" }));
    setBusy(null);
    if (input.current) input.current.value = "";
    if (!result.ok) return setError(result.error);
    if (result.status === "paid") {
      setPaid(true);
      router.push(`/tickets?paid=${orderId}`);
    } else router.refresh();
  };

  if (!pay) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <StepHeader n={2} title="ชำระเงิน" />
        <p className="mt-3 rounded-xl bg-secondary/70 px-3.5 py-3 text-sm text-muted-foreground">งานนี้ยังไม่ได้ตั้งบัญชีรับเงิน กรุณาติดต่อผู้จัดงาน</p>
      </section>
    );
  }

  return (
    <section className={`rounded-2xl border border-border bg-card p-4 transition-opacity sm:p-5 ${ready ? "" : "opacity-60"}`}>
      <StepHeader n={2} title="สแกนจ่ายด้วยพร้อมเพย์ แล้วแนบสลิป" />
      {rejected && (
        <p className="mt-3 flex gap-1.5 rounded-xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300">
          <Icon icon={Alert02Icon} className="mt-px size-3.5 shrink-0" />
          สลิปก่อนหน้าไม่ผ่าน: {rejected}
        </p>
      )}
      <div className="mt-4 flex flex-col items-center text-center">
        <div className="rounded-2xl bg-white p-3">
          {/* A data: URL drawn on the server, so a plain <img> */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pay.qr} alt={`QR พร้อมเพย์ ยอด ${baht(total)}`} className="size-52" />
        </div>
        <p className="mt-3 text-2xl font-semibold text-foreground tabular-nums">{baht(total)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {pay.name ? `${pay.name} · ` : ""}พร้อมเพย์ {pay.account}
        </p>
        <p className="mt-2 text-xs text-balance text-muted-foreground">สแกนด้วยแอปธนาคาร ยอดเงินจะขึ้นให้เอง โอนแล้วบันทึกรูปสลิป แล้วแนบด้านล่าง</p>
      </div>

      <ErrorLine text={error} />

      <input ref={input} type="file" accept="image/*" className="sr-only" disabled={!ready || busy !== null || paid} onChange={(e) => send(e.target.files?.[0])} aria-label="เลือกรูปสลิป" />
      <div className="mt-4 grid gap-2 min-[400px]:grid-cols-2">
        <button
          type="button"
          disabled={!ready || busy !== null || paid}
          onClick={() => input.current?.click()}
          className="btn-buy flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icon icon={busy ? Loading03Icon : ImageUploadIcon} className={`size-4 ${busy ? "animate-spin" : ""}`} />
          {busy === "reading" ? "กำลังอ่านสลิป…" : busy === "sending" ? "กำลังตรวจสลิป…" : "แนบสลิป"}
        </button>
        <PhoneSlipButton orderId={orderId} disabled={!ready || busy !== null || paid} />
      </div>
      {!ready && <p className="mt-2 text-center text-xs text-muted-foreground">กรอกข้อมูลผู้เข้างานก่อน แล้วค่อยแนบสลิป</p>}
    </section>
  );
}

/* ─────────────── แนบผ่านมือถือ ─────────────── */

type PhoneView = { kind: "loading" } | { kind: "ready"; image: string } | { kind: "error"; msg: string };

/** A QR for the phone to open (/pay/<token>); the page moves on by itself when the slip has gone in from there */
function PhoneSlipButton({ orderId, disabled }: { orderId: string; disabled: boolean }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<PhoneView>({ kind: "loading" });
  const [open, setOpen] = useState(false);
  const client = useClient();

  const start = async () => {
    setView({ kind: "loading" });
    const res = await openPhoneSlip(orderId).catch(() => ({ error: "เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง", token: undefined }));
    if (!res.token) return setView({ kind: "error", msg: res.error ?? "สร้างคิวอาร์โค้ดไม่สำเร็จ" });
    const image = await QRCode.toDataURL(`${window.location.origin}/pay/${res.token}`, { margin: 1, width: 360, errorCorrectionLevel: "M" });
    setView({ kind: "ready", image });
  };

  // Every two seconds while the dialog is open and the tab in view: has the order moved on?
  useEffect(() => {
    if (!open || view.kind !== "ready") return;
    const timer = setInterval(async () => {
      if (document.hidden) return;
      const status = await checkoutStatus(orderId).catch(() => "pending");
      if (status && status !== "pending") {
        dialog.current?.close();
        router.refresh();
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [open, view.kind, orderId, router]);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
          void start();
        }}
        className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon icon={SmartPhone01Icon} className="size-4" />
        แนบผ่านมือถือ
      </button>
      {client &&
        createPortal(
          <dialog
            ref={dialog}
            onClose={() => setOpen(false)}
            aria-labelledby="phone-slip-title"
            className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl border border-border bg-background p-0 text-foreground shadow-2xl shadow-black/30 backdrop:bg-black/60 open:flex open:flex-col"
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 id="phone-slip-title" className="text-base font-semibold">
                แนบสลิปผ่านมือถือ
              </h2>
              <form method="dialog">
                <button type="submit" aria-label="ปิด" className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground">
                  <Icon icon={Cancel01Icon} className="size-4" />
                </button>
              </form>
            </div>
            <div className="mx-5 mb-5 flex flex-col items-center rounded-2xl bg-card px-5 py-6 text-center">
              <div className="grid size-52 place-items-center rounded-2xl bg-white p-3">
                {view.kind === "ready" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={view.image} alt="คิวอาร์โค้ดสำหรับเปิดบนมือถือ" className="size-full" />
                ) : view.kind === "loading" ? (
                  <Icon icon={Loading03Icon} className="size-8 animate-spin text-neutral-400" />
                ) : (
                  <button type="button" onClick={start} className="flex flex-col items-center gap-2 text-sm font-medium text-neutral-700">
                    <Icon icon={RefreshIcon} className="size-7" />
                    ลองใหม่
                  </button>
                )}
              </div>
              <p className="mt-4 text-sm font-semibold">{view.kind === "error" ? "สร้างคิวอาร์โค้ดไม่สำเร็จ" : "สแกนด้วยกล้องมือถือ"}</p>
              <p className="mt-1 text-xs text-balance text-muted-foreground">
                {view.kind === "error" ? view.msg : "เปิดลิงก์บนมือถือ แล้วเลือกรูปสลิปจากอัลบั้ม หน้านี้จะไปต่อเองเมื่อส่งสลิปแล้ว ลิงก์ใช้ได้ 10 นาที"}
              </p>
              {view.kind === "ready" && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon icon={Loading03Icon} className="size-3.5 animate-spin" />
                  กำลังรอสลิปจากมือถือ…
                </p>
              )}
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}

/** The phone's side (app/(site)/pay/[token]): pick the slip, read its QR here, send both to the order */
export function PhoneSlipUpload({ token, total, open }: { token: string; total: number | null; open: boolean }) {
  const [state, setState] = useState<{ step: "pick" | "busy" | "paid" | "review" | "closed"; error?: string }>({ step: open ? "pick" : "closed" });

  const onFile = async (picked: File | undefined) => {
    if (!picked) return;
    setState({ step: "busy" });
    const read = await readSlipQr(picked);
    const file = await shrinkImage(picked, 2400);
    const form = new FormData();
    form.set("slip", file);
    if (read.ok) form.set("qr", read.qr);
    const result = await sendSlipFromPhone(token, form).catch(() => ({ ok: false as const, error: "ส่งสลิปไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่" }));
    if (!result.ok) return setState({ step: "pick", error: result.error });
    setState({ step: result.status === "paid" ? "paid" : "review" });
  };

  if (state.step === "closed" || state.step === "paid" || state.step === "review") {
    const done = state.step !== "closed";
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <span className={`mx-auto mb-4 grid size-12 place-items-center rounded-2xl ${done ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-secondary text-muted-foreground"}`}>
          <Icon icon={done ? CheckmarkCircle02Icon : Alert02Icon} className="size-6" />
        </span>
        <h1 className="text-lg font-semibold text-foreground">{state.step === "paid" ? "ชำระเงินเรียบร้อย" : state.step === "review" ? "ส่งสลิปแล้ว" : "ลิงก์นี้หมดอายุแล้ว"}</h1>
        <p className="mt-1.5 text-sm text-balance text-muted-foreground">
          {state.step === "paid"
            ? "ระบบออกบัตรและส่ง QR ไปที่อีเมลแล้ว กลับไปดูที่หน้าจอคอมพิวเตอร์ได้เลย"
            : state.step === "review"
              ? "ทีมงานกำลังตรวจยอดโอน เมื่อยืนยันแล้วระบบจะส่งบัตรไปที่อีเมล กลับไปที่หน้าจอคอมพิวเตอร์ได้เลย"
              : "ลิงก์ใช้ได้ 10 นาทีและใช้ได้ครั้งเดียว กด “แนบผ่านมือถือ” ที่หน้าชำระเงินอีกครั้งแล้วสแกนใหม่"}
        </p>
      </div>
    );
  }

  const busy = state.step === "busy";
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center">
      <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-secondary">
        <Icon icon={busy ? Loading03Icon : ImageUploadIcon} className={`size-6 text-foreground ${busy ? "animate-spin" : ""}`} />
      </span>
      <h1 className="text-lg font-semibold text-foreground">แนบสลิปโอนเงิน</h1>
      {total !== null && <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{baht(total)}</p>}
      <p className="mt-1.5 text-sm text-balance text-muted-foreground">เลือกรูปสลิปจากอัลบั้มในมือถือ ระบบจะส่งไปที่คำสั่งซื้อของคุณให้เอง</p>
      <ErrorLine text={state.error} />
      <label className={`btn-buy mt-5 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-medium ${busy ? "pointer-events-none opacity-60" : ""}`}>
        <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
        {busy ? "กำลังตรวจสลิป…" : state.error ? "เลือกสลิปใหม่" : "เลือกรูปสลิป"}
      </label>
    </div>
  );
}
