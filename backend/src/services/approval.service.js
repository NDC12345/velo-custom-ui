/**
 * Approval workflow service — request, approve, reject sensitive operations.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

async function createApproval({ orgId, requesterId, actionType, actionPayload, targetResource, reason }) {
    const result = await query(
        `INSERT INTO approval_requests
            (org_id, requester_id, action_type, action_payload, target_resource, reason)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [orgId, requesterId, actionType, actionPayload, targetResource || null, reason || null]
    );
    logger.info('Approval request created', { id: result.rows[0].id, actionType, requester: requesterId });
    return result.rows[0];
}

async function listApprovals({ orgId, status, requesterId, limit = 50, offset = 0 }) {
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (orgId) { where += ` AND ar.org_id = $${idx++}`; params.push(orgId); }
    if (status) { where += ` AND ar.status = $${idx++}`; params.push(status); }
    if (requesterId) { where += ` AND ar.requester_id = $${idx++}`; params.push(requesterId); }

    params.push(limit, offset);
    const result = await query(
        `SELECT ar.*,
                req.username AS requester_username,
                appr.username AS approver_username
         FROM approval_requests ar
         JOIN users req ON req.id = ar.requester_id
         LEFT JOIN users appr ON appr.id = ar.approver_id
         ${where}
         ORDER BY ar.created_at DESC
         LIMIT $${idx++} OFFSET $${idx}`,
        params
    );
    return result.rows;
}

async function getApproval(approvalId) {
    const result = await query(
        `SELECT ar.*,
                req.username AS requester_username,
                appr.username AS approver_username
         FROM approval_requests ar
         JOIN users req ON req.id = ar.requester_id
         LEFT JOIN users appr ON appr.id = ar.approver_id
         WHERE ar.id = $1`,
        [approvalId]
    );
    return result.rows[0] || null;
}

async function decideApproval(approvalId, approverId, decision, decisionNote) {
    if (!['approved', 'rejected'].includes(decision)) {
        throw new Error('Decision must be approved or rejected');
    }

    const result = await query(
        `UPDATE approval_requests
         SET status = $1, approver_id = $2, decision_note = $3, decided_at = NOW()
         WHERE id = $4 AND status = 'pending'
         RETURNING *`,
        [decision, approverId, decisionNote || null, approvalId]
    );

    if (result.rows.length === 0) {
        throw new Error('Approval not found or already decided');
    }

    logger.info('Approval decided', { id: approvalId, decision, approver: approverId });
    return result.rows[0];
}

async function cancelApproval(approvalId, requesterId) {
    const result = await query(
        `UPDATE approval_requests
         SET status = 'cancelled'
         WHERE id = $1 AND requester_id = $2 AND status = 'pending'
         RETURNING *`,
        [approvalId, requesterId]
    );
    return result.rows[0] || null;
}

async function getPendingCount(orgId) {
    const result = await query(
        `SELECT COUNT(*) AS count FROM approval_requests
         WHERE org_id = $1 AND status = 'pending' AND (expires_at IS NULL OR expires_at > NOW())`,
        [orgId]
    );
    return parseInt(result.rows[0].count, 10);
}

/**
 * Expire stale pending requests.
 */
async function expireStaleRequests() {
    const result = await query(
        `UPDATE approval_requests
         SET status = 'expired'
         WHERE status = 'pending' AND expires_at < NOW()
         RETURNING id`
    );
    if (result.rows.length > 0) {
        logger.info(`Expired ${result.rows.length} stale approval requests`);
    }
    return result.rows.length;
}

module.exports = {
    createApproval,
    listApprovals,
    getApproval,
    decideApproval,
    cancelApproval,
    getPendingCount,
    expireStaleRequests,
};
