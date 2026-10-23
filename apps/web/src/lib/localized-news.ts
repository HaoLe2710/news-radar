/** Vietnamese reader labels. Original RSS title and summary remain immutable. */
export type LocalizedNews = {
  title: string; titleVi?: string | null;
  summary?: string | null; summaryVi?: string | null;
  editorialSummary?: string | null;
};
export function newsTitle(article: LocalizedNews): string {
  return article.titleVi?.trim() || article.title;
}
export function newsSummary(article: LocalizedNews): string | null {
  return article.summaryVi?.trim() || article.editorialSummary?.trim() || article.summary?.trim() || null;
}
export function isTranslated(article: LocalizedNews): boolean {
  return Boolean(article.titleVi?.trim() || article.summaryVi?.trim());
}
