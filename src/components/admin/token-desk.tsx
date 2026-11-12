"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Camera01Icon, Coins01Icon, Image01Icon, Loading03Icon, PencilEdit02Icon, Undo02Icon } from "@hugeicons/core-free-icons";
import { adjustTicketTokens, findForTopUp, topUpFeed, topUpTokens, undoTopUpTokens } from "@/app/actions/shops";
import { CustomerCard } from "@/components/admin/customer-card";
import { Notice, label } from "@/components/admin/form";
import { QrReader } from "@/components/admin/qr-reader";
import { Badge, Empty, card, iconButton, input, pill, pillPrimary } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { Hint } from "@/components/ui/hint";
import { shrinkImage } from "@/lib/shrink-image";
import type { Customer, TopUpEntry } from "@/lib/shops";
import { slipUrl } from "@/lib/slip-url";
import { num } from "@/lib/format";

// เติมโทเคน: scan the customer's ticket (each ticket is its own wallet), check the transfer in the banking app (or take
// cash), type the baht received (what the client's staff read off the slip; the tokens are worked out from the event's
// token price), optionally photograph the slip for the end-of-event check, confirm. A mistake is undone
// while the customer still has those tokens; after that ปรับยอด (tokens.adjust) corrects it, below zero if need be.

const clock = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
/** Quick amounts at the desk, in baht */
const QUICK_BAHT = [100, 200, 500, 1000];

type Mode = "topup" | "adjust";

