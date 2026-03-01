/**
 * Case Management Controller
 *
 * Handles CRUD operations for investigation cases, evidence, and comments.
 */
'use strict';

const caseService = require('../services/case.service');
const { asyncHandler } = require('../middleware/errorHandler');
const { NotFoundError, ValidationError } = require('../utils/errors');

// ═══════════════════════════════════════════════════════════════════════════════
//  CASES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/cases — list investigation cases
 */
exports.listCases = asyncHandler(async (req, res) => {
    const { status, severity, assigned_to, search, offset = 0, limit = 50 } = req.query;
    const result = await caseService.listCases({
        status, severity, assigned_to, search,
        offset: parseInt(offset, 10),
        limit: Math.min(parseInt(limit, 10) || 50, 200),
    });
    res.json(result);
});

/**
 * GET /api/cases/:caseId — get case details
 */
exports.getCase = asyncHandler(async (req, res) => {
    const caseData = await caseService.getCase(req.params.caseId);
    if (!caseData) throw new NotFoundError('Case not found');
    res.json(caseData);
});

/**
 * POST /api/cases — create new case
 */
exports.createCase = asyncHandler(async (req, res) => {
    if (!req.body.title) {
        throw new ValidationError('Title is required');
    }
    const caseData = await caseService.createCase(req.body, req.user.userId);
    res.status(201).json(caseData);
});

/**
 * PATCH /api/cases/:caseId — update case
 */
exports.updateCase = asyncHandler(async (req, res) => {
    const caseData = await caseService.updateCase(req.params.caseId, req.body, req.user.userId);
    if (!caseData) throw new NotFoundError('Case not found');
    res.json(caseData);
});

/**
 * DELETE /api/cases/:caseId — delete case
 */
exports.deleteCase = asyncHandler(async (req, res) => {
    const deleted = await caseService.deleteCase(req.params.caseId);
    if (!deleted) throw new NotFoundError('Case not found');
    res.json({ message: 'Case deleted' });
});

/**
 * GET /api/cases/stats — case statistics for dashboard
 */
exports.getCaseStats = asyncHandler(async (req, res) => {
    const stats = await caseService.getCaseStats();
    res.json(stats);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  EVIDENCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/cases/:caseId/evidence — list evidence
 */
exports.listEvidence = asyncHandler(async (req, res) => {
    const result = await caseService.listCaseEvidence(req.params.caseId);
    res.json(result);
});

/**
 * POST /api/cases/:caseId/evidence — add evidence
 */
exports.addEvidence = asyncHandler(async (req, res) => {
    if (!req.body.title || !req.body.evidence_type) {
        throw new ValidationError('title and evidence_type are required');
    }
    const evidence = await caseService.addEvidence(req.params.caseId, req.body, req.user.userId);
    res.status(201).json(evidence);
});

/**
 * DELETE /api/cases/:caseId/evidence/:evidenceId — remove evidence
 */
exports.removeEvidence = asyncHandler(async (req, res) => {
    const deleted = await caseService.removeEvidence(req.params.evidenceId);
    if (!deleted) throw new NotFoundError('Evidence not found');
    res.json({ message: 'Evidence removed' });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  COMMENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/cases/:caseId/comments — list comments
 */
exports.listComments = asyncHandler(async (req, res) => {
    const result = await caseService.listCaseComments(req.params.caseId);
    res.json(result);
});

/**
 * POST /api/cases/:caseId/comments — add comment
 */
exports.addComment = asyncHandler(async (req, res) => {
    if (!req.body.content) {
        throw new ValidationError('content is required');
    }
    const comment = await caseService.addCaseComment(req.params.caseId, req.body, req.user.userId);
    res.status(201).json(comment);
});

/**
 * DELETE /api/cases/:caseId/comments/:commentId — delete comment
 */
exports.deleteComment = asyncHandler(async (req, res) => {
    const deleted = await caseService.deleteComment(req.params.commentId);
    if (!deleted) throw new NotFoundError('Comment not found');
    res.json({ message: 'Comment deleted' });
});
