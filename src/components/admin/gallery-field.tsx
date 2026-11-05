"use client";

import { useRef, useState, type DragEvent } from "react";
import Image from "next/image";
import { ArrowLeft01Icon, ArrowRight01Icon, Cancel01Icon, ImageAdd01Icon, Upload04Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/icon";
import { MAX_GALLERY } from "@/lib/event-fields";
import { isRemote } from "@/lib/poster";
import { shrinkImage } from "@/lib/shrink-image";

// รูปเพิ่มเติม: the pictures shown after the poster on the event page, like the gallery under a product's
// main picture in next.js-shop's product form. Add several at once (click or drop), reorder, remove;
// nothing is sent until the form is saved (saveEvent stores new files with lib/uploads.ts).

const TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

/** A picture already saved (`path`), or a file picked and not sent yet (`file`, with its preview URL) */
export type GalleryItem = { key: string; path?: string; file?: File; url: string };

let nextKey = 0;
export const savedItem = (path: string): GalleryItem => ({ key: `saved-${nextKey++}`, path, url: path });

export function GalleryField({ items, onChange }: { items: GalleryItem[]; onChange: (items: GalleryItem[]) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const room = MAX_GALLERY - items.length;

  async function take(files: File[]) {
    if (!files.length) return;
    const problems: string[] = [];
    const usable = files.filter((file) => (TYPES.includes(file.type) ? true : (problems.push(`${file.name}: รองรับเฉพาะ JPG, PNG, GIF, WebP`), false)));
    if (usable.length > room) problems.push(`ใส่ได้อีก ${room} รูป (สูงสุด ${MAX_GALLERY})`);
    setBusy(true);
    try {
      const ready = await Promise.all(usable.slice(0, Math.max(0, room)).map((file) => shrinkImage(file)));
      const added = ready
        .filter((file) => (file.size <= MAX_BYTES ? true : (problems.push(`${file.name}: ไฟล์ใหญ่เกิน 10 MB`), false)))
        .map((file) => ({ key: `new-${nextKey++}`, file, url: URL.createObjectURL(file) }));
      if (added.length) onChange([...items, ...added]);
    } finally {
      setBusy(false);
      setProblem(problems.join(" · ") || undefined);
    }
  }

  const remove = (item: GalleryItem) => {
    if (item.file) URL.revokeObjectURL(item.url);
    onChange(items.filter((other) => other.key !== item.key));
  };
  const move = (index: number, by: number) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    onChange(next);
  };

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void take([...e.dataTransfer.files]);
  };

  return (
    <div>
      <ul className="grid grid-cols-3 gap-2">
        {items.map((item, i) => (
          <li key={item.key} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary">
            {item.file ? (
              // A blob: URL for a file not sent yet; next/image has nothing to optimise here
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt={`รูปที่ ${i + 1}`} className="absolute inset-0 size-full object-cover" />
            ) : (
              <Image src={item.url} alt={`รูปที่ ${i + 1}`} fill sizes="96px" unoptimized={isRemote(item.url)} className="object-cover" />
            )}
            {item.file && <span className="absolute top-1 left-1 rounded-full bg-primary px-1.5 py-px text-[9px] font-medium text-primary-foreground">ใหม่</span>}
            <button
              type="button"
              onClick={() => remove(item)}
              aria-label={`เอารูปที่ ${i + 1} ออก`}
              className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-red-600"
            >
              <Icon icon={Cancel01Icon} className="size-3.5" />
            </button>
            {items.length > 1 && (
              <div className="absolute inset-x-1 bottom-1 flex justify-between">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`เลื่อนรูปที่ ${i + 1} ไปก่อน`}
                  className="grid size-6 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm disabled:opacity-0"
                >
                  <Icon icon={ArrowLeft01Icon} className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  aria-label={`เลื่อนรูปที่ ${i + 1} ไปหลัง`}
                  className="grid size-6 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm disabled:opacity-0"
                >
                  <Icon icon={ArrowRight01Icon} className="size-3.5" />
                </button>
              </div>
            )}
          </li>
        ))}
        {room > 0 && (
          <li className="aspect-square">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={drop}
              disabled={busy}
              aria-busy={busy}
              aria-label="เพิ่มรูป"
              className={`flex size-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-center text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground ${
                dragging ? "border-primary bg-primary/10 text-foreground" : "border-border bg-secondary/40"
              } ${busy ? "cursor-wait opacity-60" : ""}`}
            >
              <Icon icon={dragging ? Upload04Icon : ImageAdd01Icon} className="size-5" />
              <span className="text-2xs font-medium">{busy ? "กำลังเตรียม…" : dragging ? "วางที่นี่" : "เพิ่มรูป"}</span>
            </button>
          </li>
        )}
      </ul>
      <input
        ref={fileInput}
        type="file"
        accept={TYPES.join(",")}
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = ""; // picking the same files again still counts
          void take(files);
        }}
      />
      <p className="mt-1.5 text-2xs text-muted-foreground">
        {items.length}/{MAX_GALLERY} รูป · แสดงต่อจากโปสเตอร์ตามลำดับนี้ เลือกหลายรูปพร้อมกันได้
      </p>
      {problem && <p className="mt-1 text-2xs text-red-500">{problem}</p>}
    </div>
  );
}
