/**
 * SSE (Server-Sent Events) Routes
 *
 * Provides real-time event streaming and VQL query streaming endpoints.
 */
'use strict';

const express = require('express');
const { authenticateJWT } = require('../middleware/auth');
const { requireReader, requireAnalyst } = require('../middleware/rbac');
const { injectVeloCredentials } = require('../middleware/veloCredentials');
const { asyncHandler } = require('../middleware/errorHandler');
const sseManager = require('../services/sse.manager');
const veloApi = require('../config/velo-api');
const logger = require('../utils/logger');

const router = express.Router();

// All SSE routes require authentication
router.use(authenticateJWT);

/**
 * GET /api/sse/events — subscribe to real-time event stream
 *
 * Query params:
 *   channels - comma-separated list of channels to subscribe to
 *              (client-status, hunt-progress, flow-status, server-events, notifications)
 */
router.get('/events', requireReader, (req, res) => {
    const channelParam = req.query.channels || 'notifications';
    const channels = channelParam.split(',').map(c => c.trim()).filter(Boolean);

    // Validate channel names
    const validChannels = ['client-status', 'hunt-progress', 'flow-status', 'server-events', 'notifications'];
    const filteredChannels = channels.filter(c => validChannels.includes(c));

    if (filteredChannels.length === 0) {
        filteredChannels.push('notifications');
    }

    // Connect SSE
    sseManager.addClient(res, req.user.userId, filteredChannels);

    // Don't close the response — SSE keeps it open
});

/**
 * GET /api/sse/stats — get SSE connection statistics
 */
router.get('/stats', requireReader, (req, res) => {
    res.json(sseManager.getStats());
});

/**
 * POST /api/sse/vql-stream — stream VQL query results via SSE
 *
 * Body: { vql: string }
 *
 * Streams results as they arrive from a notebook cell execution.
 * Each event: { type: 'row' | 'status' | 'error' | 'complete', data: ... }
 */
router.post('/vql-stream', requireAnalyst, injectVeloCredentials, asyncHandler(async (req, res) => {
    const { vql } = req.body || {};

    if (!vql || !vql.trim()) {
        return res.status(400).json({ error: 'vql is required' });
    }

    // Set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    const sendEvent = (event, data) => {
        try {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        } catch (e) {
            // Connection closed
        }
    };

    sendEvent('status', { message: 'Creating query notebook...' });

    try {
        const vproxy = (endpoint, opts) => veloApi.proxyRequest(endpoint, {
            orgId: req.veloOrgId || '',
            serverUrl: req.veloServerUrl || '',
            verifySsl: req.veloVerifySsl !== false,
            ...opts,
            auth: req.veloAuth,
        });

        // Create temporary notebook
        const nb = await vproxy('/api/v1/NewNotebook', {
            method: 'POST',
            data: { name: 'VQL Stream ' + Date.now(), description: 'Streaming query' },
        });

        if (!nb?.notebook_id) {
            sendEvent('error', { message: 'Failed to create notebook' });
            return res.end();
        }

        sendEvent('status', { message: 'Executing VQL...', notebook_id: nb.notebook_id });

        // Add VQL cell
        const cell = await vproxy('/api/v1/NewNotebookCell', {
            method: 'POST',
            data: { notebook_id: nb.notebook_id, type: 'vql', input: vql },
        });

        const cellId = cell?.cell_id || cell?.cell_metadata?.cell_id || cell?.metadata?.cell_id;

        if (!cellId) {
            sendEvent('error', { message: 'Failed to create VQL cell' });
            return res.end();
        }

        // Poll for results
        let attempts = 0;
        const maxAttempts = 60; // 60 * 2s = 2 min max
        let lastRowCount = 0;

        const pollInterval = setInterval(async () => {
            try {
                attempts++;

                const cellData = await vproxy('/api/v1/GetNotebookCell', {
                    method: 'GET',
                    params: { notebook_id: nb.notebook_id, cell_id: cellId },
                });

                const output = cellData?.output || '';
                const calculating = cellData?.calculating || false;

                // Try to parse table results
                if (cellData?.data) {
                    try {
                        const rows = JSON.parse(cellData.data);
                        if (Array.isArray(rows) && rows.length > lastRowCount) {
                            for (let i = lastRowCount; i < rows.length; i++) {
                                sendEvent('row', rows[i]);
                            }
                            lastRowCount = rows.length;
                        }
                    } catch (e) {
                        // Not JSON — might be HTML output
                    }
                }

                sendEvent('progress', {
                    calculating,
                    attempt: attempts,
                    rows: lastRowCount,
                });

                if (!calculating || attempts >= maxAttempts) {
                    clearInterval(pollInterval);

                    // Final fetch of complete results
                    try {
                        const tableData = await vproxy('/api/v1/GetTable', {
                            method: 'GET',
                            params: {
                                notebook_id: nb.notebook_id,
                                cell_id: cellId,
                                type: 'NOTEBOOK',
                            },
                        });

                        if (tableData?.columns && tableData?.rows) {
                            const cols = tableData.columns;
                            for (const row of (tableData.rows || [])) {
                                try {
                                    const vals = JSON.parse(row.json);
                                    const obj = {};
                                    cols.forEach((col, i) => { obj[col] = vals[i]; });
                                    sendEvent('row', obj);
                                } catch (e) {
                                    // Skip malformed rows
                                }
                            }
                        }
                    } catch (e) {
                        logger.debug('VQL stream table fetch failed:', e.message);
                    }

                    sendEvent('complete', {
                        total_rows: lastRowCount,
                        timed_out: attempts >= maxAttempts,
                    });

                    res.end();

                    // Cleanup: delete temporary notebook (non-blocking)
                    vproxy('/api/v1/DeleteNotebook', {
                        method: 'POST',
                        data: { notebook_id: nb.notebook_id },
                    }).catch(() => {});
                }
            } catch (err) {
                sendEvent('error', { message: err.message });
                clearInterval(pollInterval);
                res.end();
            }
        }, 2000);

        // Cleanup on client disconnect
        req.on('close', () => {
            clearInterval(pollInterval);
        });

    } catch (err) {
        sendEvent('error', { message: err.message });
        res.end();
    }
}));

module.exports = router;
