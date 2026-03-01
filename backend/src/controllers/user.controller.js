const { asyncHandler } = require('../middleware/errorHandler');
const { query } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Use memory storage so we can validate file contents before persisting
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Helper: detect image type from magic bytes (no extra deps)
function detectImageType(buffer) {
    if (!buffer || buffer.length < 12) return null;
    // JPEG
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return { mime: 'image/jpeg', ext: 'jpg' };
    // PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return { mime: 'image/png', ext: 'png' };
    // GIF87a / GIF89a
    if (buffer.slice(0,6).toString('ascii') === 'GIF87a' || buffer.slice(0,6).toString('ascii') === 'GIF89a') return { mime: 'image/gif', ext: 'gif' };
    // WebP (RIFF....WEBP)
    if (buffer.slice(0,4).toString('ascii') === 'RIFF' && buffer.slice(8,12).toString('ascii') === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
    return null;
}

/**
 * Get current user profile
 * GET /api/user/profile
 */
exports.getProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    
    const result = await query(
        `SELECT id, username, email, avatar_url, roles, created_at, updated_at 
         FROM users 
         WHERE id = $1`,
        [userId]
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
});

/**
 * Update user profile
 * PUT /api/user/profile
 */
exports.updateProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { email } = req.body;
    
    // Only allow updating email for now
    const result = await query(
        `UPDATE users 
         SET email = COALESCE($1, email),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, username, email, avatar_url, roles, created_at, updated_at`,
        [email, userId]
    );
    
    res.json({
        success: true,
        data: result.rows[0]
    });
});

/**
 * Upload user avatar
 * POST /api/user/avatar
 */
exports.uploadAvatar = [
    upload.single('avatar'),
    asyncHandler(async (req, res) => {
        const userId = req.user.id;

        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        // Validate magic bytes
        const imgType = detectImageType(req.file.buffer);
        if (!imgType) {
            return res.status(400).json({ success: false, error: 'Invalid or unsupported image format' });
        }

        const avatarsDir = path.join(__dirname, '../../uploads/avatars');
        await fs.mkdir(avatarsDir, { recursive: true });

        // Safe filename: include user id and timestamp
        const filename = `avatar-${userId}-${Date.now()}.${imgType.ext}`;
        const outPath = path.join(avatarsDir, filename);

        // Persist file to disk
        await fs.writeFile(outPath, req.file.buffer, { flag: 'wx' });

        // Get old avatar to delete
        const oldAvatar = await query('SELECT avatar_url FROM users WHERE id = $1', [userId]);

        // Update database with new avatar path (serve path)
        const avatarUrl = `/uploads/avatars/${filename}`;
        await query(
            `UPDATE users SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [avatarUrl, userId]
        );

        // Delete old avatar file if exists and is within avatarsDir
        const oldUrl = oldAvatar.rows[0]?.avatar_url;
        if (oldUrl) {
            try {
                const candidate = path.join(__dirname, '../../', oldUrl);
                const resolved = path.resolve(candidate);
                if (resolved.startsWith(path.resolve(avatarsDir))) {
                    await fs.unlink(resolved).catch(() => {});
                }
            } catch (e) {
                // ignore deletion errors
            }
        }

        res.json({ success: true, data: { avatarUrl } });
    })
];

/**
 * Delete user avatar
 * DELETE /api/user/avatar
 */
exports.deleteAvatar = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    
    // Get current avatar
    const result = await query(
        'SELECT avatar_url FROM users WHERE id = $1',
        [userId]
    );
    
    if (result.rows[0]?.avatar_url) {
        // Delete file safely only if inside uploads/avatars
        const avatarsDir = path.join(__dirname, '../../uploads/avatars');
        const candidate = path.join(__dirname, '../../', result.rows[0].avatar_url);
        try {
            const resolved = path.resolve(candidate);
            if (resolved.startsWith(path.resolve(avatarsDir))) {
                await fs.unlink(resolved).catch(() => {});
            }
        } catch (e) {
            // ignore
        }
    }
    
    // Clear avatar_url in database
    await query(
        `UPDATE users 
         SET avatar_url = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [userId]
    );
    
    res.json({
        success: true,
        message: 'Avatar deleted successfully'
    });
});

module.exports = exports;
