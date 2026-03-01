require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const { query } = require('./config/database');
const { cleanExpiredRevocations } = require('./services/auth.service');
const geoipService = require('./services/geoip.service');
const wsGateway    = require('./services/ws.gateway');

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

/**
 * Start server
 */
async function startServer() {
    try {
        // Test database connection
        logger.info('Testing database connection...');
        const result = await query('SELECT version()');
        logger.info('Database connected successfully:', result.rows[0].version);
        
        // Verify encryption key is set
        if (!process.env.VELO_CREDENTIALS_ENCRYPTION_KEY) {
            throw new Error('VELO_CREDENTIALS_ENCRYPTION_KEY environment variable is required');
        }
        
        if (process.env.VELO_CREDENTIALS_ENCRYPTION_KEY.length !== 64) {
            throw new Error('VELO_CREDENTIALS_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
        }
        
        // Verify JWT secrets — names must match what jwt.js reads
        if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
            throw new Error('JWT_SECRET and JWT_REFRESH_SECRET environment variables are required');
        }
        
        // Verify cookie secret (required for signed session cookies)
        if (!process.env.COOKIE_SECRET) {
            throw new Error('COOKIE_SECRET environment variable is required');
        }
        
        // Start listening
        const server = app.listen(PORT, HOST, () => {
            logger.info(`🚀 Server running at http://${HOST}:${PORT}`);
            logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`🔐 Velo API: ${process.env.VELO_API_BASE_URL}`);
        });

        // ── GeoIP service: Redis + MaxMind MMDB (or ip-api.com fallback) ────
        await geoipService.init();

        // ── WebSocket gateway (attaches to same HTTP server on /ws/geo) ─────
        await wsGateway.start(server);
        
        // ── Maintenance cron: prune expired JTI revocation records ──────────
        const REVOCATION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // every hour
        const revocationCron = setInterval(async () => {
            try {
                await cleanExpiredRevocations();
                logger.debug('Expired token revocations pruned');
            } catch (err) {
                logger.error('Error pruning expired revocations:', err);
            }
        }, REVOCATION_CLEANUP_INTERVAL_MS);
        revocationCron.unref(); // don't block process exit
        
        // Graceful shutdown
        const shutdown = async (signal) => {
            logger.info(`${signal} received, shutting down gracefully...`);
            
            server.close(() => {
                logger.info('Server closed');
                process.exit(0);
            });
            
            // Force shutdown after 10 seconds
            setTimeout(() => {
                logger.error('Forced shutdown after timeout');
                process.exit(1);
            }, 10000);
        };
        
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start if run directly
if (require.main === module) {
    startServer();
}

module.exports = { startServer };
