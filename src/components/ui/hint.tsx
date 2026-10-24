"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// The little label that explains a button.
//
// It replaces the browser's own `title`, which waits about a second, arrives in the operating system's
// font and colours, and can't be styled at all — on a row of icon buttons that is most of the guidance
// the page gives, so it may as well look like the page.
//
// Two details make it behave like a tooltip rather than a flash of text: a short delay before it opens,
// so sweeping the pointer across a row of buttons doesn't fire four of them, and rendering into <body>,
// so it can't be clipped by the card it sits in. Keyboard focus opens it too — the `title` it replaces
// never did that.

const DELAY = 140;

/** Wide enough for a sentence, narrow enough to stay beside the control it explains. */
const MAX_WIDTH = 288;

/**
 * Pulls the label back inside the window once it is on screen and its width is known.
 *
 * A tooltip is centred on its control, which for a control near an edge can put half of it past the
 * edge — how much depends on how wide the words came out. Reserving the widest it could ever be would
 * shove short labels sideways for no reason, so instead it is measured here, in the ref callback, which
 * runs after the browser has laid it out and before it paints: no flicker, and no state to keep.
 */
const keepInView = (tip: HTMLSpanElement | null) => {
  if (!tip) return;
  const half = tip.getBoundingClientRect().width / 2;
  const middle = Number.parseFloat(tip.style.left);
  const least = half + 8;
  const most = window.innerWidth - half - 8;
  const x = Math.min(Math.max(middle, least), Math.max(least, most));
  if (x !== middle) tip.style.left = `${x}px`;
};

export function Hint({
  label,
  children,
  className = "",
  /**
   * The wrapper draws no box of its own (`display: contents`), so it can go around a line of text that
   * has to keep truncating inside its parent's layout — a product name in a card, the shop name in the
   * bar. What it wraps is measured in its place.
   */
  contents = false,
}: {
  /** Nothing to say (a button that is only sometimes explained) leaves the tooltip shut */
  label?: string | null;
  children: ReactNode;
  className?: string;
  contents?: boolean;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const timer = useRef(0);
  const [at, setAt] = useState<{ x: number; y: number; above: boolean } | null>(null);

  const open = () => {
    if (!label) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const box = (contents ? anchor.current?.firstElementChild : anchor.current)?.getBoundingClientRect();
      if (!box) return;
      // Below the control, unless it is close enough to the bottom that the label wouldn't fit
      const above = box.bottom + 48 > window.innerHeight;
      // Centred on the control. Whether that leaves it hanging off an edge can't be known yet — it
      // depends how wide the words turn out — so `keepInView` reads the label back and nudges it.
      setAt({ x: box.left + box.width / 2, y: above ? box.top - 8 : box.bottom + 8, above });
    }, DELAY);
  };

  const close = () => {
    window.clearTimeout(timer.current);
    setAt(null);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Anything that moves the control moves the label away from it, so it goes rather than lies
  useEffect(() => {
    if (!at) return;
    const away = () => setAt(null);
    window.addEventListener("scroll", away, { passive: true, capture: true });
    window.addEventListener("resize", away);
    return () => {
      window.removeEventListener("scroll", away, { capture: true });
      window.removeEventListener("resize", away);
    };
  }, [at]);

  return (
    <span
      ref={anchor}
      className={`${contents ? "contents" : "inline-flex"} ${className}`}
      onPointerEnter={(e) => e.pointerType !== "touch" && open()}
      onPointerLeave={close}
      onPointerDown={close}
      onFocus={open}
      onBlur={close}
    >
      {children}
      {at &&
        createPortal(
          <span
            role="tooltip"
            ref={keepInView}
            // The control it belongs to already says this through its own label, so it isn't read twice
            aria-hidden
            style={{ left: at.x, top: at.y, maxWidth: `min(${MAX_WIDTH}px, calc(100vw - 1rem))`, transform: `translate(-50%, ${at.above ? "-100%" : "0"})` }}
            // w-max: a fixed element sized by what is to the right of `left` would wrap at the edge of
            // the screen; this makes it as wide as its text, then the max-width above wraps it
            className="hint-pop pointer-events-none fixed z-50 w-max rounded-lg border border-border bg-card px-2.5 py-1.5 text-center text-2xs text-foreground shadow-xl"
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}
