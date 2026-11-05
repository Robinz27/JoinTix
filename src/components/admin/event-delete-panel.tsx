"use client";

import { useState } from "react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { DeleteEventDialog, type EventRef } from "@/components/admin/event-actions";
import { card } from "@/components/admin/ui";
import { Icon } from "@/components/icon";

/** The danger zone at the foot of an event's edit page */
export function DeleteEventPanel({ event }: { event: EventRef }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={`${card} mt-4 flex flex-wrap items-center justify-between gap-3 border-red-500/30 p-4 sm:p-5`}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">ลบอีเวนต์</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {event.sold > 0 ? "ขายบัตรไปแล้ว ลบไม่ได้ ให้ตั้งสถานะเป็นปิดการขายแทน" : "ลบงานนี้และโซนบัตรทั้งหมดถาวร"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-red-500/40 px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
      >
        <Icon icon={Delete02Icon} className="size-4" />
        ลบอีเวนต์
      </button>
      {open && <DeleteEventDialog event={event} from="edit" onClose={() => setOpen(false)} />}
    </section>
  );
}
