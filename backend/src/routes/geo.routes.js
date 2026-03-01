'use strict';
const express        = require('express');
const geoController  = require('../controllers/geo.controller');
const { authenticateJWT }       = require('../middleware/auth');
const { injectVeloCredentials } = require('../middleware/veloCredentials');
const { requireReader }         = require('../middleware/rbac');

const router = express.Router();

// All geo routes require JWT + Velo credentials
router.use(authenticateJWT, injectVeloCredentials);

/**
 * @route   GET /api/geo/clients
 * @desc    Velociraptor clients enriched with GeoIP (country, lat/lng, city, ISP)
 * @access  reader+
 * @returns { clients, country_summary, stats, timestamp }
 */
router.get('/clients', requireReader, geoController.getClientGeoData);

module.exports = router;
