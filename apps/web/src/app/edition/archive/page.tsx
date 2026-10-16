"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { printEditionHref } from "../../../lib/print-edition";

type ArchiveItem = {
  issueDate: string;
  createdAt: string;
  headline: string;
  coverImage: string | null;
  articleCount: number;
  sourceCount: number;
};
type ArchivePayload = {
  data: ArchiveItem[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
};

const API = (process.env.NEXT_PUBLIC_NEWS_API_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
function formatIssue(date: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "long", year: "numeric",
  }).format(new Date(date + "T12:00:00+07:00"));
}
export default function EditionArchive() {
  const [page, setPage] = useState(1);
  const [archive, setArchive] = useState<ArchivePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch(API + "/api/editions/archive?limit=12&page=" + page, {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Worker HTTP " + response.status);
        const payload: ArchivePayload = await response.json();
        if (!Array.isArray(payload.data)) throw new Error("Invalid archive format");
        if (!controller.signal.aborted) setArchive(payload);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [page]);

  return <main className="nr-library-shell">
    <nav className="nr-reader-top" aria-label="Điều hướng thư viện">
      <Link href="/">← Trang tin</Link>
      <strong>NEWS RADAR <span>· ARCHIVE</span></strong>
      <Link href="/edition/">Đọc số báo mới nhất ↗</Link>
    </nav>
    <header className="nr-library-header">
      <span className="nr-reader-eyebrow">LƯU TRỮ ẤN BẢN · THE NEWSPAPER COLLECTION</span>
      <h1>Thư viện số báo</h1>
      <p>Mỗi số báo là một ấn phẩm cố định theo ngày. Mở lại các trang nhất, đọc những diễn biến từng ngày và tìm tin từ nguồn báo gốc.</p>
      <div className="nr-library-count">{archive ? archive.total + " số báo đã xuất bản" : "Đang tải thư viện…"}</div>
    </header>
    {error ? <div className="nr-library-state" role="alert">Chưa kết nối được thư viện số báo. Kiểm tra phiên bản Worker hoặc thử lại.</div>
      : loading ? <div className="nr-library-state">Đang mở tủ lưu trữ...</div>
      : !archive?.data.length ? <div className="nr-library-state">{page > 1 ? "Không có số báo ở trang này." : "Chưa có số báo được lưu. Hệ thống sẽ tạo ấn bản sau kỳ tổng hợp tin."}</div>
      : <section className="nr-library-grid" aria-label="Danh sách số báo">
          {archive.data.map((item) => <article key={item.issueDate} className="nr-library-item">
            <Link className="nr-library-cover-link" href={"/edition/?date=" + item.issueDate}>
            <span className="nr-library-edition-label">ẤN BẢN NGÀY {item.issueDate}</span>
            <strong className="nr-library-logo">NEWS<br/>RADAR</strong>
            {item.coverImage ? <img src={item.coverImage} alt="" loading="lazy" className="nr-library-cover"
              onError={(e) => { e.currentTarget.style.display = "none"; }}/> : <div className="nr-library-ornament" aria-hidden="true">✦</div>}
            <h2>{item.headline}</h2>
            <span className="nr-library-date">{formatIssue(item.issueDate)}</span>
            <span className="nr-library-stats">{item.articleCount} tin · {item.sourceCount} nguồn</span>
            <span className="nr-library-open">MỞ SỐ BÁO →</span>
            </Link>
            <Link className="nr-library-print-link" href={printEditionHref(item.issueDate)}>In / Lưu PDF ↗</Link>
          </article>)}
        </section>}
    <div className="nr-library-pagination">
      <button type="button" disabled={loading || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Trước</button>
      <span>Trang {page}{archive ? " / " + Math.max(1, Math.ceil(archive.total / archive.pageSize)) : ""}</span>
      <button type="button" disabled={loading || !archive?.hasNext} onClick={() => setPage((value) => value + 1)}>Tiếp →</button>
    </div>
    <footer className="nr-library-footer"><strong>NEWS RADAR.</strong><span>Các số báo dựa trên RSS; bản quyền bài viết thuộc nhà xuất bản gốc.</span></footer>
  </main>;
}
