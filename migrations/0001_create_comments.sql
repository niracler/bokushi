-- Create comments table for D1-based comment system
CREATE TABLE comments (
  id         TEXT PRIMARY KEY,
  slug       TEXT NOT NULL,
  parent_id  TEXT,
  author     TEXT NOT NULL,
  email      TEXT,
  website    TEXT,
  content    TEXT NOT NULL,
  ip_hash    TEXT,
  status     TEXT DEFAULT 'visible',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (parent_id) REFERENCES comments(id)
);

CREATE INDEX idx_comments_slug ON comments(slug, status, created_at);
CREATE INDEX idx_comments_parent ON comments(parent_id);
