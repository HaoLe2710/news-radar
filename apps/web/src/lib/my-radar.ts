export const RADAR_TOPICS = [
  { id: "ai", label: "AI" },
  { id: "technology", label: "Công nghệ" },
  { id: "business", label: "Kinh tế" },
  { id: "science", label: "Khoa học" },
  { id: "sports", label: "Thể thao" },
  { id: "education", label: "Giáo dục" },
  { id: "general", label: "Tin tổng hợp" },
] as const;

export type RadarTopic = (typeof RADAR_TOPICS)[number]["id"];
export type RadarPreferences = { enabled: boolean; topics: RadarTopic[] };
export type RadarArticle = {
  id: number;
  editorialSummary?: string;
  editorialScore?: number;
  relatedSources?: { title: string; source: string; url: string }[];
  titleVi?: string;
  summaryVi?: string;
  title: string;
  summary: string | null;
  url: string;
  image_url: string | null;
  source: string;
  region: "vn" | "world";
  category: string;
  published_at: string | null;
};
export type RadarStory = { article: RadarArticle; topic: RadarTopic };

export const RADAR_STORAGE_KEY = "news-radar:my-radar:v1";
export const DEFAULT_RADAR_PREFERENCES: RadarPreferences = {
  enabled: true,
  topics: ["ai", "technology", "business", "science"],
};

const TOPIC_IDS = new Set<string>(RADAR_TOPICS.map((topic) => topic.id));

// AI is a keyword-based topic, not a source category. Match whole terms to
// avoid accidental substring hits such as "hai", "tài" or "Thailand".
const AI_TERMS = /(?:^|[^\p{L}\p{N}])(?:ai|a\.i\.|trí tuệ nhân tạo|artificial intelligence|machine learning|học máy|deep learning|mô hình ngôn ngữ|mô hình ngôn ngữ lớn|generative ai|chatgpt|openai|llm|gemini ai|claude ai)(?=$|[^\p{L}\p{N}])/iu;

export function isAiArticle(article: Pick<RadarArticle, "title" | "summary">): boolean {
  return AI_TERMS.test(article.title + " " + (article.summary ?? ""));
}

export function parseRadarPreferences(raw: string | null): RadarPreferences {
  if (!raw) return { ...DEFAULT_RADAR_PREFERENCES, topics: [...DEFAULT_RADAR_PREFERENCES.topics] };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") throw new Error("Invalid preferences");
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.enabled !== "boolean" || !Array.isArray(candidate.topics)) {
      throw new Error("Invalid preference shape");
    }
    const topics = [...new Set(candidate.topics.filter(
      (topic): topic is RadarTopic => typeof topic === "string" && TOPIC_IDS.has(topic)
    ))];
    return { enabled: candidate.enabled, topics };
  } catch {
    return { ...DEFAULT_RADAR_PREFERENCES, topics: [...DEFAULT_RADAR_PREFERENCES.topics] };
  }
}

export function getRadarQueries(topics: RadarTopic[]): { category: string; q: string }[] {
  const queries: { category: string; q: string }[] = topics.filter((topic) => topic !== "ai").map((category) => ({ category, q: "" }));
  if (topics.includes("ai")) {
    // Fetch AI independently of the source's broad RSS category.
    queries.push(
      { category: "all", q: "AI" },
      { category: "all", q: "trí tuệ nhân tạo" },
      { category: "all", q: "ChatGPT" },
      { category: "all", q: "OpenAI" },
    );
  }
  return queries;
}

export function selectRadarStories(
  articles: RadarArticle[],
  topics: RadarTopic[],
  limit = 12,
): RadarStory[] {
  const unique = new Map<number, RadarArticle>();
  for (const article of articles) unique.set(article.id, article);
  const ordered = [...unique.values()].sort((a, b) =>
    (Date.parse(b.published_at ?? "") || 0) - (Date.parse(a.published_at ?? "") || 0)
    || b.id - a.id
  );
  const pools = new Map<RadarTopic, RadarArticle[]>();
  for (const topic of topics) {
    pools.set(topic, ordered.filter((article) =>
      topic === "ai" ? isAiArticle(article) : article.category === topic
    ));
  }
  const result: RadarStory[] = [];
  const used = new Set<number>();
  while (result.length < limit) {
    let added = false;
    for (const topic of topics) {
      if (result.length >= limit) break;
      const pool = pools.get(topic) ?? [];
      const next = pool.find((article) => !used.has(article.id));
      if (!next) continue;
      used.add(next.id);
      result.push({ article: next, topic });
      added = true;
    }
    if (!added) break;
  }
  return result;
}
