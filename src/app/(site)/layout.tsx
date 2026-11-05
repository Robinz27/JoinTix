import { Suspense } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { SiteFooter } from "@/components/site-footer";

// Every page a visitor sees: the navbar on top and the footer below. A route group, so the URLs don't change.
// The navbar reads the URL (usePathname), which a page with an id only known per request (/checkout/[id])
// can't give it while prerendering, so it sits in Suspense; everywhere else it still prerenders as before
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<NavbarFallback />}>
        <Navbar />
      </Suspense>
      {children}
      <SiteFooter />
    </>
  );
}

/** The navbar's resting shape (components/navbar.tsx), so nothing moves when it arrives */
function NavbarFallback() {
  return (
    <header className="sticky top-0 z-50 h-14">
      <div className="border-b border-border bg-background">
        <nav className="mx-auto flex h-14 max-w-5xl items-center px-3 sm:px-4 xl:max-w-6xl">
          <Link href="/" aria-label="JoinTix หน้าแรก" className="text-base font-semibold text-foreground min-[400px]:text-lg">
            JoinTix
          </Link>
        </nav>
      </div>
    </header>
  );
}
