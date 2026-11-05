import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight01Icon, Calendar03Icon, Call02Icon, Coins01Icon, Mail01Icon, Ticket02Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { Icon, type IconSvgElement } from "@/components/icon";
import { ProfileSkeleton } from "@/components/skeletons";
import { EmailStatus } from "@/components/verify-email-link";
import { listMyTickets, tokenBalances } from "@/lib/orders";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "ข้อมูลบัญชี" };

/** Whether an event hasn't started yet (this page renders per request, so "now" is now) */
const isUpcoming = (iso: string) => Date.parse(iso) > Date.now();

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
  const [params, groups, tokens] = await Promise.all([searchParams, listMyTickets(user.id), tokenBalances(user.id)]);
  const ticketCount = groups.reduce((n, g) => n + g.tickets.length, 0);
  const upcoming = groups.filter((g) => isUpcoming(g.event.startsAt)).length;
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

        <div className="grid grid-cols-2 gap-3">
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 sm:p-5">
            <h2 className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
              <Icon icon={Coins01Icon} className="size-4" />
              โทเคนคงเหลือ
            </h2>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{tokens.total.toLocaleString("th-TH")}</p>
            <p className="mt-1 text-2xs text-muted-foreground">ได้จากการซื้อบัตร ใช้แลกสินค้าภายในงาน</p>
          </section>
          <Link href="/tickets" className="group rounded-2xl border border-border bg-card p-4 transition-colors hover:border-muted-foreground sm:p-5">
            <h2 className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon icon={Ticket02Icon} className="size-4" />
              บัตรของฉัน
            </h2>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{ticketCount.toLocaleString("th-TH")}</p>
            <p className="mt-1 flex items-center gap-0.5 text-2xs text-muted-foreground group-hover:text-foreground">
              {upcoming ? `${upcoming} งานที่กำลังจะถึง` : "ดูบัตรและ QR"}
              <Icon icon={ArrowRight01Icon} className="size-3" />
            </p>
          </Link>
        </div>

        {tokens.events.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-medium text-foreground">โทเคนแยกตามงาน</h2>
            <ul className="divide-y divide-border text-sm">
              {tokens.events.map((t) => (
                <li key={t.eventId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Link href={`/events/${t.slug}`} className="min-w-0 truncate text-foreground hover:underline">
                    {t.title}
                  </Link>
                  <span className="shrink-0 font-medium text-amber-600 tabular-nums dark:text-amber-400">{t.balance.toLocaleString("th-TH")} โทเคน</span>
                </li>
              ))}
            </ul>
          </section>
        )}

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
