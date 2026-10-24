"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MailSend01Icon } from "@hugeicons/core-free-icons";
import { requestPasswordReset, type ForgotState } from "@/app/actions/auth";
import { AuthTips, Field, FormError, FormNotice, SubmitButton, TextInput } from "@/components/auth/auth-ui";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(requestPasswordReset, {});

  return (
    <>
      <form action={action}>
        {/* Staggered wrapper: React prepends hidden inputs to server-action forms, which would shift nth-child */}
        <div className="stagger space-y-5" style={{ "--stagger-start": 1 } as React.CSSProperties}>
          <FormError message={state.error} />
          {state.sentTo && (
            <FormNotice>
              ถ้า <b className="font-medium">{state.sentTo}</b> มีบัญชีอยู่ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว เช็กกล่องจดหมายและโฟลเดอร์สแปม
            </FormNotice>
          )}

          <Field label="อีเมลที่ใช้สมัคร">
            {(id) => <TextInput id={id} name="email" type="email" placeholder="you@example.com" autoComplete="email" required autoFocus />}
          </Field>

          <SubmitButton pending={pending} icon={MailSend01Icon}>
            {state.sentTo ? "ส่งลิงก์อีกครั้ง" : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
          </SubmitButton>

          <p className="text-center text-sm text-muted-foreground">
            นึกออกแล้ว?{" "}
            <Link href="/login" className="font-medium text-foreground underline underline-offset-4 hover:no-underline">
              กลับไปเข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </form>

      <AuthTips order={6}>ลิงก์ในอีเมลใช้ได้ครั้งเดียวภายใน 1 ชั่วโมง ตั้งรหัสใหม่แล้วอุปกรณ์อื่นจะถูกออกจากระบบ</AuthTips>
    </>
  );
}
