import { Tick02Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/icon";

// The site's own on/off controls, in place of the browser's checkbox. Both are a real checkbox underneath (hidden,
// not removed), so a form's `name`, `defaultChecked`, keyboard and screen readers work as they always do.
// - Switch: a setting that is on or off (เปิดขาย, เปิดร้าน).
// - CheckBox: one pick of several in a list (the permissions of a role). Put it inside a <label>.

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "className">;

/** With `boxed`, a full-width row in a frame, the label on the left: for a setting that has a line of explanation */
export function Switch({ label, hint, boxed, className = "", ...input }: InputProps & { label: React.ReactNode; hint?: string; boxed?: boolean; className?: string }) {
  return (
    <label
      className={`group/switch flex cursor-pointer items-center gap-2.5 select-none has-disabled:cursor-not-allowed has-disabled:opacity-50 ${
        boxed ? "justify-between gap-3 rounded-xl border border-border bg-background/40 px-3.5 py-3 transition-colors hover:border-muted-foreground/50" : ""
      } ${className}`}
    >
      <span className={`relative inline-flex shrink-0 ${boxed ? "order-last" : ""}`}>
        <input type="checkbox" role="switch" {...input} className="peer sr-only" />
        <span className="h-5 w-9 rounded-full bg-secondary-hover transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-muted-foreground peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card motion-reduce:transition-none" />
        <span className="pointer-events-none absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-all group-has-checked/switch:translate-x-4 group-has-checked/switch:bg-primary-foreground motion-reduce:transition-none" />
      </span>
      <span className="min-w-0">
        <span className="block">{label}</span>
        {hint && <span className="block text-2xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

/** The box and its tick. The input comes first, so whatever follows inside the label can use `peer-checked:` too */
export function CheckBox(input: InputProps) {
  return (
    <>
      <input type="checkbox" {...input} className="peer sr-only" />
      <span className="grid size-[18px] shrink-0 place-items-center rounded-[5px] border-2 border-border text-transparent transition-all group-hover:border-muted-foreground group-active:scale-90 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-muted-foreground/30 motion-reduce:transition-none">
        <Icon icon={Tick02Icon} className="size-3.5" strokeWidth={2.5} />
      </span>
    </>
  );
}
