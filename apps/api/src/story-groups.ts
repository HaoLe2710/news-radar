export type RelatedArticle = {
  id: number;
  title: string;
  url: string;
  source: string;
  region: string;
  category: string;
  image_url: string | null;
  published_at: string | null;
};

export type RelatedStory = {
  id: number;
  headline: string;
  image_url: string | null;
  region: string;
  category: string;
  published_at: string | null;
  articleCount: number;
  articles: Pick<RelatedArticle, "id" | "title" | "url" | "source" | "published_at">[];
};

// Common words do not distinguish news events, particularly in Vietnamese headlines.
const stopwords = new Set([
  "the", "and", "for", "with", "from", "into", "that", "this", "their",
  "have", "has", "are", "was", "were", "will", "says", "said", "after",
  "about", "over", "more", "new", "news", "what", "why", "how",
  "cua", "cho", "voi", "trong", "theo", "tren", "sau", "truoc", "nhung",
  "nhieu", "dang", "duoc", "mot", "cac", "nhat", "khi", "den", "vao",
  "tai", "noi", "ve", "khong", "co", "la", "va", "tu", "do", "nay",
  "da", "se", "o", "bi", "tin"
]);

export function titleTokens(title: string): Set<string> {
  const simplified = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
  const words = simplified.match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(words.filter((word) => word.length >= 3 && !stopwords.has(word)));
}

// High-precision lexical match, not a semantic AI similarity score.
export function titleSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size < 5 || b.size < 5) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  if (shared < 5) return 0;
  return shared / (a.size + b.size - shared);
}

function timestamp(value: string | null): number {
  return value ? Date.parse(value) || 0 : 0;
}

type WorkGroup = {
  anchor: RelatedArticle;
  tokens: Set<string>;
  members: RelatedArticle[];
};

// Bounded in-memory clustering: candidates are recent and capped by the API query.
// Anchoring to the first headline avoids transitive false-positive chains.
export function groupRelatedStories(
  articles: RelatedArticle[],
  maxGroups = 5
): RelatedStory[] {
  const groups: WorkGroup[] = [];
  const ordered = [...articles].sort(
    (a, b) => timestamp(b.published_at) - timestamp(a.published_at) || b.id - a.id
  );

  for (const article of ordered) {
    const tokens = titleTokens(article.title);
    if (tokens.size < 5) continue;

    const time = timestamp(article.published_at);
    if (!time) continue;

    let best: WorkGroup | undefined;
    let highest = 0;

    for (const group of groups) {
      if (article.region !== group.anchor.region) continue;
      if (Math.abs(time - timestamp(group.anchor.published_at)) > 36 * 60 * 60 * 1000) continue;
      const similarity = titleSimilarity(tokens, group.tokens);
      if (similarity >= 0.68 && similarity > highest) {
        best = group;
        highest = similarity;
      }
    }

    if (best) {
      if (!best.members.some((member) => member.id === article.id)) {
        best.members.push(article);
      }
    } else {
      groups.push({ anchor: article, tokens, members: [article] });
    }
  }

  return groups
    .filter((group) => group.members.length > 1)
    .sort((a, b) =>
      b.members.length - a.members.length ||
      timestamp(b.anchor.published_at) - timestamp(a.anchor.published_at)
    )
    .slice(0, Math.min(Math.max(1, maxGroups), 10))
    .map((group) => ({
      id: group.anchor.id,
      headline: group.anchor.title,
      image_url: group.anchor.image_url ?? group.members.find((item) => item.image_url)?.image_url ?? null,
      region: group.anchor.region,
      category: group.anchor.category,
      published_at: group.anchor.published_at,
      articleCount: group.members.length,
      articles: group.members.slice(0, 8).map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        source: item.source,
        published_at: item.published_at,
      })),
    }));
}
