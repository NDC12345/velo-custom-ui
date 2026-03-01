/**
 * Case Management Routes
 *
 * /api/cases — CRUD for investigation cases, evidence, and comments.
 * RBAC: reader+ for listing/viewing, investigator+ for creating/updating,
 *        admin for deleting.
 */
'use strict';

const express = require('express');
const caseController = require('../controllers/case.controller');
const { authenticateJWT } = require('../middleware/auth');
const {
    requireReader,
    requireInvestigator,
    requireAnalyst,
    requireAdmin,
} = require('../middleware/rbac');

const router = express.Router();

// All case routes require authentication
router.use(authenticateJWT);

// ─── Statistics (must be before :caseId param routes) ─────────────────────────
router.get('/stats',                          requireReader,       caseController.getCaseStats);

// ─── Cases ────────────────────────────────────────────────────────────────────
router.get('/',                               requireReader,       caseController.listCases);
router.get('/:caseId',                        requireReader,       caseController.getCase);
router.post('/',                              requireInvestigator, caseController.createCase);
router.patch('/:caseId',                      requireInvestigator, caseController.updateCase);
router.delete('/:caseId',                     requireAdmin,        caseController.deleteCase);

// ─── Evidence ─────────────────────────────────────────────────────────────────
router.get('/:caseId/evidence',               requireReader,       caseController.listEvidence);
router.post('/:caseId/evidence',              requireInvestigator, caseController.addEvidence);
router.delete('/:caseId/evidence/:evidenceId', requireAnalyst,     caseController.removeEvidence);

// ─── Comments ─────────────────────────────────────────────────────────────────
router.get('/:caseId/comments',               requireReader,       caseController.listComments);
router.post('/:caseId/comments',              requireInvestigator, caseController.addComment);
router.delete('/:caseId/comments/:commentId', requireAnalyst,      caseController.deleteComment);

module.exports = router;
