import { localizationMap, applyLocalization } from "./localization";
import type { NewspaperEdition } from "./edition-builder.ts";
import { generateEditorial } from "./editorial-engine.ts";
import {
  buildWeeklyMagazine, completedWeek, isValidWeekStart, weeklyAiCandidates,
  type WeeklyMagazine,
} from "./weekly-builder.ts";

export interface WeeklyEnv { DB: D1Database; AI?: Ai }
const CREATE_TABLE = "CREATE TABLE IF NOT EXISTS weekly_magazines (week_start TEXT PRIMARY KEY, payload_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))";

async function localizedMagazine(env:WeeklyEnv, magazine:WeeklyMagazine):Promise<WeeklyMagazine>{
  const map=await localizationMap(env.DB,[...magazine.stories,...magazine.radarPool]);
  if(!map.size)return magazine;
  return {
    ...magazine,
    stories:magazine.stories.map(article=>applyLocalization(article,map)),
    radarPool:magazine.radarPool.map(article=>applyLocalization(article,map)),
    timeline:magazine.timeline.map(day=>({
      ...day,
      stories:day.stories.map(item=>({...item,...(map.get(item.id)?.titleVi?{titleVi:map.get(item.id)!.titleVi}:{})}))
    }))
  };
}
export async function readWeeklyMagazine(env: WeeklyEnv, weekStart: string): Promise<WeeklyMagazine | null> {
  if (!isValidWeekStart(weekStart)) return null;
  try {
    const row = await env.DB.prepare("SELECT payload_json FROM weekly_magazines WHERE week_start = ?")
      .bind(weekStart).first<{ payload_json: string }>();
    return row ? localizedMagazine(env, JSON.parse(row.payload_json) as WeeklyMagazine) : null;
  } catch (error) {
    if (String(error).includes("no such table: weekly_magazines")) return null;
    throw error;
  }
}

export async function latestWeeklyMagazine(env: WeeklyEnv): Promise<WeeklyMagazine | null> {
  try {
    const row = await env.DB.prepare("SELECT payload_json FROM weekly_magazines ORDER BY week_start DESC LIMIT 1")
      .first<{ payload_json: string }>();
    return row ? localizedMagazine(env, JSON.parse(row.payload_json) as WeeklyMagazine) : null;
  } catch (error) {
    if (String(error).includes("no such table: weekly_magazines")) return null;
    throw error;
  }
}

export async function listWeeklyMagazines(env: WeeklyEnv, requestedPage: number, requestedLimit = 12) {
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(1000, Math.floor(requestedPage))) : 1;
  const pageSize = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(24, Math.floor(requestedLimit))) : 12;
  const empty = { data: [], page, pageSize, total: 0, hasNext: false };
  try {
    const [counter, rows] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS total FROM weekly_magazines").first<{ total: number }>(),
      env.DB.prepare(
        "SELECT week_start," +
        " json_extract(payload_json, '$.weekEnd') AS week_end," +
        " json_extract(payload_json, '$.issueDate') AS issue_date," +
        " json_extract(payload_json, '$.title') AS title," +
        " json_extract(payload_json, '$.coverageDays') AS coverage_days," +
        " json_extract(payload_json, '$.storyCount') AS story_count," +
        " json_extract(payload_json, '$.stories[0].image_url') AS cover_image" +
        " FROM weekly_magazines ORDER BY week_start DESC LIMIT ? OFFSET ?"
      ).bind(pageSize, (page - 1) * pageSize).all<{
        week_start: string; week_end: string; issue_date: string; title: string;
        coverage_days: number; story_count: number; cover_image: string | null;
      }>(),
    ]);
    const total = counter?.total ?? 0;
    return {
      data: (rows.results ?? []).map(row => ({
        weekStart: row.week_start, weekEnd: row.week_end, issueDate: row.issue_date,
        title: row.title, coverageDays: row.coverage_days, storyCount: row.story_count,
        coverImage: row.cover_image,
      })),
      page, pageSize, total, hasNext: page * pageSize < total,
    };
  } catch (error) {
    if (String(error).includes("no such table: weekly_magazines")) return empty;
    throw error;
  }
}

export async function createWeeklyMagazine(env: WeeklyEnv, now = new Date()): Promise<WeeklyMagazine | null> {
  const week = completedWeek(now);
  await env.DB.prepare(CREATE_TABLE).run();
  const existing = await readWeeklyMagazine(env, week.weekStart);
  if (existing) return existing;

  const { results } = await env.DB.prepare(
    "SELECT payload_json FROM newspaper_editions WHERE issue_date >= ? AND issue_date <= ? ORDER BY issue_date"
  ).bind(week.firstEditionDate, week.lastEditionDate).all<{ payload_json: string }>();
  const editions: NewspaperEdition[] = [];
  for (const row of results ?? []) {
    try {
      const edition = JSON.parse(row.payload_json) as NewspaperEdition;
      if (edition && edition.coverageDate && edition.lead && Array.isArray(edition.secondary))
        editions.push(edition);
    } catch { console.warn("Weekly: invalid edition payload skipped"); }
  }

  // Do not publish a pretend seven-day magazine when no issues exist at all.
  if (!editions.length) {
    console.log("Weekly magazine pending: no daily edition snapshots", week.weekStart);
    return null;
  }
  const candidates = weeklyAiCandidates(editions);
  const { draft, reason } = await generateEditorial(
    env.AI, week.weekStart + " đến " + week.weekEnd, candidates, "weekly"
  );
  const magazine = buildWeeklyMagazine(week.weekStart, editions, draft, reason);
  if (!magazine) return null;
  await env.DB.prepare(
    "INSERT OR IGNORE INTO weekly_magazines(week_start,payload_json) VALUES(?,?)"
  ).bind(week.weekStart, JSON.stringify(magazine)).run();
  console.log("Weekly magazine created or reused", week.weekStart, "coverage",
    magazine.coverageDays, "mode", magazine.editorial.mode);
  return readWeeklyMagazine(env, week.weekStart);
}
