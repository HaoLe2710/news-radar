"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DEFAULT_RADAR_PREFERENCES, RADAR_STORAGE_KEY, parseRadarPreferences, type RadarPreferences } from "../../../lib/my-radar";
import { validWeekStart, weeklyHref, weeklyPages, weeklySources, type WeeklyMagazine } from "../../../lib/weekly-magazine";
import { MagazinePageContent } from "../magazine-content";
import "../magazine.css";

const API = (process.env.NEXT_PUBLIC_NEWS_API_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const SOURCE_PAGE_SIZE = 8;
export default function WeeklyMagazinePrint() {
  const [magazine,setMagazine]=useState<WeeklyMagazine|null>(null);
  const [prefs,setPrefs]=useState<RadarPreferences>(DEFAULT_RADAR_PREFERENCES);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    const week=new URLSearchParams(window.location.search).get("week");
    if(week&&!validWeekStart(week)){setError("Tuần không hợp lệ. Hãy chọn tập từ thư viện.");setLoading(false);return;}
    try{setPrefs(parseRadarPreferences(localStorage.getItem(RADAR_STORAGE_KEY)));}catch{}
    const controller=new AbortController();
    void(async()=>{
      try{
        const response=await fetch(API+(week?"/api/magazines/"+week:"/api/magazines/latest"),{cache:"no-store",signal:controller.signal});
        if(!response.ok)throw new Error("HTTP "+response.status);
        const json:{data:WeeklyMagazine|null}=await response.json();
        if(!controller.signal.aborted)setMagazine(json.data);
      }catch{if(!controller.signal.aborted)setError("Không tải được dữ liệu tạp chí tuần.");}
      finally{if(!controller.signal.aborted)setLoading(false);}
    })();
    return()=>controller.abort();
  },[]);
  const pages=useMemo(()=>magazine?weeklyPages(magazine,prefs):[],[magazine,prefs]);
  const sources=useMemo(()=>magazine?weeklySources(magazine,prefs):[],[magazine,prefs]);
  const groups=useMemo(()=>{
    const chunks:typeof sources[]=[];
    for(let i=0;i<sources.length;i+=SOURCE_PAGE_SIZE)chunks.push(sources.slice(i,i+SOURCE_PAGE_SIZE));
    return chunks;
  },[sources]);
  return <main className="wm-print-root">
    <header className="wm-print-toolbar">
      <Link href={weeklyHref(magazine?.weekStart)}>← Trở lại tạp chí</Link>
      <strong>NEWS RADAR / WEEKLY / BẢN IN A4</strong>
      <button type="button" disabled={!magazine||!!error} onClick={()=>window.print()}>In / Lưu PDF ↗</button>
    </header>
    {loading?<div className="wm-empty" role="status">Đang chuẩn bị bản in...</div>:
    error?<div className="wm-empty" role="alert">{error}</div>:
    !magazine?<div className="wm-empty">Tạp chí tuần chưa được xuất bản. <Link href="/magazine/archive/">Chọn tập đã có →</Link></div>:
    <>
      {pages.map((page,i)=><section key={page.id} className="wm-print-sheet" aria-label={"Trang "+(i+1)+": "+page.title}>
        <div className="wm-page-body"><MagazinePageContent page={page} magazine={magazine}/></div>
        <footer className="wm-footer"><span>NEWS RADAR · WEEKLY {magazine.weekStart} — {magazine.weekEnd}</span><span>{i+1}</span></footer>
      </section>)}
      {groups.map((group,i)=><section key={i} className="wm-print-sheet wm-print-source-page" aria-label={"Nguồn tham khảo "+(i+1)}>
        <div className="wm-page-body">
          <div className="wm-inside-head">NEWS RADAR / WEEKLY / TÀI LIỆU GỐC</div>
          <span className="wm-eyebrow">PHỤ LỤC DẪN NGUỒN</span>
          <h2>Nguồn bài viết {groups.length>1 ? (i+1)+"/"+groups.length : ""}</h2>
          <p className="wm-small-note">Các nội dung chỉ tổng hợp từ số báo ngày và RSS. Liên kết dẫn tới nhà xuất bản gốc. AI có thể sai; vui lòng đối chiếu dữ kiện trước khi sử dụng lại.</p>
          <ol className="wm-source-list" start={i*SOURCE_PAGE_SIZE+1}>
            {group.map(source=><li key={source.url}>
              <strong>{source.title}</strong><span>{source.source}</span>
              <a href={source.url} target="_blank" rel="noopener noreferrer">{source.url}</a>
            </li>)}
          </ol>
        </div>
        <footer className="wm-footer"><span>NEWS RADAR · NGUỒN BÀI VIẾT</span><span>{pages.length+i+1}</span></footer>
      </section>)}
      <p className="wm-print-toolbar">Chọn In / Lưu PDF → Save as PDF → khổ A4 dọc. Tắt phần đầu/chân trang của trình duyệt để giữ bố cục báo.</p>
    </>}
  </main>;
}
