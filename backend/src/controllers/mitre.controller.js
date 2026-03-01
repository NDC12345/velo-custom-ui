/**
 * MITRE ATT&CK controller.
 */

const mitreService = require('../services/mitre.service');

async function listMappings(req, res, next) {
    try {
        const { tactic, caseId, limit } = req.query;
        const mappings = await mitreService.listMappings({
            orgId: req.orgId,
            tactic,
            caseId,
            limit: parseInt(limit, 10) || 200,
        });
        res.json({ items: mappings });
    } catch (err) { next(err); }
}

async function addMapping(req, res, next) {
    try {
        const { techniqueId, techniqueName, tactic, artifactName, huntId, caseId, notes } = req.body;
        if (!techniqueId || !techniqueName || !tactic) {
            return res.status(400).json({ error: 'techniqueId, techniqueName, and tactic are required' });
        }

        const mapping = await mitreService.addMapping({
            orgId: req.orgId,
            techniqueId, techniqueName, tactic, artifactName, huntId, caseId, notes,
        });
        res.status(201).json(mapping);
    } catch (err) { next(err); }
}

async function deleteMapping(req, res, next) {
    try {
        await mitreService.deleteMapping(req.params.mappingId);
        res.status(204).end();
    } catch (err) { next(err); }
}

async function getMatrix(req, res, next) {
    try {
        const matrix = await mitreService.getMatrix(req.orgId);
        res.json(matrix);
    } catch (err) { next(err); }
}

async function getCoverage(req, res, next) {
    try {
        const coverage = await mitreService.getCoverage(req.orgId);
        res.json(coverage);
    } catch (err) { next(err); }
}

module.exports = { listMappings, addMapping, deleteMapping, getMatrix, getCoverage };
