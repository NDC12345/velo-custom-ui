/**
 * Proxy Controller — bridges our REST API to Velociraptor gRPC-gateway.
 *
 * Velociraptor API quirks:
 *   - Some "Get" endpoints use POST (GetArtifacts, ListAvailableEventResults)
 *   - Some use path params (GetClient/{client_id}, GetClientMetadata/{client_id}, VFSListDirectory/{client_id})
 *   - Table-format responses: { columns:[], rows:[{json:"[...]"}], total_rows:"N" }
 *   - Flow results via GetTable endpoint
 *   - VQL Query (/api/v1/Query) is gRPC-streaming only — not available via REST
 *   - Tools endpoint is GetToolInfo (singular, per-tool) not GetTools
 *   - CSRF required on all POST/PUT/DELETE/PATCH (handled by velo-api.js)
 */
'use strict';

const veloApi = require('../config/velo-api');
const { asyncHandler } = require('../middleware/errorHandler');
const { VeloApiError } = require('../utils/errors');
const { createLocalUser } = require('../services/auth.service');
const logger = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

// Simple TTL cache for expensive GETs
const simpleCache = new Map();
function cacheGet(key) {
    const e = simpleCache.get(key);
    if (!e) return null;
    if (Date.now() > e.expiry) { simpleCache.delete(key); return null; }
    return e.value;
}
function cacheSet(key, value, ttlMs = 30000) {
    simpleCache.set(key, { value, expiry: Date.now() + ttlMs });
}

/**
 * Thin wrapper: injects org context + per-user server URL on every velo request.
 */
async function vproxy(req, endpoint, opts = {}) {
    return veloApi.proxyRequest(endpoint, {
        orgId:     req.veloOrgId || '',
        serverUrl: req.veloServerUrl || '',
        verifySsl: req.veloVerifySsl !== false,
        ...opts,
        auth: req.veloAuth,
    });
}

/**
 * Parse Velociraptor table format → { items, total }.
 *
 * Velo returns:  { columns: ["A","B","_SentinelObj"], rows: [{json:"[val1,val2,{...}]"}], total_rows: "N" }
 *
 * If a sentinel column (prefixed with _) contains an object, we use that object
 * as the item; otherwise we zip columns + values into a plain object.
 */
function parseVeloTable(response, sentinelKey = null) {
    if (!response) return { items: [], total: 0 };

    // Already in items format
    if (Array.isArray(response.items)) return response;
    if (Array.isArray(response)) return { items: response, total: response.length };

    // Not a table
    if (!Array.isArray(response.columns)) return response;

    const cols = response.columns;
    const sentinel = sentinelKey
        || cols.find(c => c.startsWith('_') && !['_Urgent', '_ArtifactsWithResults', '_OrgId'].includes(c))
        || null;

    const items = (response.rows || []).map(row => {
        try {
            const vals = JSON.parse(row.json);
            const obj = {};
            cols.forEach((col, i) => { obj[col] = vals[i]; });
            // If sentinel column holds an object, merge the flat cols into it (for metadata like FlowId)
            if (sentinel && obj[sentinel] && typeof obj[sentinel] === 'object') {
                return obj[sentinel];
            }
            return obj;
        } catch {
            return null;
        }
    }).filter(Boolean);

    return { items, total: parseInt(response.total_rows, 10) || items.length };
}

/**
 * Safe error handler — catches Velo API errors and either falls back to mock
 * data (in dev/mock mode) or re-throws as VeloApiError.
 */
function safeThrow(error) {
    throw new VeloApiError(
        error.message || 'Proxy request failed',
        error.status || 500,
        error.data,
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CLIENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/clients — list/search clients
 * Velo: GET /api/v1/SearchClients?query=all&count=N
 */
exports.searchClients = asyncHandler(async (req, res) => {
    try {
        const params = { query: 'all', count: 500, offset: 0, ...req.query };
        const response = await vproxy(req, '/api/v1/SearchClients', {
            method: 'GET', params,
        });
        // SearchClients returns { items, total, search_term }
        res.json(response);
    } catch (error) {
        safeThrow(error);
    }
});

/**
 * GET /api/clients/:clientId — client details
 * Velo: GET /api/v1/GetClient/{client_id}  (path param)
 */
exports.getClient = asyncHandler(async (req, res) => {
    try {
        const response = await vproxy(req, `/api/v1/GetClient/${req.params.clientId}`, {
            method: 'GET',
        });
        res.json(response);
    } catch (error) {
        safeThrow(error);
    }
});

/**
 * GET /api/clients/:clientId/flows — client's flow/collection history
 * Velo: GET /api/v1/GetClientFlows?client_id=C.xxx&count=N
 * Returns table format → parse with _Flow sentinel
 */
exports.getClientFlows = asyncHandler(async (req, res) => {
    try {
        const response = await vproxy(req, '/api/v1/GetClientFlows', {
            method: 'GET',
            params: { client_id: req.params.clientId, count: 50, offset: 0, ...req.query },
        });
        res.json(parseVeloTable(response, '_Flow'));
    } catch (error) {
        safeThrow(error);
    }
});

/**
 * GET /api/clients/:clientId/metadata — client metadata
 * Velo: GET /api/v1/GetClientMetadata/{client_id}  (path param!)
 */
exports.getClientMetadata = asyncHandler(async (req, res) => {
    try {
        const response = await vproxy(req, `/api/v1/GetClientMetadata/${req.params.clientId}`, {
            method: 'GET',
        });
        res.json(response);
    } catch (error) {
        // Not all clients have metadata
        if (error.status === 404) return res.json({ client_id: req.params.clientId });
        safeThrow(error);
    }
});

/**
 * POST /api/clients/:clientId/metadata — set client metadata
 * Velo: POST /api/v1/SetClientMetadata
 *
 * Velo ClientMetadata proto accepts a flat object with client_id.
 * Frontend may send { metadata: {key:val} } or flat { key:val } — both are passed through.
 * Velo internally stores arbitrary key-value pairs via the generic metadata fields.
 */
exports.setClientMetadata = asyncHandler(async (req, res) => {
    const body = req.body || {};
    // Flatten: if frontend wraps in { metadata: {...} }, hoist to top level
    const flat = body.metadata && typeof body.metadata === 'object'
        ? { ...body.metadata }
        : { ...body };
    delete flat.metadata; // prevent double-nesting

    const response = await vproxy(req, '/api/v1/SetClientMetadata', {
        method: 'POST',
        data: { client_id: req.params.clientId, ...flat },
    });
    res.json(response);
});

/**
 * POST /api/clients/label — add/remove labels
 * Velo: POST /api/v1/LabelClients
 */
exports.labelClients = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/LabelClients', {
        method: 'POST', data: req.body,
    });
    res.json(response);
});

/**
 * DELETE /api/clients/:clientId — delete client
 * Velo: POST /api/v1/DeleteClient (gRPC uses POST for mutations)
 */
exports.deleteClient = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/DeleteClient', {
        method: 'POST',
        data: { client_id: req.params.clientId, really_do_it: true },
    });
    res.json(response);
});

/**
 * POST /api/clients/:clientId/notify — trigger client reconnection
 * Velo: POST /api/v1/NotifyClient
 */
exports.notifyClient = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/NotifyClient', {
        method: 'POST',
        data: { client_id: req.params.clientId },
    });
    res.json(response);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  HUNT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/hunts — list hunts
 * Velo: GET /api/v1/GetHuntTable?count=N — returns table format with _Hunt sentinel
 */

/**
 * Velociraptor's gRPC-gateway marshals proto fields using custom jsontag names
 * (PascalCase, e.g. HuntId, HuntDescription, TotalClientsScheduled).
 * This function normalises them to the snake_case names used by the UI.
 */
