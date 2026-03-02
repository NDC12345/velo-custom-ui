const bcrypt = require('bcryptjs');
const { query, transaction } = require('../config/database');
const { encryptCredential, decryptCredential } = require('../config/encryption');
const { generateAccessToken, generateRefreshToken, getTokenExpiry } = require('../config/jwt');
const { testCredentials, obtainSession, fetchUserRoles } = require('../config/velo-api');
const { AuthenticationError, ConflictError, NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

//  Helpers 

/**
 * Build the full user object needed by generateAccessToken.
 */
function buildTokenUser(user, veloRoles = [], orgId = '') {
    return {
        id:          user.id,
        username:    user.username,
        email:       user.email,
        roles:       user.roles || ['user'],
        veloUsername: user.velo_username_decrypted || user.username,
        veloRoles,
        orgId:       orgId || user.velo_org_id || '',
    };
}

/**
 * Revoke a JTI in the database.  Non-fatal on error.
 */
async function revokeJTI(jti, userId, expiresAt) {
    if (!jti) return;
    try {
        await query(
            `INSERT INTO revoked_tokens (jti, user_id, expires_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (jti) DO NOTHING`,
            [jti, userId, expiresAt || new Date(Date.now() + 15 * 60 * 1000)]
        );
    } catch (err) {
        logger.error('Failed to revoke JTI:', err.message);
    }
}

//  Register 

async function register(userData) {
    const { username, email, password, veloServerUrl = '', veloVerifySsl = true } = userData;
    // UI username IS the Velociraptor username — no separate identity
    const veloUsername = username;
    const veloPassword = password;

    const existing = await query(
        'SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL',
        [username]
    );
    if (existing.rows.length > 0) throw new ConflictError('Username already exists');

    const skipVeloAuth = process.env.VELO_SKIP_AUTH_CHECK === 'true';
    let veloRoles = [];
    let orgId = '';

    if (!skipVeloAuth) {
        await testCredentials(veloUsername, veloPassword, veloServerUrl, veloVerifySsl);
        // Fetch Velo RBAC roles immediately after credential verify
        const rolesData = await fetchUserRoles(
            { username: veloUsername, password: veloPassword }, veloUsername, veloServerUrl, veloVerifySsl
        ).catch(() => ({}));
        veloRoles = rolesData.roles || [];
        orgId = rolesData.orgId || '';
    } else {
        logger.warn('Skipping Velo credential verification (VELO_SKIP_AUTH_CHECK=true)', { username });
    }

    const encUn = encryptCredential(veloUsername);
    const encPw = encryptCredential(veloPassword);

    const result = await transaction(async (client) => {
        const insertResult = await client.query(
            `INSERT INTO users (
                username, email,
                velo_username_encrypted, velo_username_iv, velo_username_auth_tag,
                velo_password_encrypted, velo_password_iv, velo_password_auth_tag,
                velo_roles, velo_org_id, velo_roles_synced_at,
                velo_server_url, velo_verify_ssl
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12)
            RETURNING id, username, email, roles, velo_roles, velo_org_id`,
            [
                username, email,
                Buffer.from(encUn.encrypted, 'hex'), encUn.iv, encUn.authTag,
                Buffer.from(encPw.encrypted, 'hex'), encPw.iv, encPw.authTag,
                veloRoles, orgId,
                veloServerUrl || null, veloVerifySsl,
            ]
        );

        const user = insertResult.rows[0];
        const tokenUser = buildTokenUser(user, veloRoles, orgId);

        const { token: accessToken, jti: accessJti } = generateAccessToken(tokenUser);
        const { token: refreshToken, jti: refreshJti } = generateRefreshToken(user);

        const refreshHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
        const expiresAt   = getTokenExpiry();

        await client.query(
            `UPDATE users SET
                refresh_token_hash = $1, refresh_token_expires_at = $2,
                current_access_jti = $3
             WHERE id = $4`,
            [refreshHash, expiresAt, accessJti, user.id]
        );

        return { user: { id: user.id, username: user.username, email: user.email, roles: user.roles },
                 accessToken, refreshToken, veloRoles, orgId };
    });

    logger.info('User registered', { username });
    return result;
}

//  Login 

async function login(credentials) {
    const { username, veloPassword, veloServerUrl: incomingServerUrl } = credentials;

    const result = await query(
        `SELECT id, username, email, roles, is_active, is_locked,
                velo_username_encrypted, velo_username_iv, velo_username_auth_tag,
                velo_password_encrypted, velo_password_iv, velo_password_auth_tag,
                velo_roles, velo_org_id, current_access_jti,
                velo_server_url, velo_verify_ssl,
                failed_login_attempts, locked_until, avatar_url
         FROM users WHERE username = $1 AND deleted_at IS NULL`,
        [username]
    );

    if (result.rows.length === 0) throw new AuthenticationError('Invalid credentials');
    const user = result.rows[0];

    if (user.is_locked || (user.locked_until && new Date(user.locked_until) > new Date())) {
        throw new AuthenticationError('Account is locked. Contact administrator.');
    }
    if (!user.is_active) throw new AuthenticationError('Account is inactive');

    // UI username IS the Velociraptor username — unified identity
    const veloUsername = username;

    const skipVeloAuth = process.env.VELO_SKIP_AUTH_CHECK === 'true';
    let veloAuthSuccess = false;
    let veloRoles = user.velo_roles || [];
    let orgId = user.velo_org_id || '';

    // Per-user server URL — incoming overrides DB value if provided (and DB is empty)
    const resolvedIncomingUrl = (incomingServerUrl || '').trim().replace(/\/$/, '');
    const userServerUrl = resolvedIncomingUrl || user.velo_server_url || '';
    const userVerifySsl = user.velo_verify_ssl !== false;

    if (skipVeloAuth) {
        logger.warn('Skipping Velo credential verification (VELO_SKIP_AUTH_CHECK=true)', { username });
        veloAuthSuccess = true;
    } else {
        // Password is required when Velo auth is enabled
        if (!veloPassword) throw new AuthenticationError('Password is required');
        try {
            const auth = { username: veloUsername, password: veloPassword };

            await testCredentials(veloUsername, veloPassword, userServerUrl, userVerifySsl);
            veloAuthSuccess = true;

            // Prime session + refresh RBAC roles from Velo
            const [, rolesData] = await Promise.all([
                obtainSession(auth, '', userServerUrl, userVerifySsl).catch(() => {}),
                fetchUserRoles(auth, veloUsername, userServerUrl, userVerifySsl).catch(() => ({})),
            ]);

            if (rolesData && rolesData.roles) {
                veloRoles = rolesData.roles;
                orgId = rolesData.orgId || orgId;
            }

            // Always sync velo credentials (username = UI username, password = submitted password)
            const encUn = encryptCredential(username);
            const encPw = encryptCredential(veloPassword);

            // Build UPDATE with clean sequential params to avoid off-by-one errors
            const updates = [veloRoles, orgId];
            let p = 3; // next param index ($1=veloRoles, $2=orgId)

            let sql = `UPDATE users SET velo_roles = $1, velo_org_id = $2, velo_roles_synced_at = NOW(),
                         velo_username_encrypted = $${p++},
                         velo_username_iv = $${p++},
                         velo_username_auth_tag = $${p++},
                         velo_password_encrypted = $${p++},
                         velo_password_iv = $${p++},
                         velo_password_auth_tag = $${p++}`;
            updates.push(
                Buffer.from(encUn.encrypted, 'hex'), encUn.iv, encUn.authTag,
                Buffer.from(encPw.encrypted, 'hex'), encPw.iv, encPw.authTag
            );

            if (resolvedIncomingUrl && resolvedIncomingUrl !== (user.velo_server_url || '')) {
                sql += `, velo_server_url = $${p++}`;
                updates.push(resolvedIncomingUrl);
            }
            updates.push(user.id);
            sql += ` WHERE id = $${p}`;
            await query(sql, updates);

        } catch (_) {
            veloAuthSuccess = false;
        }
    }

    if (!veloAuthSuccess) {
        const attempts = (user.failed_login_attempts || 0) + 1;
        const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
        await query(
            'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
            [attempts, lockUntil, user.id]
        );
        if (lockUntil) throw new AuthenticationError('Too many failed attempts. Account locked for 15 minutes.');
        throw new AuthenticationError('Invalid Velociraptor credentials');
    }

    // Revoke previous access token JTI on successful login (force single-session)
    if (user.current_access_jti) {
        await revokeJTI(user.current_access_jti, user.id, new Date(Date.now() + 15 * 60 * 1000));
    }

    user.velo_username_decrypted = veloUsername;
    const tokenUser  = buildTokenUser(user, veloRoles, orgId);
    const { token: accessToken, jti: accessJti } = generateAccessToken(tokenUser);
    const { token: refreshToken } = generateRefreshToken(user);

    const refreshHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    const expiresAt   = getTokenExpiry();

    await query(
        `UPDATE users SET
            refresh_token_hash = $1, refresh_token_expires_at = $2,
            failed_login_attempts = 0, locked_until = NULL,
            last_login_at = NOW(), current_access_jti = $3
         WHERE id = $4`,
        [refreshHash, expiresAt, accessJti, user.id]
    );

    logger.info('User logged in', { username, orgId });

    return {
        user:   { id: user.id, username: user.username, email: user.email, roles: user.roles, avatar_url: user.avatar_url || null },
        accessToken,
        refreshToken,
        veloRoles,
        orgId,
    };
}

//  Refresh 

async function refreshAccessToken(refreshToken) {
    if (!refreshToken) throw new AuthenticationError('Refresh token required');

    const { verifyRefreshToken } = require('../config/jwt');
    const decoded = verifyRefreshToken(refreshToken);

    const result = await query(
        `SELECT id, username, email, roles, velo_roles, velo_org_id,
                refresh_token_hash, refresh_token_expires_at, current_access_jti,
                velo_username_encrypted, velo_username_iv, velo_username_auth_tag
         FROM users WHERE id = $1 AND deleted_at IS NULL`,
        [decoded.userId]
    );
    if (result.rows.length === 0) throw new AuthenticationError('Invalid refresh token');

    const user = result.rows[0];

    // refresh_token_hash is cleared on logout — if null, session is invalidated.
    // typeof null === 'object', so we must guard before bcrypt.compare or it throws
    // "Illegal arguments: string, object" which propagates as HTTP 500.
    if (!user.refresh_token_hash) throw new AuthenticationError('Invalid refresh token');

    const isValid = await bcrypt.compare(refreshToken, user.refresh_token_hash);
    if (!isValid) throw new AuthenticationError('Invalid refresh token');
    if (new Date(user.refresh_token_expires_at) < new Date()) throw new AuthenticationError('Refresh token expired');

    // Revoke old access JTI
    if (user.current_access_jti) {
        await revokeJTI(user.current_access_jti, user.id);
    }

    const veloUsername = decryptCredential(
        user.velo_username_encrypted.toString('hex'), user.velo_username_iv, user.velo_username_auth_tag
    );
    user.velo_username_decrypted = veloUsername;
    const tokenUser = buildTokenUser(user, user.velo_roles, user.velo_org_id);

    const { token: newAccessToken, jti: newAccessJti } = generateAccessToken(tokenUser);
    const { token: newRefreshToken }                   = generateRefreshToken(user);

    const newRefreshHash = await bcrypt.hash(newRefreshToken, BCRYPT_ROUNDS);
    const expiresAt      = getTokenExpiry();

    await query(
        `UPDATE users SET refresh_token_hash = $1, refresh_token_expires_at = $2, current_access_jti = $3 WHERE id = $4`,
        [newRefreshHash, expiresAt, newAccessJti, user.id]
    );

    logger.debug('Tokens refreshed', { userId: user.id });
    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

//  Logout â”€

async function logout(userId, accessJti) {
    // Revoke the current access JTI immediately
    if (accessJti) {
        await revokeJTI(accessJti, userId, new Date(Date.now() + 15 * 60 * 1000));
    }
    await query(
        'UPDATE users SET refresh_token_hash = NULL, refresh_token_expires_at = NULL, current_access_jti = NULL WHERE id = $1',
        [userId]
    );
    logger.info('User logged out', { userId });
}

//  Rotate tokens (e.g., after password change) 

async function rotateTokens(userId, oldAccessJti) {
    const result = await query(
        `SELECT id, username, email, roles, velo_roles, velo_org_id,
                velo_username_encrypted, velo_username_iv, velo_username_auth_tag
         FROM users WHERE id = $1 AND deleted_at IS NULL`,
        [userId]
    );
    if (result.rows.length === 0) throw new NotFoundError('User not found');
    const user = result.rows[0];

    if (oldAccessJti) await revokeJTI(oldAccessJti, userId);

    const veloUsername = decryptCredential(
        user.velo_username_encrypted.toString('hex'), user.velo_username_iv, user.velo_username_auth_tag
    );
    user.velo_username_decrypted = veloUsername;
    const tokenUser = buildTokenUser(user, user.velo_roles, user.velo_org_id);

    const { token: accessToken, jti: newJti } = generateAccessToken(tokenUser);
    const { token: refreshToken }             = generateRefreshToken(user);

    const refreshHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    const expiresAt   = getTokenExpiry();

    await query(
        'UPDATE users SET refresh_token_hash = $1, refresh_token_expires_at = $2, current_access_jti = $3 WHERE id = $4',
        [refreshHash, expiresAt, newJti, user.id]
    );

    return { accessToken, refreshToken };
}

//  Get Velo credentials (for proxy) â”€

async function getVeloCredentials(userId) {
    const result = await query(
        `SELECT velo_username_encrypted, velo_username_iv, velo_username_auth_tag,
                velo_password_encrypted, velo_password_iv, velo_password_auth_tag,
                velo_server_url, velo_verify_ssl
         FROM users WHERE id = $1 AND deleted_at IS NULL`,
        [userId]
    );
    if (result.rows.length === 0) throw new NotFoundError('User not found');
    const user = result.rows[0];

    // Fall back to system env credentials when user hasn't configured Velo credentials yet
    if (!user.velo_username_encrypted || !user.velo_password_encrypted) {
        return {
            username:  process.env.VELO_SERVICE_USERNAME || '',
            password:  process.env.VELO_SERVICE_PASSWORD || '',
            serverUrl: user.velo_server_url || process.env.VELO_API_BASE_URL || '',
            verifySsl: user.velo_verify_ssl !== false,
        };
    }

    const username = decryptCredential(
        user.velo_username_encrypted.toString('hex'), user.velo_username_iv, user.velo_username_auth_tag
    );
    const password = decryptCredential(
        user.velo_password_encrypted.toString('hex'), user.velo_password_iv, user.velo_password_auth_tag
    );
    return {
        username,
        password,
        serverUrl: user.velo_server_url || '',
        verifySsl: user.velo_verify_ssl !== false, // default true
    };
}

//  Change Velo password 

async function changeVeloPassword(userId, currentPassword, newPassword) {
    const creds = await getVeloCredentials(userId);
    if (creds.password !== currentPassword) throw new AuthenticationError('Current password is incorrect');

    const skipVeloAuth = process.env.VELO_SKIP_AUTH_CHECK === 'true';
    if (!skipVeloAuth) {
        await testCredentials(creds.username, newPassword, creds.serverUrl, creds.verifySsl);
    }

    const encPw = encryptCredential(newPassword);
    await query(
        `UPDATE users SET
            velo_password_encrypted = $1, velo_password_iv = $2, velo_password_auth_tag = $3,
            updated_at = NOW()
         WHERE id = $4`,
        [Buffer.from(encPw.encrypted, 'hex'), encPw.iv, encPw.authTag, userId]
    );

    logger.info('Velo password changed', { userId });
}

//  Clean up expired revoked tokens (maintenance) 

async function cleanExpiredRevocations() {
    const result = await query('DELETE FROM revoked_tokens WHERE expires_at < NOW()');
    logger.debug('Cleaned expired JTI revocations', { deleted: result.rowCount });
}

// ── Admin: create local user ───────────────────────────────────────────────────

/**
 * Create a matching PostgreSQL record for a user that an admin created in
 * Velociraptor via /api/v1/CreateUser.  The user's first successful login will
 * re-sync and overwrite the stored encrypted credentials automatically.
 *
 * Returns the new user row, or null if the user already exists (idempotent).
 */
async function createLocalUser({ username, password, veloRoles = [], orgId = '', serverUrl = '', verifySsl = true }) {
    if (!username) return null;

    const existing = await query(
        'SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL',
        [username]
    );
    if (existing.rows.length > 0) {
        logger.info('createLocalUser: user already exists in PostgreSQL, skipping', { username });
        return null;
    }

    const encUn = encryptCredential(username);
    const encPw = encryptCredential(password || '');

    const result = await query(
        `INSERT INTO users (
            username, email,
            velo_username_encrypted, velo_username_iv, velo_username_auth_tag,
            velo_password_encrypted, velo_password_iv, velo_password_auth_tag,
            velo_roles, velo_org_id, velo_roles_synced_at,
            velo_server_url, velo_verify_ssl
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12)
        RETURNING id, username`,
        [
            username, '',  // email is empty for admin-created users
            Buffer.from(encUn.encrypted, 'hex'), encUn.iv, encUn.authTag,
            Buffer.from(encPw.encrypted, 'hex'), encPw.iv, encPw.authTag,
            veloRoles, orgId,
            serverUrl || null, verifySsl,
        ]
    );

    logger.info('createLocalUser: local PostgreSQL record created by admin', { username });
    return result.rows[0];
}

module.exports = {
    register,
    login,
    refreshAccessToken,
    logout,
    rotateTokens,
    getVeloCredentials,
    changeVeloPassword,
    cleanExpiredRevocations,
    createLocalUser,
};
