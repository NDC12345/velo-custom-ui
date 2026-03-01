'use strict';
/**
 * Geo Controller — Velociraptor clients enriched with GeoIP data
 *
 * Flow:
 *   1. Fetch all clients from Velociraptor SearchClients endpoint
 *   2. Extract IP addresses from client records
 *   3. Batch-enrich IPs using geo.service.js (ip-api.com + in-memory cache)
 *   4. Aggregate per-country density map
 *   5. Return normalised payload for the ClientOverviewMap component
 */

const veloApi          = require('../config/velo-api');
const { enrichIPs, cacheStats } = require('../services/geo.service');
const { asyncHandler } = require('../middleware/errorHandler');
const logger           = require('../utils/logger');

// ── Helpers ───────────────────────────────────────────────────────────────────
function vproxy(req, endpoint, opts = {}) {
    return veloApi.proxyRequest(endpoint, {
        orgId:     req.veloOrgId     || '',
        serverUrl: req.veloServerUrl || '',
        verifySsl: req.veloVerifySsl !== false,
        ...opts,
        auth: req.veloAuth,
    });
}

/** Determine online status from Velo timestamps (microseconds epoch) */
function isOnline(client) {
    // last_seen_at is in microseconds; ping is nanoseconds
    const now = Date.now() * 1000; // convert to microseconds
    const last = client.last_seen_at || client.ping || 0;
    const FIVE_MIN_US = 5 * 60 * 1_000_000;
    return last > 0 && (now - last) < FIVE_MIN_US;
}

/** Normalise raw Velociraptor client record */
function normaliseClient(raw) {
    const os_info  = raw.os_info || {};
    const platform = detectPlatform(os_info.system || os_info.platform || '');
    return {
        client_id:    raw.client_id || raw.id || '',
        hostname:     os_info.hostname  || raw.hostname  || 'unknown',
        ip_address:   raw.ip_address   || raw.last_ip    || '',
        os:           platform,
        os_release:   os_info.release   || '',
        labels:       raw.labels        || [],
        last_seen_at: raw.last_seen_at  || raw.ping || 0,
        online:       isOnline(raw),
        incident:     (raw.labels || []).some(l =>
            /incident|critical|compromised|alert/i.test(typeof l === 'string' ? l : l.name || '')
        ),
    };
}

function detectPlatform(sys) {
    const s = (sys || '').toLowerCase();
    if (s.includes('windows'))        return 'windows';
    if (s.includes('linux'))          return 'linux';
    if (s.includes('darwin') || s.includes('macos')) return 'macos';
    if (s.includes('android'))        return 'android';
    return 'unknown';
}

// ── Controller ────────────────────────────────────────────────────────────────

/**
 * GET /api/geo/clients
 *
 * Response:
 * {
 *   clients: [{ client_id, hostname, ip_address, os, online, incident, labels,
 *               last_seen_at, geo: { country, country_code, lat, lng, city, isp } }],
 *   country_summary: [{ country_code, country, count, online_count, lat, lng }],
 *   stats: { total, online, offline, incident, countries },
 *   cache: { size, maxSize, ttlHours }
 * }
 */
exports.getClientGeoData = asyncHandler(async (req, res) => {
    // ── 1. Fetch clients from Velociraptor ────────────────────────────────────
    let rawClients = [];
    try {
        const resp = await vproxy(req, '/api/v1/SearchClients', {
            method: 'GET',
            params: { query: 'all', count: 2000, offset: 0 },
        });
        rawClients = (resp.items || resp || []).map(normaliseClient);
    } catch (err) {
        logger.warn('[GeoController] SearchClients failed, returning empty list:', err.message);
    }

    // ── 2. Extract unique routable IPs ────────────────────────────────────────
    const ipToClients = new Map();
    for (const c of rawClients) {
        const ip = (c.ip_address || '').trim().split(':')[0];
        if (!ip) continue;
        if (!ipToClients.has(ip)) ipToClients.set(ip, []);
        ipToClients.get(ip).push(c);
    }
    const uniqueIPs = [...ipToClients.keys()];

    // ── 3. GeoIP enrichment via ip-api.com ────────────────────────────────────
    const geoMap = await enrichIPs(uniqueIPs);

    // ── 4. Build enriched client list ─────────────────────────────────────────
    const enrichedClients = rawClients.map(c => {
        const ip  = (c.ip_address || '').split(':')[0];
        const geo = geoMap.get(ip) || {
            country: 'Unknown', country_code: 'XX', lat: 0, lng: 0, city: '', isp: '',
        };
        return {
            ...c,
            geo: {
                country:      geo.country,
                country_code: geo.country_code,
                lat:          geo.lat,
                lng:          geo.lng,
                city:         geo.city,
                isp:          geo.isp,
            },
        };
    });

    // ── 5. Country summary ────────────────────────────────────────────────────
    const countryMap = new Map();
    for (const c of enrichedClients) {
        const cc  = c.geo.country_code || 'XX';
        if (!countryMap.has(cc)) {
            countryMap.set(cc, {
                country_code:   cc,
                country:        c.geo.country,
                lat:            c.geo.lat,
                lng:            c.geo.lng,
                count:         0,
                online_count:  0,
                incident_count: 0,
            });
        }
        const entry = countryMap.get(cc);
        entry.count++;
        if (c.online)   entry.online_count++;
        if (c.incident) entry.incident_count++;
        // Use representative lat/lng (first assigned, or recompute average)
    }

    const country_summary = [...countryMap.values()]
        .sort((a, b) => b.count - a.count);

    // ── 6. Stats ──────────────────────────────────────────────────────────────
    const stats = {
        total:     enrichedClients.length,
        online:    enrichedClients.filter(c => c.online).length,
        offline:   enrichedClients.filter(c => !c.online).length,
        incident:  enrichedClients.filter(c => c.incident).length,
        countries: country_summary.filter(c => c.country_code !== 'XX').length,
        windows:   enrichedClients.filter(c => c.os === 'windows').length,
        linux:     enrichedClients.filter(c => c.os === 'linux').length,
        macos:     enrichedClients.filter(c => c.os === 'macos').length,
    };

    res.json({
        clients:         enrichedClients,
        country_summary,
        stats,
        cache:           cacheStats(),
        timestamp:       new Date().toISOString(),
    });
});
