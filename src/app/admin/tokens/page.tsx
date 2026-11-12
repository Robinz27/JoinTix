import type { Metadata } from "next";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { EventSwitcher } from "@/components/admin/event-switcher";
import { TokenDesk } from "@/components/admin/token-desk";
import { Empty, PageHeader, card } from "@/components/admin/ui";
import { getAdminEvent } from "@/lib/admin-events";
import { doorEvents } from "@/lib/checkins";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "เติมโทเคน" };

export default async function TokensPage({ searchParams }: PageProps<"/admin/tokens">) {
  const { access } = await requirePermission(["tokens.topup", "tokens.adjust"], "/admin/tokens");
  const [events, params] = await Promise.all([doorEvents(), searchParams]);
  const chosen = events.find((e) => e.id === params.event)?.id ?? events[0]?.id ?? null;
  const event = chosen ? await getAdminEvent(chosen) : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Top up"
        title="เติมโทเคน"
        description="สแกน QR บนบัตรของลูกค้า ตรวจยอดโอนในแอปธนาคาร (หรือรับเงินสด) แล้วเติมโทเคนเข้าบัตรใบนั้น ถ่ายรูปสลิปเก็บไว้ได้ เอาไว้เทียบตอนสรุปงาน"
      />
      {event ? (
        <>
          <EventSwitcher events={events} value={event.id} path="/admin/tokens" label="เติมโทเคนของงาน" />
          <TokenDesk key={event.id} eventId={event.id} tokenPrice={event.tokenPrice} canTopUp={can(access, "tokens.topup")} canAdjust={can(access, "tokens.adjust")} />
        </>
      ) : (
        <section className={card}>
          <Empty icon={Calendar03Icon} title="ยังไม่มีอีเวนต์ที่เผยแพร่" />
        </section>
      )}
    </>
  );
}
