import type { Metadata } from "next";
import Link from "next/link";
import { Alert02Icon, Download04Icon, PencilEdit02Icon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { LogFilters } from "@/components/admin/log-filters";
import { LogCount, LogList, LogPager, emptyDetail } from "@/components/admin/log-list";
import { BackLink, MiniStat, PageHeader, card, pill } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { adminEventOptions } from "@/lib/admin-events";
import { LOGS_PER_PAGE, isFiltered, listLogs, logActors, logQuery, logStats, readFilters } from "@/lib/audit-log";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { num } from "@/lib/format";

export const metadata: Metadata = { title: "ประวัติการใช้งาน" };


/**
 * ประวัติการใช้งาน: what people changed, newest first, one sentence a row ("สมชาย แก้ไขอีเวนต์ …"), opening to the
 * values before → after. Routine things (scans, sign-ins) stay hidden until asked for. Filter by person, kind, event
 * and time, search inside it all, and take it away as CSV. `?user=` narrows it to one account.
 */
export default async function LogsPage({ searchParams }: PageProps<"/admin/logs">) {
  const { access } = await requirePermission("logs.view", "/admin/logs");
  const params = await searchParams;
  const filters = readFilters(params);
  const page = Math.max(1, Math.min(10_000, Number(params.page) || 1));
  const [{ rows, total }, actors, events, stats] = await Promise.all([listLogs(filters, page), logActors(), adminEventOptions(), logStats()]);
  const member = filters.user ? (actors.find((a) => a.id === filters.user) ?? rows.find((r) => r.actor.id === filters.user)?.actor ?? null) : null;
  // A name goes to the person's page when this account can open it, otherwise to their part of the log
  const actorHref = can(access, "members.manage") ? (id: string) => `/admin/users/${id}` : (id: string) => `/admin/logs${logQuery({ actor: id })}`;
  const statLink = "block rounded-2xl transition-opacity hover:opacity-80";

  return (
    <>
      {filters.user && <BackLink href="/admin/logs">ประวัติทั้งหมด</BackLink>}
      <PageHeader
        eyebrow="Activity log"
        title={filters.user ? `ประวัติของ ${member?.name || member?.email || "บัญชีนี้"}` : "ประวัติการใช้งาน"}
        description={filters.user ? "สิ่งที่บัญชีนี้ทำ และสิ่งที่ทีมงานทำกับบัญชีนี้" : "ใครแก้ไขอะไร เมื่อไร กดที่แต่ละรายการเพื่อดูว่าเปลี่ยนจากอะไรเป็นอะไร"}
      >
        <a href={`/admin/logs/csv${logQuery(filters)}`} className={`${pill} max-sm:flex-1 max-sm:justify-center`}>
          <Icon icon={Download04Icon} className="size-4" />
          ดาวน์โหลด CSV
        </a>
      </PageHeader>

      {!filters.user && !isFiltered(filters) && (
        <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
          <Link href={`/admin/logs${logQuery({ range: "today" })}`} className={statLink}>
            <MiniStat icon={PencilEdit02Icon} label="แก้ไขวันนี้" value={num.format(stats.staffEdits)} />
          </Link>
          <Link href={`/admin/logs${logQuery({ range: "today", all: true })}`} className={statLink}>
            <MiniStat icon={UserMultipleIcon} label="ใช้งานวันนี้" value={`${num.format(stats.people)} คน`} />
          </Link>
          <Link href={`/admin/logs${logQuery({ range: "today", action: "auth.login_failed" })}`} className={statLink}>
            <MiniStat icon={Alert02Icon} label="รหัสผิดวันนี้" value={num.format(stats.failedLogins)} />
          </Link>
        </div>
      )}

      <LogFilters action="/admin/logs" filters={filters} actors={actors} events={events} />

      <section className={`${card} overflow-hidden`}>
        <LogCount total={total} page={page} perPage={LOGS_PER_PAGE} filters={filters} base="/admin/logs" />
        <LogList rows={rows} actorHref={actorHref} technical={access.superAdmin} empty={isFiltered(filters) ? "ไม่พบรายการที่ตรงกับตัวกรอง" : "ยังไม่มีประวัติ"} emptyDetail={emptyDetail(filters)} />
        <LogPager page={page} total={total} perPage={LOGS_PER_PAGE} href={(p) => `/admin/logs${logQuery(filters, p > 1 ? { page: String(p) } : {})}`} />
      </section>
    </>
  );
}
