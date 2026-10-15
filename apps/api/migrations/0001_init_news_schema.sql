-- Migration number: 0001 	 2026-10-15T04:53:40.406Z

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS news_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    feed_url TEXT NOT NULL UNIQUE,
    region TEXT NOT NULL
        CHECK (region IN ('vn', 'world')),
    category_id INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_fetched_at TEXT,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    summary TEXT,
    published_at TEXT,
    created_at TEXT NOT NULL DEFAULT
        (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (source_id) REFERENCES news_sources(id)
);

CREATE INDEX IF NOT EXISTS idx_articles_published
    ON articles(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_articles_source
    ON articles(source_id);

INSERT OR IGNORE INTO categories (slug, name)
VALUES
    ('general', 'Tin tổng hợp'),
    ('technology', 'Công nghệ'),
    ('business', 'Kinh tế'),
    ('science', 'Khoa học');

INSERT OR IGNORE INTO news_sources
    (name, feed_url, region, category_id)
SELECT
    'VnExpress - Thời sự',
    'https://vnexpress.net/rss/thoi-su.rss',
    'vn',
    id
FROM categories WHERE slug = 'general';

INSERT OR IGNORE INTO news_sources
    (name, feed_url, region, category_id)
SELECT
    'VnExpress - Công nghệ',
    'https://vnexpress.net/rss/khoa-hoc-cong-nghe.rss',
    'vn',
    id
FROM categories WHERE slug = 'technology';

INSERT OR IGNORE INTO news_sources
    (name, feed_url, region, category_id)
SELECT
    'BBC - World',
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'world',
    id
FROM categories WHERE slug = 'general';
