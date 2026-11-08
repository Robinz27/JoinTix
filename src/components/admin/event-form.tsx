"use client";

import { startTransition, useActionState, useId, useState } from "react";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Calendar03Icon,
  Coins01Icon,
  Invoice03Icon,
  Delete02Icon,
  Image01Icon,
  InformationCircleIcon,
  Loading03Icon,
  PlusSignIcon,
  Settings02Icon,
  Ticket02Icon,
  Location01Icon,
} from "@hugeicons/core-free-icons";
import { saveEvent } from "@/app/actions/admin-events";
import { PUBLISH } from "@/components/admin/event-status";
import { DateTimeField } from "@/components/admin/date-time-field";
import { MapPinField } from "@/components/admin/map-pin-field";
import { GalleryField, savedItem, type GalleryItem } from "@/components/admin/gallery-field";
import { PosterField, type PickedPoster } from "@/components/admin/poster-field";
import { Choices, Notice, hint, label } from "@/components/admin/form";
import { card, iconButton, input, pill, pillPrimary, tile } from "@/components/admin/ui";
import { Icon, type IconSvgElement } from "@/components/icon";
import { Hint } from "@/components/ui/hint";
import { Switch } from "@/components/ui/switch";
import { PUBLISH_STATES, SLUG_PATTERN, type PublishState } from "@/lib/event-fields";

// สร้าง / แก้ไขอีเวนต์ (app/admin/events/new, app/admin/events/[id]): every field of an event and its ticket
// zones in one form, saved together by saveEvent. The form is submitted by hand (onSubmit) rather than
// through `action`, so a failed save keeps what was typed instead of React resetting the fields.
// An existing event's tabs each show part of it (`part`); the rest stays in the form, hidden, so saving from
// either tab still sends the whole event.

export type EventFormZone = { id?: string; name: string; note: string; price: number; capacity: number; sold: number; tokens: number };

export type EventFormValues = {
  id?: string;
  slug: string;
  title: string;
  organizer: string;
  venue: string;
  venueArea: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  poster: string;
  gallery: string[];
  startsAt: string;
  doorsAt: string;
  salesStartAt: string;
  salesEndAt: string | null;
  status: PublishState;
  featured: boolean;
  maxPerOrder: number;
  tokenPrice: number;
  promptpayId: string;
  promptpayName: string;
  slipCheck: "api" | "manual";
  allowReentry: boolean;
  zones: EventFormZone[];
};

type ZoneRow = EventFormZone & { key: string };

const baht = new Intl.NumberFormat("th-TH");
// Keys for zones not saved yet. The first ones go by position, so the server's HTML and the browser agree
// (a module-wide counter would have counted on in each and broken hydration); ones added later count from here
let addedKey = 0;
const withKey = (zone: EventFormZone, i: number): ZoneRow => ({ ...zone, key: zone.id ?? `start-${i}` });

/** An ISO time as a datetime-local value in Thai time ("2026-12-14T19:00") */
function toInput(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" }).replace(" ", "T").slice(0, 16);
}

