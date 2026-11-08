import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft01Icon, Store01Icon } from "@hugeicons/core-free-icons";
import { Till } from "@/components/admin/till";
import { Empty, card } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { ProfileSkeleton } from "@/components/skeletons";
import { getSession } from "@/lib/session";
import { shopRole, tillShops } from "@/lib/shops";

export const metadata: Metadata = { title: "ขายที่ร้าน", robots: { index: false } };

/** The till, for a shop's own owner and staff */
export default function ShopTillPage({ params }: PageProps<"/shop/[id]/till">) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ShopTill params={params} />
    </Suspense>
  );
}

async function ShopTill({ params }: Pick<PageProps<"/shop/[id]/till">, "params">) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/shop/${id}/till`);
  const role = await shopRole(session.user.id, id);
  if (!role) notFound();
  const shop = (await tillShops(null, session.user.id)).find((s) => s.id === id);

  return (
    <main className="flex flex-1 justify-center px-3 pt-8 pb-16 sm:pt-10">
      <div className="w-full min-w-0 max-w-5xl space-y-4">
        <Link href={role === "owner" ? `/shop/${id}` : "/shop"} className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <Icon icon={ArrowLeft01Icon} className="size-3.5" />
          {role === "owner" ? "จัดการร้าน" : "ร้านของฉัน"}
        </Link>
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">ขายที่ร้าน</h1>
          <p className="text-sm text-muted-foreground">เลือกรายการ สแกน QR บนบัตรของลูกค้า แล้วตัดโทเคน</p>
        </header>
        {shop ? (
          <Till shops={[shop]} />
        ) : (
          <section className={card}>
            <Empty icon={Store01Icon} title="ร้านนี้ยังขายไม่ได้" detail="ร้านอาจปิดอยู่ หรืออีเวนต์ยังไม่เผยแพร่ ติดต่อผู้จัดงาน" />
          </section>
        )}
      </div>
    </main>
  );
}
