"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/icon";

/** Search box in a modal. Submitting goes to the events page with ?q= (results come later). */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q")?.toString().trim();
    if (!q) return;
    onClose();
    router.push(`/events?q=${encodeURIComponent(q)}`);
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // A click on the backdrop lands on the <dialog> itself
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label="ค้นหาอีเวนต์"
      className="search-dialog mx-auto mt-[12vh] w-[calc(100%-1.5rem)] max-w-lg rounded-3xl border border-border bg-card p-2 text-foreground shadow-2xl shadow-black/30"
    >
      <form onSubmit={submit} className="flex items-center gap-2 rounded-2xl bg-input px-3">
        <Icon icon={Search01Icon} className="size-4 shrink-0 text-muted-foreground" />
        <input
          name="q"
          type="search"
          autoFocus
          autoComplete="off"
          placeholder="ค้นหาอีเวนต์ ศิลปิน หรือสถานที่..."
          className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดการค้นหา"
          className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Icon icon={Cancel01Icon} className="size-4" />
        </button>
      </form>
      <p className="px-3 pt-2 pb-1 text-2xs text-muted-foreground">กด Enter เพื่อค้นหา · Esc เพื่อปิด</p>
    </dialog>
  );
}
