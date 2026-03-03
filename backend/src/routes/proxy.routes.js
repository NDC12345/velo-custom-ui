const express = require('express');
const multer = require('multer');
const proxyController = require('../controllers/proxy.controller');
const { authenticateJWT } = require('../middleware/auth');

// Memory-storage multer for tool binary uploads (max 100 MB)
const toolUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

/**
 * Wraps a multer middleware and returns a proper 400/413 JSON response on
 * MulterError instead of crashing the asyncHandler chain.
 */
function safeSingleUpload(multerMiddleware) {
    return (req, res, next) => {
        multerMiddleware(req, res, (err) => {
            if (err) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(413).json({ error: 'File too large. Maximum allowed size is 100 MB.' });
                }
                if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                    return res.status(400).json({ error: 'Unexpected form field. Expected a single file field named \'file\'.' });
                }
                return res.status(400).json({ error: 'File upload error: ' + (err.message || 'Unknown error') });
            }
            next();
        });
    };
}
const { injectVeloCredentials } = require('../middleware/veloCredentials');
const {
    requireReader,
    requireInvestigator,
    requireAnalyst,
    requireOrgAdmin,
    requireAdmin,
    requireAdminOrOrgAdmin,
} = require('../middleware/rbac');
const {
    clientValidators,
    huntValidators,
    flowValidators,
    artifactValidators,
    vfsValidators,
    notebookValidators,
} = require('../middleware/validation');

const router = express.Router();

// All proxy routes require authentication + Velo credential injection
router.use(authenticateJWT, injectVeloCredentials);

//  CLIENTS 
// reader+: search, view, metadata read
// investigator+: trigger flows, send notifications
// analyst+: set metadata, label
// admin: delete clients

router.get('/clients',                  requireReader,       clientValidators.search,    proxyController.searchClients);
router.get('/clients/:clientId',        requireReader,       clientValidators.getClient, proxyController.getClient);
router.get('/clients/:clientId/flows',  requireReader,       clientValidators.getClient, proxyController.getClientFlows);
router.get('/clients/:clientId/metadata', requireReader,     clientValidators.getClient, proxyController.getClientMetadata);
router.post('/clients/:clientId/metadata', requireAnalyst,   clientValidators.getClient, proxyController.setClientMetadata);
router.post('/clients/label',           requireInvestigator,                             proxyController.labelClients);
router.post('/clients/:clientId/notify', requireInvestigator,                            proxyController.notifyClient);
router.delete('/clients/:clientId',     requireAdmin,        clientValidators.getClient, proxyController.deleteClient);

//  HOST QUARANTINE 
// investigator+: quarantine/unquarantine a host return

router.post('/clients/:clientId/quarantine', requireInvestigator, clientValidators.getClient, proxyController.quarantineClient);

//  INTERACTIVE SHELL 
// analyst+: execute shell commands on a client

router.post('/clients/:clientId/shell',      requireAnalyst,      clientValidators.getClient, proxyController.executeShell);
router.get('/clients/:clientId/shell/:flowId', requireAnalyst,    clientValidators.getClient, proxyController.getShellResults);

//  HUNTS 
// reader+: view/list
// investigator+: create, estimate
// analyst+: modify, archive
// admin: delete

router.get('/hunts',                    requireReader,       huntValidators.getHunts,    proxyController.getHunts);
router.get('/hunts/:huntId',            requireReader,       huntValidators.getHunt,     proxyController.getHunt);
router.get('/hunts/:huntId/results',    requireReader,       huntValidators.getHunt,     proxyController.getHuntResults);
router.get('/hunts/:huntId/stats',      requireReader,       huntValidators.getHunt,     proxyController.getHuntStats);
router.get('/hunts/:huntId/flows',      requireReader,       huntValidators.getHunt,     proxyController.getHuntFlows);
router.get('/hunts/:huntId/tags',       requireReader,       huntValidators.getHunt,     proxyController.getHuntTags);
router.post('/hunts/estimate',          requireInvestigator,                             proxyController.estimateHunt);
router.post('/hunts',                   requireInvestigator,                             proxyController.createHunt);
router.patch('/hunts/:huntId',          requireAnalyst,      huntValidators.getHunt,     proxyController.modifyHunt);
router.delete('/hunts/:huntId',         requireAnalyst,      huntValidators.getHunt,     proxyController.deleteHunt);

//  FLOWS / COLLECTIONS 
// reader+: view, results, requests
// investigator+: collect (start flow), cancel, resume
// analyst+: archive

