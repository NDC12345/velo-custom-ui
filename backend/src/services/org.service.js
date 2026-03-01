/**
 * Organization service — CRUD for orgs + membership.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

// ─── Organizations ──────────────────────────────────────────────────────────

async function listOrgs({ isActive = true } = {}) {
    const result = await query(
        `SELECT o.*,
                (SELECT COUNT(*) FROM org_members WHERE org_id = o.id) AS member_count
         FROM organizations o
         WHERE ($1::boolean IS NULL OR o.is_active = $1)
         ORDER BY o.name`,
        [isActive]
    );
    return result.rows;
}

async function getOrg(orgId) {
    const result = await query(
        `SELECT o.*,
                (SELECT COUNT(*) FROM org_members WHERE org_id = o.id) AS member_count,
                (SELECT COUNT(*) FROM api_keys WHERE org_id = o.id AND is_active = true) AS api_key_count
         FROM organizations o
         WHERE o.id = $1`,
        [orgId]
    );
    return result.rows[0] || null;
}

async function createOrg({ name, slug, description, veloServerUrl, veloOrgId, maxUsers, maxApiKeys }) {
    const safeSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const result = await query(
        `INSERT INTO organizations (name, slug, description, velo_server_url, velo_org_id, max_users, max_api_keys)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [name, safeSlug, description || null, veloServerUrl || null, veloOrgId || null, maxUsers || 50, maxApiKeys || 20]
    );
    return result.rows[0];
}

async function updateOrg(orgId, updates) {
    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, val] of Object.entries(updates)) {
        const col = key.replace(/([A-Z])/g, '_$1').toLowerCase(); // camelCase → snake_case
        fields.push(`${col} = $${idx}`);
        values.push(val);
        idx++;
    }

    if (fields.length === 0) return getOrg(orgId);

    values.push(orgId);
    const result = await query(
        `UPDATE organizations SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
    );
    return result.rows[0];
}

async function deleteOrg(orgId) {
    await query('DELETE FROM organizations WHERE id = $1', [orgId]);
}

// ─── Membership ─────────────────────────────────────────────────────────────

async function listMembers(orgId) {
    const result = await query(
        `SELECT om.*, u.username, u.email, u.avatar_url, u.last_login_at
         FROM org_members om
         JOIN users u ON u.id = om.user_id
         WHERE om.org_id = $1
         ORDER BY om.role, u.username`,
        [orgId]
    );
    return result.rows;
}

async function addMember(orgId, userId, role = 'member', invitedBy = null) {
    const result = await query(
        `INSERT INTO org_members (org_id, user_id, role, invited_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role
         RETURNING *`,
        [orgId, userId, role, invitedBy]
    );
    // Also set the user's default org_id
    await query('UPDATE users SET org_id = $1 WHERE id = $2 AND org_id IS NULL', [orgId, userId]);
    return result.rows[0];
}

async function updateMemberRole(orgId, userId, newRole) {
    const result = await query(
        `UPDATE org_members SET role = $1 WHERE org_id = $2 AND user_id = $3 RETURNING *`,
        [newRole, orgId, userId]
    );
    return result.rows[0];
}

async function removeMember(orgId, userId) {
    await query('DELETE FROM org_members WHERE org_id = $1 AND user_id = $2', [orgId, userId]);
}

// ─── API Keys ───────────────────────────────────────────────────────────────

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

async function createApiKey(orgId, userId, { name, scopes = ['read'], expiresInDays = 365 }) {
    // Generate a secure random key
    const rawKey = `velo_${crypto.randomBytes(32).toString('hex')}`;
    const keyPrefix = rawKey.substring(0, 13); // "velo_" + 8 hex chars
    const keyHash = await bcrypt.hash(rawKey, 10);
    const expiresAt = new Date(Date.now() + expiresInDays * 86400000);

    const result = await query(
        `INSERT INTO api_keys (org_id, user_id, name, key_prefix, key_hash, scopes, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, key_prefix, scopes, expires_at, created_at`,
        [orgId, userId, name, keyPrefix, keyHash, scopes, expiresAt]
    );

    // Return the raw key ONCE — it cannot be retrieved again
    return { ...result.rows[0], key: rawKey };
}

async function listApiKeys(orgId) {
    const result = await query(
        `SELECT ak.id, ak.name, ak.key_prefix, ak.scopes, ak.last_used_at,
                ak.expires_at, ak.is_active, ak.created_at, u.username AS created_by
         FROM api_keys ak
         JOIN users u ON u.id = ak.user_id
         WHERE ak.org_id = $1
         ORDER BY ak.created_at DESC`,
        [orgId]
    );
    return result.rows;
}

async function revokeApiKey(keyId, orgId) {
    await query(
        'UPDATE api_keys SET is_active = false WHERE id = $1 AND org_id = $2',
        [keyId, orgId]
    );
}

async function validateApiKey(rawKey) {
    if (!rawKey || !rawKey.startsWith('velo_')) return null;

    const prefix = rawKey.substring(0, 13);
    const result = await query(
        `SELECT ak.*, u.username, u.roles, om.role AS org_role
         FROM api_keys ak
         JOIN users u ON u.id = ak.user_id
         LEFT JOIN org_members om ON om.org_id = ak.org_id AND om.user_id = ak.user_id
         WHERE ak.key_prefix = $1 AND ak.is_active = true
           AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`,
        [prefix]
    );

    for (const row of result.rows) {
        const match = await bcrypt.compare(rawKey, row.key_hash);
        if (match) {
            // Update last_used_at
            await query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [row.id]);
            return row;
        }
    }
    return null;
}

module.exports = {
    listOrgs,
    getOrg,
    createOrg,
    updateOrg,
    deleteOrg,
    listMembers,
    addMember,
    updateMemberRole,
    removeMember,
    createApiKey,
    listApiKeys,
    revokeApiKey,
    validateApiKey,
};
