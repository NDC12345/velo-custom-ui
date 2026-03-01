-- Migration 003: Per-user Velociraptor server URL
-- Allows multi-tenant deployments where each user connects to their own Velo server.

-- The URL of the user's own Velociraptor server (e.g. https://my-velo.example.com)
ALTER TABLE users ADD COLUMN IF NOT EXISTS
    velo_server_url VARCHAR(500);

-- Whether to skip TLS certificate verification for self-signed certs
ALTER TABLE users ADD COLUMN IF NOT EXISTS
    velo_verify_ssl BOOLEAN DEFAULT true;

COMMENT ON COLUMN users.velo_server_url IS 'Per-user Velociraptor API base URL. Falls back to VELO_API_BASE_URL env var when NULL.';
COMMENT ON COLUMN users.velo_verify_ssl  IS 'Verify TLS certificate on the per-user Velo API (default true). Set false for self-signed certs.';

CREATE INDEX IF NOT EXISTS idx_users_velo_server_url ON users(velo_server_url);
