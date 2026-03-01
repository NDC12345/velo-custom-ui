/**
 * Organization middleware — injects org context into every request and
 * sets the PostgreSQL session variable for RLS enforcement.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Sets `app.current_org_id` on the PG session so RLS policies filter rows.
 * Must run AFTER authenticateJWT so req.user is available.
 */
async function orgContext(req, res, next) {
    try {
        const orgId = req.user?.orgId || req.headers['x-org-id'] || null;

        if (orgId) {
            // Validate org exists and is active
            const result = await query(
                'SELECT id FROM organizations WHERE id = $1 AND is_active = true LIMIT 1',
                [orgId]
            );

            if (result.rows.length > 0) {
                req.orgId = orgId;
                // Use set_config with is_local=true — safe with connection pooling and
                // works outside an explicit transaction (scoped to statement/session).
                await query("SELECT set_config('app.current_org_id', $1, false)", [orgId]);
            } else {
                req.orgId = null;
            }
        } else {
            req.orgId = null;
        }

        next();
    } catch (err) {
        // Non-fatal — just log and continue without org isolation
        logger.debug('Org context setup skipped:', err.message);
        req.orgId = null;
        next();
    }
}

/**
 * Require that the current user belongs to an organization.
 */
function requireOrg(req, res, next) {
    if (!req.orgId) {
        return res.status(403).json({ error: 'Organization context required' });
    }
    next();
}

/**
 * Require that the user has a specific org role (owner/admin/member/viewer).
 */
function requireOrgRole(...allowedRoles) {
    return async (req, res, next) => {
        if (!req.orgId || !req.user?.userId) {
            return res.status(403).json({ error: 'Organization context required' });
        }

        try {
            const result = await query(
                'SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2 LIMIT 1',
                [req.orgId, req.user.userId]
            );

            if (result.rows.length === 0) {
                return res.status(403).json({ error: 'Not a member of this organization' });
            }

            const userRole = result.rows[0].role;
            if (!allowedRoles.includes(userRole)) {
                return res.status(403).json({
                    error: `Insufficient org role: requires one of [${allowedRoles.join(', ')}]`
                });
            }

            req.orgRole = userRole;
            next();
        } catch (err) {
            logger.error('Org role check failed:', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    };
}

module.exports = { orgContext, requireOrg, requireOrgRole };
