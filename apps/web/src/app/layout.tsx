import type { Metadata } from "next";
import "./globals.css";
import "./newspaper-rework.css";
import SiteNavbar from "../components/SiteNavbar";
import PWARegister from "../components/PWARegister";

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Noto+Serif:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      </head>
      <body><PWARegister/><SiteNavbar/>{children}</body>
    </html>
  );
}
