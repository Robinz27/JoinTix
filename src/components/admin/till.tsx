"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Coins01Icon, Delete02Icon, Loading03Icon, MinusSignIcon, PlusSignIcon, ShoppingBasket01Icon, Undo02Icon } from "@hugeicons/core-free-icons";
import { chargeAtTill, findAtTill, tillFeed, voidAtTill } from "@/app/actions/shops";
import { CustomerCard } from "@/components/admin/customer-card";
import { Notice } from "@/components/admin/form";
import { QrReader } from "@/components/admin/qr-reader";
import { Badge, Empty, card, iconButton, pill, pillPrimary } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { Hint } from "@/components/ui/hint";
import { Select } from "@/components/ui/select";
import type { Customer, SaleEntry, TillShop } from "@/lib/shops";

// ขายที่ร้าน: tap what the customer wants, scan their ticket, check the name, take the tokens. The server prices
// the bill from the menu itself and refuses it whole if the tokens aren't there. A wrong sale can be voided,
// which gives the tokens back.
//
// A shop that sells one thing (the client's usual case: a popcorn stand, a drinks stall) skips the tapping and the
// confirming: every scan takes that item's tokens straight away, ready for the next customer.

const num = new Intl.NumberFormat("th-TH");
const clock = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
const SHOP_KEY = "jointix-till-shop";

export function Till({ shops }: { shops: TillShop[] }) {
  const [shopId, setShopId] = useState(shops[0].id);
  const shop = shops.find((s) => s.id === shopId) ?? shops[0];

  // The shop chosen last time on this device
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SHOP_KEY);
      if (saved && shops.some((s) => s.id === saved)) setTimeout(() => setShopId(saved), 0);
    } catch {
      // nothing remembered
    }
  }, [shops]);

  function choose(id: string) {
    setShopId(id);
    try {
      localStorage.setItem(SHOP_KEY, id);
    } catch {
      // private mode: the choice just isn't remembered
    }
  }

  return (
    <div className="space-y-4">
      {shops.length > 1 && (
        <section className={`${card} p-3 sm:p-4`}>
          <Select label="ร้าน" value={shop.id} onChange={choose} options={shops.map((s) => ({ value: s.id, label: s.name, hint: s.eventTitle }))} />
        </section>
      )}
      <Register key={shop.id} shop={shop} />
    </div>
  );
}

