-- Add email column to users table for notification purposes.
-- Admin can set this for OAuth users who don't provide email via comments.
ALTER TABLE users ADD COLUMN email TEXT;
