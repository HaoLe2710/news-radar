
import { XMLParser } from "fast-xml-parser";

type AppEnv = {
  DB: D1Database;
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

      for (const item of items.slice(0, 15)) {
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

    if (url.pathname === "/api/news") {
      const region = url.searchParams.get("region") ?? "all";
      const category = url.searchParams.get("category") ?? "all";

      const limit = Math.min(
        Math.max(Number(url.searchParams.get("limit")) || 20, 1),
        50
      );

      const { results } = await env.DB.prepare(
        `SELECT
           a.id,
           a.title,
           a.url,
           a.summary,
           a.image_url,
           a.published_at,
           s.name AS source,
           s.region,
           c.slug AS category
         FROM articles a
         JOIN news_sources s ON a.source_id = s.id
         JOIN categories c ON s.category_id = c.id
         WHERE (? = 'all' OR s.region = ?)
           AND (? = 'all' OR c.slug = ?)
         ORDER BY COALESCE(a.published_at, a.created_at) DESC
         LIMIT ?`
      ).bind(
        region, region,
        category, category,
        Math.floor(limit)
      ).all();

      return Response.json(
        { data: results, count: results?.length ?? 0 },
        { headers }
      );
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
  },
} satisfies ExportedHandler<AppEnv>;
