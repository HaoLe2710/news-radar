import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "News Radar | Bản tin Việt Nam & Thế giới",
  description: "Trang tổng hợp tin tức theo khu vực và lĩnh vực, sử dụng Cloudflare Workers và D1.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
