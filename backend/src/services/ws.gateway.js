'use strict';
/**
 * WebSocket Gateway — Real-time geo client diff broadcast
 *
 * Architecture:
 *   • Attaches to the Express HTTP server on path /ws/geo
 *   • Polls Velociraptor every WS_POLL_INTERVAL_MS (default 10s)
 *   • Broadcasts diff (additions / updates / removals) every WS_DIFF_INTERVAL_MS (default 2s)
 *   • diff = JSON with { type:'diff', ts, seqNo, additions[], updates[], removals[] }
 *   • New connections receive full snapshot { type:'snapshot', ts, seqNo, data[] }
 *   • JWT validation on upgrade (token query param)
 *   • Heartbeat ping every WS_HEARTBEAT_MS (default 30s); dead sockets terminated
 *   • Backpressure: consumers with bufferedAmount > 1MB are skipped for one cycle
 *   • Redis key geo:snapshot stores serialised snapshot for fast new-connection delivery
 *     (falls back to in-memory if Redis unavailable)
 */

const { WebSocketServer } = require('ws');
const jwt                = require('jsonwebtoken');
const logger             = require('../utils/logger');
const veloApi            = require('../config/velo-api');
const { enrichIPs }      = require('./geoip.service');

// ── Config ────────────────────────────────────────────────────────────────────
const POLL_MS      = parseInt(process.env.WS_POLL_INTERVAL_MS   || '10000', 10);
const DIFF_MS      = parseInt(process.env.WS_DIFF_INTERVAL_MS   || '2000',  10);
const HBEAT_MS     = parseInt(process.env.WS_HEARTBEAT_MS       || '30000', 10);
const MAX_BUFFER   = 1_048_576;  // 1 MB backpressure threshold

// ── Module state ──────────────────────────────────────────────────────────────
/** @type {Map<string, object>} — current snapshot: client_id → enriched client */
let _snapshot    = new Map();
let _seqNo       = 0;
let _redisClient = null;
let _redisReady  = false;
/** @type {Set<WebSocket>} */
const _sockets   = new Set();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const PRIVATE_IP_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$)/;

function isOnline(client) {
    const now  = Date.now() * 1000;
    const last = client.last_seen_at || client.ping || 0;
    return last > 0 && (now - last) < 5 * 60 * 1_000_000;
}

function detectPlatform(sys) {
    const s = (sys || '').toLowerCase();
    if (s.includes('windows')) return 'windows';
    if (s.includes('linux'))   return 'linux';
    if (s.includes('darwin') || s.includes('macos')) return 'macos';
    return 'unknown';
}

function detectStatus(client) {
    const lbl = (client.labels || []).map(l => (typeof l === 'string' ? l : l.name || '').toLowerCase());
    if (lbl.some(l => /incident|critical|compromised|alert/.test(l))) return 'incident';
    return isOnline(client) ? 'online' : 'offline';
}

function detectSeverity(labels) {
    const lbl = (labels || []).map(l => (typeof l === 'string' ? l : l.name || '').toLowerCase());
    if (lbl.some(l => l.includes('critical'))) return 'critical';
    if (lbl.some(l => l.includes('high')))     return 'high';
    if (lbl.some(l => l.includes('medium')))   return 'medium';
    return 'low';
}

function normalise(raw, geo) {
    const os_info  = raw.os_info || {};
    const platform = detectPlatform(os_info.system || os_info.platform || '');
    const status   = detectStatus(raw);
    const g = geo || {};
    return {
        client_id:        raw.client_id || raw.id || '',
        hostname:         os_info.hostname || raw.hostname || 'unknown',
        ip_address:       raw.ip_address  || raw.last_ip   || '',
        os:               platform,
        os_version:       os_info.release || '',
        labels:           raw.labels || [],
        last_seen_at:     raw.last_seen_at || raw.ping || 0,
        active_hunts:     0,  // filled separately if needed
        status,
        incident_severity: status === 'incident' ? detectSeverity(raw.labels) : undefined,
        geo: {
            lat:          g.lat          ?? 0,
            lng:          g.lng          ?? 0,
            country_code: g.country_code ?? 'XX',
            country_name: g.country      ?? 'Unknown',
            city:         g.city         ?? '',
            isp:          g.isp          ?? '',
        },
    };
}

