const axios = require('axios');
const CrawlQueue = require('../models/crawlQueueModel');
const CrawledData = require('../models/crawledDataModel');
const Config = require('../models/configModel');
const googleSheetService = require('./googleSheetService');
const notificationService = require('./notificationService');

let isCrawling = false;

// Enhanced logging function
function logApiDebug(message, data = null) {
  const timestamp = new Date().toISOString();
  
  // Clone data to avoid modifying original object
  let safeData = data;
  
  if (data) {
    // Sanitize sensitive data like API keys
    safeData = JSON.parse(JSON.stringify(data));
    if (safeData.headers && safeData.headers['x-rapidapi-key']) {
      safeData.headers['x-rapidapi-key'] = '***' + (safeData.headers['x-rapidapi-key'].length > 8 ? 
                                           safeData.headers['x-rapidapi-key'].substring(safeData.headers['x-rapidapi-key'].length - 8) : 
                                           '********');
    }
    
    console.log(`[${timestamp}] [API-DEBUG] ${message}`, JSON.stringify(safeData, null, 2));
  } else {
    console.log(`[${timestamp}] [API-DEBUG] ${message}`);
  }
}

// Function for sleep with more natural randomness
function sleep(minMs, maxMs) {
  const ms = Math.floor(minMs + Math.random() * (maxMs - minMs));
  console.log(`[${new Date().toISOString()}] Sleeping for ${ms}ms`);
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Danh sách User-Agent để luân phiên sử dụng
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
];

// Biến lưu trạng thái proxy hiện tại
let currentProxyIndex = 0;
let failedProxies = {};

// Hàm lấy proxy tiếp theo từ cấu hình
function getNextProxy(config) {
  // Lấy danh sách proxy từ config
  const proxyList = config && config.proxyList ? config.proxyList : [];
  
  // Nếu không có proxy nào, trả về null
  if (proxyList.length === 0) {
    return null;
  }
  
  // Tìm proxy tiếp theo chưa bị đánh dấu lỗi
  let attempts = 0;
  while (attempts < proxyList.length) {
    // Force rotation to the next proxy for each request to spread traffic
    currentProxyIndex = (currentProxyIndex + 1) % proxyList.length;
    const proxy = proxyList[currentProxyIndex];
    
    // Kiểm tra xem proxy này có bị đánh dấu lỗi không
    if (!failedProxies[proxy] || (Date.now() - failedProxies[proxy]) > 30 * 60 * 1000) { // 30 phút
      return proxy;
    }
    
    attempts++;
  }
  
  // Nếu tất cả proxy đều bị đánh dấu lỗi, reset và thử lại
  failedProxies = {};
  currentProxyIndex = 0;
  return proxyList.length > 0 ? proxyList[0] : null;
}

// Hàm đánh dấu proxy bị lỗi
function markProxyAsFailed(proxy) {
  if (proxy) {
    failedProxies[proxy] = Date.now();
    logApiDebug(`Marked proxy as failed: ${proxy}`);
  }
}

// Hàm lấy User-Agent ngẫu nhiên
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Hàm tạo delay ngẫu nhiên
function getRandomDelay(min, max, config) {
  // Sử dụng cấu hình từ config nếu có
  if (config && config.crawlSettings) {
    min = min || config.crawlSettings.minDelay;
    max = max || config.crawlSettings.maxDelay;
  } else {
    min = min || 3000;
    max = max || 8000;
  }
  // Add a more random, human-like delay pattern
  const baseDelay = Math.floor(Math.random() * (max - min + 1)) + min;
  // Add a small random variation to make it less predictable
  const randomVariation = Math.floor(Math.random() * 1000); 
  return baseDelay + randomVariation;
}

// Theo dõi số lượng request mỗi giờ
let requestCounter = 0;
let lastResetTime = Date.now();

