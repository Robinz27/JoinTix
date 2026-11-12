import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComputerIcon, SmartPhone01Icon } from "@hugeicons/core-free-icons";
import { DeviceSignOut } from "@/components/admin/device-sign-out";
import { Empty, Panel, tile } from "@/components/admin/ui";
import { Icon } from "@/components/icon";
import { getMember, memberDevices } from "@/lib/admin-members";
import { deviceLabel, ipLabel } from "@/lib/audit-actions";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "อุปกรณ์ของสมาชิก" };

const stamp = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
const at = (iso: string) => stamp.format(new Date(iso));

/** The devices this account is signed in on now, each with its own ออกจากระบบ, and one for all of them */
export default async function MemberDevicesPage({ params }: PageProps<"/admin/users/[id]/devices">) {
  const { id } = await params;
  const { session: mine, access } = await requirePermission("members.manage", `/admin/users/${id}/devices`);
  const memberId = decodeURIComponent(id);
  const [found, devices] = await Promise.all([getMember(memberId), memberDevices(memberId)]);
  if (!found) notFound();
  // Staff accounts stay with the super admin (app/actions/admin.ts says the same on the server)
  const locked = !access.superAdmin && found.profile.staffRole ? "บัญชีทีมงานแก้ได้เฉพาะ Super admin" : undefined;
  const others = devices.filter((d) => d.id !== mine.id);

  return (
    <Panel
      icon={ComputerIcon}
      title="เครื่องที่เข้าสู่ระบบอยู่"
      subtitle={devices.length ? `${devices.length} เครื่อง · ถ้าลูกค้าทำเครื่องหายหรือสงสัยว่ามีคนอื่นใช้ ให้สั่งออกจากระบบ` : undefined}
      action={others.length > 1 && <DeviceSignOut userId={memberId} all disabled={locked} />}
    >
      {devices.length === 0 ? (
        <Empty icon={ComputerIcon} title="ไม่ได้เข้าสู่ระบบไว้ที่เครื่องไหน" />
      ) : (
        <ul className="divide-y divide-border">
          {devices.map((device) => {
            const phone = /iPhone|Android|iPad/.test(device.userAgent ?? "");
            const here = device.id === mine.id;
            return (
              <li key={device.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                <span className={`${tile} size-9 max-[319px]:hidden`}>
                  <Icon icon={phone ? SmartPhone01Icon : ComputerIcon} className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    {deviceLabel(device.userAgent) || "ไม่ทราบอุปกรณ์"}
                    {here && <span className="text-muted-foreground"> (เครื่องที่คุณใช้อยู่)</span>}
                  </p>
                  <p className="text-2xs text-muted-foreground">
                    ใช้ล่าสุด {at(device.lastSeen)} · เข้าสู่ระบบเมื่อ {at(device.createdAt)}
                    {device.ipAddress && <span className="break-all"> · IP {ipLabel(device.ipAddress)}</span>}
                  </p>
                </div>
                {!here && <DeviceSignOut userId={memberId} sessionId={device.id} disabled={locked} />}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
