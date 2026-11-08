import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download04Icon } from "@hugeicons/core-free-icons";
import { LogFilters } from "@/components/admin/log-filters";
import { LogCount, LogList, LogPager, emptyDetail } from "@/components/admin/log-list";
import { card, pill } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { getAdminEvent } from "@/lib/admin-events";
import { LOGS_PER_PAGE, isFiltered, listLogs, logActors, logQuery, readFilters } from "@/lib/audit-log";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "ประวัติอีเวนต์" };

/** The ประวัติ tab: everything done about this event, its tickets, merchandise, shops, orders and door */
export default async function EventLogsPage({ params, searchParams }: PageProps<"/admin/events/[id]/logs">) {
  const { id } = await params;
  const { access } = await requirePermission("logs.view", `/admin/events/${id}/logs`);
  const [event, query] = await Promise.all([getAdminEvent(id), searchParams]);
  if (!event) notFound();
  const filters = { ...readFilters(query), eventId: event.id };
  const page = Math.max(1, Math.min(10_000, Number(query.page) || 1));
  const [{ rows, total }, actors] = await Promise.all([listLogs(filters, page), logActors()]);
  const base = `/admin/events/${event.id}/logs`;
  const own = { ...filters, eventId: undefined };
  const actorHref = can(access, "members.manage") ? (actor: string) => `/admin/users/${actor}` : (actor: string) => `/admin/logs${logQuery({ actor })}`;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <a href={`/admin/logs/csv${logQuery(filters)}`} className={`${pill} max-sm:flex-1 max-sm:justify-center`}>
          <Icon icon={Download04Icon} className="size-4" />
          ดาวน์โหลด CSV
        </a>
      </div>
      <LogFilters action={base} filters={own} actors={actors} events={[]} hideEvent />
      <section className={`${card} overflow-hidden`}>
        <LogCount total={total} page={page} perPage={LOGS_PER_PAGE} filters={own} base={base} />
        <LogList
          rows={rows}
          showEvent={false}
          technical={access.superAdmin}
          actorHref={actorHref}
          empty={isFiltered(own) ? "ไม่พบรายการที่ตรงกับตัวกรอง" : "ยังไม่มีประวัติของงานนี้"}
          emptyDetail={emptyDetail(own)}
        />
        <LogPager page={page} total={total} perPage={LOGS_PER_PAGE} href={(p) => `${base}${logQuery(own, p > 1 ? { page: String(p) } : {})}`} />
      </section>
    </>
  );
}
