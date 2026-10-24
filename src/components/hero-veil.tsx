"use client";

import dynamic from "next/dynamic";

// ogl + the shader load after the page is interactive, so they never delay the hero text.
const DarkVeil = dynamic(() => import("@/components/dark-veil"), { ssr: false });

/** Animated silver veil behind the home hero, matching the site's monochrome look. */
export function HeroVeil() {
  return (
    // Fades out towards the bottom and edges so the hero blends into the page
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full [mask-image:radial-gradient(120%_90%_at_50%_0%,#000_35%,transparent_85%)]"
    >
      <DarkVeil />
    </div>
  );
}
