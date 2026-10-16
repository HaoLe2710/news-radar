"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DEFAULT_RADAR_PREFERENCES, RADAR_STORAGE_KEY, RADAR_TOPICS, parseRadarPreferences, type RadarPreferences } from "../../../lib/my-radar";
import { buildEditionPages, type EditionArticle, type EditionPage, type NewspaperEdition } from "../../../lib/newspaper-pages";
import { editionPrintSources, isValidIssueDate } from "../../../lib/print-edition";
import "./print.css";

const API_URL = (process.env.NEXT_PUBLIC_NEWS_API_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const CATEGORIES: Record<string, string> = {
  general: "Thời sự", technology: "Công nghệ", business: "Kinh tế",
  science: "Khoa học", education: "Giáo dục", sports: "Thể thao",
};

function issueDateLabel(day: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(day + "T12:00:00+07:00"));
}

function Source({ article }: { article: EditionArticle }) {
  return <a className="pe-article-source" href={article.url} target="_blank" rel="noopener noreferrer">
    {article.source} · Đọc bài gốc ↗
  </a>;
}

function PrintArticle({ article, order }: { article: EditionArticle; order: number }) {
  return <article className="pe-news-article">
    <span className="pe-kicker">{String(order).padStart(2, "0")} / {CATEGORIES[article.category] ?? "Tin tức"}</span>
    <h3><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a></h3>
    <p>{article.summary || "Thông tin chi tiết có tại nguồn xuất bản."}</p>
    <Source article={article}/>
  </article>;
}

function PrintPage({ page, edition }: { page: EditionPage; edition: NewspaperEdition }) {
  if (page.kind === "cover") return <>
    <div className="pe-top-caption">TỔNG HỢP TIN TỨC · VIỆT NAM &amp; THẾ GIỚI</div>
    <div className="pe-masthead">NEWS RADAR</div>
    <div className="pe-issue-line">
      <span>SỐ {edition.issueDate}</span><span>TIN NGÀY {edition.coverageDate}</span>
      <span>{edition.sourceCount} NGUỒN · {edition.articleCount} BÀI</span>
    </div>
    <div className="pe-cover-columns">
      <div className="pe-lead">
        <span className="pe-kicker">TRANG NHẤT / BÀI ĐÁNG CHÚ Ý</span>
        <h1><a href={edition.lead.url} target="_blank" rel="noopener noreferrer">{edition.lead.title}</a></h1>
        {edition.lead.image_url ? <img className="pe-cover-photo" src={edition.lead.image_url} alt=""
          onError={(event) => { event.currentTarget.style.display = "none"; }}/> : null}
        <p>{edition.lead.summary || "Mở bài báo gốc để đọc đầy đủ thông tin."}</p>
        <Source article={edition.lead}/>
      </div>
      <aside className="pe-editorial">
        <span className="pe-kicker">LỜI TÒA SOẠN</span>
        <h2>{edition.title}</h2>
        <p>{edition.summary}</p>
        <small>{edition.summaryMode === "ai" ? "Tóm lược có hỗ trợ AI, chỉ dựa trên dữ liệu RSS." :
          "Điểm tin dựa trên tiêu đề và mô tả RSS."} Xem nguồn gốc trước khi trích dẫn.</small>
        <div className="pe-cover-date">{issueDateLabel(edition.issueDate)}</div>
      </aside>
    </div>
  </>;

  if (page.kind === "stories") return <>
    <div className="pe-section-overline">{page.subtitle} · {edition.issueDate}</div>
    <h2 className="pe-section-title">{page.title}</h2>
    <div className="pe-story-columns">
      {page.articles.map((article, index) => <PrintArticle key={article.id} article={article} order={index + 1}/>)}
    </div>
  </>;

  if (page.kind === "briefs") return <>
    <div className="pe-section-overline">BẢN TIN NGẮN · {edition.issueDate}</div>
    <h2 className="pe-section-title">{page.title}</h2>
    <p className="pe-section-intro">Những chuyển động được biên tập từ các nguồn RSS trong kỳ báo này.</p>
    <div className="pe-brief-columns">
      {page.articles.map((article, index) => <div className="pe-brief" key={article.id}>
        <span className="pe-brief-number">{String(index + 1).padStart(2, "0")}</span>
        <div><h3><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a></h3>
          <p>{article.summary || "Xem bài báo gốc để biết thêm chi tiết."}</p><Source article={article}/></div>
      </div>)}
    </div>
  </>;

  return <>
    <div className="pe-section-overline">MY RADAR · CÁ NHÂN HÓA TRÊN THIẾT BỊ</div>
    <h2 className="pe-section-title">{page.title}</h2>
    <p className="pe-section-intro">Trang cá nhân lấy từ sở thích đã lưu trong trình duyệt; ấn bản gốc vẫn không thay đổi.</p>
    {!page.enabled ? <p className="pe-empty">My Radar đang tắt trong cài đặt của bạn.</p>
      : page.articles.length === 0 ? <p className="pe-empty">Số báo này chưa có tin trùng với chủ đề đã chọn.</p>
      : <div className="pe-personal-grid">{page.articles.map(({ article, topic }) => <article key={article.id}>
        <span className="pe-kicker">{RADAR_TOPICS.find((item) => item.id === topic)?.label ?? topic} · {article.source}</span>
        <h3><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a></h3>
        <p>{article.summary || "Mở bài báo gốc để biết chi tiết."}</p>
        <Source article={article}/>
      </article>)}</div>}
  </>;
}

