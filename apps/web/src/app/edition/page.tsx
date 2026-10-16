"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { DEFAULT_RADAR_PREFERENCES, RADAR_STORAGE_KEY, parseRadarPreferences, selectRadarStories } from "../../lib/my-radar";

type Article = {id:number;title:string;url:string;summary:string|null;image_url:string|null;published_at:string|null;source:string;region:"vn"|"world";category:string};
type Edition = { id:string;issueDate:string;coverageDate:string;title:string;summary:string;summaryMode:"ai"|"rss";lead:Article;secondary:Article[];briefs:Article[];radarPool:Article[];articleCount:number;sourceCount:number;createdAt:string };
const API = (process.env.NEXT_PUBLIC_NEWS_API_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const LABELS:Record<string,string> = {technology:"Công nghệ",business:"Kinh tế",science:"Khoa học",general:"Thời sự",sports:"Thể thao",education:"Giáo dục"};
function dateLabel(date:string){return new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"long",year:"numeric",timeZone:"Asia/Ho_Chi_Minh"}).format(new Date(date+"T12:00:00+07:00"));}
function Story({article,index}:{article:Article;index?:number}){
 return <article className="paper-story">
  <p className="paper-story-meta">{index?String(index).padStart(2,"0")+" / ":""}{LABELS[article.category]??"Tin tức"} · {article.source}</p>
  <h3><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a></h3>
  <p>{article.summary || "Mở nguồn báo để đọc đầy đủ thông tin."}</p>
  <a className="paper-source" href={article.url} target="_blank" rel="noopener noreferrer">Đọc bài gốc ↗</a>
 </article>;
}
export default function EditionPage(){
 const [edition,setEdition]=useState<Edition|null>(null);
 const [requestedDate,setRequestedDate]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState(false);
 const [radarTopics,setRadarTopics]=useState([...DEFAULT_RADAR_PREFERENCES.topics]);
 const [radarEnabled,setRadarEnabled]=useState(DEFAULT_RADAR_PREFERENCES.enabled);
 useEffect(()=>{
  const date = new URLSearchParams(window.location.search).get("date");
  const validDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  setRequestedDate(validDate);
  try {const prefs=parseRadarPreferences(window.localStorage.getItem(RADAR_STORAGE_KEY));setRadarTopics(prefs.topics);setRadarEnabled(prefs.enabled);}catch {}
  const controller=new AbortController();
  async function load(){
   try{
    const url=validDate ? "/api/editions/"+validDate : "/api/editions/latest";
    const response=await fetch(API+url,{cache:"no-store",signal:controller.signal});
    if(!response.ok)throw new Error("API error");
    const result:{data:Edition|null}=await response.json();
    if(!controller.signal.aborted)setEdition(result.data);
   }catch{if(!controller.signal.aborted)setError(true);}
   finally{if(!controller.signal.aborted)setLoading(false);}
  }
  void load();return()=>controller.abort();
 },[]);
 const radar=edition&&radarEnabled?selectRadarStories(edition.radarPool,radarTopics,4):[];
 return <main className="paper-shell">
  <div className="paper-utility"><Link href="/">← Trở về News Radar</Link><span>ẤN PHẨM SỐ · NEWSPAPER EDITION</span></div>
  <header className="paper-masthead">
   <div className="paper-pretitle">TIN TỨC VIỆT NAM &amp; THẾ GIỚI — ẤN BẢN HẰNG NGÀY</div>
   <h1><Link href="/">NEWS RADAR</Link></h1>
   <div className="paper-imprint"><span>ĐỌC ĐỂ HIỂU ĐIỀU ĐANG DIỄN RA</span><span>{edition?"SỐ "+edition.issueDate:"BẢN TIN HẰNG NGÀY"}</span><span>ĐỘC LẬP · TỔNG HỢP RSS</span></div>
  </header>
  {loading?<div className="paper-message">Đang mở số báo...</div>:error?<div className="paper-message" role="alert">Chưa kết nối được API số báo. Worker cần được triển khai Phase 10.</div>:!edition?<div className="paper-message">Số báo {requestedDate??"mới nhất"} chưa được xuất bản. Hệ thống sẽ tổng hợp sau khi hoàn tất kỳ lấy tin.</div>:<>
   <div className="paper-dateline"><span>{dateLabel(edition.issueDate)}</span><span>ĐIỂM TIN NGÀY {edition.coverageDate}</span><span>{edition.sourceCount} NGUỒN · {edition.articleCount} BÀI TUYỂN CHỌN</span></div>
   <section className="paper-front">
    <div className="paper-lead">
     <p className="paper-kicker">TRANG NHẤT / BÀI NỔI BẬT</p>
     <h2><a href={edition.lead.url} target="_blank" rel="noopener noreferrer">{edition.lead.title}</a></h2>
     {edition.lead.image_url?<img src={edition.lead.image_url} alt="" className="paper-lead-image" loading="eager"/>:null}
     <p className="paper-lead-description">{edition.lead.summary??"Đọc thêm tại nguồn xuất bản gốc."}</p>
     <a className="paper-source" href={edition.lead.url} target="_blank" rel="noopener noreferrer">{edition.lead.source} — Đọc bài gốc ↗</a>
    </div>
    <aside className="paper-editor">
     <p className="paper-kicker">LỜI TÒA SOẠN</p>
     <h2>{edition.title}</h2>
     <p>{edition.summary}</p>
     <small>{edition.summaryMode==="ai"?"Biên tập tóm lược với hỗ trợ AI từ RSS.":"Tóm lược biên tập từ tiêu đề và mô tả RSS."} Nội dung chỉ để tham khảo; xem nguồn gốc để kiểm chứng.</small>
     <div className="paper-ornament" aria-hidden="true">✦</div>
    </aside>
   </section>
   <div className="paper-divider"><span>TRONG SỐ BÁO NÀY</span><span>01 — 06</span></div>
   <section className="paper-columns" aria-label="Tin nổi bật">
    {edition.secondary.map((a,i)=><Story key={a.id} article={a} index={i+1}/>)}
   </section>
   <div className="paper-divider"><span>ĐIỂM NHANH / BRIEFS</span><span>TIN TRONG NGÀY</span></div>
   <section className="paper-briefs">{edition.briefs.map((a)=><div className="paper-brief" key={a.id}><strong><a href={a.url} target="_blank" rel="noopener noreferrer">{a.title}</a></strong><span>{a.source}</span></div>)}</section>
   <div className="paper-divider"><span>MY RADAR / TIN RIÊNG CỦA BẠN</span><span>TỪ SỞ THÍCH ĐÃ LƯU</span></div>
   <section className="paper-personal">
    {!radarEnabled?<p>My Radar đang tắt. Bạn có thể bật lại trên trang chủ.</p>:radar.length?radar.map(({article,topic})=><article key={article.id}><span>{topic.toUpperCase()} · {article.source}</span><h3><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a></h3></article>):<p>Chưa có bài phù hợp trong số báo này. Hãy thử chọn thêm chủ đề trên trang chủ.</p>}
   </section>
   <footer className="paper-end"><strong>NEWS RADAR.</strong><span>Ấn bản cố định từ dữ liệu RSS ngày {edition.coverageDate}. Không tự thay đổi sau khi xuất bản.</span><Link href="/">Trở về trang tin →</Link></footer>
  </>}
 </main>;
}
