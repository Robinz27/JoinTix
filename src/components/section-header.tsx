import Link from "next/link";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Icon, type IconSvgElement } from "@/components/icon";

/** A home-page section's title row: icon tile, Thai title with an English subtitle, and a "see all" link */
export function SectionHeader({
  icon,
  title,
  subtitle,
  href,
}: {
  icon: IconSvgElement;
  title: string;
  subtitle: string;
  href?: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-3 sm:mb-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground sm:size-10">
        <Icon icon={icon} className="size-[18px] sm:size-5" />
      </span>
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-foreground sm:text-lg">{title}</h2>
        <p className="truncate text-2xs text-muted-foreground sm:text-xs">{subtitle}</p>
      </div>
      <span aria-hidden="true" className="h-px min-w-4 flex-1 bg-gradient-to-r from-border to-transparent" />
      {href && (
        <Link
          href={href}
          className="group flex h-8 shrink-0 items-center gap-1 rounded-full border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary sm:text-sm"
        >
          ดูทั้งหมด
          <Icon icon={ArrowRight01Icon} className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
