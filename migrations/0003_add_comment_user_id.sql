-- Add user_id to comments table for linking authenticated comments to users
ALTER TABLE comments ADD COLUMN user_id TEXT REFERENCES users(id);

CREATE INDEX idx_comments_user ON comments(user_id);
