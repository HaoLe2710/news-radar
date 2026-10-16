export type EditionArticle = {
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

export type NewspaperEdition = {
  id: string;
  issueDate: string;
  coverageDate: string;
  title: string;
  summary: string;
  summaryMode: "ai" | "rss";
  lead: EditionArticle;
  secondary: EditionArticle[];
  briefs: EditionArticle[];
  radarPool: EditionArticle[];
  articleCount: number;
  sourceCount: number;
  createdAt: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  technology: "Công nghệ", business: "Kinh tế", science: "Khoa học",
  general: "Thời sự", sports: "Thể thao", education: "Giáo dục",
};

export function coverageWindow(issueDate: string): { from: string; to: string; coverageDate: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) throw new Error("Invalid issue date");
  const end = new Date(issueDate + "T00:00:00+07:00");
  if (!Number.isFinite(end.getTime())) {
    throw new Error("Invalid issue date");
  }
  const start = new Date(end.getTime() - 86400000);
  const coverageDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(start);
  if (new Date(coverageDate + "T00:00:00+07:00").getTime() !== start.getTime()) {
    throw new Error("Invalid issue date");
  }
  return { from: start.toISOString(), to: end.toISOString(), coverageDate };
}

export function composeEdition(
  issueDate: string, rows: EditionArticle[],
  savedBrief: { overview: string; mode: "ai" | "headlines" } | null = null,
  createdAt = new Date().toISOString(),
): NewspaperEdition | null {
  // Snapshots contain only articles available for the previous completed
  // Vietnam calendar day. Never silently include today's live feed.
  if (rows.length < 4) return null;
  const unique = new Map<number, EditionArticle>();
  for (const article of rows) if (!unique.has(article.id)) unique.set(article.id, article);
  const sorted = [...unique.values()].sort((a, b) =>
    (Date.parse(b.published_at ?? "") || 0) - (Date.parse(a.published_at ?? "") || 0) || b.id - a.id
  );
  if (sorted.length < 4) return null;

  // Prefer a recent illustrated lead while keeping headline selection
  // deterministic for repeatable, immutable editions.
  const lead = sorted.find((article) => article.image_url && article.summary) ?? sorted[0];
  const used = new Set<number>([lead.id]);
  const byCategory = new Map<string, EditionArticle[]>();
  for (const article of sorted) {
    if (used.has(article.id)) continue;
    const pool = byCategory.get(article.category) ?? [];
    pool.push(article);
    byCategory.set(article.category, pool);
  }
  const secondary: EditionArticle[] = [];
  while (secondary.length < 6) {
    let added = false;
    for (const pool of byCategory.values()) {
      if (secondary.length >= 6) break;
      const article = pool.shift();
      if (!article) continue;
      secondary.push(article);
      used.add(article.id);
      added = true;
    }
    if (!added) break;
  }
  const remaining = sorted.filter((article) => !used.has(article.id));
  const briefs = remaining.slice(0, 6);
  for (const article of briefs) used.add(article.id);
  const radarPool = sorted.filter((article) => !used.has(article.id)).slice(0, 40);
  const included = [lead, ...secondary, ...briefs, ...radarPool];
  const subjects = [...new Set([lead, ...secondary].map((a) => CATEGORY_LABELS[a.category] ?? "Thời sự"))].slice(0, 4);
  const sourceCount = new Set(included.map((article) => article.source)).size;
  const fallback = "Ấn bản ngày " + issueDate + " điểm lại các chủ đề " +
    subjects.join(", ") + ". Tin tức được biên tập từ tiêu đề và mô tả RSS; " +
    "nhấn vào từng bài để đọc đầy đủ tại nguồn xuất bản.";
  const hasAi = savedBrief?.mode === "ai" && savedBrief.overview.trim().length >= 50;

  return {
    id: issueDate,
    issueDate,
    coverageDate: coverageWindow(issueDate).coverageDate,
    title: "Những chuyển động đáng chú ý",
    summary: hasAi ? savedBrief.overview.trim() : fallback,
    summaryMode: hasAi ? "ai" : "rss",
    lead, secondary, briefs, radarPool,
    articleCount: included.length, sourceCount, createdAt,
  };
}
