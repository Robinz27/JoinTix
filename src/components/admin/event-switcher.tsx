"use client";

import { useRouter } from "next/navigation";
import { DoorPicker } from "@/components/admin/door-picker";
import { card } from "@/components/admin/ui";
import type { DoorEvent } from "@/lib/checkins";

/** Which event a page is about, kept in ?event= so the page itself stays a server component */
export function EventSwitcher({ events, value, path, label }: { events: DoorEvent[]; value: string | null; path: string; label: string }) {
  const router = useRouter();
  return (
    <section className={`${card} mb-4 p-3 sm:p-4`}>
      <DoorPicker events={events} value={value} label={label} allowAll={false} onChange={(id) => id && router.push(`${path}?event=${id}`)} />
    </section>
  );
}
