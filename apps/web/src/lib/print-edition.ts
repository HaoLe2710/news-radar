import type { RadarPreferences } from "./my-radar.ts";
import { buildEditionPages, type EditionArticle, type NewspaperEdition } from "./newspaper-pages.ts";

export function isValidIssueDate(value: string | null | undefined): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + "T00:00:00+07:00");
  if (!Number.isFinite(time)) return false;
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(time));
  return formatted === value;
}

export function printEditionHref(issueDate?: string | null): string {
  return isValidIssueDate(issueDate) ? "/edition/print/?date=" + issueDate : "/edition/print/";
}

export function editionPrintSources(edition: NewspaperEdition, preferences: RadarPreferences): EditionArticle[] {
  const included = [edition.lead];
  for (const page of buildEditionPages(edition, preferences)) {
    if (page.kind === "stories" || page.kind === "briefs") included.push(...page.articles);
    if (page.kind === "radar") included.push(...page.articles.map(({ article }) => article));
  }
  const urls = new Set<string>();
  return included.filter((article) => {
    if (!article.url || urls.has(article.url)) return false;
    urls.add(article.url);
    return true;
  });
}
