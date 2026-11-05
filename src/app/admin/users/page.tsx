import type { Metadata } from "next";
import { count, desc, ilike, or, sql } from "drizzle-orm";
import { CheckmarkBadge01Icon, Search01Icon, ShieldUserIcon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { MemberActions } from "@/components/admin/member-actions";
import { Badge, Empty, Initials, MiniStat, PageHeader, card, input, td, tdMain, tdTight, th } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { isSuperAdmin, requireSuperAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "สมาชิก" };

/** Rows shown at once; search narrows it down */
const LIMIT = 200;
const num = new Intl.NumberFormat("th-TH");
const dateFormat = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });

export default async function AdminUsers({ searchParams }: PageProps<"/admin/users">) {
  const { user: me } = await requireSuperAdmin("/admin/users");
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  // Escaped, so a % or _ typed in the box matches itself
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;

  const db = getDb();
  const [members, [totals]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(query ? or(ilike(user.name, pattern), ilike(user.email, pattern), ilike(user.phone, pattern)) : undefined)
      .orderBy(desc(user.createdAt))
      .limit(LIMIT),
    db
      .select({
        total: count(),
        verified: sql<number>`count(*) filter (where ${user.emailVerified})`.mapWith(Number),
        admins: sql<number>`count(*) filter (where ${user.role} = 'super_admin')`.mapWith(Number),
      })
      .from(user),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Members"
        title="สมาชิก"
        description={query ? `${members.length}${members.length === LIMIT ? "+" : ""} บัญชีที่ตรงกับ “${query}”` : "บัญชีทั้งหมด เรียงจากสมัครล่าสุด"}
      >
        <form role="search" className="relative w-full sm:w-72">
          <Icon icon={Search01Icon} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input name="q" defaultValue={query} placeholder="ค้นหาชื่อ อีเมล เบอร์โทร" aria-label="ค้นหาสมาชิก" className={`${input} pl-9`} />
        </form>
      </PageHeader>

      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        <MiniStat icon={UserMultipleIcon} label="ทั้งหมด" value={num.format(totals.total)} />
        <MiniStat icon={CheckmarkBadge01Icon} label="ยืนยันอีเมล" value={num.format(totals.verified)} />
        <MiniStat icon={ShieldUserIcon} label="Super admin" value={num.format(totals.admins)} />
      </div>

      <section className={`${card} overflow-hidden`}>
        {members.length === 0 ? (
          <Empty icon={UserMultipleIcon} title="ไม่พบสมาชิก" detail={query ? "ลองค้นด้วยคำอื่น" : undefined} />
        ) : (
          // Columns drop away as the screen narrows, so a phone reads the list without scrolling sideways
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className={th}>สมาชิก</th>
                <th className={`${th} hidden md:table-cell`}>เบอร์โทร</th>
                <th className={`${th} hidden sm:table-cell`}>อีเมล</th>
                <th className={`${th} hidden lg:table-cell`}>สมัครเมื่อ</th>
                <th className={`${th} hidden sm:table-cell`}>สิทธิ์</th>
                <th className={`${th} text-right`}>
                  <span className="sr-only">จัดการ</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((member) => {
                const admin = isSuperAdmin(member);
                const self = member.id === me.id;
                return (
                  <tr key={member.id} className="transition-colors hover:bg-secondary/40">
                    <td className={tdMain}>
                      <div className="flex min-w-0 items-center gap-3">
                        <Initials name={member.name} className="size-9 max-[359px]:hidden" />
                        <div className="min-w-0">
                          <p className="truncate text-foreground">
                            {member.name}
                            {self && <span className="text-muted-foreground"> (คุณ)</span>}
                          </p>
                          {/* The role column is hidden on a phone; an admin still stands out */}
                          {admin && (
                            <span className="sm:hidden">
                              <Badge tone="strong">Super admin</Badge>
                            </span>
                          )}
                          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                          {/* What the hidden columns say, on a phone */}
                          <p className="mt-0.5 truncate text-2xs text-muted-foreground tabular-nums md:hidden">
                            {member.phone}
                            <span className="sm:hidden"> · {member.emailVerified ? "ยืนยันอีเมลแล้ว" : "ยังไม่ยืนยันอีเมล"}</span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={`${td} hidden text-muted-foreground tabular-nums md:table-cell`}>{member.phone}</td>
                    <td className={`${td} hidden sm:table-cell`}>
                      {member.emailVerified ? <Badge tone="good">ยืนยันแล้ว</Badge> : <Badge>ยังไม่ยืนยัน</Badge>}
                    </td>
                    <td className={`${td} hidden text-muted-foreground tabular-nums lg:table-cell`}>{dateFormat.format(member.createdAt)}</td>
                    <td className={`${td} hidden sm:table-cell`}>
                      {admin ? <Badge tone="strong">Super admin</Badge> : <Badge>สมาชิก</Badge>}
                    </td>
                    <td className={`${tdTight} text-right`}>
                      <MemberActions
                        member={{
                          id: member.id,
                          name: member.name,
                          email: member.email,
                          phone: member.phone,
                          role: member.role,
                          emailVerified: member.emailVerified,
                          createdAt: member.createdAt.toISOString(),
                        }}
                        self={self}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
