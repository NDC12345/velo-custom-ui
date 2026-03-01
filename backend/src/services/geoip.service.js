'use strict';
/**
 * Production GeoIP Service
 *
 * Resolution order per IP:
 *   1. Redis cache (TTL = REDIS_GEO_TTL_DAYS, default 7 days)
 *   2. MaxMind GeoLite2-City MMDB local file (~0.05ms/lookup, zero rate-limit)
 *      → requires /geoip/GeoLite2-City.mmdb volume mount (see docker-compose)
 *      → download: https://www.maxmind.com/en/geolite2/signup (free, requires registration)
 *   3. ip-api.com batch fallback (~45 req/min free tier, used when MMDB absent)
 *
 * Graceful degradation:
 *   - Redis unavailable → in-memory LRU (5 000 entries, 1h TTL)
 *   - MMDB absent       → ip-api.com batch
 *   - Both down         → returns best-effort {lat:0, lng:0, country_code:'XX'}
 */

const fs     = require('fs');
const path   = require('path');
const axios  = require('axios');
const logger = require('../utils/logger');

// ── Constants ─────────────────────────────────────────────────────────────────
const MMDB_PATHS = [
    process.env.MMDB_PATH || '',
    '/geoip/GeoLite2-City.mmdb',
    path.join(__dirname, '../../../geoip-data/GeoLite2-City.mmdb'),
].filter(Boolean);

const REDIS_TTL_SECONDS  = parseInt(process.env.REDIS_GEO_TTL_DAYS  || '7', 10) * 86400;
const MEM_CACHE_TTL_MS   = 60 * 60 * 1000;        // 1h in-memory fallback TTL
const MAX_MEM_ENTRIES    = 5_000;
const IPAPI_ENDPOINT     = 'http://ip-api.com/batch';
const IPAPI_FIELDS       = 'status,country,countryCode,lat,lon,city,isp,query';
const IPAPI_BATCH_SIZE   = 100;
const IPAPI_TIMEOUT_MS   = 8_000;

const PRIVATE_IP_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|fd|fc)/;
const VALID_IP_RE   = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/i;

// ── Module state ──────────────────────────────────────────────────────────────
let _mmdbReader   = null;   // maxmind.Reader instance (lazy-loaded)
let _mmdbChecked  = false;  // have we tried loading already?
let _redisClient  = null;   // redis.createClient instance
let _redisReady   = false;
const _memCache   = new Map(); // fallback: ip → { geo, ts }

// ─────────────────────────────────────────────────────────────────────────────
// REDIS
// ─────────────────────────────────────────────────────────────────────────────
async function initRedis() {
    if (_redisReady || _redisClient) return;
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) { logger.warn('[GeoIP] REDIS_URL not set — using in-memory cache only'); return; }

    try {
        const { createClient } = require('redis');
        _redisClient = createClient({ url: redisUrl, socket: { reconnectStrategy: retries => Math.min(retries * 100, 3_000) } });
        _redisClient.on('error', err => { logger.warn('[GeoIP] Redis error:', err.message); _redisReady = false; });
        _redisClient.on('ready', () => { _redisReady = true; logger.info('[GeoIP] Redis connected'); });
        await _redisClient.connect();
    } catch (err) {
        logger.warn('[GeoIP] Redis init failed — using in-memory cache:', err.message);
        _redisClient = null;
    }
}

async function redisGet(key) {
    if (!_redisReady) return null;
    try { const v = await _redisClient.get(key); return v ? JSON.parse(v) : null; }
    catch { return null; }
}

