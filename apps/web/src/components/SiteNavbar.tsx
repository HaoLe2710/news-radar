"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Trang nhất" },
  { href: "/edition/", label: "Báo ngày" },
  { href: "/magazine/", label: "Báo tuần" },
  { href: "/edition/archive/", label: "Kho số báo" },
  { href: "/library/", label: "Tủ báo của tôi" },
  { href: "/ask/", label: "Hỏi AI" },
  { href: "/notifications/", label: "Thông báo" },
] as const;

export default function SiteNavbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const active = (href: string) => href === "/" ? pathname === "/" :
    href === "/edition/" ? pathname === "/edition/" || pathname === "/edition" :
    href === "/magazine/" ? pathname === "/magazine/" || pathname === "/magazine" :
    pathname.startsWith(href);

  return <header className="nr-global-header">
    <div className="nr-global-top">
      <Link href="/" className="nr-global-brand" aria-label="News Radar - Trang nhất">
        <img className="nr-global-brand-logo" src="/icon.svg" alt="" width={46} height={46} decoding="async"/>
        <span className="nr-global-brand-wordmark">NEWS RADAR<small>THE DAILY EDITION</small></span>
      </Link>
      <span className="nr-global-tagline">TIN TỨC ĐƯỢC CHỌN LỌC · ĐỌC THEO CÁCH CỦA BẠN</span>
      <button className="nr-global-toggle" type="button" aria-expanded={open} aria-controls="nr-global-navigation"
        onClick={() => setOpen(x => !x)}>
        <span className="nr-menu-icon" aria-hidden="true">{open ? "✕" : "☰"}</span>
        <span>{open ? "Đóng" : "Danh mục"}</span>
      </button>
    </div>
    <nav id="nr-global-navigation" className={"nr-global-navigation"+(open ? " nr-global-navigation-open" : "")} aria-label="Điều hướng chính">
      {NAV_ITEMS.map(item=><Link href={item.href} key={item.href}
        aria-current={active(item.href) ? "page" : undefined}
        onClick={()=>setOpen(false)}>{item.label}</Link>)}
    </nav>
  </header>;
}
