const Config = require('../models/configModel');

// @desc    Get system configuration
// @route   GET /api/config
// @access  Public
const getConfig = async (req, res) => {
  try {
    const config = await Config.getConfig();
    res.json(config);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Update system configuration
// @route   POST /api/config
// @access  Public
const updateConfig = async (req, res) => {
  try {
    const { apiKey, baseUrl, defaultHeaders } = req.body;

    if (!apiKey || !baseUrl || !defaultHeaders) {
      return res.status(400).json({ message: 'Missing required configuration fields' });
    }

    let config = await Config.findOne({});
    if (!config) {
      config = new Config({
        apiKey,
        baseUrl,
        defaultHeaders,
      });
    } else {
      config.apiKey = apiKey;
      config.baseUrl = baseUrl;
      config.defaultHeaders = defaultHeaders;
    }

    await config.save();
    res.json(config);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Update comment limits per rating
// @route   POST /api/config/commentLimits
// @access  Public
const updateCommentLimits = async (req, res) => {
  try {
    const { commentLimits } = req.body;

    if (!commentLimits || typeof commentLimits !== 'object') {
      return res.status(400).json({ message: 'Invalid comment limits' });
    }

    // Validate that all ratings 1-5 have numeric limits
    for (let i = 1; i <= 5; i++) {
      if (!commentLimits[i] || typeof commentLimits[i] !== 'number') {
        return res.status(400).json({ message: `Missing or invalid limit for rating ${i}` });
      }
    }

    let config = await Config.findOne({});
    if (!config) {
      config = new Config({
        apiKey: 'placeholder',
        baseUrl: 'placeholder',
        defaultHeaders: {},
        commentLimitsPerRating: commentLimits,
      });
    } else {
      config.commentLimitsPerRating = commentLimits;
    }

    await config.save();
    res.json(config);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Update cronjob settings
// @route   POST /api/config/cronjob
// @access  Public
const updateCronjobSettings = async (req, res) => {
  try {
    const { enabled, schedule, maxUrlsPerRun } = req.body;

    if (enabled === undefined || !schedule || !maxUrlsPerRun) {
      return res.status(400).json({ message: 'Missing required cronjob settings' });
    }

    let config = await Config.findOne({});
    if (!config) {
      config = new Config({
        apiKey: 'placeholder',
        baseUrl: 'placeholder',
        defaultHeaders: {},
        cronjobSettings: {
          enabled,
          schedule,
          maxUrlsPerRun,
        },
      });
    } else {
      config.cronjobSettings = {
        enabled,
        schedule,
        maxUrlsPerRun,
      };
    }

    await config.save();
    res.json(config);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Update Google Sheet configuration
// @route   POST /api/config/googleSheet
// @access  Public
const updateGoogleSheetConfig = async (req, res) => {
  try {
    const { googleSheetId } = req.body;

    if (!googleSheetId) {
      return res.status(400).json({ message: 'Missing Google Sheet ID' });
    }

    let config = await Config.findOne({});
    if (!config) {
      config = new Config({
        apiKey: 'placeholder',
        baseUrl: 'placeholder',
        defaultHeaders: {},
        googleSheetId,
      });
    } else {
      config.googleSheetId = googleSheetId;
    }

    await config.save();
    res.json(config);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

module.exports = {
  getConfig,
  updateConfig,
  updateCommentLimits,
  updateCronjobSettings,
  updateGoogleSheetConfig,
}; 