/**
 * Organization controller — handles HTTP requests for org management.
 */

const orgService = require('../services/org.service');
const logger = require('../utils/logger');

// ─── Organizations ──────────────────────────────────────────────────────────

async function listOrgs(req, res, next) {
    try {
        const orgs = await orgService.listOrgs();
        res.json({ items: orgs });
    } catch (err) { next(err); }
}

async function getOrg(req, res, next) {
    try {
        const org = await orgService.getOrg(req.params.orgId);
        if (!org) return res.status(404).json({ error: 'Organization not found' });
        res.json(org);
    } catch (err) { next(err); }
}

async function createOrg(req, res, next) {
    try {
        const org = await orgService.createOrg(req.body);
        // Automatically add creator as owner
        await orgService.addMember(org.id, req.user.userId, 'owner');
        res.status(201).json(org);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Organization name or slug already exists' });
        next(err);
    }
}

async function updateOrg(req, res, next) {
    try {
        const org = await orgService.updateOrg(req.params.orgId, req.body);
        if (!org) return res.status(404).json({ error: 'Organization not found' });
        res.json(org);
    } catch (err) { next(err); }
}

async function deleteOrg(req, res, next) {
    try {
        await orgService.deleteOrg(req.params.orgId);
        res.status(204).end();
    } catch (err) { next(err); }
}

// ─── Members ────────────────────────────────────────────────────────────────

async function listMembers(req, res, next) {
    try {
        const members = await orgService.listMembers(req.params.orgId);
        res.json({ items: members });
    } catch (err) { next(err); }
}

async function addMember(req, res, next) {
    try {
        const { userId, role } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId is required' });
        const member = await orgService.addMember(req.params.orgId, userId, role || 'member', req.user.userId);
        res.status(201).json(member);
    } catch (err) { next(err); }
}

async function updateMemberRole(req, res, next) {
    try {
        const { role } = req.body;
        if (!role) return res.status(400).json({ error: 'role is required' });
        const member = await orgService.updateMemberRole(req.params.orgId, req.params.userId, role);
        if (!member) return res.status(404).json({ error: 'Member not found' });
        res.json(member);
    } catch (err) { next(err); }
}

async function removeMember(req, res, next) {
    try {
        await orgService.removeMember(req.params.orgId, req.params.userId);
        res.status(204).end();
    } catch (err) { next(err); }
}

// ─── API Keys ───────────────────────────────────────────────────────────────

async function listApiKeys(req, res, next) {
    try {
        const keys = await orgService.listApiKeys(req.params.orgId);
        res.json({ items: keys });
    } catch (err) { next(err); }
}

async function createApiKey(req, res, next) {
    try {
        const { name, scopes, expiresInDays } = req.body;
        if (!name) return res.status(400).json({ error: 'name is required' });
        const key = await orgService.createApiKey(req.params.orgId, req.user.userId, { name, scopes, expiresInDays });
        res.status(201).json(key);
    } catch (err) { next(err); }
}

async function revokeApiKey(req, res, next) {
    try {
        await orgService.revokeApiKey(req.params.keyId, req.params.orgId);
        res.status(204).end();
    } catch (err) { next(err); }
}

module.exports = {
    listOrgs, getOrg, createOrg, updateOrg, deleteOrg,
    listMembers, addMember, updateMemberRole, removeMember,
    listApiKeys, createApiKey, revokeApiKey,
};
