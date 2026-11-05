import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Calendar03Icon, Call02Icon, Mail01Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { Icon, type IconSvgElement } from "@/components/icon";
import { ProfileSkeleton } from "@/components/skeletons";
import { EmailStatus } from "@/components/verify-email-link";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "ข้อมูลบัญชี" };

const dateFormat = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });

/** Messages for the ?error= Better Auth adds when a verification link fails */
const LINK_ERRORS: Record<string, string> = {
  TOKEN_EXPIRED: "ลิงก์ยืนยันหมดอายุแล้ว กดส่งลิงก์ใหม่ด้านล่าง",
  INVALID_TOKEN: "ลิงก์ยืนยันไม่ถูกต้อง กดส่งลิงก์ใหม่ด้านล่าง",
  INVALID_USER: "ลิงก์นี้เป็นของอีกบัญชี ออกจากระบบแล้วเปิดลิงก์ใหม่อีกครั้ง",
  USER_NOT_FOUND: "ไม่พบบัญชีของลิงก์นี้",
};

export default function ProfilePage({ searchParams }: PageProps<"/profile">) {
  return (
    // Reading the session waits for the request, so the page streams in behind its skeleton
    <Suspense fallback={<ProfileSkeleton />}>
      <Profile searchParams={searchParams} />
    </Suspense>
  );
}

async function Profile({ searchParams }: Pick<PageProps<"/profile">, "searchParams">) {
  const session = await getSession();
  if (!session) redirect("/login?next=/profile");
  const { user } = session;
  const params = await searchParams;
  const linkError = typeof params.error === "string" ? (LINK_ERRORS[params.error] ?? "ยืนยันอีเมลไม่สำเร็จ ลองส่งลิงก์ใหม่") : undefined;

  return (
    <main className="flex flex-1 justify-center px-3 pt-8 pb-16 sm:pt-10">
      <div className="stagger w-full max-w-xl space-y-4">
        <header className="flex items-center gap-3">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
            {[...user.name.trim()][0]?.toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">{user.name}</h1>
            <p className="text-sm text-muted-foreground">ข้อมูลบัญชี</p>
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-medium text-foreground">ข้อมูลส่วนตัว</h2>
          <dl className="space-y-3 text-sm">
            <Row icon={UserCircleIcon} label="ชื่อ">
              {user.name}
            </Row>
            <Row icon={Mail01Icon} label="อีเมล">
              <span className="break-all">{user.email}</span>
            </Row>
            <Row icon={Call02Icon} label="เบอร์โทร">
              {user.phone}
            </Row>
            <Row icon={Calendar03Icon} label="สมัครเมื่อ">
              {dateFormat.format(user.createdAt)}
            </Row>
          </dl>
        </section>

        <EmailStatus
          email={user.email}
          verified={user.emailVerified}
          justVerified={params.verified === "1" && !linkError && user.emailVerified}
          linkError={linkError}
        />
      </div>
    </main>
  );
}

function Row({ icon, label, children }: { icon: IconSvgElement; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon icon={icon} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  );
}
