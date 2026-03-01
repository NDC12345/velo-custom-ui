/**
 * Alert rules routes.
 */

const router = require('express').Router();
const { authenticateJWT } = require('../middleware/auth');
const { requireAnalyst, requireAdminOrOrgAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/alertRule.controller');

router.use(authenticateJWT);

router.get('/',                  ctrl.listRules);
router.get('/:ruleId',          ctrl.getRule);
router.post('/',                 requireAnalyst, ctrl.createRule);
router.put('/:ruleId',          requireAnalyst, ctrl.updateRule);
router.delete('/:ruleId',       requireAdminOrOrgAdmin, ctrl.deleteRule);

module.exports = router;
