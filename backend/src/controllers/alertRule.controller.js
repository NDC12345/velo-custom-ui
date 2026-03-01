/**
 * Alert rules controller.
 */

const alertRuleService = require('../services/alertRule.service');

async function listRules(req, res, next) {
    try {
        const { ruleType, enabled, limit, offset } = req.query;
        const rules = await alertRuleService.listRules({
            orgId: req.orgId,
            ruleType,
            isEnabled: enabled !== undefined ? enabled === 'true' : undefined,
            limit: parseInt(limit, 10) || 50,
            offset: parseInt(offset, 10) || 0,
        });
        res.json({ items: rules });
    } catch (err) { next(err); }
}

async function getRule(req, res, next) {
    try {
        const rule = await alertRuleService.getRule(req.params.ruleId);
        if (!rule) return res.status(404).json({ error: 'Alert rule not found' });
        res.json(rule);
    } catch (err) { next(err); }
}

async function createRule(req, res, next) {
    try {
        const { name, description, ruleType, condition, vqlQuery, severity, actions, checkIntervalSec } = req.body;
        if (!name || !condition) return res.status(400).json({ error: 'name and condition are required' });

        const rule = await alertRuleService.createRule({
            orgId: req.orgId,
            createdBy: req.user.userId,
            name, description, ruleType, condition, vqlQuery, severity, actions, checkIntervalSec,
        });
        res.status(201).json(rule);
    } catch (err) { next(err); }
}

async function updateRule(req, res, next) {
    try {
        const rule = await alertRuleService.updateRule(req.params.ruleId, req.body);
        if (!rule) return res.status(404).json({ error: 'Alert rule not found' });
        res.json(rule);
    } catch (err) { next(err); }
}

async function deleteRule(req, res, next) {
    try {
        await alertRuleService.deleteRule(req.params.ruleId);
        res.status(204).end();
    } catch (err) { next(err); }
}

module.exports = { listRules, getRule, createRule, updateRule, deleteRule };
