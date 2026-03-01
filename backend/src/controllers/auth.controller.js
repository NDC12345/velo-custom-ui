const authService = require('../services/auth.service');
const { asyncHandler } = require('../middleware/errorHandler');
const { generateCSRFToken, setCSRFCookie } = require('../middleware/csrf');
const { ACCESS_TOKEN_COOKIE } = require('../middleware/auth');
const logger = require('../utils/logger');

const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Cookie options for the HttpOnly access token.
 * SameSite=Strict in production; Lax in dev to allow the SPA on a different port.
 */
function accessTokenCookieOptions(maxAgeMs) {
    return {
        httpOnly: true,
        secure:   IS_PROD,
        sameSite: IS_PROD ? 'strict' : 'lax',
        maxAge:   maxAgeMs,
        path:     '/',
    };
}

/**
 * Cookie options for the HttpOnly refresh token.
 * Scoped to /api/auth/refresh so the browser sends it only to that endpoint.
 */
function refreshTokenCookieOptions() {
    return {
        httpOnly: true,
        secure:   IS_PROD,
        sameSite: IS_PROD ? 'strict' : 'lax',
        maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
        path:     '/api/auth/refresh',
    };
}

/**
 * Attach all session cookies and CSRF token to a response.
 */
function issueSessionCookies(res, { accessToken, refreshToken }) {
    // HttpOnly — carries the JWT for API authentication
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, accessTokenCookieOptions(15 * 60 * 1000));

    // HttpOnly — used only by /api/auth/refresh
    res.cookie('refresh_token', refreshToken, refreshTokenCookieOptions());

    // JS-readable — double-submit CSRF token (matches access token TTL)
    const csrfToken = generateCSRFToken();
    setCSRFCookie(res, csrfToken);
}

/**
 * Clear all session cookies on logout.
 */
function clearSessionCookies(res) {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie('refresh_token',     { path: '/api/auth/refresh' });
    res.clearCookie('csrf_token',        { path: '/' });
}

// ─── Register ────────────────────────────────────────────────────────────────

exports.register = asyncHandler(async (req, res) => {
    const { username, email, password, veloServerUrl = '', veloVerifySsl = true } = req.body;

    const result = await authService.register({ username, email, password, veloServerUrl, veloVerifySsl });

    issueSessionCookies(res, result);

    res.status(201).json({
        message: 'User registered successfully',
        user: result.user,
    });
});

// ─── Login ───────────────────────────────────────────────────────────────────

exports.login = asyncHandler(async (req, res) => {
    // Accept either 'password' (what the login form sends) or 'veloPassword' (API clients)
    const { username, veloPassword, password, veloServerUrl } = req.body;

    const result = await authService.login({ username, veloPassword: veloPassword || password, veloServerUrl });

    // Record last login IP asynchronously (non-fatal)
    req.app.locals.db.query(
        'UPDATE users SET last_login_ip = $1 WHERE id = $2',
        [req.ip, result.user.id]
    ).catch(err => logger.error('Failed to update login IP:', err));

    issueSessionCookies(res, result);

    res.json({
        message: 'Login successful',
        user: result.user,
        // veloRoles exposed so the frontend can drive UX decisions;
        // the authoritative check remains server-side via RBAC middleware.
        veloRoles: result.veloRoles || [],
        orgId:     result.orgId    || '',
    });
});

// ─── Refresh ─────────────────────────────────────────────────────────────────

exports.refresh = asyncHandler(async (req, res) => {
    // Accept from HttpOnly cookie (scoped to this path) or body (API clients)
    const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;

    const result = await authService.refreshAccessToken(refreshToken);

    issueSessionCookies(res, result);

    res.json({ message: 'Token refreshed' });
});

// ─── Logout ──────────────────────────────────────────────────────────────────

exports.logout = asyncHandler(async (req, res) => {
    await authService.logout(req.user.userId, req.user.jti);

    clearSessionCookies(res);

    res.json({ message: 'Logout successful' });
});

// ─── Me ──────────────────────────────────────────────────────────────────────

exports.me = asyncHandler(async (req, res) => {
    const { query: dbQuery } = require('../config/database');

    const result = await dbQuery(
        `SELECT id, username, email, roles, velo_roles, velo_org_id,
                velo_server_url, velo_verify_ssl,
                theme, timezone, language, created_at, last_login_at
         FROM users WHERE id = $1`,
        [req.user.userId]
    );

    if (result.rows.length === 0) {
        const { NotFoundError } = require('../utils/errors');
        throw new NotFoundError('User not found');
    }

    res.json({ user: result.rows[0] });
});

// ─── Change password ─────────────────────────────────────────────────────────

exports.changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    if (!/[A-Z]/.test(newPassword)) {
        return res.status(400).json({ error: 'New password must contain at least one uppercase letter' });
    }
    if (!/[0-9]/.test(newPassword)) {
        return res.status(400).json({ error: 'New password must contain at least one number' });
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
        return res.status(400).json({ error: 'New password must contain at least one special character' });
    }

    await authService.changeVeloPassword(req.user.userId, currentPassword, newPassword);

    // Force new tokens with updated credentials
    const result = await authService.rotateTokens(req.user.userId, req.user.jti);
    issueSessionCookies(res, result);

    res.json({ message: 'Password changed successfully' });
});

