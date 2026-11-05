"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Alert02Icon, Clock01Icon, CreditCardIcon, Loading03Icon } from "@hugeicons/core-free-icons";
import { cancelCheckout, confirmPayment } from "@/app/actions/orders";
import { Icon } from "@/components/icon";

// The checkout's lower half: how long the hold has left, and pay / cancel. Payment is simulated until a
// real provider is wired in here (HANDOFF section 8): confirming marks the order paid and issues the tickets.

const pad = (n: number) => String(n).padStart(2, "0");

export function CheckoutActions({
  orderId,
  status,
  expiresAt,
  slug,
  free,
}: {
  orderId: string;
  status: "pending" | "cancelled" | "expired" | "paid";
  expiresAt: string;
  slug: string;
  free: boolean;
}) {
  const [left, setLeft] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [paying, startPaying] = useTransition();
  const [cancelling, startCancelling] = useTransition();

  // Counted in the browser only, so the server's HTML and the first render agree
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const lapsed = status === "expired" || (status === "pending" && left === 0);
  if (status === "cancelled" || lapsed) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 text-center sm:p-5">
        <Icon icon={Alert02Icon} className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium text-foreground">{status === "cancelled" ? "ยกเลิกคำสั่งซื้อแล้ว" : "หมดเวลาชำระเงิน"}</p>
        <p className="mt-1 text-xs text-muted-foreground">บัตรที่ล็อกไว้ถูกปล่อยคืนแล้ว ซื้อใหม่ได้จากหน้าอีเวนต์</p>
        <Link href={`/events/${slug}`} className="btn-buy mt-4 flex h-11 items-center justify-center rounded-xl text-sm font-medium">
          กลับไปหน้าอีเวนต์
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <p className="flex items-center justify-between gap-3 rounded-xl bg-secondary/70 px-3.5 py-2.5 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Icon icon={Clock01Icon} className="size-4" />
          ล็อกบัตรไว้ให้อีก
        </span>
        <span className={`font-semibold tabular-nums ${left !== null && left < 60 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
          {left === null ? "--:--" : `${pad(Math.floor(left / 60))}:${pad(left % 60)}`}
        </span>
      </p>

      <div className="mt-4 rounded-xl border border-dashed border-border px-3.5 py-3 text-xs text-muted-foreground">
        ระบบชำระเงินจริงยังไม่เปิดใช้ ตอนนี้เป็นการชำระเงินจำลอง กดยืนยันแล้วจะได้บัตรและโทเคนทันที และระบบจะส่งบัตรพร้อม QR ไปที่อีเมล
      </div>

      {error && (
        <p role="alert" className="mt-3 flex gap-1.5 text-xs text-red-600 dark:text-red-400">
          <Icon icon={Alert02Icon} className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={paying || cancelling}
        onClick={() =>
          startPaying(async () => {
            setError(undefined);
            const result = await confirmPayment(orderId);
            if (result?.error) setError(result.error);
          })
        }
        className="btn-buy mt-4 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium disabled:cursor-wait"
      >
        <Icon icon={paying ? Loading03Icon : CreditCardIcon} className={`size-4 ${paying ? "animate-spin" : ""}`} />
        {paying ? "กำลังออกบัตร…" : free ? "ยืนยันรับบัตร" : "ยืนยันชำระเงิน (จำลอง)"}
      </button>
      <button
        type="button"
        disabled={paying || cancelling}
        onClick={() => startCancelling(() => cancelCheckout(orderId))}
        className="mt-2 flex h-10 w-full items-center justify-center rounded-xl text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
      >
        {cancelling ? "กำลังยกเลิก…" : "ยกเลิกคำสั่งซื้อ"}
      </button>
    </section>
  );
}
