import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { EventGallery } from "@/components/event-gallery";
import { Icon } from "@/components/icon";
import { ShareRow } from "@/components/share-row";
import { TicketPanel } from "@/components/ticket-panel";
import { getEvent, getEventSlugs, type EventStatus } from "@/lib/events";

// Always Thai time, so the server and every visitor see the same date
const dateFormat = new Intl.DateTimeFormat("th-TH", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});
const shortDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
const timeFormat = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
const baht = new Intl.NumberFormat("th-TH");

/** The sale status as a badge in the info card (.status-badge in globals.css) */
const STATUS: Record<EventStatus, { label: string; tone: "on" | "warn" | "wait" | "off" }> = {
  "on-sale": { label: "เปิดขาย", tone: "on" },
  "selling-fast": { label: "ใกล้หมด", tone: "warn" },
  "coming-soon": { label: "รอเปิดขาย", tone: "wait" },
  "sold-out": { label: "บัตรหมดแล้ว", tone: "off" },
  closed: { label: "ปิดการขาย", tone: "off" },
};

// Events on the site are built ahead of time; one published later renders on its first visit.
// The [id] segment is the event's slug (events.slug)
export async function generateStaticParams() {
  return (await getEventSlugs()).map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const event = await getEvent((await params).id);
  if (!event) return { title: "ไม่พบอีเวนต์" };
  // What a shared link shows as its card (LINE, Facebook, Discord…)
  return {
    title: event.title,
    description: event.description[0],
    openGraph: { title: event.title, description: event.description[0], images: [event.poster] },
  };
}

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const event = await getEvent((await params).id);
  if (!event) notFound();

  const startsAt = new Date(event.startsAt);
  const left = event.zones.reduce((n, zone) => n + zone.remaining, 0);
  const status = STATUS[event.status];
  const priceTo = Math.max(...event.zones.map((zone) => zone.price));

  return (
    <main className="flex flex-1 justify-center px-3 pt-6 pb-16 sm:pt-8">
      <div className="w-full max-w-5xl">
        <Link
          href="/"
          className="stagger-item mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Icon icon={ArrowLeft01Icon} className="size-4" />
          กลับหน้าแรก
        </Link>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
          <div className="stagger min-w-0">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="w-full shrink-0 sm:w-72">
                <EventGallery images={event.images} title={event.title} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="mb-1 text-sm text-muted-foreground">{event.organizer}</p>
                <h1 className="mb-4 text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">{event.title}</h1>

                {/* ข้อมูลอีเวนต์, framed the way next.js-shop frames ข้อมูลสินค้า */}
                <section aria-labelledby="event-facts" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <h2 id="event-facts" className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span className="grid size-7 place-items-center rounded-lg border border-border bg-secondary">
                      <Icon icon={InformationCircleIcon} className="size-4" />
                    </span>
                    ข้อมูลอีเวนต์
                  </h2>
                  <dl className="divide-y divide-border text-sm">
                    <Fact label="สถานะ">
                      <span className="status-badge" data-tone={status.tone}>
                        <span className="status-badge-dot" aria-hidden="true" />
                        {status.label}
                      </span>
                    </Fact>
                    <Fact label="วันที่">
                      <time dateTime={event.startsAt}>{dateFormat.format(startsAt)}</time>
                    </Fact>
                    <Fact label="เวลาเริ่ม">
                      {timeFormat.format(startsAt)} น.
                    </Fact>
                    <Fact label="ประตูเปิด">
                      {timeFormat.format(new Date(event.doorsAt))} น.
                    </Fact>
                    <Fact label="สถานที่">
                      {event.venue}
                    </Fact>
                    <Fact label="ผู้จัด">
                      {event.organizer}
                    </Fact>
                    <Fact label="ราคา">
                      {event.priceFrom === priceTo
                        ? event.priceFrom === 0
                          ? "ฟรี"
                          : `฿${baht.format(event.priceFrom)}`
                        : `${event.priceFrom === 0 ? "ฟรี" : `฿${baht.format(event.priceFrom)}`} – ฿${baht.format(priceTo)}`}
                    </Fact>
                    {event.status !== "closed" && event.status !== "coming-soon" && (
                      <Fact label="คงเหลือ">
                        {baht.format(left)} ใบ
                      </Fact>
                    )}
                    <Fact label="จำกัด">
                      {event.maxPerOrder} ใบต่อบัญชี
                    </Fact>
                  </dl>
                </section>
              </div>
            </div>

            <section className="mt-8">
              <h2 className="mb-2 text-lg font-medium text-foreground">รายละเอียดงาน</h2>
              <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                {event.description.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          </div>

          {/* Sticks beside the details on wide screens; under them on phones */}
          <aside className="stagger-item lg:sticky lg:top-24 lg:self-start" style={{ "--i": 2 } as React.CSSProperties}>
            <TicketPanel
              slug={event.slug}
              status={event.status}
              zones={event.zones}
              maxPerOrder={event.maxPerOrder}
              salesStart={`${dateFormat.format(new Date(event.salesStartAt))} ${timeFormat.format(new Date(event.salesStartAt))} น.`}
            >
              <ShareRow title={event.title} when={`${shortDate.format(startsAt)} · ${event.venue}`} />
            </TicketPanel>
          </aside>
        </div>
      </div>
    </main>
  );
}

/** One row of the info card: the label on the left, the value on the right */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-foreground">{children}</dd>
    </div>
  );
}
