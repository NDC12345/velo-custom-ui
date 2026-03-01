-- Add avatar_url column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);

COMMENT ON COLUMN users.avatar_url IS 'URL path to user avatar image';
