/**
 * Organization routes — multi-org management, membership, API keys.
 */

const router = require('express').Router();
const { authenticateJWT } = require('../middleware/auth');
const { requireAdmin, requireAdminOrOrgAdmin } = require('../middleware/rbac');
const { requireOrgRole } = require('../middleware/orgContext');
const ctrl = require('../controllers/org.controller');

// All routes require authentication
router.use(authenticateJWT);

// ─── Organization CRUD ──────────────────────────────────────────────────────
router.get('/',               ctrl.listOrgs);
router.post('/',              requireAdmin, ctrl.createOrg);
router.get('/:orgId',         ctrl.getOrg);
router.put('/:orgId',         requireAdminOrOrgAdmin, ctrl.updateOrg);
router.delete('/:orgId',      requireAdmin, ctrl.deleteOrg);

// ─── Membership ─────────────────────────────────────────────────────────────
router.get('/:orgId/members',                  ctrl.listMembers);
router.post('/:orgId/members',                 requireAdminOrOrgAdmin, ctrl.addMember);
router.put('/:orgId/members/:userId',          requireAdminOrOrgAdmin, ctrl.updateMemberRole);
router.delete('/:orgId/members/:userId',       requireAdminOrOrgAdmin, ctrl.removeMember);

// ─── API Keys ───────────────────────────────────────────────────────────────
router.get('/:orgId/api-keys',                 ctrl.listApiKeys);
router.post('/:orgId/api-keys',                requireAdminOrOrgAdmin, ctrl.createApiKey);
router.delete('/:orgId/api-keys/:keyId',       requireAdminOrOrgAdmin, ctrl.revokeApiKey);

module.exports = router;
