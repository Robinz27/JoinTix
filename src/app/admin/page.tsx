import type { Metadata } from "next";
import Link from "next/link";
import { count, desc, sql } from "drizzle-orm";
import {
  ArrowRight01Icon,
  Calendar03Icon,
  CheckmarkBadge01Icon,
  ShieldUserIcon,
  Ticket02Icon,
  UserAdd01Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { navFor } from "@/components/admin/admin-nav";
import { Badge, Empty, Initials, PageHeader, Panel, SectionTitle, StatCard, card, tile } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { listAdminEvents } from "@/lib/admin-events";
import { can } from "@/lib/permissions";
import { requireStaff } from "@/lib/session";
import { num } from "@/lib/format";

export const metadata: Metadata = { title: "ภาพรวม" };

const dateFormat = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });

export default async function AdminOverview() {
  const { user: me, access } = await requireStaff();
  // Member and sales figures are for those who may see reports; everyone else gets their own menu here
  if (!can(access, "reports.view")) {
    const links = navFor(access).flatMap((group) => group.links).filter((link) => link.href !== "/admin");
    return (
      <>
        <PageHeader eyebrow="Dashboard" title={`สวัสดี ${me.name}`} description={`โรลของคุณ: ${access.roleName}`} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={`${card} flex items-center gap-3 p-4 transition-colors hover:bg-secondary/60`}>
              <span className={`${tile} size-10`}>
                <Icon icon={link.icon} className="size-5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{link.label}</span>
              <Icon icon={ArrowRight01Icon} className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </>
    );
  }

  const db = getDb();
  const [[stats], recent, events] = await Promise.all([
    db
      .select({
        total: count(),
        verified: sql<number>`count(*) filter (where ${user.emailVerified})`.mapWith(Number),
        lastWeek: sql<number>`count(*) filter (where ${user.createdAt} > now() - interval '7 days')`.mapWith(Number),
        admins: sql<number>`count(*) filter (where ${user.role} = 'super_admin')`.mapWith(Number),
      })
      .from(user),
    db
      .select({ id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt })
      .from(user)
      .orderBy(desc(user.createdAt))
      .limit(6),
    listAdminEvents(),
  ]);
  const live = events.filter((e) => e.status === "published");
  const onSale = live.filter((e) => e.sale === "on-sale" || e.sale === "selling-fast").length;
  const comingSoon = live.filter((e) => e.sale === "coming-soon").length;
  const sold = events.reduce((n, e) => n + e.sold, 0);
  const revenue = events.reduce((n, e) => n + e.revenue, 0);

  return (
    <>
      <PageHeader eyebrow="Dashboard" title={`สวัสดี ${me.name}`} description="สรุปสมาชิกและอีเวนต์ของ JoinTix" />

      <SectionTitle icon={UserMultipleIcon} title="สมาชิก" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard featured icon={UserMultipleIcon} title="สมาชิกทั้งหมด" value={num.format(stats.total)} hint="บัญชีที่สมัครไว้" />
        <StatCard
          icon={CheckmarkBadge01Icon}
          title="ยืนยันอีเมลแล้ว"
          value={num.format(stats.verified)}
          hint={stats.total ? `${Math.round((stats.verified / stats.total) * 100)}% ซื้อบัตรได้ทันที` : undefined}
        />
        <StatCard icon={UserAdd01Icon} title="สมัครใน 7 วัน" value={num.format(stats.lastWeek)} />
        <StatCard icon={ShieldUserIcon} title="Super admin" value={num.format(stats.admins)} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          icon={UserAdd01Icon}
          title="สมัครล่าสุด"
          subtitle="6 บัญชีล่าสุด"
          action={
            <Link href="/admin/users" className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground">
              ดูทั้งหมด
              <Icon icon={ArrowRight01Icon} className="size-3.5" />
            </Link>
          }
        >
          {recent.length === 0 ? (
            <Empty icon={UserMultipleIcon} title="ยังไม่มีสมาชิก" />
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((member) => (
                <li key={member.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <Initials name={member.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{member.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  {member.emailVerified && <Badge tone="good">ยืนยันแล้ว</Badge>}
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums max-[379px]:hidden">{dateFormat.format(member.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          icon={Calendar03Icon}
          title="อีเวนต์"
          subtitle={`ขายแล้ว ${num.format(sold)} ใบ · ฿${num.format(revenue)}`}
          action={
            <Link href="/admin/events" className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground">
              ดูทั้งหมด
              <Icon icon={ArrowRight01Icon} className="size-3.5" />
            </Link>
          }
        >
          <dl className="grid grid-cols-3 divide-x divide-border border-b border-border text-center">
            {[
              ["ทั้งหมด", events.length],
              ["เปิดขาย", onSale],
              ["รอเปิดขาย", comingSoon],
            ].map(([label, value]) => (
              <div key={label} className="px-2 py-4">
                <dt className="text-2xs text-muted-foreground sm:text-xs">{label}</dt>
                <dd className="mt-1 text-xl font-semibold text-foreground tabular-nums">{num.format(Number(value))}</dd>
              </div>
            ))}
          </dl>
          <Link href="/admin/reports" className="flex items-center gap-2 px-4 py-3.5 text-xs text-muted-foreground hover:text-foreground sm:px-5">
            <Icon icon={Ticket02Icon} className="size-4 shrink-0" />
            ดูยอดขาย ค่าใช้จ่ายร้านค้า และโทเคนแยกตามงานในหน้ารายงาน
          </Link>
        </Panel>
      </div>
    </>
  );
}