function normalizeHunt(h) {
    if (!h) return h;
    const arts = h.start_request?.artifacts || h.StartRequest?.artifacts || [];
    // gRPC-gateway serialises proto3 `hunt_id` → JSON `huntId` (camelCase) by default
    let huntId = h.huntId || h.hunt_id || h.HuntId || h.flow_id || '';
    // Fallback: scan all string values for hunt ID pattern (H.XXXXXXXXXXXXXXXX)
    if (!huntId) {
        for (const val of Object.values(h)) {
            if (typeof val === 'string' && /^H\.[0-9A-F]+$/i.test(val)) { huntId = val; break; }
        }
    }
    return {
        ...h,
        hunt_id:                    huntId,
        huntId:                     huntId,
        hunt_description:           h.hunt_description           || h.HuntDescription     || h.description      || '',
        artifact_name:              h.artifact_name              || h.ArtifactName        || (arts[0] || '')    || '',
        state:                      h.state                      ?? h.State               ?? 0,
        create_time:                h.create_time                || h.CreateTime          || 0,
        expires:                    h.expires                    || h.Expires             || 0,
        total_clients_scheduled:    h.total_clients_scheduled    ?? h.TotalClientsScheduled    ?? 0,
        total_clients_with_results: h.total_clients_with_results ?? h.TotalClientsWithResults ?? 0,
        total_clients_with_errors:  h.total_clients_with_errors  ?? h.TotalClientsWithErrors  ?? 0,
        start_request:              h.start_request              || h.StartRequest        || {},
    };
}

exports.getHunts = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetHuntTable', {
        method: 'GET',
        params: { count: 200, offset: 0, ...req.query },
    });
    const result = parseVeloTable(response, '_Hunt');
    result.items = (result.items || []).map(normalizeHunt);
    res.json(result);
});

/**
 * GET /api/hunts/:huntId — hunt details
 * Velo: GET /api/v1/GetHunt?hunt_id=H.xxx
 */
exports.getHunt = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetHunt', {
        method: 'GET',
        params: { hunt_id: req.params.huntId },
    });
    res.json(normalizeHunt(response));
});

/**
 * POST /api/hunts — create hunt
 * Velo: POST /api/v1/CreateHunt
 *
 * Normalizes `expires` from seconds/ms → microseconds (Velo uses µs).
 */
exports.createHunt = asyncHandler(async (req, res) => {
    const body = { ...req.body };
    if (body.expires) {
        const e = Number(body.expires);
        if (e < 1e12)      body.expires = e * 1e6;        // seconds → µs
        else if (e < 1e15) body.expires = e * 1e3;        // ms → µs
    } else {
        body.expires = (Date.now() + 86400000) * 1000;    // default 24h in µs
    }

    try {
        const response = await vproxy(req, '/api/v1/CreateHunt', {
            method: 'POST', data: body,
        });

        // Velo returns { flow_id: "H.xxx" } — normalize to hunt_id
        if (response && response.flow_id && !response.hunt_id) {
            response.hunt_id = response.flow_id;
        }
        res.status(201).json(response);
    } catch (error) {
        // Improve error message for permission issues
        if (error.message && error.message.includes('PermissionDenied')) {
            const err = new Error('Permission denied: You need Server Administrator role in Velociraptor to create hunts');
            err.status = 403;
            throw err;
        }
        throw error;
    }
});

/**
 * PATCH /api/hunts/:huntId — modify hunt (start/stop/pause)
 * Velo: POST /api/v1/ModifyHunt
 *
 * HuntState enum: PAUSED=0, RUNNING=1, STOPPED=2, ARCHIVED=4
 * gRPC-gateway accepts integer OR enum name string.
 * We normalise string names → integers for safety.
 */
// Velociraptor proto HuntState enum (matches internal proto integers):
// UNSET=0, PAUSED=1, RUNNING=2, STOPPED=3, ARCHIVED=4, ERROR=5
const HUNT_STATE = { PAUSED: 1, RUNNING: 2, STOPPED: 3, ARCHIVED: 4, ERROR: 5 };
exports.modifyHunt = asyncHandler(async (req, res) => {
    const body = { ...req.body };
    if (typeof body.state === 'string' && body.state.toUpperCase() in HUNT_STATE) {
        body.state = HUNT_STATE[body.state.toUpperCase()];
    }
    const response = await vproxy(req, '/api/v1/ModifyHunt', {
        method: 'POST',
        data: { hunt_id: req.params.huntId, ...body },
    });
    res.json(response);
});

/**
 * DELETE /api/hunts/:huntId — delete hunt
 * Velo: POST /api/v1/ModifyHunt with state=ARCHIVED (DeleteHunt endpoint doesn't exist)
 */
exports.deleteHunt = asyncHandler(async (req, res) => {
    // DeleteHunt endpoint doesn't exist in Velociraptor API.
    // Use ModifyHunt to set state=ARCHIVED (4) instead.
    const response = await vproxy(req, '/api/v1/ModifyHunt', {
        method: 'POST',
        data: { 
            hunt_id: req.params.huntId,
            state: 4  // ARCHIVED
        },
    });
    res.json({ success: true, hunt_id: req.params.huntId, state: 'ARCHIVED' });
});

/**
 * GET /api/hunts/:huntId/results — hunt results
 * Velo: GET /api/v1/GetHuntResults?hunt_id=H.xxx — returns table format
 */
exports.getHuntResults = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetHuntResults', {
        method: 'GET',
        params: { hunt_id: req.params.huntId, ...req.query },
    });
    res.json(parseVeloTable(response));
});

/**
 * GET /api/hunts/:huntId/stats — hunt statistics
 * Velo: embedded in GetHunt response (stats field), no separate endpoint
 */
exports.getHuntStats = asyncHandler(async (req, res) => {
    try {
        const response = await vproxy(req, '/api/v1/GetHunt', {
            method: 'GET',
            params: { hunt_id: req.params.huntId },
        });
        // Return just the stats sub-object, or the full hunt if stats not present
        res.json(response?.stats || response || {});
    } catch (error) {
        if (error.status === 404) return res.json({});
        safeThrow(error);
    }
});

/**
 * GET /api/hunts/:huntId/flows — hunt flows (client results)
 * Velo: GET /api/v1/GetHuntFlows?hunt_id=H.xxx — returns table format
 */
exports.getHuntFlows = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetHuntFlows', {
        method: 'GET',
        params: { hunt_id: req.params.huntId, ...req.query },
    });
    res.json(parseVeloTable(response));
});

/**
 * GET /api/hunts/:huntId/tags — hunt tags
 * Velo: GET /api/v1/GetHuntTags?hunt_id=H.xxx
 */
exports.getHuntTags = asyncHandler(async (req, res) => {
    // GetHuntTags takes google.protobuf.Empty — no params!
    try {
        const response = await vproxy(req, '/api/v1/GetHuntTags', { method: 'GET' });
        res.json(response);
    } catch (error) {
        if (error.status === 404) return res.json({ tags: [] });
        safeThrow(error);
    }
});

/**
 * POST /api/hunts/estimate — estimate hunt scope
 * Velo: POST /api/v1/EstimateHunt
 */
exports.estimateHunt = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/EstimateHunt', {
        method: 'POST', data: req.body,
    });
    res.json(response);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  FLOW / COLLECTION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/flows/collect — collect artifact from client
 * Velo: POST /api/v1/CollectArtifact
 */
exports.collectArtifact = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/CollectArtifact', {
        method: 'POST', data: req.body,
    });
    res.status(201).json(response);
});

/**
 * GET /api/flows/:flowId — flow details
 * Velo: GET /api/v1/GetFlowDetails?client_id=C.xxx&flow_id=F.xxx
 */
exports.getFlow = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetFlowDetails', {
        method: 'GET',
        params: { client_id: req.query.client_id, flow_id: req.params.flowId },
    });
    // GetFlowDetails wraps in { context: {...} } — unwrap for frontend
    res.json(response?.context || response);
});

/**
 * GET /api/flows/:flowId/results — flow results
 * Velo: GET /api/v1/GetTable?type=COLLECTION&client_id=&flow_id=&artifact=
 * Note: /api/v1/GetFlowResults does NOT exist in gRPC-gateway; use GetTable instead
 *
 * Velo uses start_row/rows for pagination (not offset/count).
 * Also supports artifact filter for multi-artifact flows.
 */