export function TokenDesk({ eventId, tokenPrice, canTopUp, canAdjust }: { eventId: string; tokenPrice: number; canTopUp: boolean; canAdjust: boolean }) {
  const [mode, setMode] = useState<Mode>(canTopUp ? "topup" : "adjust");
  const [scanned, setScanned] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [tokens, setTokens] = useState(10);
  /** Top-up: the baht received; the tokens follow from it */
  const [received, setReceived] = useState(QUICK_BAHT[1]);
  const [direction, setDirection] = useState<1 | -1>(-1);
  const [baht, setBaht] = useState(0);
  const [note, setNote] = useState("");
  const [slip, setSlip] = useState<File | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [feed, setFeed] = useState<TopUpEntry[]>([]);
  // One per customer on screen, so a double press tops up once
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [working, start] = useTransition();
  const photo = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    topUpFeed(eventId).then(setFeed).catch(() => {});
  }, [eventId]);
  useEffect(reload, [reload]);

  const next = () => {
    setScanned(null);
    setCustomer(null);
    setDone(null);
    setError(undefined);
    setTokens(10);
    setReceived(QUICK_BAHT[1]);
    setBaht(0);
    setNote("");
    setSlip(null);
    if (photo.current) photo.current.value = "";
    setKey(crypto.randomUUID());
  };

  const scan = useCallback(
    (value: string) => {
      setScanned(value);
      setDone(null);
      setError(undefined);
      start(async () => {
        const answer = await findForTopUp(value, eventId);
        if (answer.customer) setCustomer(answer.customer);
        else {
          setScanned(null);
          setError(answer.error);
        }
      });
    },
    [eventId],
  );

  function confirm() {
    if (!scanned) return;
    start(async () => {
      setError(undefined);
      const form = new FormData();
      form.set("scanned", scanned);
      form.set("eventId", eventId);
      form.set("key", key);
      form.set("note", note);
      form.set("tokens", String(mode === "adjust" ? tokens * direction : bought));
      if (mode === "adjust") form.set("baht", String(baht * direction));
      if (slip) form.set("slip", await shrinkImage(slip, 2400));
      const answer = await (mode === "adjust" ? adjustTicketTokens(form) : topUpTokens(form));
      if (answer.customer) {
        setCustomer(answer.customer);
        setDone(mode === "adjust" ? `ปรับยอด ${direction > 0 ? "+" : "−"}${num.format(amount)} โทเคนแล้ว` : `เติม ${num.format(amount)} โทเคนแล้ว (฿${num.format(amount * tokenPrice)})`);
        reload();
      } else setError(answer.error);
    });
  }

  function undo(id: string) {
    start(async () => {
      const answer = await undoTopUpTokens(id);
      setError(answer.error);
      reload();
    });
  }

  // A top-up is typed in baht: whole tokens only, and what's left over can't become one
  const bought = Number.isFinite(received) && received > 0 ? Math.floor(received / tokenPrice) : 0;
  const leftover = Number.isFinite(received) && received > 0 ? received - bought * tokenPrice : 0;
  const amount = mode === "adjust" ? tokens : bought;
  const valid = mode === "adjust" ? Number.isInteger(tokens) && tokens > 0 && note.trim().length > 0 : bought > 0;
  const after = customer ? customer.tokens + (mode === "adjust" ? tokens * direction : bought) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={`${card} overflow-hidden`}>
        <QrReader onScan={scan} paused={Boolean(scanned)} prompt="ส่อง QR บนบัตรของลูกค้า" />
      </section>

      <div className="min-w-0 space-y-4">
        {canTopUp && canAdjust && (
          <div className="flex gap-1.5" role="tablist" aria-label="งานที่ทำ">
            {(
              [
                ["topup", "เติมโทเคน", Coins01Icon],
                ["adjust", "ปรับยอด", PencilEdit02Icon],
              ] as const
            ).map(([value, text, icon]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                disabled={Boolean(done) || working}
                onClick={() => setMode(value)}
                className={`${pill} h-9 flex-1 justify-center ${mode === value ? "border-foreground/40 bg-secondary text-foreground" : ""}`}
              >
                <Icon icon={icon} className="size-4" />
                {text}
              </button>
            ))}
          </div>
        )}
        <Notice state={{ error, ok: done ?? undefined }} />
        {customer ? (
          <>
            <CustomerCard customer={customer} />
            {done ? (
              <button type="button" onClick={next} className={`${pillPrimary} h-11 w-full justify-center`}>
                ลูกค้าคนถัดไป
              </button>
            ) : (
              <section className={`${card} space-y-4 p-4`}>
                {mode === "adjust" && (
                  <div className="flex gap-1.5">
                    {(
                      [
                        [-1, "ลดโทเคน (เติมเกิน)"],
                        [1, "เพิ่มโทเคน (เติมขาด)"],
                      ] as const
                    ).map(([value, text]) => (
                      <button key={value} type="button" onClick={() => setDirection(value)} className={`${pill} h-9 flex-1 justify-center text-xs ${direction === value ? "border-foreground/40 bg-secondary text-foreground" : ""}`}>
                        {text}
                      </button>
                    ))}
                  </div>
                )}
                {mode === "topup" ? (
                  <div>
                    <label htmlFor="topup-baht" className={label}>
                      จำนวนเงินที่ลูกค้าโอน / จ่าย (บาท)
                    </label>
                    <input
                      id="topup-baht"
                      type="number"
                      inputMode="numeric"
                      min={tokenPrice}
                      step={tokenPrice}
                      value={Number.isNaN(received) ? "" : received}
                      onChange={(e) => setReceived(e.target.valueAsNumber)}
                      className={`${input} text-lg tabular-nums`}
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {QUICK_BAHT.map((n) => (
                        <button key={n} type="button" onClick={() => setReceived(n)} className={`${pill} h-8 px-3 text-xs ${received === n ? "border-foreground/40 bg-secondary" : ""}`}>
                          ฿{num.format(n)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="topup-tokens" className={label}>
                      จำนวนโทเคน
                    </label>
                    <input
                      id="topup-tokens"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={Number.isNaN(tokens) ? "" : tokens}
                      onChange={(e) => setTokens(e.target.valueAsNumber)}
                      className={`${input} tabular-nums`}
                    />
                  </div>
                )}
                {mode === "adjust" && (
                  <>
                    <div>
                      <label htmlFor="adjust-baht" className={label}>
                        เงินที่เกี่ยวข้อง (บาท ไม่บังคับ) {direction < 0 ? "เช่น เงินที่ลูกค้าไม่ได้จ่ายจริง" : "เช่น เงินที่ลูกค้าจ่ายเพิ่ม"}
                      </label>
                      <input id="adjust-baht" type="number" inputMode="numeric" min={0} value={Number.isNaN(baht) ? "" : baht} onChange={(e) => setBaht(e.target.valueAsNumber || 0)} className={`${input} tabular-nums`} />
                    </div>
                    <p className={`rounded-xl px-3 py-2 text-xs ${after < 0 ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-secondary text-muted-foreground"}`}>
                      หลังปรับ บัตรใบนี้จะเหลือ <b className="tabular-nums">{num.format(Number.isNaN(after) ? customer.tokens : after)}</b> โทเคน
                      {after < 0 && " (ติดลบ ต้องตามเก็บจากลูกค้าภายหลัง)"}
                    </p>
                  </>
                )}
                <div>
                  <label htmlFor="topup-note" className={label}>
                    {mode === "adjust" ? "เหตุผล (บังคับ)" : "หมายเหตุ (ไม่บังคับ)"}
                  </label>
                  <input
                    id="topup-note"
                    value={note}
                    maxLength={300}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={mode === "adjust" ? "เติมผิด กด 200 แทน 20" : "เลขอ้างอิงสลิป / โอนจากธนาคารไหน"}
                    className={input}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input ref={photo} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setSlip(e.target.files?.[0] ?? null)} aria-label="ถ่ายรูปสลิป" />
                  <button type="button" onClick={() => photo.current?.click()} className={`${pill} h-9 text-xs`}>
                    <Icon icon={Camera01Icon} className="size-4" />
                    {slip ? "ถ่ายใหม่" : "ถ่ายรูปสลิป"}
                  </button>
                  <span className="min-w-0 truncate text-2xs text-muted-foreground">{slip ? `แนบแล้ว: ${slip.name}` : "ไม่บังคับ เก็บไว้เทียบตอนสรุปงาน"}</span>
                </div>
                {mode === "topup" && (
                  <div className="border-t border-border pt-3">
                    <p className="flex items-baseline justify-between text-sm text-muted-foreground">
                      ลูกค้าได้รับ
                      <span className="text-2xl font-semibold text-amber-600 tabular-nums dark:text-amber-400">{num.format(bought)} โทเคน</span>
                    </p>
                    <p className="mt-0.5 text-right text-2xs text-muted-foreground">
                      1 โทเคน = ฿{num.format(tokenPrice)} · หลังเติมบัตรใบนี้มี {num.format(after)} โทเคน
                    </p>
                    {leftover > 0 && (
                      <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                        เศษ ฿{num.format(leftover)} แปลงเป็นโทเคนไม่ได้ ระบบบันทึกยอด ฿{num.format(bought * tokenPrice)} ทอนเงินหรือให้ลูกค้าโอนให้ลงตัว
                      </p>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={next} className={`${pill} h-11 flex-1 justify-center`}>
                    ยกเลิก
                  </button>
                  <button type="button" onClick={confirm} disabled={!valid || working} className={`${pillPrimary} h-11 flex-1 justify-center`}>
                    <Icon icon={working ? Loading03Icon : mode === "adjust" ? PencilEdit02Icon : Coins01Icon} className={`size-4 ${working ? "animate-spin" : ""}`} />
                    {mode === "adjust" ? "ปรับยอด" : "เติมโทเคน"}
                  </button>
                </div>
              </section>
            )}
          </>
        ) : (
          <section className={card}>
            <Empty
              icon={mode === "adjust" ? PencilEdit02Icon : Coins01Icon}
              title={working ? "กำลังตรวจบัตร…" : mode === "adjust" ? "สแกนบัตรที่ต้องการปรับยอด" : "สแกนบัตรลูกค้าเพื่อเติมโทเคน"}
              detail={`1 โทเคน = ฿${num.format(tokenPrice)} · บัตรแต่ละใบมีโทเคนของตัวเอง · แลกคืนเป็นเงินไม่ได้`}
            />
          </section>
        )}

        <section className={`${card} overflow-hidden`}>
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">เติมและปรับยอดล่าสุด</h2>
          {feed.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">ยังไม่มีรายการ</p>
          ) : (
            <ul className="divide-y divide-border">
              {feed.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-12 shrink-0 text-2xs text-muted-foreground tabular-nums">{clock.format(new Date(entry.at))}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      {entry.customer}
                      {entry.ticketCode && <span className="ml-1.5 font-mono text-2xs text-muted-foreground">{entry.ticketCode}</span>}
                    </p>
                    <p className="truncate text-2xs text-muted-foreground">
                      {entry.reason === "adjust" ? "ปรับยอด " : ""}
                      {entry.tokens > 0 ? "+" : "−"}
                      {num.format(Math.abs(entry.tokens))} โทเคน · ฿{num.format(entry.baht)}
                      {entry.by ? ` · โดย ${entry.by}` : ""}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </p>
                  </div>
                  {entry.slip && (
                    <Hint label="ดูรูปสลิป">
                      <a href={slipUrl(entry.slip)} target="_blank" rel="noreferrer" aria-label={`ดูรูปสลิปของ ${entry.customer}`} className={iconButton}>
                        <Icon icon={Image01Icon} className="size-4" />
                      </a>
                    </Hint>
                  )}
                  {entry.reason === "adjust" ? (
                    <Badge tone="warn">ปรับยอด</Badge>
                  ) : entry.undone ? (
                    <Badge>ยกเลิกแล้ว</Badge>
                  ) : canTopUp ? (
                    <Hint label="ยกเลิกรายการ">
                      <button type="button" aria-label={`ยกเลิกการเติมของ ${entry.customer}`} disabled={working} onClick={() => undo(entry.id)} className={iconButton}>
                        <Icon icon={Undo02Icon} className="size-4" />
                      </button>
                    </Hint>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
