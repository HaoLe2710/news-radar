import { selectRadarStories, type RadarPreferences, type RadarStory } from "./my-radar.ts";
import type { EditionArticle } from "./newspaper-pages.ts";

export type WeeklyArticle = EditionArticle & { coverageDate: string };
export type WeeklyDay = { date: string; stories: {id: number; title: string; source: string; url: string}[] };
export type WeeklyMagazine = {
  weekStart: string; weekEnd: string; issueDate: string;
  title: string; overview: string; overviewMode: "ai" | "rss";
  coverageDays: number; availableDates: string[]; missingDates: string[];
  stories: WeeklyArticle[]; radarPool: WeeklyArticle[]; timeline: WeeklyDay[];
  storyCount: number; sourceCount: number;
  editorial: { mode: "ai" | "fallback"; reason: string; model: string | null };
  createdAt: string;
};
export type WeeklyPage =
  | { id:"cover"; title:string; kind:"cover" }
  | { id:"review"; title:string; kind:"review" }
  | { id:"highlights"|"technology"|"perspectives"; title:string; kind:"stories"; articles:WeeklyArticle[] }
  | { id:"timeline"; title:string; kind:"timeline"; days:WeeklyDay[] }
  | { id:"radar"; title:string; kind:"radar"; articles:RadarStory[]; enabled:boolean };

export function validWeekStart(date: string | null): date is string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const day = new Date(date + "T12:00:00Z");
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === date && day.getUTCDay() === 1;
}
export function weeklyHref(weekStart: string | null | undefined, prefix = "/magazine/"): string {
  return weekStart && validWeekStart(weekStart) ? prefix + "?week=" + weekStart : prefix;
}
export function weeklyPages(magazine: WeeklyMagazine, preferences: RadarPreferences): WeeklyPage[] {
  const stories = magazine.stories ?? [];
  const remaining = stories.slice(4);
  const tech = remaining.filter(article => ["technology", "science", "education"].includes(article.category));
  const perspective = remaining.filter(article => !["technology", "science", "education"].includes(article.category));
  const result: WeeklyPage[] = [
    { id: "cover", title: "Trang bìa", kind: "cover" },
    { id: "review", title: "Toàn cảnh tuần", kind: "review" },
  ];
  if (stories.length) result.push({ id: "highlights", title: "Những chuyện đáng chú ý", kind: "stories", articles: stories.slice(0, 4) });
  if (tech.length) result.push({ id: "technology", title: "Công nghệ và khoa học", kind: "stories", articles: tech });
  if (perspective.length) result.push({ id: "perspectives", title: "Kinh tế và xã hội", kind: "stories", articles: perspective });
  result.push({ id: "timeline", title: "Dòng thời gian", kind: "timeline", days: magazine.timeline ?? [] });
  result.push({ id: "radar", title: "My Radar — Cuối tuần", kind: "radar", enabled: preferences.enabled,
    articles: preferences.enabled ? selectRadarStories(magazine.radarPool ?? [], preferences.topics, 6) : [] });
  return result;
}
export function weeklySources(magazine: WeeklyMagazine, preferences: RadarPreferences) {
  const articles = [...magazine.stories, ...(preferences.enabled ? selectRadarStories(magazine.radarPool ?? [], preferences.topics, 6).map(x => x.article) : [])];
  const sources = new Map<string, {title: string; source: string; url: string}>();
  for (const a of articles) if (a.url && !sources.has(a.url)) sources.set(a.url,{title:a.title,source:a.source,url:a.url});
  for (const day of magazine.timeline) for (const a of day.stories)
    if (a.url && !sources.has(a.url)) sources.set(a.url,{title:a.title,source:a.source,url:a.url});
  return [...sources.values()];
}
