const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateJWT } = require('../middleware/auth');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { testCredentials, invalidateSession } = require('../config/velo-api');
const { getVeloCredentials } = require('../services/auth.service');

const { validateExternalUrl } = require('../utils/ssrf');

const router = express.Router();

// ─── Secure avatar-unlink helper ──────────────────────────────────────────────
// Resolves AVATARS_DIR once at startup so it never changes at runtime.
const AVATARS_DIR = path.resolve(path.join(__dirname, '../../uploads/avatars'));

/**
 * safeUnlinkAvatar — delete an avatar file referenced by its stored URL, with
 * full protection against path-traversal attacks.
 *
 * Guards applied, in order:
 *  1. Skip nulls, empty strings and data URIs.
 *  2. Require the URL to start with the trusted prefix /uploads/avatars/.
 *  3. Extract only the basename (strips any injected ../ segments from the URL).
 *  4. Resolve the absolute path and verify it is strictly inside AVATARS_DIR.
 */
async function safeUnlinkAvatar(avatarUrl) {
  if (!avatarUrl || typeof avatarUrl !== 'string') return;
  if (!avatarUrl.startsWith('/uploads/avatars/')) return; // skips data URIs too
  const safeName = path.basename(avatarUrl);              // e.g. "avatar-uuid-123.png"
  if (!safeName || safeName === '.' || safeName === '..') return;
  const resolved = path.resolve(AVATARS_DIR, safeName);
  // Belt-and-suspenders: must be inside AVATARS_DIR
  if (resolved !== AVATARS_DIR && !resolved.startsWith(AVATARS_DIR + path.sep)) return;
  try {
    await fs.unlink(resolved);
  } catch (err) {
    if (err.code !== 'ENOENT') logger.warn('Failed to delete avatar file:', { code: err.code, file: safeName });
  }
}

// ── Multer: memory storage (magic-byte validation happens after upload) ───────
// Using memoryStorage for BOTH upload routes so the raw buffer can be
// inspected before anything touches disk.  diskStorage with
// path.extname(file.originalname) is a path-traversal vector because the
// original filename is fully attacker-controlled.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

// All user routes require authentication
router.use(authenticateJWT);

/**
 * GET /api/user/profile
 * Get current user profile
 */
router.get('/profile', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, username, email, created_at, avatar_url FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile'
    });
  }
});

/**
 * POST /api/user/avatar
 * Upload user avatar via multipart/form-data.
 * Uses memory storage so the raw buffer can be validated via magic bytes
 * before anything is written to disk — prevents content-type spoofing.
 */
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Validate magic bytes — reject anything that doesn't look like a real image
    const imgType = detectMagicType(req.file.buffer);
    if (!imgType) {
      return res.status(400).json({ success: false, error: 'Invalid image data. Unrecognised image format.' });
    }

    // Ensure directory exists (uses module-level AVATARS_DIR constant)
    await fs.mkdir(AVATARS_DIR, { recursive: true });

    // Build a safe filename — extension derived from magic bytes, NOT the original filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const filename = `avatar-${req.user.userId}-${uniqueSuffix}.${imgType.ext}`;
    const outPath  = path.join(AVATARS_DIR, filename);

    // Belt-and-suspenders: verify resolved path is strictly inside AVATARS_DIR
    if (!outPath.startsWith(AVATARS_DIR + path.sep)) {
      return res.status(400).json({ success: false, error: 'Invalid file path' });
    }

    // Delete the old avatar (if it exists on disk) before writing the new one
    const oldRow = await query('SELECT avatar_url FROM users WHERE id = $1', [req.user.userId]);
    await safeUnlinkAvatar(oldRow.rows[0]?.avatar_url);

    // Write decoded image to disk (exclusive flag prevents overwriting)
    await fs.writeFile(outPath, req.file.buffer, { flag: 'wx' });

    // Persist only the serve-path in the database
    const avatarUrl = `/uploads/avatars/${filename}`;
    await query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, req.user.userId]);

    logger.info(`Avatar (multipart) updated for user ${req.user.userId}`);
    res.json({ success: true, data: { avatarUrl } });
  } catch (error) {
    logger.error('Avatar upload error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to upload avatar' });
  }
});

