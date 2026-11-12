import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft01Icon, Coins01Icon, CrownIcon, Money03Icon, ShoppingBasket01Icon, Store01Icon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { ShopMenu, ShopStaff } from "@/components/admin/shop-forms";
import { Badge, MiniStat, Panel, pillPrimary } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { ProfileSkeleton } from "@/components/skeletons";
import { getSession } from "@/lib/session";
import { getShop, listShops, shopRole } from "@/lib/shops";
import { num } from "@/lib/format";

// One shop for its owner: what it has earned, how many tokens each item takes (the one thing an owner changes),
// and who works there (set by หลังบ้าน). Staff go straight to the till.

export const metadata: Metadata = { title: "ร้านของฉัน", robots: { index: false } };


export default function MyShopPage({ params }: PageProps<"/shop/[id]">) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <MyShop params={params} />
    </Suspense>
  );
}

async function MyShop({ params }: Pick<PageProps<"/shop/[id]">, "params">) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/shop/${id}`);
  const role = await shopRole(session.user.id, id);
  if (!role) notFound();
  if (role === "staff") redirect(`/shop/${id}/till`);
  const shop = await getShop(id);
  if (!shop) notFound();
  const totals = (await listShops(shop.eventId)).find((s) => s.id === shop.id);

  return (
    <main className="flex flex-1 justify-center px-3 pt-8 pb-16 sm:pt-10">
      <div className="w-full min-w-0 max-w-4xl space-y-4">
        <Link href="/shop" className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <Icon icon={ArrowLeft01Icon} className="size-3.5" />
          ร้านของฉัน
        </Link>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{shop.name}</h1>
            <p className="text-sm text-muted-foreground">{shop.eventTitle}</p>
          </div>
          {shop.active ? (
            <Link href={`/shop/${shop.id}/till`} className={pillPrimary}>
              <Icon icon={ShoppingBasket01Icon} className="size-4" />
              เปิดหน้าขาย
            </Link>
          ) : (
            <Badge>ปิดร้าน</Badge>
          )}
        </header>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <MiniStat icon={Store01Icon} label="รายการขาย" value={num.format(totals?.sales ?? 0)} />
          <MiniStat icon={Coins01Icon} label="โทเคนที่ขายได้" value={num.format(totals?.tokens ?? 0)} />
          <MiniStat icon={Money03Icon} label="ยอดที่จะได้รับ" value={`฿${num.format(totals?.baht ?? 0)}`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Panel icon={ShoppingBasket01Icon} title="เมนู" subtitle="ตั้งจำนวนโทเคนที่ตัดต่อการสแกนหนึ่งครั้ง">
            <ShopMenu shopId={shop.id} items={shop.items} tokenPrice={shop.tokenPrice} ownerView />
          </Panel>
          <div className="min-w-0 space-y-4">
            <Panel icon={UserMultipleIcon} title="พนักงาน" subtitle="เพิ่มหรือเอาออกได้ที่ผู้จัดงาน">
              <ShopStaff shopId={shop.id} readOnly staff={shop.staff.filter((member) => member.role === "staff")} />
            </Panel>
            <Panel icon={CrownIcon} title="เจ้าของร้าน" subtitle="เพิ่มหรือเอาออกได้ที่ผู้จัดงาน">
              <ShopStaff shopId={shop.id} role="owner" readOnly staff={shop.staff.filter((member) => member.role === "owner")} />
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}
