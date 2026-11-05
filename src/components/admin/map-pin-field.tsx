"use client";

import { useState, useTransition } from "react";
import { Cancel01Icon, Location01Icon, Loading03Icon, MapsSearchIcon, Navigation03Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { resolveMapLink } from "@/app/actions/admin-events";
import { hint, label } from "@/components/admin/form";
import { input, pill } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { embedLink, isShortMapLink, mapsLink, parsePin, searchLink, type Pin } from "@/lib/map";

// หมุดแผนที่ of an event's venue: paste a Google Maps link (a short share link too) or "lat, lng", or use
// where this device is, and the pin shows on a small map at once. Saved with the form as latitude /
// longitude (hidden inputs); no pin is fine, the event page then shows the venue without a map.

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export function MapPinField({ id, venue, defaultPin, defaultArea }: { id: string; venue: string; defaultPin: Pin | null; defaultArea: string }) {
  const [pin, setPin] = useState<Pin | null>(defaultPin);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string>();
  const [pending, start] = useTransition();

  function read(value: string) {
    setText(value);
    setProblem(undefined);
    const found = parsePin(value);
    if (found) {
      setPin({ lat: round(found.lat), lng: round(found.lng) });
      setText("");
      return;
    }
    if (isShortMapLink(value)) {
      // A short share link carries no numbers until it is followed
      start(async () => {
        const resolved = await resolveMapLink(value).catch(() => null);
        if (resolved) {
          setPin({ lat: round(resolved.lat), lng: round(resolved.lng) });
          setText("");
        } else setProblem("อ่านพิกัดจากลิงก์นี้ไม่ได้ ลองเปิดลิงก์แล้วคัดลอกจากแถบที่อยู่แทน");
      });
    } else if (value.trim().length > 6) setProblem("ยังหาพิกัดในข้อความนี้ไม่เจอ วางลิงก์ Google Maps หรือพิกัด เช่น 13.9122, 100.5488");
  }

  function here() {
    setProblem(undefined);
    if (!("geolocation" in navigator)) return setProblem("เบราว์เซอร์นี้หาตำแหน่งไม่ได้");
    start(
      () =>
        new Promise<void>((done) =>
          navigator.geolocation.getCurrentPosition(
            (p) => {
              setPin({ lat: round(p.coords.latitude), lng: round(p.coords.longitude) });
              done();
            },
            () => {
              setProblem("ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง หรือหาตำแหน่งไม่เจอ");
              done();
            },
            { enableHighAccuracy: true, timeout: 10000 },
          ),
        ),
    );
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name="latitude" value={pin?.lat ?? ""} />
      <input type="hidden" name="longitude" value={pin?.lng ?? ""} />

      <div>
        <label htmlFor={`${id}-area`} className={label}>
          เขต / จังหวัด (ไม่บังคับ)
        </label>
        <input id={`${id}-area`} name="venueArea" maxLength={120} defaultValue={defaultArea} placeholder="ปากเกร็ด นนทบุรี" className={input} />
        <p className={hint}>แสดงใต้ชื่อสถานที่ในหน้าอีเวนต์</p>
      </div>

      <div>
        <label htmlFor={`${id}-paste`} className={label}>
          หมุดแผนที่
        </label>
        <div className="relative">
          <Icon icon={Location01Icon} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id={`${id}-paste`}
            value={text}
            onChange={(e) => read(e.target.value)}
            placeholder={pin ? "วางลิงก์ใหม่เพื่อย้ายหมุด" : "วางลิงก์ Google Maps หรือพิกัด"}
            autoComplete="off"
            spellCheck={false}
            className={`${input} pl-9 ${pending ? "pr-9" : ""}`}
          />
          {pending && <Icon icon={Loading03Icon} className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={searchLink(venue || "สถานที่จัดงาน")} target="_blank" rel="noreferrer" className={`${pill} h-8 px-3 text-xs`}>
            <Icon icon={MapsSearchIcon} className="size-3.5" />
            ค้นหาใน Google Maps
          </a>
          <button type="button" onClick={here} disabled={pending} className={`${pill} h-8 px-3 text-xs`}>
            <Icon icon={Navigation03Icon} className="size-3.5" />
            ใช้ตำแหน่งของฉัน
          </button>
        </div>
        <p className={hint}>เปิด Google Maps หาสถานที่ กด “แชร์” แล้วคัดลอกลิงก์มาวางที่นี่ หรือคลิกขวาบนแผนที่แล้วคัดลอกพิกัด</p>
        {problem && <p className="mt-1.5 text-2xs text-red-500">{problem}</p>}
      </div>

      {pin ? (
        <div className="overflow-hidden rounded-xl border border-border bg-secondary">
          <iframe
            key={`${pin.lat},${pin.lng}`}
            title="ตัวอย่างหมุดแผนที่"
            src={embedLink(pin)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="block aspect-[4/3] w-full border-0"
          />
          <div className="flex items-center gap-2 border-t border-border bg-card px-3 py-2">
            <Icon icon={Tick02Icon} className="size-4 shrink-0 text-emerald-500" />
            <a href={mapsLink(pin)} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-xs text-foreground tabular-nums hover:underline">
              {pin.lat}, {pin.lng}
            </a>
            <button
              type="button"
              onClick={() => setPin(null)}
              className="inline-flex shrink-0 items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-red-500"
            >
              <Icon icon={Cancel01Icon} className="size-3" />
              เอาหมุดออก
            </button>
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-3.5 py-3 text-center text-2xs text-muted-foreground">
          ยังไม่มีหมุด หน้าอีเวนต์จะแสดงแค่ชื่อสถานที่
        </p>
      )}
    </div>
  );
}
