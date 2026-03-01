const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Global error handler middleware
 * Must be placed after all routes
 */
function errorHandler(err, req, res, next) {
    // Log error details
    logger.error('Error occurred:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        user: req.user?.username,
    });
    
    // Default error
    let statusCode = 500;
    let message = 'Internal server error';
    let details = null;
    
    // Handle known error types
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
        details = err.details;
    } else if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation error';
        details = err.details || err.message;
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        message = 'Unauthorized';
    } else if (err.status) {
        // Handle Velo API errors
        statusCode = err.status;
        message = err.message;
        details = err.data;
    }
    
    // Send error response
    const response = {
        error: message,
        ...(details && { details }),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    };
    
    res.status(statusCode).json(response);
}

/**
 * 404 handler (must be placed before error handler)
 */
function notFoundHandler(req, res, next) {
    res.status(404).json({
        error: 'Resource not found',
        path: req.originalUrl,
    });
}

/**
 * Async route handler wrapper
 * Catches errors in async functions and passes to error handler
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler,
};
