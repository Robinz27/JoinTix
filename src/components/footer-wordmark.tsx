"use client";

import { useRef } from "react";

/**
 * The site name, huge and faded, filling the footer's width whatever its length: the font size is the
 * container width divided by the number of characters (container query units).
 *
 * Hover: the letters light up around the mouse. A brighter copy of the text sits exactly on top, masked to a
 * soft circle that follows the pointer — so only the letters glow, never the background. The pointer
 * position goes straight into CSS variables (no React re-render), at most once per frame.
 * Styles: .footer-wordmark* in globals.css.
 */
export function FooterWordmark({ text }: { text: string }) {
  const frame = useRef(0);
  const length = Math.max(4, [...text].length);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = e.currentTarget;
    const { clientX, clientY } = e;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--x", `${clientX - r.left}px`);
      el.style.setProperty("--y", `${clientY - r.top}px`);
    });
  };

  return (
    <div aria-hidden="true" className="@container mx-auto max-w-5xl px-4 pb-10 select-none sm:px-6 sm:pb-14 xl:max-w-6xl">
      <div
        onPointerMove={onPointerMove}
        className="footer-wordmark-rise relative text-center leading-[0.85] font-black tracking-tight whitespace-nowrap"
        style={{ fontSize: `min(12rem, ${(160 / length).toFixed(2)}cqw)` }}
      >
        <p className="footer-wordmark">{text}</p>
        <p className="footer-wordmark-glow absolute inset-0">{text}</p>
      </div>
    </div>
  );
}
