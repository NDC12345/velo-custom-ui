/**
 * CSRF protection using the double-submit cookie pattern.
 *
 * On every authenticated response the server sets a `csrf_token` cookie
 * that is NOT HttpOnly (so JavaScript can read it).  On every
 * state-changing request (POST / PUT / PATCH / DELETE) the client must
 * include the same value in the `X-CSRF-Token` request header.
 * The middleware compares the two; they must match.
 *
 * This pattern is safe because:
 *  - A cross-origin attacker can forge the Cookie header but cannot
 *    read it (SameSite=Strict + CORS block read access).
 *  - A custom request header (X-CSRF-Token) is rejected by browsers for
 *    cross-origin requests unless CORS explicitly permits it (our CORS
 *    config only allows CORS_ORIGIN).
 */

const crypto = require('crypto');
const { AuthenticationError } = require('../utils/errors');
const logger = require('../utils/logger');

const CSRF_COOKIE  = 'csrf_token';
const CSRF_HEADER  = 'x-csrf-token';
const CSRF_BYTES   = 24;

// Safe methods that do NOT mutate state
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Routes that are intentionally CSRF-exempt (public auth endpoints)
const CSRF_EXEMPT_PATHS = new Set([
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
    '/health',
]);

/**
 * Generate a new CSRF token string.
 */
function generateCSRFToken() {
    return crypto.randomBytes(CSRF_BYTES).toString('hex');
}

/**
 * Set (or refresh) the CSRF cookie on the response.
 * Call this after any successful login / token refresh.
 */
function setCSRFCookie(res, token) {
    res.cookie(CSRF_COOKIE, token, {
        httpOnly: false,                                          // Must be readable by JS
        secure:   process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge:   15 * 60 * 1000,                                // Match access token TTL
    });
}

/**
 * Express middleware — enforces CSRF on state-changing requests.
 *
 * Must be mounted AFTER cookieParser().
 */
function csrfProtection(req, res, next) {
    // Safe methods pass through
    if (SAFE_METHODS.has(req.method)) return next();

    // Exempt specific paths (public endpoints)
    if (CSRF_EXEMPT_PATHS.has(req.path)) return next();

    const cookieToken  = req.cookies && req.cookies[CSRF_COOKIE];
    const headerToken  = req.headers[CSRF_HEADER];

    if (!cookieToken || !headerToken) {
        logger.warn('CSRF token missing', {
            path:   req.path,
            method: req.method,
            hasCookie: !!cookieToken,
            hasHeader: !!headerToken,
        });
        return next(new AuthenticationError('CSRF token missing'));
    }

    // Constant-time comparison to prevent timing attacks
    const cookieBuf = Buffer.from(cookieToken);
    const headerBuf = Buffer.from(headerToken);

    if (
        cookieBuf.length !== headerBuf.length ||
        !crypto.timingSafeEqual(cookieBuf, headerBuf)
    ) {
        logger.warn('CSRF token mismatch', {
            path:   req.path,
            method: req.method,
        });
        return next(new AuthenticationError('CSRF token invalid'));
    }

    next();
}

module.exports = {
    csrfProtection,
    generateCSRFToken,
    setCSRFCookie,
    CSRF_COOKIE,
    CSRF_HEADER,
    CSRF_EXEMPT_PATHS,
};
