import { Alert02Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import type { AdminFormState } from "@/app/actions/admin";
import { Icon } from "@/components/icon";

// Form pieces หลังบ้าน's dialogs and pages share (member-actions.tsx, event-form.tsx)

/** The quiet label above a field */
export const label = "mb-1.5 block text-xs text-muted-foreground";
/** The hint under a field */
export const hint = "mt-1.5 text-2xs text-muted-foreground";

export function Notice({ state }: { state: AdminFormState }) {
  if (!state.error && !state.ok) return null;
  const bad = Boolean(state.error);
  return (
    <p
      role="status"
      className={`mb-4 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ${
        bad ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      }`}
    >
      <Icon icon={bad ? Alert02Icon : CheckmarkCircle02Icon} className="mt-0.5 size-4 shrink-0" />
      {state.error ?? state.ok}
    </p>
  );
}

/** A few short choices as pills, plain radios underneath so the form submits them and the keyboard works */
export function Choices({ name, value, options }: { name: string; value: string; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <label key={option.value} className="cursor-pointer">
          <input type="radio" name={name} value={option.value} defaultChecked={option.value === value} className="peer sr-only" />
          <span className="flex h-9 items-center rounded-full border border-border bg-background px-3.5 text-sm text-muted-foreground transition-colors hover:bg-secondary peer-checked:border-foreground/40 peer-checked:bg-secondary peer-checked:font-medium peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-muted-foreground">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}
