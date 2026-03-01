/**
 * Server-Sent Events (SSE) Manager
 *
 * Provides real-time push notifications to connected clients using SSE.
 * No additional dependencies required — uses native Node.js HTTP streams.
 *
 * Channels:
 *   - client-status:  Client online/offline/last-seen changes
 *   - hunt-progress:  Hunt completion progress updates
 *   - flow-status:    Flow state changes
 *   - server-events:  Server monitoring alerts
 *   - notifications:  General user notifications
 */
'use strict';

const logger = require('../utils/logger');

class SSEManager {
    constructor() {
        /** @type {Map<string, Set<{res: Response, userId: string, channels: Set<string>}>>} */
        this.clients = new Map(); // channel → Set of client connections
        this.clientCount = 0;
    }

    /**
     * Register a new SSE connection.
     * @param {Response} res - Express response object
     * @param {string} userId - Authenticated user ID
     * @param {string[]} channels - Channels to subscribe to
     * @returns {Function} Cleanup function to call on disconnect
     */
    addClient(res, userId, channels = ['notifications']) {
        // Set SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable nginx buffering
        });

        // Send initial connection event
        res.write(`event: connected\ndata: ${JSON.stringify({ channels, timestamp: Date.now() })}\n\n`);

        const client = { res, userId, channels: new Set(channels) };

        // Register on each channel
        for (const channel of channels) {
            if (!this.clients.has(channel)) {
                this.clients.set(channel, new Set());
            }
            this.clients.get(channel).add(client);
        }

        this.clientCount++;
        logger.debug(`SSE client connected (${this.clientCount} total)`, { userId, channels });

        // Keep-alive ping every 30s
        const keepAlive = setInterval(() => {
            try {
                res.write(': ping\n\n');
            } catch (e) {
                clearInterval(keepAlive);
            }
        }, 30000);

        // Cleanup on disconnect
        const cleanup = () => {
            clearInterval(keepAlive);
            for (const channel of client.channels) {
                const channelClients = this.clients.get(channel);
                if (channelClients) {
                    channelClients.delete(client);
                    if (channelClients.size === 0) {
                        this.clients.delete(channel);
                    }
                }
            }
            this.clientCount--;
            logger.debug(`SSE client disconnected (${this.clientCount} total)`, { userId });
        };

        res.on('close', cleanup);
        return cleanup;
    }

    /**
     * Broadcast an event to all subscribers of a channel.
     * @param {string} channel - Channel name
     * @param {string} event - Event type
     * @param {Object} data - Event data
     * @param {string} [targetUserId] - If set, only send to this user
     */
    broadcast(channel, event, data, targetUserId = null) {
        const channelClients = this.clients.get(channel);
        if (!channelClients || channelClients.size === 0) return;

        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        let sent = 0;

        for (const client of channelClients) {
            if (targetUserId && client.userId !== targetUserId) continue;
            try {
                client.res.write(payload);
                sent++;
            } catch (e) {
                // Connection broken — will be cleaned up by close handler
            }
        }

        logger.debug(`SSE broadcast: ${channel}/${event} → ${sent} clients`);
    }

    /**
     * Send a notification to a specific user.
     */
    notifyUser(userId, event, data) {
        this.broadcast('notifications', event, data, userId);
    }

    /**
     * Get current connection statistics.
     */
    getStats() {
        const stats = { totalClients: this.clientCount, channels: {} };
        for (const [channel, clients] of this.clients) {
            stats.channels[channel] = clients.size;
        }
        return stats;
    }
}

// Singleton instance
const sseManager = new SSEManager();

module.exports = sseManager;
