const axios = require('axios');
const CrawlQueue = require('../models/crawlQueueModel');
const CrawledData = require('../models/crawledDataModel');
const Config = require('../models/configModel');
const googleSheetService = require('./googleSheetService');

let isCrawling = false;

// Enhanced logging function
function logApiDebug(message, data = null) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] [API-DEBUG] ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`[${timestamp}] [API-DEBUG] ${message}`);
  }
}

// Process items in the crawl queue for specified ratings
const processCrawlQueue = async (ratings = [1, 2, 3, 4, 5]) => {
  // Prevent multiple crawls running simultaneously
  if (isCrawling) {
    console.log('A crawl process is already running');
    return;
  }
  
  try {
    isCrawling = true;
    
    // Get configuration
    const config = await Config.getConfig();
    logApiDebug('Using API configuration:', {
      apiKey: config.apiKey ? '***' + config.apiKey.substring(config.apiKey.length - 8) : undefined,
      baseUrl: config.baseUrl,
      defaultHeaders: config.defaultHeaders
    });
    
    // Mặc định số lượng URL tối đa mỗi lần chạy
    const MAX_URLS_PER_RUN = 10;
    
    // Get pending items for the specified ratings
    const pendingItems = await CrawlQueue.find({
      status: 'pending',
      targetRatings: { $in: ratings }
    }).limit(MAX_URLS_PER_RUN);
    
    console.log(`Found ${pendingItems.length} pending items to crawl`);
    
    if (pendingItems.length === 0) {
      isCrawling = false;
      return;
    }
    
    // Process each item
    for (const item of pendingItems) {
      logApiDebug('Processing queue item:', {
        id: item._id,
        url: item.url,
        productId: item.productId,
        shopId: item.shopId,
        targetRatings: item.targetRatings
      });
      
      // Update status to processing
      item.status = 'processing';
      item.lastAttemptedAt = new Date();
      await item.save();
      
      try {
        // Process each target rating for this URL
        for (const rating of item.targetRatings) {
          if (item.completedRatings && item.completedRatings.includes(rating)) {
            console.log(`Rating ${rating} already crawled for ${item.url}`);
            continue;
          }
          
          // Get comments for this rating
          await crawlCommentsForRating(item.url, item.productId, item.shopId, rating, config);
          
          // Mark this rating as completed
          if (!item.completedRatings) {
            item.completedRatings = [];
          }
          item.completedRatings.push(rating);
          await item.save();
        }
        
        // Update status to completed
        item.status = 'completed';
        await item.save();
        logApiDebug('Item completed successfully:', {
          id: item._id,
          url: item.url,
          completedRatings: item.completedRatings
        });
        
        // If Google Sheet is configured, sync the data
        if (config.googleSheetId) {
          try {
            await googleSheetService.syncCrawledDataToSheet(config.googleSheetId, item.productId);
          } catch (sheetError) {
            console.error(`Error syncing to Google Sheet for ${item.url}:`, sheetError);
            logApiDebug('Google Sheet sync error:', {
              id: item._id,
              url: item.url,
              error: sheetError.message,
              stack: sheetError.stack
            });
            // Không để lỗi Google Sheet ảnh hưởng đến trạng thái crawl
          }
        }
      } catch (error) {
        console.error(`Error crawling ${item.url}:`, error);
        logApiDebug('Error processing item:', {
          id: item._id,
          url: item.url,
          error: error.message,
          stack: error.stack
        });
        
        // Update status to error
        item.status = 'error';
        item.errorMessage = error.message;
        await item.save();
      }
    }
  } catch (error) {
    console.error('Error processing crawl queue:', error);
    logApiDebug('Error in processCrawlQueue:', {
      error: error.message,
      stack: error.stack
    });
  } finally {
    isCrawling = false;
  }
};

