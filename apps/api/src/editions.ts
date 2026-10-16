import { composeEdition, coverageWindow, type EditionArticle, type NewspaperEdition } from "./edition-builder";
import { currentVietnamDay } from "./daily-brief";
export interface EditionEnv { DB: D1Database }
const CREATE_EDITION = "CREATE TABLE IF NOT EXISTS newspaper_editions (issue_date TEXT PRIMARY KEY, payload_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))";
function validDate(input: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
  try { coverageWindow(input); return true; } catch { return false; }
}
export async function readEdition(env: EditionEnv, date: string): Promise<NewspaperEdition | null> {
  if (!validDate(date)) return null;
  try {
    const row = await env.DB.prepare("SELECT payload_json FROM newspaper_editions WHERE issue_date = ?").bind(date).first<{payload_json:string}>();
    return row ? JSON.parse(row.payload_json) as NewspaperEdition : null;
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
  const edition = composeEdition(issueDate,results??[],brief);
  if (!edition) return null;
  await env.DB.prepare("INSERT OR IGNORE INTO newspaper_editions(issue_date,payload_json) VALUES(?,?)").bind(issueDate,JSON.stringify(edition)).run();
  return readEdition(env,issueDate);
}
export async function latestEdition(env: EditionEnv): Promise<NewspaperEdition | null> {
  try {
    const row = await env.DB.prepare("SELECT payload_json FROM newspaper_editions ORDER BY issue_date DESC LIMIT 1").first<{payload_json:string}>();
    return row ? JSON.parse(row.payload_json) as NewspaperEdition : null;
  } catch(error) {
    if(String(error).includes("no such table: newspaper_editions")) return null;
    throw error;
  }
}
