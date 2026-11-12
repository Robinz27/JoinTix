import type { Metadata } from "next";
import Link from "next/link";
import { asc, count, eq, isNotNull } from "drizzle-orm";
import { ArrowRight01Icon, ShieldKeyIcon, UserEdit01Icon } from "@hugeicons/core-free-icons";
import { NewRoleButton, RoleActions } from "@/components/admin/role-actions";
import { Badge, PageHeader, card } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { getDb } from "@/db";
import { adminRoles, user } from "@/db/schema";
import { PERMISSIONS } from "@/lib/permissions";
import { requireSuperAdmin } from "@/lib/session";
import { num } from "@/lib/format";

export const metadata: Metadata = { title: "สิทธิ์ทีมงาน" };


export default async function AdminRoles() {
  await requireSuperAdmin("/admin/roles");
  const db = getDb();
  const [roles, members, [supers]] = await Promise.all([
    db.select().from(adminRoles).orderBy(asc(adminRoles.createdAt)),
    db.select({ roleId: user.adminRoleId, n: count() }).from(user).where(isNotNull(user.adminRoleId)).groupBy(user.adminRoleId),
    db.select({ n: count() }).from(user).where(eq(user.role, "super_admin")),
  ]);

  return (
    <>
      <PageHeader eyebrow="Roles" title="สิทธิ์ทีมงาน" description="สร้างโรลได้ไม่จำกัด ติ๊กสิทธิ์ได้อิสระ แล้วตั้งให้ทีมงานในหน้าสมาชิก เปลี่ยนสิทธิ์แล้วมีผลทันที">
        {/* Goes to another page, so it reads as a link (arrow, no border) and leaves the one filled button to สร้างโรลใหม่ */}
        <Link
          href="/admin/users"
          className="group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground max-sm:flex-1 max-sm:justify-center"
        >
          <Icon icon={UserEdit01Icon} className="size-4" />
          กำหนดโรลให้ทีมงาน
          <Icon icon={ArrowRight01Icon} className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <NewRoleButton />
      </PageHeader>

      <ul className="space-y-3">
        <li className={`${card} p-4 sm:p-5`}>
          <div className="flex items-center gap-2">
            <Icon icon={ShieldKeyIcon} className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Super admin</h2>
            <span className="text-xs text-muted-foreground">{num.format(supers.n)} คน</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">ทำได้ทุกอย่าง รวมถึงจัดการโรลและตั้งโรลให้คนอื่น โรลนี้แก้ไขหรือลบไม่ได้</p>
        </li>

        {roles.map((role) => {
          const n = members.find((m) => m.roleId === role.id)?.n ?? 0;
          return (
            <li key={role.id} className={`${card} p-4 sm:p-5`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <h2 className="text-sm font-semibold text-foreground">{role.name}</h2>
                    <span className="text-xs text-muted-foreground">{num.format(n)} คน</span>
                  </div>
                  {role.description && <p className="mt-1 text-xs text-muted-foreground">{role.description}</p>}
                </div>
                <RoleActions role={{ id: role.id, name: role.name, description: role.description, permissions: role.permissions, members: n }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {PERMISSIONS.filter((p) => role.permissions.includes(p.key)).map((p) => (
                  <Badge key={p.key}>{p.label}</Badge>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
