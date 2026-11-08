import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert02Icon, Coins01Icon, Login01Icon, ShoppingBag01Icon, Ticket02Icon, Time04Icon, UserIcon, Wallet01Icon, WorkHistoryIcon } from "@hugeicons/core-free-icons";
import { CopyButton } from "@/components/admin/copy-button";
import { LogList } from "@/components/admin/log-list";
import { Fact, Figures, InlineIcon } from "@/components/admin/member-figures";
import { ORDER_STATUS } from "@/components/admin/order-status";
import { Badge, Empty, Panel, pill, td, tdMain, tdTight, th } from "@/components/admin/ui";
import { getMember, memberOrders } from "@/lib/admin-members";
import { listLogs } from "@/lib/audit-log";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "ข้อมูลสมาชิก" };

const num = new Intl.NumberFormat("th-TH");
const baht = (n: number) => `฿${num.format(n)}`;
const stamp = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
const at = (iso: string | null) => (iso ? stamp.format(new Date(iso)) : "—");
const dateOnly = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });

/** ภาพรวม: the figures, the account in full, the latest orders and the latest of what they did */
export default async function MemberOverview({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  const { access } = await requirePermission("members.manage", `/admin/users/${id}`);
  const memberId = decodeURIComponent(id);
  const logs = can(access, "logs.view");
  const [found, orders, recent] = await Promise.all([getMember(memberId), memberOrders(memberId), logs ? listLogs({ user: memberId }, 1, 8) : Promise.resolve(null)]);
  if (!found) notFound();
  const { profile, stats } = found;
  const base = `/admin/users/${profile.id}`;

  return (
    <div className="space-y-4">
      <Figures
        items={[
          { icon: Wallet01Icon, label: "ใช้จ่ายซื้อบัตรรวม", value: baht(stats.spend), hint: `${num.format(stats.paidOrders)} คำสั่งซื้อที่ชำระแล้ว` },
          { icon: Ticket02Icon, label: "บัตรที่มี", value: `${num.format(stats.tickets)} ใบ`, hint: `เข้างานแล้ว ${num.format(stats.checkedIn)} ใบ` },
          {
            icon: Coins01Icon,
            label: "โทเคนคงเหลือ",
            value: num.format(stats.tokens),
            hint: stats.tokenEvents > 1 ? `แยกกัน ${num.format(stats.tokenEvents)} งาน ใช้ข้ามงานไม่ได้` : stats.shopSpend ? `ใช้ที่ร้านไป ${baht(stats.shopSpend)}` : undefined,
          },
          { icon: Time04Icon, label: "ซื้อล่าสุด", value: stats.lastPaid ? dateOnly.format(new Date(stats.lastPaid)) : "ยังไม่เคยซื้อ", hint: stats.openOrders ? `รอชำระ ${num.format(stats.openOrders)} รายการ` : undefined },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel icon={UserIcon} title="ข้อมูลบัญชี">
          <dl className="divide-y divide-border">
            <Fact label="สิทธิ์">{profile.staffRole ? `ทีมงาน · ${profile.staffRole}` : "ลูกค้า (เข้าหลังบ้านไม่ได้)"}</Fact>
            <Fact label="ยืนยันอีเมล">{profile.emailVerified ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน · ต้องยืนยันก่อนซื้อบัตร"}</Fact>
            <Fact label="สมัครเมื่อ">{at(profile.createdAt)}</Fact>
            <Fact label="แก้ไขล่าสุด">{at(profile.updatedAt)}</Fact>
            <Fact label="เข้าสู่ระบบล่าสุด">
              <span className="inline-flex items-center gap-1">
                <InlineIcon icon={Login01Icon} />
                {at(stats.lastLogin)}
              </span>
            </Fact>
            <Fact label="ล็อกอินพลาด 30 วัน">
              {stats.failedLogins30d > 0 ? (
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                  <InlineIcon icon={Alert02Icon} />
                  {num.format(stats.failedLogins30d)} ครั้ง
                </span>
              ) : (
                "ไม่มี"
              )}
            </Fact>
            {access.superAdmin && (
              <Fact label="รหัสบัญชี (เทคนิค)">
                <span className="inline-flex items-center gap-1">
                  <span className="font-mono text-xs break-all text-muted-foreground">{profile.id}</span>
                  <CopyButton value={profile.id} label="คัดลอกรหัสบัญชี" />
                </span>
              </Fact>
            )}
          </dl>
        </Panel>

        <Panel
          icon={ShoppingBag01Icon}
          title="คำสั่งซื้อล่าสุด"
          subtitle={`ทั้งหมด ${num.format(orders.length)} รายการ`}
          action={
            orders.length > 0 && (
              <Link href={`${base}/orders`} className={`${pill} h-8 px-3 text-xs`}>
                ดูทั้งหมด
              </Link>
            )
          }
        >
          {orders.length === 0 ? (
            <Empty icon={ShoppingBag01Icon} title="ยังไม่เคยสั่งซื้อ" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className={th}>อีเวนต์</th>
                  <th className={`${th} hidden sm:table-cell`}>ยอด</th>
                  <th className={th}>สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.slice(0, 6).map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-secondary/40">
                    <td className={tdMain}>
                      <Link href={`${base}/orders#${order.code}`} className="block truncate text-foreground hover:underline">
                        {order.event.title}
                      </Link>
                      <p className="truncate text-2xs text-muted-foreground">
                        {order.code} · {order.zone ? `${order.zone} × ${order.quantity}` : "สินค้าอย่างเดียว"} · {at(order.createdAt)}
                        <span className="sm:hidden"> · {baht(order.total)}</span>
                      </p>
                    </td>
                    <td className={`${td} hidden whitespace-nowrap tabular-nums sm:table-cell`}>{baht(order.total)}</td>
                    <td className={tdTight}>
                      <Badge tone={ORDER_STATUS[order.status].tone}>{ORDER_STATUS[order.status].label}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {recent && (
        <Panel
          icon={WorkHistoryIcon}
          title="ความเคลื่อนไหวล่าสุด"
          subtitle="สิ่งที่บัญชีนี้ทำ และสิ่งที่ทีมงานทำกับบัญชีนี้"
          action={
            recent.total > recent.rows.length && (
              <Link href={`${base}/logs`} className={`${pill} h-8 px-3 text-xs`}>
                ดูทั้งหมด ({num.format(recent.total)})
              </Link>
            )
          }
        >
          <LogList rows={recent.rows} technical={access.superAdmin} empty="ยังไม่มีการแก้ไขข้อมูล" emptyDetail="การสแกนบัตรและการเข้าสู่ระบบดูได้ที่แท็บประวัติ" />
        </Panel>
      )}
    </div>
  );
}
