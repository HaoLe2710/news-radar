"use client";

import { useEffect, useState } from "react";

type Article = {
  id: number;
  title: string;
  url: string;
  summary: string | null;
  image_url: string | null;
  published_at: string | null;
  source: string;
  region: "vn" | "world";
  category: string;
};

type NewsResponse = { data: Article[]; count: number; total: number; page: number; pageSize: number; totalPages: number };
type Region = "all" | "vn" | "world";
type Period = "all" | "24h";
type RelatedStory = {
  id: number;
  headline: string;
  image_url: string | null;
  region: string;
  category: string;
  articleCount: number;
  articles: { id: number; title: string; url: string; source: string; published_at: string | null }[];
};
type NewsStats = {
  totalArticles: number;
  last24h: number;
  vn24h: number;
  world24h: number;
  activeSources: number;
  recentlyFetchedSources: number;
  lastFetchedAt: string | null;
};

const API_URL = (process.env.NEXT_PUBLIC_NEWS_API_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const PAGE_SIZE = 20;
const CATEGORY_LABELS: Record<string, string> = {
  all: "Tất cả lĩnh vực",
  general: "Tin tổng hợp",
  technology: "Công nghệ",
  business: "Kinh tế",
  science: "Khoa học",
  sports: "Thể thao",
  education: "Giáo dục",
};

function formatDate(value: string | null): string {
  if (!value) return "Chưa rõ thời gian";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa rõ thời gian";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function categoryName(slug: string): string {
  return CATEGORY_LABELS[slug] ?? slug;
}

function RegionLabel({ region }: { region: Article["region"] }) {
  return <span className={`region-tag region-${region}`}>{region === "vn" ? "Việt Nam" : "Thế giới"}</span>;
}

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [region, setRegion] = useState<Region>("all");
  const [period, setPeriod] = useState<Period>("all");
  const [stats, setStats] = useState<NewsStats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [relatedStories, setRelatedStories] = useState<RelatedStory[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [category, setCategory] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedKeyword(keyword), 350);
    return () => clearTimeout(timeout);
  }, [keyword]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadRelatedStories() {
      try {
        const response = await fetch(`${API_URL}/api/story-groups?region=${region}`, {
          signal: controller.signal, cache: "no-store",
        });
        if (!response.ok) throw new Error("Unable to load story groups");
        const payload: { data: RelatedStory[] } = await response.json();
        if (!controller.signal.aborted) setRelatedStories(Array.isArray(payload.data) ? payload.data : []);
      } catch {
        if (!controller.signal.aborted) setRelatedStories([]);
      }
    }
    void loadRelatedStories();
    return () => controller.abort();
  }, [refreshKey, region]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadStats() {
      try {
        const response = await fetch(`${API_URL}/api/stats`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Cannot fetch news stats");
        const payload: NewsStats = await response.json();
        if (!controller.signal.aborted) {
          setStats(payload);
          setStatsError(false);
        }
      } catch {
        if (!controller.signal.aborted) setStatsError(true);
      }
    }
    void loadStats();
    return () => controller.abort();
  }, [refreshKey]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadNews() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          region, category, period, q: debouncedKeyword, page: String(page), pageSize: String(PAGE_SIZE),
        });
        const response = await fetch(`${API_URL}/api/news?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`API trả về HTTP ${response.status}`);
        const payload: NewsResponse = await response.json();
        if (!Array.isArray(payload.data)) throw new Error("Định dạng dữ liệu API không hợp lệ");
        setArticles(payload.data);
        setTotal(payload.total);
        setTotalPages(payload.totalPages);
        setUpdatedAt(new Date());
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Không tải được tin tức");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadNews();
    return () => controller.abort();
  }, [refreshKey, region, category, period, debouncedKeyword, page]);

  const categories = ["general", "technology", "business", "science", "sports", "education"];
  const filtered = articles;

  const featured = page === 1 ? filtered[0] : undefined;
  const secondary = page === 1 ? filtered.slice(1, 3) : [];
  const rest = page === 1 ? filtered.slice(3) : filtered;

  function refresh() {
    setRefreshKey((key) => key + 1);
  }

  return (
    <div className="site-shell">
      <div className="utility-bar">
        <span>THE DAILY SIGNAL · PERSONAL NEWS DESK</span>
        <span>Đọc nhanh những gì đáng chú ý</span>
      </div>

      <header className="masthead">
        <div className="masthead-title-row">
          <div className="brand-mark" aria-hidden="true">NR.</div>
          <div>
            <p className="eyebrow">Your world, in focus.</p>
            <h1>NEWS RADAR</h1>
            <p className="masthead-subtitle">Một góc nhìn tổng hợp về Việt Nam &amp; thế giới.</p>
          </div>
        </div>
        <button className="refresh-button" onClick={refresh} disabled={loading} type="button">
          <span aria-hidden="true">↻</span> {loading ? "Đang tải..." : "Tải lại tin"}
        </button>
      </header>

      <nav className="site-nav" aria-label="Khu vực tin tức">
        <div className="region-tabs">
          {([ ["all", "Tất cả"], ["vn", "Việt Nam"], ["world", "Thế giới"] ] as const).map(([value, label]) => (
            <button key={value} type="button" className={`nav-tab ${region === value ? "active" : ""}`} onClick={() => { setRegion(value); setPage(1); }}>
              {label}
            </button>
          ))}
        </div>
        <div className="nav-count">{total} bài trong kho tin</div>
      </nav>

      <main>
        <section className="intro-strip" aria-label="Giới thiệu">
          <div>
            <p className="section-kicker">TODAY'S EDITION</p>
            <h2>Những câu chuyện đáng chú ý</h2>
            <p>Chọn khu vực, lĩnh vực hoặc tìm kiếm để khám phá tin mới từ nhiều nguồn.</p>
          </div>
          <div className="edition-stamp">
            <span>BẢN TIN</span>
            <strong>{new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "long", year: "numeric" }).format(new Date())}</strong>
          </div>
        </section>

        <section className="daily-stats" aria-label="Thống kê tin tức">
          <div className="daily-stat">
            <span>TIN TRONG 24 GIỜ</span>
            <strong>{stats ? stats.last24h : "—"}</strong>
            <small>{stats ? `Việt Nam ${stats.vn24h} · Thế giới ${stats.world24h}` : "Đang tải thống kê"}</small>
          </div>
          <div className="daily-stat">
            <span>NGUỒN VỪA ĐỒNG BỘ</span>
            <strong>{stats ? `${stats.recentlyFetchedSources}/${stats.activeSources}` : "—"}</strong>
            <small>Ghi nhận trong 3 giờ gần nhất</small>
          </div>
          <div className="daily-stat">
            <span>TỔNG SỐ BÀI ĐÃ LƯU</span>
            <strong>{stats ? stats.totalArticles : "—"}</strong>
            <small>{stats?.lastFetchedAt ? `Lần lấy tin gần nhất: ${formatDate(stats.lastFetchedAt)}` : "Chưa có lịch sử lấy tin"}</small>
          </div>
        </section>
        {statsError ? <p className="stats-warning">Không tải được thống kê. Kiểm tra API /api/stats.</p> : null}

        <div className="period-bar" role="group" aria-label="Khoảng thời gian tin tức">
          <span>Xem tin theo thời gian</span>
          <div className="period-buttons">
            <button type="button" className={period === "all" ? "active" : ""}
              aria-pressed={period === "all"} onClick={() => { setPeriod("all"); setPage(1); }}>Tất cả</button>
            <button type="button" className={period === "24h" ? "active" : ""}
              aria-pressed={period === "24h"} onClick={() => { setPeriod("24h"); setPage(1); }}>24 giờ qua</button>
          </div>
        </div>

        {relatedStories.length > 0 && !debouncedKeyword && category === "all" && period === "all" ? (
          <section className="related-section" aria-label="Tin cùng sự kiện">
            <div className="section-heading">
              <span>TIN LIÊN QUAN · NHIỀU NGUỒN</span>
              <span>GOM THEO TIÊU ĐỀ · 72 GIỜ</span>
            </div>
            <div className="related-grid">
              {relatedStories.map((story) => (
                <article className="related-story" key={story.id}>
                  <span className="related-count">{story.articleCount} bài liên quan</span>
                  <h3>{story.headline}</h3>
                  <div className="related-links">
                    {story.articles.map((article) => (
                      <a key={article.id} href={article.url} target="_blank" rel="noopener noreferrer">
                        <strong>{article.source}</strong> · {article.title} ↗
                      </a>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <p className="related-disclaimer">Nhóm dựa trên độ giống tiêu đề, không khẳng định các bài cùng một sự kiện.</p>
          </section>
        ) : null}

        <div className="filter-bar">
          <label className="search-wrap">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <span className="sr-only">Tìm kiếm tin tức</span>
            <input type="search" placeholder="Tìm tiêu đề, từ khóa hoặc nguồn báo..." value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1); }} />
          </label>
          <label className="category-wrap">
            <span className="sr-only">Lọc theo lĩnh vực</span>
            <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
              <option value="all">Tất cả lĩnh vực</option>
              {categories.map((slug) => <option key={slug} value={slug}>{categoryName(slug)}</option>)}
            </select>
          </label>
        </div>

        {error ? (
          <div className="notice error-notice" role="alert">
            <strong>Không kết nối được Cloudflare Worker.</strong>
            <p>{error}</p>
            <p>Kiểm tra terminal đang chạy <code>npx wrangler dev --test-scheduled</code> tại <code>apps/api</code>, rồi nhấn “Tải lại tin”.</p>
          </div>
        ) : null}

        {loading && articles.length === 0 ? (
          <div className="notice">Đang tải bản tin từ Cloudflare D1...</div>
        ) : null}

        {!loading && !error && filtered.length === 0 ? (
          <div className="notice">
            <strong>Chưa có bài phù hợp.</strong>
            <p>Thử đổi khu vực, lĩnh vực hoặc từ khóa. Nếu database chưa có bài, hãy kích hoạt Scheduled Handler của Worker trước.</p>
          </div>
        ) : null}

        {featured ? (
          <>
            <div className="section-heading"><span>01 / TIÊU ĐIỂM</span><span>{period === "24h" ? "TIN MỚI TRONG 24 GIỜ" : "SELECTED STORIES"}</span></div>
            <section className="lead-layout" aria-label="Tin nổi bật">
              <article className="lead-story">
                {featured.image_url ? (
                  <img className="lead-photo" src={featured.image_url} alt="" loading="eager"
                    onError={(event) => { event.currentTarget.style.display = "none"; }} />
                ) : null}
                <div className="lead-decor" aria-hidden="true"><span>RADAR</span><span>●</span></div>
                <div className="lead-content">
                  <div className="meta-row"><RegionLabel region={featured.region} /><span>{categoryName(featured.category)}</span></div>
                  <h3><a href={featured.url} target="_blank" rel="noopener noreferrer">{featured.title}</a></h3>
                  <p className="lead-summary">{featured.summary || "Mở bài viết gốc để đọc nội dung đầy đủ."}</p>
                  <div className="lead-footer"><span>{featured.source} · {formatDate(featured.published_at)}</span><a href={featured.url} target="_blank" rel="noopener noreferrer">Đọc bài gốc ↗</a></div>
                </div>
              </article>
              <div className="secondary-stories">
                {secondary.map((article, index) => (
                  <article className="side-story" key={article.id}>
                    <span className="story-index">0{index + 2}</span>
                    <div className="meta-row"><RegionLabel region={article.region} /><span>{categoryName(article.category)}</span></div>
                    <h3><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a></h3>
                    <p>{article.summary || "Mở bài viết gốc để đọc thêm."}</p>
                    <div className="source-line">{article.source} · {formatDate(article.published_at)}</div>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {rest.length > 0 ? (
          <section className="latest-section" aria-label="Tin mới">
            <div className="section-heading"><span>02 / DÒNG TIN MỚI</span><span>THE LATEST</span></div>
            <div className="news-grid">
              {rest.map((article, index) => (
                <article className="news-card" key={article.id}>
                  {article.image_url ? (
                    <img className="card-photo" src={article.image_url} alt="" loading="lazy"
                      onError={(event) => { event.currentTarget.style.display = "none"; }} />
                  ) : null}
                  <div className="card-topline"><span>{String((page - 1) * PAGE_SIZE + index + (page === 1 ? 4 : 1)).padStart(2, "0")}</span><RegionLabel region={article.region} /></div>
                  <p className="card-category">{categoryName(article.category)}</p>
                  <h3><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a></h3>
                  <p className="card-summary">{article.summary || "Xem chi tiết tại nguồn tin gốc."}</p>
                  <div className="card-footer"><span>{article.source}</span><time dateTime={article.published_at ?? undefined}>{formatDate(article.published_at)}</time></div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {totalPages > 1 ? (
          <nav className="pagination" aria-label="Phân trang tin tức">
            <button type="button" disabled={loading || page === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}>← Trang trước</button>
            <span>Trang {page} / {totalPages}</span>
            <button type="button" disabled={loading || page >= totalPages}
              onClick={() => setPage((value) => value + 1)}>Trang tiếp →</button>
          </nav>
        ) : null}

        <div className="feed-footer">Dữ liệu từ các nguồn RSS. Tiêu đề và liên kết dẫn về nhà xuất bản gốc. {updatedAt ? `Tải dữ liệu lúc ${updatedAt.toLocaleTimeString("vi-VN")}.` : ""} Đang hiển thị {articles.length} trong tổng số {total} bài phù hợp.</div>
      </main>

      <footer className="site-footer"><strong>NEWS RADAR.</strong><span>Built with Next.js · Cloudflare Workers · D1</span></footer>
    </div>
  );
}
