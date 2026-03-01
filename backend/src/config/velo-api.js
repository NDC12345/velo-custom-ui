/**
 * Velociraptor API Client — gRPC-gateway HTTP proxy (multi-tenant edition)
 *
 * Each request can target a different Velo server URL.
 * A pool of axios instances is maintained, keyed by "baseUrl:verifySsl", so
 * per-URL keep-alive connection pools are reused across requests.
 *
 * Key requirements:
 *   1. Basic Auth on every request
 *   2. CSRF token (from /app/index.html) + _gorilla_csrf cookie on POST/PUT/DELETE/PATCH
 *   3. Org routing via Grpc-Metadata-OrgId header
 *   4. Go html/template encodes CSRF token with \u002b etc — must JSON-parse it
 *   5. CSRF token rotates — update from x-csrf-token response header after each POST
 */
'use strict';

const axios = require('axios');
const https = require('https');
const http = require('http');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

const timingsLog = path.join(__dirname, '..', '..', 'logs', 'proxy-timings.log');
try { fs.mkdirSync(path.dirname(timingsLog), { recursive: true }); } catch (e) { /* ignore */ }

const VELO_API_TIMEOUT = parseInt(process.env.VELO_API_TIMEOUT) || 30000;

// Default/fallback Velo server URL from environment (used when user has no per-user URL set).
const DEFAULT_VELO_URL = (process.env.VELO_API_BASE_URL || '').replace(/\/$/, '');
const DEFAULT_VERIFY_SSL = process.env.VELO_API_VERIFY_SSL !== 'false'; // default: true

