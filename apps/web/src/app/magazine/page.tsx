"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DEFAULT_RADAR_PREFERENCES, RADAR_STORAGE_KEY, parseRadarPreferences, type RadarPreferences } from "../../lib/my-radar";
import { editionSpreads, indexForPage, offsetSpread } from "../../lib/newspaper-pages";
import { validWeekStart, weeklyHref, weeklyPages, type WeeklyMagazine } from "../../lib/weekly-magazine";
import { MagazinePageContent, WeekDate } from "./magazine-content";
import "./magazine.css";

const API = (process.env.NEXT_PUBLIC_NEWS_API_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");

export default function WeeklyMagazineReader() {
  const [issue, setIssue] = useState<WeeklyMagazine | null>(null);
  const [preferences, setPreferences] = useState<RadarPreferences>(DEFAULT_RADAR_PREFERENCES);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [wide, setWide] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 920px)");
    const onChange = () => setWide(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const week = params.get("week");
    if (week && !validWeekStart(week)) {
      setError("Ngày bắt đầu tuần không hợp lệ. Vui lòng chọn một tập từ thư viện.");
      setLoading(false);
      return;
    }
    const page = Number(params.get("page") ?? 1);
    setCurrentPage(Number.isFinite(page) && page > 0 ? Math.floor(page) : 1);
    try { setPreferences(parseRadarPreferences(localStorage.getItem(RADAR_STORAGE_KEY))); } catch {}
    const controller = new AbortController();
    void (async () => {
      try {
        const endpoint = week ? "/api/magazines/" + week : "/api/magazines/latest";
        const response = await fetch(API + endpoint, {cache:"no-store",signal:controller.signal});
        if(!response.ok) throw new Error("HTTP " + response.status);
        const body: {data: WeeklyMagazine | null} = await response.json();
        if(!controller.signal.aborted) setIssue(body.data);
      } catch {
        if(!controller.signal.aborted) setError("Không tải được tạp chí tuần. Hãy kiểm tra kết nối API.");
      } finally { if(!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, []);

  const pages = useMemo(() => issue ? weeklyPages(issue, preferences) : [], [issue, preferences]);
  const spreads = useMemo(() => editionSpreads(pages.length, wide), [pages.length, wide]);
  const spreadIndex = indexForPage(spreads, currentPage);
  const visible = spreads[spreadIndex] ?? [];
  function goto(next: number) {
    if(!spreads.length) return;
    const clamped = Math.max(1, Math.min(pages.length, next));
    setCurrentPage(clamped);
    const url = new URL(window.location.href);
    url.searchParams.set("page", String(clamped));
    window.history.replaceState(null, "", url.pathname + url.search);
  }
  function move(delta: number) {
    const nextIndex = offsetSpread(spreadIndex,delta,spreads.length);
    if(nextIndex!==spreadIndex) goto((spreads[nextIndex]?.[0] ?? 0)+1);
  }
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if(event.ctrlKey || event.metaKey || event.altKey ||
        ["INPUT","TEXTAREA","SELECT"].includes((event.target as HTMLElement)?.tagName)) return;
      if(event.key==="ArrowLeft" || event.key==="ArrowRight") {
        event.preventDefault();
        move(event.key==="ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown",listener);
    return()=>window.removeEventListener("keydown",listener);
  });

  return <main className="wm-app">
    <nav className="wm-topbar" aria-label="Điều hướng tạp chí">
      <Link href="/">← News Radar</Link>
      <strong>NEWS RADAR · WEEKLY</strong>
      <Link href="/magazine/archive/">Thư viện tập tuần ↗</Link>
    </nav>
    {loading?<p className="wm-empty" role="status">Đang mở tạp chí tuần...</p>:
    error?<p className="wm-empty" role="alert">{error}</p>:
    !issue?<div className="wm-empty">Tạp chí tuần chưa được xuất bản. Hệ thống sẽ tổng hợp vào thứ Hai sau khi có các số báo ngày.<p><Link href="/magazine/archive/">Xem thư viện tập tuần →</Link></p></div>:
    <>
      <header className="wm-intro">
        <div><span className="wm-eyebrow">THE WEEKLY REVIEW / {issue.weekStart} — {issue.weekEnd}</span>
          <h1>Cuối tuần đọc gì?</h1>
          <p>Phát hành <WeekDate date={issue.issueDate}/> · {issue.storyCount} câu chuyện · {issue.coverageDays}/7 ngày có báo</p>
        </div>
        <div className="wm-actions">
          <Link className="wm-action" href={weeklyHref(issue.weekStart,"/magazine/print/")}>In / Lưu PDF ↗</Link>
          <Link href="/magazine/archive/">Tất cả các tập →</Link>
        </div>
      </header>
      <nav className="wm-controls" aria-label="Lật trang tạp chí">
        <button disabled={spreadIndex===0} onClick={()=>move(-1)}>← Trang trước</button>
        <span>Trang {visible.map(i=>i+1).join("–")} / {pages.length}</span>
        <button disabled={spreadIndex>=spreads.length-1} onClick={()=>move(1)}>Trang tiếp →</button>
      </nav>
      <div className={"wm-book"+(visible.length===1?" single":"")}
        onTouchStart={e=>{startX.current=e.touches[0]?.clientX ?? null;}}
        onTouchEnd={e=>{if(startX.current===null) return;const delta=(e.changedTouches[0]?.clientX ?? startX.current)-startX.current;startX.current=null;if(Math.abs(delta)>70)move(delta<0?1:-1);}}>
        {visible.map(i=><article className="wm-page" key={pages[i].id} aria-label={"Trang "+(i+1)+": "+pages[i].title}>
          <div className="wm-page-body"><MagazinePageContent page={pages[i]} magazine={issue}/></div>
          <footer className="wm-footer"><span>NEWS RADAR WEEKLY · {issue.weekStart}</span><span>{i+1}</span></footer>
        </article>)}
      </div>
      <nav className="wm-pages-nav" aria-label="Mục lục tạp chí">
        {pages.map((page,i)=><button key={page.id} aria-current={visible.includes(i)?"page":undefined}
          onClick={()=>goto(i+1)}>{String(i+1).padStart(2,"0")} {page.title}</button>)}
      </nav>
      <p className="wm-small-note">Nội dung tạp chí được lưu cố định theo tuần. Hãy kiểm tra nhà xuất bản gốc trước khi dẫn lại thông tin.</p>
    </>}
  </main>;
}
