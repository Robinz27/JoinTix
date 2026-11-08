import Link from "next/link";
import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { Alert02Icon, CheckmarkBadge01Icon, Mail01Icon, SmartPhone01Icon } from "@hugeicons/core-free-icons";
import { CopyButton } from "@/components/admin/copy-button";
import { MemberActions } from "@/components/admin/member-actions";
import { MemberTabs } from "@/components/admin/member-tabs";
import { BackLink, Badge, Initials, card } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { getDb } from "@/db";
import { adminRoles } from "@/db/schema";
import { getMember } from "@/lib/admin-members";
import { logQuery } from "@/lib/audit-actions";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";

// One member's page in หลังบ้าน, the 4TUNEZ customer card made a page of its own: who they are, how to reach them
// (copy the email, tap the number to call), anything that needs attention, the two things you'd do to the account,
// then a tab for each part of what they've done.

const joined = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });

export default async function MemberLayout({ children, params }: LayoutProps<"/admin/users/[id]">) {
  const { id } = await params;
  const { user: me, access } = await requirePermission("members.manage", `/admin/users/${id}`);
  const found = await getMember(decodeURIComponent(id));
  if (!found) notFound();
  const { profile, stats } = found;
  const roles = access.superAdmin ? await getDb().select({ id: adminRoles.id, name: adminRoles.name }).from(adminRoles).orderBy(asc(adminRoles.createdAt)) : undefined;
  const self = profile.id === me.id;
  const logs = can(access, "logs.view");

  return (
    <>
      <BackLink href="/admin/users">สมาชิกทั้งหมด</BackLink>
      <header className={`${card} mb-5 p-4 sm:p-5`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-3.5 sm:gap-4">
            <Initials name={profile.name} className="size-12 text-base max-[319px]:hidden sm:size-14" />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {profile.name}
                {self && <span className="text-base font-normal text-muted-foreground"> (คุณ)</span>}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {profile.staffRole ? <Badge tone="strong">{profile.staffRole}</Badge> : <Badge>ลูกค้า</Badge>}
                {profile.emailVerified ? (
                  <Badge tone="good">
                    <Icon icon={CheckmarkBadge01Icon} className="mr-1 size-3" />
                    ยืนยันอีเมลแล้ว
                  </Badge>
                ) : (
                  <Badge tone="warn">ยังไม่ยืนยันอีเมล · ซื้อบัตรไม่ได้</Badge>
                )}
              </div>
              <div className="mt-2.5 flex flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-foreground">
                  <Icon icon={Mail01Icon} className="size-4 shrink-0 text-muted-foreground" />
                  <a href={`mailto:${profile.email}`} className="truncate hover:underline">
                    {profile.email}
                  </a>
                  <CopyButton value={profile.email} label="คัดลอกอีเมล" />
                </span>
                <span className="inline-flex items-center gap-1.5 text-foreground">
                  <Icon icon={SmartPhone01Icon} className="size-4 shrink-0 text-muted-foreground" />
                  <a href={`tel:${profile.phone}`} className="tabular-nums hover:underline">
                    {profile.phone}
                  </a>
                  <CopyButton value={profile.phone} label="คัดลอกเบอร์โทร" />
                </span>
                {profile.cohort && <span className="text-muted-foreground">รุ่น {profile.cohort}</span>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">สมาชิกตั้งแต่ {joined.format(new Date(profile.createdAt))}</p>
            </div>
          </div>
          <div className="border-t border-border pt-3 lg:border-0 lg:pt-0">
            <MemberActions member={{ ...profile }} self={self} roles={roles} locked={!access.superAdmin && Boolean(profile.staffRole)} detail />
          </div>
        </div>

        {/* Something someone looking after this account should know, said where it can't be missed */}
        {stats.failedLogins30d >= 3 && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-800 dark:text-amber-200">
            <Icon icon={Alert02Icon} className="mt-0.5 size-4 shrink-0" />
            <span>
              มีคนพยายามเข้าบัญชีนี้ด้วยรหัสผ่านผิด {stats.failedLogins30d.toLocaleString("th-TH")} ครั้งใน 30 วันที่ผ่านมา
              {logs && (
                <>
                  {" "}
                  <Link href={`/admin/users/${profile.id}/logs${logQuery({ action: "auth.login_failed" })}`} className="font-medium underline underline-offset-2">
                    ดูรายละเอียด
                  </Link>
                </>
              )}
            </span>
          </p>
        )}
      </header>
      <MemberTabs memberId={profile.id} logs={logs} counts={{ orders: stats.orders, tokens: stats.tokenEvents, shops: stats.shops, devices: stats.devices }} />
      {children}
    </>
  );
}
