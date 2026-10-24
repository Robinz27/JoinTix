import { Google_Sans_Flex, Noto_Sans_Thai } from "next/font/google";

const googleSansFlex = Google_Sans_Flex({
  variable: "--font-google-sans-flex",
  subsets: ["latin"],
  // next/font has no metrics for this font, so the metric-matched fallback is declared in globals.css
  adjustFontFallback: false,
  fallback: ["Google Sans Flex Fallback"],
});

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai"],
});

export const fontVariables = [googleSansFlex, notoSansThai].map((f) => f.variable).join(" ");
