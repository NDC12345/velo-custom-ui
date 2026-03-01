'use strict';
/**
 * GeoIP Service — IP → Country + LatLng enrichment
 *
 * Provider: ip-api.com (free tier, no API key needed)
 *   Batch endpoint: POST http://ip-api.com/batch?fields=...
 *   Rate limit: 45 req/min without key | 15,000/min with key
 *   Max 100 IPs per batch request
 *
 * Cache: In-memory LRU-like Map with per-entry TTL (24h default)
 *   Key: IP address
 *   Eviction: Check on write; entries older than TTL discarded on read
 */

const axios = require('axios');
const logger = require('../utils/logger');

// ── Config ─────────────────────────────────────────────────────────────────────
const GEOIP_CACHE_TTL_MS  = 24 * 60 * 60 * 1000;  // 24 hours
const GEOIP_BATCH_SIZE    = 100;                    // ip-api.com max per request
const GEOIP_TIMEOUT_MS    = 8000;
const GEOIP_ENDPOINT      = 'http://ip-api.com/batch';
const GEOIP_FIELDS        = 'status,message,country,countryCode,lat,lon,city,isp,org,query';
const MAX_CACHE_ENTRIES   = 5000;                   // evict oldest if exceeded

// ── In-memory LRU-like cache ───────────────────────────────────────────────────
/** @type {Map<string, { data: GeoEntry, ts: number }>} */
const geoCache = new Map();

/** Prunes expired entries, evicts oldest if over MAX_CACHE_ENTRIES */
function pruneCache() {
    const now = Date.now();
    for (const [key, entry] of geoCache.entries()) {
        if (now - entry.ts > GEOIP_CACHE_TTL_MS) geoCache.delete(key);
    }
    // Hard cap: evict LRU entries (Map iteration is insertion-order)
    if (geoCache.size > MAX_CACHE_ENTRIES) {
        const excess = geoCache.size - MAX_CACHE_ENTRIES;
        let i = 0;
        for (const key of geoCache.keys()) {
            if (i++ >= excess) break;
            geoCache.delete(key);
        }
    }
}

function getFromCache(ip) {
    const cached = geoCache.get(ip);
    if (!cached) return null;
    if (Date.now() - cached.ts > GEOIP_CACHE_TTL_MS) {
        geoCache.delete(ip);
        return null;
    }
    return cached.data;
}

function setCache(ip, data) {
    geoCache.set(ip, { data, ts: Date.now() });
}

// ── Normalize ──────────────────────────────────────────────────────────────────
const PRIVATE_IP_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|fd|fc)/;
const VALID_IP_RE   = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/i;

function isRoutableIP(ip) {
    if (!ip || typeof ip !== 'string') return false;
    const clean = ip.trim().split(':')[0]; // strip port
    return VALID_IP_RE.test(clean) && !PRIVATE_IP_RE.test(clean);
}

/**
 * @typedef {Object} GeoEntry
 * @property {string}  ip
 * @property {string}  country
 * @property {string}  country_code  — ISO 3166-1 alpha-2
 * @property {number}  lat
 * @property {number}  lng
 * @property {string}  city
 * @property {string}  isp
 * @property {boolean} cached
 */

function buildFallback(ip) {
    return {
        ip, country: 'Unknown', country_code: 'XX',
        lat: 0, lng: 0, city: '', isp: '', cached: false, fallback: true,
    };
}

// ── ip-api.com batch fetch ─────────────────────────────────────────────────────
async function fetchBatch(ips) {
    try {
        const payload = ips.map(ip => ({ query: ip, fields: GEOIP_FIELDS, lang: 'en' }));
        const { data } = await axios.post(
            `${GEOIP_ENDPOINT}?fields=${GEOIP_FIELDS}`,
            payload,
            { timeout: GEOIP_TIMEOUT_MS, headers: { 'Content-Type': 'application/json' } }
        );
        return Array.isArray(data) ? data : [];
    } catch (err) {
        logger.warn('[GeoIP] Batch fetch failed:', err.message);
        return [];
    }
}

// ── Public API ─────────────────────────────────────────────────────────────────
/**
 * Enrich a list of IP addresses with GeoIP data.
 * Returns a Map<ip → GeoEntry> for all inputs.
 * IPs already in cache are served instantly; others are batch-fetched.
 *
 * @param   {string[]}                 ips
 * @returns {Promise<Map<string, GeoEntry>>}
 */
async function enrichIPs(ips) {
    pruneCache();

    const result = new Map();
    const toFetch = [];

    for (const rawIp of ips) {
        const ip = (rawIp || '').trim().split(':')[0]; // strip port
        if (!ip) continue;

        const cached = getFromCache(ip);
        if (cached) {
            result.set(ip, { ...cached, cached: true });
        } else if (isRoutableIP(ip)) {
            toFetch.push(ip);
        } else {
            result.set(ip, { ...buildFallback(ip), reason: 'private_or_invalid' });
        }
    }

    // Deduplicate before fetching
    const uniqueToFetch = [...new Set(toFetch)];

    // Chunk into batches of GEOIP_BATCH_SIZE
    for (let i = 0; i < uniqueToFetch.length; i += GEOIP_BATCH_SIZE) {
        const chunk  = uniqueToFetch.slice(i, i + GEOIP_BATCH_SIZE);
        const apiRes = await fetchBatch(chunk);

        apiRes.forEach((entry) => {
            const ip = entry.query;
            if (!ip) return;

            if (entry.status !== 'success') {
                const fallback = buildFallback(ip);
                result.set(ip, fallback);
                setCache(ip, fallback);
                return;
            }

            /** @type {GeoEntry} */
            const geo = {
                ip,
                country:      entry.country      || 'Unknown',
                country_code: entry.countryCode   || 'XX',
                lat:          parseFloat(entry.lat) || 0,
                lng:          parseFloat(entry.lon) || 0,
                city:         entry.city          || '',
                isp:          entry.isp || entry.org || '',
                cached: false,
            };

            setCache(ip, geo);
            result.set(ip, geo);
        });

        // Fill misses (ip-api didn't return an entry for this IP)
        for (const ip of chunk) {
            if (!result.has(ip)) {
                const fallback = buildFallback(ip);
                setCache(ip, fallback);
                result.set(ip, fallback);
            }
        }
    }

    return result;
}

/**
 * Return current cache stats for monitoring.
 */
function cacheStats() {
    return {
        size:     geoCache.size,
        maxSize:  MAX_CACHE_ENTRIES,
        ttlHours: GEOIP_CACHE_TTL_MS / 3600000,
    };
}

module.exports = { enrichIPs, cacheStats, isRoutableIP };
