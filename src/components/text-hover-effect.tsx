"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Big outlined word that draws itself in once it scrolls into view, then lights up in a rainbow gradient
 * around the mouse — after Aceternity's "Text Hover Effect", done with plain SVG and CSS (no motion library).
 *
 * Three copies of the word sit on top of each other:
 *  1. a faint outline, shown while hovered so the whole word stays readable
 *  2. the outline that draws in (stroke-dashoffset, .text-draw in globals.css)
 *  3. the rainbow outline, masked to a soft circle that eases after the pointer
 */
export function TextHoverEffect({ text, className = "" }: { text: string; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const maskRef = useRef<SVGRadialGradientElement>(null);
  const [hovered, setHovered] = useState(false);
  const [drawn, setDrawn] = useState(false);
  // SVG ids must be unique on the page and safe inside url(#…)
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const target = useRef({ x: 50, y: 50 });
  const current = useRef({ x: 50, y: 50 });
  const frame = useRef(0);

  // Draw the outline once the word is on screen, not while it sits unseen at the bottom of the page
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDrawn(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // The mask's centre eases a fifth of the way to the pointer each frame, so the glow trails it smoothly
  const follow = () => {
    const c = current.current;
    const t = target.current;
    c.x += (t.x - c.x) * 0.2;
    c.y += (t.y - c.y) * 0.2;
    maskRef.current?.setAttribute("cx", `${c.x}%`);
    maskRef.current?.setAttribute("cy", `${c.y}%`);
    if (Math.abs(t.x - c.x) > 0.05 || Math.abs(t.y - c.y) > 0.05) frame.current = requestAnimationFrame(follow);
    else frame.current = 0;
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    target.current = { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
    if (!frame.current) frame.current = requestAnimationFrame(follow);
  };

  const textProps = {
    x: "50%",
    y: "50%",
    textAnchor: "middle",
    dominantBaseline: "middle",
    strokeWidth: 0.3,
    // Helvetica bold like the original: heavy, even strokes read best as an outline
    className: "fill-transparent font-[helvetica,arial,sans-serif] text-[72px] font-bold",
  } as const;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 300 100"
      aria-hidden="true"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerMove={onPointerMove}
      className={`w-full select-none ${className}`}
    >
      <defs>
        <linearGradient id={`${id}-rainbow`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="0">
          <stop offset="0%" stopColor="#eab308" />
          <stop offset="25%" stopColor="#ef4444" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="75%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <radialGradient ref={maskRef} id={`${id}-spot`} gradientUnits="userSpaceOnUse" r="20%" cx="50%" cy="50%">
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </radialGradient>
        <mask id={`${id}-mask`}>
          <rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}-spot)`} />
        </mask>
      </defs>

      <text {...textProps} className={`${textProps.className} stroke-neutral-300 transition-opacity duration-300 dark:stroke-neutral-700 ${hovered ? "opacity-70" : "opacity-0"}`}>
        {text}
      </text>
      <text {...textProps} className={`${textProps.className} text-draw stroke-neutral-300 dark:stroke-neutral-700 ${drawn ? "is-drawn" : ""}`}>
        {text}
      </text>
      <text
        {...textProps}
        stroke={`url(#${id}-rainbow)`}
        mask={`url(#${id}-mask)`}
        className={`${textProps.className} transition-opacity duration-300 ${hovered ? "opacity-100" : "opacity-0"}`}
      >
        {text}
      </text>
    </svg>
  );
}
