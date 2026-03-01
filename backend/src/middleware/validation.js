const { body, param, query, validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');

/**
 * Validation result checker middleware
 */
function validate(req, res, next) {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map(err => ({
            field: err.param,
            message: err.msg,
            value: err.value,
        }));
        
        // Use next(err) instead of throw so Express error handler always catches it,
        // even when this middleware runs inside async chains.
        return next(new ValidationError('Validation failed', formattedErrors));
    }
    
    next();
}

/**
 * Auth validators
 */
const authValidators = {
    register: [
        body('username')
            .trim()
            .isLength({ min: 3, max: 255 })
            .withMessage('Username must be 3-255 characters')
            .matches(/^[a-zA-Z0-9_-]+$/)
            .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
        body('email')
            .optional()
            .isEmail()
            .normalizeEmail()
            .withMessage('Invalid email address'),
        body('password')
            .notEmpty()
            .withMessage('Password is required')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters')
            .matches(/[A-Z]/)
            .withMessage('Password must contain at least one uppercase letter')
            .matches(/[0-9]/)
            .withMessage('Password must contain at least one number')
            .matches(/[^A-Za-z0-9]/)
            .withMessage('Password must contain at least one special character'),
        validate,
    ],
    
    login: [
        body('username')
            .trim()
            .notEmpty()
            .withMessage('Username is required'),
        // Accept both 'password' (SPA) and legacy 'veloPassword' (API clients)
        body('password')
            .optional()
            .isString()
            .withMessage('Password must be a string'),
        body('veloPassword')
            .optional()
            .isString()
            .withMessage('Password must be a string'),
        validate,
    ],
    
    refresh: [
        body('refreshToken')
            .optional()
            .isString()
            .withMessage('Refresh token must be a string'),
        validate,
    ],
};

/**
 * Client validators
 */
const clientValidators = {
    search: [
        query('offset')
            .optional()
            .isInt({ min: 0 })
            .toInt()
            .withMessage('Offset must be a positive integer'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 1000 })
            .toInt()
            .withMessage('Limit must be between 1 and 1000'),
        query('query')
            .optional()
            .isString()
            .trim()
            .withMessage('Query must be a string'),
        validate,
    ],
    
    getClient: [
        param('clientId')
            .matches(/^C\.[a-f0-9]+$/i)
            .withMessage('Invalid client ID format'),
        validate,
    ],
};

/**
 * Hunt validators
 */
const huntValidators = {
    getHunts: [
        query('offset')
            .optional()
            .isInt({ min: 0 })
            .toInt(),
        query('count')
            .optional()
            .isInt({ min: 1, max: 1000 })
            .toInt(),
        validate,
    ],
    
    getHunt: [
        param('huntId')
            .matches(/^H\.[A-Z0-9]+$/i)
            .withMessage('Invalid hunt ID format'),
        validate,
    ],
};

/**
 * Tag validators
 */
const tagValidators = {
    addTag: [
        param('clientId')
            .matches(/^C\.[a-f0-9]+$/i)
            .withMessage('Invalid client ID format'),
        body('tagName')
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage('Tag name must be 1-100 characters'),
        body('tagValue')
            .optional()
            .isString()
            .trim(),
        body('tagColor')
            .optional()
            .matches(/^#[0-9a-f]{6}$/i)
            .withMessage('Invalid color format (use #RRGGBB)'),
        validate,
    ],
};

/**
 * Flow validators
 */
const flowValidators = {
    getFlow: [
        param('flowId')
            .matches(/^F\.[A-Z0-9]+$/i)
            .withMessage('Invalid flow ID format'),
        query('client_id')
            .optional()
            .matches(/^C\.[A-Z0-9]+$/i)
            .withMessage('Invalid client ID format'),
        validate,
    ],
};

/**
 * Artifact validators
 */
const artifactValidators = {
    getArtifact: [
        param('artifactName')
            .trim()
            .notEmpty()
            .withMessage('Artifact name is required'),
        validate,
    ],
};

/**
 * VFS validators
 */
const vfsValidators = {
    listDirectory: [
        param('clientId')
            .matches(/^C\.[a-f0-9]+$/i)
            .withMessage('Invalid client ID format'),
        query('path')
            .optional()
            .isString()
            .trim()
            .withMessage('Path must be a string'),
        validate,
    ],
};

/**
 * Notebook validators
 */
const notebookValidators = {
    getNotebook: [
        param('notebookId')
            .matches(/^N\.[A-Z0-9]+$/i)
            .withMessage('Invalid notebook ID format'),
        validate,
    ],
};

module.exports = {
    validate,
    authValidators,
    clientValidators,
    huntValidators,
    tagValidators,
    flowValidators,
    artifactValidators,
    vfsValidators,
    notebookValidators,
};
