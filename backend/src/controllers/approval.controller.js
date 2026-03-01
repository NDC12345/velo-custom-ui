/**
 * Approval controller — request / approve / reject sensitive operations.
 */

const approvalService = require('../services/approval.service');

async function listApprovals(req, res, next) {
    try {
        const { status, limit, offset } = req.query;
        const approvals = await approvalService.listApprovals({
            orgId: req.orgId,
            status,
            limit: parseInt(limit, 10) || 50,
            offset: parseInt(offset, 10) || 0,
        });
        res.json({ items: approvals });
    } catch (err) { next(err); }
}

async function getApproval(req, res, next) {
    try {
        const approval = await approvalService.getApproval(req.params.approvalId);
        if (!approval) return res.status(404).json({ error: 'Approval request not found' });
        res.json(approval);
    } catch (err) { next(err); }
}

async function createApproval(req, res, next) {
    try {
        const { actionType, actionPayload, targetResource, reason } = req.body;
        if (!actionType) return res.status(400).json({ error: 'actionType is required' });

        const approval = await approvalService.createApproval({
            orgId: req.orgId,
            requesterId: req.user.userId,
            actionType,
            actionPayload: actionPayload || {},
            targetResource,
            reason,
        });
        res.status(201).json(approval);
    } catch (err) { next(err); }
}

async function decideApproval(req, res, next) {
    try {
        const { decision, decisionNote } = req.body;
        if (!decision) return res.status(400).json({ error: 'decision is required (approved/rejected)' });

        // Prevent self-approval
        const existing = await approvalService.getApproval(req.params.approvalId);
        if (existing && existing.requester_id === req.user.userId) {
            return res.status(403).json({ error: 'Cannot approve your own request' });
        }

        const result = await approvalService.decideApproval(
            req.params.approvalId, req.user.userId, decision, decisionNote
        );
        res.json(result);
    } catch (err) {
        if (err.message.includes('not found or already decided')) {
            return res.status(409).json({ error: err.message });
        }
        next(err);
    }
}

async function cancelApproval(req, res, next) {
    try {
        const result = await approvalService.cancelApproval(req.params.approvalId, req.user.userId);
        if (!result) return res.status(404).json({ error: 'Approval not found or not pending' });
        res.json(result);
    } catch (err) { next(err); }
}

async function getPendingCount(req, res, next) {
    try {
        const count = await approvalService.getPendingCount(req.orgId);
        res.json({ count });
    } catch (err) { next(err); }
}

module.exports = { listApprovals, getApproval, createApproval, decideApproval, cancelApproval, getPendingCount };
