"use client";

import { newsTitle, newsSummary, isTranslated } from "../../lib/localized-news";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import OfflineIssueButton from "../../components/OfflineIssueButton";
import { getOfflineIssue, newestOfflineIssue, offlineKey, getReadingPage, setReadingPage } from "../../lib/offline-library";
import { printEditionHref } from "../../lib/print-edition";
import {
  DEFAULT_RADAR_PREFERENCES, RADAR_STORAGE_KEY, RADAR_TOPICS, parseRadarPreferences,
  type RadarPreferences,
} from "../../lib/my-radar";
import {
  buildEditionPages, editionSpreads, indexForPage, offsetSpread,
  type EditionArticle, type EditionPage, type NewspaperEdition,
} from "../../lib/newspaper-pages";

const API = (process.env.NEXT_PUBLIC_NEWS_API_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const CATEGORIES: Record<string, string> = {
  technology: "Công nghệ", business: "Kinh tế", science: "Khoa học",
  general: "Thời sự", sports: "Thể thao", education: "Giáo dục",
};
function dateLabel(day: string): string {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" })
    .format(new Date(day + "T12:00:00+07:00"));
}
function OriginalSource({ article }: { article: EditionArticle }) {
  return <a className="nr-source" href={article.url} target="_blank" rel="noopener noreferrer">
    {article.source} · Đọc bài gốc ↗
  </a>;
}
function NewspaperStory({ article, number }: { article: EditionArticle; number: number }) {
  const excerpt = newsSummary(article);
  return <article className="nr-report">
    <span className="nr-category">{String(number).padStart(2, "0")} / {CATEGORIES[article.category] ?? "Tin tức"}</span>
    <h3><a href={article.url} target="_blank" rel="noopener noreferrer">{newsTitle(article)}</a></h3>
    <div className="nr-news-byline">{isTranslated(article) ? "VI · AI dịch RSS · " : ""}{article.source} · {article.published_at ?
      new Intl.DateTimeFormat("vi-VN", {day:"2-digit",month:"2-digit",year:"numeric",timeZone:"Asia/Ho_Chi_Minh"}).format(new Date(article.published_at)) : "Bản tin RSS"}</div>
    {article.image_url ? <figure className="nr-report-picture">
      <img src={article.image_url} alt={"Hình minh họa từ " + article.source} loading="lazy"
        onError={e=>{e.currentTarget.style.display="none";}}/>
      <figcaption className="nr-news-caption">Ảnh được cung cấp bởi nguồn RSS · {article.source}</figcaption>
    </figure> : null}
    <div className="nr-article-body"><p>{excerpt || "Bản lưu chưa có phần mô tả. Đọc thêm ở nguồn tin gốc."}</p></div>
    <div className="nr-article-note">{isTranslated(article) ? "Bản tiếng Việt do AI dịch từ RSS · đối chiếu bài gốc." : article.editorialSummary ?
      "AI tóm lược từ mô tả RSS; không phải toàn văn bài báo." : "Trích nội dung mô tả RSS; không phải toàn văn bài báo."}</div>
    {article.relatedSources?.length ? <div className="nr-related-sources"><strong>Cùng sự kiện:</strong> {article.relatedSources.map(source=>
      <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.source} ↗</a>)}</div> : null}
    <OriginalSource article={article}/>
  </article>;
}
function PageContents({ page, edition }: { page: EditionPage; edition: NewspaperEdition }) {
  if (page.kind === "cover") return <>
    <p className="nr-cover-eyebrow">TỜ BÁO TỔNG HỢP ĐỘC LẬP · VIỆT NAM VÀ THẾ GIỚI</p>
    <div className="nr-cover-name">NEWS RADAR</div>
    <div className="nr-cover-band"><span>SỐ {edition.issueDate}</span><span>NGÀY TIN {edition.coverageDate}</span><span>{edition.sourceCount} NGUỒN · {edition.articleCount} BÀI</span></div>
    <div className="nr-cover-grid">
      <section className="nr-cover-lead">
        <span className="nr-category">TRANG NHẤT · TIN TIÊU ĐIỂM</span>
        <h2><a href={edition.lead.url} target="_blank" rel="noopener noreferrer">{newsTitle(edition.lead)}</a></h2>
        {edition.lead.image_url ? <img className="nr-cover-image" src={edition.lead.image_url} alt="" loading="eager"
          onError={(e) => { e.currentTarget.style.display = "none"; }}/> : null}
        <p>{newsSummary(edition.lead) || "Chi tiết có tại nguồn báo gốc."}</p>
        <div className="nr-news-byline">{edition.lead.source} · Bản tin theo mô tả RSS</div>
        {edition.lead.editorialSummary ? <small className="nr-ai-note">Tóm lược bởi AI từ RSS · kiểm chứng tại nguồn gốc</small> : null}
        {edition.lead.relatedSources?.length ? <div className="nr-related-sources"><strong>Cùng sự kiện:</strong> {edition.lead.relatedSources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.source} ↗</a>)}</div> : null}
        <OriginalSource article={edition.lead}/>
      </section>
      <aside className="nr-editor-note">
        <span className="nr-category">LỜI TÒA SOẠN</span>
        <h3>{edition.title}</h3>
        <p>{edition.summary}</p>
        {edition.editorial ? <div className="nr-editorial-provenance">{edition.editorial.mode === "ai" ? "✦ AI Editorial Engine · Biên tập có kiểm tra" : "Biên tập từ RSS · AI dự phòng"} </div> : null}
        <small>{edition.summaryMode === "ai" ? "Bản tóm lược có hỗ trợ AI từ dữ liệu RSS." : "Tổng hợp từ tiêu đề và mô tả RSS."} Không thay thế nội dung gốc.</small>
        <div className="nr-cover-folio">BẢN TIN HẰNG NGÀY · {dateLabel(edition.issueDate)}</div>
      </aside>
    </div>
    {edition.secondary?.length ? <div className="nr-cover-teasers" aria-label="Tin khác trên trang nhất">
      {edition.secondary.slice(0,3).map(article=><article key={article.id}>
        <span className="nr-category">{CATEGORIES[article.category] ?? "Tin tức"}</span>
        <h3><a href={article.url} target="_blank" rel="noopener noreferrer">{newsTitle(article)}</a></h3>
        {newsSummary(article) ? <p>{newsSummary(article)}</p> : null}
        <small>{article.source}</small>
      </article>)}
    </div> : null}
  </>;
  if (page.kind === "stories") return <>
    <div className="nr-inside-header"><span>NEWS RADAR / {edition.issueDate}</span><span>{page.subtitle}</span></div>
    <div className="nr-section-kicker">THỜI SỰ / NHỮNG GÓC NHÌN</div>
    <h2 className="nr-section-title">{page.title}</h2>
    <div className="nr-report-list">{page.articles.map((article, index) =>
      <NewspaperStory key={article.id} article={article} number={index + 1}/>)}</div>
  </>;
  if (page.kind === "briefs") return <>
    <div className="nr-inside-header"><span>NEWS RADAR / {edition.issueDate}</span><span>TIN NHANH · TRONG NGÀY</span></div>
    <div className="nr-section-kicker">BẢN TIN NGẮN</div>
    <h2 className="nr-section-title">{page.title}</h2>
    <p className="nr-section-description">Những diễn biến được chọn từ các nguồn RSS của kỳ báo này.</p>
    <div className="nr-brief-list">{page.articles.map((article, index) => <div key={article.id} className="nr-brief-item">
      <span className="nr-brief-index">{String(index + 1).padStart(2, "0")}</span>
      <div><h3><a href={article.url} target="_blank" rel="noopener noreferrer">{newsTitle(article)}</a></h3>
        <p>{newsSummary(article) || "Bản lưu chưa có phần mô tả."}</p><div className="nr-news-byline">{article.source} · Trích nội dung RSS</div><OriginalSource article={article}/></div>
    </div>)}</div>
  </>;
  return <>
    <div className="nr-inside-header"><span>NEWS RADAR / {edition.issueDate}</span><span>ẤN BẢN CÁ NHÂN</span></div>
    <div className="nr-section-kicker">MY RADAR</div>
    <h2 className="nr-section-title">{page.title}</h2>
    <p className="nr-section-description">Tin chọn lọc theo sở thích trên thiết bị của bạn. Nội dung số báo gốc vẫn cố định.</p>
    {!page.enabled ? <div className="nr-empty">My Radar đang tắt. Hãy bật lại tại trang chủ.</div>
      : page.articles.length === 0 ? <div className="nr-empty">Chưa có tin phù hợp trong số báo này. Bạn có thể chọn thêm chủ đề tại trang chủ.</div>
      : <div className="nr-radar-list">{page.articles.map(({ article, topic }) => <section key={article.id}>
          <span className="nr-category">{RADAR_TOPICS.find((t) => t.id === topic)?.label ?? topic} · {article.source}</span>
          <h3><a href={article.url} target="_blank" rel="noopener noreferrer">{newsTitle(article)}</a></h3>
          <p>{newsSummary(article) || "Bản lưu chưa có phần mô tả."}</p><OriginalSource article={article}/>
        </section>)}</div>}
    <p className="nr-disclaimer">Nội dung của bản tin được tổng hợp từ tiêu đề và mô tả RSS; liên kết dẫn về trang báo xuất bản gốc.</p>
  </>;
}

