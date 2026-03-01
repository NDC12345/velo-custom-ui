/**
 * Audit Logging Middleware
 *
 * Records all API actions (especially Velo proxy calls) to the audit_logs table
 * for compliance and forensic traceability.
 */
'use strict';

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Classify the sensitivity of an action for audit logging.
 */
function classifyAction(method, path) {
    // High-sensitivity actions
    const highSensitivity = [
        /\/clients\/[^/]+\/quarantine/,
        /\/clients\/[^/]+\/shell/,
        /\/users\/[^/]+\/password/,
        /\/users\/[^/]+\/roles/,
        /\/server\/monitoring$/,
        /\/server\/client-monitoring$/,
        /\/server\/client-config$/,
        /\/secrets/,
        /\/auth\/register/,
    ];

    // Medium-sensitivity actions
    const mediumSensitivity = [
        /\/flows\/collect/,
        /\/hunts$/,
        /\/artifacts$/,
        /\/notebooks/,
        /\/query$/,
        /\/clients\/[^/]+\/metadata/,
    ];

    for (const pattern of highSensitivity) {
        if (pattern.test(path)) return 'HIGH';
    }
    for (const pattern of mediumSensitivity) {
        if (pattern.test(path) && method !== 'GET') return 'MEDIUM';
    }
    if (method === 'GET' || method === 'HEAD') return 'LOW';
    return 'MEDIUM';
}

/**
 * Extract a human-readable action description from the request.
 */
function describeAction(method, path) {
    const pathClean = path.replace(/^\/api/, '');

    // Map specific routes to action descriptions
    const actionMap = [
        { pattern: /^\/clients\/([^/]+)\/quarantine/, action: 'quarantine_client' },
        { pattern: /^\/clients\/([^/]+)\/shell/,      action: 'shell_command' },
        { pattern: /^\/clients\/([^/]+)\/metadata/,   action: 'client_metadata' },
        { pattern: /^\/clients\/([^/]+)\/notify/,     action: 'notify_client' },
        { pattern: /^\/clients\/([^/]+)\/flows/,      action: 'client_flows' },
        { pattern: /^\/clients$/,                       action: 'search_clients' },
        { pattern: /^\/clients\/([^/]+)$/,              action: 'get_client' },
        { pattern: /^\/hunts\/([^/]+)/,                 action: 'hunt_operation' },
        { pattern: /^\/hunts$/,                          action: 'hunt_operation' },
        { pattern: /^\/flows\/collect/,                  action: 'collect_artifact' },
        { pattern: /^\/flows\/([^/]+)/,                  action: 'flow_operation' },
        { pattern: /^\/artifacts/,                       action: 'artifact_operation' },
        { pattern: /^\/notebooks/,                       action: 'notebook_operation' },
        { pattern: /^\/vfs\/([^/]+)/,                    action: 'vfs_operation' },
        { pattern: /^\/query$/,                          action: 'vql_query' },
        { pattern: /^\/server\/events/,                  action: 'server_events' },
        { pattern: /^\/server\/monitoring/,              action: 'server_monitoring' },
        { pattern: /^\/server\/client-monitoring/,       action: 'client_monitoring' },
        { pattern: /^\/server\/client-config/,           action: 'client_config' },
        { pattern: /^\/users\/([^/]+)\/roles/,           action: 'user_roles' },
        { pattern: /^\/users\/([^/]+)\/password/,        action: 'user_password' },
        { pattern: /^\/users/,                           action: 'user_management' },
        { pattern: /^\/secrets/,                         action: 'secret_management' },
        { pattern: /^\/downloads/,                       action: 'download_operation' },
        { pattern: /^\/tools/,                           action: 'tool_management' },
        { pattern: /^\/auth/,                            action: 'authentication' },
    ];

    for (const { pattern, action } of actionMap) {
        if (pattern.test(pathClean)) return `${method.toLowerCase()}_${action}`;
    }

    return `${method.toLowerCase()}_${pathClean.replace(/\//g, '_').replace(/^_/, '')}`;
}

/**
 * Middleware: logs every API request to audit_logs table.
 * Attaches to responses to capture status code.
 *
 * Usage: app.use('/api', auditLogger);
 */
function auditLogger(req, res, next) {
    // Skip health checks and static files
    if (req.path === '/health' || req.path === '/health/velo') {
        return next();
    }

    const startTime = Date.now();

    // Capture response finish
    const originalEnd = res.end;
    res.end = function (...args) {
        originalEnd.apply(res, args);

        const duration = Date.now() - startTime;
        const method = req.method;
        const path = req.originalUrl || req.url;
        const sensitivity = classifyAction(method, path);

        // Only log MEDIUM/HIGH sensitivity for read-heavy paths to avoid audit noise
        if (sensitivity === 'LOW' && !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
            return;
        }

        const auditRecord = {
            user_id: req.user?.userId || null,
            action: describeAction(method, path),
            resource_type: 'api',
            resource_id: path,
            http_method: method,
            endpoint: path,
            request_body: sensitivity === 'HIGH' && req.body
                ? redactSensitiveFields(req.body)
                : null,
            response_status: res.statusCode,
            ip_address: req.ip,
            user_agent: req.headers['user-agent'] || '',
            success: res.statusCode < 400,
        };

        // Async DB insert — non-blocking, failures just logged
        insertAuditLog(auditRecord).catch(err => {
            logger.error('Failed to write audit log:', err.message);
        });
    };

    next();
}

/**
 * Redact sensitive fields from request bodies before logging.
 */
function redactSensitiveFields(body) {
    if (!body || typeof body !== 'object') return body;

    const sensitiveKeys = new Set([
        'password', 'veloPassword', 'newPassword', 'currentPassword',
        'secret', 'token', 'refreshToken', 'apiKey', 'api_key',
        'credentials', 'private_key',
    ]);

    const redacted = {};
    for (const [key, value] of Object.entries(body)) {
        if (sensitiveKeys.has(key)) {
            redacted[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
            redacted[key] = Array.isArray(value) ? '[Array]' : '[Object]';
        } else {
            redacted[key] = value;
        }
    }
    return redacted;
}

/**
 * Insert an audit record into the audit_logs table.
 */
async function insertAuditLog(record) {
    await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id,
                                  http_method, endpoint, request_body, response_status,
                                  ip_address, user_agent, success)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
            record.user_id,
            record.action,
            record.resource_type,
            record.resource_id,
            record.http_method,
            record.endpoint,
            record.request_body ? JSON.stringify(record.request_body) : null,
            record.response_status,
            record.ip_address,
            record.user_agent,
            record.success,
        ]
    );
}

module.exports = { auditLogger, insertAuditLog, classifyAction, describeAction };
