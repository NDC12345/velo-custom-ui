const express = require('express');
const authController = require('../controllers/auth.controller');
const { authValidators } = require('../middleware/validation');
const { authenticateJWT } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * @route   POST /auth/register
 * @desc    Register new user with Velo credentials
 * @access  Public
 */
router.post('/register', authLimiter, authValidators.register, authController.register);

/**
 * @route   POST /auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', authLimiter, authValidators.login, authController.login);

/**
 * @route   POST /auth/refresh
 * @desc    Refresh access token
 * @access  Public (cookie-auth only)
 */
router.post('/refresh', authLimiter, authValidators.refresh, authController.refresh);

/**
 * @route   POST /auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticateJWT, authController.logout);

/**
 * @route   GET /auth/me
 * @desc    Get current user info
 * @access  Private
 */
router.get('/me', authenticateJWT, authController.me);

/**
 * @route   POST /auth/change-password
 * @desc    Change Velociraptor password
 * @access  Private
 */
router.post('/change-password', authenticateJWT, authController.changePassword);

module.exports = router;
