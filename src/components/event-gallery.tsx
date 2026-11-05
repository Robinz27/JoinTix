"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { ArrowLeft01Icon, ArrowRight01Icon, Cancel01Icon, Maximize01Icon, SearchAddIcon, SearchMinusIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/icon";
import { FadeImage } from "@/components/ui/fade-image";
import { isRemote } from "@/lib/poster";

// The event page's pictures, the way next.js-shop shows a product's (components/product/product-gallery.tsx
// there): the poster big in a card, the rest as thumbnails under it, and a tap opens the full-size view.
// That view zooms in on the detail (double-click or double-tap, the mouse wheel, two fingers), drags around
// once zoomed, and swipes (or ←/→) to the next picture when not.

export function EventGallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const [viewing, setViewing] = useState(false);
  const src = images[active] ?? images[0];

  return (
    <div className="rounded-2xl border border-border bg-card p-2.5 sm:p-3">
      <button
        type="button"
        onClick={() => setViewing(true)}
        aria-label="ดูรูปขนาดเต็ม"
        className="group relative block aspect-[4/5] w-full overflow-hidden rounded-xl bg-secondary"
      >
        {/* key: a new picture gets its own fade-in */}
        <FadeImage
          key={src}
          src={src}
          alt={active === 0 ? `โปสเตอร์ ${title}` : `${title} รูปที่ ${active + 1}`}
          fill
          preload={active === 0}
          sizes="(min-width: 640px) 288px, 100vw"
          unoptimized={isRemote(src)}
          className="object-cover"
        />
        <span className="absolute right-2.5 bottom-2.5 grid size-8 place-items-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 max-sm:opacity-100">
          <Icon icon={Maximize01Icon} className="size-4" />
        </span>
      </button>

      {images.length > 1 && (
        <ul className="mt-2.5 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
          {images.map((img, i) => (
            <li key={`${i}-${img}`} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`รูปที่ ${i + 1}`}
                aria-pressed={i === active}
                className={`relative block size-14 overflow-hidden rounded-lg border-2 bg-secondary transition-colors sm:size-16 ${
                  i === active ? "border-foreground" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <FadeImage src={img} alt="" fill sizes="64px" unoptimized={isRemote(img)} className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {viewing && (
        <Lightbox
          images={images}
          start={active}
          title={title}
          // The picture looked at last is the one the page shows after
          onClose={(index) => {
            setActive(index);
            setViewing(false);
          }}
        />
      )}
    </div>
  );
}

const MAX_ZOOM = 4;
const TAP_ZOOM = 2.5;

type View = { scale: number; x: number; y: number };
const FIT: View = { scale: 1, x: 0, y: 0 };

function Lightbox({ images, start, title, onClose }: { images: string[]; start: number; title: string; onClose: (index: number) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [index, setIndex] = useState(start);
  const [view, setView] = useState<View>(FIT);
  // The view as of the last change, for gestures whose events come faster than renders
  const latest = useRef<View>(FIT);
  const show = (v: View) => {
    latest.current = v;
    setView(v);
  };
  const [moving, setMoving] = useState(false);
  // Fingers / the mouse on the picture, by pointer id
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startX: number; startY: number; view: View; pinch: number; swiped: boolean } | null>(null);
  const lastTap = useRef(0);
  const many = images.length > 1;
  const zoomed = view.scale > 1.01;

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  /** Keeps the picture covering where it was: no dragging it off into the dark */
  const clamp = (v: View): View => {
    const el = img.current;
    if (!el || v.scale <= 1) return FIT;
    const maxX = ((v.scale - 1) * el.offsetWidth) / 2;
    const maxY = ((v.scale - 1) * el.offsetHeight) / 2;
    return { scale: v.scale, x: Math.min(maxX, Math.max(-maxX, v.x)), y: Math.min(maxY, Math.max(-maxY, v.y)) };
  };

  /** To `scale`, keeping the point under (clientX, clientY) where it is */
  const zoomAt = (from: View, scale: number, clientX?: number, clientY?: number): View => {
    const el = img.current;
    const next = Math.min(MAX_ZOOM, Math.max(1, scale));
    if (!el || clientX === undefined || clientY === undefined) return clamp({ ...from, scale: next });
    const rect = el.getBoundingClientRect();
    const px = clientX - (rect.left + rect.width / 2) + from.x;
    const py = clientY - (rect.top + rect.height / 2) + from.y;
    const k = next / from.scale;
    return clamp({ scale: next, x: px - (px - from.x) * k, y: py - (py - from.y) * k });
  };

  const go = (by: number) => {
    if (!many) return;
    setIndex((i) => (i + by + images.length) % images.length);
    show(FIT);
  };

  const onDown = (e: ReactPointerEvent) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // A pointer the browser no longer knows (it lifted already): nothing to hold on to
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    gesture.current = {
      startX: pts[0].x,
      startY: pts[0].y,
      view: latest.current,
      pinch: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0,
      swiped: false,
    };
    setMoving(true);
  };

  const onMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && g.pinch > 0) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      show(zoomAt(g.view, g.view.scale * (d / g.pinch), (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2));
    } else if (pts.length === 1 && g.view.scale > 1.01) {
      show(clamp({ ...g.view, x: g.view.x + (pts[0].x - g.startX), y: g.view.y + (pts[0].y - g.startY) }));
    }
  };

  const onUp = (e: ReactPointerEvent) => {
    const g = gesture.current;
    const had = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) {
      // One finger of a pinch lifted: carry on dragging with the other from here
      const [rest] = pointers.current.values();
      gesture.current = { startX: rest.x, startY: rest.y, view: latest.current, pinch: 0, swiped: true };
      return;
    }
    setMoving(false);
    gesture.current = null;
    if (!g || !had) return;
    const dx = had.x - g.startX;
    const dy = had.y - g.startY;

    // A swipe when not zoomed in: the next picture
    if (!g.swiped && g.view.scale <= 1.01 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) return go(dx < 0 ? 1 : -1);

    // A tap: two in a row zoom in at that point, or back out
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && !g.swiped) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        lastTap.current = 0;
        show(latest.current.scale > 1.01 ? FIT : zoomAt(latest.current, TAP_ZOOM, had.x, had.y));
      } else lastTap.current = now;
    }
  };

  const onWheel = (e: WheelEvent) => {
    show(zoomAt(latest.current, latest.current.scale * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY));
  };

  const button = "grid size-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20";

  return (
    <dialog
      ref={dialog}
      aria-label={title}
      onClose={(e) => e.target === e.currentTarget && onClose(index)}
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(-1);
        else if (e.key === "ArrowRight") go(1);
        else if (e.key === "+" || e.key === "=") show(zoomAt(latest.current, latest.current.scale * 1.5));
        else if (e.key === "-") show(zoomAt(latest.current, latest.current.scale / 1.5));
        else return;
        e.preventDefault();
      }}
      className="lightbox m-auto max-h-none max-w-none overflow-visible bg-transparent p-0 backdrop:bg-black/90"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- the full-size original, any host */}
      <img
        ref={img}
        key={images[index]}
        src={images[index]}
        alt={`${title} รูปที่ ${index + 1}`}
        draggable={false}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transition: moving ? "none" : "transform 200ms ease-out",
        }}
        className={`block max-h-[92svh] max-w-[92vw] touch-none rounded-xl object-contain select-none ${zoomed ? (moving ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"}`}
      />

      <div className="fixed top-4 right-4 flex gap-2">
        <button type="button" onClick={() => show(zoomed ? FIT : zoomAt(latest.current, TAP_ZOOM))} aria-label={zoomed ? "ย่อกลับ" : "ซูมเข้า"} className={button}>
          <Icon icon={zoomed ? SearchMinusIcon : SearchAddIcon} className="size-5" />
        </button>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="ปิด" className={button}>
          <Icon icon={Cancel01Icon} className="size-5" />
        </button>
      </div>

      {many && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="รูปก่อนหน้า" className={`${button} fixed top-1/2 left-3 -translate-y-1/2 max-sm:hidden`}>
            <Icon icon={ArrowLeft01Icon} className="size-5" />
          </button>
          <button type="button" onClick={() => go(1)} aria-label="รูปถัดไป" className={`${button} fixed top-1/2 right-3 -translate-y-1/2 max-sm:hidden`}>
            <Icon icon={ArrowRight01Icon} className="size-5" />
          </button>
          <p className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white tabular-nums backdrop-blur">
            {index + 1} / {images.length}
          </p>
        </>
      )}
      {!zoomed && (
        <p className="pointer-events-none fixed bottom-14 left-1/2 hidden -translate-x-1/2 text-2xs text-white/50 sm:block">ดับเบิลคลิกหรือเลื่อนลูกกลิ้งเพื่อซูม</p>
      )}
    </dialog>
  );
}
