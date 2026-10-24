"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { Alert02Icon, Loading03Icon, Tick02Icon, ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons";
import { Icon, type IconSvgElement } from "@/components/icon";
import { Watermark } from "@/components/watermark";

// Form pieces shared by the login and sign-up pages, from next.js-shop's components/auth/auth-ui.tsx

/** Page shell: soft glow behind the card with a big watermark word */
export function AuthCard({
  watermark,
  title,
  subtitle,
  children,
}: {
  watermark: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex flex-1 justify-center px-3 py-10 sm:py-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-24 left-1/2 h-72 w-[min(36rem,90vw)] -translate-x-1/2 rounded-full bg-foreground/[0.04] blur-3xl"
      />

      <div className="fade-in relative w-full max-w-[440px] self-start overflow-hidden rounded-2xl border border-border bg-surface px-5 pt-8 pb-6 shadow-2xl shadow-black/5 sm:px-10 sm:pt-10 sm:pb-10 dark:shadow-black/40">
        <Watermark text={watermark} className="top-5 left-1/2 -translate-x-1/2 text-[clamp(4.5rem,24vw,7.5rem)]" />

        <div className="relative">
          <header className="stagger-item mb-8 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          </header>
          {children}
        </div>
      </div>
    </main>
  );
}

const inputClass =
  "h-12 w-full rounded-xl border border-border bg-input px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-muted-foreground/40 focus:border-muted-foreground focus:ring-3 focus:ring-muted-foreground/15";

export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm text-foreground">
        {label}
        {hint && <span className="ml-1 text-muted-foreground">{hint}</span>}
      </label>
      {children(id)}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />;
}

export function PasswordInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${inputClass} pr-24`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        className="absolute inset-y-1.5 right-1.5 flex items-center gap-1.5 rounded-lg px-3 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Icon icon={visible ? ViewIcon : ViewOffSlashIcon} className="size-4" />
        {visible ? "ซ่อน" : "แสดง"}
      </button>
    </div>
  );
}

export function Checkbox({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="group flex cursor-pointer items-center gap-2.5 select-none">
      <input type="checkbox" {...props} className="peer sr-only" />
      <span className="grid size-[18px] place-items-center rounded-[5px] border-2 border-border text-transparent transition-all group-hover:border-muted-foreground group-active:scale-90 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-muted-foreground/30">
        <Icon icon={Tick02Icon} className="size-3.5" strokeWidth={2.5} />
      </span>
      <span className="text-sm text-muted-foreground transition-colors peer-checked:text-foreground">{label}</span>
    </label>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
    >
      <Icon icon={Alert02Icon} className="mt-px size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

const noSubscribe = () => () => {};

/**
 * Shut until the page has hydrated: a form sent before then goes as a plain POST, and Next answers that on a
 * partially prerendered page with data only, which leaves a blank page. While shut, Enter can't send it either.
 */
export function SubmitButton({ pending, icon, children }: { pending: boolean; icon: IconSvgElement; children: React.ReactNode }) {
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  return (
    <button
      type="submit"
      disabled={pending || !hydrated}
      aria-busy={pending}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover active:translate-y-px disabled:cursor-wait disabled:opacity-70"
    >
      <Icon icon={pending ? Loading03Icon : icon} className={`size-4 ${pending ? "animate-spin" : ""}`} />
      {pending ? "กำลังดำเนินการ..." : children}
    </button>
  );
}

export function AuthTips({ order, children }: { order: number; children: React.ReactNode }) {
  return (
    <div
      className="stagger-item mt-6 rounded-xl border border-border bg-background/40 px-4 py-3 text-center text-xs leading-relaxed text-muted-foreground"
      style={{ "--i": order } as React.CSSProperties}
    >
      <p className="mb-1">ทิปการใช้งาน</p>
      {children}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="mx-0.5 rounded-md border border-border bg-secondary px-1.5 py-0.5 text-2xs text-foreground tabular-nums">{children}</kbd>;
}
