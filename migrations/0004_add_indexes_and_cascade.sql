-- Add composite index for the main comments query (slug + status + created_at)
CREATE INDEX IF NOT EXISTS idx_comments_slug_status ON comments(slug, status, created_at);

-- Note: SQLite does not support ALTER CONSTRAINT to add ON DELETE CASCADE
-- to existing foreign keys. Cascade behavior for user deletion should be
-- handled at the application layer. If a full table rebuild is needed later,
-- recreate tables with:
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL  (comments)
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE   (oauth_accounts)