exports.getFlowResults = asyncHandler(async (req, res) => {
    try {
        const params = {
            type: 'COLLECTION',
            client_id: req.query.client_id,
            flow_id: req.params.flowId,
            artifact: req.query.artifact || '',
            // Velo paginates via start_row + rows (NOT offset + count)
            start_row: parseInt(req.query.start_row || req.query.offset) || 0,
            rows: parseInt(req.query.rows || req.query.count) || 100,
        };
        // Remove empty artifact param (Velo may reject empty string for some artifacts)
        if (!params.artifact) delete params.artifact;

        const response = await vproxy(req, '/api/v1/GetTable', {
            method: 'GET', params,
        });
        res.json(parseVeloTable(response));
    } catch (error) {
        // Flow results may not be ready yet (503) or flow ID invalid (404)
        if (error.status === 404 || error.status === 503) return res.json({ items: [], total: 0 });
        safeThrow(error);
    }
});

/**
 * GET /api/flows/:flowId/requests — flow request details (VQL sent to client)
 * Velo: GET /api/v1/GetFlowRequests?client_id=&flow_id=
 */
exports.getFlowRequests = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetFlowRequests', {
        method: 'GET',
        params: { client_id: req.query.client_id, flow_id: req.params.flowId },
    });
    res.json(response);
});

/**
 * POST /api/flows/:flowId/cancel — cancel running flow
 * Velo: POST /api/v1/CancelFlow
 */
exports.cancelFlow = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/CancelFlow', {
        method: 'POST',
        data: { client_id: req.body.client_id, flow_id: req.params.flowId },
    });
    res.json(response);
});

/**
 * POST /api/flows/:flowId/resume — resume paused flow
 * Velo: POST /api/v1/ResumeFlow
 */
exports.resumeFlow = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/ResumeFlow', {
        method: 'POST',
        data: { client_id: req.body.client_id, flow_id: req.params.flowId },
    });
    res.json(response);
});

/**
 * POST /api/flows/:flowId/archive — archive completed flow
 * Velo: POST /api/v1/ArchiveFlow (may not exist; use CreateDownload as fallback)
 */
