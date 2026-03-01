-- Migration: Token revocation table for JTI-based invalidation
-- Also adds org/velo_roles columns to users

-- JTI revocation list (cleared by cleanup job when exp passes)
CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti         VARCHAR(128) PRIMARY KEY,
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    revoked_at  TIMESTAMP DEFAULT NOW(),
    expires_at  TIMESTAMP NOT NULL -- When the token would have expired (for cleanup)
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at ON revoked_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_user_id    ON revoked_tokens(user_id);

-- Remove expired JTIs periodically (can be called by a cron or at boot)
-- DELETE FROM revoked_tokens WHERE expires_at < NOW();

-- Add org_id column to users (empty string = default org)
ALTER TABLE users ADD COLUMN IF NOT EXISTS
    velo_org_id VARCHAR(64) DEFAULT '' NOT NULL;

-- Velo roles fetched from upstream at login and cached
ALTER TABLE users ADD COLUMN IF NOT EXISTS
    velo_roles  TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Track when velo roles were last synced
ALTER TABLE users ADD COLUMN IF NOT EXISTS
    velo_roles_synced_at TIMESTAMP;

-- Store access token JTI (for forced rotation on logout)
ALTER TABLE users ADD COLUMN IF NOT EXISTS
    current_access_jti VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_users_velo_org_id ON users(velo_org_id);
