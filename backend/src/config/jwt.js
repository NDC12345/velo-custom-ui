const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set in environment variables');
}

if (JWT_SECRET.length < 32 || JWT_REFRESH_SECRET.length < 32) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must each be at least 32 characters');
}

/**
 * Generate a cryptographically random JWT ID for token revocation tracking.
 */
function generateJTI() {
    return crypto.randomBytes(24).toString('hex');
}

/**
 * Generate access token.
 *
 * SECURITY: The access token is NOT encrypted — its payload is base64-decodable
 * by anyone who holds the token string.  Therefore only an opaque session
 * identity is embedded:
 *
 *   jti     – unique token ID for revocation tracking
 *   sub     – user UUID (no username, no roles, no Velo identity)
 *   iat/exp – standard timing claims
 *
 * All user attributes (username, roles, veloRoles, orgId, veloUsername) are
 * loaded from the database by authenticateJWT middleware on each request.
 * This means:
 *   1. No sensitive data leaks via a decoded JWT.
 *   2. Role / permission changes take effect immediately without re-login.
 *   3. Revocation is the only token metadata stored client-side.
 *
 * @param {Object} user
 * @param {string} user.id - User UUID
 * @returns {{ token: string, jti: string }}
 */
function generateAccessToken(user) {
    const jti = generateJTI();
    const payload = {
        jti,
        sub: user.id,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
        algorithm: 'HS256',
        issuer: 'velo-custom-ui',
        audience: 'velo-api',
    });

    return { token, jti };
}

/**
 * Generate refresh token.
 * Minimal payload — only userId + type + jti.
 * @param {Object} user
 * @returns {{ token: string, jti: string }}
 */
function generateRefreshToken(user) {
    const jti = generateJTI();
    const payload = {
        jti,
        sub: user.id,
        userId: user.id,
        type: 'refresh',
    };

    const token = jwt.sign(payload, JWT_REFRESH_SECRET, {
        expiresIn: JWT_REFRESH_EXPIRES_IN,
        algorithm: 'HS256',
        issuer: 'velo-custom-ui',
        audience: 'velo-refresh',
    });

    return { token, jti };
}

/**
 * Verify access token.
 * @param {string} token
 * @returns {Object} decoded payload including jti
 */
function verifyAccessToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET, {
            algorithms: ['HS256'],
            issuer: 'velo-custom-ui',
            audience: 'velo-api',
        });
    } catch (error) {
        logger.debug('Access token verification failed:', error.message);
        throw error;
    }
}

/**
 * Verify refresh token.
 * @param {string} token
 * @returns {Object} decoded payload including jti
 */
function verifyRefreshToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
            algorithms: ['HS256'],
            issuer: 'velo-custom-ui',
            audience: 'velo-refresh',
        });

        if (decoded.type !== 'refresh') {
            throw new Error('Invalid token type');
        }

        return decoded;
    } catch (error) {
        logger.debug('Refresh token verification failed:', error.message);
        throw error;
    }
}

/**
 * Get token expiry Date for a given duration string.
 * @param {string} expiresIn
 * @returns {Date}
 */
function getTokenExpiry(expiresIn = JWT_REFRESH_EXPIRES_IN) {
    const ms = require('ms')(expiresIn);
    return new Date(Date.now() + ms);
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    getTokenExpiry,
    generateJTI,
    JWT_EXPIRES_IN,
    JWT_REFRESH_EXPIRES_IN,
};