exports.archiveFlow = asyncHandler(async (req, res) => {
    try {
        const response = await vproxy(req, '/api/v1/CreateDownload', {
            method: 'POST',
            data: {
                flow_id: req.params.flowId,
                client_id: req.body.client_id || req.query.client_id,
            },
        });
        res.json(response);
    } catch (error) {
        // Archiving is non-critical
        if (error.status === 404 || error.status === 503) return res.json({ status: 'ok' });
        safeThrow(error);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ARTIFACT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/artifacts — list artifacts
 * Velo: POST /api/v1/GetArtifacts (despite the name, it's a POST endpoint)
 */
exports.getArtifacts = asyncHandler(async (req, res) => {
    const cacheKey = `artifacts:${JSON.stringify(req.query || {})}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const data = {};
    if (req.query.search) data.search_term = req.query.search;
    if (req.query.type) data.type = req.query.type;
    if (req.query.number_of_results) data.number_of_results = parseInt(req.query.number_of_results);

    const response = await vproxy(req, '/api/v1/GetArtifacts', {
        method: 'POST', data,
    });
    cacheSet(cacheKey, response, 30000);
    res.json(response);
});

/**
 * GET /api/artifacts/:artifactName — single artifact definition
 * Velo: POST /api/v1/GetArtifacts with { search_term: exactName, number_of_results: 1 }
 * Note: There is no standalone GetArtifact GET endpoint in gRPC-gateway
 */
exports.getArtifact = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetArtifacts', {
        method: 'POST',
        data: {
            search_term: req.params.artifactName,
            number_of_results: 100,
        },
    });
    // Find exact match in results
    const items = response?.items || [];
    const exact = items.find(a => a.name === req.params.artifactName) || items[0];
    if (!exact) {
        throw new VeloApiError('Artifact not found', 404);
    }
    res.json(exact);
});

/**
 * GET /api/artifacts/:artifactName/file — artifact YAML file
 * Velo: GET /api/v1/GetArtifactFile?name=xxx
 */
exports.getArtifactFile = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetArtifactFile', {
        method: 'GET',
        params: { name: req.params.artifactName, vfs_path: req.query.vfs_path },
    });
    res.json(response);
});

/**
 * POST /api/artifacts — set/create artifact
 * Velo: POST /api/v1/SetArtifactFile
 */
exports.setArtifact = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/SetArtifactFile', {
        method: 'POST', data: req.body,
    });
    // Invalidate artifacts list cache so next fetch returns fresh data
    for (const key of simpleCache.keys()) {
        if (key.startsWith('artifacts:')) simpleCache.delete(key);
    }
    res.status(201).json(response);
});

/**
 * DELETE /api/artifacts/:artifactName — delete artifact
 * Velo: POST /api/v1/SetArtifactFile with { artifact: "name_...", op: "DELETE" }
 * Actually there's no explicit delete — setting empty content effectively removes custom artifacts
 */
exports.deleteArtifact = asyncHandler(async (req, res) => {
    try {
        const response = await vproxy(req, '/api/v1/SetArtifactFile', {
            method: 'POST',
            data: { artifact: `name: ${req.params.artifactName}\n`, op: 'DELETE' },
        });
        res.json(response);
    } catch (error) {
        if (error.status === 404) return res.json({ status: 'deleted' });
        safeThrow(error);
    }
});

/**
 * POST /api/artifacts/pack — load artifact pack
 * Velo: POST /api/v1/LoadArtifactPack
 */
exports.loadArtifactPack = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/LoadArtifactPack', {
        method: 'POST', data: req.body,
    });
    res.json(response);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  VFS (Virtual File System)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/vfs/:clientId — list VFS directory
 * Velo: GET /api/v1/VFSListDirectory/{client_id}?vfs_components=...  (path param!)
 *
 * Note: vfs_components is a repeated param. For root, no components needed.
 * The response is { Response: "JSON_string" } — we parse it.
 */
exports.vfsListDirectory = asyncHandler(async (req, res) => {
    const vfsPath = req.query.path || '/';
    const components = vfsPath.split('/').filter(Boolean);
    
    // Build query string with repeated vfs_components params
    let queryStr = '';
    if (components.length > 0) {
        queryStr = components.map(c => `vfs_components=${encodeURIComponent(c)}`).join('&');
    }

    const response = await vproxy(req, `/api/v1/VFSListDirectory/${req.params.clientId}${queryStr ? '?' + queryStr : ''}`, {
        method: 'GET',
    });

    // Parse the JSON string in Response field
    if (response?.Response) {
        try {
            const items = JSON.parse(response.Response);
            return res.json({ items: Array.isArray(items) ? items : [], total: Array.isArray(items) ? items.length : 0 });
        } catch {
            return res.json(response);
        }
    }
    // If already parsed as items array
    if (Array.isArray(response?.items)) return res.json(response);
    // Empty or no VFS data yet (VFSRefreshDirectory not yet called for this path)
    if (!response || Object.keys(response).length === 0) {
        return res.json({ items: [], total: 0, cached: false });
    }
    res.json(response);
});

/**
 * GET /api/vfs/:clientId/files — list VFS directory files (detailed)
 * Velo: GET /api/v1/VFSListDirectoryFiles?client_id=xxx&vfs_components=...
 */
exports.vfsListDirectoryFiles = asyncHandler(async (req, res) => {
    const vfsPath = req.query.path || '/';
    const components = vfsPath.split('/').filter(Boolean);

    // gRPC-gateway repeated string params must be sent as ?key=a&key=b (NOT key[0]=a)
    // Build the query string manually to avoid axios serializing arrays incorrectly
    const qs = [
        `client_id=${encodeURIComponent(req.params.clientId)}`,
        ...components.map(c => `vfs_components=${encodeURIComponent(c)}`),
    ].join('&');

    const response = await vproxy(req, `/api/v1/VFSListDirectoryFiles?${qs}`, {
        method: 'GET',
    });
    res.json(response);
});

/**
 * GET /api/vfs/:clientId/stat — stat VFS file
 * Velo: GET /api/v1/VFSStatDirectory?client_id=xxx&...
 */
exports.vfsStatFile = asyncHandler(async (req, res) => {
    // VFSStatDirectory (VFSListRequest proto): client_id + vfs_components[] repeated
    const vfsPath = req.query.path || '/';
    const components = vfsPath.split('/').filter(Boolean);
    const qs = [
        `client_id=${encodeURIComponent(req.params.clientId)}`,
        ...components.map(c => `vfs_components=${encodeURIComponent(c)}`),
    ].join('&');
    const response = await vproxy(req, `/api/v1/VFSStatDirectory?${qs}`, { method: 'GET' });
    res.json(response);
});

/**
 * GET /api/vfs/:clientId/stat-dir — stat VFS directory
 * Velo: GET /api/v1/VFSStatDirectory?client_id=xxx&vfs_components=a&...
 */
exports.vfsStatDirectory = asyncHandler(async (req, res) => {
    const vfsPath = req.query.path || '/';
    const components = vfsPath.split('/').filter(Boolean);
    const qs = [
        `client_id=${encodeURIComponent(req.params.clientId)}`,
        ...components.map(c => `vfs_components=${encodeURIComponent(c)}`),
    ].join('&');
    const response = await vproxy(req, `/api/v1/VFSStatDirectory?${qs}`, { method: 'GET' });
    res.json(response);
});

/**
 * GET /api/vfs/:clientId/stat-download — check download availability
 * Velo: GET /api/v1/VFSStatDownload?client_id=xxx&...
 */
exports.vfsStatDownload = asyncHandler(async (req, res) => {
    // VFSStatDownloadRequest proto: { client_id, accessor, components[] }
    const vfsPath = req.query.path || '/';
    const accessorMatch = vfsPath.match(/^([a-zA-Z]+):/);
    const accessor = accessorMatch ? accessorMatch[1] : 'file';
    const components = vfsPath.replace(/^[a-zA-Z]+:\/?\/? ?/, '').split('/').filter(Boolean);
    const qs = [
        `client_id=${encodeURIComponent(req.params.clientId)}`,
        `accessor=${encodeURIComponent(accessor)}`,
        ...components.map(c => `components=${encodeURIComponent(c)}`),
    ].join('&');
    const response = await vproxy(req, `/api/v1/VFSStatDownload?${qs}`, { method: 'GET' });
    res.json(response);
});

/**
 * GET /api/vfs/:clientId/download — download VFS file
 * Velo: POST /api/v1/VFSDownloadFile (POST, not GET!)
 */
/**
 * GET /api/vfs/:clientId/download — download VFS file as binary
 * Strategy:
 *   1. Use VFSStatDownload to get the Velociraptor download path
 *   2. Stream the file from Velociraptor's /downloads/ endpoint
 *   3. Fall back to VFSDownloadFile (returns JSON with base64/text content)
 */
exports.vfsDownloadFile = asyncHandler(async (req, res) => {
    const vfsPath = req.query.path || '/';
    const accessorMatch = vfsPath.match(/^([a-zA-Z]+):/);
    const accessor = accessorMatch ? accessorMatch[1] : 'file';
    // Strip leading accessor prefix and normalize
    const rawPath = vfsPath.replace(/^[a-zA-Z]+:\/?\/? ?/, '');
    const components = rawPath.split('/').filter(Boolean);
    const fileName = components[components.length - 1] || 'download';
    const clientId = req.params.clientId;
    const serverUrl = (req.veloServerUrl || process.env.VELO_API_BASE_URL || '').replace(/\/$/, '');
    const veloAuth  = req.veloAuth;

    // ── Step 1: Check if file is already cached (VFSStatDownload) ──────────────
    // VFSStatDownloadRequest proto: { client_id, accessor, components[] }
    const statQs = [
        `client_id=${encodeURIComponent(clientId)}`,
        `accessor=${encodeURIComponent(accessor)}`,
        ...components.map(c => `components=${encodeURIComponent(c)}`),
    ].join('&');

    try {
        const statRes = await vproxy(req, `/api/v1/VFSStatDownload?${statQs}`, { method: 'GET' });

        if (statRes?.vfs_path) {
            // File is already in the store — stream it directly via /downloads/<vfs_path>
            const axios = require('axios');
            const dlRes = await axios.get(`${serverUrl}/downloads/${statRes.vfs_path}`, {
                responseType: 'stream',
                auth: veloAuth,
                httpsAgent: new (require('https').Agent)({ rejectUnauthorized: req.veloVerifySsl !== false }),
                headers: { 'ngrok-skip-browser-warning': 'true' },
            });
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
            res.setHeader('Content-Type', dlRes.headers['content-type'] || 'application/octet-stream');
            if (dlRes.headers['content-length']) res.setHeader('Content-Length', dlRes.headers['content-length']);
            return dlRes.data.pipe(res);
        }
    } catch (statErr) {
        // Not yet cached — fall through to trigger a download collection
    }

    // ── Step 2: Trigger VFSDownloadFile to start a collection flow ─────────────
    // VFSDownloadFile: POST { client_id, accessor, components[] } → { flow_id }
    // After the flow completes, Velo stores the file; subsequent VFSStatDownload will have vfs_path.
    try {
        const triggerRes = await vproxy(req, '/api/v1/VFSDownloadFile', {
            method: 'POST',
            data: { client_id: clientId, accessor, components },
        });

        // Return flow_id to frontend so it can poll for completion
        res.status(202).json({
            status: 'collecting',
            message: 'File download collection started. Poll flow for completion.',
            flow_id: triggerRes?.flow_id || triggerRes?.session_id || null,
            client_id: clientId,
            path: vfsPath,
        });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message || 'VFS download failed' });
    }
});

/**
 * POST /api/vfs/:clientId/download — download VFS file (POST variant)
 */
exports.vfsDownloadFilePost = asyncHandler(async (req, res) => {
    // VFSDownloadFile starts a collection to download the file.
    // Body should include: { path, accessor? }
    const vfsPath = req.body.path || req.body.vfs_path || '/';
    const accessorMatch = vfsPath.match(/^([a-zA-Z]+):/);
    const accessor = req.body.accessor || (accessorMatch ? accessorMatch[1] : 'file');
    const components = vfsPath.replace(/^[a-zA-Z]+:\/?\/? ?/, '').split('/').filter(Boolean);
    const response = await vproxy(req, '/api/v1/VFSDownloadFile', {
        method: 'POST',
        data: { client_id: req.params.clientId, accessor, components },
    });
    res.json(response);
});

/**
 * POST /api/vfs/:clientId/refresh — refresh VFS directory listing
 * Velo: POST /api/v1/VFSRefreshDirectory
 */
exports.vfsRefreshDirectory = asyncHandler(async (req, res) => {
    // VFSRefreshDirectoryRequest proto: { client_id, vfs_components[], depth }
    const vfsPath = req.body.path || req.body.vfs_path || '/';
    const vfs_components = vfsPath.split('/').filter(Boolean);
    const depth = Number(req.body.depth) || 0;
    const response = await vproxy(req, '/api/v1/VFSRefreshDirectory', {
        method: 'POST',
        data: { client_id: req.params.clientId, vfs_components, depth },
    });
    res.json(response);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  NOTEBOOK MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/notebooks — list notebooks
 * Velo: GET /api/v1/GetNotebooks (requires notebook_id for specific; for listing, use count/offset)
 *
 * Velo 0.75+ requires notebook_id even for listing. We handle the 503 gracefully
 * and try a few strategies.
 */
exports.getNotebooks = asyncHandler(async (req, res) => {
    const cacheKey = `notebooks:${JSON.stringify(req.query || {})}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    try {
        // Try with count param
        const response = await vproxy(req, '/api/v1/GetNotebooks', {
            method: 'GET',
            params: { count: 100, offset: 0, ...req.query },
        });
        cacheSet(cacheKey, response, 15000);
        res.json(response);
    } catch (err) {
        // Velo 0.75+ returns 503 "NotebookId must be specified" — return empty
        const empty = { items: [], total: 0 };
        cacheSet(cacheKey, empty, 10000);
        res.json(empty);
    }
});

/**
 * GET /api/notebooks/:notebookId — get specific notebook
 * Velo: GET /api/v1/GetNotebooks?notebook_id=N.xxx
 */
exports.getNotebook = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetNotebooks', {
        method: 'GET',
        params: { notebook_id: req.params.notebookId },
    });
    res.json(response);
});

