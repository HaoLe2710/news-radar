import { localizationMap, applyLocalization } from "./localization";
import { chooseEditorialCandidates, generateEditorial } from "./editorial-engine";
import { groupRelatedStories } from "./story-groups";
import { composeEdition, coverageWindow, type EditionArticle, type NewspaperEdition } from "./edition-builder";
import { currentVietnamDay } from "./daily-brief";
export interface EditionEnv { DB: D1Database; AI?: Ai }
const CREATE_EDITION = "CREATE TABLE IF NOT EXISTS newspaper_editions (issue_date TEXT PRIMARY KEY, payload_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))";
function validDate(input: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
  try { coverageWindow(input); return true; } catch { return false; }
}
async function localizedEdition(env:EditionEnv, edition:NewspaperEdition):Promise<NewspaperEdition> {
  const articles = [edition.lead,...edition.secondary,...edition.briefs,...edition.radarPool];
  const map = await localizationMap(env.DB,articles);
  if(!map.size)return edition;
  return {
    ...edition,
    lead:applyLocalization(edition.lead,map),
    secondary:edition.secondary.map(article=>applyLocalization(article,map)),
    briefs:edition.briefs.map(article=>applyLocalization(article,map)),
    radarPool:edition.radarPool.map(article=>applyLocalization(article,map)),
  };
}
export async function readEdition(env: EditionEnv, date: string): Promise<NewspaperEdition | null> {
  if (!validDate(date)) return null;
  try {
    const row = await env.DB.prepare("SELECT payload_json FROM newspaper_editions WHERE issue_date = ?").bind(date).first<{payload_json:string}>();
    return row ? localizedEdition(env,JSON.parse(row.payload_json) as NewspaperEdition) : null;
  } catch(error) {
    if(String(error).includes("no such table: newspaper_editions")) return null;
    throw error;
  }
}
export async function createEdition(env: EditionEnv, issueDate = currentVietnamDay()): Promise<NewspaperEdition | null> {
  if (!validDate(issueDate)) throw new Error("Invalid issue date");
  await env.DB.prepare(CREATE_EDITION).run();
  const existing = await readEdition(env,issueDate);
  if (existing) return existing;
  const {from,to} = coverageWindow(issueDate);
  const sql = "SELECT a.id,a.title,a.url,a.summary,a.image_url,a.published_at,s.name AS source,s.region,c.slug AS category FROM articles a JOIN news_sources s ON s.id=a.source_id JOIN categories c ON c.id=s.category_id WHERE a.published_at >= ? AND a.published_at < ? ORDER BY a.published_at DESC,a.id DESC LIMIT 180";
  const {results} = await env.DB.prepare(sql).bind(from,to).all<EditionArticle>();
  let brief: {overview:string;mode:"ai"|"headlines"} | null = null;
  try {
    brief = await env.DB.prepare("SELECT overview,generation_mode AS mode FROM daily_briefs WHERE brief_date = ?").bind(issueDate).first<{overview:string;mode:"ai"|"headlines"}>();
  } catch(error) {
    if(!String(error).includes("no such table: daily_briefs")) throw error;
  }
  const rows = results ?? [];
  if (rows.length < 4) return null;
  const candidates = chooseEditorialCandidates(rows, 24);
  const { draft, reason } = await generateEditorial(env.AI, issueDate, candidates);
  console.log("Edition editorial:", issueDate, draft ? "ai" : "fallback", reason);
  const edition = composeEdition(issueDate, rows, brief, new Date().toISOString(), draft, reason);
  if (!edition) return null;
  // Group identical events by validated RSS headlines. Only original source links are included.
  const clusters = groupRelatedStories(rows, 20);
  for (const article of [edition.lead, ...edition.secondary]) {
    const matching = clusters.find(group => group.articles.some(item => item.id === article.id));
    if (matching) {
      const related = matching.articles.filter(item => item.id !== article.id && item.url !== article.url).slice(0, 3);
      if (related.length) article.relatedSources = related.map(item => ({title:item.title,source:item.source,url:item.url}));
    }
  }
  await env.DB.prepare("INSERT OR IGNORE INTO newspaper_editions(issue_date,payload_json) VALUES(?,?)").bind(issueDate,JSON.stringify(edition)).run();
  return readEdition(env,issueDate);
}
export async function latestEdition(env: EditionEnv): Promise<NewspaperEdition | null> {
  try {
    const row = await env.DB.prepare("SELECT payload_json FROM newspaper_editions ORDER BY issue_date DESC LIMIT 1").first<{payload_json:string}>();
    return row ? localizedEdition(env,JSON.parse(row.payload_json) as NewspaperEdition) : null;
  } catch(error) {
    if(String(error).includes("no such table: newspaper_editions")) return null;
    throw error;
  }
}

export type EditionArchiveItem = {
  issueDate: string;
  createdAt: string;
  headline: string;
  coverImage: string | null;
  articleCount: number;
  sourceCount: number;
};

type EditionArchiveRow = {
  issue_date: string;
  created_at: string;
  headline: string | null;
  cover_image: string | null;
  article_count: number | null;
  source_count: number | null;
};

export async function listEditions(env: EditionEnv, requestedPage: number, requestedLimit = 12) {
  const page = Number.isFinite(requestedPage) ? Math.min(1000, Math.max(1, Math.floor(requestedPage))) : 1;
  const limit = Number.isFinite(requestedLimit) ? Math.min(24, Math.max(1, Math.floor(requestedLimit))) : 12;
  const empty = { data: [] as EditionArchiveItem[], page, pageSize: limit, total: 0, hasNext: false };
  try {
    const [counter, rows] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS total FROM newspaper_editions").first<{ total: number }>(),
      env.DB.prepare(
        "SELECT issue_date, created_at," +
        " json_extract(payload_json, '$.lead.title') AS headline," +
        " json_extract(payload_json, '$.lead.image_url') AS cover_image," +
        " json_extract(payload_json, '$.articleCount') AS article_count," +
        " json_extract(payload_json, '$.sourceCount') AS source_count" +
        " FROM newspaper_editions ORDER BY issue_date DESC LIMIT ? OFFSET ?"
      ).bind(limit, (page - 1) * limit).all<EditionArchiveRow>(),
    ]);
    const total = counter?.total ?? 0;
    return {
      data: (rows.results ?? []).map((row) => ({
        issueDate: row.issue_date,
        createdAt: row.created_at,
        headline: row.headline ?? "Ấn bản News Radar",
        coverImage: row.cover_image,
        articleCount: row.article_count ?? 0,
        sourceCount: row.source_count ?? 0,
      })),
      page, pageSize: limit, total, hasNext: page * limit < total,
    };
  } catch (error) {
    if (String(error).includes("no such table: newspaper_editions")) return empty;
    throw error;
  }
}
