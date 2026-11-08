import Link from "next/link";
import { ShieldKeyIcon } from "@hugeicons/core-free-icons";
import { card, pill, tile } from "@/components/admin/ui";
import { Icon } from "@/components/icon";

/**
 * A page of หลังบ้าน that doesn't exist, or that this member of staff's role doesn't reach. It renders inside
 * the back office's frame; anyone who isn't staff never gets this far (the layout sends them to the site's 404).
 */
export default function AdminNotFound() {
  return (
    <section className={`${card} flex flex-col items-center gap-3 px-6 py-16 text-center`}>
      <span className={`${tile} size-12 rounded-2xl`}>
        <Icon icon={ShieldKeyIcon} className="size-6" />
      </span>
      <h1 className="text-base font-semibold text-foreground">ไม่พบหน้านี้</h1>
      <p className="text-sm text-muted-foreground">หน้านี้ไม่มีอยู่ หรือโรลของคุณยังไม่มีสิทธิ์เข้าถึง</p>
      <Link href="/admin" className={pill}>
        กลับภาพรวม
      </Link>
    </section>
  );
}