/** midnight-echo-2026 from "Midnight Echo 2026"; Thai letters drop out, so a Thai title needs one typed */
function slugify(title: string) {
  return title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function Section({ icon, title, subtitle, off, children }: { icon: IconSvgElement; title: string; subtitle?: string; /** On another tab: kept in the form, not shown */ off?: boolean; children: React.ReactNode }) {
  return (
    <section className={`${card} min-w-0 ${off ? "hidden" : ""}`}>
      <header className="flex items-center gap-2.5 border-b border-border px-4 py-3.5 sm:px-5">
        <span className={`${tile} size-9`}>
          <Icon icon={icon} className="size-4.5" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </header>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Field({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={label}>
        {title}
      </label>
      {children}
      {note && <p className={hint}>{note}</p>}
    </div>
  );
}

export function EventForm({ event, posters, part }: { event?: EventFormValues; posters: string[]; /** Which tab this is; a new event shows everything */ part?: "details" | "tickets" }) {
  const [state, action, pending] = useActionState(saveEvent, {});
  const notDetails = part === "tickets";
  const notTickets = part === "details";
  const ids = useId();
  const [slug, setSlug] = useState(event?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(event));
  const [venue, setVenue] = useState(event?.venue ?? "");
  const [poster, setPoster] = useState(event?.poster ?? "");
  const [picked, setPicked] = useState<PickedPoster | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>(() => (event?.gallery ?? []).map(savedItem));
  // A new file replaces the one before it; its preview URL goes with it
  const pick = (file: File | null) =>
    setPicked((before) => {
      if (before) URL.revokeObjectURL(before.url);
      return file ? { file, url: URL.createObjectURL(file) } : null;
    });
  const [zones, setZones] = useState<ZoneRow[]>(() =>
    (event?.zones.length ? event.zones : [{ name: "บัตรทั่วไป", note: "", price: 0, capacity: 100, sold: 0, tokens: 0 }]).map(withKey),
  );

  // Zones added by the last save now exist; take their ids (once per answer) so the next save edits rather
  // than re-adds them. Done while rendering, React's way of adjusting state to a new prop or result
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    const saved = state.zoneIds;
    if (saved) setZones((rows) => rows.map((row, i) => (saved[i] ? { ...row, id: saved[i] } : row)));
    // The uploaded file is the saved poster now: keep its path, stop sending the file
    if (state.poster) {
      setPoster(state.poster);
      pick(null);
    }
    // …and the gallery's new files are saved pictures now
    const paths = state.gallery;
    if (paths) {
      setGallery((items) => {
        for (const item of items) if (item.file) URL.revokeObjectURL(item.url);
        return paths.map(savedItem);
      });
    }
  }

  const capacity = zones.reduce((n, zone) => n + (zone.capacity || 0), 0);
  const potential = zones.reduce((n, zone) => n + (zone.capacity || 0) * (zone.price || 0), 0);

  const update = (key: string, patch: Partial<EventFormZone>) => setZones((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const move = (index: number, by: number) =>
    setZones((rows) => {
      const next = [...rows];
      const [row] = next.splice(index, 1);
      next.splice(index + by, 0, row);
      return next;
    });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set("zones", JSON.stringify(zones.map(({ id, name, note, price, capacity, tokens }) => ({ id, name, note, price, capacity, tokens }))));
    if (picked) form.set("posterFile", picked.file);
    // Saved pictures go by path; new ones as files, each pointed at by its place among them
    let n = 0;
    const order = gallery.map((item) => (item.file ? { file: n++ } : item.path));
    form.set("gallery", JSON.stringify(order));
    for (const item of gallery) if (item.file) form.append("galleryFile", item.file);
    startTransition(() => action(form));
  }

  return (
    <form onSubmit={submit}>
      {event?.id && <input type="hidden" name="eventId" value={event.id} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <Section off={notDetails} icon={InformationCircleIcon} title="ข้อมูลงาน" subtitle="สิ่งที่คนเห็นในหน้าขายบัตร">
            <Field id={`${ids}-title`} title="ชื่ออีเวนต์">
              <input
                id={`${ids}-title`}
                name="title"
                required
                maxLength={120}
                defaultValue={event?.title}
                placeholder="Midnight Echo Live 2026"
                onChange={(e) => !slugTouched && setSlug(slugify(e.target.value))}
                className={input}
              />
            </Field>
            <Field id={`${ids}-slug`} title="ลิงก์ (slug)" note={`หน้าขาย: /events/${slug || "…"}  ·  ใช้ a–z, 0–9 และขีด -`}>
              <div className="flex items-center rounded-xl border border-border bg-input focus-within:border-muted-foreground">
                <span className="shrink-0 pl-3.5 text-sm text-muted-foreground max-[379px]:hidden">/events/</span>
                <input
                  id={`${ids}-slug`}
                  name="slug"
                  required
                  maxLength={80}
                  pattern={SLUG_PATTERN}
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value.toLowerCase());
                  }}
                  placeholder="midnight-echo-2026"
                  className="h-10 min-w-0 flex-1 bg-transparent px-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground min-[380px]:pl-0.5"
                />
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`${ids}-organizer`} title="ผู้จัด">
                <input id={`${ids}-organizer`} name="organizer" required maxLength={120} defaultValue={event?.organizer} className={input} />
              </Field>
              <Field id={`${ids}-venue`} title="สถานที่">
                <input id={`${ids}-venue`} name="venue" required maxLength={200} value={venue} onChange={(e) => setVenue(e.target.value)} className={input} />
              </Field>
            </div>
            <Field id={`${ids}-description`} title="รายละเอียดงาน" note="เว้นบรรทัดว่างเพื่อขึ้นย่อหน้าใหม่">
              <textarea
                id={`${ids}-description`}
                name="description"
                rows={6}
                maxLength={5000}
                defaultValue={event?.description}
                className={`${input} h-auto resize-y py-2.5 leading-relaxed`}
              />
            </Field>
          </Section>

          <Section off={notDetails} icon={Location01Icon} title="แผนที่" subtitle="หมุดสถานที่จัดงาน แสดงในหน้าอีเวนต์">
            <MapPinField
              id={`${ids}-map`}
              venue={venue}
              defaultArea={event?.venueArea ?? ""}
              defaultPin={event?.latitude != null && event.longitude != null ? { lat: event.latitude, lng: event.longitude } : null}
            />
          </Section>

          <Section off={notDetails} icon={Calendar03Icon} title="วันและเวลา" subtitle="เวลาประเทศไทย (GMT+7)">
            <div className="grid gap-4 sm:grid-cols-2">
              <DateTimeField id={`${ids}-starts`} name="startsAt" label="เริ่มงาน" defaultValue={toInput(event?.startsAt ?? null)} />
              <DateTimeField id={`${ids}-doors`} name="doorsAt" label="ประตูเปิด" defaultValue={toInput(event?.doorsAt ?? null)} />
              <DateTimeField
                id={`${ids}-sales-start`}
                name="salesStartAt"
                label="เปิดขายบัตร"
                note="ก่อนเวลานี้หน้าเว็บขึ้นว่ารอเปิดขาย"
                defaultValue={toInput(event?.salesStartAt ?? null)}
              />
              <DateTimeField
                id={`${ids}-sales-end`}
                name="salesEndAt"
                label="ปิดขายบัตร"
                optional="ขายจนถึงเวลาเริ่มงาน"
                defaultValue={toInput(event?.salesEndAt ?? null)}
              />
            </div>
          </Section>

          <Section off={notTickets} icon={Ticket02Icon} title="โซนบัตร" subtitle={`${zones.length} โซน · ${baht.format(capacity)} ใบ · ขายหมดได้ ฿${baht.format(potential)}`}>
            <ol className="space-y-3">
              {zones.map((zone, i) => (
                <li key={zone.key} className="rounded-xl border border-border bg-background/40 p-3 sm:p-3.5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-2xs font-semibold text-muted-foreground tabular-nums">
                      {i + 1}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{zone.name || "โซนใหม่"}</p>
                    {zone.sold > 0 && <span className="shrink-0 text-2xs text-muted-foreground tabular-nums">ขายแล้ว {baht.format(zone.sold)}</span>}
                    <Hint label="เลื่อนขึ้น">
                      <button type="button" aria-label="เลื่อนขึ้น" disabled={i === 0} onClick={() => move(i, -1)} className={iconButton}>
                        <Icon icon={ArrowUp01Icon} className="size-4" />
                      </button>
                    </Hint>
                    <Hint label="เลื่อนลง">
                      <button type="button" aria-label="เลื่อนลง" disabled={i === zones.length - 1} onClick={() => move(i, 1)} className={iconButton}>
                        <Icon icon={ArrowDown01Icon} className="size-4" />
                      </button>
                    </Hint>
                    <Hint label={zone.sold > 0 ? "ขายไปแล้ว ลบไม่ได้" : "ลบโซน"}>
                      <button
                        type="button"
                        aria-label="ลบโซน"
                        disabled={zones.length === 1 || zone.sold > 0}
                        onClick={() => setZones((rows) => rows.filter((row) => row.key !== zone.key))}
                        className={`${iconButton} hover:border-red-500/40 hover:text-red-500`}
                      >
                        <Icon icon={Delete02Icon} className="size-4" />
                      </button>
                    </Hint>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field id={`${ids}-zone-${zone.key}-name`} title="ชื่อโซน">
                      <input
                        id={`${ids}-zone-${zone.key}-name`}
                        required
                        maxLength={60}
                        value={zone.name}
                        onChange={(e) => update(zone.key, { name: e.target.value })}
                        placeholder="VIP, โซน A, Early Bird"
                        className={input}
                      />
                    </Field>
                    <Field id={`${ids}-zone-${zone.key}-note`} title="รายละเอียด (ไม่บังคับ)">
                      <input
                        id={`${ids}-zone-${zone.key}-note`}
                        maxLength={120}
                        value={zone.note}
                        onChange={(e) => update(zone.key, { note: e.target.value })}
                        placeholder="ที่นั่งมีหมายเลข"
                        className={input}
                      />
                    </Field>
                    <Field id={`${ids}-zone-${zone.key}-price`} title="ราคา (บาท) · 0 = ฟรี">
                      <input
                        id={`${ids}-zone-${zone.key}-price`}
                        type="number"
                        inputMode="numeric"
                        required
                        min={0}
                        max={1_000_000}
                        step={1}
                        value={Number.isNaN(zone.price) ? "" : zone.price}
                        onChange={(e) => update(zone.key, { price: e.target.valueAsNumber })}
                        className={`${input} tabular-nums`}
                      />
                    </Field>
                    <Field id={`${ids}-zone-${zone.key}-capacity`} title={zone.sold > 0 ? `จำนวนบัตร (ขั้นต่ำ ${baht.format(zone.sold)})` : "จำนวนบัตร"}>
                      <input
                        id={`${ids}-zone-${zone.key}-capacity`}
                        type="number"
                        inputMode="numeric"
                        required
                        min={Math.max(1, zone.sold)}
                        max={1_000_000}
                        step={1}
                        value={Number.isNaN(zone.capacity) ? "" : zone.capacity}
                        onChange={(e) => update(zone.key, { capacity: e.target.valueAsNumber })}
                        className={`${input} tabular-nums`}
                      />
                    </Field>
                    <Field
                      id={`${ids}-zone-${zone.key}-tokens`}
                      title="โทเคนต่อใบ (แลกสินค้าในงาน)"
                      note={zone.tokens > 0 && zone.price > 0 ? `≈ 1 โทเคนต่อ ฿${baht.format(Math.round((zone.price / zone.tokens) * 100) / 100)}` : "0 = ไม่แถมโทเคน"}
                    >
                      <input
                        id={`${ids}-zone-${zone.key}-tokens`}
                        type="number"
                        inputMode="numeric"
                        required
                        min={0}
                        max={1_000_000}
                        step={1}
                        value={Number.isNaN(zone.tokens) ? "" : zone.tokens}
                        onChange={(e) => update(zone.key, { tokens: e.target.valueAsNumber })}
                        className={`${input} tabular-nums`}
                      />
                    </Field>
                  </div>
                  {zone.sold > 0 && zone.capacity > 0 && (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-foreground/70" style={{ width: `${Math.min(100, (zone.sold / zone.capacity) * 100)}%` }} />
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <button
              type="button"
              disabled={zones.length >= 20}
              onClick={() => setZones((rows) => [...rows, { name: "", note: "", price: 0, capacity: 100, sold: 0, tokens: 0, key: `added-${addedKey++}` }])}
              className={`${pill} w-full justify-center border-dashed`}
            >
              <Icon icon={PlusSignIcon} className="size-4" />
              เพิ่มโซนบัตร
            </button>
          </Section>
        </div>

        <div className="min-w-0 space-y-4 lg:sticky lg:top-5 lg:self-start">
          <Section off={notDetails} icon={Settings02Icon} title="การเผยแพร่">
            <fieldset>
              <legend className={label}>สถานะ</legend>
              <Choices name="status" value={event?.status ?? "draft"} options={PUBLISH_STATES.map((value) => ({ value, label: PUBLISH[value].label }))} />
              <ul className="mt-2 space-y-0.5">
                {PUBLISH_STATES.map((value) => (
                  <li key={value} className="text-2xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">{PUBLISH[value].label}</span> — {PUBLISH[value].note}
                  </li>
                ))}
              </ul>
            </fieldset>
            <Switch boxed name="featured" value="1" defaultChecked={event?.featured} label="อีเวนต์แนะนำ" hint="แสดงในส่วน “อีเวนต์แนะนำ” หน้าแรก" className="text-sm text-foreground" />
          </Section>

          <Section off={notTickets} icon={Coins01Icon} title="การขาย">
            <Field id={`${ids}-max`} title="จำกัดต่อบัญชี (ใบ)" note="กันคนกวาดบัตรไปขายต่อ">
              <input
                id={`${ids}-max`}
                name="maxPerOrder"
                type="number"
                inputMode="numeric"
                required
                min={1}
                max={20}
                defaultValue={event?.maxPerOrder ?? 10}
                className={`${input} tabular-nums`}
              />
            </Field>
            <Field id={`${ids}-token-price`} title="ราคาโทเคน (บาท ต่อ 1 โทเคน)" note="ใช้ตอนเติมโทเคนหน้างาน และคิดยอดที่ต้องจ่ายให้ร้านค้า">
              <input
                id={`${ids}-token-price`}
                name="tokenPrice"
                type="number"
                inputMode="numeric"
                required
                min={1}
                max={100000}
                defaultValue={event?.tokenPrice ?? 25}
                className={`${input} tabular-nums`}
              />
            </Field>
          </Section>

          <Section off={notTickets} icon={Invoice03Icon} title="รับชำระเงิน" subtitle="ลูกค้าสแกน QR พร้อมเพย์แล้วแนบสลิป">
            <Field id={`${ids}-promptpay`} title="พร้อมเพย์ที่รับเงิน" note="เบอร์มือถือ เลขบัตรประชาชน หรือเลข e-Wallet ของเจ้าของงาน ยังไม่ใส่ = ลูกค้ายังจ่ายเงินไม่ได้">
              <input id={`${ids}-promptpay`} name="promptpayId" inputMode="numeric" maxLength={20} defaultValue={event?.promptpayId ?? ""} placeholder="0812345678" className={`${input} tabular-nums`} />
            </Field>
            <Field id={`${ids}-promptpay-name`} title="ชื่อบัญชี" note="แสดงใต้ QR ให้ลูกค้ามั่นใจว่าโอนถูกคน">
              <input id={`${ids}-promptpay-name`} name="promptpayName" maxLength={120} defaultValue={event?.promptpayName ?? ""} placeholder="นายสมชาย ใจดี" className={input} />
            </Field>
            <fieldset>
              <legend className={label}>ตรวจสลิป</legend>
              <Choices
                name="slipCheck"
                value={event?.slipCheck ?? "api"}
                options={[
                  { value: "api", label: "อัตโนมัติ (Slip2Go)" },
                  { value: "manual", label: "ทีมงานตรวจเอง" },
                ]}
              />
              <p className={hint}>อัตโนมัติ: ระบบถามธนาคารผ่าน Slip2Go ผ่านแล้วออกบัตรทันที ถ้าตรวจไม่ได้จะส่งไปหน้า “ตรวจสลิป” ให้ทีมงาน · ทีมงานตรวจเอง: ทุกสลิปรอทีมงานกดอนุมัติ</p>
            </fieldset>
            <Switch boxed name="allowReentry" value="1" defaultChecked={event?.allowReentry} label="ให้กลับเข้างานซ้ำได้" hint="บัตรที่สแกนเข้างานแล้วสแกนเข้าได้อีก (ออกไปแล้วกลับเข้ามา) ปิดไว้ = สแกนซ้ำจะขึ้นเตือนว่าใช้แล้ว" className="text-sm text-foreground" />
          </Section>

          <Section off={notDetails} icon={Image01Icon} title="โปสเตอร์" subtitle="แนวตั้ง 4:5 เช่น 800×1000">
            <input type="hidden" name="poster" value={poster} />
            <PosterField id={`${ids}-poster`} poster={poster} onPoster={setPoster} picked={picked} onPick={pick} posters={posters} />
          </Section>

          <Section off={notDetails} icon={Image01Icon} title="รูปเพิ่มเติม" subtitle="ผังที่นั่ง เวที สถานที่ ฯลฯ (ไม่บังคับ)">
            <GalleryField items={gallery} onChange={setGallery} />
          </Section>
        </div>
      </div>

      {/* Stays at the bottom of the screen, so saving never means scrolling back */}
      <div className="sticky bottom-3 z-10 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/90 px-4 py-3 shadow-lg backdrop-blur sm:px-5">
        {state.error || state.ok ? (
          <div className="min-w-0 flex-1 [&>p]:mb-0 [&>p]:py-2 [&>p]:text-xs">
            <Notice state={state} />
          </div>
        ) : (
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            {event?.id ? "แก้แล้วกดบันทึก หน้าเว็บอัปเดตทันที" : "สร้างเป็นฉบับร่างก่อนก็ได้ แล้วค่อยเผยแพร่"}
          </p>
        )}
        <button type="submit" disabled={pending} className={pillPrimary}>
          {pending && <Icon icon={Loading03Icon} className="size-4 animate-spin" />}
          {event?.id ? "บันทึก" : "สร้างอีเวนต์"}
        </button>
      </div>
    </form>
  );
}
