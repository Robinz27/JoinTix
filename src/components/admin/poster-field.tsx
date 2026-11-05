"use client";

import { useRef, useState, type DragEvent } from "react";
import Image from "next/image";
import { Cancel01Icon, ImageAdd01Icon, Link01Icon, Upload04Icon } from "@hugeicons/core-free-icons";
import { hint, label } from "@/components/admin/form";
import { input } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { isPosterSrc, isRemote } from "@/lib/poster";
import { shrinkImage } from "@/lib/shrink-image";

// The event's poster, picked the way next.js-shop's back office picks pictures (picture-field.tsx and
// products/image-upload.tsx there): click or drop a file, see it at once, and nothing is sent until the
// form is saved (saveEvent stores it with lib/uploads.ts). The pictures already in public/posters and a
// typed path or link are still there for posters that live elsewhere.

const TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

/** A file chosen but not sent yet, with the preview URL made for it */
export type PickedPoster = { file: File; url: string };

export function PosterField({
  id,
  poster,
  onPoster,
  picked,
  onPick,
  posters,
}: {
  id: string;
  /** The saved or chosen path; what is stored when no file is picked */
  poster: string;
  onPoster: (poster: string) => void;
  picked: PickedPoster | null;
  /** A new file, or null to let go of the one picked */
  onPick: (file: File | null) => void;
  /** The pictures in public/posters */
  posters: string[];
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const shownPath = isPosterSrc(poster) ? poster : "";

  async function take(file: File | undefined) {
    if (!file) return;
    if (!TYPES.includes(file.type)) return setProblem(`${file.name}: รองรับเฉพาะ JPG, PNG, GIF และ WebP`);
    setBusy(true);
    setProblem(undefined);
    try {
      const ready = await shrinkImage(file);
      if (ready.size > MAX_BYTES) setProblem(`${file.name}: ไฟล์ใหญ่เกิน 10 MB`);
      else onPick(ready);
    } finally {
      setBusy(false);
    }
  }

  function drop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void take(e.dataTransfer.files[0]);
  }

  return (
    <div className="space-y-4">
      <div>
        <button
          id={id}
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
          aria-label={picked || shownPath ? "เปลี่ยนโปสเตอร์" : "อัปโหลดโปสเตอร์"}
          className={`group relative mx-auto grid aspect-[4/5] w-full max-w-60 place-items-center overflow-hidden rounded-xl border-2 border-dashed bg-secondary/60 text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground ${
            dragging ? "border-primary bg-primary/10 text-foreground" : "border-border"
          } ${busy ? "cursor-wait opacity-60" : ""}`}
        >
          {(picked || shownPath) && !dragging ? (
            <>
              {picked ? (
                // A blob: URL for a file not sent yet; next/image has nothing to optimise here
                // eslint-disable-next-line @next/next/no-img-element
                <img src={picked.url} alt="โปสเตอร์ที่เลือก" className="absolute inset-0 size-full object-cover" />
              ) : (
                <Image key={shownPath} src={shownPath} alt="โปสเตอร์" fill sizes="240px" unoptimized={isRemote(shownPath)} className="object-cover" />
              )}
              {picked && (
                <span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-2xs font-medium text-primary-foreground">
                  รูปใหม่ · ยังไม่บันทึก
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-black/65 py-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 max-sm:opacity-100">
                <Icon icon={Upload04Icon} className="size-4" />
                แตะหรือลากไฟล์มาวางเพื่อเปลี่ยน
              </span>
            </>
          ) : (
            <span className="flex flex-col items-center gap-1 px-3 text-center">
              <Icon icon={dragging ? Upload04Icon : ImageAdd01Icon} className="size-7" />
              <span className="text-sm font-medium">{busy ? "กำลังเตรียมรูป…" : dragging ? "วางไฟล์ที่นี่" : "คลิกหรือลากไฟล์มาวาง"}</span>
              <span className="text-2xs">JPG, PNG, GIF, WebP · ไม่เกิน 10 MB</span>
            </span>
          )}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={TYPES.join(",")}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // picking the same file again still counts
            void take(file);
          }}
        />
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
          {picked ? (
            <button type="button" onClick={() => onPick(null)} className="inline-flex items-center gap-1 transition-colors hover:text-red-500">
              <Icon icon={Cancel01Icon} className="size-3" />
              ยกเลิกไฟล์ที่เลือก (ใช้รูปเดิม)
            </button>
          ) : (
            <span>แนวตั้ง 4:5 · ระบบย่อเป็น WebP ให้เอง</span>
          )}
        </div>
        {problem && <p className="mt-1.5 text-center text-2xs text-red-500">{problem}</p>}
      </div>

      {posters.length > 0 && (
        <div>
          <p className={label}>หรือเลือกจากรูปที่มีในเว็บ</p>
          <div className="grid grid-cols-4 gap-2">
            {posters.map((src) => {
              const chosen = !picked && poster === src;
              return (
                <button
                  key={src}
                  type="button"
                  onClick={() => {
                    onPick(null);
                    onPoster(src);
                  }}
                  aria-label={`ใช้ ${src}`}
                  aria-pressed={chosen}
                  className={`relative aspect-[4/5] overflow-hidden rounded-lg border bg-secondary transition-colors ${
                    chosen ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <Image src={src} alt="" fill sizes="64px" className="object-cover" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <details className="group/link">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <Icon icon={Link01Icon} className="size-3.5" />
          ใส่ที่อยู่รูปเอง
        </summary>
        <input
          aria-label="ที่อยู่รูปโปสเตอร์"
          value={picked ? "" : poster}
          disabled={Boolean(picked)}
          onChange={(e) => onPoster(e.target.value.trim())}
          placeholder={picked ? "ใช้ไฟล์ที่อัปโหลด" : "/posters/my-event.jpg หรือ https://…"}
          className={`${input} mt-2`}
        />
        <p className={hint}>ไฟล์ใน public/ เช่น /posters/x.svg หรือลิงก์ https://</p>
      </details>
    </div>
  );
}
