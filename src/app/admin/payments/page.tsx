import type { Metadata } from "next";
import Link from "next/link";
import { CheckmarkCircle02Icon, Invoice03Icon } from "@hugeicons/core-free-icons";
import { SlipDecision } from "@/components/admin/slip-review";
import { Badge, Empty, PageHeader, card } from "@/components/admin/ui";
import { TimeAgo } from "@/components/admin/relative-time";
import { listPayments, type ReviewRow } from "@/lib/payments";
import { slip2goReady } from "@/lib/slip2go";
import { slipUrl } from "@/lib/slip-url";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "ตรวจสลิป" };

const num = new Intl.NumberFormat("th-TH");
const money = (n: number) => `฿${num.format(n)}`;
const when = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

/**
 * ตรวจสลิป: transfer slips Slip2Go couldn't settle, or every slip of an event that checks by hand. Oldest first, the
 * picture beside what the order asked for and what the bank said. อนุมัติ issues the tickets; ปฏิเสธ tells the buyer why.
 */
export default async function PaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  const { access } = await requirePermission("payments.review", "/admin/payments");
  const params = await searchParams;
  const done = params.tab === "done";
  const rows = await listPayments({ status: done ? "done" : "review" });
  const members = can(access, "members.manage");

  return (
    <>
      <PageHeader
        eyebrow="Payments"
        title="ตรวจสลิป"
        description={
          slip2goReady()
            ? "สลิปที่ระบบตรวจอัตโนมัติ (Slip2Go) ยืนยันไม่ได้ หรืองานที่ตั้งให้ทีมงานตรวจเอง เปิดแอปธนาคารดูยอดเข้าก่อนกดอนุมัติ"
            : "ยังไม่ได้ตั้งค่า SLIP2GO_KEY สลิปทุกใบจึงรอทีมงานตรวจที่นี่ เปิดแอปธนาคารดูยอดเข้าก่อนกดอนุมัติ"
        }
      />

      <nav className="mb-4 flex gap-1.5" aria-label="สถานะสลิป">
        {[
          { href: "/admin/payments", label: "รอตรวจ", on: !done },
          { href: "/admin/payments?tab=done", label: "ตรวจแล้ว", on: done },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.on ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${tab.on ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:text-foreground"}`}
          >
            {tab.label}
            {tab.on && ` (${num.format(rows.length)})`}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <section className={card}>
          <Empty icon={done ? Invoice03Icon : CheckmarkCircle02Icon} title={done ? "ยังไม่มีสลิปที่ตรวจแล้ว" : "ไม่มีสลิปรอตรวจ"} detail={done ? undefined : "สลิปใหม่จะขึ้นที่นี่ทันทีที่ลูกค้าแนบ"} />
        </section>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => (
            <SlipCard key={row.id} row={row} members={members} />
          ))}
        </ul>
      )}
    </>
  );
}

function SlipCard({ row, members }: { row: ReviewRow; members: boolean }) {
  const short = row.paidAmount !== null && row.paidAmount + 0.005 < row.amount;
  return (
    <li className={`${card} flex min-w-0 flex-col gap-4 p-4 sm:flex-row sm:p-5`}>
      <a href={slipUrl(row.slip)} target="_blank" rel="noreferrer" className="block shrink-0 self-center overflow-hidden rounded-xl border border-border bg-secondary sm:self-start">
        {/* A private picture behind a permission check: next/image's optimiser can't fetch it, so a plain <img> */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={slipUrl(row.slip)} alt={`สลิปของคำสั่งซื้อ ${row.order.code}`} className="h-64 w-40 object-cover object-top sm:h-72 sm:w-44" loading="lazy" />
      </a>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xl font-semibold text-foreground tabular-nums">{money(row.amount)}</p>
          {row.status === "approved" && <Badge tone="good">อนุมัติแล้ว{row.approvedVia === "api" ? " (อัตโนมัติ)" : ""}</Badge>}
          {row.status === "rejected" && <Badge tone="danger">ปฏิเสธ</Badge>}
        </div>
        <dl className="space-y-1 text-xs">
          <Row label="คำสั่งซื้อ">
            {row.order.code} · {row.zone ? `${row.zone} × ${row.order.quantity}` : "สินค้าอย่างเดียว"}
          </Row>
          <Row label="อีเวนต์">{row.event.title}</Row>
          <Row label="ผู้ซื้อ">
            {members ? (
              <Link href={`/admin/users/${row.buyer.id}`} className="underline-offset-2 hover:underline">
                {row.buyer.name}
              </Link>
            ) : (
              row.buyer.name
            )}{" "}
            <span className="text-muted-foreground">
              {row.buyer.email} · {row.buyer.phone}
            </span>
          </Row>
          <Row label="แนบเมื่อ">
            <TimeAgo iso={row.createdAt} />
          </Row>
          {(row.transRef || row.paidAmount !== null) && (
            <>
              <Row label="ธนาคารบอกว่า">
                <span className={short ? "font-medium text-red-600 dark:text-red-400" : ""}>{row.paidAmount !== null ? money(row.paidAmount) : "-"}</span>
                {row.senderName && ` จาก ${row.senderName}`}
                {row.paidAt && ` · ${when.format(new Date(row.paidAt))}`}
              </Row>
              {row.transRef && <Row label="เลขอ้างอิง">{row.transRef}</Row>}
            </>
          )}
          {row.reason && (
            <Row label={row.status === "rejected" ? "เหตุผล" : "ทำไมต้องตรวจเอง"}>
              <span className="text-amber-700 dark:text-amber-300">{row.reason}</span>
            </Row>
          )}
          {row.reviewer && row.reviewedAt && (
            <Row label="ตรวจโดย">
              {row.reviewer} · {when.format(new Date(row.reviewedAt))}
            </Row>
          )}
        </dl>
        {row.status === "review" && <SlipDecision paymentId={row.id} code={row.order.code} amount={money(row.amount)} />}
      </div>
    </li>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}
