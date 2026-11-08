import type { Metadata } from "next";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { PhoneSlipUpload } from "@/components/checkout-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { slipLink } from "@/lib/payments";

// What the buyer's phone opens after scanning the QR on the checkout page (lib/payments.ts). No sign-in: the link
// is the permission, it lasts ten minutes and works for one order.

export const metadata: Metadata = { title: "แนบสลิปโอนเงิน", robots: { index: false } };

export default function PhoneSlipPage({ params }: PageProps<"/pay/[token]">) {
  return (
    <main className="flex flex-1 justify-center px-3 pt-8 pb-16">
      <div className="w-full min-w-0 max-w-md">
        <Suspense fallback={<Skeleton className="h-72 w-full rounded-2xl" />}>
          <Upload params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Upload({ params }: Pick<PageProps<"/pay/[token]">, "params">) {
  await connection();
  const { token } = await params;
  const link = slipLink(token);
  const [order] = link ? await getDb().select({ total: orders.total, status: orders.status }).from(orders).where(eq(orders.id, link.orderId)).limit(1) : [];
  return <PhoneSlipUpload token={token} total={order?.total ?? null} open={Boolean(link && order?.status === "pending")} />;
}
