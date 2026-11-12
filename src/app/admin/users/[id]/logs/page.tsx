import type { Metadata } from "next";
import { Download04Icon } from "@hugeicons/core-free-icons";
import { LogFilters } from "@/components/admin/log-filters";
import { LogCount, LogList, LogPager, emptyDetail } from "@/components/admin/log-list";
import { card, pill } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { adminEventOptions } from "@/lib/admin-events";
import { LOGS_PER_PAGE, isFiltered, listLogs, logActors, logQuery, readFilters } from "@/lib/audit-log";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "ประวัติของสมาชิก" };

/** ประวัติ: what this account did and what staff did to it, with the same filters as /admin/logs */
export default async function MemberLogsPage({ params, searchParams }: PageProps<"/admin/users/[id]/logs">) {
  const { id } = await params;
  const { access } = await requirePermission("logs.view", `/admin/users/${id}/logs`);
  const memberId = decodeURIComponent(id);
  const query = await searchParams;
  const filters = { ...readFilters(query), user: memberId };
  const page = Math.max(1, Math.min(10_000, Number(query.page) || 1));
  const [{ rows, total }, actors, events] = await Promise.all([listLogs(filters, page), logActors(), adminEventOptions()]);
  const base = `/admin/users/${memberId}/logs`;
  const own = { ...filters, user: undefined };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <a href={`/admin/logs/csv${logQuery(filters)}`} className={`${pill} max-sm:flex-1 max-sm:justify-center`}>
          <Icon icon={Download04Icon} className="size-4" />
          ดาวน์โหลด CSV
        </a>
      </div>
      <LogFilters action={base} filters={own} actors={actors} events={events} />
      <section className={`${card} overflow-hidden`}>
        <LogCount total={total} page={page} perPage={LOGS_PER_PAGE} filters={own} base={base} />
        <LogList
          rows={rows}
          technical={access.superAdmin}
          actorHref={(actor) => `/admin/users/${actor}`}
          empty={isFiltered(own) ? "ไม่พบรายการที่ตรงกับตัวกรอง" : "ยังไม่มีประวัติของบัญชีนี้"}
          emptyDetail={emptyDetail(own)}
        />
        <LogPager page={page} total={total} perPage={LOGS_PER_PAGE} href={(p) => `${base}${logQuery(own, p > 1 ? { page: String(p) } : {})}`} />
      </section>
    </>
  );
}
