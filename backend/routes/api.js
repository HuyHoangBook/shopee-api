const express = require('express');
const router = express.Router();

// Import controllers
const configController = require('../controllers/configController');
const crawlController = require('../controllers/crawlController');
const sheetController = require('../controllers/sheetController');

// Configuration routes
router.get('/config', configController.getConfig);
router.post('/config', configController.updateConfig);
router.post('/config/commentLimits', configController.updateCommentLimits);
router.post('/config/cronjob', configController.updateCronjobSettings);
router.post('/config/googleSheet', configController.updateGoogleSheetConfig);

// Crawl queue routes
router.get('/crawl/queue', crawlController.getCrawlQueue);
router.post('/crawl/queue', crawlController.addToCrawlQueue);
router.delete('/crawl/queue/:id', crawlController.removeFromCrawlQueue);
router.post('/crawl/run', crawlController.runCrawlManually);
router.get('/crawl/status', crawlController.getCrawlStatus);

// Crawled data routes
router.get('/data', crawlController.getCrawledData);
router.get('/data/export', crawlController.exportCrawledData);

// Google Sheet routes
router.get('/sheet/status', sheetController.getSheetStatus);
router.post('/sheet/sync', sheetController.syncDataToSheet);

module.exports = router; 