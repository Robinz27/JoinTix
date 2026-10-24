"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";

/**
 * next/image that fades in once it has loaded, over a skeleton shimmer behind it. The parent must be
 * positioned and sized (a `fill` image); the skeleton fills it until the picture arrives.
 */
export function FadeImage({ alt, className = "", onLoad, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <span aria-hidden="true" className="skeleton absolute inset-0" />}
      <Image
        {...props}
        alt={alt}
        // A cached picture can finish before React attaches onLoad, so check `complete` as it mounts too
        ref={(img) => {
          if (img?.complete && img.naturalWidth > 0) setLoaded(true);
        }}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        className={`fade-image ${loaded ? "is-loaded" : ""} ${className}`}
      />
    </>
  );
}
