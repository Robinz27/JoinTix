import Link from "next/link";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { Icon, type IconSvgElement } from "@/components/icon";

// The pieces every หลังบ้าน page is built from, the same shapes as next.js-shop's back office
// (components/admin/ui.tsx there): 2xl cards, pill controls, bordered icon tiles. A new admin page uses
// these instead of inventing its own.

/** Outline pill button */
export const pill =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-40";

/** The filled pill, for the one action a form is really about */
export const pillPrimary =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-70";

/** Round icon-only button (row actions) */
export const iconButton =
  "grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40";

/** A panel surface */
export const card = "rounded-2xl border border-border bg-card";

/** The bordered square an icon sits in: size-9 in headers, size-10 on stats, size-12 when empty */
export const tile = "grid shrink-0 place-items-center rounded-xl border border-border bg-secondary text-muted-foreground";

/** A text box, the same height and radius as the pills */
export const input =
  "h-10 w-full rounded-xl border border-border bg-input px-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-muted-foreground";

/** Table cells; columns that matter less add `hidden md:table-cell` and so on, so a phone needs no sideways scroll */
export const th = "px-3 py-2.5 text-left text-2xs font-medium tracking-wide text-muted-foreground uppercase first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5";
export const td = "px-3 py-3 first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5";
/**
 * The main column (name, email): takes the room that's left and lets its text truncate. Without max-w-0 a
 * table grows to fit its longest email and pushes the last column off a phone screen.
 */
export const tdMain = `${td} w-full max-w-0`;
/** A column that keeps its content on one line at its own width (badges, row actions) */
export const tdTight = `${td} w-px whitespace-nowrap`;

/** "← back" above a sub-page's header */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <Icon icon={ArrowLeft01Icon} className="size-4" />
      {children}
    </Link>
  );
}

/** The title block at the top of a page: eyebrow, heading, one line of explanation, actions */
export function PageHeader({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children?: React.ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
      <div className="min-w-0">
        <p className="text-2xs font-medium tracking-[0.2em] text-muted-foreground uppercase sm:text-xs">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{children}</div>}
    </header>
  );
}

/** The quiet label above a row of cards */
export function SectionTitle({ icon, title, note }: { icon: IconSvgElement; title: string; note?: string }) {
  return (
    <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-0.5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Icon icon={icon} className="size-4 text-muted-foreground" />
        {title}
      </h2>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}

/** One figure on the overview: an icon tile, the label, and the number big enough to read across a desk */
export function StatCard({ icon, title, value, hint, featured = false }: { icon: IconSvgElement; title: string; value: string; hint?: string; featured?: boolean }) {
  return (
    <div className={`rounded-2xl border border-border p-4 sm:p-5 ${featured ? "bg-gradient-to-br from-secondary via-card to-card" : "bg-card"}`}>
      <div className="flex items-center gap-2.5">
        <span className={`${tile} size-9 ${featured ? "bg-background/60 text-foreground" : ""}`}>
          <Icon icon={icon} className="size-4.5" />
        </span>
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground sm:text-sm">{title}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-3xl">{value}</p>
      {hint && <p className="mt-2 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A small figure in a row of them, above a table rather than in place of one */
export function MiniStat({ icon, label, value }: { icon: IconSvgElement; label: string; value: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${card} p-3 sm:gap-3 sm:p-3.5`}>
      <span className={`${tile} size-9 max-[359px]:hidden sm:size-10`}>
        <Icon icon={icon} className="size-4.5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-2xs text-muted-foreground sm:text-xs">{label}</p>
        <p className="truncate text-sm font-semibold text-foreground tabular-nums sm:text-base">{value}</p>
      </div>
    </div>
  );
}

/** A card with a header strip; `action` sits on its right */
export function Panel({
  title,
  subtitle,
  icon,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  icon?: IconSvgElement;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${card} min-w-0 overflow-hidden ${className}`}>
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && (
            <span className={`${tile} size-9`}>
              <Icon icon={icon} className="size-4.5" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Nothing to show, with the icon of whatever is missing */
export function Empty({ icon, title, detail }: { icon: IconSvgElement; title: string; detail?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <span className={`${tile} size-12 rounded-2xl`}>
        <Icon icon={icon} className="size-6" />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {detail && <p className="text-xs text-muted-foreground sm:text-sm">{detail}</p>}
    </div>
  );
}

/** The first letter in a circle, for a row without a picture (works for Thai names too) */
export function Initials({ name, className = "size-9" }: { name: string; className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-secondary text-2xs font-semibold text-muted-foreground uppercase ${className}`}>
      {[...name.trim()][0] ?? "?"}
    </span>
  );
}

export function Badge({ tone = "muted", children }: { tone?: "muted" | "good" | "warn" | "strong"; children: React.ReactNode }) {
  const tones = {
    muted: "bg-secondary text-muted-foreground",
    good: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    strong: "bg-primary text-primary-foreground",
  };
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-2xs font-medium whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}
