'use strict';
/**
 * ssrf.js — helpers to prevent Server-Side Request Forgery (SSRF) attacks.
 *
 * Validates user-supplied URLs before the backend makes any outgoing HTTP
 * request to them.  We intentionally allow private-network addresses
 * (10.x, 172.16.x, 192.168.x) because Velociraptor servers and local AI
 * services (Ollama) are legitimately hosted on internal networks.
 *
 * What we DO block:
 *   • Any non-HTTP/HTTPS protocol (file://, ftp://, gopher://, dict://, …)
 *   • Link-local addresses (169.254.0.0/16) — AWS/GCP/Azure/DO IMDS endpoints
 *   • IPv4-mapped link-local (::ffff:169.254.x.x)
 *   • Well-known cloud-metadata hostnames (metadata.google.internal, etc.)
 */

const { URL }  = require('url');
const net      = require('net');

// ─── Block-lists ──────────────────────────────────────────────────────────────

/** Link-local CIDR 169.254.0.0/16, plus its IPv4-mapped form. */
const BLOCKED_IP_RE = [
    /^169\.254\./,           // IPv4 link-local (AWS IMDS, GCP IMDS, Azure IMDS, DO metadata)
    /^::ffff:169\.254\./i,   // IPv4-mapped IPv6 link-local
];

/** Well-known cloud metadata hostnames that must never be contacted. */
const BLOCKED_HOSTNAMES = new Set([
    'metadata.google.internal',  // GCP IMDS
    'metadata.goog',             // GCP short alias
    'metadata',                  // generic internal alias used by some clouds
    'instance-data',             // older EC2 IMDS hostname
]);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate that a user-supplied URL is safe for the backend to connect to.
 *
 * @param  {string} urlStr
 * @throws {Error}  Descriptive, user-safe message when the URL fails validation.
 * @returns {true}  When the URL passes all checks.
 */
function validateExternalUrl(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') {
        throw new Error('URL is required');
    }

    let parsed;
    try {
        parsed = new URL(urlStr);
    } catch {
        throw new Error('Invalid URL format');
    }

    // ── 1. Protocol whitelist ─────────────────────────────────────────────────
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(
            `Protocol "${parsed.protocol.replace(':', '')}" is not allowed. ` +
            'Only http:// and https:// URLs are accepted.'
        );
    }

    const hostname = parsed.hostname.toLowerCase();

    // ── 2. Known cloud-metadata hostnames ────────────────────────────────────
    if (BLOCKED_HOSTNAMES.has(hostname)) {
        throw new Error('Connections to cloud metadata services are not permitted');
    }

    // ── 3. Link-local IP addresses (applies when hostname is a bare IP) ──────
    if (net.isIP(hostname) !== 0 && BLOCKED_IP_RE.some(re => re.test(hostname))) {
        throw new Error(
            `Connection to ${hostname} is not permitted. ` +
            'Link-local addresses are reserved for cloud instance metadata.'
        );
    }

    // ── 4. Hostname string that matches the link-local pattern (e.g. from DNS) ─
    if (BLOCKED_IP_RE.some(re => re.test(hostname))) {
        throw new Error('Connections to link-local addresses are not permitted');
    }

    return true;
}

module.exports = { validateExternalUrl };
