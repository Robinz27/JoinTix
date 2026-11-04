"use client";

import { useState } from "react";
import { CheckmarkBadge01Icon, Loading03Icon, MailSend01Icon } from "@hugeicons/core-free-icons";
import { FormError, FormNotice } from "@/components/auth/auth-ui";
import { Icon } from "@/components/icon";
import { authClient } from "@/lib/auth-client";

/**
 * The profile page's email box: verified or not, and for a not-yet-verified email a button that mails a
 * one-time link (lib/auth.ts, emailVerification). Opening it verifies the email and comes back to
 * /profile?verified=1, so buying tickets later skips the code step.
 */
export function EmailStatus({
  email,
  verified,
  justVerified,
  linkError,
}: {
  email: string;
  verified: boolean;
  justVerified: boolean;
  linkError?: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState(linkError);

  async function send() {
    setState("sending");
    setError(undefined);
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/profile?verified=1" });
    if (error) {
      setState("idle");
      setError(error.status === 429 ? "ขอลิงก์ถี่เกินไป รอสักครู่แล้วลองใหม่" : "ส่งลิงก์ไม่สำเร็จ ลองใหม่อีกครั้ง");
      return;
    }
    setState("sent");
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">การยืนยันอีเมล</h2>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
            verified ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-secondary text-muted-foreground"
          }`}
        >
          {verified && <Icon icon={CheckmarkBadge01Icon} className="size-3.5" />}
          {verified ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน"}
        </span>
      </div>

      {justVerified && <FormNotice>ยืนยันอีเมลเรียบร้อย ซื้อบัตรได้ทันทีโดยไม่ต้องยืนยันอีก</FormNotice>}
      <FormError message={error} />

      {verified ? (
        !justVerified && <p className="text-sm text-muted-foreground">อีเมลนี้ยืนยันแล้ว ตอนซื้อบัตรไม่ต้องกรอกรหัสยืนยันอีก</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            ยืนยันอีเมลไว้ก่อน ตอนเปิดขายจะกดซื้อบัตรได้ทันทีโดยไม่ต้องรอรหัส เราจะส่งลิงก์ไปที่{" "}
            <span className="break-all text-foreground">{email}</span> กดลิงก์ในอีเมลแล้วระบบจะยืนยันให้เอง
          </p>
          {state === "sent" && <FormNotice>ส่งลิงก์แล้ว เช็กกล่องจดหมาย (และโฟลเดอร์สแปม) ลิงก์ใช้ได้ 1 ชั่วโมง</FormNotice>}
          <button
            type="button"
            onClick={send}
            disabled={state === "sending"}
            className="btn-buy flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium disabled:opacity-60"
          >
            <Icon icon={state === "sending" ? Loading03Icon : MailSend01Icon} className={`size-4 ${state === "sending" ? "animate-spin" : ""}`} />
            {state === "sent" ? "ส่งลิงก์อีกครั้ง" : "ส่งลิงก์ยืนยันอีเมล"}
          </button>
        </>
      )}
    </section>
  );
}
