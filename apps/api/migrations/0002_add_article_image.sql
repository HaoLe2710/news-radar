-- Retain all existing articles; new crawls backfill thumbnail URLs.
ALTER TABLE articles ADD COLUMN image_url TEXT;
