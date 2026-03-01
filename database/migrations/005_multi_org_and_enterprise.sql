-- Migration 005: Multi-Organization & Enterprise Features
-- Phase 4: Tenant isolation, API keys, approval workflows, saved queries

BEGIN;

-- ════════════════════════════════════════════════════════════════════════
-- 1. Organizations table
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL UNIQUE,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    settings        JSONB DEFAULT '{}',
    -- Velo server mapping (orgs can point to different Velo instances)
    velo_server_url VARCHAR(500),
    velo_org_id     VARCHAR(100),
    -- Limits
    max_users       INT DEFAULT 50,
    max_api_keys    INT DEFAULT 20,
    -- Status
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE organizations IS 'Tenant organizations for multi-org isolation';

-- ════════════════════════════════════════════════════════════════════════
-- 2. Organization membership (users ↔ orgs)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(50) NOT NULL DEFAULT 'member'
                    CHECK (role IN ('owner','admin','member','viewer')),
    invited_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

COMMENT ON TABLE org_members IS 'User membership in organizations';

-- ════════════════════════════════════════════════════════════════════════
-- 3. Add org_id to existing tables for RLS
-- ════════════════════════════════════════════════════════════════════════

-- Add org_id to users (nullable for backward compatibility)
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Add org_id to cases
ALTER TABLE cases ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Add org_id to case_evidence
ALTER TABLE case_evidence ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Add org_id to case_comments
ALTER TABLE case_comments ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Add org_id to audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Add org_id to client_tags
ALTER TABLE client_tags ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Add org_id to ai_interactions
ALTER TABLE ai_interactions ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- ════════════════════════════════════════════════════════════════════════
-- 4. API Keys
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    -- Key is stored as bcrypt hash; the raw key is shown only once at creation
    key_prefix      VARCHAR(8) NOT NULL,      -- first 8 chars for identification
    key_hash        VARCHAR(255) NOT NULL,     -- bcrypt hash of the full key
    scopes          TEXT[] DEFAULT ARRAY['read'],
    -- Metadata
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE api_keys IS 'API keys for programmatic access (machine identity)';

-- ════════════════════════════════════════════════════════════════════════
-- 5. Approval Workflows
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS approval_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    requester_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    approver_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    -- What needs approval
    action_type     VARCHAR(50) NOT NULL
                    CHECK (action_type IN (
                        'quarantine','shell_exec','artifact_collect',
                        'hunt_create','hunt_modify','server_config',
                        'user_role_change','case_delete','data_export'
                    )),
    action_payload  JSONB NOT NULL DEFAULT '{}',
    target_resource VARCHAR(500),
    -- Approval status
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','expired','cancelled')),
    reason          TEXT,                      -- requester's justification
    decision_note   TEXT,                      -- approver's note
    decided_at      TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE approval_requests IS 'Approval workflows for sensitive operations';

-- ════════════════════════════════════════════════════════════════════════
-- 6. Saved Queries / Searches
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS saved_queries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    query_type      VARCHAR(30) NOT NULL DEFAULT 'vql'
                    CHECK (query_type IN ('vql','client_search','hunt_search','artifact_search')),
    query_text      TEXT NOT NULL,
    parameters      JSONB DEFAULT '{}',
    is_shared       BOOLEAN DEFAULT false,
    tags            TEXT[] DEFAULT '{}',
    run_count       INT DEFAULT 0,
    last_run_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE saved_queries IS 'Saved VQL queries and search templates';

