const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'velo_custom',
    user: process.env.DB_USER || 'velo_admin',
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    // SSL configuration: enable only when DB_ENABLE_SSL=true
    ssl: (process.env.DB_ENABLE_SSL === 'true') ? {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        ca: process.env.DB_SSL_CA || undefined,
    } : false,
});

// Test connection on startup
pool.on('connect', () => {
    logger.debug('Database connection established');
});

pool.on('error', (err) => {
    logger.error('Unexpected database error:', err);
    process.exit(-1);
});

// Helper function for parameterized queries
async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        logger.debug('Executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        logger.error('Database query error:', { text, error: error.message });
        throw error;
    }
}

// Transaction helper
async function transaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    query,
    transaction,
    pool,
};
