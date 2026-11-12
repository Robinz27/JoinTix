import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft01Icon,
  ArrowUpRight01Icon,
  Calendar03Icon,
  Clock01Icon,
  Door01Icon,
  Location01Icon,
  MapsLocation01Icon,
  Navigation03Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { EventGallery } from "@/components/event-gallery";
import { Icon, type IconSvgElement } from "@/components/icon";
import { ShareRow } from "@/components/share-row";
import { TicketPanel } from "@/components/ticket-panel";
import { getEvent, getEventSlugs } from "@/lib/events";
import { directionsLink, embedLink, mapsLink } from "@/lib/map";

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

                <dl className="space-y-2.5 text-sm">
                  <Fact icon={Calendar03Icon} label="วันที่">
                    <time dateTime={event.startsAt}>{dateFormat.format(startsAt)}</time>
                  </Fact>
                  <Fact icon={Clock01Icon} label="เวลาเริ่ม">
                    {timeFormat.format(startsAt)} น.
                  </Fact>
                  <Fact icon={Door01Icon} label="ประตูเปิด">
                    {timeFormat.format(new Date(event.doorsAt))} น.
                  </Fact>
                  <Fact icon={UserGroupIcon} label="จำกัด">
                    {event.maxPerOrder} ใบต่อบัญชี
                  </Fact>
                </dl>

                {/* Where: the venue with its pin, one tap from the phone's map app */}
                <div className="mt-5 flex items-start gap-3 border-t border-border pt-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-secondary text-foreground">
                    <Icon icon={Location01Icon} className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-balance text-foreground">{event.venue}</p>
                    {event.venueArea && <p className="mt-0.5 text-sm text-muted-foreground">{event.venueArea}</p>}
                    {event.pin && (
                      <a
                        href={mapsLink(event.pin)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-foreground underline decoration-muted-foreground/50 underline-offset-4 transition-colors hover:decoration-foreground"
                      >
                        เปิดแผนที่
                        <Icon icon={ArrowUpRight01Icon} className="size-3.5" />
                      </a>
                    )}
                  </div>
                </div>
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

            {event.pin && (
              <section className="mt-8">
                <h2 className="mb-3 text-lg font-medium text-foreground">การเดินทาง</h2>
                <div className="overflow-hidden rounded-2xl border border-border bg-secondary">
                  <iframe
                    title={`แผนที่ ${event.venue}`}
                    src={embedLink(event.pin)}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="block aspect-[16/10] w-full border-0 sm:aspect-[16/7]"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={directionsLink(event.pin)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
                  >
                    <Icon icon={Navigation03Icon} className="size-4" />
                    นำทางไปงาน
                  </a>
                  <a
                    href={mapsLink(event.pin)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    <Icon icon={MapsLocation01Icon} className="size-4" />
                    เปิดใน Google Maps
                  </a>
                </div>
              </section>
            )}
          </div>

          {/* Sticks beside the details on wide screens; under them on phones */}
          <aside className="stagger-item lg:sticky lg:top-24 lg:self-start" style={{ "--i": 2 } as React.CSSProperties}>
            <TicketPanel
              slug={event.slug}
              status={event.status}
              zones={event.zones}
              merch={event.merch}
              shippingFee={event.shippingFee}
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

function Fact({ icon, label, children }: { icon: IconSvgElement; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon icon={icon} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  );
}
