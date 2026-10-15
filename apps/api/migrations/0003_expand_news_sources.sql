-- Phase 4: add RSS feeds without removing existing data.
INSERT OR IGNORE INTO categories(slug, name) VALUES
  ('sports', 'Thể thao'),
  ('education', 'Giáo dục');

INSERT OR IGNORE INTO news_sources(name, feed_url, region, category_id)
SELECT 'VnExpress - Kinh doanh', 'https://vnexpress.net/rss/kinh-doanh.rss', 'vn', id
FROM categories WHERE slug = 'business';

INSERT OR IGNORE INTO news_sources(name, feed_url, region, category_id)
SELECT 'VnExpress - Thể thao', 'https://vnexpress.net/rss/the-thao.rss', 'vn', id
FROM categories WHERE slug = 'sports';

INSERT OR IGNORE INTO news_sources(name, feed_url, region, category_id)
SELECT 'VnExpress - Giáo dục', 'https://vnexpress.net/rss/giao-duc.rss', 'vn', id
FROM categories WHERE slug = 'education';

INSERT OR IGNORE INTO news_sources(name, feed_url, region, category_id)
SELECT 'BBC - Business', 'https://feeds.bbci.co.uk/news/business/rss.xml', 'world', id
FROM categories WHERE slug = 'business';

INSERT OR IGNORE INTO news_sources(name, feed_url, region, category_id)
SELECT 'BBC - Technology', 'https://feeds.bbci.co.uk/news/technology/rss.xml', 'world', id
FROM categories WHERE slug = 'technology';

INSERT OR IGNORE INTO news_sources(name, feed_url, region, category_id)
SELECT 'BBC - Science', 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', 'world', id
FROM categories WHERE slug = 'science';

INSERT OR IGNORE INTO news_sources(name, feed_url, region, category_id)
SELECT 'BBC - Sport', 'https://feeds.bbci.co.uk/sport/rss.xml', 'world', id
FROM categories WHERE slug = 'sports';

CREATE INDEX IF NOT EXISTS idx_articles_date_id
ON articles(published_at DESC, id DESC);
