import { addressLine, attendeeName, merchLabel } from "@/lib/event-fields";
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight01Icon, Calendar03Icon, CheckmarkCircle02Icon, Clock01Icon, Coins01Icon, Location01Icon, Mail01Icon, Package01Icon, Ticket02Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/icon";
import { ProfileSkeleton } from "@/components/skeletons";
import { TicketQrButton } from "@/components/ticket-qr";
import { FadeImage } from "@/components/ui/fade-image";
import { listMyTickets, openOrders, tokenBalances } from "@/lib/orders";
import { isRemote } from "@/lib/poster";
import { getSession } from "@/lib/session";
import { bahtOrFree, num } from "@/lib/format";

export const metadata: Metadata = { title: "บัตรของฉัน", robots: { index: false } };

const dateFormat = new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
const timeFormat = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
const when = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

export default function TicketsPage({ searchParams }: PageProps<"/tickets">) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <Tickets searchParams={searchParams} />
    </Suspense>
  );
}

async function Tickets({ searchParams }: Pick<PageProps<"/tickets">, "searchParams">) {
  const session = await getSession();
  if (!session) redirect("/login?next=/tickets");
  const [groups, tokens, open, params] = await Promise.all([listMyTickets(session.user.id), tokenBalances(session.user.id), openOrders(session.user.id), searchParams]);
  const justPaid = typeof params.paid === "string" ? groups.find((g) => g.id === params.paid) : undefined;
  const count = groups.reduce((n, g) => n + g.tickets.length, 0);

  return (
    <main className="flex flex-1 justify-center px-3 pt-8 pb-16 sm:pt-10">
      <div className="stagger w-full min-w-0 max-w-2xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">บัตรของฉัน</h1>
            <p className="text-sm text-muted-foreground">{count ? `${num.format(count)} ใบ จาก ${num.format(groups.length)} คำสั่งซื้อ` : "ยังไม่มีบัตร"}</p>
          </div>
          <TokenPill total={tokens.total} />
        </header>

        {justPaid && (
          <p role="status" className="flex items-start gap-2 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            <Icon icon={CheckmarkCircle02Icon} className="mt-0.5 size-4 shrink-0" />
            <span>
              ชำระเงินสำเร็จ{justPaid.quantity > 0 ? ` ได้บัตร ${justPaid.quantity} ใบ` : ""}{justPaid.tokens > 0 ? ` และ ${num.format(justPaid.tokens)} โทเคน` : ""} ระบบส่งรายละเอียด{justPaid.quantity > 0 ? "และ QR" : ""}ไปที่{" "}
              <b className="font-medium">{session.user.email}</b>
              {justPaid.quantity > 0 ? " และอีเมลของผู้เข้างานแต่ละคน" : ""} แล้ว ถ้าไม่เห็นในกล่องจดหมาย ลองดูในกล่องจดหมายขยะ (Spam / Junk)
            </span>
          </p>
        )}

        {open.map((order) => (
          <Link
            key={order.id}
            href={`/checkout/${order.id}`}
            className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 transition-colors hover:bg-amber-500/15 dark:text-amber-200"
          >
            <Icon icon={Clock01Icon} className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <b className="font-medium">{order.status === "review" ? "รอตรวจสลิป" : "รอชำระเงิน"}</b> · {order.title} ({order.code}) {bahtOrFree(order.total)}
            </span>
            <Icon icon={ArrowRight01Icon} className="size-4 shrink-0" />
          </Link>
        ))}

        {groups.length === 0 ? (
          <section className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
            <Icon icon={Ticket02Icon} className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">ยังไม่มีบัตร</p>
            <p className="mt-1 text-xs text-muted-foreground">ซื้อบัตรแล้วจะขึ้นที่นี่ พร้อม QR สำหรับเข้างาน</p>
            <Link href="/" className="btn-buy mx-auto mt-5 flex h-10 w-fit items-center justify-center rounded-xl px-5 text-sm font-medium">
              ดูอีเวนต์
            </Link>
          </section>
        ) : (
          groups.map((group) => {
            const startsAt = new Date(group.event.startsAt);
            const balance = tokens.events.find((t) => t.eventId === group.event.id)?.balance ?? 0;
            return (
              <section key={group.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex gap-3 p-4 sm:p-5">
                  <Link href={`/events/${group.event.slug}`} className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-lg bg-secondary sm:w-20">
                    <FadeImage src={group.event.poster} alt="" fill sizes="80px" unoptimized={isRemote(group.event.poster)} className="object-cover" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/events/${group.event.slug}`} className="font-medium text-balance text-foreground hover:underline">
                      {group.event.title}
                    </Link>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon icon={Calendar03Icon} className="size-3.5 shrink-0" />
                      {dateFormat.format(startsAt)} · {timeFormat.format(startsAt)} น. (ประตูเปิด {timeFormat.format(new Date(group.event.doorsAt))})
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon icon={Location01Icon} className="size-3.5 shrink-0" />
                      <span className="truncate">{[group.event.venue, group.event.venueArea].filter(Boolean).join(", ")}</span>
                    </p>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border px-4 py-3 text-xs sm:grid-cols-4 sm:px-5">
                  <Fact label="คำสั่งซื้อ">{group.code}</Fact>
                  <Fact label="ประเภทบัตร">{group.zone?.name ?? "ไม่ซื้อบัตร"}</Fact>
                  <Fact label="ยอดชำระ">{group.merch.length ? bahtOrFree(group.total) : `${group.quantity} × ${bahtOrFree(group.unitPrice)} = ${bahtOrFree(group.total)}`}</Fact>
                  <Fact label="โทเคนรวมงานนี้">
                    <span className="text-amber-600 dark:text-amber-400">{num.format(balance)}</span>
                  </Fact>
                </dl>

                {group.merch.length > 0 && (
                  <ul className="space-y-1 border-t border-border px-4 py-3 text-xs sm:px-5">
                    {!group.shipment && group.merch.some((item) => !item.pickedUpAt) && (
                      <li className="flex items-center justify-between gap-3 pb-1.5">
                        <span className="text-muted-foreground">{group.tickets.length ? "รับสินค้าที่หน้างานด้วย QR บัตรใบไหนก็ได้ของคำสั่งซื้อนี้ หรือ" : "รับสินค้าที่หน้างานด้วย"} QR คำสั่งซื้อ</span>
                        <TicketQrButton secret={group.code} code={group.code} title={group.event.title} label="QR รับสินค้า" used={false} />
                      </li>
                    )}
                    {group.merch.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-1.5 text-foreground">
                          <Icon icon={Package01Icon} className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">
                            {merchLabel(item)} × {item.quantity}
                          </span>
                        </span>
                        <span className="shrink-0 text-muted-foreground">{group.shipment ? (group.shipment.shippedAt ? "ส่งแล้ว" : "รอจัดส่ง") : item.pickedUpAt ? "รับแล้ว" : "รับที่หน้างาน"}</span>
                      </li>
                    ))}
                    {group.shipment && (
                      <li className="pt-1 text-muted-foreground">
                        <p>
                          ส่งถึง {group.shipment.name} · {addressLine(group.shipment)}
                        </p>
                        {group.shipment.trackingNo && (
                          <p className="text-foreground">
                            เลขพัสดุ {group.shipment.carrier} <span className="font-mono">{group.shipment.trackingNo}</span>
                          </p>
                        )}
                      </li>
                    )}
                  </ul>
                )}

                <ul className="divide-y divide-border border-t border-border">
                  {group.tickets.map((ticket) => {
                    const used = ticket.status === "used";
                    return (
                      <li key={ticket.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                        <span className={`grid size-9 shrink-0 place-items-center rounded-xl border border-border ${used ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
                          <Icon icon={used ? CheckmarkCircle02Icon : Ticket02Icon} className="size-4.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{attendeeName(ticket.attendee)}</p>
                          <p className="text-2xs text-muted-foreground">
                            ใบที่ {ticket.seq} · <span className="font-mono tracking-wider">{ticket.code}</span> ·{" "}
                            <span className="text-amber-600 dark:text-amber-400">{num.format(ticket.tokens)} โทเคน</span>
                          </p>
                          <p className="text-2xs text-muted-foreground">
                            {used && ticket.checkedInAt ? `เข้างานแล้ว ${when.format(new Date(ticket.checkedInAt))}` : ticket.status === "void" ? "ยกเลิกแล้ว" : "พร้อมใช้เข้างาน"}
                          </p>
                        </div>
                        {ticket.status !== "void" && (
                          <TicketQrButton
                            secret={ticket.secret}
                            code={ticket.code}
                            title={group.event.title}
                            label={`${attendeeName(ticket.attendee)} · ${group.zone?.name ?? ""} · ใบที่ ${ticket.seq} จาก ${group.tickets.length}`}
                            used={used}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}

        {groups.length > 0 && (
          <p className="flex items-start gap-1.5 px-1 text-2xs text-muted-foreground">
            <Icon icon={Mail01Icon} className="mt-px size-3.5 shrink-0" />
            QR เดียวกันนี้อยู่ในอีเมลยืนยันการซื้อด้วย เปิดจากอีเมลให้เจ้าหน้าที่สแกนได้เหมือนกัน บัตรแต่ละใบมีโทเคนของตัวเอง เติมและใช้จ่ายด้วย QR ของใบนั้น
          </p>
        )}
      </div>
    </main>
  );
}

function TokenPill({ total }: { total: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-sm text-amber-700 dark:text-amber-300">
      <Icon icon={Coins01Icon} className="size-4" />
      <span className="font-semibold tabular-nums">{num.format(total)}</span> โทเคน
    </span>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-foreground tabular-nums">{children}</dd>
    </div>
  );
}
