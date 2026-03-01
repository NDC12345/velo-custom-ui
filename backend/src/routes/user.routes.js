const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateJWT } = require('../middleware/auth');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { testCredentials } = require('../config/velo-api');
const { getVeloCredentials } = require('../services/auth.service');

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

// Configure multer for avatar upload
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/avatars');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      logger.error('Failed to create upload directory:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${req.user.userId}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }
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
 * Upload user avatar
 */
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Delete old avatar if exists
    const oldAvatar = await query(
      'SELECT avatar_url FROM users WHERE id = $1',
      [req.user.userId]
    );

    // safeUnlinkAvatar validates path is inside AVATARS_DIR before unlinking
    await safeUnlinkAvatar(oldAvatar.rows[0]?.avatar_url);

    // Update user avatar URL
    await query(
      'UPDATE users SET avatar_url = $1 WHERE id = $2',
      [avatarUrl, req.user.userId]
    );

    logger.info(`Avatar updated for user ${req.user.userId}`);

    res.json({
      success: true,
      data: {
        avatarUrl
      }
    });
  } catch (error) {
    logger.error('Avatar upload error:', error);
    
    // Delete uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (err) {
        logger.error('Failed to delete uploaded file:', err);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload avatar'
    });
  }
});

/**
 * POST /api/user/avatar/base64
 * Upload user avatar as a base64 data URI in JSON body { avatarBase64: 'data:image/png;base64,...' }
 */
router.post('/avatar/base64', async (req, res) => {
  try {
    let { avatarBase64, mimeType } = req.body;

    if (!avatarBase64 || typeof avatarBase64 !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing avatarBase64 field' });
    }

    // Accept either full data URI (data:image/..;base64,...) or raw base64 string.
    let base64Data = null;
    let detectedMime = null;

    if (avatarBase64.startsWith('data:')) {
      const match = avatarBase64.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/=\n\r]+)$/);
      if (!match) {
        return res.status(400).json({ success: false, error: 'Invalid data URI. Expect data:image/{png|jpeg|jpg|gif|webp};base64,...' });
      }
      detectedMime = `image/${match[1] === 'jpg' ? 'jpeg' : match[1]}`;
      base64Data = match[2].replace(/\s+/g, '');
    } else {
      // Raw base64 string — allow optional mimeType override, otherwise try to use provided mimeType or default to image/png
      base64Data = avatarBase64.replace(/\s+/g, '');
      if (mimeType && typeof mimeType === 'string') {
        detectedMime = mimeType;
      } else if (req.body.mime && typeof req.body.mime === 'string') {
        detectedMime = req.body.mime;
      } else {
        detectedMime = 'image/png';
      }
      // Basic validation of mime
      const allowedMimes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
      if (!allowedMimes.includes(detectedMime)) {
        return res.status(400).json({ success: false, error: 'Unsupported mime type' });
      }
    }

    // Validate base64 characters
    if (!/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
      return res.status(400).json({ success: false, error: 'Invalid base64 payload' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const MAX_BYTES = 5 * 1024 * 1024; // 5MB

    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({ success: false, error: 'Image too large. Max 5MB allowed.' });
    }

    // Delete old avatar file if it was stored on disk
    const oldAvatar = await query('SELECT avatar_url FROM users WHERE id = $1', [req.user.userId]);
    const oldUrl = oldAvatar.rows[0]?.avatar_url;
    // safeUnlinkAvatar validates path is inside AVATARS_DIR before unlinking
    await safeUnlinkAvatar(oldUrl);

    // Compose data URI using detected mime and cleaned base64
    const dataUri = `data:${detectedMime};base64,${base64Data}`;

    // Store data URI directly in avatar_url column
    await query('UPDATE users SET avatar_url = $1 WHERE id = $2', [dataUri, req.user.userId]);

    res.json({ success: true, data: { avatarUrl: dataUri } });
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

    const normalizedUrl = serverUrl.replace(/\/$/, '');

    if (testFirst) {
      // Verify current credentials work against the new server URL
      try {
        const creds = await getVeloCredentials(req.user.userId);
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
