"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loading03Icon, Mail01Icon } from "@hugeicons/core-free-icons";
import { FormError, FormNotice } from "@/components/auth/auth-ui";
import { Icon } from "@/components/icon";
import { authClient } from "@/lib/auth-client";

/** Seconds before another code can be asked for (the server allows 3 a minute) */
const RESEND_AFTER = 60;

type AuthError = { code?: string; status?: number } | null;

function message(error: NonNullable<AuthError>) {
  if (error.status === 429) return "ขอรหัสถี่เกินไป รอสักครู่แล้วลองใหม่";
  switch (error.code) {
    case "INVALID_OTP":
      return "รหัสไม่ถูกต้อง ลองตรวจอีกครั้ง";
    case "OTP_EXPIRED":
      return "รหัสหมดอายุแล้ว กดส่งรหัสใหม่";
    case "TOO_MANY_ATTEMPTS":
      return "กรอกผิดหลายครั้งเกินไป กดส่งรหัสใหม่";
    default:
      return "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง";
  }
}

/**
 * ยืนยันอีเมล inside the ticket panel, for an account that hasn't yet: Resend mails a 6-digit code
 * (lib/auth.ts, emailOTP) and typing it in marks the email verified. The profile page does the same ahead
 * of time by link, so a buyer who did that never sees this.
 */
export function VerifyEmailCode({ email, onVerified }: { email: string; onVerified: () => void }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState<string>();
  const [wait, setWait] = useState(0);

  // Counts the resend cooldown down once a second
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function send() {
    setBusy("send");
    setError(undefined);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
    setBusy(null);
    if (error) return setError(message(error));
    setSent(true);
    setCode("");
    setWait(RESEND_AFTER);
  }

  async function verify(otp: string) {
    setBusy("verify");
    setError(undefined);
    const { error } = await authClient.emailOtp.verifyEmail({ email, otp });
    setBusy(null);
    if (error) return setError(message(error));
    onVerified();
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-3.5">
      <div className="flex gap-2.5">
        <Icon icon={Mail01Icon} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 text-sm">
          <p className="font-medium text-foreground">ยืนยันอีเมลก่อนซื้อบัตร</p>
          <p className="text-xs break-all text-muted-foreground">
            {sent ? `ส่งรหัส 6 หลักไปที่ ${email} แล้ว (ใช้ได้ 10 นาที)` : `เราจะส่งรหัส 6 หลักไปที่ ${email}`}
          </p>
        </div>
      </div>

      {sent && !error && busy !== "verify" && code.length === 0 && <FormNotice>เช็กกล่องจดหมาย (และโฟลเดอร์สแปม) แล้วกรอกรหัส</FormNotice>}
      <FormError message={error} />

      {sent ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6) verify(code);
          }}
          className="flex gap-2"
        >
          <input
            value={code}
            onChange={(e) => {
              const next = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(next);
              // Goes on its own once the sixth digit is in, pasted or typed
              if (next.length === 6 && busy === null) verify(next);
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="รหัสยืนยัน 6 หลัก"
            placeholder="••••••"
            maxLength={6}
            autoFocus
            className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-input px-3 text-center font-mono text-lg tracking-[0.4em] text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-muted-foreground focus:ring-3 focus:ring-muted-foreground/15"
          />
          <button
            type="submit"
            disabled={code.length !== 6 || busy !== null}
            className="btn-buy flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "verify" && <Icon icon={Loading03Icon} className="size-4 animate-spin" />}
            ยืนยัน
          </button>
        </form>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <button
          type="button"
          onClick={send}
          disabled={busy !== null || wait > 0}
          className={
            sent
              ? "text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:no-underline disabled:opacity-60"
              : "btn-buy flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium disabled:opacity-60"
          }
        >
          {busy === "send" && <Icon icon={Loading03Icon} className="size-4 animate-spin" />}
          {sent ? (wait > 0 ? `ส่งรหัสใหม่ได้ใน ${wait} วิ` : "ส่งรหัสใหม่") : "ส่งรหัสยืนยัน"}
        </button>
        {!sent && (
          <p className="w-full text-center text-muted-foreground">
            ยืนยันล่วงหน้าได้ที่{" "}
            <Link href="/profile" className="text-foreground underline underline-offset-2">
              ข้อมูลบัญชี
            </Link>{" "}
            จะได้ซื้อเร็วขึ้นครั้งหน้า
          </p>
        )}
      </div>
    </div>
  );
}
