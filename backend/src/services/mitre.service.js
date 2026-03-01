/**
 * MITRE ATT&CK mapping service — track technique coverage and evidence.
 */

const { query } = require('../config/database');

async function listMappings({ orgId, tactic, caseId, limit = 200 }) {
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (orgId) { where += ` AND mm.org_id = $${idx++}`; params.push(orgId); }
    if (tactic) { where += ` AND mm.tactic = $${idx++}`; params.push(tactic); }
    if (caseId) { where += ` AND mm.case_id = $${idx++}`; params.push(caseId); }

    params.push(limit);
    const result = await query(
        `SELECT mm.* FROM mitre_mappings mm
         ${where}
         ORDER BY mm.tactic, mm.technique_id
         LIMIT $${idx}`,
        params
    );
    return result.rows;
}

async function addMapping({ orgId, techniqueId, techniqueName, tactic, artifactName, huntId, caseId, notes }) {
    const result = await query(
        `INSERT INTO mitre_mappings
            (org_id, technique_id, technique_name, tactic, artifact_name, hunt_id, case_id, notes, evidence_count, last_seen)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, NOW())
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [orgId, techniqueId, techniqueName, tactic, artifactName || null,
         huntId || null, caseId || null, notes || null]
    );
    return result.rows[0];
}

async function incrementEvidence(mappingId) {
    const result = await query(
        `UPDATE mitre_mappings SET evidence_count = evidence_count + 1, last_seen = NOW()
         WHERE id = $1 RETURNING *`,
        [mappingId]
    );
    return result.rows[0];
}

async function deleteMapping(mappingId) {
    await query('DELETE FROM mitre_mappings WHERE id = $1', [mappingId]);
}

/**
 * Returns a matrix summary: { tactic → [{ technique_id, technique_name, evidence_count }] }
 */
async function getMatrix(orgId) {
    const where = orgId ? 'WHERE org_id = $1' : '';
    const params = orgId ? [orgId] : [];
    const result = await query(
        `SELECT tactic, technique_id, technique_name, SUM(evidence_count) AS evidence_count,
                MAX(last_seen) AS last_seen
         FROM mitre_mappings ${where}
         GROUP BY tactic, technique_id, technique_name
         ORDER BY tactic, technique_id`,
        params
    );

    const matrix = {};
    for (const row of result.rows) {
        if (!matrix[row.tactic]) matrix[row.tactic] = [];
        matrix[row.tactic].push({
            technique_id: row.technique_id,
            technique_name: row.technique_name,
            evidence_count: parseInt(row.evidence_count, 10),
            last_seen: row.last_seen,
        });
    }
    return matrix;
}

/**
 * Returns coverage statistics.
 */
async function getCoverage(orgId) {
    const where = orgId ? 'WHERE org_id = $1' : '';
    const params = orgId ? [orgId] : [];
    const result = await query(
        `SELECT
            COUNT(DISTINCT technique_id) AS techniques_covered,
            COUNT(DISTINCT tactic) AS tactics_covered,
            SUM(evidence_count) AS total_evidence,
            COUNT(*) AS total_mappings
         FROM mitre_mappings ${where}`,
        params
    );
    return result.rows[0];
}

module.exports = { listMappings, addMapping, incrementEvidence, deleteMapping, getMatrix, getCoverage };
