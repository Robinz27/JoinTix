import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { CheckoutActions } from "@/components/checkout-actions";
import { EventPageSkeleton } from "@/components/skeletons";
import { FadeImage } from "@/components/ui/fade-image";
import { getOrder } from "@/lib/orders";
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

  return (
    <main className="flex flex-1 justify-center px-3 pt-8 pb-16 sm:pt-10">
      <div className="stagger w-full max-w-lg space-y-4">
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
            {order.tokens > 0 && (
              <div className="flex justify-between gap-3 text-amber-600 dark:text-amber-400">
                <dt>ได้รับโทเคน</dt>
                <dd className="tabular-nums">+{order.tokens.toLocaleString("th-TH")}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3 border-t border-border pt-2 text-base font-medium text-foreground">
              <dt>ยอดชำระ</dt>
              <dd className="tabular-nums">{baht(order.total)}</dd>
            </div>
          </dl>
        </section>

        <CheckoutActions orderId={order.id} status={order.status} expiresAt={order.expiresAt} slug={order.event.slug} free={order.total === 0} />
      </div>
    </main>
  );
}