// ─── Magic-byte image type detector (shared by both upload routes) ───────────
const MAGIC_TYPES = [
  { mime: 'image/jpeg', ext: 'jpg',  check: (b) => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF },
  { mime: 'image/png',  ext: 'png',  check: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 },
  { mime: 'image/gif',  ext: 'gif',  check: (b) => b.slice(0,6).toString('ascii') === 'GIF87a' || b.slice(0,6).toString('ascii') === 'GIF89a' },
  { mime: 'image/webp', ext: 'webp', check: (b) => b.slice(0,4).toString('ascii') === 'RIFF' && b.slice(8,12).toString('ascii') === 'WEBP' },
];

function detectMagicType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  return MAGIC_TYPES.find((t) => t.check(buffer)) || null;
}

/**
 * POST /api/user/avatar/base64
 * Upload user avatar sent as a base64 data URI in JSON body { avatarBase64: 'data:image/png;base64,...' }
 * The image is decoded, validated via magic bytes, and saved to disk.
 * Only the file path (e.g. /uploads/avatars/avatar-<id>-<ts>.png) is stored in the database.
 */
router.post('/avatar/base64', async (req, res) => {
  try {
    const { avatarBase64 } = req.body;

    if (!avatarBase64 || typeof avatarBase64 !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing avatarBase64 field' });
    }

    // Accept only full data URIs: data:image/{type};base64,<data>
    const match = avatarBase64.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) {
      return res.status(400).json({
        success: false,
        error: 'Invalid data URI. Expected: data:image/{png|jpeg|jpg|gif|webp};base64,...',
      });
    }

    const base64Data = match[2].replace(/\s+/g, '');

    // Decode to raw buffer
    const buffer = Buffer.from(base64Data, 'base64');
    const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({ success: false, error: 'Image too large. Max 5 MB allowed.' });
    }

    // Verify magic bytes — reject anything that doesn't look like a real image
    const imgType = detectMagicType(buffer);
    if (!imgType) {
      return res.status(400).json({ success: false, error: 'Invalid image data. Unrecognised image format.' });
    }

    // Ensure the uploads/avatars directory exists (uses module-level AVATARS_DIR constant)
    await fs.mkdir(AVATARS_DIR, { recursive: true });

    // Build a safe, unique filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const filename = `avatar-${req.user.userId}-${uniqueSuffix}.${imgType.ext}`;
    const outPath  = path.join(AVATARS_DIR, filename);

    // Belt-and-suspenders: verify resolved path is strictly inside AVATARS_DIR
    if (!outPath.startsWith(AVATARS_DIR + path.sep)) {
      return res.status(400).json({ success: false, error: 'Invalid file path' });
    }

    // Delete the old avatar (if it exists on disk) before writing the new one
    const oldRow = await query('SELECT avatar_url FROM users WHERE id = $1', [req.user.userId]);
    await safeUnlinkAvatar(oldRow.rows[0]?.avatar_url);

    // Write decoded image to disk (exclusive flag prevents overwriting)
    await fs.writeFile(outPath, buffer, { flag: 'wx' });

    // Persist only the serve-path (not the giant data URI) in the database
    const avatarUrl = `/uploads/avatars/${filename}`;
    await query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, req.user.userId]);

    logger.info(`Avatar (base64) updated for user ${req.user.userId}`);
    res.json({ success: true, data: { avatarUrl } });
  } catch (error) {
    logger.error('Avatar base64 upload error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload avatar' });
  }
});

/**
 * DELETE /api/user/avatar
 * Remove user avatar
 */
router.delete('/avatar', async (req, res) => {
  try {
    const result = await query(
      'SELECT avatar_url FROM users WHERE id = $1',
      [req.user.userId]
    );

    const avatarUrl = result.rows[0]?.avatar_url;

    if (avatarUrl) {
      // If avatar is a file path under /uploads, delete the file. If it's a data URI, nothing to unlink.
      // safeUnlinkAvatar validates path is inside AVATARS_DIR before unlinking
      await safeUnlinkAvatar(avatarUrl);

      // Update database (clear any stored data URI or path)
      await query(
        'UPDATE users SET avatar_url = NULL WHERE id = $1',
        [req.user.userId]
      );
    }

    res.json({
      success: true
    });
  } catch (error) {
    logger.error('Avatar delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete avatar'
    });
  }
});