function Register({ shop }: { shop: TillShop }) {
  // One item on the menu: scan and it's sold
  const quick = shop.items.length === 1 ? shop.items[0] : null;
  const [bill, setBill] = useState<Record<string, number>>(() => (quick ? { [quick.id]: 1 } : {}));
  const [scanned, setScanned] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [state, setState] = useState<{ ok?: string; error?: string }>({});
  const [feed, setFeed] = useState<SaleEntry[]>([]);
  // One per bill, so a double press charges once
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [working, start] = useTransition();

  const reload = useCallback(() => {
    tillFeed(shop.id).then(setFeed).catch(() => {});
  }, [shop.id]);
  useEffect(reload, [reload]);

  const lines = shop.items.filter((item) => bill[item.id] > 0).map((item) => ({ ...item, quantity: bill[item.id] }));
  const total = lines.reduce((n, line) => n + line.tokens * line.quantity, 0);
  const add = (id: string, by: number) => setBill((all) => ({ ...all, [id]: Math.max(0, Math.min(99, (all[id] ?? 0) + by)) }));

  const clear = () => {
    setBill(quick ? { [quick.id]: 1 } : {});
    setScanned(null);
    setCustomer(null);
    setKey(crypto.randomUUID());
  };

  const scan = useCallback(
    (value: string) => {
      setScanned(value);
      setState({});
      start(async () => {
        if (quick) {
          const answer = await chargeAtTill({ shopId: shop.id, scanned: value, lines: [{ itemId: quick.id, quantity: bill[quick.id] ?? 1 }], key });
          setState(answer.error !== undefined ? { error: answer.error } : { ok: `ตัด ${num.format(answer.tokens)} โทเคนแล้ว คงเหลือ ${num.format(answer.balance)}` });
          setBill({ [quick.id]: 1 });
          setScanned(null);
          setCustomer(null);
          setKey(crypto.randomUUID());
          reload();
          return;
        }
        const answer = await findAtTill(value, shop.id);
        if (answer.customer) setCustomer(answer.customer);
        else {
          setScanned(null);
          setState({ error: answer.error });
        }
      });
    },
    [shop.id, quick, bill, key, reload],
  );

  function charge() {
    if (!scanned) return;
    start(async () => {
      const answer = await chargeAtTill({ shopId: shop.id, scanned, lines: lines.map((l) => ({ itemId: l.id, quantity: l.quantity })), key });
      if (answer.error !== undefined) return setState({ error: answer.error });
      setState({ ok: `ตัด ${num.format(answer.tokens)} โทเคนแล้ว คงเหลือ ${num.format(answer.balance)}` });
      clear();
      reload();
    });
  }

  function cancelSale(id: string) {
    start(async () => {
      const answer = await voidAtTill(shop.id, id);
      setState(answer.error ? { error: answer.error } : { ok: "ยกเลิกรายการแล้ว คืนโทเคนให้ลูกค้าแล้ว" });
      reload();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="min-w-0 space-y-4">
        <section className={`${card} overflow-hidden`}>
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
            เมนู {shop.name}
            {quick && <span className="mt-0.5 block text-2xs font-normal text-muted-foreground">ร้านนี้ขายรายการเดียว สแกน QR แล้วตัดโทเคนทันที ไม่ต้องกดยืนยัน (ปรับจำนวนก่อนสแกนได้)</span>}
          </h2>
          {shop.items.length === 0 ? (
            <Empty icon={ShoppingBasket01Icon} title="ร้านนี้ยังไม่มีเมนูที่เปิดขาย" />
          ) : (
            <ul className="divide-y divide-border">
              {shop.items.map((item) => {
                const n = bill[item.id] ?? 0;
                return (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{item.name}</p>
                      <p className="text-2xs text-amber-600 tabular-nums dark:text-amber-400">{num.format(item.tokens)} โทเคน</p>
                    </div>
                    <button type="button" aria-label={`ลด ${item.name}`} disabled={n === 0} onClick={() => add(item.id, -1)} className={iconButton}>
                      <Icon icon={MinusSignIcon} className="size-4" />
                    </button>
                    <span className="w-6 text-center text-sm font-medium text-foreground tabular-nums">{n}</span>
                    <button type="button" aria-label={`เพิ่ม ${item.name}`} onClick={() => add(item.id, 1)} className={iconButton}>
                      <Icon icon={PlusSignIcon} className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={`${card} overflow-hidden`}>
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">ขายล่าสุด</h2>
          {feed.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">ยังไม่มีรายการ</p>
          ) : (
            <ul className="divide-y divide-border">
              {feed.map((sale) => (
                <li key={sale.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-12 shrink-0 text-2xs text-muted-foreground tabular-nums">{clock.format(new Date(sale.at))}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      {sale.customer} · {num.format(sale.tokens)} โทเคน
                    </p>
                    <p className="truncate text-2xs text-muted-foreground">{sale.items}</p>
                  </div>
                  {sale.voided ? (
                    <Badge>ยกเลิกแล้ว</Badge>
                  ) : (
                    <Hint label="ยกเลิกรายการและคืนโทเคน">
                      <button type="button" aria-label={`ยกเลิกรายการของ ${sale.customer}`} disabled={working} onClick={() => cancelSale(sale.id)} className={iconButton}>
                        <Icon icon={Undo02Icon} className="size-4" />
                      </button>
                    </Hint>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="min-w-0 space-y-4">
        <Notice state={state} />
        <section className={`${card} space-y-2 p-4`}>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">เลือกรายการจากเมนู</p>
          ) : (
            lines.map((line) => (
              <p key={line.id} className="flex justify-between gap-3 text-sm text-foreground">
                <span className="min-w-0 truncate">
                  {line.name} × {line.quantity}
                </span>
                <span className="shrink-0 tabular-nums">{num.format(line.tokens * line.quantity)}</span>
              </p>
            ))
          )}
          <p className="flex items-baseline justify-between border-t border-border pt-2 text-sm text-muted-foreground">
            รวม
            <span className="text-2xl font-semibold text-amber-600 tabular-nums dark:text-amber-400">{num.format(total)} โทเคน</span>
          </p>
        </section>

        {customer && (
          <>
            <CustomerCard customer={customer} />
            {customer.tokens < total && <Notice state={{ error: `โทเคนไม่พอ ขาดอีก ${num.format(total - customer.tokens)} ส่งลูกค้าไปเติมก่อน` }} />}
            <div className="flex gap-2">
              <button type="button" onClick={clear} className={`${pill} h-11 flex-1 justify-center`}>
                <Icon icon={Delete02Icon} className="size-4" />
                เริ่มใหม่
              </button>
              <button type="button" onClick={charge} disabled={working || total === 0 || customer.tokens < total} className={`${pillPrimary} h-11 flex-1 justify-center`}>
                <Icon icon={working ? Loading03Icon : Coins01Icon} className={`size-4 ${working ? "animate-spin" : ""}`} />
                ตัดโทเคน
              </button>
            </div>
          </>
        )}
        {/* Stays on screen with the customer: the camera keeps running for the next one, and the flash gets seen */}
        <section className={`${card} overflow-hidden`}>
          <QrReader onScan={scan} paused={Boolean(scanned)} prompt={quick ? `ส่อง QR บนบัตร ตัด ${num.format(total)} โทเคนทันที` : "ส่อง QR บนบัตรของลูกค้าเพื่อตัดโทเคน"} />
        </section>
      </div>
    </div>
  );
}
