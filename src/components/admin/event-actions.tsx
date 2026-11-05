"use client";

import { useActionState, useId, useState, useTransition } from "react";
import Link from "next/link";
import { Copy01Icon, Delete02Icon, LinkSquare02Icon, Loading03Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { deleteEvent, duplicateEvent } from "@/app/actions/admin-events";
import type { AdminFormState } from "@/app/actions/admin";
import { AdminDialog } from "@/components/admin/dialog";
import { Notice, label } from "@/components/admin/form";
import { iconButton, input, pill } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { Hint } from "@/components/ui/hint";

// แก้ไข / ดูหน้าขาย / ทำสำเนา / ลบ on each row of อีเวนต์ (app/admin/events), like member-actions.tsx

export type EventRef = { id: string; slug: string; title: string; status: string; sold: number };

/** ลบอีเวนต์: type the slug back to confirm. `from="edit"` goes back to the list once it's gone */
export function DeleteEventDialog({ event, from, onClose }: { event: EventRef; from?: "edit"; onClose: () => void }) {
  const [state, action, pending] = useActionState(deleteEvent, {});
  const ids = useId();
  return (
    <AdminDialog onClose={onClose} done={Boolean(state.ok)} danger icon={Delete02Icon} title="ลบอีเวนต์" subtitle={event.title} width="28rem">
      <form action={action} className="space-y-4">
        <input type="hidden" name="eventId" value={event.id} />
        {from && <input type="hidden" name="from" value={from} />}
        <Notice state={state} />
        {event.sold > 0 ? (
          <p className="text-sm text-muted-foreground">
            งานนี้ขายบัตรไปแล้ว {event.sold.toLocaleString("th-TH")} ใบ จึงลบไม่ได้ ให้แก้สถานะเป็น <b className="text-foreground">ปิดการขาย</b> แทน
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">ลบอีเวนต์และโซนบัตรทั้งหมดถาวร ย้อนกลับไม่ได้ หน้าขายจะขึ้น 404</p>
            <div>
              <label htmlFor={`${ids}-confirm`} className={label}>
                พิมพ์ <span className="font-mono text-foreground">{event.slug}</span> เพื่อยืนยัน
              </label>
              <input id={`${ids}-confirm`} name="confirm" required autoComplete="off" spellCheck={false} className={input} />
            </div>
          </>
        )}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" onClick={onClose} className={pill}>
            ยกเลิก
          </button>
          {event.sold === 0 && (
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-70"
            >
              {pending && <Icon icon={Loading03Icon} className="size-4 animate-spin" />}
              ลบถาวร
            </button>
          )}
        </div>
      </form>
    </AdminDialog>
  );
}

/** ทำสำเนา: a draft copy, then straight to editing it (duplicateEvent redirects) */
export function DuplicateButton({ eventId, className = iconButton, children }: { eventId: string; className?: string; children?: React.ReactNode }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminFormState>({});
  return (
    <Hint label={result.error ?? "ทำสำเนาเป็นฉบับร่าง"}>
      <button
        type="button"
        aria-label="ทำสำเนา"
        disabled={pending}
        onClick={() => start(async () => setResult((await duplicateEvent(eventId)) ?? {}))}
        className={className}
      >
        <Icon icon={pending ? Loading03Icon : Copy01Icon} className={`size-4 ${pending ? "animate-spin" : ""}`} />
        {children}
      </button>
    </Hint>
  );
}

export function EventActions({ event }: { event: EventRef }) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="flex justify-end gap-1.5">
      <Hint label="แก้ไข">
        <Link href={`/admin/events/${event.id}`} aria-label={`แก้ไข ${event.title}`} className={iconButton}>
          <Icon icon={PencilEdit02Icon} className="size-4" />
        </Link>
      </Hint>
      {event.status !== "draft" && (
        <span className="max-sm:hidden">
          <Hint label="ดูหน้าขาย">
            <Link href={`/events/${event.slug}`} target="_blank" aria-label={`ดูหน้าขาย ${event.title}`} className={iconButton}>
              <Icon icon={LinkSquare02Icon} className="size-4" />
            </Link>
          </Hint>
        </span>
      )}
      <span className="max-sm:hidden">
        <DuplicateButton eventId={event.id} />
      </span>
      <Hint label="ลบ">
        <button type="button" aria-label={`ลบ ${event.title}`} onClick={() => setDeleting(true)} className={`${iconButton} hover:border-red-500/40 hover:text-red-500`}>
          <Icon icon={Delete02Icon} className="size-4" />
        </button>
      </Hint>
      {deleting && <DeleteEventDialog event={event} onClose={() => setDeleting(false)} />}
    </div>
  );
}
