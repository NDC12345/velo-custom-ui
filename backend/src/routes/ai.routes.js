const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');
const { authenticateJWT } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');

// Rate limiting - DISABLED
// Removed as per user request

// Validation schemas
const chatValidation = [
  body('message')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ max: 4000 })
    .withMessage('Message too long (max 4000 characters)'),
  body('context')
    .optional()
    .custom((value) => {
      if (value !== null && typeof value !== 'object' && typeof value !== 'string') {
        throw new Error('Context must be a string or object');
      }
      return true;
    }),
  validate
];

const vqlValidation = [
  body('vql')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('VQL query is required')
    .isLength({ max: 10000 })
    .withMessage('VQL query too long'),
  validate
];

const suggestValidation = [
  body('description')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 1000 })
    .withMessage('Description too long'),
  validate
];

// All AI routes require authentication only
router.use(authenticateJWT);

// Chat endpoints
router.post('/chat', chatValidation, aiController.chat);
router.post('/chat/stream', chatValidation, aiController.streamChat);
router.delete('/chat/history', aiController.clearHistory);

// Analysis endpoints
router.post('/analyze-vql', vqlValidation, aiController.analyzeVQL);
router.post('/suggest-artifacts', suggestValidation, aiController.suggestArtifacts);

// Status endpoint
router.get('/status', aiController.getStatus);

// Provider management
router.get('/providers', aiController.getProviders);
router.get('/provider', aiController.getProviderConfig);
router.put('/provider', aiController.saveProviderConfig);
router.post('/provider/test', aiController.testProvider);
router.post('/provider/models', aiController.listModels);

module.exports = router;
