import type { EditionArticle, NewspaperEdition } from "./edition-builder.ts";
import type { EditorialDraft } from "./editorial-engine.ts";
import { chooseEditorialCandidates } from "./editorial-engine.ts";

export type WeeklyArticle = EditionArticle & { coverageDate: string };
export type WeeklyTimelineDay = {
  date: string;
  stories: { id: number; title: string; source: string; url: string }[];
};
export type WeeklyMagazine = {
  weekStart: string;
  weekEnd: string;
  issueDate: string;
  title: string;
  overview: string;
  overviewMode: "ai" | "rss";
  coverageDays: number;
  availableDates: string[];
  missingDates: string[];
  stories: WeeklyArticle[];
  radarPool: WeeklyArticle[];
  timeline: WeeklyTimelineDay[];
  storyCount: number;
  sourceCount: number;
  editorial: { mode: "ai" | "fallback"; reason: string; model: string | null };
  createdAt: string;
};

export function plusDays(date: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
  const value = new Date(date + "T12:00:00Z");
  if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== date)
    throw new Error("Invalid date");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function completedWeek(now = new Date()) {
  const vietnamToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const weekday = new Date(vietnamToday + "T12:00:00Z").getUTCDay();
  const currentMonday = plusDays(vietnamToday, -((weekday + 6) % 7));
  const weekStart = plusDays(currentMonday, -7);
  const weekEnd = plusDays(weekStart, 6);
  const coverageDates = Array.from({ length: 7 }, (_, i) => plusDays(weekStart, i));
  return {
    weekStart, weekEnd, issueDate: currentMonday,
    coverageDates,
    firstEditionDate: plusDays(weekStart, 1),
    lastEditionDate: plusDays(weekStart, 7),
  };
}

export function isValidWeekStart(day: string): boolean {
  try { return new Date(day + "T12:00:00Z").getUTCDay() === 1 && plusDays(day, 0) === day; }
  catch { return false; }
}

export function collectWeeklyCandidates(editions: NewspaperEdition[]): WeeklyArticle[] {
  const pool: WeeklyArticle[] = [];
  const visited = new Set<string>();
  for (const edition of [...editions].sort((a, b) => a.coverageDate.localeCompare(b.coverageDate))) {
    for (const article of [edition.lead, ...edition.secondary, ...edition.briefs, ...edition.radarPool]) {
      if (!article || !article.url || visited.has(article.url)) continue;
      visited.add(article.url);
      pool.push({ ...article, coverageDate: edition.coverageDate });
    }
  }
  return pool;
}

export function weeklyAiCandidates(editions: NewspaperEdition[]) {
  const all = collectWeeklyCandidates(editions);
  // Maximum 24 candidates, balanced among categories and publishers.
  return chooseEditorialCandidates(all, 24);
}

export function buildWeeklyMagazine(
  weekStart: string, editions: NewspaperEdition[],
  draft: EditorialDraft | null = null, reason = "unavailable",
  createdAt = new Date().toISOString(),
): WeeklyMagazine | null {
  if (!isValidWeekStart(weekStart)) throw new Error("Week start must be a Monday");
  const weekEnd = plusDays(weekStart, 6);
  const expected = Array.from({ length: 7 }, (_, i) => plusDays(weekStart, i));
  const editionByCoverageDate = new Map<string, NewspaperEdition>();
  for (const edition of editions) {
    if (!expected.includes(edition.coverageDate)) continue;
    if (edition.issueDate !== plusDays(edition.coverageDate, 1)) continue;
    if (!editionByCoverageDate.has(edition.coverageDate)) {
      editionByCoverageDate.set(edition.coverageDate, edition);
    }
  }
  const availableDates = expected.filter(day => editionByCoverageDate.has(day));
  const missingDates = expected.filter(day => !editionByCoverageDate.has(day));
  if (!availableDates.length) return null;
  const validEditions = availableDates.map(day => editionByCoverageDate.get(day)!);
  const all = collectWeeklyCandidates(validEditions);
  if (all.length < 4) return null;

  const candidateIds = new Set(weeklyAiCandidates(validEditions).map(a => a.id));
  const draftIds = draft?.ranked.map(x => x.id).filter(id => candidateIds.has(id)) ?? [];
  const picked: WeeklyArticle[] = [];
  const seen = new Set<string>();
  const byId = new Map(all.map(a => [a.id, a]));
  for (const id of [...draftIds, ...all.map(a => a.id)]) {
    const article = byId.get(id);
    if (!article || seen.has(article.url)) continue;
    seen.add(article.url);
    const digest = draft?.digests.find(item => item.id === id);
    const score = draft?.ranked.find(item => item.id === id)?.score;
    picked.push({ ...article, ...(digest ? { editorialSummary: digest.text } : {}), ...(score === undefined ? {} : { editorialScore: score }) });
    if (picked.length >= 12) break;
  }
  const timeline: WeeklyTimelineDay[] = validEditions.map(edition => {
    const items = [edition.lead, ...edition.secondary.slice(0, 1)];
    const unique = [...new Map(items.map(item => [item.url, item])).values()];
    return {
      date: edition.coverageDate,
      stories: unique.map(item => ({ id: item.id, title: item.title, source: item.source, url: item.url })),
    };
  });
  const sourceCount = new Set(picked.map(article => article.source)).size;
  const fallback = "Tổng hợp " + availableDates.length + "/7 ngày có số báo, từ " +
    availableDates[0] + " đến " + availableDates[availableDates.length - 1] +
    ". Các câu chuyện được chọn từ bản tin RSS có dẫn nguồn. " +
    (missingDates.length ? "Chưa có số báo cho: " + missingDates.join(", ") + "." :
      "Đã có đủ bảy số báo tương ứng với tuần này.");
  return {
    weekStart, weekEnd, issueDate: plusDays(weekStart, 7),
    title: draft?.headline ?? "Những chuyển động của tuần",
    overview: draft?.overview ?? fallback,
    overviewMode: draft ? "ai" : "rss",
    coverageDays: availableDates.length, availableDates, missingDates,
    stories: picked, radarPool: all.filter(a => !seen.has(a.url)).slice(0, 40),
    timeline, storyCount: picked.length, sourceCount,
    editorial: {
      mode: draft ? "ai" : "fallback", reason: draft ? "success" : reason,
      model: draft ? "@cf/meta/llama-3.1-8b-instruct-fp8" : null,
    },
    createdAt,
  };
}