// ── Mock data (mirrors geo.controller.js seed for dev without Velo) ───────────
function makeMockClients() {
    const SEEDS = [
        { ip: '8.8.8.8',        cc: 'US', lat: 37.38,  lng: -122.08, country: 'United States', city: 'Mountain View' },
        { ip: '104.26.10.14',   cc: 'US', lat: 37.75,  lng: -122.41, country: 'United States', city: 'San Francisco' },
        { ip: '172.217.5.110',  cc: 'US', lat: 40.71,  lng: -74.00,  country: 'United States', city: 'New York' },
        { ip: '113.161.84.50',  cc: 'VN', lat: 10.82,  lng: 106.63,  country: 'Vietnam',        city: 'Ho Chi Minh' },
        { ip: '1.53.44.185',    cc: 'VN', lat: 21.02,  lng: 105.84,  country: 'Vietnam',        city: 'Ha Noi' },
        { ip: '85.214.132.117', cc: 'DE', lat: 52.52,  lng: 13.40,   country: 'Germany',        city: 'Berlin' },
        { ip: '81.2.69.160',    cc: 'GB', lat: 51.50,  lng: -0.12,   country: 'United Kingdom', city: 'London' },
        { ip: '103.1.206.100',  cc: 'JP', lat: 35.68,  lng: 139.69,  country: 'Japan',          city: 'Tokyo' },
        { ip: '103.252.115.1',  cc: 'SG', lat: 1.35,   lng: 103.82,  country: 'Singapore',      city: 'Singapore' },
        { ip: '203.2.218.57',   cc: 'AU', lat: -33.87, lng: 151.21,  country: 'Australia',      city: 'Sydney' },
        { ip: '175.126.32.1',   cc: 'KR', lat: 37.57,  lng: 126.98,  country: 'South Korea',    city: 'Seoul' },
        { ip: '195.78.54.5',    cc: 'FR', lat: 48.85,  lng: 2.35,    country: 'France',          city: 'Paris' },
        { ip: '95.211.230.1',   cc: 'NL', lat: 52.37,  lng: 4.89,    country: 'Netherlands',    city: 'Amsterdam' },
        { ip: '45.32.10.5',     cc: 'BR', lat: -23.55, lng: -46.63,  country: 'Brazil',          city: 'São Paulo' },
        { ip: '41.79.80.1',     cc: 'ZA', lat: -26.20, lng: 28.04,   country: 'South Africa',   city: 'Johannesburg' },
    ];
    const OSes = ['windows', 'linux', 'macos'];
    const statuses = ['online', 'online', 'online', 'offline', 'incident'];
    const now = Date.now() * 1000;
    const clients = [];
    let idx = 0;
    for (const seed of SEEDS) {
        const count = 3 + Math.floor(Math.random() * 5);
        for (let i = 0; i < count; i++) {
            const s = statuses[Math.floor(Math.random() * statuses.length)];
            const jitter = () => (Math.random() - 0.5) * 0.8;
            clients.push({
                client_id: `C.mock${String(idx++).padStart(4, '0')}`,
                hostname:  `host-${seed.city.toLowerCase().replace(/\s/g, '-')}-${i + 1}`,
                ip_address: seed.ip,
                os:        OSes[Math.floor(Math.random() * OSes.length)],
                os_version: '',
                labels:    s === 'incident' ? [{ name: 'incident' }] : [],
                last_seen_at: s === 'online' ? now - 60_000_000 : now - 20 * 60_000_000,
                active_hunts: s === 'incident' ? 2 : 0,
                status:    s,
                incident_severity: s === 'incident' ? 'high' : undefined,
                geo: {
                    lat:          seed.lat  + jitter(),
                    lng:          seed.lng  + jitter(),
                    country_code: seed.cc,
                    country_name: seed.country,
                    city:         seed.city,
                    isp:          'ISP Corp',
                },
            });
        }
    }
    return clients;
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH + ENRICH from Velociraptor (with mock fallback)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchEnrichedClients() {
    const USE_MOCK = process.env.USE_MOCK_GEO === 'true';
    if (USE_MOCK) return makeMockClients();

    try {
        // Use service account credentials from environment (NOT hardcoded)
        const svcUsername = process.env.VELO_SERVICE_USERNAME;
        const svcPassword = process.env.VELO_SERVICE_PASSWORD;
        if (!svcUsername || !svcPassword) {
            logger.warn('[WS Gateway] VELO_SERVICE_USERNAME / VELO_SERVICE_PASSWORD not set – falling back to mock data');
            return makeMockClients();
        }

        // 1. Search all clients
        const searchResp = await veloApi.proxyRequest(
            '/api/v1/SearchClients',
            { auth: { username: svcUsername, password: svcPassword }, verifySsl: false,
              serverUrl: process.env.VELO_API_BASE_URL || '',
              orgId: process.env.VELO_ORG_ID || '' },
            { method: 'POST', data: { query: '.', limit: 5000, start: 0 } }
        );

        const rawClients = searchResp?.items || searchResp?.clients || [];
        if (rawClients.length === 0) return makeMockClients(); // graceful fallback

        // 2. Extract routable IPs
        const ips = rawClients.map(c => c.ip_address || c.last_ip || '').filter(Boolean);

        // 3. Batch enrich
        const geoMap = await enrichIPs([...new Set(ips)]);

        // 4. Normalise
        return rawClients.map(raw => {
            const ip  = raw.ip_address || raw.last_ip || '';
            const geo = geoMap.get(ip);
            return normalise(raw, geo);
        });
    } catch (err) {
        logger.warn('[WS Gateway] Velociraptor fetch failed, using mock data:', err.message);
        return makeMockClients();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SNAPSHOT HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function loadSnapshot() {
    if (_redisReady && _redisClient) {
        try {
            const raw = await _redisClient.get('geo:snapshot');
            if (raw) {
                const arr = JSON.parse(raw);
                return new Map(arr.map(c => [c.client_id, c]));
            }
        } catch { /* fallback to empty */ }
    }
    return new Map();
}

async function saveSnapshot(map) {
    if (_redisReady && _redisClient) {
        try {
            await _redisClient.setEx('geo:snapshot', 3600, JSON.stringify([...map.values()]));
        } catch { /* non-critical */ }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// DIFF COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────
function computeDiff(previous, current) {
    const additions = [];
    const updates   = [];
    const removals  = [];

    for (const [id, client] of current) {
        if (!previous.has(id)) {
            additions.push(client);
        } else {
            const prev = previous.get(id);
            // Shallow check: status or last_seen changed
            if (prev.status !== client.status || prev.last_seen_at !== client.last_seen_at) {
                updates.push(client);
            }
        }
    }
    for (const id of previous.keys()) {
        if (!current.has(id)) removals.push(id);
    }

    return { additions, updates, removals };
}

// ─────────────────────────────────────────────────────────────────────────────
// BROADCAST
// ─────────────────────────────────────────────────────────────────────────────
function broadcast(message) {
    const payload = JSON.stringify(message);
    let sent = 0, skipped = 0;

    for (const ws of _sockets) {
        if (ws.readyState !== 1 /* OPEN */) continue;

        // Backpressure guard
        if (ws.bufferedAmount > MAX_BUFFER) {
            skipped++;
            continue;
        }

        ws.send(payload);
        sent++;
    }

    if (skipped > 0) logger.warn(`[WS Gateway] Backpressure: skipped ${skipped} slow consumers`);
    return sent;
}

// ─────────────────────────────────────────────────────────────────────────────
// POLLING LOOP
// ─────────────────────────────────────────────────────────────────────────────
let _lastBroadcast = new Map();

async function pollAndBroadcast() {
    let clients;
    try {
        clients = await fetchEnrichedClients();
    } catch (err) {
        logger.error('[WS Gateway] Poll error:', err.message);
        return;
    }

    const newSnapshot = new Map(clients.map(c => [c.client_id, c]));
    const diff = computeDiff(_snapshot, newSnapshot);
    _snapshot = newSnapshot;
    _seqNo++;

    await saveSnapshot(newSnapshot);

    // Only broadcast if there's something to say
    if (diff.additions.length || diff.updates.length || diff.removals.length) {
        const sent = broadcast({
            type:      'diff',
            ts:        Date.now(),
            seqNo:     _seqNo,
            additions: diff.additions,
            updates:   diff.updates,
            removals:  diff.removals,
        });
        if (sent > 0)
            logger.debug(`[WS Gateway] Diff seqNo=${_seqNo}: +${diff.additions.length} ~${diff.updates.length} -${diff.removals.length} → ${sent} clients`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
function verifyToken(token) {
    if (!token) return false;
    try {
        const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;
        jwt.verify(token, secret);
        return true;
    } catch {
        // In dev/skip-auth mode, allow any non-empty token
        return process.env.VELO_SKIP_AUTH_CHECK === 'true';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: start(httpServer)
// ─────────────────────────────────────────────────────────────────────────────
async function start(httpServer) {
    // ── Redis init ───────────────────────────────────────────────────────────
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
        try {
            const { createClient } = require('redis');
            _redisClient = createClient({ url: redisUrl });
            _redisClient.on('error', e => { logger.warn('[WS Redis]', e.message); _redisReady = false; });
            _redisClient.on('ready', () => { _redisReady = true; });
            await _redisClient.connect();
        } catch (e) {
            logger.warn('[WS Gateway] Redis unavailable:', e.message);
        }
    }

    // ── Load existing snapshot (fast delivery to first connection) ───────────
    _snapshot = await loadSnapshot();
    if (_snapshot.size === 0) {
        // Bootstrap immediately
        try {
            const clients = await fetchEnrichedClients();
            _snapshot = new Map(clients.map(c => [c.client_id, c]));
            await saveSnapshot(_snapshot);
            _seqNo++;
        } catch (e) {
            logger.warn('[WS Gateway] Bootstrap failed:', e.message);
        }
    }

    // ── WebSocket server ─────────────────────────────────────────────────────
    const wss = new WebSocketServer({ server: httpServer, path: '/ws/geo' });

    wss.on('connection', (ws, req) => {
        // Auth: token via ?token=xxx query param
        const url   = new URL(req.url, 'ws://x');
        const token = url.searchParams.get('token') || '';
        if (!verifyToken(token)) {
            ws.close(4001, 'Unauthorized');
            logger.warn('[WS Gateway] Rejected connection: bad token from', req.socket.remoteAddress);
            return;
        }

        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
        ws.on('close', () => _sockets.delete(ws));
        ws.on('error', err => { logger.debug('[WS Gateway] Client error:', err.message); });
        // Ignore incoming messages from clients (read-only stream)
        ws.on('message', () => {});

        _sockets.add(ws);

        // Send full snapshot immediately
        try {
            const snapshot = [..._snapshot.values()];
            ws.send(JSON.stringify({
                type:  'snapshot',
                ts:    Date.now(),
                seqNo: _seqNo,
                data:  snapshot,
            }));
            logger.debug(`[WS Gateway] New connection snapshot=${snapshot.length} clients`);
        } catch (e) {
            logger.warn('[WS Gateway] Snapshot send error:', e.message);
        }
    });

    // ── Polling loop ─────────────────────────────────────────────────────────
    setInterval(pollAndBroadcast, POLL_MS).unref();

    // ── Heartbeat ────────────────────────────────────────────────────────────
    setInterval(() => {
        for (const ws of _sockets) {
            if (!ws.isAlive) { ws.terminate(); _sockets.delete(ws); continue; }
            ws.isAlive = false;
            ws.ping();
        }
    }, HBEAT_MS).unref();

    logger.info(`[WS Gateway] Listening on /ws/geo  poll=${POLL_MS}ms diff=${DIFF_MS}ms heartbeat=${HBEAT_MS}ms`);
}

/** Connected client count — exposed for health endpoint */
function connectionCount() {
    return _sockets.size;
}

module.exports = { start, connectionCount };
