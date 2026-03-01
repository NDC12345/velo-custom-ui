const { verifyAccessToken } = require('../config/jwt');
const { query } = require('../config/database');
const { AuthenticationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Cookie name used to carry the HttpOnly access token.
 */
const ACCESS_TOKEN_COOKIE = 'access_token';

/**
 * Check whether a JTI has been revoked.
 * Falls back gracefully if the DB is unavailable.
 */
async function isJTIRevoked(jti) {
    if (!jti) return false;
    try {
        const result = await query(
            'SELECT 1 FROM revoked_tokens WHERE jti = $1 LIMIT 1',
            [jti]
        );
        return result.rows.length > 0;
    } catch (err) {
        logger.error('JTI revocation check failed (DB error):', err.message);
        // Fail CLOSED — treat DB errors as revoked to prevent bypassing
        // token revocation. Users simply need to re-authenticate.
        return true;
    }
}

/**
 * Load the full user record from the database by user UUID.
 *
 * SECURITY: The JWT access token only carries sub (userId) + jti.
 * All user attributes are authoritative in the DB, not in the token.
 * This means:
 *   - Role / permission changes apply immediately (no stale token claims).
 *   - Nothing sensitive is readable by decoding the token string.
 *
 * @param {string} userId
 * @returns {Object|null}
 */
async function loadUserFromDB(userId) {
    try {
        const result = await query(
            `SELECT id, username, email, roles, velo_roles, velo_org_id,
                    is_active, is_locked
             FROM users
             WHERE id = $1
               AND deleted_at IS NULL`,
            [userId]
        );
        return result.rows[0] || null;
    } catch (err) {
        logger.error('loadUserFromDB failed:', err.message);
        return null;
    }
}

/**
 * Primary JWT authentication middleware.
 *
 * Token source priority:
 *   1. `access_token` HttpOnly cookie  (browser clients)
 *   2. `Authorization: Bearer <token>` header (API/CLI clients)
 *
 * Flow:
 *   1. Extract token from cookie or Authorization header.
 *   2. Cryptographically verify the token signature + audience + issuer.
 *   3. Check JTI against the revocation table.
 *   4. Load the full user record from the database (NOT from token claims).
 *
 * After success the following are attached to req.user:
 *   userId       - UUID
 *   username     - display username
 *   roles        - custom UI roles   (from DB, not token)
 *   veloRoles    - Velociraptor RBAC roles (from DB, not token)
 *   orgId        - Velociraptor org identifier (from DB, not token)
 *   jti          - token ID (for revocation on logout)
 */
async function authenticateJWT(req, res, next) {
    let token = null;

    // 1. HttpOnly cookie (preferred — immune to XSS)
    if (req.cookies && req.cookies[ACCESS_TOKEN_COOKIE]) {
        token = req.cookies[ACCESS_TOKEN_COOKIE];
    }

    // 2. Bearer header fallback (API / CLI / service-to-service)
    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }

    if (!token) {
        return next(new AuthenticationError('No authentication token provided'));
    }

    try {
        const decoded = verifyAccessToken(token);

        // The token only carries sub + jti — nothing else to trust from it.
        const userId = decoded.sub;
        if (!userId) {
            return next(new AuthenticationError('Malformed token: missing subject'));
        }

        // Verify this JTI has not been revoked (logout / forced rotation)
        if (decoded.jti) {
            const revoked = await isJTIRevoked(decoded.jti);
            if (revoked) {
                return next(new AuthenticationError('Token has been revoked'));
            }
        }

        // Load authoritative user data from DB — never from token payload
        const dbUser = await loadUserFromDB(userId);
        if (!dbUser) {
            return next(new AuthenticationError('User not found or deleted'));
        }
        if (!dbUser.is_active || dbUser.is_locked) {
            return next(new AuthenticationError('Account is disabled'));
        }

        req.user = {
            userId,
            username:    dbUser.username,
            email:       dbUser.email,
            roles:       dbUser.roles       || ['user'],
            veloRoles:   dbUser.velo_roles  || [],
            orgId:       dbUser.velo_org_id || '',
            jti:         decoded.jti,
        };

        logger.debug('JWT authenticated', {
            userId:  req.user.userId,
            orgId:   req.user.orgId,
        });

        next();
    } catch (error) {
        logger.debug('JWT verification failed:', error.message);

        if (error.name === 'TokenExpiredError') {
            return next(new AuthenticationError('Token expired'));
        }

        return next(new AuthenticationError('Invalid token'));
    }
}

/**
 * Optional JWT — attaches user if token present and valid, does not block.
 * Used on endpoints that work for both authenticated and anonymous users.
 */
async function optionalAuth(req, res, next) {
    let token = null;

    if (req.cookies && req.cookies[ACCESS_TOKEN_COOKIE]) {
        token = req.cookies[ACCESS_TOKEN_COOKIE];
    }

    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }

    if (!token) return next();

    try {
        const decoded = verifyAccessToken(token);
        const userId  = decoded.sub;
        const revoked = decoded.jti ? await isJTIRevoked(decoded.jti) : false;

        if (!revoked && userId) {
            const dbUser = await loadUserFromDB(userId);
            if (dbUser && dbUser.is_active && !dbUser.is_locked) {
                req.user = {
                    userId,
                    username:  dbUser.username,
                    email:     dbUser.email,
                    roles:     dbUser.roles      || ['user'],
                    veloRoles: dbUser.velo_roles || [],
                    orgId:     dbUser.velo_org_id || '',
                    jti:       decoded.jti,
                };
            }
        }
    } catch (_) {
        // Silently ignore — optional auth does not block the request
    }

    next();
}

/**
 * Custom UI RBAC middleware.
 * Checks the user's custom-UI `roles` array (not Velo roles — see rbac.js for that).
 *
 * @param  {...string} allowedRoles
 */
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AuthenticationError('Authentication required'));
        }

        const userRoles = req.user.roles || [];
        const hasRole = allowedRoles.some(role => userRoles.includes(role));

        if (!hasRole) {
            const { AuthorizationError } = require('../utils/errors');
            return next(new AuthorizationError('Insufficient permissions'));
        }

        next();
    };
}

module.exports = {
    authenticateJWT,
    optionalAuth,
    requireRole,
    isJTIRevoked,
    ACCESS_TOKEN_COOKIE,
};