router.post('/flows/collect',           requireInvestigator,                             proxyController.collectArtifact);
router.get('/flows/:flowId',            requireReader,       flowValidators.getFlow,     proxyController.getFlow);
router.get('/flows/:flowId/results',    requireReader,       flowValidators.getFlow,     proxyController.getFlowResults);
router.get('/flows/:flowId/requests',   requireReader,       flowValidators.getFlow,     proxyController.getFlowRequests);
router.post('/flows/:flowId/cancel',    requireInvestigator, flowValidators.getFlow,     proxyController.cancelFlow);
router.post('/flows/:flowId/resume',    requireInvestigator, flowValidators.getFlow,     proxyController.resumeFlow);
router.post('/flows/:flowId/archive',   requireAnalyst,      flowValidators.getFlow,     proxyController.archiveFlow);

//  ARTIFACTS 
// reader+: list, view
// analyst+: create, update, upload pack
// admin: delete

router.get('/artifacts',                requireReader,                                   proxyController.getArtifacts);
router.get('/artifacts/:artifactName',  requireReader,       artifactValidators.getArtifact, proxyController.getArtifact);
router.get('/artifacts/:artifactName/file', requireReader,   artifactValidators.getArtifact, proxyController.getArtifactFile);
router.post('/artifacts',               requireAnalyst,                                  proxyController.setArtifact);
router.post('/artifacts/pack',          requireAnalyst,                                  proxyController.loadArtifactPack);
router.delete('/artifacts/:artifactName', requireAdmin,      artifactValidators.getArtifact, proxyController.deleteArtifact);

//  VFS 
// reader+: browse, stat
// investigator+: refresh, download

router.get('/vfs/:clientId',             requireReader,      vfsValidators.listDirectory, proxyController.vfsListDirectory);
router.get('/vfs/:clientId/files',       requireReader,      vfsValidators.listDirectory, proxyController.vfsListDirectoryFiles);
router.get('/vfs/:clientId/stat',        requireReader,      vfsValidators.listDirectory, proxyController.vfsStatFile);
router.get('/vfs/:clientId/stat-dir',    requireReader,      vfsValidators.listDirectory, proxyController.vfsStatDirectory);
router.get('/vfs/:clientId/stat-download', requireReader,    vfsValidators.listDirectory, proxyController.vfsStatDownload);
router.get('/vfs/:clientId/download',    requireInvestigator, vfsValidators.listDirectory, proxyController.vfsDownloadFile);
router.post('/vfs/:clientId/download',   requireInvestigator, vfsValidators.listDirectory, proxyController.vfsDownloadFilePost);
router.post('/vfs/:clientId/refresh',    requireInvestigator, vfsValidators.listDirectory, proxyController.vfsRefreshDirectory);

//  NOTEBOOKS 
// reader+: list, view, cells
// analyst+: create, update, cell ops, download, attachments
// admin: delete

router.get('/notebooks',                         requireReader,    proxyController.getNotebooks);
router.get('/notebooks/:notebookId',             requireReader,    notebookValidators.getNotebook, proxyController.getNotebook);
router.get('/notebooks/:notebookId/cells/:cellId', requireReader,  notebookValidators.getNotebook, proxyController.getNotebookCell);
router.get('/notebooks/:notebookId/export',      requireReader,    notebookValidators.getNotebook, proxyController.exportNotebook);
router.post('/notebooks',                        requireAnalyst,   proxyController.createNotebook);
router.put('/notebooks/:notebookId',             requireAnalyst,   notebookValidators.getNotebook, proxyController.updateNotebook);
router.post('/notebooks/:notebookId/cells',      requireAnalyst,   notebookValidators.getNotebook, proxyController.updateNotebookCell);
router.post('/notebooks/:notebookId/cells/new',  requireAnalyst,   notebookValidators.getNotebook, proxyController.newNotebookCell);
router.post('/notebooks/:notebookId/cells/:cellId/revert', requireAnalyst, notebookValidators.getNotebook, proxyController.revertNotebookCell);
router.post('/notebooks/:notebookId/cells/:cellId/cancel', requireAnalyst, notebookValidators.getNotebook, proxyController.cancelNotebookCell);
router.post('/notebooks/:notebookId/download',   requireAnalyst,   notebookValidators.getNotebook, proxyController.createNotebookDownloadFile);
router.post('/notebooks/:notebookId/attachment', requireAnalyst,   notebookValidators.getNotebook, proxyController.uploadNotebookAttachment);
router.delete('/notebooks/:notebookId/attachment', requireAnalyst, notebookValidators.getNotebook, proxyController.removeNotebookAttachment);
router.delete('/notebooks/:notebookId',          requireAdmin,     notebookValidators.getNotebook, proxyController.deleteNotebook);

//  SERVER MONITORING â”€
// reader+: metrics, monitoring read
// admin: modify monitoring, events, client monitoring write