// Hàm kiểm tra và đợi nếu đã đạt giới hạn request
async function checkRateLimit(config) {
  // Reset counter nếu đã qua 1 giờ
  const now = Date.now();
  if (now - lastResetTime > 3600000) {
    requestCounter = 0;
    lastResetTime = now;
    return;
  }
  
  // Kiểm tra giới hạn
  const maxRequests = config && config.crawlSettings ? config.crawlSettings.maxRequestsPerHour : 60;
  
  if (requestCounter >= maxRequests) {
    const waitTime = 3600000 - (now - lastResetTime) + 1000; // Thêm 1 giây để đảm bảo
    logApiDebug(`Rate limit reached (${requestCounter}/${maxRequests}). Waiting for ${Math.ceil(waitTime/1000)} seconds.`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    requestCounter = 0;
    lastResetTime = Date.now();
  }
  
  // Tăng counter
  requestCounter++;
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
  
  // Lấy proxy ban đầu từ config
  let currentProxy = getNextProxy(config);
  
  // Initial sleep before starting to crawl
  await sleep(2000, 5000);
  
  // Pagination loop
  while (hasMore) {
    try {
      // Kiểm tra giới hạn tốc độ request
      await checkRateLimit(config);
      
      // Thêm delay ngẫu nhiên trước mỗi request để tránh phát hiện bot
      const delay = getRandomDelay(null, null, config);
      logApiDebug(`Adding random delay of ${delay}ms before request`);
      await sleep(delay * 0.8, delay * 1.2);  // More natural variation in delay
      
      // Add a random request ID to simulate different sessions
      const requestId = Math.random().toString(36).substring(2, 15);
      
      // Add timestamp parameter to avoid caching
      const timestamp = Date.now();
      
      // Prepare request URL with fixed parameters
      const url = `${config.baseUrl}?site=vn&item_id=${productId}&shop_id=${shopId}&page=${page}&rate_star=${rating}&_=${timestamp}&reqid=${requestId}`;
      
      // Prepare request headers with random user agent
      const randomUserAgent = getRandomUserAgent();
      const headers = {
        ...config.defaultHeaders,
        'x-rapidapi-key': config.apiKey,
        'User-Agent': randomUserAgent,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'Origin': 'https://shopee.vn',
        'Referer': productUrl,
        // Add additional headers to appear more like a browser
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site'
      };
      
      // Chuẩn bị cấu hình request với proxy nếu có
      const requestConfig = { 
        headers,
        timeout: 30000, // Tăng timeout lên 30 giây
      };
      
      // Thêm proxy nếu có
      if (currentProxy) {
        requestConfig.proxy = false; // Tắt proxy mặc định của axios
        requestConfig.httpsAgent = new (require('https').Agent)({
          rejectUnauthorized: false // Cho phép self-signed certificates
        });
        
        // Thêm proxy vào cấu hình - cập nhật cách cấu hình proxy cho axios 1.9.0
        const proxyUrl = new URL(currentProxy);
        requestConfig.proxy = {
          protocol: proxyUrl.protocol.replace(':', ''),
          host: proxyUrl.hostname,
          port: proxyUrl.port || (proxyUrl.protocol === 'https:' ? 443 : 80)
        };
        
        // Nếu proxy có username và password
        if (proxyUrl.username && proxyUrl.password) {
          requestConfig.proxy.auth = {
            username: proxyUrl.username,
            password: proxyUrl.password
          };
        }
        
        logApiDebug(`Using proxy: ${currentProxy.replace(/\/\/.*@/, '//*****@')}`);
      }
      
      logApiDebug(`Fetching page ${page} for rating ${rating} of product ${productId}`, {
        url,
        headers: {
          ...headers,
          'x-rapidapi-key': '***' + (config.apiKey.length > 8 ? config.apiKey.substring(config.apiKey.length - 8) : '********'),
          'User-Agent': randomUserAgent
        },
        proxy: currentProxy ? 'Using proxy' : 'No proxy'
      });
      
      // Make request to Shopee API
      const response = await axios.get(url, requestConfig);
      
      // Log full response data for debugging
      // Only log partial response data to prevent sensitive info exposure
      const responsePreview = response.data ? {
        code: response.data.code,
        msg: response.data.msg,
        status: response.data.status,
        data: response.data.data ? {
          has_next_page: response.data.data.has_next_page,
          ratingsCount: response.data.data.ratings ? response.data.data.ratings.length : 0
        } : null
      } : null;
      
      console.log(`[${new Date().toISOString()}] [API-RESPONSE-PREVIEW] API response preview for product ${productId}, rating ${rating}, page ${page}:`, 
        JSON.stringify(responsePreview, null, 2));
      
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
      
      // Đánh dấu proxy hiện tại là lỗi và chuyển sang proxy khác
      if (currentProxy) {
        markProxyAsFailed(currentProxy);
        currentProxy = getNextProxy(config);
        logApiDebug(`Switching to new proxy: ${currentProxy ? currentProxy.replace(/\/\/.*@/, '//*****@') : 'No proxy available'}`);
      }
      
      // Xử lý lỗi 417 - Expectation Failed
      if (error.response && error.response.status === 417) {
        logApiDebug('Received 417 error (anti-bot protection). Implementing retry strategy.');
        
        // Gửi thông báo lỗi anti-bot
        notificationService.notifyAntiBotError(productId, productUrl, error);
        
        // Lấy số lần thử lại từ cấu hình
        const maxRetries = config && config.crawlSettings ? config.crawlSettings.maxRetries : 3;
        let retryCount = 0;
        
        // Tăng thời gian chờ theo cấp số nhân
        let retryDelayMultiplier = 1;
        
        while (retryCount < maxRetries) {
          retryCount++;
          // Sử dụng cấu hình cho retry delay và tăng theo thời gian 
          const retryMinDelay = (config && config.crawlSettings ? config.crawlSettings.retryMinDelay : 10000) * retryDelayMultiplier;
          const retryMaxDelay = (config && config.crawlSettings ? config.crawlSettings.retryMaxDelay : 20000) * retryDelayMultiplier;
          const retryDelay = getRandomDelay(retryMinDelay, retryMaxDelay, config);
          
          // Tăng hệ số nhân cho lần thử tiếp theo
          retryDelayMultiplier *= 1.5;
          
          logApiDebug(`Retry attempt ${retryCount}/${maxRetries} after ${retryDelay}ms delay`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          
          try {
            // Thử với user agent khác và proxy khác
            const newUserAgent = getRandomUserAgent();
            currentProxy = getNextProxy(config);
            logApiDebug(`Retrying with different User-Agent: ${newUserAgent} and proxy: ${currentProxy ? currentProxy.replace(/\/\/.*@/, '//*****@') : 'No proxy'}`);
            
            // Thêm loại trình duyệt khác
            const browserVersions = ['Chrome/114', 'Chrome/115', 'Firefox/115', 'Edge/114', 'Safari/605.1.15'];
            const randomBrowser = browserVersions[Math.floor(Math.random() * browserVersions.length)];
            
            // Thêm thông tin platform
            const platforms = ['Windows NT 10.0', 'Macintosh; Intel Mac OS X 10_15', 'X11; Linux x86_64', 'iPhone; CPU iPhone OS 16'];
            const randomPlatform = platforms[Math.floor(Math.random() * platforms.length)];
            
            // Thực hiện lại request với user agent mới và proxy mới
            // Chúng ta sẽ tiếp tục vòng lặp bình thường thay vì thử lại ở đây
            break;
          } catch (retryError) {
            logApiDebug(`Retry attempt ${retryCount} failed:`, {
              error: retryError.message
            });
            
            if (retryCount === maxRetries) {
              // Thông báo tất cả các lần thử đều thất bại
              notificationService.notifyCrawlerBlocked(maxRetries, [{
                productId,
                url: productUrl,
                error: error.message,
                timestamp: new Date().toISOString()
              }]);
              throw new Error(`Failed after ${maxRetries} retry attempts: ${error.message}`);
            }
          }
        }
      } else {
        // Lỗi khác, dừng pagination và gửi thông báo
        const errorMessage = `Error fetching comments for product ${productId}`;
        notificationService.notifyApiError(errorMessage, error);
        
        if (error.response) {
          console.error('API response error:', error.response.data);
        }
        
        throw error;
      }
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