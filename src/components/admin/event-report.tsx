import { Coins01Icon, Download04Icon, Money03Icon, Package01Icon, Store01Icon, Ticket02Icon, UserCheck01Icon } from "@hugeicons/core-free-icons";
import { Empty, Panel, SectionTitle, StatCard, card, pill, td, tdMain, th } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { merchLabel } from "@/lib/event-fields";
import { eventReport } from "@/lib/reports";
import { baht, num } from "@/lib/format";

// One event's รายงาน: on /admin/reports with its event picker, and on the event's own รายงาน tab

const right = "text-right!";

const DOWNLOADS = [
  { kind: "shops", label: "ค่าใช้จ่ายแต่ละร้าน" },
  { kind: "sales", label: "รายการขายทุกร้าน" },
  { kind: "orders", label: "คำสั่งซื้อ" },
  { kind: "tokens", label: "ความเคลื่อนไหวโทเคน" },
];

export async function EventReportView({ eventId }: { eventId: string }) {
  const report = await eventReport(eventId);
  const ticketRevenue = report.zones.reduce((n, z) => n + z.revenue, 0);
  const ticketsSold = report.zones.reduce((n, z) => n + z.sold, 0);
  const merchRevenue = report.merch.reduce((n, s) => n + s.revenue, 0);
  const merchSold = report.merch.reduce((n, s) => n + s.sold, 0);
  const owed = report.shops.reduce((n, s) => n + s.baht, 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard featured icon={Money03Icon} title="รายรับออนไลน์" value={baht(ticketRevenue + merchRevenue + report.shipping.fees)} hint={`บัตร ${baht(ticketRevenue)} · สินค้า ${baht(merchRevenue)}${report.shipping.fees ? ` · ค่าส่ง ${baht(report.shipping.fees)}` : ""}`} />
        <StatCard icon={Ticket02Icon} title="บัตรที่ขายได้" value={num.format(ticketsSold)} hint={`${num.format(report.orders.paid)} คำสั่งซื้อ · รอชำระ ${num.format(report.orders.pending)}`} />
        <StatCard icon={UserCheck01Icon} title="เข้างานแล้ว" value={`${num.format(report.door.checkedIn)} / ${num.format(report.door.tickets)}`} hint={`${num.format(report.door.peopleIn)} จาก ${num.format(report.door.people)} คน`} />
        <StatCard icon={Coins01Icon} title="เงินสดจากเติมโทเคน" value={baht(report.tokens.cash)} hint={`ต้องจ่ายร้าน ${baht(owed)}`} />
      </div>

      <div className="mt-6">
        <SectionTitle icon={Store01Icon} title="ค่าใช้จ่ายแต่ละร้าน" note="ยอดที่ต้องจ่ายคิดจากราคาโทเคนตอนขาย" />
        <section className={`${card} overflow-hidden`}>
          {report.shops.length === 0 ? (
            <Empty icon={Store01Icon} title="งานนี้ยังไม่มีร้านค้า" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className={th}>ร้าน</th>
                  <th className={`${th} hidden sm:table-cell ${right}`}>รายการขาย</th>
                  <th className={`${th} ${right}`}>โทเคน</th>
                  <th className={`${th} ${right}`}>ต้องจ่ายร้าน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.shops.map((shop) => (
                  <tr key={shop.id}>
                    <td className={`${tdMain} truncate text-foreground`}>{shop.name}</td>
                    <td className={`${td} hidden text-right text-muted-foreground tabular-nums sm:table-cell`}>{num.format(shop.sales)}</td>
                    <td className={`${td} text-right text-muted-foreground tabular-nums`}>{num.format(shop.tokens)}</td>
                    <td className={`${td} text-right font-medium whitespace-nowrap text-foreground tabular-nums`}>{baht(shop.baht)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border">
                <tr>
                  <td className={`${tdMain} font-medium text-foreground`}>รวม</td>
                  <td className={`${td} hidden sm:table-cell`} />
                  <td className={`${td} text-right text-muted-foreground tabular-nums`}>{num.format(report.tokens.spent)}</td>
                  <td className={`${td} text-right font-medium whitespace-nowrap text-foreground tabular-nums`}>{baht(owed)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Panel icon={Ticket02Icon} title="บัตรแต่ละโซน">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className={th}>โซน</th>
                <th className={`${th} ${right}`}>ขายแล้ว</th>
                <th className={`${th} ${right}`}>รายได้</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report.zones.map((zone) => (
                <tr key={zone.name}>
                  <td className={`${tdMain} truncate text-foreground`}>{zone.name}</td>
                  <td className={`${td} text-right whitespace-nowrap tabular-nums`}>
                    {num.format(zone.sold)} <span className="text-muted-foreground">/ {num.format(zone.capacity)}</span>
                  </td>
                  <td className={`${td} text-right whitespace-nowrap text-muted-foreground tabular-nums`}>{baht(zone.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel icon={Package01Icon} title="สินค้า" subtitle={`ขายแล้ว ${num.format(merchSold)} ชิ้น${report.shipping.orders ? ` · จัดส่ง ${num.format(report.shipping.orders)} คำสั่งซื้อ รอส่ง ${num.format(report.shipping.waiting)}` : ""}`}>
          {report.merch.length === 0 ? (
            <Empty icon={Package01Icon} title="ยังไม่มีการขายสินค้า" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className={th}>สินค้า</th>
                  <th className={`${th} ${right}`}>ขาย</th>
                  <th className={`${th} ${right}`}>รับแล้ว</th>
                  <th className={`${th} ${right}`}>รายได้</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.merch.map((item) => (
                  <tr key={merchLabel(item)}>
                    <td className={`${tdMain} truncate text-foreground`}>
                      {merchLabel(item)}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{num.format(item.sold)}</td>
                    <td className={`${td} text-right text-muted-foreground tabular-nums`}>{num.format(item.pickedUp)}</td>
                    <td className={`${td} text-right whitespace-nowrap text-muted-foreground tabular-nums`}>{baht(item.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel icon={Coins01Icon} title="โทเคน">
          <dl className="divide-y divide-border text-sm">
            {[
              ["ได้จากบัตร", report.tokens.withTickets],
              ["เติมหน้างาน", report.tokens.toppedUp],
              ["ใช้ที่ร้าน", report.tokens.spent],
              ["ทีมงานปรับยอด", report.tokens.adjusted],
              ["คงเหลือในมือลูกค้า", report.tokens.outstanding],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 px-4 py-2.5 sm:px-5">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-foreground tabular-nums">{num.format(Number(value))}</dd>
              </div>
            ))}
          </dl>
          {report.tokens.owing.length > 0 && (
            <div className="border-t border-border px-4 py-3 sm:px-5">
              <p className="text-xs font-medium text-red-600 dark:text-red-400">บัตรที่โทเคนติดลบ (ต้องตามเก็บ) {num.format(report.tokens.owing.length)} ใบ</p>
              <ul className="mt-1.5 space-y-1 text-xs">
                {report.tokens.owing.map((row) => (
                  <li key={row.ticketCode} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate text-foreground">
                      {row.name} <span className="font-mono text-muted-foreground">{row.ticketCode}</span>
                    </span>
                    <span className="shrink-0 text-red-600 tabular-nums dark:text-red-400">{num.format(row.balance)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel icon={Store01Icon} title="รายการขายดี">
          {report.topItems.length === 0 ? (
            <Empty icon={Store01Icon} title="ยังไม่มีการขาย" />
          ) : (
            <ol className="divide-y divide-border text-sm">
              {report.topItems.map((item) => (
                <li key={`${item.shop}-${item.name}`} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                  <span className="min-w-0">
                    <span className="block truncate text-foreground">{item.name}</span>
                    <span className="block truncate text-2xs text-muted-foreground">{item.shop}</span>
                  </span>
                  <span className="shrink-0 text-right text-muted-foreground tabular-nums">
                    {num.format(item.quantity)} ชิ้น · {num.format(item.tokens)} โทเคน
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <SectionTitle icon={Download04Icon} title="ดาวน์โหลด" note="ไฟล์ CSV เปิดใน Excel หรือ Google Sheets" />
        <div className="flex flex-wrap gap-2">
          {DOWNLOADS.map((d) => (
            <a key={d.kind} href={`/admin/reports/csv?event=${eventId}&kind=${d.kind}`} className={pill}>
              <Icon icon={Download04Icon} className="size-4" />
              {d.label}
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
