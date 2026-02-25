-- Add comment pinning support for top-level comments
ALTER TABLE comments ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;

-- Speed up comment listing with sticky + chronological sorting
CREATE INDEX IF NOT EXISTS idx_comments_slug_pinned_created_at
  ON comments(slug, is_pinned, created_at);
