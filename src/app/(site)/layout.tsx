import { Navbar } from "@/components/navbar";
import { SiteFooter } from "@/components/site-footer";

// Every page a visitor sees: the navbar on top and the footer below. A route group, so the URLs don't change
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <SiteFooter />
    </>
  );
}
