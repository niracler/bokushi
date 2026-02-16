-- Create users table for OAuth authentication
CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  avatar_url TEXT,
  role       TEXT DEFAULT 'user',
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- Create oauth_accounts table for multi-provider support
CREATE TABLE oauth_accounts (
  provider        TEXT NOT NULL,
  provider_id     TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  provider_name   TEXT,
  provider_avatar TEXT,
  created_at      TEXT NOT NULL,
  PRIMARY KEY (provider, provider_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_oauth_user ON oauth_accounts(user_id);