router.get('/server/metrics',           requireReader,                                   proxyController.getServerMetrics);
router.get('/server/metadata',          requireReader,                                   proxyController.getServerMetadata);
router.get('/server/monitoring',        requireReader,                                   proxyController.getServerMonitoring);
router.post('/server/monitoring',       requireAdmin,                                    proxyController.setServerMonitoring);
router.post('/server/events',           requireAnalyst,                                  proxyController.queryServerEvents);
router.get('/server/client-monitoring', requireReader,                                   proxyController.getClientMonitoring);
router.post('/server/client-monitoring', requireAdmin,                                   proxyController.setClientMonitoring);
router.post('/server/client-config',    requireAdmin,                                    proxyController.generateClientConfig);
router.post('/server/create-download',  requireAdmin,                                    proxyController.createDownloadFile);

//  EVENTS 

router.get('/events/available',         requireReader,                                   proxyController.listAvailableEventResults);
router.post('/events/push',             requireAnalyst,                                  proxyController.pushEvents);

//  USER MANAGEMENT 
// reader+: own traits, favorites
// org_admin+: list users, manage roles, passwords
// admin: delete users

router.get('/users/me/traits',          requireReader,                                   proxyController.getUserUITraits);
router.get('/users/me/favorites',       requireReader,                                   proxyController.getUserFavorites);
router.post('/users/me/gui-options',    requireReader,                                   proxyController.setGUIOptions);
router.get('/users',                    requireOrgAdmin,                                 proxyController.getUsers);
router.get('/users/global',             requireOrgAdmin,                                 proxyController.getGlobalUsers);
router.get('/users/:username',          requireOrgAdmin,                                 proxyController.getUser);
router.get('/users/:username/roles',    requireOrgAdmin,                                 proxyController.getUserRoles);
router.post('/users/:username/roles',   requireOrgAdmin,                                 proxyController.setUserRoles);
router.post('/users',                   requireOrgAdmin,                                 proxyController.setUser);
router.post('/users/:username/password', requireOrgAdmin,                                proxyController.setUserPassword);
router.delete('/users/:username',       requireAdmin,                                    proxyController.deleteUser);

//  DOWNLOADS 

router.post('/downloads',               requireInvestigator,                             proxyController.createDownload);
router.get('/downloads/:downloadId',    requireInvestigator,                             proxyController.getDownload);

//  SEARCH & QUERY â”€

router.post('/query',                   requireAnalyst,                                  proxyController.executeQuery);
router.post('/search',                  requireReader,                                   proxyController.searchIndicators);
router.get('/completions',              requireReader,                                   proxyController.getCompletions);
router.post('/vql/reformat',            requireReader,                                   proxyController.reformatVQL);

//  TOOLS â”€
// reader+: list tools, get single tool
// analyst+: set/upload
// admin: delete

router.get('/tools',                    requireReader,                                   proxyController.getTools);
router.get('/tools/:toolName',          requireReader,                                   proxyController.getToolInfo);
router.post('/tools',                   requireAnalyst,                                  proxyController.setToolInfo);
router.delete('/tools/:toolName',       requireAdmin,                                    proxyController.deleteTool);
router.post('/uploads/tool',            requireAnalyst,  safeSingleUpload(toolUpload.single('file')), proxyController.uploadTool);
router.post('/uploads/file',            requireAnalyst,                                  proxyController.uploadFormFile);

//  SECRETS 
// org_admin+: all secret operations

router.get('/secrets',                  requireOrgAdmin,                                 proxyController.getSecrets);
router.get('/secrets/:type',            requireOrgAdmin,                                 proxyController.getSecret);
router.post('/secrets',                 requireOrgAdmin,                                 proxyController.defineSecret);
router.post('/secrets/:type/add',       requireOrgAdmin,                                 proxyController.addSecret);
router.put('/secrets/:type',            requireOrgAdmin,                                 proxyController.modifySecret);

//  TIMELINES 

router.post('/timelines',               requireReader,                                   proxyController.getTimeline);
router.post('/timelines/annotate',      requireAnalyst,                                  proxyController.annotateTimeline);

//  TABLE & REPORTS 

router.get('/table',                    requireReader,                                   proxyController.getTable);
router.post('/table/download',          requireInvestigator,                             proxyController.downloadTable);
router.post('/reports/generate',        requireAnalyst,                                  proxyController.getReport);

//  FILE SEARCH & DOCS 

router.post('/file-search',             requireReader,                                   proxyController.searchFile);
router.get('/docs/search',              requireReader,                                   proxyController.searchDocs);

//  HEALTH CHECK 

router.get('/health/velo',              requireReader,                                   proxyController.healthCheck);

module.exports = router;
