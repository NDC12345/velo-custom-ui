/**
 * Approval workflow routes.
 */

const router = require('express').Router();
const { authenticateJWT } = require('../middleware/auth');
const { requireInvestigator, requireAdminOrOrgAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/approval.controller');

router.use(authenticateJWT);

router.get('/',                          ctrl.listApprovals);
router.get('/pending-count',             ctrl.getPendingCount);
router.get('/:approvalId',              ctrl.getApproval);
router.post('/',                         requireInvestigator, ctrl.createApproval);
router.post('/:approvalId/decide',       requireAdminOrOrgAdmin, ctrl.decideApproval);
router.post('/:approvalId/cancel',       ctrl.cancelApproval);

module.exports = router;
