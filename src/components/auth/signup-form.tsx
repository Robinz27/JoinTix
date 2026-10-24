"use client";

import { useActionState } from "react";
import Link from "next/link";
import { UserAdd01Icon } from "@hugeicons/core-free-icons";
import { signUp, type SignupState } from "@/app/actions/auth";
import { AuthTips, Field, FormError, Kbd, PasswordInput, SubmitButton, TextInput } from "@/components/auth/auth-ui";

export function SignupForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(signUp, {});

  return (
    <>
      <form action={action}>
        <input type="hidden" name="next" value={next} />
        {/* Staggered wrapper: React prepends hidden inputs to server-action forms, which would shift nth-child */}
        <div className="stagger space-y-5" style={{ "--stagger-start": 1 } as React.CSSProperties}>
          <FormError message={state.error} />

          <Field label="ชื่อ-นามสกุล">
            {(id) => (
              <TextInput
                id={id}
                name="name"
                defaultValue={state.name}
                placeholder="สมชาย ใจดี"
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
                autoFocus
              />
            )}
          </Field>

          <Field label="อีเมล">
            {(id) => (
              <TextInput id={id} name="email" type="email" defaultValue={state.email} placeholder="you@example.com" autoComplete="email" required maxLength={100} />
            )}
          </Field>

          <Field label="เบอร์โทรศัพท์">
            {(id) => (
              <TextInput
                id={id}
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={state.phone}
                placeholder="0812345678"
                autoComplete="tel"
                required
                pattern="0[0-9\s\-]{8,11}"
                // Next to `pattern`, `title` is what the browser says in its "match the requested format" bubble
                title="ตัวเลข 9–10 หลัก ขึ้นต้นด้วย 0"
              />
            )}
          </Field>

          <Field label="รหัสผ่าน" hint="(อย่างน้อย 8 ตัวอักษร)">
            {(id) => <PasswordInput id={id} name="password" placeholder="รหัสผ่าน" autoComplete="new-password" required minLength={8} />}
          </Field>

          <Field label="ยืนยันรหัสผ่าน">
            {(id) => <PasswordInput id={id} name="confirm" placeholder="พิมพ์รหัสผ่านอีกครั้ง" autoComplete="new-password" required minLength={8} />}
          </Field>

          <SubmitButton pending={pending} icon={UserAdd01Icon}>
            สมัครสมาชิก
          </SubmitButton>

          <p className="text-center text-sm text-muted-foreground">
            มีบัญชีอยู่แล้ว?{" "}
            <Link
              href={next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`}
              className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
            >
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </form>

      <AuthTips order={9}>
        กด <Kbd>Enter</Kbd> เพื่อยืนยัน, เบอร์โทรใช้ติดต่อเรื่องบัตรและงานที่คุณจองไว้
      </AuthTips>
    </>
  );
}
