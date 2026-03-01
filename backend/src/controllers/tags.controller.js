const { query, transaction } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { NotFoundError, ConflictError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Get all tags for a client
 * GET /api/tags/:clientId
 */
exports.getClientTags = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    
    const result = await query(
        `SELECT id, tag_name, tag_value, tag_color, created_at, updated_at
         FROM client_tags
         WHERE client_id = $1 AND created_by_user_id = $2
         ORDER BY created_at DESC`,
        [clientId, req.user.userId]
    );
    
    res.json({
        clientId,
        tags: result.rows,
    });
});

/**
 * Add tag to client
 * POST /api/tags/:clientId
 */
exports.addTag = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const { tagName, tagValue, tagColor } = req.body;
    
    // Check for duplicate tag name
    const existing = await query(
        'SELECT id FROM client_tags WHERE client_id = $1 AND created_by_user_id = $2 AND tag_name = $3',
        [clientId, req.user.userId, tagName]
    );
    
    if (existing.rows.length > 0) {
        throw new ConflictError(`Tag "${tagName}" already exists for this client`);
    }
    
    const result = await query(
        `INSERT INTO client_tags (created_by_user_id, client_id, tag_name, tag_value, tag_color)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, tag_name, tag_value, tag_color, created_at`,
        [req.user.userId, clientId, tagName, tagValue || '', tagColor || '#9c27b0']
    );
    
    logger.info('Tag added', { userId: req.user.userId, clientId, tagName });
    
    res.status(201).json({
        message: 'Tag added successfully',
        tag: result.rows[0],
    });
});

/**
 * Update tag
 * PUT /api/tags/:tagId
 */
exports.updateTag = asyncHandler(async (req, res) => {
    const { tagId } = req.params;
    const { tagValue, tagColor } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (tagValue !== undefined) {
        updates.push(`tag_value = $${paramCount}`);
        values.push(tagValue);
        paramCount++;
    }
    
    if (tagColor !== undefined) {
        updates.push(`tag_color = $${paramCount}`);
        values.push(tagColor);
        paramCount++;
    }
    
    if (updates.length === 0) {
        throw new ValidationError('No fields to update');
    }
    
    values.push(tagId, req.user.userId);
    
    const result = await query(
        `UPDATE client_tags
         SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${paramCount} AND created_by_user_id = $${paramCount + 1}
         RETURNING id, tag_name, tag_value, tag_color, updated_at`,
        values
    );
    
    if (result.rows.length === 0) {
        throw new NotFoundError('Tag not found');
    }
    
    res.json({
        message: 'Tag updated successfully',
        tag: result.rows[0],
    });
});

/**
 * Delete tag
 * DELETE /api/tags/:tagId
 */
exports.deleteTag = asyncHandler(async (req, res) => {
    const { tagId } = req.params;
    
    const result = await query(
        'DELETE FROM client_tags WHERE id = $1 AND created_by_user_id = $2 RETURNING tag_name',
        [tagId, req.user.userId]
    );
    
    if (result.rows.length === 0) {
        throw new NotFoundError('Tag not found');
    }
    
    logger.info('Tag deleted', { userId: req.user.userId, tagId, tagName: result.rows[0].tag_name });
    
    res.json({
        message: 'Tag deleted successfully',
    });
});

/**
 * Get user settings
 * GET /api/settings
 */
exports.getSettings = asyncHandler(async (req, res) => {
    const result = await query(
        'SELECT setting_key, setting_value FROM user_settings WHERE user_id = $1',
        [req.user.userId]
    );
    
    const settings = {};
    result.rows.forEach(row => {
        settings[row.setting_key] = row.setting_value;
    });
    
    res.json({ settings });
});

/**
 * Update user setting
 * PUT /api/settings/:key
 */
exports.updateSetting = asyncHandler(async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    
    if (!value) {
        throw new ValidationError('Setting value is required');
    }
    
    const result = await query(
        `INSERT INTO user_settings (user_id, setting_key, setting_value)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, setting_key)
         DO UPDATE SET setting_value = $3, updated_at = CURRENT_TIMESTAMP
         RETURNING setting_key, setting_value`,
        [req.user.userId, key, value]
    );
    
    res.json({
        message: 'Setting updated successfully',
        setting: result.rows[0],
    });
});

module.exports = exports;
