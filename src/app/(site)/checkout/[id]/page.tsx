import { addressLine, merchLabel } from "@/lib/event-fields";
import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { CheckoutPanel, type CheckoutPay } from "@/components/checkout-panel";
import { EventPageSkeleton } from "@/components/skeletons";
import { FadeImage } from "@/components/ui/fade-image";
import { getOrder } from "@/lib/orders";
import { latestPayment, paySettings } from "@/lib/payments";
import { isPromptPayTarget, maskPromptPay, promptPayPayload } from "@/lib/promptpay";
import { isRemote } from "@/lib/poster";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "ชำระเงิน", robots: { index: false } };

const dateFormat = new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
const timeFormat = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
const baht = (n: number) => (n === 0 ? "ฟรี" : `฿${n.toLocaleString("th-TH")}`);

export default function CheckoutPage({ params }: PageProps<"/checkout/[id]">) {
  return (
    // The order is this visitor's alone, so it waits for the request behind a skeleton
    <Suspense fallback={<EventPageSkeleton />}>
      <Checkout params={params} />
    </Suspense>
  );
}

async function Checkout({ params }: Pick<PageProps<"/checkout/[id]">, "params">) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/checkout/${id}`)}`);
  const order = await getOrder(id, session.user.id);
  if (!order) notFound();
  if (order.status === "paid") redirect(`/tickets?paid=${order.id}`);
  const startsAt = new Date(order.event.startsAt);
  const [settings, last] = await Promise.all([paySettings(order.event.id), latestPayment(order.id)]);
  // The PromptPay QR with the amount filled in, drawn here so the browser has nothing to build
  const pay: CheckoutPay =
    settings && isPromptPayTarget(settings.promptpayId) && order.total > 0
      ? {
          qr: await QRCode.toDataURL(promptPayPayload(settings.promptpayId, order.total), { margin: 1, width: 420, errorCorrectionLevel: "M" }),
          name: settings.promptpayName,
          account: maskPromptPay(settings.promptpayId),
        }
      : null;

  return (
    <main className="flex flex-1 justify-center px-3 pt-8 pb-16 sm:pt-10">
      <div className="stagger w-full min-w-0 max-w-lg space-y-4">
        <header>
          <p className="text-xs text-muted-foreground">คำสั่งซื้อ {order.code}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">ชำระเงิน</h1>
        </header>

        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex gap-3">
            <div className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-lg bg-secondary">
              <FadeImage src={order.event.poster} alt="" fill sizes="64px" unoptimized={isRemote(order.event.poster)} className="object-cover" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-balance text-foreground">{order.event.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {dateFormat.format(startsAt)} · {timeFormat.format(startsAt)} น.
              </p>
              <p className="truncate text-xs text-muted-foreground">{[order.event.venue, order.event.venueArea].filter(Boolean).join(", ")}</p>
            </div>
          </div>

          <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            {order.zone ? (
              <>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">ประเภทบัตร</dt>
                  <dd className="text-right text-foreground">{order.zone.name}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">จำนวน</dt>
                  <dd className="text-foreground tabular-nums">
                    {order.quantity} ใบ × {baht(order.unitPrice)}
                  </dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">บัตร</dt>
                <dd className="text-right text-foreground">ไม่ซื้อบัตร (สินค้าอย่างเดียว)</dd>
              </div>
            )}
            {order.merch.map((item) => (
              <div key={item.id} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">
                  {merchLabel(item)}
                </dt>
                <dd className="shrink-0 text-foreground tabular-nums">
                  {item.quantity} ชิ้น × {baht(item.unitPrice)}
                </dd>
              </div>
            ))}
            {order.merch.length > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">การรับสินค้า</dt>
                <dd className="text-right text-foreground">{order.shipment ? `จัดส่ง ${baht(order.shipment.fee)}` : "รับที่หน้างาน"}</dd>
              </div>
            )}
            {order.shipment && (
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">ส่งถึง</dt>
                <dd className="text-right text-foreground">
                  {order.shipment.name} · {order.shipment.phone}
                  <span className="block text-xs text-muted-foreground">{addressLine(order.shipment)}</span>
                </dd>
              </div>
            )}
            {order.tokens > 0 && (
              <div className="flex justify-between gap-3 text-amber-600 dark:text-amber-400">
                <dt>ได้รับโทเคน{order.quantity > 1 ? ` (ใบละ ${(order.tokens / order.quantity).toLocaleString("th-TH")})` : ""}</dt>
                <dd className="tabular-nums">+{order.tokens.toLocaleString("th-TH")}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3 border-t border-border pt-2 text-base font-medium text-foreground">
              <dt>ยอดชำระ</dt>
              <dd className="tabular-nums">{baht(order.total)}</dd>
            </div>
          </dl>
        </section>

        <CheckoutPanel
          orderId={order.id}
          status={order.status}
          expiresAt={order.expiresAt}
          slug={order.event.slug}
          total={order.total}
          quantity={order.quantity}
          attendees={order.attendees}
          buyer={{ name: session.user.name, email: session.user.email }}
          pay={pay}
          rejected={last?.status === "rejected" ? last.reason : null}
        />
      </div>
    </main>
  );
}
