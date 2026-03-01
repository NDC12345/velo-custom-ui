const express = require('express');
const tagsController = require('../controllers/tags.controller');
const { authenticateJWT } = require('../middleware/auth');
const { tagValidators } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticateJWT);

/**
 * Tag endpoints
 */
router.get('/tags/:clientId', tagsController.getClientTags);
router.post('/tags/:clientId', tagValidators.addTag, tagsController.addTag);
router.put('/tags/:tagId', tagsController.updateTag);
router.delete('/tags/:tagId', tagsController.deleteTag);

/**
 * Settings endpoints
 */
router.get('/settings', tagsController.getSettings);
router.put('/settings/:key', tagsController.updateSetting);

module.exports = router;
