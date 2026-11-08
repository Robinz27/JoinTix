import type { Metadata } from "next";
import { Store01Icon } from "@hugeicons/core-free-icons";
import { Till } from "@/components/admin/till";
import { Empty, PageHeader, card } from "@/components/admin/ui";
import { requirePermission } from "@/lib/session";
import { tillShops } from "@/lib/shops";

export const metadata: Metadata = { title: "ขายที่ร้าน" };

export default async function TillPage() {
  const { user, access } = await requirePermission(["shops.sell", "shops.manage"], "/admin/till");
  const shops = await tillShops(access, user.id);
  return (
    <>
      <PageHeader eyebrow="Till" title="ขายที่ร้าน" description="เลือกรายการ สแกน QR บนบัตรของลูกค้า แล้วตัดโทเคน" />
      {shops.length > 0 ? (
        <Till shops={shops} />
      ) : (
        <section className={card}>
          <Empty icon={Store01Icon} title="ยังไม่มีร้านที่คุณขายได้" detail="ให้ผู้ดูแลเพิ่มคุณเป็นพนักงานของร้าน และเปิดร้านในงานที่เผยแพร่แล้ว" />
        </section>
      )}
    </>
  );
}
