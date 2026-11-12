import type { Metadata } from "next";
import Link from "next/link";
import { DeliveryTruck01Icon, Package01Icon, ShoppingBag01Icon, Ticket02Icon } from "@hugeicons/core-free-icons";
import { InlineIcon } from "@/components/admin/member-figures";
import { ORDER_STATUS, TICKET_STATUS } from "@/components/admin/order-status";
import { Badge, Empty, card, pill } from "@/components/admin/ui";
import { memberOrders } from "@/lib/admin-members";
import { addressLine, merchLabel } from "@/lib/event-fields";
import { requirePermission } from "@/lib/session";
import { bahtOrFree, num } from "@/lib/format";

export const metadata: Metadata = { title: "คำสั่งซื้อของสมาชิก" };

const stamp = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
const at = (iso: string) => stamp.format(new Date(iso));

const STATES = [
  { value: "", label: "ทั้งหมด" },
  ...(["paid", "pending", "cancelled", "expired"] as const).map((value) => ({ value, label: ORDER_STATUS[value].label })),
];

/** Every order of the member: what, how much, when, each ticket and whether it went in, the merchandise and where it went */
export default async function MemberOrdersPage({ params, searchParams }: PageProps<"/admin/users/[id]/orders">) {
  const { id } = await params;
  await requirePermission("members.manage", `/admin/users/${id}/orders`);
  const memberId = decodeURIComponent(id);
  const { status } = await searchParams;
  const state = STATES.find((s) => s.value === status)?.value ?? "";
  const all = await memberOrders(memberId);
  const orders = state ? all.filter((o) => o.status === state) : all;
  const base = `/admin/users/${memberId}/orders`;

  return (
    <>
      <nav aria-label="สถานะ" className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
        {STATES.map((s) => {
          const n = s.value ? all.filter((o) => o.status === s.value).length : all.length;
          return (
            <Link
              key={s.value}
              href={s.value ? `${base}?status=${s.value}` : base}
              aria-current={state === s.value ? "page" : undefined}
              className={`${pill} h-8 px-3 text-xs ${state === s.value ? "border-foreground/40 bg-secondary text-foreground" : "text-muted-foreground"}`}
            >
              {s.label} <span className="tabular-nums opacity-70">{num.format(n)}</span>
            </Link>
          );
        })}
      </nav>

      {orders.length === 0 ? (
        <section className={card}>
          <Empty icon={ShoppingBag01Icon} title={state ? "ไม่มีคำสั่งซื้อในสถานะนี้" : "ยังไม่เคยสั่งซื้อ"} />
        </section>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <article key={order.id} id={order.code} className={`${card} scroll-mt-20 overflow-hidden ${order.status === "cancelled" || order.status === "expired" ? "opacity-70" : ""}`}>
              <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <Link href={`/admin/events/${order.event.id}`} className="block truncate text-sm font-semibold text-foreground hover:underline">
                    {order.event.title}
                  </Link>
                  <p className="mt-0.5 text-2xs text-muted-foreground">
                    <span className="font-mono">{order.code}</span> · สั่งเมื่อ {at(order.createdAt)}
                    {order.paidAt && <> · ชำระเมื่อ {at(order.paidAt)}</>}
                    {order.status === "pending" && <> · หมดเวลา {at(order.expiresAt)}</>}
                  </p>
                </div>
                <Badge tone={ORDER_STATUS[order.status].tone}>{ORDER_STATUS[order.status].label}</Badge>
              </header>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-sm sm:grid-cols-4 sm:px-5">
                <div className="min-w-0">
                  <dt className="text-2xs text-muted-foreground">บัตร</dt>
                  <dd className="truncate text-foreground">
                    {order.zone ? `${order.zone} × ${order.quantity}` : "สินค้าอย่างเดียว"}
                  </dd>
                </div>
                <div>
                  <dt className="text-2xs text-muted-foreground">ราคาต่อใบ</dt>
                  <dd className="text-foreground tabular-nums">{bahtOrFree(order.unitPrice)}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-muted-foreground">ยอดรวม</dt>
                  <dd className="font-semibold text-foreground tabular-nums">{bahtOrFree(order.total)}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-muted-foreground">{order.status === "paid" ? "โทเคนที่ได้" : "โทเคน"}</dt>
                  <dd className="text-foreground tabular-nums">
                    {order.status === "paid" ? num.format(order.tokens) : order.status === "pending" ? `${num.format(order.tokens)} เมื่อชำระ` : "ไม่ได้รับ"}
                  </dd>
                </div>
              </dl>

              {order.tickets.length > 0 && (
                <div className="border-t border-border px-4 py-3 sm:px-5">
                  <p className="mb-2 flex items-center gap-1 text-2xs text-muted-foreground">
                    <InlineIcon icon={Ticket02Icon} />
                    บัตร {order.tickets.length} ใบ
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {order.tickets.map((ticket) => (
                      <li key={ticket.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2">
                        <div className="min-w-0">
                          <p className="font-mono text-sm tracking-wider text-foreground">{ticket.code}</p>
                          <p className="truncate text-2xs text-muted-foreground">
                            ใบที่ {ticket.seq}
                            {ticket.checkedInAt && <> · เข้า {at(ticket.checkedInAt)}</>}
                            {ticket.checkedInBy && <> · โดย {ticket.checkedInBy}</>}
                          </p>
                        </div>
                        <Badge tone={TICKET_STATUS[ticket.status].tone}>{TICKET_STATUS[ticket.status].label}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {order.merch.length > 0 && (
                <div className="border-t border-border px-4 py-3 sm:px-5">
                  <p className="mb-2 flex items-center gap-1 text-2xs text-muted-foreground">
                    <InlineIcon icon={Package01Icon} />
                    สินค้า{order.status === "paid" ? ` · ${order.shipment ? "จัดส่ง" : "รับที่งาน"}` : ""}
                  </p>
                  <ul className="space-y-1 text-sm">
                    {order.merch.map((item) => (
                      <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="min-w-0 text-foreground">
                          {merchLabel(item)} × {item.quantity}
                        </span>
                        <span className="text-2xs text-muted-foreground tabular-nums">
                          {bahtOrFree(item.unitPrice * item.quantity)}
                          {order.status === "paid" && !order.shipment && (item.pickedUpAt ? ` · รับแล้ว ${at(item.pickedUpAt)}` : " · ยังไม่รับ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {order.shipment && (
                <div className="border-t border-border px-4 py-3 text-sm sm:px-5">
                  <p className="mb-1 flex items-center gap-1 text-2xs text-muted-foreground">
                    <InlineIcon icon={DeliveryTruck01Icon} />
                    จัดส่ง · ค่าส่ง {bahtOrFree(order.shipment.fee)}
                  </p>
                  <p className="break-words text-foreground">
                    {order.shipment.name} · <span className="tabular-nums">{order.shipment.phone}</span>
                  </p>
                  <p className="break-words text-xs text-muted-foreground">{addressLine(order.shipment)}</p>
                  <p className="mt-1 text-xs">
                    {order.shipment.shippedAt ? (
                      <>
                        <Badge tone="good">ส่งแล้ว</Badge> <span className="text-muted-foreground">{at(order.shipment.shippedAt)}</span>{" "}
                        {order.shipment.carrier && <span className="text-foreground">{order.shipment.carrier}</span>}{" "}
                        {order.shipment.trackingNo && <span className="font-mono text-foreground">{order.shipment.trackingNo}</span>}
                      </>
                    ) : (
                      <Badge tone="warn">รอจัดส่ง</Badge>
                    )}
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
