import type { Metadata } from "next";
import { Suspense } from "react";
import { EventBrowser } from "@/components/event-browser";
import { EventCard } from "@/components/event-card";
import { EventsGridSkeleton } from "@/components/skeletons";
import { getAllEvents } from "@/lib/events";
import { num } from "@/lib/format";

export const metadata: Metadata = {
  title: "อีเวนต์ทั้งหมด",
  description: "อีเวนต์ งานเลี้ยงรุ่น และคอนเสิร์ตทั้งหมดบน JoinTix ค้นหาและซื้อบัตรได้ทันที",
};

export default function EventsPage() {
  return (
    <main className="flex flex-1 justify-center px-3 pt-8 pb-16 sm:pt-10">
      <div className="stagger w-full min-w-0 max-w-5xl space-y-5">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">อีเวนต์ทั้งหมด</h1>
          <Suspense fallback={<p className="text-sm text-muted-foreground">&nbsp;</p>}>
            <EventCount />
          </Suspense>
        </header>
        <Suspense fallback={<EventsGridSkeleton />}>
          <AllEvents />
        </Suspense>
      </div>
    </main>
  );
}

/** From the database (lib/events.ts, cached under the events tag, so an admin save shows at once) */
async function AllEvents() {
  const events = await getAllEvents();
  return (
    <EventBrowser
      events={events.map((event, i) => ({
        id: event.id,
        status: event.status,
        searchText: `${event.title} ${event.venue} ${event.venueArea} ${event.organizer}`.toLowerCase(),
        card: <EventCard event={event} preload={i < 4} />,
      }))}
    />
  );
}

async function EventCount() {
  const events = await getAllEvents();
  const open = events.filter((e) => e.status === "on-sale" || e.status === "selling-fast").length;
  return (
    <p className="text-sm text-muted-foreground">
      {events.length ? `${num.format(events.length)} อีเวนต์ · เปิดขายอยู่ ${num.format(open)} งาน` : "ยังไม่มีอีเวนต์"}
    </p>
  );
}
