import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Calendar03Icon, CheckmarkCircle02Icon, Coins01Icon, Location01Icon, Mail01Icon, Ticket02Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/icon";
import { ProfileSkeleton } from "@/components/skeletons";
import { TicketQrButton } from "@/components/ticket-qr";
import { FadeImage } from "@/components/ui/fade-image";
import { listMyTickets, tokenBalances } from "@/lib/orders";
import { isRemote } from "@/lib/poster";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "บัตรของฉัน", robots: { index: false } };

const dateFormat = new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
const timeFormat = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
const when = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const num = new Intl.NumberFormat("th-TH");
const baht = (n: number) => (n === 0 ? "ฟรี" : `฿${num.format(n)}`);

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
  const [groups, tokens, params] = await Promise.all([listMyTickets(session.user.id), tokenBalances(session.user.id), searchParams]);
  const justPaid = typeof params.paid === "string" ? groups.find((g) => g.id === params.paid) : undefined;
  const count = groups.reduce((n, g) => n + g.tickets.length, 0);

  return (
    <main className="flex flex-1 justify-center px-3 pt-8 pb-16 sm:pt-10">
      <div className="stagger w-full max-w-2xl space-y-4">
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
              ชำระเงินสำเร็จ ได้บัตร {justPaid.quantity} ใบ{justPaid.tokens > 0 ? ` และ ${num.format(justPaid.tokens)} โทเคน` : ""} ระบบส่งบัตรพร้อม QR ไปที่{" "}
              <b className="font-medium">{session.user.email}</b> แล้ว
            </span>
          </p>
        )}

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
                  <Fact label="ประเภทบัตร">{group.zone.name}</Fact>
                  <Fact label="ยอดชำระ">
                    {group.quantity} × {baht(group.unitPrice)} = {baht(group.total)}
                  </Fact>
                  <Fact label="โทเคนงานนี้">
                    <span className="text-amber-600 dark:text-amber-400">{num.format(balance)}</span>
                  </Fact>
                </dl>

                <ul className="divide-y divide-border border-t border-border">
                  {group.tickets.map((ticket) => {
                    const used = ticket.status === "used";
                    return (
                      <li key={ticket.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                        <span className={`grid size-9 shrink-0 place-items-center rounded-xl border border-border ${used ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
                          <Icon icon={used ? CheckmarkCircle02Icon : Ticket02Icon} className="size-4.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground">
                            ใบที่ {ticket.seq} · <span className="font-mono tracking-wider">{ticket.code}</span>
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
                            label={`${group.zone.name} · ใบที่ ${ticket.seq} จาก ${group.tickets.length}`}
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
            QR เดียวกันนี้อยู่ในอีเมลยืนยันการซื้อด้วย เปิดจากอีเมลให้เจ้าหน้าที่สแกนได้เหมือนกัน
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
