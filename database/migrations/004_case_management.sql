-- Migration 004: Case Management System
-- Creates tables for investigation case tracking, evidence linking, and case comments.

-- ═══════════════════════════════════════════════════════════════════════════════
-- CASES TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    status          VARCHAR(50) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'in_progress', 'pending', 'closed', 'archived')),
    severity        VARCHAR(20) NOT NULL DEFAULT 'medium'
                    CHECK (severity IN ('critical', 'high', 'medium', 'low', 'informational')),
    priority        INTEGER NOT NULL DEFAULT 3
                    CHECK (priority BETWEEN 1 AND 5),
    assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tags            TEXT[] DEFAULT '{}',
    client_ids      TEXT[] DEFAULT '{}',       -- linked Velo client IDs
    hunt_ids        TEXT[] DEFAULT '{}',        -- linked Velo hunt IDs
    flow_ids        TEXT[] DEFAULT '{}',        -- linked Velo flow IDs
    tlp             VARCHAR(10) DEFAULT 'AMBER' CHECK (tlp IN ('WHITE', 'GREEN', 'AMBER', 'RED')),
    ioc_summary     JSONB DEFAULT '{}',        -- key IOCs for quick reference
    closed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE cases IS 'Investigation cases linking Velo artifacts, clients, hunts, and flows';

-- ═══════════════════════════════════════════════════════════════════════════════
-- CASE EVIDENCE TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS case_evidence (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    evidence_type   VARCHAR(50) NOT NULL
                    CHECK (evidence_type IN ('artifact', 'flow', 'hunt', 'vfs_file', 'notebook', 'screenshot', 'ioc', 'note')),
    reference_id    VARCHAR(255),              -- Velo ID (flow_id, hunt_id, artifact name, etc.)
    client_id       VARCHAR(255),              -- associated client
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    metadata        JSONB DEFAULT '{}',
    added_by        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE case_evidence IS 'Evidence items linked to investigation cases';

-- ═══════════════════════════════════════════════════════════════════════════════
-- CASE COMMENTS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS case_comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    comment_type    VARCHAR(20) DEFAULT 'comment'
                    CHECK (comment_type IN ('comment', 'status_change', 'evidence_added', 'system')),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE case_comments IS 'Comments and activity log for investigation cases';

-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_severity ON cases(severity);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_to ON cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_cases_created_by ON cases(created_by);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_tags ON cases USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_cases_client_ids ON cases USING GIN(client_ids);

CREATE INDEX IF NOT EXISTS idx_case_evidence_case_id ON case_evidence(case_id);
CREATE INDEX IF NOT EXISTS idx_case_evidence_type ON case_evidence(evidence_type);
CREATE INDEX IF NOT EXISTS idx_case_evidence_client_id ON case_evidence(client_id);

CREATE INDEX IF NOT EXISTS idx_case_comments_case_id ON case_comments(case_id);
CREATE INDEX IF NOT EXISTS idx_case_comments_author_id ON case_comments(author_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- UPDATE TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_cases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cases_updated_at ON cases;
CREATE TRIGGER trigger_cases_updated_at
    BEFORE UPDATE ON cases
    FOR EACH ROW EXECUTE FUNCTION update_cases_updated_at();

DROP TRIGGER IF EXISTS trigger_case_comments_updated_at ON case_comments;
CREATE TRIGGER trigger_case_comments_updated_at
    BEFORE UPDATE ON case_comments
    FOR EACH ROW EXECUTE FUNCTION update_cases_updated_at();
