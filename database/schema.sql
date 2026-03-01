-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table with encrypted Velociraptor credentials
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    
    -- Encrypted Velociraptor credentials (AES-256-GCM)
    velo_username_encrypted BYTEA NOT NULL,
    velo_username_iv VARCHAR(32) NOT NULL,
    velo_username_auth_tag VARCHAR(32) NOT NULL,
    
    velo_password_encrypted BYTEA NOT NULL,
    velo_password_iv VARCHAR(32) NOT NULL,
    velo_password_auth_tag VARCHAR(32) NOT NULL,
    
    -- JWT refresh tokens (hashed with bcrypt)
    refresh_token_hash VARCHAR(255),
    refresh_token_expires_at TIMESTAMP,
    
    -- User roles (for custom RBAC if needed)
    roles VARCHAR[] DEFAULT ARRAY['user'],
    
    -- User preferences
    theme VARCHAR(50) DEFAULT 'dark',
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    
    -- Profile
    avatar_url VARCHAR(500),
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,
    last_login_ip INET,
    
    -- Security
    is_active BOOLEAN DEFAULT true,
    is_locked BOOLEAN DEFAULT false,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP,
    
    -- Soft delete
    deleted_at TIMESTAMP
);

-- Client tags (custom feature)
CREATE TABLE IF NOT EXISTS client_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id VARCHAR(255) NOT NULL,
    tag_name VARCHAR(100) NOT NULL,
    tag_value TEXT,
    tag_color VARCHAR(50) DEFAULT '#9c27b0',
    
    -- Who created the tag
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(client_id, tag_name)
);

-- User settings (for custom UI configurations)
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    setting_key VARCHAR(255) NOT NULL,
    setting_value JSONB,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id, setting_key)
);

-- AI interaction history (Google AI Studio - Gemini)
CREATE TABLE IF NOT EXISTS ai_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    session_id UUID,
    
    -- User query
    user_query TEXT NOT NULL,
    
    -- AI response
    ai_response TEXT,
    ai_model VARCHAR(100) DEFAULT 'gemini-1.5-pro',
    
    -- Context (what data was fetched, what action was taken)
    context JSONB,
    
    -- API calls made as result
    api_calls_made TEXT[],
    
    -- Feedback
    user_rating INT CHECK (user_rating BETWEEN 1 AND 5),
    
    -- Performance metrics
    response_time_ms INT,
    tokens_used INT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit logs (custom logging beyond Velo's)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    
    -- Request details
    http_method VARCHAR(10),
    endpoint VARCHAR(500),
    request_body JSONB,
    response_status INT,
    
    -- Client info
    ip_address INET,
    user_agent TEXT,
    
    -- Result
    success BOOLEAN,
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- API cache (optional - for caching Velo API responses)
CREATE TABLE IF NOT EXISTS api_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    cache_key VARCHAR(500) UNIQUE NOT NULL,
    cache_value JSONB,
    
    -- Expiry
    expires_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_refresh_token ON users(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

CREATE INDEX IF NOT EXISTS idx_client_tags_client_id ON client_tags(client_id);
CREATE INDEX IF NOT EXISTS idx_client_tags_created_by ON client_tags(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_client_tags_tag_name ON client_tags(tag_name);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_key ON user_settings(setting_key);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_user_id ON ai_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_session_id ON ai_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_created_at ON ai_interactions(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_api_cache_expires_at ON api_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_cache_key ON api_cache(cache_key);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_tags_updated_at ON client_tags;
CREATE TRIGGER update_client_tags_updated_at 
    BEFORE UPDATE ON client_tags
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at 
    BEFORE UPDATE ON user_settings
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_cache_updated_at ON api_cache;
CREATE TRIGGER update_api_cache_updated_at 
    BEFORE UPDATE ON api_cache
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comment on tables
COMMENT ON TABLE users IS 'Users with encrypted Velociraptor credentials';
COMMENT ON TABLE client_tags IS 'Custom tags for Velociraptor clients';
COMMENT ON TABLE user_settings IS 'User-specific UI settings and preferences';
COMMENT ON TABLE ai_interactions IS 'Google AI Studio (Gemini) interaction history';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all operations';
COMMENT ON TABLE api_cache IS 'Cache for Velociraptor API responses';

-- Grant permissions (adjust based on your user)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO velo_admin;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO velo_admin;