-- ════════════════════════════════════════════════════════════════════════
-- 7. Alert Rules Engine
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS alert_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    -- Rule definition
    rule_type       VARCHAR(30) NOT NULL DEFAULT 'threshold'
                    CHECK (rule_type IN ('threshold','pattern','anomaly','scheduled_vql')),
    condition       JSONB NOT NULL,            -- {metric, operator, value, window_minutes}
    vql_query       TEXT,                      -- for scheduled_vql type
    -- Actions
    severity        VARCHAR(20) NOT NULL DEFAULT 'medium'
                    CHECK (severity IN ('critical','high','medium','low','info')),
    actions         JSONB DEFAULT '[]',        -- [{type:'notification',channel:'email',...}]
    -- Scheduling
    check_interval_sec INT DEFAULT 300,
    -- State
    is_enabled      BOOLEAN DEFAULT true,
    last_triggered  TIMESTAMPTZ,
    trigger_count   INT DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE alert_rules IS 'Custom alert rules for threshold and anomaly detection';

-- ════════════════════════════════════════════════════════════════════════
-- 8. MITRE ATT&CK Mapping
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS mitre_mappings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    -- ATT&CK identifiers
    technique_id    VARCHAR(20) NOT NULL,       -- e.g. T1059.001
    technique_name  VARCHAR(255) NOT NULL,
    tactic          VARCHAR(100) NOT NULL,      -- e.g. Execution
    -- Mapping
    artifact_name   VARCHAR(255),              -- Velociraptor artifact
    hunt_id         VARCHAR(255),
    case_id         UUID REFERENCES cases(id) ON DELETE SET NULL,
    -- Evidence
    evidence_count  INT DEFAULT 0,
    last_seen       TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE mitre_mappings IS 'MITRE ATT&CK technique mapping for investigations';

-- ════════════════════════════════════════════════════════════════════════
-- 9. Dashboard Widgets (user-customizable)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    widget_type     VARCHAR(50) NOT NULL
                    CHECK (widget_type IN (
                        'metric_card','area_chart','bar_chart','donut_chart',
                        'table','heatmap','timeline','mitre_matrix',
                        'vql_result','geo_map','sparkline','stat_counter'
                    )),
    title           VARCHAR(255) NOT NULL,
    config          JSONB NOT NULL DEFAULT '{}',  -- {dataSource, query, colorScheme, ...}
    position        JSONB NOT NULL DEFAULT '{}',  -- {x, y, w, h} for grid layout
    is_visible      BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE dashboard_widgets IS 'Custom dashboard widget configuration per user';

-- ════════════════════════════════════════════════════════════════════════
-- 10. Data Retention Policies
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS retention_policies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    table_name      VARCHAR(100) NOT NULL,
    retention_days  INT NOT NULL DEFAULT 90,
    is_enabled      BOOLEAN DEFAULT true,
    last_cleanup_at TIMESTAMPTZ,
    rows_deleted    BIGINT DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, table_name)
);

COMMENT ON TABLE retention_policies IS 'Data retention and archival policies per org/table';

-- ════════════════════════════════════════════════════════════════════════
-- Row-Level Security (RLS) policies for multi-org isolation
-- ════════════════════════════════════════════════════════════════════════

-- Enable RLS on core tables
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE mitre_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies require app-level session variable setting:
--   SET app.current_org_id = '<uuid>';
-- The backend sets this on each request via the org middleware.

