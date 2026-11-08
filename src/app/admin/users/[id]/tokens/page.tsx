import type { Metadata } from "next";
import Link from "next/link";
import { Coins01Icon } from "@hugeicons/core-free-icons";
import { TOKEN_REASONS } from "@/components/admin/order-status";
import { Empty, Panel, td, tdMain, tdTight, th } from "@/components/admin/ui";
import { memberTokens } from "@/lib/admin-members";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "โทเคนของสมาชิก" };

const num = new Intl.NumberFormat("th-TH");
const signed = (n: number) => `${n > 0 ? "+" : ""}${num.format(n)}`;
const stamp = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Bangkok" });

/** Tokens: the balance at each event, where it came from and went, then every movement */
export default async function MemberTokensPage({ params }: PageProps<"/admin/users/[id]/tokens">) {
  const { id } = await params;
  await requirePermission("members.manage", `/admin/users/${id}/tokens`);
  const { events, rows } = await memberTokens(decodeURIComponent(id));

  return (
    <div className="space-y-4">
      <Panel icon={Coins01Icon} title="โทเคนแต่ละงาน" subtitle="โทเคนใช้ได้เฉพาะงานที่ได้มา">
        {events.length === 0 ? (
          <Empty icon={Coins01Icon} title="ยังไม่มีโทเคน" />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className={th}>งาน</th>
                <th className={`${th} hidden text-right sm:table-cell`}>ได้จากบัตร</th>
                <th className={`${th} hidden text-right sm:table-cell`}>เติม</th>
                <th className={`${th} hidden text-right md:table-cell`}>ใช้ที่ร้าน</th>
                <th className={`${th} text-right`}>คงเหลือ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((e) => (
                <tr key={e.eventId}>
                  <td className={tdMain}>
                    <Link href={`/admin/events/${e.eventId}`} className="block truncate text-foreground hover:underline">
                      {e.title}
                    </Link>
                    <p className="truncate text-2xs text-muted-foreground sm:hidden">
                      บัตร {num.format(e.earned)} · เติม {num.format(e.toppedUp)} · ใช้ {num.format(e.spent)}
                    </p>
                  </td>
                  <td className={`${td} hidden text-right tabular-nums sm:table-cell`}>{num.format(e.earned)}</td>
                  <td className={`${td} hidden text-right tabular-nums sm:table-cell`}>{num.format(e.toppedUp)}</td>
                  <td className={`${td} hidden text-right tabular-nums md:table-cell`}>{num.format(e.spent)}</td>
                  <td className={`${tdTight} text-right font-semibold tabular-nums`}>{num.format(e.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="ความเคลื่อนไหวของโทเคน" subtitle={`${num.format(rows.length)} รายการล่าสุด`}>
        {rows.length === 0 ? (
          <Empty icon={Coins01Icon} title="ยังไม่มีรายการ" />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className={th}>รายการ</th>
                <th className={`${th} hidden md:table-cell`}>โดย</th>
                <th className={`${th} text-right`}>โทเคน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={tdMain}>
                    <p className="truncate text-foreground">
                      {TOKEN_REASONS[r.reason] ?? r.reason}
                      {r.shop && <span className="text-muted-foreground"> · {r.shop}</span>}
                    </p>
                    <p className="truncate text-2xs text-muted-foreground">
                      {stamp.format(new Date(r.at))} · {r.event.title}
                      {r.baht !== 0 && ` · เงินสด ฿${num.format(r.baht)}`}
                    </p>
                    {r.items && <p className="truncate text-2xs text-muted-foreground">{r.items}</p>}
                    {r.by && <p className="truncate text-2xs text-muted-foreground md:hidden">โดย {r.by}</p>}
                  </td>
                  <td className={`${td} hidden text-xs whitespace-nowrap text-muted-foreground md:table-cell`}>{r.by ?? "ระบบ"}</td>
                  <td className={`${tdTight} text-right font-medium tabular-nums ${r.amount > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}>{signed(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
