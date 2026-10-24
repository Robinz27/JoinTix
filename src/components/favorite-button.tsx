"use client";

import { useSyncExternalStore } from "react";
import { FavouriteIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/icon";

// Saved in this browser only until there are accounts to keep them on
const KEY = "jointix:favorites";
const EVENT = "jointix:favorites";

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Heart on an event poster: saves the event to this browser's favourites */
export function FavoriteButton({ eventId, title }: { eventId: string; title: string }) {
  const saved = useSyncExternalStore(
    subscribe,
    () => read().includes(eventId),
    () => false,
  );

  const toggle = () => {
    const ids = read().filter((id) => id !== eventId);
    if (!saved) ids.push(eventId);
    try {
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      return;
    }
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? `เอา ${title} ออกจากรายการโปรด` : `เพิ่ม ${title} ในรายการโปรด`}
      className={`grid size-9 place-items-center rounded-full border border-white/20 bg-black/30 backdrop-blur-md transition hover:bg-black/50 active:scale-90 ${
        saved ? "text-rose-400 [&_path]:fill-current" : "text-white"
      }`}
    >
      <Icon icon={FavouriteIcon} className="size-[18px]" />
    </button>
  );
}
