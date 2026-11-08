import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight01Icon, Store01Icon } from "@hugeicons/core-free-icons";
import { Badge, Empty, card } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { ProfileSkeleton } from "@/components/skeletons";
import { getSession } from "@/lib/session";
import { myShops } from "@/lib/shops";

// ร้านของฉัน: where a shop's owner and staff work, on the storefront side. It has nothing to do with หลังบ้าน: any
// account named on a shop lands here, with no role there.

export const metadata: Metadata = { title: "ร้านของฉัน", robots: { index: false } };

const dateFormat = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });

export default function MyShopsPage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <MyShops />
    </Suspense>
  );
}

async function MyShops() {
  const session = await getSession();
  if (!session) redirect("/login?next=/shop");
  const shops = await myShops(session.user.id);

  return (
    <main className="flex flex-1 justify-center px-3 pt-8 pb-16 sm:pt-10">
      <div className="w-full min-w-0 max-w-2xl space-y-4">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">ร้านของฉัน</h1>
          <p className="text-sm text-muted-foreground">ร้านในงานที่คุณเป็นเจ้าของหรือเป็นพนักงาน</p>
        </header>

        {shops.length === 0 ? (
          <section className={card}>
            <Empty icon={Store01Icon} title="ยังไม่มีร้าน" detail="ให้ผู้จัดงานหรือเจ้าของร้านเพิ่มคุณด้วยอีเมลของบัญชีนี้" />
          </section>
        ) : (
          <ul className="space-y-2">
            {shops.map((shop) => (
              <li key={shop.id}>
                <Link href={shop.role === "owner" ? `/shop/${shop.id}` : `/shop/${shop.id}/till`} className={`${card} group flex items-center gap-3 p-4 transition-colors hover:border-muted-foreground/50`}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-secondary text-muted-foreground">
                    <Icon icon={Store01Icon} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{shop.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {shop.eventTitle} · {dateFormat.format(new Date(shop.startsAt))}
                    </span>
                  </span>
                  {!shop.active && <Badge>ปิดร้าน</Badge>}
                  <Badge tone={shop.role === "owner" ? "strong" : "muted"}>{shop.role === "owner" ? "เจ้าของร้าน" : "พนักงาน"}</Badge>
                  <Icon icon={ArrowRight01Icon} className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
