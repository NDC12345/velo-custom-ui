/**
 * Saved queries routes.
 */

const router = require('express').Router();
const { authenticateJWT } = require('../middleware/auth');
const { requireReader } = require('../middleware/rbac');
const ctrl = require('../controllers/savedQuery.controller');

router.use(authenticateJWT);

router.get('/',                  requireReader, ctrl.listQueries);
router.get('/:queryId',          requireReader, ctrl.getQuery);
router.post('/',                 ctrl.createQuery);
router.put('/:queryId',          ctrl.updateQuery);
router.delete('/:queryId',       ctrl.deleteQuery);
router.post('/:queryId/run',     ctrl.runQuery);

module.exports = router;
