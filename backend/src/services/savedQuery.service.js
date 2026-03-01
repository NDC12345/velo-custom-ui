/**
 * Saved queries service — persist and manage VQL queries and search templates.
 */

const { query } = require('../config/database');

async function listQueries({ orgId, userId, queryType, isShared, limit = 50, offset = 0 }) {
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (orgId) { where += ` AND sq.org_id = $${idx++}`; params.push(orgId); }
    if (userId && !isShared) { where += ` AND sq.user_id = $${idx++}`; params.push(userId); }
    if (isShared) { where += ` AND sq.is_shared = true`; }
    if (queryType) { where += ` AND sq.query_type = $${idx++}`; params.push(queryType); }

    params.push(limit, offset);
    const result = await query(
        `SELECT sq.*, u.username AS created_by
         FROM saved_queries sq
         JOIN users u ON u.id = sq.user_id
         ${where}
         ORDER BY sq.updated_at DESC
         LIMIT $${idx++} OFFSET $${idx}`,
        params
    );
    return result.rows;
}

async function getQuery(queryId) {
    const result = await query(
        `SELECT sq.*, u.username AS created_by
         FROM saved_queries sq
         JOIN users u ON u.id = sq.user_id
         WHERE sq.id = $1`,
        [queryId]
    );
    return result.rows[0] || null;
}

async function createQuery({ orgId, userId, name, description, queryType, queryText, parameters, isShared, tags }) {
    const result = await query(
        `INSERT INTO saved_queries
            (org_id, user_id, name, description, query_type, query_text, parameters, is_shared, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [orgId, userId, name, description || null, queryType || 'vql', queryText, parameters || {}, isShared || false, tags || []]
    );
    return result.rows[0];
}

async function updateQuery(queryId, userId, updates) {
    const allowed = ['name', 'description', 'query_text', 'parameters', 'is_shared', 'tags'];
    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, val] of Object.entries(updates)) {
        const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (allowed.includes(col)) {
            fields.push(`${col} = $${idx++}`);
            values.push(val);
        }
    }

    if (fields.length === 0) return getQuery(queryId);

    values.push(queryId, userId);
    const result = await query(
        `UPDATE saved_queries SET ${fields.join(', ')}
         WHERE id = $${idx++} AND user_id = $${idx}
         RETURNING *`,
        values
    );
    return result.rows[0];
}

async function deleteQuery(queryId, userId) {
    await query('DELETE FROM saved_queries WHERE id = $1 AND user_id = $2', [queryId, userId]);
}

async function recordRun(queryId) {
    await query(
        `UPDATE saved_queries SET run_count = run_count + 1, last_run_at = NOW() WHERE id = $1`,
        [queryId]
    );
}

module.exports = { listQueries, getQuery, createQuery, updateQuery, deleteQuery, recordRun };
