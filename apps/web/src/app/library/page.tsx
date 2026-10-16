"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getReadingPage, listOfflineIssues, offlineHref, removeOfflineIssue, type OfflineItem,
} from "../../lib/offline-library";

export default function PocketLibrary(){
  const [items,setItems]=useState<OfflineItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const refresh=useCallback(async()=>{
    try{setItems(await listOfflineIssues());setError("");}
    catch{setError("Trình duyệt không cho phép truy cập bộ nhớ offline. Vui lòng kiểm tra chế độ riêng tư hoặc dung lượng.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  async function remove(key:string){
    try{await removeOfflineIssue(key);await refresh();}
    catch{setError("Không xóa được ấn bản offline. Vui lòng thử lại.");}
  }
  return <main className="nr-pocket-shell">
    <nav className="nr-reader-top"><Link href="/">← Trang tin</Link><strong>NEWS RADAR · POCKET</strong><Link href="/edition/archive/">Tìm số báo ↗</Link></nav>
    <header className="nr-pocket-heading"><span className="nr-reader-eyebrow">THƯ VIỆN CÁ NHÂN · LƯU NGAY TRÊN MÁY</span><h1>Tủ báo của tôi</h1>
      <p>Những số báo bạn chủ động tải về. Nội dung văn bản có thể đọc không cần mạng sau khi đã mở ứng dụng một lần; ảnh từ nguồn ngoài có thể không khả dụng offline.</p>
      <strong>{items.length} ấn bản đã lưu trên thiết bị</strong>
    </header>
    {error?<p role="alert" className="nr-reader-message">{error}</p>:
      loading?<p role="status" className="nr-reader-message">Đang mở tủ báo...</p>:
      !items.length?<div className="nr-reader-message">Tủ báo đang trống. Hãy mở một số báo hoặc tạp chí và chọn “Lưu để đọc offline”.</div>:
      <div className="nr-pocket-grid">{items.map(item=><article key={item.key} className="nr-pocket-card">
        <div><span className="nr-category">{item.kind==="daily"?"BÁO NGÀY":"TẠP CHÍ TUẦN"}</span><h2>{item.title}</h2>
          <p>{item.issueDate} · {item.kind==="weekly"?(item.payload as {coverageDays?:number}).coverageDays+"/7 ngày dữ liệu":"Ấn bản ngày"}</p></div>
        <div className="nr-pocket-card-actions"><Link href={offlineHref(item)}>Đọc tiếp · Trang {getReadingPage(item.key)} →</Link>
          <button type="button" aria-label={"Xóa bản offline "+item.issueDate} onClick={()=>void remove(item.key)}>Xóa bản offline</button></div>
      </article>)}</div>}
    <p className="nr-pocket-footnote">Dữ liệu IndexedDB được lưu tại trình duyệt hiện tại và có thể biến mất nếu xóa dữ liệu website. Tin gốc ở trang báo bên ngoài vẫn cần kết nối Internet.</p>
  </main>;
}
