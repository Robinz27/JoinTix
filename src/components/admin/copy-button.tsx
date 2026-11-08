"use client";

import { useState } from "react";
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/icon";
import { Hint } from "@/components/ui/hint";

/** A small "copy" next to an email or id; ticks for a moment once it's on the clipboard */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Hint label={done ? "คัดลอกแล้ว" : label}>
      <button
        type="button"
        aria-label={label}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          } catch {
            // No clipboard (an old browser, or not https): nothing to do
          }
        }}
        className="inline-grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Icon icon={done ? Tick02Icon : Copy01Icon} className="size-3.5" />
      </button>
    </Hint>
  );
}
