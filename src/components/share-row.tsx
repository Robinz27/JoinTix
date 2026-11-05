"use client";

import { useState, useSyncExternalStore } from "react";
import {
  DiscordIcon,
  Facebook01Icon,
  LineIcon,
  Link01Icon,
  MessengerIcon,
  MoreHorizontalIcon,
  NewTwitterIcon,
  Tick02Icon,
  TelegramIcon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons";
import { Icon, type IconSvgElement } from "@/components/icon";
import { Hint } from "@/components/ui/hint";

// แชร์อีเวนต์นี้: a row of app icons under the ticket picker, as next.js-shop puts one under its buy
// buttons (components/product/share-row.tsx there). The apps with a share address of their own open it in
// a new tab; Discord has none, so it copies the link; "อื่น ๆ" hands the link to the phone's own share
// sheet (Instagram, TikTok…). The address is read at the click, never rendered, so the server and the
// browser draw the same row. Brand colours are --share-* in globals.css.

type App = {
  id: string;
  label: string;
  icon: IconSvgElement;
  /** Phones with a share sheet see the first few; the rest are a tap away under "อื่น ๆ" */
  wide?: boolean;
  open: (url: string, text: string) => string | null;
};

const enc = encodeURIComponent;
const coarse = () => window.matchMedia("(pointer: coarse)").matches;

const APPS: App[] = [
  { id: "line", label: "LINE", icon: LineIcon, open: (u) => `https://social-plugins.line.me/lineit/share?url=${enc(u)}` },
  { id: "facebook", label: "Facebook", icon: Facebook01Icon, open: (u) => `https://www.facebook.com/sharer/sharer.php?u=${enc(u)}` },
  // Messenger's share address works in its phone app only; on a computer the link is copied instead
  { id: "messenger", label: "Messenger", icon: MessengerIcon, open: (u) => (coarse() ? `fb-messenger://share/?link=${enc(u)}` : null) },
  { id: "discord", label: "Discord", icon: DiscordIcon, open: () => null },
  { id: "x", label: "X", icon: NewTwitterIcon, wide: true, open: (u, t) => `https://x.com/intent/post?text=${enc(t)}&url=${enc(u)}` },
  { id: "telegram", label: "Telegram", icon: TelegramIcon, wide: true, open: (u, t) => `https://t.me/share/url?url=${enc(u)}&text=${enc(t)}` },
  { id: "whatsapp", label: "WhatsApp", icon: WhatsappIcon, wide: true, open: (u, t) => `https://wa.me/?text=${enc(`${t} ${u}`)}` },
];

// The phone's share sheet exists only in the browser, and not in every one: false while on the server
const noSubscribe = () => () => {};
const useCanShare = () =>
  useSyncExternalStore(
    noSubscribe,
    () => "share" in navigator,
    () => false,
  );

/** This page without its query string or #hash */
const pageUrl = () => `${location.origin}${location.pathname}`;

/** The old way, for browsers that refuse the clipboard API (LINE's and Facebook's in-app ones among them) */
function copyByHand(text: string) {
  const box = document.createElement("textarea");
  box.value = text;
  box.setAttribute("readonly", "");
  box.style.cssText = "position:absolute;left:-9999px;top:0";
  document.body.append(box);
  box.select();
  const done = document.execCommand("copy");
  box.remove();
  return done;
}

const circle =
  "flex size-9 items-center justify-center rounded-full text-white transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

export function ShareRow({ title, when }: { title: string; /** e.g. "14 ธ.ค. 2569 · อิมแพ็ค อารีน่า" */ when: string }) {
  const canShare = useCanShare();
  const [said, setSaid] = useState<{ ok: boolean; text: string }>();
  const text = `${title} — ${when}`;

  async function copy(url: string, app?: string) {
    const done = (await navigator.clipboard?.writeText(url).then(
      () => true,
      () => copyByHand(url),
    )) ?? copyByHand(url);
    setSaid(
      done
        ? { ok: true, text: app ? `คัดลอกลิงก์แล้ว วางในแชท ${app} ได้เลย` : "คัดลอกลิงก์แล้ว" }
        : { ok: false, text: "คัดลอกไม่สำเร็จ ลองคัดลอกจากแถบที่อยู่ของเบราว์เซอร์แทน" },
    );
  }

  const go = (app: App) => {
    const url = pageUrl();
    const target = app.open(url, text);
    if (!target) return void copy(url, app.label);
    setSaid(undefined);
    if (target.startsWith("https:")) window.open(target, "_blank", "noopener,noreferrer");
    else location.assign(target);
  };

  const shareSheet = async () => {
    try {
      await navigator.share({ title, text, url: pageUrl() });
    } catch {
      // closed the share sheet without choosing: nothing to say
    }
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="mb-2.5 text-xs text-muted-foreground">แชร์อีเวนต์นี้</p>
      <ul className="flex flex-wrap items-center gap-2">
        {APPS.map((app) => (
          <li key={app.id} className={app.wide && canShare ? "hidden sm:block" : undefined}>
            <Hint label={app.label}>
              <button
                type="button"
                onClick={() => go(app)}
                aria-label={`แชร์ไปที่ ${app.label}`}
                // X's black disappears into the dark theme without an edge
                className={`${circle} ${app.id === "x" ? "ring-1 ring-white/20" : ""}`}
                style={{ backgroundColor: `var(--share-${app.id})` }}
              >
                <Icon icon={app.icon} className="size-[18px]" />
              </button>
            </Hint>
          </li>
        ))}
        <li>
          <Hint label="คัดลอกลิงก์">
            <button type="button" onClick={() => copy(pageUrl())} aria-label="คัดลอกลิงก์" className={`${circle} border border-border bg-secondary text-foreground!`}>
              <Icon icon={said?.ok ? Tick02Icon : Link01Icon} className="size-[18px]" />
            </button>
          </Hint>
        </li>
        {canShare && (
          <li>
            <Hint label="แอปอื่น ๆ">
              <button type="button" onClick={shareSheet} aria-label="แชร์ไปแอปอื่น ๆ" className={`${circle} border border-border bg-secondary text-foreground!`}>
                <Icon icon={MoreHorizontalIcon} className="size-[18px]" />
              </button>
            </Hint>
          </li>
        )}
      </ul>
      {said && (
        <p role="status" className={`mt-2 text-2xs ${said.ok ? "text-muted-foreground" : "text-red-500"}`}>
          {said.text}
        </p>
      )}
    </div>
  );
}
