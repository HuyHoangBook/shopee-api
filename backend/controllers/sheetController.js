const CrawledData = require('../models/crawledDataModel');
const Config = require('../models/configModel');
const googleSheetService = require('../services/googleSheetService');

// @desc    Get Google Sheet sync status
// @route   GET /api/sheet/status
// @access  Public
const getSheetStatus = async (req, res) => {
  try {
    const config = await Config.getConfig();
    
    if (!config.googleSheetId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Google Sheet ID not configured',
        isConfigured: false
      });
    }
    
    // Get counts
    const totalRecords = await CrawledData.countDocuments({});
    const syncedRecords = await CrawledData.countDocuments({ savedToSheet: true });
    const pendingRecords = await CrawledData.countDocuments({ savedToSheet: false });
    
    // Get some recent records that need syncing
    const pendingSamples = await CrawledData.find({ savedToSheet: false })
      .sort({ createdAt: -1 })
      .limit(5);
    
    res.json({
      success: true,
      isConfigured: true,
      sheetId: config.googleSheetId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${config.googleSheetId}`,
      counts: {
        total: totalRecords,
        synced: syncedRecords,
        pending: pendingRecords,
      },
      pendingSamples,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Sync crawled data to Google Sheet
// @route   POST /api/sheet/sync
// @access  Public
const syncDataToSheet = async (req, res) => {
  try {
    const config = await Config.getConfig();
    
    if (!config.googleSheetId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Google Sheet ID not configured'
      });
    }
    
    // Start the sync process in background
    googleSheetService.syncCrawledDataToSheet(config.googleSheetId);
    
    res.json({
      success: true,
      message: 'Data sync to Google Sheets started',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

module.exports = {
  getSheetStatus,
  syncDataToSheet,
}; 