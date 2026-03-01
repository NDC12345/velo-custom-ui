/**
 * Case Management Service
 *
 * Manages investigation cases, evidence linking, and case comments.
 * Cases are stored locally (not in Velociraptor) to allow custom workflows.
 */
'use strict';

const { query } = require('../config/database');
const logger = require('../utils/logger');

class CaseService {
    // ─── Cases ────────────────────────────────────────────────────────────────

    /**
     * List cases with filtering and pagination.
     */
    async listCases({ status, severity, assigned_to, search, offset = 0, limit = 50 } = {}) {
        const conditions = [];
        const params = [];
        let paramIdx = 1;

        if (status) {
            conditions.push(`c.status = $${paramIdx++}`);
            params.push(status);
        }
        if (severity) {
            conditions.push(`c.severity = $${paramIdx++}`);
            params.push(severity);
        }
        if (assigned_to) {
            conditions.push(`c.assigned_to = $${paramIdx++}`);
            params.push(assigned_to);
        }
        if (search) {
            conditions.push(`(c.title ILIKE $${paramIdx} OR c.description ILIKE $${paramIdx})`);
            params.push(`%${search}%`);
            paramIdx++;
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countResult = await query(`SELECT COUNT(*) FROM cases c ${where}`, params);
        const total = parseInt(countResult.rows[0].count, 10);

        const casesResult = await query(
            `SELECT c.*, 
                    u1.username AS assigned_to_username,
                    u2.username AS created_by_username,
                    (SELECT COUNT(*) FROM case_evidence WHERE case_id = c.id) AS evidence_count,
                    (SELECT COUNT(*) FROM case_comments WHERE case_id = c.id) AS comment_count
             FROM cases c
             LEFT JOIN users u1 ON c.assigned_to = u1.id
             LEFT JOIN users u2 ON c.created_by = u2.id
             ${where}
             ORDER BY c.priority ASC, c.created_at DESC
             LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            [...params, limit, offset]
        );

        return { items: casesResult.rows, total, offset, limit };
    }

    /**
     * Get a single case by ID with full details.
     */
    async getCase(caseId) {
        const result = await query(
            `SELECT c.*,
                    u1.username AS assigned_to_username,
                    u2.username AS created_by_username
             FROM cases c
             LEFT JOIN users u1 ON c.assigned_to = u1.id
             LEFT JOIN users u2 ON c.created_by = u2.id
             WHERE c.id = $1`,
            [caseId]
        );

        if (result.rows.length === 0) return null;

        const caseData = result.rows[0];

        // Fetch evidence and comments
        const [evidence, comments] = await Promise.all([
            this.listCaseEvidence(caseId),
            this.listCaseComments(caseId),
        ]);

        return { ...caseData, evidence: evidence.items, comments: comments.items };
    }

    /**
     * Create a new investigation case.
     */
    async createCase(caseData, userId) {
        const {
            title, description = '', status = 'open', severity = 'medium',
            priority = 3, assigned_to = null, tags = [], client_ids = [],
            hunt_ids = [], flow_ids = [], tlp = 'AMBER', ioc_summary = {},
        } = caseData;

        const result = await query(
            `INSERT INTO cases (title, description, status, severity, priority,
                                assigned_to, created_by, tags, client_ids,
                                hunt_ids, flow_ids, tlp, ioc_summary)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [title, description, status, severity, priority, assigned_to, userId,
             tags, client_ids, hunt_ids, flow_ids, tlp, JSON.stringify(ioc_summary)]
        );

        logger.info('Case created', { caseId: result.rows[0].id, title, userId });
        return result.rows[0];
    }

    /**
     * Update an existing case.
     */
    async updateCase(caseId, updates, userId) {
        const allowedFields = [
            'title', 'description', 'status', 'severity', 'priority',
            'assigned_to', 'tags', 'client_ids', 'hunt_ids', 'flow_ids',
            'tlp', 'ioc_summary',
        ];

        const setClauses = [];
        const params = [];
        let paramIdx = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                setClauses.push(`${key} = $${paramIdx++}`);
                params.push(key === 'ioc_summary' ? JSON.stringify(value) : value);
            }
        }

        if (setClauses.length === 0) {
            throw new Error('No valid fields to update');
        }

