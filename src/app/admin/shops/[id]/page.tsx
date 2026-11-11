import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Coins01Icon, CrownIcon, Settings01Icon, ShoppingBasket01Icon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { ShopMenu, ShopSettings, ShopStaff } from "@/components/admin/shop-forms";
import { BackLink, PageHeader, Panel } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { requirePermission } from "@/lib/session";
import { getShop, listShops } from "@/lib/shops";
import { num } from "@/lib/format";

export const metadata: Metadata = { title: "ร้านค้า" };


export default async function ShopPage({ params }: PageProps<"/admin/shops/[id]">) {
  const { id } = await params;
  await requirePermission("shops.manage", `/admin/shops/${id}`);
  const shop = await getShop(id);
  if (!shop) notFound();
  const totals = (await listShops(shop.eventId)).find((s) => s.id === shop.id);

  return (
    <>
      <BackLink href={`/admin/events/${shop.eventId}/shops`}>ร้านค้าของ {shop.eventTitle}</BackLink>
      <PageHeader
        eyebrow="Shop"
        title={shop.name}
        description={`ขายแล้ว ${num.format(totals?.tokens ?? 0)} โทเคน · ต้องจ่ายร้าน ฿${num.format(totals?.baht ?? 0)} · 1 โทเคน = ฿${num.format(shop.tokenPrice)}`}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel icon={ShoppingBasket01Icon} title="เมนู" subtitle="ตั้งจำนวนโทเคนที่ใช้แลกแต่ละรายการ">
          <ShopMenu shopId={shop.id} items={shop.items} tokenPrice={shop.tokenPrice} />
        </Panel>
        <div className="min-w-0 space-y-4">
          <Panel icon={CrownIcon} title="เจ้าของร้าน" subtitle="ดูแลเมนู พนักงาน และดูยอดร้านนี้ได้ที่ “ร้านของฉัน” ไม่ได้เข้าหลังบ้าน">
            <ShopStaff shopId={shop.id} role="owner" staff={shop.staff.filter((member) => member.role === "owner")} />
          </Panel>
          <Panel icon={UserMultipleIcon} title="พนักงาน" subtitle="ขายให้ร้านนี้ได้อย่างเดียว ไม่ต้องมีโรลหลังบ้าน">
            <ShopStaff shopId={shop.id} staff={shop.staff.filter((member) => member.role === "staff")} />
          </Panel>
          <Panel icon={Settings01Icon} title="ตั้งค่าร้าน">
            <ShopSettings shop={shop} sold={totals?.sales ?? 0} />
          </Panel>
          <p className="flex gap-2 px-1 text-2xs text-muted-foreground">
            <Icon icon={Coins01Icon} className="mt-px size-3.5 shrink-0" />
            ยอดที่ต้องจ่ายร้านคิดจากราคาโทเคนตอนขาย เปลี่ยนราคาทีหลังยอดเก่าไม่เปลี่ยน
          </p>
        </div>
      </div>
    </>
  );
}

