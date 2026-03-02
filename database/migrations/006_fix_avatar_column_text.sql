-- Migration: Expand avatar_url column from VARCHAR(500) to TEXT
-- Reason: Base64 data URIs for images can be several hundred kilobytes.
--         VARCHAR(500) is far too small; TEXT has no length limit in PostgreSQL.
ALTER TABLE users
  ALTER COLUMN avatar_url TYPE TEXT;

COMMENT ON COLUMN users.avatar_url IS 'Avatar: either /uploads/avatars/<file> path or data:<mime>;base64,... URI';
