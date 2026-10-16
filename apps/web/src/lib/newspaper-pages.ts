import type { RadarArticle, RadarPreferences, RadarStory } from "./my-radar.ts";
import { selectRadarStories } from "./my-radar.ts";

export type EditionArticle = RadarArticle;
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
  editorial?: { mode:"ai"|"fallback"; version:string; model:string|null; reason:string; scoredCount:number };
};

export type EditionPage =
  | { kind: "cover"; id: string; title: string }
  | { kind: "stories"; id: string; title: string; subtitle: string; articles: EditionArticle[] }
  | { kind: "briefs"; id: string; title: string; articles: EditionArticle[] }
  | { kind: "radar"; id: string; title: string; enabled: boolean; articles: RadarStory[] };

export function buildEditionPages(edition: NewspaperEdition, prefs: RadarPreferences): EditionPage[] {
  const pages: EditionPage[] = [{ kind: "cover", id: "cover", title: "Trang nhất" }];
  const stories = Array.isArray(edition.secondary) ? edition.secondary : [];
  if (stories.length) {
    pages.push({
      kind: "stories", id: "highlights", title: "Những câu chuyện đáng chú ý",
      subtitle: "DÒNG THỜI SỰ / TIN NỔI BẬT", articles: stories.slice(0, 3),
    });
  }
  if (stories.length > 3) {
    pages.push({
      kind: "stories", id: "developments", title: "Nhịp sống và thế giới",
      subtitle: "GÓC NHÌN / TIN CHỌN LỌC", articles: stories.slice(3, 6),
    });
  }
  if (edition.briefs?.length) {
    pages.push({
      kind: "briefs", id: "briefs", title: "Điểm tin trong ngày",
      articles: edition.briefs,
    });
  }
  pages.push({
    kind: "radar", id: "my-radar", title: "Bản tin dành cho bạn",
    enabled: prefs.enabled,
    articles: prefs.enabled ? selectRadarStories(edition.radarPool ?? [], prefs.topics, 6) : [],
  });
  return pages;
}

// The cover is a single page. Other pages pair up on large screens.
export function editionSpreads(count: number, wide: boolean): number[][] {
  if (count <= 0) return [];
  const spreads = [[0]];
  for (let i = 1; i < count; i += wide ? 2 : 1) {
    const spread = [i];
    if (wide && i + 1 < count) spread.push(i + 1);
    spreads.push(spread);
  }
  return spreads;
}

export function indexForPage(spreads: number[][], requestedPage: number): number {
  if (spreads.length === 0) return 0;
  const validPage = Number.isFinite(requestedPage)
    ? Math.max(1, Math.min(Math.max(...spreads.flat()) + 1, Math.floor(requestedPage))) : 1;
  const index = spreads.findIndex((spread) => spread.includes(validPage - 1));
  return Math.max(0, index);
}

export function offsetSpread(index: number, delta: number, count: number): number {
  return Math.max(0, Math.min(count - 1, index + delta));
}