// Crawl comments for a specific product URL and rating
const crawlCommentsForRating = async (productUrl, productId, shopId, rating, config) => {
  // Sử dụng mặc định 12 comment/page của RapidAPI
  const PAGE_SIZE = 12;
  let collectedComments = [];
  let page = 1;
  let hasMore = true;
  
  logApiDebug('Starting to crawl comments:', {
    productUrl,
    productId,
    shopId,
    rating
  });
  
  // Pagination loop
  while (hasMore) {
    try {
      // Prepare request URL with fixed parameters
      const url = `${config.baseUrl}?site=vn&item_id=${productId}&shop_id=${shopId}&page=${page}&rate_star=${rating}`;
      
      // Prepare request headers
      const headers = {
        ...config.defaultHeaders,
        'x-rapidapi-key': config.apiKey,
      };
      
      logApiDebug(`Fetching page ${page} for rating ${rating} of product ${productId}`, {
        url,
        headers: {
          ...headers,
          'x-rapidapi-key': '***' + config.apiKey.substring(config.apiKey.length - 8)
        }
      });
      
      // Make request to Shopee API
      const response = await axios.get(url, { headers });
      
      // Log full response data for debugging
      console.log(`[${new Date().toISOString()}] [API-FULL-RESPONSE] Raw API response for product ${productId}, rating ${rating}, page ${page}:`, 
        JSON.stringify(response.data, null, 2));
      
      logApiDebug(`Received response for page ${page}`, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data
      });
      
      // Process the API response
      if (response.data && response.data.data && response.data.data.ratings) {
        const comments = response.data.data.ratings;
        
        if (comments.length === 0) {
          hasMore = false;
          break;
        }
        
        // Save comments to database
        for (const comment of comments) {
          // Check if comment already exists in database
          const commentId = comment.cmtid ? comment.cmtid.toString() : (comment.order_id || `unknown-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`);
          
          const existingComment = await CrawledData.findOne({
            productId,
            commentId: commentId,
          });
          
          if (!existingComment) {
            // Create new comment record with all data from API
            const commentData = new CrawledData({
              productId,
              originalUrl: productUrl,
              // Use rating_star from API response
              ratingStar: comment.rating_star || rating,
              commentId: commentId,
              commentText: comment.comment || '',
              commenterUsername: comment.author_username || 'Unknown',
              commentTimestamp: comment.ctime ? new Date(comment.ctime * 1000) : new Date(),
              anonymous: comment.anonymous || false,
              authorUserId: comment.author_userid,
              likeCount: comment.like_count || 0,
              isHidden: comment.is_hidden || false, 
              isRepeatedPurchase: comment.is_repeated_purchase || false,
              ratingStarDetail: comment.rating_star_detail || {},
              ratingImages: comment.rating_imgs || [],
              ratingVideos: comment.rating_videos || [],
              skusInfo: comment.skus_info || [],
              status: comment.status,
              // Store raw data from API for future reference
              rawData: comment,
              savedToSheet: false,
            });
            
            await commentData.save();
            collectedComments.push(commentData);
            
            logApiDebug('Saved new comment:', {
              productId,
              commentId: commentId,
              username: comment.author_username || 'Unknown',
              timestamp: comment.ctime ? new Date(comment.ctime * 1000).toISOString() : new Date().toISOString()
            });
          } else {
            logApiDebug('Comment already exists:', {
              productId,
              commentId: commentId
            });
          }
        }
        
        // Check if there are more pages
        hasMore = response.data.data.has_next_page === true;
        page++;
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log('No valid data returned from API');
        logApiDebug('No valid data returned from API', {
          responseData: response.data
        });
        hasMore = false;
      }
    } catch (error) {
      console.error(`Error fetching comments for product ${productId}, rating ${rating}, page ${page}:`, error);
      logApiDebug(`Error fetching comments for product ${productId}, rating ${rating}, page ${page}:`, {
        error: error.message,
        stack: error.stack,
        response: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        } : null
      });
      
      // If API error, stop pagination
      if (error.response) {
        console.error('API response error:', error.response.data);
      }
      
      throw error;
    }
  }
  
  logApiDebug(`Collected ${collectedComments.length} comments for product ${productId}, rating ${rating}`);
  return collectedComments;
};

// Check if a crawl is currently running
const isCurrentlyCrawling = () => {
  return isCrawling;
};

module.exports = {
  processCrawlQueue,
  crawlCommentsForRating,
  isCurrentlyCrawling,
}; 