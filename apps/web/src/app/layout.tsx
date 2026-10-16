import type { Metadata } from "next";
import "./globals.css";
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
      <body><PWARegister/>{children}</body>
    </html>
  );
}