/**
 * POST /api/notebooks — create notebook
 * Velo: POST /api/v1/NewNotebook
 */
exports.createNotebook = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/NewNotebook', {
        method: 'POST', data: req.body,
    });
    res.status(201).json(response);
});

/**
 * PUT /api/notebooks/:notebookId — update notebook metadata
 * Velo: POST /api/v1/UpdateNotebook
 */
exports.updateNotebook = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/UpdateNotebook', {
        method: 'POST',
        data: { notebook_id: req.params.notebookId, ...req.body },
    });
    res.json(response);
});

/**
 * POST /api/notebooks/:notebookId/cells — update notebook cell
 * Velo: POST /api/v1/UpdateNotebookCell
 */
exports.updateNotebookCell = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/UpdateNotebookCell', {
        method: 'POST',
        data: { notebook_id: req.params.notebookId, ...req.body },
    });
    res.json(response);
});

/**
 * POST /api/notebooks/:notebookId/cells/new — add new cell
 * Velo: POST /api/v1/NewNotebookCell
 *
 * Normalises cell_type → type (Velo proto field is "type", not "cell_type")
 */
exports.newNotebookCell = asyncHandler(async (req, res) => {
    const body = req.body || {};
    // Ensure we send the proto-correct field name
    const type = body.type || body.cell_type || 'vql';
    const input = body.input || body.vql || '';
    const extra = Object.fromEntries(
        Object.entries(body).filter(([k]) => !['type', 'cell_type', 'input', 'vql'].includes(k))
    );
    const response = await vproxy(req, '/api/v1/NewNotebookCell', {
        method: 'POST',
        data: { notebook_id: req.params.notebookId, type, input, ...extra },
    });
    res.status(201).json(response);
});

/**
 * GET /api/notebooks/:notebookId/cells/:cellId — get cell content
 * Velo: GET /api/v1/GetNotebookCell?notebook_id=N.xxx&cell_id=C.xxx
 */
exports.getNotebookCell = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetNotebookCell', {
        method: 'GET',
        params: { notebook_id: req.params.notebookId, cell_id: req.params.cellId },
    });
    res.json(response);
});

/**
 * POST /api/notebooks/:notebookId/cells/:cellId/revert — revert cell
 * Velo: POST /api/v1/RevertNotebookCell
 */
exports.revertNotebookCell = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/RevertNotebookCell', {
        method: 'POST',
        data: { notebook_id: req.params.notebookId, cell_id: req.params.cellId },
    });
    res.json(response);
});

/**
 * POST /api/notebooks/:notebookId/cells/:cellId/cancel — cancel running cell
 * Velo: POST /api/v1/CancelNotebookCell
 */
exports.cancelNotebookCell = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/CancelNotebookCell', {
        method: 'POST',
        data: { notebook_id: req.params.notebookId, cell_id: req.params.cellId },
    });
    res.json(response);
});

/**
 * DELETE /api/notebooks/:notebookId — delete notebook
 * Velo: POST /api/v1/DeleteNotebook
 */
exports.deleteNotebook = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/DeleteNotebook', {
        method: 'POST',
        data: { notebook_id: req.params.notebookId },
    });
    res.json(response);
});

/**
 * GET /api/notebooks/:notebookId/export — export notebook
 * Velo: POST /api/v1/CreateNotebookDownloadFile (yes, it's POST)
 */
exports.exportNotebook = asyncHandler(async (req, res) => {
    try {
        const response = await vproxy(req, '/api/v1/CreateNotebookDownloadFile', {
            method: 'POST',
            data: { notebook_id: req.params.notebookId, type: req.query.type || 'html' },
        });
        res.json(response);
    } catch (error) {
        if (error.status === 404) return res.json({ error: 'Export not available' });
        safeThrow(error);
    }
});

/**
 * POST /api/notebooks/:notebookId/download — create notebook download file
 * Velo: POST /api/v1/CreateNotebookDownloadFile
 */
exports.createNotebookDownloadFile = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/CreateNotebookDownloadFile', {
        method: 'POST',
        data: { notebook_id: req.params.notebookId, ...req.body },
    });
    res.json(response);
});

/**
 * POST /api/notebooks/:notebookId/attachment — upload attachment
 * Velo: POST /api/v1/UploadNotebookAttachment
 */
exports.uploadNotebookAttachment = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/UploadNotebookAttachment', {
        method: 'POST',
        data: { notebook_id: req.params.notebookId, ...req.body },
    });
    res.json(response);
});

/**
 * DELETE /api/notebooks/:notebookId/attachment — remove attachment
 * Velo: POST /api/v1/RemoveNotebookAttachment
 */
exports.removeNotebookAttachment = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/RemoveNotebookAttachment', {
        method: 'POST',
        data: { notebook_id: req.params.notebookId, ...req.body },
    });
    res.json(response);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  VQL QUERY & COMPLETIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/query — execute VQL query
 * Velo: /api/v1/Query is a gRPC streaming endpoint — NOT available via REST!
 *
 * Strategy: Create a temporary notebook, add a VQL cell, return the cell output.
 * This is how the Velo GUI itself works for ad-hoc queries.
 *
 * cell_id lives in cell.cell_id (0.75.x) or cell.cell_metadata.cell_id (0.74.x).
 */
exports.executeQuery = asyncHandler(async (req, res) => {
    const raw = req.body || {};
    const queries = raw.Query || raw.query || raw.queries || [];
    const vqlArray = Array.isArray(queries)
        ? queries.map(q => q.VQL || q.vql || String(q))
        : [String(queries)];
    const vql = vqlArray.join('\n');

    if (!vql.trim()) {
        return res.status(400).json({ error: 'No VQL query provided' });
    }

    try {
        // Create a temporary notebook for this query
        const nb = await vproxy(req, '/api/v1/NewNotebook', {
            method: 'POST',
            data: { name: 'VQL Query ' + Date.now(), description: 'Auto-generated query notebook' },
        });

        if (!nb?.notebook_id) {
            return res.status(503).json({
                error: 'Failed to create query notebook',
                code: 'VQL_NOTEBOOK_FAILED',
            });
        }

        // Add a VQL cell (field name MUST be "type", not "cell_type")
        const cell = await vproxy(req, '/api/v1/NewNotebookCell', {
            method: 'POST',
            data: {
                notebook_id: nb.notebook_id,
                type: 'vql',
                input: vql,
            },
        });

        // cell_id can live at different depths depending on Velo version
        const cellId = cell?.cell_id || cell?.cell_metadata?.cell_id ||
                       cell?.metadata?.cell_id || null;

        // Wait for cell execution (VQL on notebook cells is async)
        const waitMs = raw.MaxWait ? Math.min(parseInt(raw.MaxWait) * 1000, 15000) : 3500;
        await new Promise(r => setTimeout(r, waitMs));

        // Fetch cell result
        if (cellId) {
            try {
                const cellResult = await vproxy(req, '/api/v1/GetNotebookCell', {
                    method: 'GET',
                    params: { notebook_id: nb.notebook_id, cell_id: cellId },
                });
                return res.json({
                    notebook_id: nb.notebook_id,
                    cell_id: cellId,
                    output: cellResult?.output || cellResult?.data || '',
                    calculating: cellResult?.calculating || false,
                    result: cellResult,
                });
            } catch {
                return res.json({
                    notebook_id: nb.notebook_id,
                    cell_id: cellId,
                    calculating: true,
                    message: 'Query submitted, results may still be processing',
                });
            }
        }

        return res.json({
            notebook_id: nb.notebook_id,
            cell: cell,
            message: 'Query submitted via notebook',
        });
    } catch (err) {
        return res.status(503).json({
            error: 'VQL execution via notebook failed: ' + (err.message || 'unknown error'),
            code: 'VQL_NOT_AVAILABLE',
        });
    }
});

/**
 * POST /api/vql/reformat — reformat VQL query
 * Velo: POST /api/v1/ReformatVQL
 */
exports.reformatVQL = asyncHandler(async (req, res) => {
    const body = req.body || {};
    const data = { vql: body.vql || body.query || '' };
    const response = await vproxy(req, '/api/v1/ReformatVQL', {
        method: 'POST', data,
    });
    res.json(response);
});

