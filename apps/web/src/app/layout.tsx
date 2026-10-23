import type { Metadata } from "next";
import { Be_Vietnam_Pro, Noto_Serif } from "next/font/google";
import "./globals.css";
import "./newspaper-rework.css";
import SiteNavbar from "../components/SiteNavbar";
import PWARegister from "../components/PWARegister";

// Explicitly build both Latin and Vietnamese glyph subsets into the exported web app.
// Self-hosted Next.js fonts avoid browser-dependent Georgia fallback and external font blocking.
const uiFont = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-news-sans",
});
const paperFont = Noto_Serif({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-news-serif",
});

export const metadata: Metadata = {
  title: "News Radar | Bản tin Việt Nam & Thế giới",
  description: "Báo giấy kỹ thuật số, tạp chí tuần và thư viện cá nhân để đọc offline.",
  manifest: "/manifest.webmanifest",
  themeColor: "#28483a",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "News Radar", statusBarStyle: "default" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={`${uiFont.variable} ${paperFont.variable}`}><PWARegister/><SiteNavbar/>{children}</body>
    </html>
  );
}
