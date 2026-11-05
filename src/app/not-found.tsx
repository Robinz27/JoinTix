import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { SiteFooter } from "@/components/site-footer";

/** "ไม่พบหน้านี้", also used by (site)/not-found.tsx, which already sits inside the navbar and footer */
export function NotFoundMessage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-3 py-24 text-center">
      <p className="text-2xs font-medium tracking-[0.2em] text-muted-foreground uppercase">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">ไม่พบหน้านี้</h1>
      <p className="mt-2 text-sm text-muted-foreground">ลิงก์อาจผิด หรือหน้านี้ถูกย้ายไปแล้ว</p>
      <Link href="/" className="btn-buy mt-6 inline-flex h-10 items-center rounded-full px-5 text-sm font-medium">
        กลับหน้าแรก
      </Link>
    </main>
  );
}

// A URL that matches nothing, or a non-admin at /admin: outside (site), so it brings the navbar along itself
export default function NotFound() {
  return (
    <>
      <Navbar />
      <NotFoundMessage />
      <SiteFooter />
    </>
  );
}