export default function EditionPage() {
  const [edition, setEdition] = useState<NewspaperEdition | null>(null);
  const [requestedDate, setRequestedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fromOffline, setFromOffline] = useState(false);
  const [wide, setWide] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [preferences, setPreferences] = useState<RadarPreferences>(DEFAULT_RADAR_PREFERENCES);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 920px)");
    const update = () => setWide(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const date = params.get("date");
    const normalized = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
    const explicitPage = params.has("page");
    const requestedPage = Number(params.get("page") ?? 1);
    setRequestedDate(normalized);
    setCurrentPage(Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1);
    try { setPreferences(parseRadarPreferences(window.localStorage.getItem(RADAR_STORAGE_KEY))); } catch { /* optional */ }
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(API + (normalized ? "/api/editions/" + normalized : "/api/editions/latest"), {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Worker HTTP " + response.status);
        const payload: { data: NewspaperEdition | null } = await response.json();
        if (!controller.signal.aborted) {
          setEdition(payload.data ?? null);
          if (payload.data && !explicitPage) setCurrentPage(getReadingPage(offlineKey("daily", payload.data.issueDate)));
        }
      } catch {
        try {
          const saved = normalized ? await getOfflineIssue(offlineKey("daily", normalized)) : await newestOfflineIssue("daily");
          if (!controller.signal.aborted && saved?.kind === "daily") {
            setEdition(saved.payload); setFromOffline(true);
            if (!explicitPage) setCurrentPage(getReadingPage(saved.key));
          } else if (!controller.signal.aborted) setError(true);
        } catch { if (!controller.signal.aborted) setError(true); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const pages = useMemo(() => edition ? buildEditionPages(edition, preferences) : [], [edition, preferences]);
  const spreads = useMemo(() => editionSpreads(pages.length, wide), [pages.length, wide]);
  const spreadIndex = indexForPage(spreads, currentPage);
  const visiblePages = spreads[spreadIndex] ?? [];

  function move(delta: number) {
    if (!spreads.length) return;
    const nextIndex = offsetSpread(spreadIndex, delta, spreads.length);
    const nextPage = (spreads[nextIndex]?.[0] ?? 0) + 1;
    if (nextPage === currentPage) return;
    setCurrentPage(nextPage);
    if (edition) setReadingPage(offlineKey("daily",edition.issueDate),nextPage);
    const url = new URL(window.location.href);
    url.searchParams.set("page", String(nextPage));
    window.history.replaceState(null, "", url.pathname + url.search);
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || ["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement)?.tagName)) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        move(event.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
    // The handler follows the current page and viewport spread.
  });

  return <main className="nr-reader-shell">
    <nav className="nr-reader-top" aria-label="Điều hướng ấn bản">
      <Link href="/">← Trang tin</Link>
      <strong>NEWS RADAR <span>· NEWSPAPER</span></strong>
      <Link href="/edition/archive/">Thư viện số báo ↗</Link>
    </nav>
    {loading ? <div className="nr-reader-message">Đang mở ấn bản...</div>
    : error ? <div className="nr-reader-message" role="alert">Không tải được số báo. Hãy kiểm tra kết nối Worker hoặc thử lại sau.</div>
    : !edition ? <div className="nr-reader-message">Số báo {requestedDate ?? "mới nhất"} chưa được xuất bản. <Link href="/edition/archive/">Xem thư viện số báo đã có →</Link></div>
    : <>
      {fromOffline ? <p className="nr-offline-banner" role="status">Đang đọc bản đã lưu trên thiết bị · Tin gốc và ảnh có thể cần Internet.</p> : null}
      <div className="nr-reader-intro">
        <div><span className="nr-reader-eyebrow">ẤN BẢN SỐ · {edition.issueDate}</span>
          <h1>Ấn bản báo ngày</h1>
          <p>{dateLabel(edition.issueDate)} · Tin tức ngày {edition.coverageDate} · {edition.sourceCount} nguồn</p>
        </div>
        <div className="nr-reader-print-actions"><OfflineIssueButton kind="daily" issue={edition}/><Link href="/library/">Tủ báo của tôi ↗</Link><span>← → để chuyển trang · Vuốt ngang trên điện thoại</span><Link href={printEditionHref(edition.issueDate)}>In / Lưu PDF ↗</Link></div>
      </div>
      <nav className="nr-reader-pagination" aria-label="Lật trang báo">
        <button type="button" disabled={spreadIndex === 0} onClick={() => move(-1)}>← Trang trước</button>
        <span>Trang {visiblePages.map((i) => i + 1).join("–")} / {pages.length}</span>
        <button type="button" disabled={spreadIndex >= spreads.length - 1} onClick={() => move(1)}>Trang tiếp →</button>
      </nav>
      <div className={"nr-book " + (visiblePages.length === 1 ? "nr-book-single" : "")}
        onTouchStart={(e) => { touchStart.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => {
          if (touchStart.current === null) return;
          const end = e.changedTouches[0]?.clientX ?? touchStart.current;
          const distance = end - touchStart.current;
          touchStart.current = null;
          if (Math.abs(distance) > 70) move(distance < 0 ? 1 : -1);
        }}>
        {visiblePages.map((index) => {
          const page = pages[index];
          return <article key={page.id} className="nr-sheet nr-page-turn" aria-label={"Trang " + (index + 1) + ": " + page.title}>
            <div className="nr-sheet-body"><PageContents page={page} edition={edition}/></div>
            <footer className="nr-sheet-footer"><span>NEWS RADAR · {edition.issueDate}</span><span>{index + 1}</span></footer>
          </article>;
        })}
      </div>
      <div className="nr-reader-bottom">
        <div className="nr-page-list" aria-label="Mục lục ấn bản">
          {pages.map((page, index) => <button type="button" key={page.id}
            aria-current={visiblePages.includes(index) ? "page" : undefined}
            onClick={() => {
              setCurrentPage(index + 1);
              setReadingPage(offlineKey("daily",edition.issueDate),index+1);
              const url = new URL(window.location.href);
              url.searchParams.set("page", String(index + 1));
              window.history.replaceState(null, "", url.pathname + url.search);
            }}>{String(index + 1).padStart(2, "0")} {page.title}</button>)}
        </div>
        <p>Mỗi số báo được lưu cố định theo ngày phát hành. Bài viết mở về nguồn báo gốc.</p>
      </div>
    </>}
  </main>;
}
