-- Add username columns to users table
ALTER TABLE users ADD COLUMN username VARCHAR(15);
ALTER TABLE users ADD COLUMN previous_usernames JSONB;

-- Create case-insensitive unique index on username
-- This ensures uniqueness regardless of case (e.g., "Fred" and "fred" are considered the same)
CREATE UNIQUE INDEX users_username_lower_unique ON users (LOWER(username));