/**
 * PUT /api/user/profile
 * Update user profile
 */
router.put('/profile', async (req, res) => {
  try {
    const { username, email } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (username) {
      updates.push(`username = $${paramCount++}`);
      values.push(username);
    }

    if (email) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    values.push(req.user.userId);

    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, username, email, avatar_url`,
      values
    );

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({
        success: false,
        error: 'Username or email already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

/**
 * GET /api/user/velo-connection
 * Returns the user's current Velo server URL and SSL setting.
 */
router.get('/velo-connection', async (req, res) => {
  try {
    const result = await query(
      'SELECT velo_server_url, velo_verify_ssl FROM users WHERE id = $1 AND deleted_at IS NULL',
      [req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const { velo_server_url, velo_verify_ssl } = result.rows[0];
    res.json({
      success: true,
      data: {
        serverUrl: velo_server_url || '',
        verifySsl: velo_verify_ssl !== false,
      },
    });
  } catch (err) {
    logger.error('Get velo-connection error:', err);
    res.status(500).json({ success: false, error: 'Failed to get connection settings' });
  }
});

/**
 * PUT /api/user/velo-connection
 * Update the user's Velo server URL and SSL verification setting.
 * Optionally tests the connection before saving.
 * Body: { serverUrl, verifySsl?, testFirst? }
 */
router.put('/velo-connection', async (req, res) => {
  try {
    const { serverUrl, verifySsl = true, testFirst = true } = req.body;

    if (!serverUrl || typeof serverUrl !== 'string' || !serverUrl.startsWith('http')) {
      return res.status(400).json({ success: false, error: 'Invalid server URL. Must start with http:// or https://' });
    }

    // SSRF protection: reject cloud-metadata and link-local targets
    try {
      validateExternalUrl(serverUrl);
    } catch (ssrfErr) {
      return res.status(400).json({ success: false, error: ssrfErr.message });
    }

    const normalizedUrl = serverUrl.replace(/\/$/, '');

    // Capture existing credentials/server URL so we can invalidate any cached
    // sessions after updating the saved URL. This prevents stale CSRF/session
    // data from being used for subsequent proxied requests.
    let prevCreds = null;
    try {
      prevCreds = await getVeloCredentials(req.user.userId);
    } catch (_) {
      prevCreds = null;
    }

    if (testFirst) {
      // Verify current credentials work against the new server URL
      try {
        const creds = prevCreds || await getVeloCredentials(req.user.userId);
        await testCredentials(creds.username, creds.password, normalizedUrl, verifySsl);
      } catch (testErr) {
        return res.status(400).json({
          success: false,
          error: 'Could not connect to Velociraptor server with your credentials: ' + testErr.message,
        });
      }
    }

    await query(
      'UPDATE users SET velo_server_url = $1, velo_verify_ssl = $2, updated_at = NOW() WHERE id = $3',
      [normalizedUrl, verifySsl, req.user.userId]
    );

    // Invalidate any cached sessions for the previous and new server URLs so
    // the next proxied request will re-obtain CSRF cookies/tokens.
    try {
      const credsToInvalidate = prevCreds || await getVeloCredentials(req.user.userId);
      if (credsToInvalidate && credsToInvalidate.username) {
        // prev URL (may be empty)
        const prevUrl = prevCreds?.serverUrl || '';
        try { invalidateSession({ username: credsToInvalidate.username, password: credsToInvalidate.password }, '', prevUrl); } catch (e) { /* non-fatal */ }
        // new URL
        try { invalidateSession({ username: credsToInvalidate.username, password: credsToInvalidate.password }, '', normalizedUrl); } catch (e) { /* non-fatal */ }
      }
    } catch (e) {
      logger.warn('Failed to invalidate Velo session cache after settings change', { userId: req.user.userId, err: e?.message });
    }

    logger.info('Velo connection updated', { userId: req.user.userId, serverUrl: normalizedUrl });
    res.json({
      success: true,
      data: { serverUrl: normalizedUrl, verifySsl },
      message: 'Velociraptor connection settings saved.',
    });
  } catch (err) {
    logger.error('Put velo-connection error:', err);
    res.status(500).json({ success: false, error: 'Failed to update connection settings' });
  }
});

module.exports = router;
