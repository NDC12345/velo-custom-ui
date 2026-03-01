/**
 * MITRE ATT&CK mapping routes.
 */

const router = require('express').Router();
const { authenticateJWT } = require('../middleware/auth');
const { requireReader, requireAnalyst } = require('../middleware/rbac');
const ctrl = require('../controllers/mitre.controller');

router.use(authenticateJWT);

router.get('/',                  requireReader, ctrl.listMappings);
router.get('/matrix',            requireReader, ctrl.getMatrix);
router.get('/coverage',          requireReader, ctrl.getCoverage);
router.post('/',                 requireAnalyst, ctrl.addMapping);
router.delete('/:mappingId',     requireAnalyst, ctrl.deleteMapping);

module.exports = router;