/**
 * GET /api/completions — VQL keyword completions
 * Velo: GET /api/v1/GetKeywordCompletions
 */
exports.getCompletions = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetKeywordCompletions', {
        method: 'GET', params: req.query,
    });
    res.json(response);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SEARCH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/search — search for clients/indicators
 * Velo: GET /api/v1/SearchClients (always GET)
 */
exports.searchIndicators = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/SearchClients', {
        method: 'GET',
        params: {
            query: req.body?.query || req.query?.query || 'all',
            count: req.body?.limit || req.query?.count || 50,
            offset: 0,
        },
    });
    res.json(response);
});

/**
 * POST /api/file-search — search files on client
 * Velo: POST /api/v1/SearchFile
 */
exports.searchFile = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/SearchFile', {
        method: 'POST', data: req.body,
    });
    res.json(response);
});

/**
 * GET /api/docs/search — search documentation
 * Velo: GET /api/v1/SearchDocs
 */
exports.searchDocs = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/SearchDocs', {
        method: 'GET', params: req.query,
    });
    res.json(response);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SERVER MONITORING & METRICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/server/metrics — server metrics/monitoring state
 * Velo: GET /api/v1/GetServerMonitoringState
 */
exports.getServerMetrics = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetServerMonitoringState', {
        method: 'GET', params: req.query,
    });
    res.json(response);
});

/**
 * GET /api/server/metadata — server metadata
 * Velo: No direct endpoint; synthesize from GetServerMonitoringState + GetUserUITraits
 */
exports.getServerMetadata = asyncHandler(async (req, res) => {
    try {
        const traits = await vproxy(req, '/api/v1/GetUserUITraits', { method: 'GET' });
        res.json({
            version: traits?.interface_traits?.version || '',
            orgs: traits?.orgs || [],
            user_type: traits?.user_type || '',
        });
    } catch (error) {
        if (error.status === 404) return res.json({});
        safeThrow(error);
    }
});

/**
 * GET /api/server/monitoring — get server monitoring state
 * Velo: GET /api/v1/GetServerMonitoringState
 */
exports.getServerMonitoring = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetServerMonitoringState', { method: 'GET' });
    res.json(response);
});

/**
 * POST /api/server/monitoring — set server monitoring state
 * Velo: POST /api/v1/SetServerMonitoringState
 */
exports.setServerMonitoring = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/SetServerMonitoringState', {
        method: 'POST', data: req.body,
    });
    res.json(response);
});

/**
 * POST /api/server/events — query server events
 * Velo: Uses GetTable with type=SERVER_EVENT or CLIENT_EVENT.
 *
 * Accepts: { artifact, client_id (optional), start_time, end_time, rows (optional) }
 * If no artifact is specified, lists available server event artifacts.
 */
exports.queryServerEvents = asyncHandler(async (req, res) => {
    const { artifact, client_id, start_time, end_time, rows } = req.body || {};

    // If no artifact specified, return available server event artifacts
    if (!artifact) {
        try {
            const available = await vproxy(req, '/api/v1/ListAvailableEventResults', {
                method: 'POST',
                data: { client_id: client_id || 'server' },
            });
            const logs = available?.logs || [];
            return res.json({ items: logs, logs, total: logs.length });
        } catch (err) {
            if (err.status === 404 || err.status === 501) {
                return res.json({ items: [], logs: [], total: 0 });
            }
            safeThrow(err);
        }
    }

    // Query specific server event artifact via GetTable
    try {
        const params = {
            type: client_id ? 'CLIENT_EVENT' : 'SERVER_EVENT',
            artifact,
        };
        if (client_id) params.client_id = client_id;
        if (start_time) params.start_time = start_time;
        if (end_time) params.end_time = end_time;
        if (rows) params.rows = rows;

        const response = await vproxy(req, '/api/v1/GetTable', {
            method: 'GET',
            params,
        });
        res.json(parseVeloTable(response));
    } catch (error) {
        if (error.status === 404) {
            return res.json({ items: [], total: 0, error: 'Event artifact not found' });
        }
        safeThrow(error);
    }
});

/**
 * GET /api/server/client-monitoring — get client monitoring state
 * Velo: GET /api/v1/GetClientMonitoringState
 */
exports.getClientMonitoring = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetClientMonitoringState', { method: 'GET' });
    res.json(response);
});

/**
 * POST /api/server/client-monitoring — set client monitoring state
 * Velo: POST /api/v1/SetClientMonitoringState
 */
exports.setClientMonitoring = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/SetClientMonitoringState', {
        method: 'POST', data: req.body,
    });
    res.json(response);
});

/**
 * POST /api/server/client-config — generate client configuration
 * Velo: POST /api/v1/GetClientConfig (not confirmed in gRPC-gateway — may not exist)
 */
exports.generateClientConfig = asyncHandler(async (req, res) => {
    try {
        const response = await vproxy(req, '/api/v1/GetClientConfig', {
            method: 'POST', data: req.body,
        });
        res.json(response);
    } catch (error) {
        if (error.status === 404) return res.json({ error: 'Not available' });
        safeThrow(error);
    }
});

/**
 * POST /api/server/create-download — create client installer download
 * Velo: POST /api/v1/CreateDownload
 */
exports.createDownloadFile = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/CreateDownload', {
        method: 'POST', data: req.body,
    });
    res.json(response);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/users — list users
 * Velo: GET /api/v1/GetUsers
 */
exports.getUsers = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetUsers', { method: 'GET' });
    // Normalize: Velo returns { users: [...] }, frontend expects { items: [...] }
    // Velociraptor nests roles inside orgs[{id, roles[]}] — flatten to top-level roles[]
    const rawUsers = response?.users || response?.items || [];
    const items = rawUsers.map(u => ({
        ...u,
        roles: (u.roles && u.roles.length)
            ? u.roles
            : (u.orgs || []).flatMap(o => o.roles || []),
    }));
    res.json({ ...response, items, users: items, total: items.length });
});

/**
 * GET /api/users/global — list global users (cross-org)
 * Velo: GET /api/v1/GetGlobalUsers
 */
exports.getGlobalUsers = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetGlobalUsers', { method: 'GET' });
    res.json(response);
});

/**
 * GET /api/users/:username — get user
 * Velo: GET /api/v1/GetUser/{name}  (path param!)
 */
exports.getUser = asyncHandler(async (req, res) => {
    const response = await vproxy(req, `/api/v1/GetUser/${encodeURIComponent(req.params.username)}`, {
        method: 'GET',
    });
    res.json(response);
});

/**
 * GET /api/users/me/traits — current user UI traits
 * Velo: GET /api/v1/GetUserUITraits
 * Also merges in the per-user configured server URL so the Settings view can read it.
 */
exports.getUserUITraits = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetUserUITraits', { method: 'GET' });
    // Attach the currently-configured server URL so the frontend can display it
    res.json({
        ...response,
        interface: req.veloServerUrl || process.env.VELO_API_BASE_URL || '',
        _configured_server_url: req.veloServerUrl || '',
    });
});

/**
 * GET /api/users/me/favorites — current user favorites
 * Velo: GET /api/v1/GetUserFavorites
 */
exports.getUserFavorites = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetUserFavorites', { method: 'GET' });
    res.json(response);
});

/**
 * POST /api/users/me/gui-options — set GUI options
 * Velo: POST /api/v1/SetGUIOptions
 */
exports.setGUIOptions = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/SetGUIOptions', {
        method: 'POST', data: req.body,
    });
    res.json(response);
});

/**
 * POST /api/users — create/update user
 * Velo: POST /api/v1/CreateUser
 *
 * UpdateUserRequest proto: { name, password, orgs[], roles[], add_new_user }
 * add_new_user MUST be true when creating a brand-new user; otherwise Velo
 * only adds an already-existing user into the org and silently ignores the password.
 */