if (!DEFAULT_VELO_URL) {
    logger.warn(
        'VELO_API_BASE_URL is not set. Users must configure their own Velo server URL ' +
        'in Settings, or set VELO_API_BASE_URL as the system-wide default.'
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PER-URL AXIOS CLIENT POOL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pool of axios instances + their HTTP agents, keyed by "normalizedUrl:ssl".
 * Each entry: { client, httpAgt, httpsAgt, baseUrl }
 */
const clientPool = new Map();

/**
 * Get (or lazily create) an axios instance for the given server URL.
 * @param {string}  serverUrl - Base URL of the Velo server
 * @param {boolean} verifySsl - Whether to validate the TLS certificate
 */
function getClientForUrl(serverUrl, verifySsl = true) {
    const normalizedUrl = (serverUrl || '').replace(/\/$/, '');
    if (!normalizedUrl) {
        throw new Error(
            'No Velociraptor server URL configured. ' +
            'Set VELO_API_BASE_URL or configure a per-user server URL in Settings.'
        );
    }
    const poolKey = `${normalizedUrl}:${verifySsl ? '1' : '0'}`;

    if (!clientPool.has(poolKey)) {
        const httpsAgt = new https.Agent({
            keepAlive: true,
            rejectUnauthorized: verifySsl,
            maxSockets: 50,
        });
        const httpAgt = new http.Agent({ keepAlive: true, maxSockets: 50 });

        const client = axios.create({
            baseURL: normalizedUrl,
            timeout: VELO_API_TIMEOUT,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json,text/html',
                'ngrok-skip-browser-warning': 'true',
                'Connection': 'keep-alive',
            },
            httpAgent: httpAgt,
            httpsAgent: httpsAgt,
        });

        clientPool.set(poolKey, { client, httpAgt, httpsAgt, baseUrl: normalizedUrl });
        logger.debug('Created new Velo API client', { poolKey });
    }

    return clientPool.get(poolKey);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CSRF SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Session store — keyed by "serverUrl:username:password:orgId".
 * Each session holds:
 *   csrf   - X-CSRF-Token value (decoded from Go template \uXXXX encoding)
 *   cookie - _gorilla_csrf=... + any other cookies
 *   ts     - timestamp when session was obtained
 */
const sessionStore = new Map();
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes (conservative; Velo uses 7 days)

/**
 * Per-key mutex to prevent concurrent CSRF session fetches for the same
 * user/server combo, which causes race conditions.
 */
const sessionLocks = new Map();

async function withSessionLock(key, fn) {
    // Wait for any in-flight fetch for the same key to complete
    while (sessionLocks.has(key)) {
        await sessionLocks.get(key);
    }
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    sessionLocks.set(key, promise);
    try {
        return await fn();
    } finally {
        sessionLocks.delete(key);
        resolve();
    }
}

function sessionKey(auth, orgId = '', serverUrl = '') {
    const base = (serverUrl || DEFAULT_VELO_URL).replace(/\/$/, '');
    return `${base}:${auth.username}:${auth.password}:${orgId}`;
}

/**
 * Obtain a valid CSRF session by fetching /app/index.html.
 *
 * Velociraptor embeds the CSRF token in the HTML:
 *   window.CsrfToken = "...";
 *
 * Go html/template encodes special chars:
 *   + → \\u002b, / → \\/, < → \\u003c, etc.
 *
 * We also capture the _gorilla_csrf cookie from Set-Cookie.
 */
/**
 * Obtain a valid CSRF session by fetching /app/index.html.
 * @param {object}  auth      - { username, password }
 * @param {string}  orgId     - Velo org ID
 * @param {string}  serverUrl - Per-user Velo server base URL
 * @param {boolean} verifySsl - TLS verification flag
 */
async function obtainSession(auth, orgId = '', serverUrl = '', verifySsl = true) {
    const resolvedUrl = (serverUrl || DEFAULT_VELO_URL).replace(/\/$/, '');
    const key = sessionKey(auth, orgId, resolvedUrl);
    const now = Date.now();
    const existing = sessionStore.get(key);
    if (existing && (now - existing.ts) < SESSION_TTL_MS && existing.csrf) {
        return existing;
    }

    // Mutex: ensure only one concurrent CSRF fetch per session key
    return withSessionLock(key, async () => {
        // Double-check after acquiring lock (another request may have populated it)
        const existingAfterLock = sessionStore.get(key);
        if (existingAfterLock && (Date.now() - existingAfterLock.ts) < SESSION_TTL_MS && existingAfterLock.csrf) {
            return existingAfterLock;
        }

        const { client } = getClientForUrl(resolvedUrl, verifySsl);

    try {
        const headers = {
            'Accept': 'text/html',
            'ngrok-skip-browser-warning': 'true',
        };
        if (orgId) headers['Grpc-Metadata-OrgId'] = orgId;

        const resp = await client.get('/app/index.html', {
            auth,
            headers,
            withCredentials: true,
            validateStatus: () => true,
            // We need the raw HTML, not parsed JSON
            transformResponse: [(data) => data],
        });

        if (resp.status !== 200) {
            logger.warn('obtainSession: /app/index.html returned', { status: resp.status, serverUrl: resolvedUrl });
            const fallback = { csrf: null, cookie: '', ts: Date.now() };
            sessionStore.set(key, fallback);
            return fallback;
        }

        // Extract CSRF token from: window.CsrfToken = "...";
        const htmlBody = typeof resp.data === 'string' ? resp.data : '';
        const csrfMatch = htmlBody.match(/window\.CsrfToken\s*=\s*"([^"]+)"/);
        let csrf = null;
        if (csrfMatch) {
            try {
                // JSON.parse handles all JS string escape sequences (\\u002b → +, \\/ → /)
                csrf = JSON.parse('"' + csrfMatch[1] + '"');
            } catch {
                csrf = csrfMatch[1]
                    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
                    .replace(/\\(.)/g, '$1');
            }
        }

        // Extract cookies from Set-Cookie header
        const setCookies = resp.headers['set-cookie'] || [];
        const cookieArr = Array.isArray(setCookies) ? setCookies : [setCookies];
        const cookieJar = {};
        cookieArr.forEach(c => {
            if (!c) return;
            const kv = c.split(';')[0].trim();
            const idx = kv.indexOf('=');
            if (idx > 0) {
                cookieJar[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim();
            }
        });
        const cookieHeader = Object.entries(cookieJar)
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');

        const session = { csrf, cookie: cookieHeader, ts: Date.now() };
        sessionStore.set(key, session);

        logger.debug('CSRF session obtained', {
            username: auth.username,
            orgId,
            serverUrl: resolvedUrl,
            hasCsrf: !!csrf,
            hasCookie: !!cookieHeader,
            csrfLen: csrf?.length,
        });

        return session;
    } catch (err) {
        logger.warn('obtainSession failed:', err.message);
        const fallback = { csrf: null, cookie: '', ts: Date.now() };
        sessionStore.set(key, fallback);
        return fallback;
    }
    }); // end withSessionLock
}

/**
 * Update session CSRF token from response header (token rotation).
 */
function updateSessionCsrf(auth, orgId, responseHeaders, serverUrl = '') {
    if (!responseHeaders) return;
    const newCsrf = responseHeaders['x-csrf-token'];
    if (!newCsrf) return;

    const resolvedUrl = (serverUrl || DEFAULT_VELO_URL).replace(/\/$/, '');
    const key = sessionKey(auth, orgId, resolvedUrl);
    const existing = sessionStore.get(key);
    if (existing) {
        existing.csrf = newCsrf;
        existing.ts = Date.now(); // refresh TTL
        sessionStore.set(key, existing);
    }

    // Also update cookies if rotated
    const setCookies = responseHeaders['set-cookie'];
    if (setCookies && existing) {
        const cookieArr = Array.isArray(setCookies) ? setCookies : [setCookies];
        const jar = {};
        existing.cookie.split(';').forEach(c => {
            const [k, ...v] = c.trim().split('=');
            if (k) jar[k.trim()] = v.join('=');
        });
        cookieArr.forEach(c => {
            if (!c) return;
            const kv = c.split(';')[0].trim();
            const idx = kv.indexOf('=');
            if (idx > 0) jar[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim();
        });
        existing.cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    }
}

/**
 * Invalidate session (force re-fetch on next request).
 */
function invalidateSession(auth, orgId = '', serverUrl = '') {
    const resolvedUrl = (serverUrl || DEFAULT_VELO_URL).replace(/\/$/, '');
    sessionStore.delete(sessionKey(auth, orgId, resolvedUrl));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  RBAC / USER ROLE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchUserRoles(auth, targetUsername, serverUrl = '', verifySsl = true) {
    const resolvedUrl = (serverUrl || DEFAULT_VELO_URL).replace(/\/$/, '');
    const { client } = getClientForUrl(resolvedUrl, verifySsl);
    try {
        const response = await client.get('/api/v1/GetUserUITraits', {
            auth,
            headers: { 'ngrok-skip-browser-warning': 'true' },
            validateStatus: () => true,
        });

        if (response.status !== 200) {
            logger.warn('fetchUserRoles non-200', { status: response.status, targetUsername });
            return { roles: [], orgId: '' };
        }

        const data = response.data || {};
        const userType = data.user_type || '';
        const permissions = data.interface_traits?.Permissions || {};
        const orgs = Array.isArray(data.orgs) ? data.orgs : [];
        const orgId = orgs.length > 0 ? (orgs[0].id || '') : '';

        const roles = [];
        if (userType === 'USER_TYPE_ADMIN' || permissions.server_admin) roles.push('administrator');
        if (permissions.org_admin) roles.push('org_admin');
        if (permissions.any_query && !roles.includes('administrator')) roles.push('analyst');
        if (permissions.read_results && roles.length === 0) roles.push('reader');
        if (roles.length === 0 && userType === 'USER_TYPE_ADMIN') roles.push('administrator');

        logger.debug('fetchUserRoles resolved', { targetUsername, roles, orgId, userType });
        return { roles, orgId };
    } catch (err) {
        logger.warn('fetchUserRoles failed:', err.message);
        return { roles: [], orgId: '' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CREDENTIALS TEST
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Candidate endpoints to test credentials against, in order of preference.
 * Different Velociraptor versions may expose different endpoints.
 */
const CREDENTIAL_TEST_ENDPOINTS = [
    '/api/v1/GetUserUITraits',
    '/api/v1/GetUserName',
    '/api/v1/GetArtifacts',
];

async function testCredentials(username, password, serverUrl = '', verifySsl = true) {
    const resolvedUrl = (serverUrl || DEFAULT_VELO_URL).replace(/\/$/, '');
    const { client } = getClientForUrl(resolvedUrl, verifySsl);

    let lastError = null;

    for (const endpoint of CREDENTIAL_TEST_ENDPOINTS) {
        try {
            const response = await client.get(endpoint, {
                auth: { username, password },
                headers: { 'ngrok-skip-browser-warning': 'true' },
                // Short timeout for credential test — don't hold up login flow
                timeout: 10000,
                params: endpoint === '/api/v1/GetArtifacts' ? { count: 1 } : undefined,
            });
            logger.info('Velo credentials verified successfully', { username, serverUrl: resolvedUrl, endpoint });
            return response.data;
        } catch (error) {
            const status = error.response?.status;

            if (status === 401 || status === 403) {
                // Definitive authentication failure
                logger.warn('Invalid Velo credentials', { username, endpoint, status });
                throw new Error('Invalid Velociraptor credentials');
            }

            if (status === 404 || status === 405) {
                // Endpoint not available on this Velo version — try next
                logger.debug('Credential test endpoint not available, trying next', { endpoint, status });
                lastError = error;
                continue;
            }

            // Any other error (network, 5xx, etc.) → fail immediately
            logger.error('Velo API connection error:', {
                message: error.message,
                status,
                serverUrl: resolvedUrl,
                endpoint,
            });
            throw new Error('Failed to connect to Velociraptor API');
        }
    }

    // All endpoints returned 404/405 — the server is reachable but API paths differ.
    // Fall back: try fetching /app/index.html with Basic Auth to at least verify connectivity.
    try {
        await client.get('/app/index.html', {
            auth: { username, password },
            headers: { 'ngrok-skip-browser-warning': 'true' },
            timeout: 10000,
        });
        logger.info('Velo connectivity verified via index fallback', { username, serverUrl: resolvedUrl });
        return {}; // minimal success
    } catch (error) {
        const status = error.response?.status;
        if (status === 401 || status === 403) {
            throw new Error('Invalid Velociraptor credentials');
        }
        logger.error('Velo API fallback connectivity check failed:', {
            message: error.message,
            status,
            serverUrl: resolvedUrl,
        });
        throw new Error('Failed to connect to Velociraptor API');
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CORE PROXY REQUEST — with CSRF, rotation, org routing
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Proxy request to Velociraptor gRPC-gateway REST API.
 *
 * Handles:
 *   - Basic Auth injection
 *   - CSRF token acquisition & rotation (for POST/PUT/DELETE/PATCH)
 *   - Org routing via Grpc-Metadata-OrgId header
 *   - Referer header requirement
 *   - Response timing/logging
 *   - Automatic CSRF retry on 403
 */
async function proxyRequest(endpoint, options = {}) {
    const {
        method = 'GET',
        auth,
        params = {},
        data = null,
        orgId = '',
        serverUrl = '',
        verifySsl = true,
        _retried = false,
    } = options;

    if (!auth || !auth.username || !auth.password) {
        throw new Error('Authentication credentials required for proxy request');
    }

    const resolvedUrl = (serverUrl || DEFAULT_VELO_URL).replace(/\/$/, '');
    const { client } = getClientForUrl(resolvedUrl, verifySsl);

    const overallStart = Date.now();
    let sessionTime = 0;

    try {
        const config = {
            method,
            url: endpoint,
            auth,
            headers: {
                'Referer': resolvedUrl + '/',
                'ngrok-skip-browser-warning': 'true',
            },
            validateStatus: () => true, // handle all status codes ourselves
        };

        // GET: query params; POST/etc: request body
        if (method.toUpperCase() === 'GET') {
            config.params = params;
        } else {
            config.data = data !== null ? data : (Object.keys(params).length > 0 ? params : undefined);
        }

        // Org routing
        if (orgId) {
            config.headers['Grpc-Metadata-OrgId'] = orgId;
        }

        // Always attach cached session cookie + CSRF for state-changing requests.
        // Velociraptor requires the session cookie (_gorilla_csrf) for ALL requests
        // once a session has been established (not just POSTs).
        const isUnsafe = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());
        {
            const s0 = Date.now();
            const sess = await obtainSession(auth, orgId, resolvedUrl, verifySsl);
            sessionTime = Date.now() - s0;
            if (sess.cookie) config.headers['Cookie'] = sess.cookie;
            if (isUnsafe && sess.csrf) config.headers['X-CSRF-Token'] = sess.csrf;
        }

        logger.debug('Proxying to Velo', { endpoint, method, username: auth.username, serverUrl: resolvedUrl });

        const reqStart = Date.now();
        const response = await client.request(config);
        const reqEnd = Date.now();

        // Detect "Token has been revoked" — Velociraptor session invalidated.
        // This can appear as HTTP 200 with error body OR as 401/403.
        if (!_retried) {
            const bodyStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data || '');
            const isRevoked = bodyStr.includes('Token has been revoked') || bodyStr.includes('token has been revoked');
            const isCsrfReject = response.status === 403 && (bodyStr.includes('CSRF') || bodyStr.includes('csrf') || bodyStr.includes('Forbidden'));
            if (isRevoked || isCsrfReject) {
                logger.warn('Session rejected, invalidating and retrying', { endpoint, isRevoked, isCsrfReject });
                invalidateSession(auth, orgId, resolvedUrl);
                return proxyRequest(endpoint, { ...options, _retried: true });
            }
        }

        // Rotate CSRF token/cookie from any response (Velo rotates on every request)
        updateSessionCsrf(auth, orgId, response.headers, resolvedUrl);

        // Log timings
        const timings = {
            ts: new Date().toISOString(),
            endpoint, method,
            username: auth.username,
            serverUrl: resolvedUrl,
            overallMs: Date.now() - overallStart,
            sessionMs: sessionTime,
            requestMs: reqEnd - reqStart,
            status: response.status,
        };
        logger.info('Velo proxy timings', timings);
        try { fs.appendFileSync(timingsLog, JSON.stringify(timings) + '\n'); } catch (e) { /* ignore */ }

        // Throw structured error on non-2xx
        if (response.status >= 400) {
            const err = new Error(response.data?.message || `Velo API returned ${response.status}`);
            err.status = response.status;
            err.data = response.data;
            throw err;
        }

        return response.data;
    } catch (error) {
        // Already structured error (from above or retry)
        if (error.status >= 400) {
            try { fs.appendFileSync(timingsLog, JSON.stringify({ ts: new Date().toISOString(), endpoint, method, status: error.status, message: error.message }) + '\n'); } catch (e) { /* ignore */ }
            throw error;
        }

        // Axios network error
        if (error.response) {
            throw { status: error.response.status, message: error.response.data?.message || error.message, data: error.response.data };
        }

        // Network / timeout error
        logger.error('Velo API network error:', { endpoint, method, message: error.message, serverUrl: resolvedUrl });
        throw { status: 502, message: 'Failed to connect to Velociraptor API: ' + error.message };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONVENIENCE WRAPPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function searchClients(auth, query = {}, serverUrl = '', verifySsl = true) {
    return proxyRequest('/api/v1/SearchClients', { method: 'GET', auth, params: query, serverUrl, verifySsl });
}

async function getClient(auth, clientId, serverUrl = '', verifySsl = true) {
    return proxyRequest(`/api/v1/GetClient/${clientId}`, { method: 'GET', auth, serverUrl, verifySsl });
}

async function getHuntTable(auth, query = {}, serverUrl = '', verifySsl = true) {
    return proxyRequest('/api/v1/GetHuntTable', { method: 'GET', auth, params: query, serverUrl, verifySsl });
}

async function createHunt(auth, huntData, serverUrl = '', verifySsl = true) {
    return proxyRequest('/api/v1/CreateHunt', { method: 'POST', auth, data: huntData, serverUrl, verifySsl });
}

async function collectArtifact(auth, collectionData, serverUrl = '', verifySsl = true) {
    return proxyRequest('/api/v1/CollectArtifact', { method: 'POST', auth, data: collectionData, serverUrl, verifySsl });
}

/**
 * Destroy all pooled HTTP agents (for graceful shutdown / test teardown).
 */
function teardown() {
    for (const { httpAgt, httpsAgt } of clientPool.values()) {
        try { httpAgt.destroy(); } catch (e) { /* ignore */ }
        try { httpsAgt.destroy(); } catch (e) { /* ignore */ }
    }
    clientPool.clear();
    sessionStore.clear();
    logger.debug('Velo API client pool torn down.');
}

module.exports = {
    // Core
    testCredentials,
    obtainSession,
    invalidateSession,
    fetchUserRoles,
    proxyRequest,
    // Convenience
    searchClients,
    getClient,
    getHuntTable,
    createHunt,
    collectArtifact,
    // Lifecycle
    teardown,
    // Exposed for introspection / tests
    getClientForUrl,
    DEFAULT_VELO_URL,
};
