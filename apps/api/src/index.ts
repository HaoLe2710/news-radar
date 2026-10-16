import { createDailyBrief, currentVietnamDay, readBrief } from "./daily-brief";
import { groupRelatedStories, type RelatedArticle } from "./story-groups";

import { XMLParser } from "fast-xml-parser";

type AppEnv = {
  DB: D1Database;
  AI: Ai;
};

type NewsSource = {
  id: number;
  name: string;
  feed_url: string;
};

type RssItem = {
  title?: unknown;
  link?: unknown;
  description?: unknown;
  pubDate?: unknown;
  enclosure?: unknown;
  "media:thumbnail"?: unknown;
  "media:content"?: unknown;
};

const MAX_ITEMS_PER_SOURCE = 15;

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  processEntities: true,
});

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return text(obj["#text"] ?? "");
  }

  return "";
}

function cleanSummary(value: unknown): string {
  return text(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function parseDate(value: unknown): string | null {
  const raw = text(value);
  const timestamp = Date.parse(raw);

  return Number.isNaN(timestamp)
    ? null
    : new Date(timestamp).toISOString();
}

function urlFromMedia(node: unknown, requireImageType = false): string | null {
  for (const candidate of Array.isArray(node) ? node : [node]) {
    if (!candidate || typeof candidate !== "object") continue;
    const attrs = candidate as Record<string, unknown>;
    const type = text(attrs["@_type"]);
    if (requireImageType && !type.startsWith("image/")) continue;
    if (type && !type.startsWith("image/") && attrs["@_medium"] !== "image") continue;
    const image = cleanImageUrl(attrs["@_url"]);
    if (image) return image;
  }
  return null;
}

function cleanImageUrl(raw: unknown): string | null {
  const value = text(raw).trim().replace(/&amp;/g, "&");
  if (!value) return null;
  try {
    const url = new URL(value.startsWith("//") ? "https:" + value : value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function extractImage(item: RssItem): string | null {
  const media = urlFromMedia(item["media:thumbnail"])
    ?? urlFromMedia(item["media:content"])
    ?? urlFromMedia(item.enclosure, true);
  if (media) return media;

  // Some RSS feeds (including VnExpress) embed an <img> inside description HTML.
  const html = text(item.description);
  const match = html.match(/<img\b[^>]*?\s(?:src|data-src)\s*=\s*["']([^"']+)["']/i);
  return cleanImageUrl(match?.[1]);
}

async function ingestNews(env: AppEnv) {
  const { results: sources } = await env.DB
    .prepare(
      "SELECT id, name, feed_url FROM news_sources WHERE is_active = 1"
    )
    .all<NewsSource>();

  for (const source of sources ?? []) {
    try {
      console.log(`Fetching: ${source.name}`);

      const response = await fetch(source.feed_url, {
        headers: {
          Accept: "application/rss+xml, application/xml, text/xml",
        },
      });

      if (!response.ok) {
        throw new Error(`RSS HTTP ${response.status}`);
      }

      const xml = await response.text();
      const data = parser.parse(xml);

      const rawItems = data?.rss?.channel?.item;
      const items: RssItem[] = Array.isArray(rawItems)
        ? rawItems
        : rawItems ? [rawItems] : [];

      if (!items.length) {
        throw new Error("RSS contains no items");
      }

      const statements: D1PreparedStatement[] = [];

      for (const item of items.slice(0, MAX_ITEMS_PER_SOURCE)) {
        const title = text(item.title);
        const link = text(item.link);

        if (!title || !link) continue;

        let validUrl: string;
        try {
          const parsed = new URL(link);
          if (!["http:", "https:"].includes(parsed.protocol)) {
            continue;
          }
          validUrl = parsed.toString();
        } catch {
          continue;
        }

        statements.push(
          env.DB.prepare(
            `INSERT INTO articles
              (source_id, title, url, summary, published_at, image_url)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(url) DO UPDATE SET
               image_url = excluded.image_url
             WHERE articles.image_url IS NULL AND excluded.image_url IS NOT NULL`
          ).bind(
            source.id,
            title,
            validUrl,
            cleanSummary(item.description),
            parseDate(item.pubDate),
            extractImage(item)
          )
        );
      }

      let savedOrBackfilled = 0;

      if (statements.length > 0) {
        const results = await env.DB.batch(statements);
        savedOrBackfilled = results.reduce(
          (total, result) => total + (result.meta.changes ?? 0),
          0
        );
      }

      await env.DB.prepare(
        "UPDATE news_sources SET last_fetched_at = ? WHERE id = ?"
      ).bind(new Date().toISOString(), source.id).run();

      console.log(
        `${source.name}: fetched=${items.length}, saved_or_backfilled=${savedOrBackfilled}`
      );
    } catch (error) {
      console.error(`Failed: ${source.name}`, error);
    }
  }
}

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    const url = new URL(request.url);

    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    };

    if (request.method !== "GET") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers,
      });
    }

    if (url.pathname === "/api/health") {
      return Response.json(
        { status: "ok", service: "news-radar-api" },
        { headers }
      );
    }


    if (url.pathname === "/api/stats") {
      const publishedCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const fetchedCutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

      const [articles, sources] = await Promise.all([
        env.DB.prepare(`SELECT
          COUNT(*) AS total_articles,
          SUM(CASE WHEN a.published_at >= ? THEN 1 ELSE 0 END) AS last_24h,
          SUM(CASE WHEN a.published_at >= ? AND s.region = 'vn' THEN 1 ELSE 0 END) AS vn_24h,
          SUM(CASE WHEN a.published_at >= ? AND s.region = 'world' THEN 1 ELSE 0 END) AS world_24h
          FROM articles a
          JOIN news_sources s ON s.id = a.source_id`)
          .bind(publishedCutoff, publishedCutoff, publishedCutoff)
          .first<{ total_articles: number; last_24h: number | null; vn_24h: number | null; world_24h: number | null }>(),
        env.DB.prepare(`SELECT
          COUNT(*) AS active_sources,
          SUM(CASE WHEN last_fetched_at >= ? THEN 1 ELSE 0 END) AS recently_fetched,
          MAX(last_fetched_at) AS last_fetched_at
          FROM news_sources
          WHERE is_active = 1`)
          .bind(fetchedCutoff)
          .first<{ active_sources: number; recently_fetched: number | null; last_fetched_at: string | null }>(),
      ]);

      return Response.json({
        totalArticles: articles?.total_articles ?? 0,
        last24h: articles?.last_24h ?? 0,
        vn24h: articles?.vn_24h ?? 0,
        world24h: articles?.world_24h ?? 0,
        activeSources: sources?.active_sources ?? 0,
        recentlyFetchedSources: sources?.recently_fetched ?? 0,
        lastFetchedAt: sources?.last_fetched_at ?? null,
      }, { headers });
    }

    if (url.pathname === "/api/daily-brief") {
      const date = currentVietnamDay();
      const brief = await readBrief(env, date);
      return Response.json({
        data: brief,
        status: brief ? "ready" : "pending",
        date,
      }, { headers });
    }

    if (url.pathname === "/api/story-groups") {
      const region = url.searchParams.get("region") ?? "all";
      const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      const { results } = await env.DB.prepare(`SELECT
        a.id, a.title, a.url, a.image_url, a.published_at,
        s.name AS source, s.region, c.slug AS category
        FROM articles a
        JOIN news_sources s ON s.id = a.source_id
        JOIN categories c ON c.id = s.category_id
        WHERE a.published_at >= ?
          AND (? = 'all' OR s.region = ?)
        ORDER BY a.published_at DESC, a.id DESC
        LIMIT 300`)
        .bind(cutoff, region, region).all<RelatedArticle>();

      const groups = groupRelatedStories(results ?? [], 5);
      return Response.json({ data: groups, count: groups.length, windowHours: 72, method: "headline-lexical-v1" }, { headers });
    }

    if (url.pathname === "/api/news") {
      const region = url.searchParams.get("region") ?? "all";
      const category = url.searchParams.get("category") ?? "all";
      const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
      const period = url.searchParams.get("period") === "24h" ? "24h" : "all";
      const publishedCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const rawPage = Number(url.searchParams.get("page") ?? 1);
      const page = Number.isFinite(rawPage)
        ? Math.min(10000, Math.max(1, Math.floor(rawPage))) : 1;
      const rawSize = Number(url.searchParams.get("pageSize") ?? url.searchParams.get("limit") ?? 20);
      const pageSize = Number.isFinite(rawSize)
        ? Math.min(50, Math.max(1, Math.floor(rawSize))) : 20;
      const offset = (page - 1) * pageSize;

      const where = `FROM articles a
        JOIN news_sources s ON a.source_id = s.id
        JOIN categories c ON s.category_id = c.id
        WHERE (? = 'all' OR s.region = ?)
          AND (? = 'all' OR c.slug = ?)
          AND (? = '' OR INSTR(LOWER(a.title), LOWER(?)) > 0
            OR INSTR(LOWER(COALESCE(a.summary, '')), LOWER(?)) > 0
            OR INSTR(LOWER(s.name), LOWER(?)) > 0)
          AND (? = 'all' OR a.published_at >= ?)`;
      const args = [region, region, category, category, q, q, q, q, period, publishedCutoff];
      const [countResult, articleResult] = await Promise.all([
        env.DB.prepare(`SELECT COUNT(*) AS total ${where}`)
          .bind(...args).first<{ total: number }>(),
        env.DB.prepare(`SELECT
          a.id, a.title, a.url, a.summary, a.image_url,
          a.published_at, s.name AS source, s.region, c.slug AS category
          ${where}
          ORDER BY COALESCE(a.published_at, a.created_at) DESC, a.id DESC
          LIMIT ? OFFSET ?`)
          .bind(...args, pageSize, offset).all(),
      ]);

      const total = countResult?.total ?? 0;
      const data = articleResult.results ?? [];
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      return Response.json({
        data, count: data.length, total, page, pageSize, totalPages,
        hasNext: page < totalPages,
      }, { headers });
    }

    return Response.json(
      { error: "Not Found" },
      { status: 404, headers }
    );
  },

  async scheduled(
    _controller: ScheduledController,
    env: AppEnv
  ): Promise<void> {
    await ingestNews(env);
    await createDailyBrief(env);
  },
} satisfies ExportedHandler<AppEnv>;