exports.setUser = asyncHandler(async (req, res) => {
    const body = req.body || {};
    // Normalise field names: frontend may send 'username', proto expects 'name'
    const data = {
        name:         body.name || body.username || '',
        password:     body.password || '',
        orgs:         body.orgs || [],
        roles:        body.roles || [],
        add_new_user: body.add_new_user !== false, // default true — always try to create
    };
    const response = await vproxy(req, '/api/v1/CreateUser', {
        method: 'POST', data,
    });
    // Explicitly set password (CreateUser may ignore it in some Velo versions)
    if (data.password && data.name) {
        try {
            await vproxy(req, '/api/v1/SetPassword', {
                method: 'POST',
                data: { username: data.name, password: data.password },
            });
        } catch (_) { /* non-fatal */ }
    }
    // Explicitly assign roles via SetUserRoles (CreateUser often ignores the roles field)
    if (data.roles && data.roles.length > 0 && data.name) {
        try {
            await vproxy(req, '/api/v1/SetUserRoles', {
                method: 'POST',
                data: { name: data.name, org: req.veloOrgId || '', roles: data.roles },
            });
        } catch (_) { /* non-fatal */ }
    }
    // Also create the user in PostgreSQL so they can log into this app.
    // The login flow authenticates against Velociraptor then looks up the user
    // in PostgreSQL — without a local record the new user cannot log in.
    if (data.add_new_user && data.name) {
        try {
            await createLocalUser({
                username:   data.name,
                password:   data.password,
                veloRoles:  data.roles || [],
                orgId:      req.veloOrgId || '',
                serverUrl:  req.veloServerUrl || '',
            });
        } catch (localErr) {
            // Non-fatal: Velo user created successfully; log the local failure but
            // don't reject the request (user can still register via the login page).
            logger.warn('setUser: failed to create local PostgreSQL record', {
                username: data.name, error: localErr.message,
            });
        }
    }
    res.json(response || { success: true, name: data.name });
});

/**
 * DELETE /api/users/:username — delete user
 * Velo: DeleteUser endpoint doesn't exist. Use SetUserRoles with empty array to revoke all access.
 */
exports.deleteUser = asyncHandler(async (req, res) => {
    // No DeleteUser endpoint in Velociraptor gRPC-gateway.
    // Use SetUserRoles with empty roles array to revoke all access (deactivate).
    // Proto: SetUserRoles(UserRoles) → Empty  /  UserRoles: { name, org, roles[] }
    try {
        await vproxy(req, '/api/v1/SetUserRoles', {
            method: 'POST',
            data: {
                name:  req.params.username,
                org:   req.veloOrgId || '',
                roles: [],   // strip all roles
            },
        });
        res.json({ success: true, status: 'deactivated', username: req.params.username });
    } catch (error) {
        if (error.status === 404) {
            return res.json({ success: true, status: 'not_found', username: req.params.username });
        }
        safeThrow(error);
    }
});

/**
 * POST /api/users/:username/password — set user password
 * Velo: POST /api/v1/SetPassword
 */
exports.setUserPassword = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/SetPassword', {
        method: 'POST',
        data: { username: req.params.username, password: req.body.password },
    });
    res.json(response);
});

/**
 * GET /api/users/:username/roles — get user roles
 * Velo: GET /api/v1/GetUserRoles?name=xxx
 */
exports.getUserRoles = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetUserRoles', {
        method: 'GET',
        params: { name: req.params.username },
    });
    res.json(response);
});

/**
 * POST /api/users/:username/roles — set user roles
 * Velo: POST /api/v1/SetUserRoles
 */
exports.setUserRoles = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/SetUserRoles', {
        method: 'POST',
        data: { name: req.params.username, ...req.body },
    });
    res.json(response);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/events/available — list available event results
 * Velo: POST /api/v1/ListAvailableEventResults (POST, not GET!)
 *
 * Velo returns { logs: [{artifact: "...", client_id: "..."}] }
 * Normalise to { items, logs, total } for frontend consistency.
 */
exports.listAvailableEventResults = asyncHandler(async (req, res) => {
    try {
        const clientId = req.query.client_id || req.body?.client_id || '';
        const response = await vproxy(req, '/api/v1/ListAvailableEventResults', {
            method: 'POST',
            data: { client_id: clientId },
        });
        // Normalise: Velo returns { logs: [...] }, frontend expects { items: [...] }
        const logs = response?.logs || [];
        res.json({ items: logs, logs, total: logs.length, ...response });
    } catch (err) {
        if (err.status === 501 || err.status === 404) {
            return res.json({ items: [], logs: [], total: 0 });
        }
        safeThrow(err);
    }
});

/**
 * POST /api/events/push — push events to monitoring
 * Velo: POST /api/v1/PushEvents (may not exist in REST; handle gracefully)
 */
exports.pushEvents = asyncHandler(async (req, res) => {
    try {
        const response = await vproxy(req, '/api/v1/PushEvents', {
            method: 'POST', data: req.body,
        });
        res.json(response);
    } catch (error) {
        if (error.status === 404) return res.json({ status: 'not_available' });
        safeThrow(error);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DOWNLOADS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/downloads — create download
 * Velo: POST /api/v1/CreateDownload
 */
exports.createDownload = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/CreateDownload', {
        method: 'POST', data: req.body,
    });
    res.status(201).json(response);
});

/**
 * GET /api/downloads/:downloadId — get download status
 * Velo: No direct GET endpoint; use GetTable or the /downloads/ file-serving endpoint
 */
exports.getDownload = asyncHandler(async (req, res) => {
    try {
        const response = await vproxy(req, '/api/v1/GetTable', {
            method: 'GET',
            params: { type: 'DOWNLOADS', download_id: req.params.downloadId },
        });
        res.json(parseVeloTable(response));
    } catch (error) {
        if (error.status === 404) return res.json({ status: 'not_found' });
        safeThrow(error);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  TOOLS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/tools — list tools
 * Velo: GET /api/v1/GetToolInfo (per-tool endpoint)
 * For listing all tools, we fetch artifact definitions that reference tools.
 * Alternatively, the inventory is embedded in monitoring state.
 */
exports.getTools = asyncHandler(async (req, res) => {
    const cacheKey = 'tools:all';
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    try {
        // Try GetToolInfo without params — some Velo versions list all tools
        const response = await vproxy(req, '/api/v1/GetToolInfo', {
            method: 'GET', params: req.query,
        });
        cacheSet(cacheKey, response, 30000);
        res.json(response);
    } catch (error) {
        // GetToolInfo may need a name param; synthesize empty list
        if (error.status === 503 || error.status === 404) {
            const empty = { items: [], total: 0 };
            cacheSet(cacheKey, empty, 10000);
            return res.json(empty);
        }
        safeThrow(error);
    }
});

/**
 * POST /api/tools — set tool info
 * Velo: POST /api/v1/SetToolInfo
 */
exports.setToolInfo = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/SetToolInfo', {
        method: 'POST', data: req.body,
    });
    res.json(response);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SECRETS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/secrets — list secret definitions
 * Velo: GET /api/v1/GetSecretDefinitions
 */
exports.getSecrets = asyncHandler(async (req, res) => {
    const cacheKey = 'secrets:definitions';
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const response = await vproxy(req, '/api/v1/GetSecretDefinitions', {
        method: 'GET',
    });
    cacheSet(cacheKey, response, 30000);
    res.json(response);
});

/**
 * GET /api/secrets/:type — get secret
 * Velo: GET /api/v1/GetSecret?type_name=xxx
 */
exports.getSecret = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetSecret', {
        method: 'GET',
        params: { type_name: req.params.type, name: req.query.name },
    });
    res.json(response);
});

/**
 * POST /api/secrets — define secret
 * Velo: POST /api/v1/DefineSecret (may not exist; try AddSecret)
 */
exports.defineSecret = asyncHandler(async (req, res) => {
    try {
        const response = await vproxy(req, '/api/v1/DefineSecret', {
            method: 'POST', data: req.body,
        });
        res.json(response);
    } catch (error) {
        if (error.status === 404) {
            // Try AddSecret as fallback
            const response = await vproxy(req, '/api/v1/AddSecret', {
                method: 'POST', data: req.body,
            });
            return res.json(response);
        }
        safeThrow(error);
    }
});

/**
 * POST /api/secrets/:type/add — add secret
 * Velo: POST /api/v1/AddSecret
 */
