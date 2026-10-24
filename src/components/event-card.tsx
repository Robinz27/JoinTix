import Image from "next/image";
import Link from "next/link";
import { Calendar03Icon, Location01Icon, Ticket02Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/icon";
import type { EventSummary } from "@/lib/events";

// Always Thai time, so the server and every visitor see the same date
const dateFormat = new Intl.DateTimeFormat("th-TH", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

export function EventCard({ event, preload = false }: { event: EventSummary; preload?: boolean }) {
  const buyable = event.status === "on-sale" || event.status === "selling-fast";

  return (
    <article className="event-card group relative flex h-full flex-col overflow-hidden rounded-2xl border p-2.5 sm:p-3">
      <div className="relative mb-3 aspect-[4/5] overflow-hidden rounded-xl bg-secondary">
        {/* The poster links to the event too; tabIndex -1 so keyboard users stop once, on the button */}
        <Link href={event.href} tabIndex={-1} aria-hidden="true" className="relative block size-full">
          <Image
            src={event.poster}
            alt=""
            fill
            preload={preload}
            sizes="(min-width: 1048px) 240px, (min-width: 1024px) 25vw, 50vw"
            className="event-poster object-cover"
          />
        </Link>
      </div>

      <div className="flex flex-1 flex-col px-0.5">
        <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon icon={Calendar03Icon} className="size-3.5 shrink-0" />
          <time dateTime={event.startsAt}>{dateFormat.format(new Date(event.startsAt))}</time>
        </p>
        <h3 className="mb-1.5 line-clamp-2 min-h-[2lh] text-sm leading-snug font-medium text-foreground sm:text-base">
          <Link href={event.href} className="hover:underline hover:underline-offset-2">
            {event.title}
          </Link>
        </h3>
        <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon icon={Location01Icon} className="size-3.5 shrink-0" />
          <span className="truncate">{event.venue}</span>
        </p>

        <Link
          href={event.href}
          aria-disabled={!buyable || undefined}
          className={`btn-buy mt-auto flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-medium ${buyable ? "" : "is-disabled"}`}
        >
          {buyable ? (
            <>
              <Icon icon={Ticket02Icon} className="size-4" />
              ซื้อบัตร
            </>
          ) : event.status === "sold-out" ? (
            "บัตรหมดแล้ว"
          ) : (
            "ดูรายละเอียด"
          )}
        </Link>
      </div>
    </article>
  );
}
