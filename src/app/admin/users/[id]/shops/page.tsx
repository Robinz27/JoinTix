import type { Metadata } from "next";
import Link from "next/link";
import { Store01Icon } from "@hugeicons/core-free-icons";
import { Badge, Empty, Panel, td, tdMain, tdTight, th } from "@/components/admin/ui";
import { memberShops } from "@/lib/admin-members";
import { requirePermission } from "@/lib/session";
import { num } from "@/lib/format";

export const metadata: Metadata = { title: "ร้านค้าของสมาชิก" };


/** The shops this account works at (owner or staff, nothing to do with หลังบ้าน roles), and what they sold there */
export default async function MemberShopsPage({ params }: PageProps<"/admin/users/[id]/shops">) {
  const { id } = await params;
  await requirePermission("members.manage", `/admin/users/${id}/shops`);
  const shops = await memberShops(decodeURIComponent(id));

  return (
    <Panel icon={Store01Icon} title="ร้านที่เป็นเจ้าของหรือพนักงาน" subtitle="ยอดขายนับเฉพาะรายการที่บัญชีนี้เป็นคนขาย">
      {shops.length === 0 ? (
        <Empty icon={Store01Icon} title="ไม่ได้อยู่ในร้านไหน" detail="เพิ่มคนของร้านได้ที่หน้าร้านค้าของแต่ละงาน" />
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className={th}>ร้าน</th>
              <th className={`${th} hidden text-right sm:table-cell`}>ขายไป</th>
              <th className={th}>หน้าที่</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shops.map((shop) => (
              <tr key={shop.id}>
                <td className={tdMain}>
                  <Link href={`/admin/shops/${shop.id}`} className="block truncate text-foreground hover:underline">
                    {shop.name}
                    {!shop.active && <span className="text-muted-foreground"> (ปิดอยู่)</span>}
                  </Link>
                  <p className="truncate text-2xs text-muted-foreground">
                    {shop.event.title}
                    <span className="sm:hidden">
                      {" "}
                      · ขาย {num.format(shop.sales)} รายการ {num.format(shop.tokens)} โทเคน
                    </span>
                  </p>
                </td>
                <td className={`${td} hidden text-right whitespace-nowrap tabular-nums sm:table-cell`}>
                  {num.format(shop.sales)} รายการ
                  <p className="text-2xs text-muted-foreground">{num.format(shop.tokens)} โทเคน</p>
                </td>
                <td className={tdTight}>{shop.role === "owner" ? <Badge tone="strong">เจ้าของร้าน</Badge> : <Badge>พนักงาน</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