export default function PrintEditionPage() {
  const [edition, setEdition] = useState<NewspaperEdition | null>(null);
  const [preferences, setPreferences] = useState<RadarPreferences>(DEFAULT_RADAR_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const date = new URLSearchParams(window.location.search).get("date");
    if (date && !isValidIssueDate(date)) {
      setError("Ngày ấn bản không hợp lệ. Hãy mở một số báo từ thư viện.");
      setLoading(false);
      return;
    }
    try {
      setPreferences(parseRadarPreferences(window.localStorage.getItem(RADAR_STORAGE_KEY)));
    } catch { /* Reading preferences are optional. */ }
    const controller = new AbortController();
    async function load() {
      try {
        const endpoint = date ? "/api/editions/" + date : "/api/editions/latest";
        const response = await fetch(API_URL + endpoint, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const json: { data: NewspaperEdition | null } = await response.json();
        if (!controller.signal.aborted) setEdition(json.data);
      } catch {
        if (!controller.signal.aborted) setError("Không tải được nội dung ấn bản từ Cloudflare Worker. Hãy thử lại sau.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const pages = useMemo(() => edition ? buildEditionPages(edition, preferences) : [], [edition, preferences]);
  const sources = useMemo(() => edition ? editionPrintSources(edition, preferences) : [], [edition, preferences]);

  return <main className="pe-root">
    <div className="pe-toolbar">
      <div>
        <Link href={edition ? "/edition/?date=" + edition.issueDate : "/edition/"}>← Về trình đọc</Link>
        <Link href="/edition/archive/">Thư viện số báo</Link>
      </div>
      <div className="pe-toolbar-center">
        <strong>NEWS RADAR · PRINT EDITION</strong>
        <span>{edition ? "Số " + edition.issueDate : "Bản xem trước in A4"}</span>
      </div>
      <button type="button" disabled={!edition || loading || !!error} onClick={() => window.print()}>
        In / Lưu PDF ↗
      </button>
    </div>
    {loading ? <div className="pe-message" role="status">Đang chuẩn bị bản in A4...</div>
      : error ? <div className="pe-message" role="alert">{error}</div>
      : !edition ? <div className="pe-message" role="status">Chưa có số báo để xuất PDF. Hãy thử mở một ấn bản đã phát hành trong thư viện.</div>
      : <>
        <div className="pe-guide">
          <strong>Ấn bản {issueDateLabel(edition.issueDate)}</strong>
          <span>Nhấn “In / Lưu PDF”, chọn <b>Save as PDF</b> (hoặc “Lưu dưới dạng PDF”). Khổ giấy A4, hướng dọc. Không cần cài thêm phần mềm.</span>
        </div>
        <div className="pe-preview">
          {pages.map((page, index) => <section className="pe-sheet" key={page.id} aria-label={"Trang " + (index + 1) + ": " + page.title}>
            <div className="pe-sheet-main"><PrintPage page={page} edition={edition}/></div>
            <footer className="pe-footer">
              <span>NEWS RADAR · {edition.issueDate} · TỪ RSS, CÓ DẪN NGUỒN</span>
              <span>{index + 1}</span>
            </footer>
          </section>)}
          <section className="pe-sheet pe-sources-sheet" aria-label="Danh mục nguồn">
            <div className="pe-sheet-main">
              <div className="pe-section-overline">PHỤ LỤC / NGUỒN THAM KHẢO</div>
              <h2 className="pe-section-title">Nguồn bài viết</h2>
              <p className="pe-section-intro">Liên kết sau dẫn tới trang gốc của các nhà xuất bản. News Radar chỉ biên tập tiêu đề và mô tả RSS, không sao chép toàn văn bài viết.</p>
              <ol className="pe-sources-list">
                {sources.map((article) => <li key={article.url}>
                  <strong>{article.title}</strong>
                  <span>{article.source}</span>
                  <a href={article.url} target="_blank" rel="noopener noreferrer">{article.url}</a>
                </li>)}
              </ol>
              <p className="pe-final-notice">Ấn bản ngày {edition.issueDate} · Tổng hợp thông tin từ {edition.sourceCount} nguồn báo. Trích dẫn vui lòng ghi rõ nhà xuất bản gốc.</p>
            </div>
            <footer className="pe-footer"><span>NEWS RADAR · DANH MỤC NGUỒN</span><span>{pages.length + 1}</span></footer>
          </section>
        </div>
        <div className="pe-end-controls">
          <button type="button" onClick={() => window.print()}>In / Lưu PDF</button>
          <Link href={"/edition/?date=" + edition.issueDate}>Quay lại đọc báo →</Link>
        </div>
      </>}
  </main>;
}