        // Auto-set closed_at when status changes to closed/archived
        if (updates.status === 'closed' || updates.status === 'archived') {
            setClauses.push(`closed_at = NOW()`);
        } else if (updates.status && updates.status !== 'closed' && updates.status !== 'archived') {
            setClauses.push(`closed_at = NULL`);
        }

        params.push(caseId);
        const result = await query(
            `UPDATE cases SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
            params
        );

        if (result.rows.length === 0) return null;

        // Auto-add status change comment
        if (updates.status) {
            await this.addCaseComment(caseId, {
                content: `Status changed to "${updates.status}"`,
                comment_type: 'status_change',
            }, userId);
        }

        logger.info('Case updated', { caseId, updates: Object.keys(updates), userId });
        return result.rows[0];
    }

    /**
     * Delete a case and all related data.
     */
    async deleteCase(caseId) {
        const result = await query('DELETE FROM cases WHERE id = $1 RETURNING id', [caseId]);
        return result.rows.length > 0;
    }

    // ─── Evidence ─────────────────────────────────────────────────────────────

    /**
     * List evidence for a case.
     */
    async listCaseEvidence(caseId) {
        const result = await query(
            `SELECT e.*, u.username AS added_by_username
             FROM case_evidence e
             LEFT JOIN users u ON e.added_by = u.id
             WHERE e.case_id = $1
             ORDER BY e.created_at DESC`,
            [caseId]
        );
        return { items: result.rows, total: result.rows.length };
    }

    /**
     * Add evidence to a case.
     */
    async addEvidence(caseId, evidenceData, userId) {
        const {
            evidence_type, reference_id = null, client_id = null,
            title, description = '', metadata = {},
        } = evidenceData;

        const result = await query(
            `INSERT INTO case_evidence (case_id, evidence_type, reference_id, client_id,
                                         title, description, metadata, added_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [caseId, evidence_type, reference_id, client_id, title, description,
             JSON.stringify(metadata), userId]
        );

        // Auto-add comment
        await this.addCaseComment(caseId, {
            content: `Evidence added: ${evidence_type} — ${title}`,
            comment_type: 'evidence_added',
            metadata: { evidence_id: result.rows[0].id },
        }, userId);

        return result.rows[0];
    }

    /**
     * Remove evidence from a case.
     */
    async removeEvidence(evidenceId) {
        const result = await query('DELETE FROM case_evidence WHERE id = $1 RETURNING id', [evidenceId]);
        return result.rows.length > 0;
    }

    // ─── Comments ─────────────────────────────────────────────────────────────

    /**
     * List comments for a case.
     */
    async listCaseComments(caseId) {
        const result = await query(
            `SELECT cc.*, u.username AS author_username
             FROM case_comments cc
             LEFT JOIN users u ON cc.author_id = u.id
             WHERE cc.case_id = $1
             ORDER BY cc.created_at ASC`,
            [caseId]
        );
        return { items: result.rows, total: result.rows.length };
    }

    /**
     * Add a comment to a case.
     */
    async addCaseComment(caseId, commentData, userId) {
        const {
            content, comment_type = 'comment', metadata = {},
        } = commentData;

        const result = await query(
            `INSERT INTO case_comments (case_id, author_id, content, comment_type, metadata)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [caseId, userId, content, comment_type, JSON.stringify(metadata)]
        );

        return result.rows[0];
    }

    /**
     * Delete a comment.
     */
    async deleteComment(commentId) {
        const result = await query('DELETE FROM case_comments WHERE id = $1 RETURNING id', [commentId]);
        return result.rows.length > 0;
    }

    // ─── Statistics ───────────────────────────────────────────────────────────

    /**
     * Get case statistics for dashboard.
     */
    async getCaseStats() {
        const result = await query(`
            SELECT 
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'open')::int AS open,
                COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
                COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
                COUNT(*) FILTER (WHERE status = 'closed')::int AS closed,
                COUNT(*) FILTER (WHERE severity = 'critical')::int AS critical,
                COUNT(*) FILTER (WHERE severity = 'high')::int AS high,
                COUNT(*) FILTER (WHERE severity = 'medium')::int AS medium_sev,
                COUNT(*) FILTER (WHERE severity = 'low')::int AS low
            FROM cases
        `);
        return result.rows[0];
    }
}

module.exports = new CaseService();
