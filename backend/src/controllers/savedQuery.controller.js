/**
 * Saved queries controller.
 */

const savedQueryService = require('../services/savedQuery.service');

async function listQueries(req, res, next) {
    try {
        const { queryType, shared, limit, offset } = req.query;
        const queries = await savedQueryService.listQueries({
            orgId: req.orgId,
            userId: shared === 'true' ? null : req.user.userId,
            queryType,
            isShared: shared === 'true',
            limit: parseInt(limit, 10) || 50,
            offset: parseInt(offset, 10) || 0,
        });
        res.json({ items: queries });
    } catch (err) { next(err); }
}

async function getQuery(req, res, next) {
    try {
        const q = await savedQueryService.getQuery(req.params.queryId);
        if (!q) return res.status(404).json({ error: 'Query not found' });
        res.json(q);
    } catch (err) { next(err); }
}

async function createQuery(req, res, next) {
    try {
        const { name, description, queryType, queryText, parameters, isShared, tags } = req.body;
        if (!name || !queryText) return res.status(400).json({ error: 'name and queryText are required' });

        const q = await savedQueryService.createQuery({
            orgId: req.orgId,
            userId: req.user.userId,
            name, description, queryType, queryText, parameters, isShared, tags,
        });
        res.status(201).json(q);
    } catch (err) { next(err); }
}

async function updateQuery(req, res, next) {
    try {
        const q = await savedQueryService.updateQuery(req.params.queryId, req.user.userId, req.body);
        if (!q) return res.status(404).json({ error: 'Query not found or not owned by you' });
        res.json(q);
    } catch (err) { next(err); }
}

async function deleteQuery(req, res, next) {
    try {
        await savedQueryService.deleteQuery(req.params.queryId, req.user.userId);
        res.status(204).end();
    } catch (err) { next(err); }
}

async function runQuery(req, res, next) {
    try {
        await savedQueryService.recordRun(req.params.queryId);
        res.json({ message: 'Run recorded — execute query client-side' });
    } catch (err) { next(err); }
}

module.exports = { listQueries, getQuery, createQuery, updateQuery, deleteQuery, runQuery };