-- Policy: users see rows matching their org OR rows with NULL org_id (global)
CREATE POLICY org_isolation_cases ON cases
    USING (org_id IS NULL OR org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_case_evidence ON case_evidence
    USING (org_id IS NULL OR org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_case_comments ON case_comments
    USING (org_id IS NULL OR org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_audit_logs ON audit_logs
    USING (org_id IS NULL OR org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_client_tags ON client_tags
    USING (org_id IS NULL OR org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_ai_interactions ON ai_interactions
    USING (org_id IS NULL OR org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_saved_queries ON saved_queries
    USING (org_id IS NULL OR org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_approval_requests ON approval_requests
    USING (org_id IS NULL OR org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_alert_rules ON alert_rules
    USING (org_id IS NULL OR org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_mitre_mappings ON mitre_mappings
    USING (org_id IS NULL OR org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_dashboard_widgets ON dashboard_widgets
    USING (org_id IS NULL OR org_id = current_setting('app.current_org_id', true)::uuid);

-- ════════════════════════════════════════════════════════════════════════
-- Indexes
-- ════════════════════════════════════════════════════════════════════════

-- Organizations
CREATE INDEX IF NOT EXISTS idx_orgs_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_orgs_active ON organizations(is_active);

-- Org members
CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON org_members(org_id, role);

-- API keys
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active, expires_at);

-- Approval requests
CREATE INDEX IF NOT EXISTS idx_approvals_org ON approval_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_approvals_requester ON approval_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approvals_pending ON approval_requests(org_id, status) WHERE status = 'pending';

-- Saved queries
CREATE INDEX IF NOT EXISTS idx_saved_queries_user ON saved_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_queries_org ON saved_queries(org_id);
CREATE INDEX IF NOT EXISTS idx_saved_queries_shared ON saved_queries(org_id, is_shared) WHERE is_shared = true;
CREATE INDEX IF NOT EXISTS idx_saved_queries_type ON saved_queries(query_type);

-- Alert rules
CREATE INDEX IF NOT EXISTS idx_alert_rules_org ON alert_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(is_enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rules_type ON alert_rules(rule_type);

-- MITRE mappings
CREATE INDEX IF NOT EXISTS idx_mitre_org ON mitre_mappings(org_id);
CREATE INDEX IF NOT EXISTS idx_mitre_technique ON mitre_mappings(technique_id);
CREATE INDEX IF NOT EXISTS idx_mitre_tactic ON mitre_mappings(tactic);
CREATE INDEX IF NOT EXISTS idx_mitre_case ON mitre_mappings(case_id);

-- Dashboard widgets
CREATE INDEX IF NOT EXISTS idx_widgets_user ON dashboard_widgets(user_id);
CREATE INDEX IF NOT EXISTS idx_widgets_org ON dashboard_widgets(org_id);
CREATE INDEX IF NOT EXISTS idx_widgets_type ON dashboard_widgets(widget_type);

-- Retention policies
CREATE INDEX IF NOT EXISTS idx_retention_org ON retention_policies(org_id);

-- Org-scoped indexes on existing tables
CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_cases_org ON cases(org_id);
CREATE INDEX IF NOT EXISTS idx_case_evidence_org ON case_evidence(org_id);
CREATE INDEX IF NOT EXISTS idx_case_comments_org ON case_comments(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_client_tags_org ON client_tags(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_org ON ai_interactions(org_id);

-- ════════════════════════════════════════════════════════════════════════
-- Triggers
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_enterprise_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_orgs_updated_at ON organizations;
CREATE TRIGGER trigger_orgs_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_enterprise_updated_at();

DROP TRIGGER IF EXISTS trigger_saved_queries_updated_at ON saved_queries;
CREATE TRIGGER trigger_saved_queries_updated_at
    BEFORE UPDATE ON saved_queries
    FOR EACH ROW EXECUTE FUNCTION update_enterprise_updated_at();

DROP TRIGGER IF EXISTS trigger_alert_rules_updated_at ON alert_rules;
CREATE TRIGGER trigger_alert_rules_updated_at
    BEFORE UPDATE ON alert_rules
    FOR EACH ROW EXECUTE FUNCTION update_enterprise_updated_at();

DROP TRIGGER IF EXISTS trigger_widgets_updated_at ON dashboard_widgets;
CREATE TRIGGER trigger_widgets_updated_at
    BEFORE UPDATE ON dashboard_widgets
    FOR EACH ROW EXECUTE FUNCTION update_enterprise_updated_at();

DROP TRIGGER IF EXISTS trigger_retention_updated_at ON retention_policies;
CREATE TRIGGER trigger_retention_updated_at
    BEFORE UPDATE ON retention_policies
    FOR EACH ROW EXECUTE FUNCTION update_enterprise_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- Seed default organization
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO organizations (name, slug, description)
VALUES ('Default', 'default', 'Default organization')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
