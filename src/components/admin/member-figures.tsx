import { Icon, type IconSvgElement } from "@/components/icon";

// The row of small figures at the top of a member's page, like the one over 4TUNEZ's customer form
// (components/admin/customers/customer-dialog.tsx there): an icon, a label, a number.

export function Figures({ items }: { items: { icon: IconSvgElement; label: string; value: string; hint?: string }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 rounded-xl border border-border bg-card px-3 py-2.5">
          <dt className="flex items-center gap-1 text-2xs text-muted-foreground">
            <Icon icon={item.icon} className="size-3 shrink-0" />
            <span className="truncate">{item.label}</span>
          </dt>
          <dd className="mt-0.5 truncate text-sm font-semibold text-foreground tabular-nums sm:text-base">{item.value}</dd>
          {item.hint && <dd className="truncate text-2xs text-muted-foreground">{item.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** A label and its value, one row of a details card */
export function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-0.5 px-4 py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:px-5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm break-words text-foreground">{children}</dd>
    </div>
  );
}

/** A small icon in a line of text */
export function InlineIcon({ icon }: { icon: IconSvgElement }) {
  return <Icon icon={icon} className="size-3.5 shrink-0" />;
}
