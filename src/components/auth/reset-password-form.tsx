"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LockPasswordIcon } from "@hugeicons/core-free-icons";
import { resetPassword, type ResetState } from "@/app/actions/auth";
import { Field, FormError, PasswordInput, SubmitButton } from "@/components/auth/auth-ui";

/** `token` comes from the emailed link; a missing or expired one shows how to ask for a new link instead */
export function ResetPasswordForm({ token }: { token: string | null }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, {});

  if (!token) {
    return (
      <div className="stagger space-y-5">
        <FormError message="ลิงก์รีเซ็ตรหัสผ่านนี้หมดอายุหรือถูกใช้ไปแล้ว ขอลิงก์ใหม่อีกครั้ง" />
        <Link
          href="/forgot-password"
          className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          ขอลิงก์ใหม่
        </Link>
      </div>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      {/* Staggered wrapper: React prepends hidden inputs to server-action forms, which would shift nth-child */}
      <div className="stagger space-y-5" style={{ "--stagger-start": 1 } as React.CSSProperties}>
        <FormError message={state.error} />

        <Field label="รหัสผ่านใหม่" hint="(อย่างน้อย 8 ตัวอักษร)">
          {(id) => <PasswordInput id={id} name="password" placeholder="รหัสผ่านใหม่" autoComplete="new-password" required minLength={8} autoFocus />}
        </Field>

        <Field label="ยืนยันรหัสผ่านใหม่">
          {(id) => <PasswordInput id={id} name="confirm" placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง" autoComplete="new-password" required minLength={8} />}
        </Field>

        <SubmitButton pending={pending} icon={LockPasswordIcon}>
          ตั้งรหัสผ่านใหม่
        </SubmitButton>
      </div>
    </form>
  );
}