exports.addSecret = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/AddSecret', {
        method: 'POST',
        data: { type_name: req.params.type, ...req.body },
    });
    res.json(response);
});

/**
 * PUT /api/secrets/:type — modify secret
 * Velo: POST /api/v1/ModifySecret
 */
exports.modifySecret = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/ModifySecret', {
        method: 'POST',
        data: { type_name: req.params.type, ...req.body },
    });
    res.json(response);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  TIMELINES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/timelines — read timeline
 * Velo: POST /api/v1/ReadTimeline
 */
exports.getTimeline = asyncHandler(async (req, res) => {
    try {
        const response = await vproxy(req, '/api/v1/ReadTimeline', {
            method: 'POST', data: req.body,
        });
        res.json(response);
    } catch (error) {
        if (error.status === 404) return res.json({ items: [], total: 0 });
        safeThrow(error);
    }
});

/**
 * POST /api/timelines/annotate — annotate timeline
 * Velo: POST /api/v1/AnnotateTimeline
 */
exports.annotateTimeline = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/AnnotateTimeline', {
        method: 'POST', data: req.body,
    });
    res.json(response);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  TABLES & REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/table — get any table data
 * Velo: GET /api/v1/GetTable?type=...&client_id=...
 */
exports.getTable = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetTable', {
        method: 'GET', params: req.query,
    });
    res.json(parseVeloTable(response));
});

/**
 * POST /api/table/download — download table as CSV/JSON
 * Velo: GET /api/v1/DownloadTable (custom handler, not gRPC-gateway)
 */
exports.downloadTable = asyncHandler(async (req, res) => {
    try {
        const response = await vproxy(req, '/api/v1/DownloadTable', {
            method: 'GET', params: req.body,
        });
        res.json(response);
    } catch (error) {
        if (error.status === 404) return res.json({ error: 'Download not available' });
        safeThrow(error);
    }
});

/**
 * POST /api/reports/generate — generate report
 * Velo: POST /api/v1/GetReport
 */
exports.getReport = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/GetReport', {
        method: 'POST', data: req.body,
    });
    res.json(response);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  UPLOADS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/uploads/tool — upload tool binary
 * Velo: POST /api/v1/UploadTool (custom handler)
 */
exports.uploadTool = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/UploadTool', {
        method: 'POST', data: req.body,
    });
    res.json(response);
});

/**
 * POST /api/uploads/file — upload form file
 * Velo: POST /api/v1/UploadFormFile (custom handler)
 */
exports.uploadFormFile = asyncHandler(async (req, res) => {
    const response = await vproxy(req, '/api/v1/UploadFormFile', {
        method: 'POST', data: req.body,
    });
    res.json(response);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/health/velo — check Velociraptor connectivity
 */
exports.healthCheck = asyncHandler(async (req, res) => {
    try {
        const response = await vproxy(req, '/api/v1/GetServerMonitoringState', { method: 'GET' });
        res.json({ status: 'ok', velo: 'connected' });
    } catch (error) {
        res.json({ status: 'degraded', error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  HOST QUARANTINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/clients/:clientId/quarantine — quarantine or unquarantine a host
 * Uses CollectArtifact to schedule the appropriate quarantine artifact.
 *
 * Body: { action: 'quarantine' | 'unquarantine', message?: string }
 *
 * Artifacts used:
 *   Windows: Windows.Remediation.Quarantine
 *   Linux:   Linux.Remediation.Quarantine
 *   macOS:   MacOS.Remediation.Quarantine
 */
exports.quarantineClient = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const { action = 'quarantine', message = '' } = req.body || {};

    if (!['quarantine', 'unquarantine'].includes(action)) {
        return res.status(400).json({ error: 'action must be "quarantine" or "unquarantine"' });
    }

    // Determine client OS to pick the right artifact
    let os = 'windows';
    try {
        // GetClient uses path param: GET /api/v1/GetClient/{client_id}
        const clientInfo = await vproxy(req, `/api/v1/GetClient/${encodeURIComponent(clientId)}`, {
            method: 'GET',
        });
        const osInfo = (clientInfo?.os_info?.system || clientInfo?.system || '').toLowerCase();
        if (osInfo.includes('linux')) os = 'linux';
        else if (osInfo.includes('darwin') || osInfo.includes('macos')) os = 'macos';
    } catch (e) {
        // Default to Windows if can't determine OS
    }

    const artifactMap = {
        windows: 'Windows.Remediation.Quarantine',
        linux:   'Linux.Remediation.Quarantine',
        macos:   'MacOS.Remediation.Quarantine',
    };

    const artifactName = artifactMap[os];
    const params = {
        MessageBox: message || (action === 'quarantine'
            ? 'This host has been quarantined by the security team.'
            : ''),
    };

    if (action === 'unquarantine') {
        params.RemovePolicy = 'Y';
    }

    const collectPayload = {
        client_id: clientId,
        artifacts: [artifactName],
        specs: [{
            artifact: artifactName,
            parameters: { env: Object.entries(params).map(([key, value]) => ({ key, value: String(value) })) },
        }],
    };

    const response = await vproxy(req, '/api/v1/CollectArtifact', {
        method: 'POST',
        data: collectPayload,
    });

    res.status(201).json({
        message: `Host ${action} initiated`,
        flow_id: response?.flow_id || response?.session_id || null,
        client_id: clientId,
        artifact: artifactName,
        action,
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  INTERACTIVE SHELL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/clients/:clientId/shell — execute shell command on a client
 * Uses CollectArtifact with Generic.Client.Shell or custom command artifact.
 *
 * Body: { command: string, shell_type?: 'powershell' | 'cmd' | 'bash' }
 *
 * Returns the flow_id. Poll /api/flows/:flowId/results for output.
 */
exports.executeShell = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const { command, shell_type = 'powershell' } = req.body || {};

    if (!command || !command.trim()) {
        return res.status(400).json({ error: 'command is required' });
    }

    // Determine artifact based on shell type
    let artifactName, paramKey;
    switch (shell_type) {
        case 'cmd':
            artifactName = 'Windows.System.CmdShell';
            paramKey = 'Command';
            break;
        case 'bash':
            artifactName = 'Linux.Sys.BashShell';
            paramKey = 'Command';
            break;
        case 'powershell':
        default:
            artifactName = 'Windows.System.PowerShell';
            paramKey = 'Command';
    }

    // Fallback to Generic.Client.Shell which works cross-platform
    artifactName = 'Generic.Client.Shell';

    const collectPayload = {
        client_id: clientId,
        artifacts: [artifactName],
        specs: [{
            artifact: artifactName,
            parameters: {
                env: [
                    { key: 'Command', value: command },
                    { key: 'PowerShell', value: shell_type === 'powershell' ? command : '' },
                ],
            },
        }],
    };

    const response = await vproxy(req, '/api/v1/CollectArtifact', {
        method: 'POST',
        data: collectPayload,
    });

    res.status(201).json({
        message: 'Shell command submitted',
        flow_id: response?.flow_id || response?.session_id || null,
        client_id: clientId,
        artifact: artifactName,
    });
});

/**
 * GET /api/clients/:clientId/shell/:flowId — get shell command results
 * Polls the flow results until complete.
 */
exports.getShellResults = asyncHandler(async (req, res) => {
    const { clientId, flowId } = req.params;

    // Check flow status
    const flow = await vproxy(req, '/api/v1/GetFlowDetails', {
        method: 'GET',
        params: { client_id: clientId, flow_id: flowId },
    });

    const context = flow?.context || flow;
    const state = context?.state || 'RUNNING';

    // Get results if available
    let results = { items: [], total: 0 };
    if (state === 'FINISHED' || state === 'ERROR') {
        try {
            const tableResponse = await vproxy(req, '/api/v1/GetTable', {
                method: 'GET',
                params: {
                    type: 'COLLECTION',
                    client_id: clientId,
                    flow_id: flowId,
                    artifact: 'Generic.Client.Shell',
                },
            });
            results = parseVeloTable(tableResponse);
        } catch (e) {
            // Results may not be ready yet
        }
    }

    res.json({
        flow_id: flowId,
        client_id: clientId,
        state,
        results: results.items,
        total: results.total,
    });
});

module.exports = exports;

