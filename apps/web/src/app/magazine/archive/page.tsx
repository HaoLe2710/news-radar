"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { weeklyHref } from "../../../lib/weekly-magazine";
import "../magazine.css";

type MagazinePreview = {
  weekStart: string; weekEnd: string; issueDate: string;
  title: string; coverageDays: number; storyCount: number; coverImage: string | null;
};
type Archive = { data: MagazinePreview[]; page: number; pageSize: number; total: number; hasNext: boolean };
const API = (process.env.NEXT_PUBLIC_NEWS_API_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
export default function WeeklyMagazineArchive() {
  const [page,setPage]=useState(1);
  const [data,setData]=useState<Archive|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  useEffect(()=>{
    const controller = new AbortController();
    setLoading(true);setError(false);
    void (async()=>{
      try{
        const response=await fetch(API+"/api/magazines/archive?page="+page+"&limit=12",{signal:controller.signal,cache:"no-store"});
        if(!response.ok)throw new Error("HTTP "+response.status);
        const result:Archive=await response.json();
        if(!Array.isArray(result.data))throw new Error("Invalid archive response");
        if(!controller.signal.aborted)setData(result);
      }catch{if(!controller.signal.aborted)setError(true);}
      finally{if(!controller.signal.aborted)setLoading(false);}
    })();
    return()=>controller.abort();
  },[page]);
  return <main className="wm-app">
    <nav className="wm-topbar"><Link href="/">← Trang tin</Link><strong>NEWS RADAR · WEEKLY ARCHIVE</strong><Link href="/magazine/">Tạp chí mới nhất ↗</Link></nav>
    <header className="wm-archive-heading"><span className="wm-eyebrow">WEEKLY MAGAZINE COLLECTION</span>
      <h1>Thư viện tạp chí tuần</h1>
      <p>Mỗi tập tổng hợp từ những số báo ngày đã phát hành, giữ nguyên sau khi xuất bản. Tìm lại tuần cũ, mở tập hoặc tải PDF để đọc offline.</p>
      <span className="wm-eyebrow">{data ? data.total+" tập đã xuất bản" : "Đang tải…"}</span>
    </header>
    {error?<div className="wm-empty" role="alert">Chưa kết nối được API thư viện tạp chí.</div>:
      loading?<div className="wm-empty">Đang mở kho lưu trữ...</div>:
      !data?.data.length?<div className="wm-empty">{page>1?"Không còn tập tuần tại trang này.":"Chưa có tạp chí tuần. Tập đầu tiên sẽ xuất hiện khi có số báo từ một tuần đã kết thúc."}</div>:
      <section className="wm-archive-grid" aria-label="Các tập tạp chí đã xuất bản">
        {data.data.map(item=><article key={item.weekStart} className="wm-archive-card">
          <span className="wm-eyebrow">{item.weekStart} — {item.weekEnd}</span>
          <strong>NEWS RADAR<br/>WEEKLY</strong>
          {item.coverImage?<img src={item.coverImage} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display="none"}}/>:null}
          <h2>{item.title}</h2>
          <p>{item.storyCount} câu chuyện · {item.coverageDays}/7 ngày có số báo</p>
          <div className="wm-archive-links">
            <Link href={weeklyHref(item.weekStart)}>Đọc tập ↗</Link>
            <Link href={weeklyHref(item.weekStart,"/magazine/print/")}>In / Lưu PDF ↗</Link>
          </div>
        </article>)}
      </section>}
    <nav className="wm-archive-pagination" aria-label="Phân trang kho tạp chí">
      <button disabled={loading||page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>← Trước</button>
      <span>Trang {page} / {Math.max(1,Math.ceil((data?.total??0)/(data?.pageSize??12)))}</span>
      <button disabled={loading||!data?.hasNext} onClick={()=>setPage(p=>p+1)}>Tiếp →</button>
    </nav>
  </main>;
}
