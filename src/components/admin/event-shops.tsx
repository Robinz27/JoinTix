import Link from "next/link";
import { ArrowRight01Icon, Coins01Icon, Money03Icon, Store01Icon } from "@hugeicons/core-free-icons";
import { Badge, Empty, MiniStat, card, td, tdMain, th } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { listShops } from "@/lib/shops";
import { num } from "@/lib/format";

// One event's ร้านค้า: on /admin/shops with its event picker, and on the event's own ร้านค้า tab


export async function EventShops({ eventId }: { eventId: string }) {
  const shops = await listShops(eventId);
  const tokens = shops.reduce((n, s) => n + s.tokens, 0);
  const baht = shops.reduce((n, s) => n + s.baht, 0);

  return (
    <>
    <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
      <MiniStat icon={Store01Icon} label="ร้าน" value={num.format(shops.length)} />
      <MiniStat icon={Coins01Icon} label="โทเคนที่ขายได้" value={num.format(tokens)} />
      <MiniStat icon={Money03Icon} label="ต้องจ่ายร้าน" value={`฿${num.format(baht)}`} />
    </div>
    <section className={`${card} overflow-hidden`}>
      {shops.length === 0 ? (
        <Empty icon={Store01Icon} title="งานนี้ยังไม่มีร้านค้า" detail="กดเพิ่มร้านเพื่อเริ่ม" />
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className={th}>ร้าน</th>
              <th className={`${th} hidden text-right! sm:table-cell`}>เมนู</th>
              <th className={`${th} hidden text-right! sm:table-cell`}>รายการขาย</th>
              <th className={`${th} text-right!`}>ยอด</th>
              <th className={`${th} w-10`}>
                <span className="sr-only">เปิดร้าน</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shops.map((shop) => (
              <tr key={shop.id} className="group relative cursor-pointer transition-colors hover:bg-secondary/40">
                <td className={tdMain}>
                  <Link href={`/admin/shops/${shop.id}`} className="block truncate font-medium text-foreground after:absolute after:inset-0 group-hover:underline">
                    {shop.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{shop.note}</p>
                  {!shop.active && <Badge>ปิดร้าน</Badge>}
                </td>
                <td className={`${td} hidden text-right text-muted-foreground tabular-nums sm:table-cell`}>{num.format(shop.items)}</td>
                <td className={`${td} hidden text-right text-muted-foreground tabular-nums sm:table-cell`}>{num.format(shop.sales)}</td>
                <td className={`${td} text-right whitespace-nowrap tabular-nums`}>
                  <p className="text-foreground">฿{num.format(shop.baht)}</p>
                  <p className="text-2xs text-muted-foreground">{num.format(shop.tokens)} โทเคน</p>
                </td>
                <td className={`${td} w-10 text-muted-foreground`}>
                  <Icon icon={ArrowRight01Icon} className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
    </>
  );
}
