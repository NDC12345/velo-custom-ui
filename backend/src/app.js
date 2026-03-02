const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { query } = require('./config/database');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const { csrfProtection } = require('./middleware/csrf');
const { auditLogger } = require('./middleware/auditLogger');
const { orgContext } = require('./middleware/orgContext');

const app = express();

// Trust first proxy (nginx) so rate-limiter and req.ip work correctly
app.set('trust proxy', 1);

const IS_PROD = process.env.NODE_ENV === 'production';

// ─── Security headers ────────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: IS_PROD ? {
        directives: {
            defaultSrc:  ["'self'"],
            scriptSrc:   ["'self'"],
            styleSrc:    ["'self'"],
            imgSrc:      ["'self'", 'data:', 'https:'],
            connectSrc:  ["'self'"],
            fontSrc:     ["'self'"],
            frameSrc:    ["'none'"],
            objectSrc:   ["'none'"],
        },
    } : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
    hsts: IS_PROD ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Disable X-Powered-By leakage
app.disable('x-powered-by');

// ─── Compression ─────────────────────────────────────────────────────────────
app.use(compression());

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:3000'];

app.use(cors({
    origin(origin, callback) {
        // Allow non-browser requests (curl, health probes) and listed origins
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        logger.warn('CORS blocked request from:', origin);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['X-Request-Id'],
    optionsSuccessStatus: 200,
}));

// ─── Logging ─────────────────────────────────────────────────────────────────
app.use(morgan('combined', {
    stream: logger.stream,
    skip: () => process.env.NODE_ENV === 'test',
}));

// ─── Body / cookie parsing ────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// cookieParser must come before CSRF middleware
const COOKIE_SECRET = process.env.COOKIE_SECRET;
if (!COOKIE_SECRET) throw new Error('COOKIE_SECRET must be set');
app.use(cookieParser(COOKIE_SECRET));

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Apply a broad limiter to all /api routes; the auth limiter is tighter and
// applied separately in auth.routes.js.
app.use('/api', apiLimiter);

// ─── CSRF protection ──────────────────────────────────────────────────────────
// Enforces X-CSRF-Token header on all mutating requests except the
// public auth endpoints listed in CSRF_EXEMPT_PATHS.
app.use(csrfProtection);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
    try {
        await query('SELECT 1');
        const geoStats = (() => { try { return require('./services/geoip.service').cacheStats(); } catch { return null; } })();
        const wsConns  = (() => { try { return require('./services/ws.gateway').connectionCount(); } catch { return 0; } })();
        res.json({
            status:      'ok',
            timestamp:   new Date().toISOString(),
            uptime:      process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            geo:         geoStats,
            ws_clients:  wsConns,
        });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
            status:  'error',
            message: 'Database connection failed',
        });
    }
});

// ─── Static uploads ───────────────────────────────────────────────────────────
// Use an absolute path so this works regardless of the cwd at startup
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── API routes ───────────────────────────────────────────────────────────────
// Audit logger captures all API requests for compliance tracking
app.use('/api', auditLogger);
// Org context sets PG session variable for RLS after JWT auth
app.use('/api', orgContext);

// ── Core auth ─────────────────────────────────────────────────────────────────
app.use('/api/auth',  require('./routes/auth.routes'));

// ── Real-time push (SSE) ──────────────────────────────────────────────────────
app.use('/api/sse',   require('./routes/sse.routes'));

// ── Velociraptor multi-org management ────────────────────────────────────────
app.use('/api/orgs',  require('./routes/org.routes'));

// ── GeoIP enrichment (client location display) ───────────────────────────────
app.use('/api/geo',   require('./routes/geo.routes'));

// ── AI assistant (VQL co-pilot) ──────────────────────────────────────────────
app.use('/api/ai',    require('./routes/ai.routes'));

// ── User profile, avatar, Velo connection settings ───────────────────────────
app.use('/api/user',  require('./routes/user.routes'));

// ── Velociraptor proxy (all DFIR operations) ─────────────────────────────────
// All Velociraptor API operations: clients, hunts, flows, artifacts,
// VFS, notebooks, server admin, events, tools, secrets, timelines,
// VQL, users, downloads — all proxied through /api/*
app.use('/api',       require('./routes/proxy.routes'));

// ─── Error handlers ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// Make database available to controllers
app.locals.db = { query };

module.exports = app;
