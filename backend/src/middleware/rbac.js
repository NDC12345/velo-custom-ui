/**
 * Velociraptor-native RBAC middleware.
 *
 * Maps Velociraptor roles → allowed HTTP operations, then enforces them
 * at the proxy boundary.  The role hierarchy matches Velociraptor source:
 *   acls/roles.go  →  READER < INVESTIGATOR < ANALYST < ORG_ADMIN < ADMINISTRATOR
 *
 * Role definitions (sourced from velociraptor/acls/roles.go):
 *   reader        – read-only access to artifacts, clients, hunts, flows
 *   investigator  – reader + start flows/hunts on existing artifacts
 *   analyst       – investigator + upload/modify artifacts + notebooks
 *   org_admin     – analyst + user management within the org
 *   administrator – everything including server-level config
 *   api_client    – programmatic API access (machine identity)
 *
 * The proxy JWT carries `veloRoles` fetched from Velociraptor at login time.
 * If the user's veloRoles are empty we fall back to `reader` (principle of
 * least privilege).
 */

const { AuthorizationError } = require('../utils/errors');
const logger = require('../utils/logger');

// ─── Role hierarchy ──────────────────────────────────────────────────────────

const ROLE_LEVELS = {
    reader:        10,
    investigator:  20,
    analyst:       30,
    org_admin:     40,
    administrator: 50,
    api_client:    15,  // service accounts — slightly above reader
};

/**
 * Returns true when the user holds at least `minRole`.
 * Local DB role 'admin' is treated as Velociraptor 'administrator'.
 */
function meetsMinRole(veloRoles, minRole, localRoles = []) {
    // Local admin → full administrator privileges regardless of veloRoles
    if (Array.isArray(localRoles) && localRoles.includes('admin')) {
        return true;
    }

    if (!veloRoles || veloRoles.length === 0) {
        // No roles from Velo — grant reader level only
        return ROLE_LEVELS['reader'] >= ROLE_LEVELS[minRole];
    }

    const userLevel = Math.max(
        ...veloRoles.map(r => ROLE_LEVELS[r] || 0)
    );
    return userLevel >= ROLE_LEVELS[minRole];
}

/**
 * Returns true when the user holds any of the listed roles.
 */
function hasAnyRole(veloRoles, ...roles) {
    if (!veloRoles || veloRoles.length === 0) return false;
    return roles.some(r => veloRoles.includes(r));
}

// ─── Pre-built middleware factories ──────────────────────────────────────────

/**
 * Require at least `reader` access.
 * Allows: reader, investigator, analyst, org_admin, administrator, api_client
 */
const requireReader = requireMinRole('reader');

/**
 * Require at least `investigator` access.
 * Allows: investigator, analyst, org_admin, administrator
 */
const requireInvestigator = requireMinRole('investigator');

/**
 * Require at least `analyst` access.
 * Allows: analyst, org_admin, administrator
 */
const requireAnalyst = requireMinRole('analyst');

/**
 * Require at least `org_admin` access.
 */
const requireOrgAdmin = requireMinRole('org_admin');

/**
 * Require `administrator`.
 */
const requireAdmin = requireMinRole('administrator');

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Build a middleware that requires the user to hold at least `minRole`.
 * @param {string} minRole
 */
function requireMinRole(minRole) {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AuthorizationError('Authentication required'));
        }

        const { veloRoles, roles: localRoles, username, orgId } = req.user;

        if (!meetsMinRole(veloRoles, minRole, localRoles)) {
            logger.warn('RBAC denied', {
                username,
                orgId,
                required: minRole,
                heldVelo: veloRoles,
                heldLocal: localRoles,
                path: req.path,
                method: req.method,
            });
            return next(
                new AuthorizationError(
                    `Insufficient permissions: requires at least '${minRole}' role`
                )
            );
        }

        logger.debug('RBAC granted', { username, required: minRole, heldVelo: veloRoles, heldLocal: localRoles });
        next();
    };
}

/**
 * Build a middleware that requires the user to hold at least one of the
 * listed roles explicitly.
 * @param {...string} roles
 */
function requireAnyRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AuthorizationError('Authentication required'));
        }

        const { veloRoles, roles: localRoles, username } = req.user;

        // Local admin bypasses all role checks
        if (Array.isArray(localRoles) && localRoles.includes('admin')) {
            return next();
        }

        if (!hasAnyRole(veloRoles, ...roles)) {
            logger.warn('RBAC denied (anyRole)', {
                username,
                required: roles,
                heldVelo: veloRoles,
                heldLocal: localRoles,
                path: req.path,
            });
            return next(
                new AuthorizationError(
                    `Insufficient permissions: requires one of [${roles.join(', ')}]`
                )
            );
        }

        next();
    };
}

/**
 * Build a middleware that requires `administrator` OR `org_admin`.
 */
const requireAdminOrOrgAdmin = requireAnyRole('administrator', 'org_admin');

module.exports = {
    requireMinRole,
    requireAnyRole,
    requireReader,
    requireInvestigator,
    requireAnalyst,
    requireOrgAdmin,
    requireAdmin,
    requireAdminOrOrgAdmin,
    meetsMinRole,
    hasAnyRole,
};
