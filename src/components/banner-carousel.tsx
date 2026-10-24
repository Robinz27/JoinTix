"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/icon";
import { FadeImage } from "@/components/ui/fade-image";
import type { Banner } from "@/lib/banners";

// Advance every 5s; pauses while the pointer is over it and restarts the countdown after the visitor moves it
const AUTOPLAY_DELAY = 5000;

/** Event banners in a rounded carousel with arrows and position dots. */
export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const multiple = banners.length > 1;
  // Created once: Embla re-initialises whenever it receives a new plugin instance
  const [plugins] = useState(() =>
    multiple ? [Autoplay({ delay: AUTOPLAY_DELAY, stopOnInteraction: false, stopOnMouseEnter: true })] : [],
  );
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: multiple, watchDrag: multiple }, plugins);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect).on("reInit", onSelect);
    // Moving slides on their own is exactly what reduced-motion users opt out of
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) emblaApi.plugins().autoplay?.stop();
    return () => {
      emblaApi.off("select", onSelect).off("reInit", onSelect);
    };
  }, [emblaApi]);

  const go = useCallback(
    (to: "prev" | "next" | number) => {
      if (!emblaApi) return;
      if (to === "prev") emblaApi.scrollPrev();
      else if (to === "next") emblaApi.scrollNext();
      else emblaApi.scrollTo(to);
      emblaApi.plugins().autoplay?.reset();
    },
    [emblaApi],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go("prev");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go("next");
    }
  };

  if (banners.length === 0) return null;

  return (
    <section className="px-3 pb-6 sm:pb-8">
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="อีเวนต์แนะนำ"
        tabIndex={multiple ? 0 : undefined}
        onKeyDown={multiple ? onKeyDown : undefined}
        className="group relative mx-auto max-w-5xl rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div
          ref={emblaRef}
          className="overflow-hidden rounded-2xl shadow-2xl ring-1 shadow-black/20 ring-black/5 sm:rounded-3xl dark:shadow-black/50 dark:ring-white/10"
        >
          <div className="flex touch-pan-y">
            {banners.map((banner, i) => (
              <div
                key={banner.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} จาก ${banners.length}`}
                className="min-w-0 shrink-0 grow-0 basis-full"
              >
                <Link href={banner.href} className="relative block aspect-[5/2] w-full bg-card" draggable={false}>
                  <FadeImage
                    src={banner.src}
                    alt={banner.title}
                    fill
                    sizes="(min-width: 1048px) 1024px, calc(100vw - 24px)"
                    preload={i === 0}
                    draggable={false}
                    className="object-cover select-none"
                  />
                </Link>
              </div>
            ))}
          </div>
        </div>

        {multiple && (
          <>
            <ArrowButton side="prev" onClick={() => go("prev")} />
            <ArrowButton side="next" onClick={() => go("next")} />
          </>
        )}

        <p className="sr-only" aria-live="polite">
          อีเวนต์ {selected + 1} จาก {banners.length}
        </p>
      </div>

      {multiple && (
        <div className="mt-4 flex justify-center gap-1.5">
          {banners.map((banner, i) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`ไปที่อีเวนต์ ${i + 1}`}
              aria-current={i === selected}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === selected ? "w-6 bg-foreground" : "w-2 bg-foreground/25 hover:bg-foreground/50"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ArrowButton({ side, onClick }: { side: "prev" | "next"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "prev" ? "อีเวนต์ก่อนหน้า" : "อีเวนต์ถัดไป"}
      // Overlaid on the banner's edges; on a phone the banner is swiped instead
      className={`absolute top-1/2 hidden size-9 -translate-y-1/2 touch-manipulation place-items-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur-md transition hover:bg-black/50 active:translate-y-[calc(-50%+1px)] sm:grid ${
        side === "prev" ? "left-3 sm:left-4" : "right-3 sm:right-4"
      }`}
    >
      <Icon icon={side === "prev" ? ArrowLeft01Icon : ArrowRight01Icon} />
    </button>
  );
}
