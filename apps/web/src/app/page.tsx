"use client";

import { useEffect, useMemo, useState } from "react";

type Article = {
  id: number;
  title: string;
  url: string;
  summary: string | null;
  published_at: string | null;
  source: string;
  region: "vn" | "world";
  category: string;
};

type NewsResponse = { data: Article[]; count: number };
type Region = "all" | "vn" | "world";

const API_URL = (process.env.NEXT_PUBLIC_NEWS_API_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const CATEGORY_LABELS: Record<string, string> = {
  all: "Tất cả lĩnh vực",
  general: "Tin tổng hợp",
  technology: "Công nghệ",
  business: "Kinh tế",
  science: "Khoa học",
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
  const [category, setCategory] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadNews() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/api/news?limit=50`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`API trả về HTTP ${response.status}`);
        const payload: NewsResponse = await response.json();
        if (!Array.isArray(payload.data)) throw new Error("Định dạng dữ liệu API không hợp lệ");
        setArticles(payload.data);
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
  }, [refreshKey]);

  const categories = useMemo(
    () => [...new Set(articles.map((article) => article.category))].sort(),
    [articles]
  );

  const filtered = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase("vi-VN");
    return articles.filter((article) => {
      const matchRegion = region === "all" || article.region === region;
      const matchCategory = category === "all" || article.category === category;
      const searchable = `${article.title} ${article.summary ?? ""} ${article.source}`.toLocaleLowerCase("vi-VN");
      return matchRegion && matchCategory && (!normalizedKeyword || searchable.includes(normalizedKeyword));
    });
  }, [articles, region, category, keyword]);

  const featured = filtered[0];
  const secondary = filtered.slice(1, 3);
  const rest = filtered.slice(3);

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
            <button key={value} type="button" className={`nav-tab ${region === value ? "active" : ""}`} onClick={() => setRegion(value)}>
              {label}
            </button>
          ))}
        </div>
        <div className="nav-count">{filtered.length} bài đang hiển thị</div>
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

        <div className="filter-bar">
          <label className="search-wrap">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <span className="sr-only">Tìm kiếm tin tức</span>
            <input type="search" placeholder="Tìm tiêu đề, từ khóa hoặc nguồn báo..." value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          </label>
          <label className="category-wrap">
            <span className="sr-only">Lọc theo lĩnh vực</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
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
            <div className="section-heading"><span>01 / TIÊU ĐIỂM</span><span>SELECTED STORIES</span></div>
            <section className="lead-layout" aria-label="Tin nổi bật">
              <article className="lead-story">
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
                  <div className="card-topline"><span>{String(index + 4).padStart(2, "0")}</span><RegionLabel region={article.region} /></div>
                  <p className="card-category">{categoryName(article.category)}</p>
                  <h3><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a></h3>
                  <p className="card-summary">{article.summary || "Xem chi tiết tại nguồn tin gốc."}</p>
                  <div className="card-footer"><span>{article.source}</span><time dateTime={article.published_at ?? undefined}>{formatDate(article.published_at)}</time></div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <div className="feed-footer">Dữ liệu từ các nguồn RSS. Tiêu đề và liên kết dẫn về nhà xuất bản gốc. {updatedAt ? `Tải dữ liệu lúc ${updatedAt.toLocaleTimeString("vi-VN")}.` : ""} Tìm kiếm chỉ áp dụng cho tối đa 50 bài mới nhất được API trả về.</div>
      </main>

      <footer className="site-footer"><strong>NEWS RADAR.</strong><span>Built with Next.js · Cloudflare Workers · D1</span></footer>
    </div>
  );
}