async function redisSet(key, value) {
    if (!_redisReady) return;
    try { await _redisClient.setEx(key, REDIS_TTL_SECONDS, JSON.stringify(value)); }
    catch { /* non-critical */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAXMIND MMDB
// ─────────────────────────────────────────────────────────────────────────────
async function loadMmdb() {
    if (_mmdbChecked) return _mmdbReader;
    _mmdbChecked = true;

    for (const p of MMDB_PATHS) {
        if (!p) continue;
        try {
            if (!fs.existsSync(p)) continue;
            const { open } = require('maxmind');
            _mmdbReader = await open(p);
            logger.info(`[GeoIP] MaxMind MMDB loaded from ${p} — local lookups active`);
            return _mmdbReader;
        } catch (err) {
            logger.warn(`[GeoIP] Could not load MMDB at ${p}: ${err.message}`);
        }
    }

    logger.info('[GeoIP] No MaxMind MMDB found — falling back to ip-api.com');
    return null;
}

function mmdbLookup(ip) {
    if (!_mmdbReader) return null;
    try {
        const r = _mmdbReader.get(ip);
        if (!r) return null;
        return {
            lat:          r.location?.latitude  ?? 0,
            lng:          r.location?.longitude ?? 0,
            country_code: r.country?.iso_code   ?? 'XX',
            country:      r.country?.names?.en  ?? 'Unknown',
            city:         r.city?.names?.en     ?? '',
            isp:          r.traits?.isp ?? r.traits?.organization ?? '',
        };
    } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY FALLBACK
// ─────────────────────────────────────────────────────────────────────────────
function memGet(ip) {
    const e = _memCache.get(ip);
    if (!e) return null;
    if (Date.now() - e.ts > MEM_CACHE_TTL_MS) { _memCache.delete(ip); return null; }
    return e.geo;
}

function memSet(ip, geo) {
    if (_memCache.size >= MAX_MEM_ENTRIES) {
        // Evict oldest FIFO
        const first = _memCache.keys().next().value;
        _memCache.delete(first);
    }
    _memCache.set(ip, { geo, ts: Date.now() });
}

// ─────────────────────────────────────────────────────────────────────────────
// IP VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
function isRoutable(ip) {
    if (!ip || typeof ip !== 'string') return false;
    const clean = ip.trim().split(':')[0];
    return VALID_IP_RE.test(clean) && !PRIVATE_IP_RE.test(clean);
}

function privateGeo(ip) {
    return { ip, lat: 0, lng: 0, country_code: 'XX', country: 'Private/Unknown', city: '', isp: '', source: 'private' };
}

// ─────────────────────────────────────────────────────────────────────────────
// ip-api.com BATCH FALLBACK
// ─────────────────────────────────────────────────────────────────────────────
async function ipapiLookupBatch(ips) {
    /** @type {Map<string, object>} */
    const results = new Map();
    const batches = [];
    for (let i = 0; i < ips.length; i += IPAPI_BATCH_SIZE)
        batches.push(ips.slice(i, i + IPAPI_BATCH_SIZE));

    for (const batch of batches) {
        try {
            const resp = await axios.post(
                `${IPAPI_ENDPOINT}?fields=${IPAPI_FIELDS}`,
                batch.map(ip => ({ query: ip })),
                { timeout: IPAPI_TIMEOUT_MS, validateStatus: s => s < 500 }
            );
            for (const row of resp.data || []) {
                if (row.status !== 'success') continue;
                results.set(row.query, {
                    lat:          row.lat        ?? 0,
                    lng:          row.lon        ?? 0,
                    country_code: row.countryCode ?? 'XX',
                    country:      row.country    ?? 'Unknown',
                    city:         row.city       ?? '',
                    isp:          row.isp        ?? '',
                    source:       'ipapi',
                });
            }
        } catch (err) {
            logger.warn('[GeoIP] ip-api.com batch failed:', err.message);
        }
    }
    return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/** Initialise Redis + try loading MMDB. Call once at startup. */
async function init() {
    await Promise.all([initRedis(), loadMmdb()]);
}

/**
 * Enrich an array of IP strings → Map<ip, GeoEntry>
 * @param {string[]} ips
 * @returns {Promise<Map<string, object>>}
 */
async function enrichIPs(ips) {
    const result   = new Map();
    const toFetch  = []; // IPs that weren't in any cache

    // 1. Check all caches first
    for (const ip of ips) {
        if (!isRoutable(ip)) { result.set(ip, privateGeo(ip)); continue; }
        const rKey = `geo:${ip}`;

        const fromRedis = await redisGet(rKey);
        if (fromRedis) { result.set(ip, fromRedis); continue; }

        const fromMem = memGet(ip);
        if (fromMem) { result.set(ip, fromMem); continue; }

        toFetch.push(ip);
    }

    if (toFetch.length === 0) return result;

    // 2. MaxMind synchronous lookup for all uncached IPs
    const stillMissing = [];
    if (_mmdbReader) {
        for (const ip of toFetch) {
            const geo = mmdbLookup(ip);
            if (geo) {
                const entry = { ip, ...geo, source: 'mmdb' };
                result.set(ip, entry);
                await redisSet(`geo:${ip}`, entry);
                memSet(ip, entry);
            } else {
                stillMissing.push(ip);
            }
        }
    } else {
        stillMissing.push(...toFetch);
    }

    // 3. ip-api.com batch for anything still missing
    if (stillMissing.length > 0) {
        const ipapiMap = await ipapiLookupBatch(stillMissing);
        for (const ip of stillMissing) {
            const geo = ipapiMap.get(ip) || privateGeo(ip);
            const entry = { ip, ...geo };
            result.set(ip, entry);
            await redisSet(`geo:${ip}`, entry);
            memSet(ip, entry);
        }
    }

    return result;
}

/** Diagnostic stats for /health or monitoring endpoints */
function cacheStats() {
    return {
        mmdb_loaded:    _mmdbReader !== null,
        redis_ready:    _redisReady,
        mem_cache_size: _memCache.size,
        mmdb_path:      MMDB_PATHS.find(p => p && fs.existsSync(p)) || null,
    };
}

module.exports = { init, enrichIPs, cacheStats, isRoutable };
