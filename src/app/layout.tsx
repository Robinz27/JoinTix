import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { THEME_SCRIPT } from "@/lib/theme";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "JoinTix", template: "%s - JoinTix" },
  description: "กดบัตรคอนเสิร์ต อีเวนต์ และงานเลี้ยงรุ่น ไว ไม่มีซ้ำ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      // Light until THEME_SCRIPT says otherwise; ThemeToggle flips the class without re-rendering this layout
      className={`${fontVariables} h-full antialiased motion-safe:scroll-smooth`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* text/plain on the client keeps React from warning about a <script> it won't run (guides/preventing-flash-before-hydration) */}
        <script
          type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
