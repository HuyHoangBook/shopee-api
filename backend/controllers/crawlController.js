const CrawlQueue = require('../models/crawlQueueModel');
const CrawledData = require('../models/crawledDataModel');
const shopeeApiService = require('../services/shopeeApiService');
const Config = require('../models/configModel');

// @desc    Get current crawl queue
// @route   GET /api/crawl/queue
// @access  Public
const getCrawlQueue = async (req, res) => {
  try {
    const { status, rating } = req.query;
    
    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }
    if (rating) {
      query.targetRatings = parseInt(rating);
    }
    
    const queue = await CrawlQueue.find(query).sort({ createdAt: -1 });
    res.json(queue);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Add URLs to crawl queue
// @route   POST /api/crawl/queue
// @access  Public
const addToCrawlQueue = async (req, res) => {
  try {
    const { urls, ratings } = req.body;
    
    if (!urls || !urls.length || !ratings || !ratings.length) {
      return res.status(400).json({ message: 'URLs and target ratings are required' });
    }
    
    // Validate ratings
    const validRatings = ratings.filter(r => r >= 1 && r <= 5);
    if (validRatings.length === 0) {
      return res.status(400).json({ message: 'At least one valid rating (1-5) is required' });
    }
    
    const results = [];
    const errors = [];
    
    // Process each URL
    for (const url of urls) {
      const ids = CrawlQueue.extractShopeeIds(url);
      
      if (!ids) {
        errors.push({ url, error: 'Invalid Shopee URL format' });
        continue;
      }
      
      // Check if already in queue with same ratings
      const existing = await CrawlQueue.findOne({ 
        url, 
        targetRatings: { $all: validRatings },
        status: { $in: ['pending', 'processing'] }
      });
      
      if (existing) {
        results.push({ url, message: 'URL already in queue with the same ratings' });
        continue;
      }
      
      // Add to queue
      const queueItem = new CrawlQueue({
        url,
        productId: ids.itemId,
        shopId: ids.shopId,
        targetRatings: validRatings,
        status: 'pending'
      });
      
      await queueItem.save();
      results.push({ url, message: 'Added to queue successfully', queueItem });
    }
    
    res.json({ results, errors });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Remove URL from crawl queue
// @route   DELETE /api/crawl/queue/:id
// @access  Public
const removeFromCrawlQueue = async (req, res) => {
  try {
    const queueItem = await CrawlQueue.findById(req.params.id);
    
    if (!queueItem) {
      return res.status(404).json({ message: 'Queue item not found' });
    }
    
    // Only allow deleting pending items
    if (queueItem.status !== 'pending') {
      return res.status(400).json({ message: 'Cannot remove items that are already processing or completed' });
    }
    
    await queueItem.remove();
    res.json({ message: 'Removed from queue' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Run crawl manually for specific ratings
// @route   POST /api/crawl/run
// @access  Public
const runCrawlManually = async (req, res) => {
  try {
    const { ratings } = req.body;

    console.log(ratings);
    
    if (!ratings || !ratings.length) {
      return res.status(400).json({ message: 'Target ratings are required' });
    }
    
    // Start crawling in the background (don't wait for completion)
    shopeeApiService.processCrawlQueue(ratings);
    
    res.json({ message: 'Crawl process started' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get current crawl status
// @route   GET /api/crawl/status
// @access  Public
const getCrawlStatus = async (req, res) => {
  try {
    // Get counts of items in each status
    const counts = {
      pending: await CrawlQueue.countDocuments({ status: 'pending' }),
      processing: await CrawlQueue.countDocuments({ status: 'processing' }),
      completed: await CrawlQueue.countDocuments({ status: 'completed' }),
      error: await CrawlQueue.countDocuments({ status: 'error' }),
      total: await CrawlQueue.countDocuments({}),
    };
    
    // Get latest processing items
    const processingItems = await CrawlQueue.find({ status: 'processing' })
      .sort({ lastAttemptedAt: -1 })
      .limit(5);
    
    // Get latest completed items
    const completedItems = await CrawlQueue.find({ status: 'completed' })
      .sort({ updatedAt: -1 })
      .limit(5);
    
    // Get latest error items
    const errorItems = await CrawlQueue.find({ status: 'error' })
      .sort({ updatedAt: -1 })
      .limit(5);
    
    res.json({
      counts,
      processingItems,
      completedItems,
      errorItems,
      isCurrentlyCrawling: shopeeApiService.isCurrentlyCrawling(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get crawled data
// @route   GET /api/data
// @access  Public
const getCrawledData = async (req, res) => {
  try {
    const { productId, rating, limit = 50, page = 1 } = req.query;
    
    const query = {};
    if (productId) query.productId = productId;
    if (rating) query.ratingStar = parseInt(rating);
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const data = await CrawledData.find(query)
      .sort({ commentTimestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await CrawledData.countDocuments(query);
    
    res.json({
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Export crawled data for download
// @route   GET /api/data/export
// @access  Public
const exportCrawledData = async (req, res) => {
  try {
    const { productId, rating, format = 'json' } = req.query;
    
    const query = {};
    if (productId) query.productId = productId;
    if (rating) query.ratingStar = parseInt(rating);
    
    const data = await CrawledData.find(query).sort({ commentTimestamp: -1 });
    
    if (format.toLowerCase() === 'csv') {
      // Generate CSV
      const csvHeader = 'productId,originalUrl,ratingStar,commentId,commentText,commenterUsername,commentTimestamp\n';
      
      const csvRows = data.map(item => {
        // Escape any commas in text fields and wrap in quotes
        const safeText = item.commentText ? `"${item.commentText.replace(/"/g, '""')}"` : '';
        const safeUsername = item.commenterUsername ? `"${item.commenterUsername.replace(/"/g, '""')}"` : '';
        
        return [
          item.productId,
          item.originalUrl,
          item.ratingStar,
          item.commentId,
          safeText,
          safeUsername,
          item.commentTimestamp ? new Date(item.commentTimestamp).toISOString() : ''
        ].join(',');
      });
      
      const csv = csvHeader + csvRows.join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="shopee_data_${new Date().toISOString()}.csv"`);
      return res.send(csv);
    }
    
    // Default: JSON format
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="shopee_data_${new Date().toISOString()}.json"`);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

module.exports = {
  getCrawlQueue,
  addToCrawlQueue,
  removeFromCrawlQueue,
  runCrawlManually,
  getCrawlStatus,
  getCrawledData,
  exportCrawledData,
}; 