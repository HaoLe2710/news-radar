"use client";

import { useEffect, useState } from "react";
import { DEFAULT_RADAR_PREFERENCES, RADAR_STORAGE_KEY, RADAR_TOPICS, getRadarQueries, parseRadarPreferences, selectRadarStories, type RadarPreferences, type RadarStory } from "../lib/my-radar";

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
type DailyBrief = {
  date: string;
  overview: string;
  mode: "ai" | "headlines";
  createdAt: string;
  articles: {
    id: number; title: string; url: string; source: string;
    category: string; published_at: string | null;
  }[];
};
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
  const [radarPrefs, setRadarPrefs] = useState<RadarPreferences>(DEFAULT_RADAR_PREFERENCES);
  const [radarReady, setRadarReady] = useState(false);
  const [radarStories, setRadarStories] = useState<RadarStory[]>([]);
  const [radarLoading, setRadarLoading] = useState(false);
  const [radarError, setRadarError] = useState(false);
  const [region, setRegion] = useState<Region>("all");
  const [period, setPeriod] = useState<Period>("all");
  const [stats, setStats] = useState<NewsStats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [dailyBrief, setDailyBrief] = useState<DailyBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(true);
  const [briefError, setBriefError] = useState(false);
  const [relatedStories, setRelatedStories] = useState<RelatedStory[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [relatedError, setRelatedError] = useState(false);
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
    try {
      setRadarPrefs(parseRadarPreferences(window.localStorage.getItem(RADAR_STORAGE_KEY)));
    } catch {
      // Private browsing or disabled storage: session-only preferences still work.
    }
    setRadarReady(true);
  }, []);

  useEffect(() => {
    if (!radarReady) return;
    try {
      window.localStorage.setItem(RADAR_STORAGE_KEY, JSON.stringify(radarPrefs));
    } catch {
      // Storage is optional; never prevent reading the news.
    }
  }, [radarPrefs, radarReady]);

  useEffect(() => {
    if (!radarReady || !radarPrefs.enabled || radarPrefs.topics.length === 0) {
      setRadarStories([]);
      setRadarError(false);
      setRadarLoading(false);
      return;
    }
    const controller = new AbortController();
    async function loadRadar() {
      setRadarLoading(true);
      setRadarError(false);
      const queries = getRadarQueries(radarPrefs.topics);
      try {
        const results = await Promise.allSettled(queries.map(async ({ category, q }) => {
          const params = new URLSearchParams({
            region: "all", category, q, period: "all", page: "1", pageSize: "50",
          });
          const response = await fetch(`${API_URL}/api/news?${params}`, {
            signal: controller.signal, cache: "no-store",
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload: NewsResponse = await response.json();
          if (!Array.isArray(payload.data)) throw new Error("Unexpected news payload");
          return payload.data;
        }));
        if (controller.signal.aborted) return;
        const successful = results.filter((result): result is PromiseFulfilledResult<Article[]> =>
          result.status === "fulfilled");
        if (successful.length === 0) {
          setRadarStories([]);
          setRadarError(true);
        } else {
          setRadarStories(selectRadarStories(successful.flatMap((result) => result.value), radarPrefs.topics));
          setRadarError(successful.length !== results.length);
        }
      } finally {
        if (!controller.signal.aborted) setRadarLoading(false);
      }
    }
    void loadRadar();
    return () => controller.abort();
  }, [radarReady, radarPrefs, refreshKey]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedKeyword(keyword), 350);
    return () => clearTimeout(timeout);
  }, [keyword]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadBrief() {
      setBriefLoading(true);
      setBriefError(false);
      try {
        const response = await fetch(`${API_URL}/api/daily-brief`, {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Brief API unavailable");
        const payload: { data: DailyBrief | null } = await response.json();
        if (!controller.signal.aborted) setDailyBrief(payload.data ?? null);
      } catch {
        if (!controller.signal.aborted) setBriefError(true);
      } finally {
        if (!controller.signal.aborted) setBriefLoading(false);
      }
    }
    void loadBrief();
    return () => controller.abort();
  }, [refreshKey]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadRelatedStories() {
      setRelatedLoading(true);
      setRelatedError(false);
      try {
        const response = await fetch(`${API_URL}/api/story-groups?region=${region}`, {
          signal: controller.signal, cache: "no-store",
        });
        if (!response.ok) throw new Error("Unable to load story groups");
        const payload: { data: RelatedStory[] } = await response.json();
        if (!controller.signal.aborted) setRelatedStories(Array.isArray(payload.data) ? payload.data : []);
      } catch {
        if (!controller.signal.aborted) {
          setRelatedStories([]);
          setRelatedError(true);
        }
      } finally {
        if (!controller.signal.aborted) setRelatedLoading(false);
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

        <section className="edition-entry" aria-label="Số báo giấy hằng ngày">
          <div><strong>NEWS RADAR — ẤN BẢN BÁO GIẤY</strong><p>Chọn lọc tin tức thành một số báo cố định mỗi ngày, trình bày theo phong cách báo in.</p></div>
          <div className="edition-entry-actions"><a href="/edition/">Mở số báo hôm nay ↗</a><a href="/edition/archive/">Thư viện số báo</a></div>
        </section>

        <section className="daily-brief" aria-label="Điểm tin buổi sáng">
          <div className="section-heading">
            <span>DAILY BRIEF / ĐIỂM TIN BUỔI SÁNG</span>
            <span>{dailyBrief?.date ?? "BẢN TIN HẰNG NGÀY"}</span>
          </div>
          {briefLoading ? (
            <p className="brief-status">Đang tải bản tin...</p>
          ) : briefError ? (
            <p className="brief-status" role="status">Chưa kết nối được API bản tin. Kiểm tra Worker đã deploy Phase 8.</p>
          ) : dailyBrief ? (
            <div className="brief-content">
              <div className="brief-intro">
                <span className="brief-mode">{dailyBrief.mode === "ai" ? "TỔNG QUAN AI" : "TỔNG HỢP TỪ RSS"}</span>
                <h3>Thế giới và Việt Nam trong một lượt đọc</h3>
                <p>{dailyBrief.overview}</p>
                <small>Đây là điểm tin dựa trên tiêu đề và mô tả RSS, không thay thế bài viết gốc.</small>
              </div>
              <div className="brief-articles">
                {dailyBrief.articles.map((a, index) => (
                  <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <span><strong>{a.title}</strong><small>{a.source}</small></span>
                    <span aria-hidden="true">↗</span>
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <p className="brief-status">Bản tin đang được chuẩn bị. Hệ thống cần ít nhất 4 bài RSS của ngày hôm trước theo giờ Việt Nam; Cron sẽ tự thử lại trong lần cập nhật kế tiếp.</p>
          )}
        </section>

        <section className="my-radar" aria-label="Bản tin cá nhân My Radar">
          <div className="section-heading">
            <span>MY RADAR / DÀNH RIÊNG CHO BẠN</span>
            <span>LƯU SỞ THÍCH TRÊN THIẾT BỊ</span>
          </div>
          <div className="radar-preferences">
            <div className="radar-pref-heading">
              <div>
                <p className="section-kicker">YOUR PERSONAL EDITION</p>
                <h2>Bản tin theo sở thích</h2>
                <p>Ưu tiên các chủ đề bạn quan tâm. Bạn vẫn có thể xem toàn bộ tin ở bên dưới.</p>
              </div>
              <label className="radar-switch">
                <input type="checkbox" checked={radarPrefs.enabled}
                  onChange={(event) => setRadarPrefs((prev) => ({ ...prev, enabled: event.target.checked }))} />
                <span>Bật My Radar</span>
              </label>
            </div>
            <div className="radar-topics" role="group" aria-label="Chọn chủ đề ưu tiên">
              {RADAR_TOPICS.map((topic) => {
                const selected = radarPrefs.topics.includes(topic.id);
                return (
                  <button type="button" key={topic.id} aria-pressed={selected}
                    className={`radar-chip ${selected ? "selected" : ""}`}
                    onClick={() => setRadarPrefs((prev) => ({
                      ...prev,
                      topics: prev.topics.includes(topic.id)
                        ? prev.topics.filter((id) => id !== topic.id)
                        : [...prev.topics, topic.id],
                    }))}>
                    {selected ? "✓ " : "+ "}{topic.label}
                  </button>
                );
              })}
            </div>
            <p className="radar-note">AI được nhận diện từ tiêu đề và mô tả RSS; các chủ đề khác theo chuyên mục của nguồn. Không cần tài khoản.</p>
          </div>
          {radarReady && radarPrefs.enabled ? (
            radarPrefs.topics.length === 0 ? (
              <div className="radar-empty" role="status">Chọn ít nhất một chủ đề để tạo bản tin của bạn.</div>
            ) : radarLoading ? (
              <div className="radar-empty" role="status">Đang chọn tin phù hợp với sở thích...</div>
            ) : radarStories.length === 0 ? (
              <div className="radar-empty" role="status">Chưa tìm được tin phù hợp. Hãy thử chọn thêm chủ đề hoặc tải lại tin.</div>
            ) : (
              <>
                {radarError ? <p className="radar-warning" role="status">Một số nguồn chưa tải được; đang hiển thị các tin tìm thấy.</p> : null}
                <div className="radar-grid">
                  {radarStories.map(({ article, topic }) => (
                    <article className="radar-card" key={article.id}>
                      <div className="radar-card-meta"><span>{RADAR_TOPICS.find((item) => item.id === topic)?.label}</span><span>{article.region === "vn" ? "Việt Nam" : "Thế giới"}</span></div>
                      <h3><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a></h3>
                      <p>{article.summary || "Mở bài gốc để đọc thêm."}</p>
                      <div className="radar-card-footer"><span>{article.source}</span><time dateTime={article.published_at ?? undefined}>{formatDate(article.published_at)}</time></div>
                    </article>
                  ))}
                </div>
              </>
            )
          ) : radarReady ? (
            <div className="radar-empty" role="status">My Radar đang tắt. Bật lại khi bạn muốn xem tin theo sở thích.</div>
          ) : (
            <div className="radar-empty">Đang tải sở thích...</div>
          )}
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

        {!debouncedKeyword && category === "all" && period === "all" ? (
          <section className="related-section" aria-label="Tin cùng sự kiện">
            <div className="section-heading">
              <span>TIN LIÊN QUAN · NHIỀU NGUỒN</span>
              <span>{relatedLoading ? "ĐANG PHÂN TÍCH" : `${relatedStories.length} NHÓM TRONG 72 GIỜ`}</span>
            </div>
            {relatedLoading ? (
              <div className="related-empty">Đang kiểm tra tin liên quan từ các nguồn RSS...</div>
            ) : relatedError ? (
              <div className="related-empty" role="status">
                Không thể tải nhóm tin. Hãy xác nhận Worker đã deploy Phase 7 và endpoint
                <code> /api/story-groups </code> trả về HTTP 200.
              </div>
            ) : relatedStories.length === 0 ? (
              <div className="related-empty" role="status">
                Chưa phát hiện bài đủ giống nhau trong 72 giờ gần đây.
                Đây không phải lỗi: News Radar chỉ gom khi tiêu đề có bằng chứng trùng sự kiện đủ mạnh.
              </div>
            ) : (
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
            )}
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
