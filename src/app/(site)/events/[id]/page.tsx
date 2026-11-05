import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft01Icon, Calendar03Icon, Clock01Icon, Door01Icon, Location01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { Icon, type IconSvgElement } from "@/components/icon";
import { TicketPanel } from "@/components/ticket-panel";
import { FadeImage } from "@/components/ui/fade-image";
import { getEvent, getEventSlugs } from "@/lib/events";
import { isRemote } from "@/lib/poster";

// Always Thai time, so the server and every visitor see the same date
const dateFormat = new Intl.DateTimeFormat("th-TH", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});
const timeFormat = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

// Events on the site are built ahead of time; one published later renders on its first visit.
// The [id] segment is the event's slug (events.slug)
export async function generateStaticParams() {
  return (await getEventSlugs()).map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const event = await getEvent((await params).id);
  return { title: event?.title ?? "ไม่พบอีเวนต์" };
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
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden rounded-2xl bg-secondary sm:w-56">
                <FadeImage src={event.poster} alt={`โปสเตอร์ ${event.title}`} fill preload sizes="(min-width: 640px) 224px, 100vw" unoptimized={isRemote(event.poster)} className="object-cover" />
              </div>

              <div className="min-w-0">
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
                  <Fact icon={Location01Icon} label="สถานที่">
                    {event.venue}
                  </Fact>
                  <Fact icon={UserGroupIcon} label="จำกัด">
                    {event.maxPerOrder} ใบต่อบัญชี
                  </Fact>
                </dl>
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
            />
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
