/**
 * Alert rules service — custom threshold / pattern alerting.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

async function listRules({ orgId, isEnabled, ruleType, limit = 50, offset = 0 }) {
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (orgId) { where += ` AND ar.org_id = $${idx++}`; params.push(orgId); }
    if (isEnabled !== undefined) { where += ` AND ar.is_enabled = $${idx++}`; params.push(isEnabled); }
    if (ruleType) { where += ` AND ar.rule_type = $${idx++}`; params.push(ruleType); }

    params.push(limit, offset);
    const result = await query(
        `SELECT ar.*, u.username AS created_by_name
         FROM alert_rules ar
         JOIN users u ON u.id = ar.created_by
         ${where}
         ORDER BY ar.created_at DESC
         LIMIT $${idx++} OFFSET $${idx}`,
        params
    );
    return result.rows;
}

async function getRule(ruleId) {
    const result = await query(
        `SELECT ar.*, u.username AS created_by_name
         FROM alert_rules ar
         JOIN users u ON u.id = ar.created_by
         WHERE ar.id = $1`,
        [ruleId]
    );
    return result.rows[0] || null;
}

async function createRule({ orgId, createdBy, name, description, ruleType, condition, vqlQuery, severity, actions, checkIntervalSec }) {
    const result = await query(
        `INSERT INTO alert_rules
            (org_id, created_by, name, description, rule_type, condition, vql_query, severity, actions, check_interval_sec)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [orgId, createdBy, name, description || null, ruleType || 'threshold',
         condition, vqlQuery || null, severity || 'medium', actions || [], checkIntervalSec || 300]
    );
    logger.info('Alert rule created', { id: result.rows[0].id, name, ruleType });
    return result.rows[0];
}

async function updateRule(ruleId, updates) {
    const allowed = ['name', 'description', 'rule_type', 'condition', 'vql_query',
                     'severity', 'actions', 'check_interval_sec', 'is_enabled'];
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

    if (fields.length === 0) return getRule(ruleId);

    values.push(ruleId);
    const result = await query(
        `UPDATE alert_rules SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
    );
    return result.rows[0];
}

async function deleteRule(ruleId) {
    await query('DELETE FROM alert_rules WHERE id = $1', [ruleId]);
}

async function recordTrigger(ruleId) {
    await query(
        `UPDATE alert_rules SET last_triggered = NOW(), trigger_count = trigger_count + 1 WHERE id = $1`,
        [ruleId]
    );
}

module.exports = { listRules, getRule, createRule, updateRule, deleteRule, recordTrigger };
