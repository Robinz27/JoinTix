"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Login03Icon } from "@hugeicons/core-free-icons";
import { signIn, type LoginState } from "@/app/actions/auth";
import { AuthTips, Checkbox, Field, FormError, Kbd, PasswordInput, SubmitButton, TextInput } from "@/components/auth/auth-ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <>
      <form action={action}>
        <input type="hidden" name="next" value={next} />
        {/* Staggered wrapper: React prepends hidden inputs to server-action forms, which would shift nth-child */}
        <div className="stagger space-y-5" style={{ "--stagger-start": 1 } as React.CSSProperties}>
          <FormError message={state.error} />

          <Field label="อีเมล">
            {(id) => (
              <TextInput
                id={id}
                name="email"
                type="email"
                defaultValue={state.email}
                placeholder="you@example.com"
                autoComplete="email"
                required
                autoFocus
              />
            )}
          </Field>

          <Field label="รหัสผ่าน">
            {(id) => <PasswordInput id={id} name="password" placeholder="รหัสผ่าน" autoComplete="current-password" required />}
          </Field>

          <div className="flex items-center justify-between gap-3">
            <Checkbox name="remember" label="จดจำฉันไว้" defaultChecked />
            <Link href="/forgot-password" prefetch={false} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              ลืมรหัสผ่าน?
            </Link>
          </div>

          <SubmitButton pending={pending} icon={Login03Icon}>
            เข้าสู่ระบบ
          </SubmitButton>

          <p className="text-center text-sm text-muted-foreground">
            ยังไม่มีบัญชี?{" "}
            <Link
              href={next === "/" ? "/register" : `/register?next=${encodeURIComponent(next)}`}
              className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
            >
              สมัครสมาชิก
            </Link>
          </p>
        </div>
      </form>

      <AuthTips order={7}>
        กด <Kbd>Enter</Kbd> เพื่อเข้าสู่ระบบ, ไม่ติ๊ก &quot;จดจำฉันไว้&quot; ระบบจะออกจากระบบเมื่อปิดเบราว์เซอร์
      </AuthTips>
    </>
  );
}
