const { getVeloCredentials } = require('../services/auth.service');
const { AuthenticationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Inject the user's decrypted Velo credentials, org context, and per-user server URL.
 * Must follow authenticateJWT (relies on req.user).
 *
 * Sets:
 *   req.veloAuth      - { username, password }  for Basic-Auth proxying to Velo
 *   req.veloOrgId     - Velociraptor org identifier (empty string = default org)
 *   req.veloServerUrl - Per-user Velo server base URL ('' = use system default)
 *   req.veloVerifySsl - TLS certificate verification flag (default true)
 */
async function injectVeloCredentials(req, res, next) {
    if (!req.user || !req.user.userId) {
        return next(new AuthenticationError('User authentication required'));
    }

    try {
        const credentials = await getVeloCredentials(req.user.userId);

        req.veloAuth = {
            username: credentials.username,
            password: credentials.password,
        };

        // Org context is loaded from the database via authenticateJWT middleware.
        req.veloOrgId = req.user.orgId || '';

        // Per-user server URL (falls back to VELO_API_BASE_URL env in velo-api.js)
        req.veloServerUrl = credentials.serverUrl || '';
        req.veloVerifySsl = credentials.verifySsl !== false;

        logger.debug('Velo credentials injected', {
            userId:       req.user.userId,
            veloUsername: credentials.username,
            orgId:        req.veloOrgId,
            serverUrl:    req.veloServerUrl || '(system default)',
        });

        next();
    } catch (error) {
        logger.error('Failed to retrieve Velo credentials:', error);
        return next(new AuthenticationError('Failed to retrieve Velociraptor credentials'));
    }
}

module.exports = { injectVeloCredentials };
