const fs = require('fs');
const path = require('path');

// Cấu hình đường dẫn lưu log
const LOG_DIR = path.join(__dirname, '..', 'logs');
const ERROR_LOG_PATH = path.join(LOG_DIR, 'error_alerts.log');

// Đảm bảo thư mục logs tồn tại
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Lưu thông báo lỗi vào file log
 * @param {string} message - Nội dung thông báo
 * @param {Object} data - Dữ liệu chi tiết về lỗi
 */
const logErrorAlert = (message, data = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    message,
    data
  };
  
  // Ghi log ra file
  fs.appendFileSync(
    ERROR_LOG_PATH, 
    JSON.stringify(logEntry) + '\n',
    'utf8'
  );
  
  // Log ra console
  console.error(`[${timestamp}] [ERROR-ALERT] ${message}`, JSON.stringify(data));
  
  return logEntry;
};

/**
 * Thông báo lỗi anti-bot (417)
 * @param {string} productId - ID sản phẩm gặp lỗi
 * @param {Object} errorData - Thông tin lỗi
 */
const notifyAntiBotError = (productId, url, errorData) => {
  return logErrorAlert(
    `⚠️ ANTI-BOT PROTECTION! Crawler đã bị chặn bởi RapidAPI cho sản phẩm ${productId}`, 
    {
      productId,
      url,
      errorCode: errorData?.response?.status || 'unknown',
      errorMessage: errorData?.response?.data?.msg || errorData?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      type: 'ANTI_BOT_PROTECTION'
    }
  );
};

/**
 * Thông báo lỗi API khác
 * @param {string} message - Mô tả lỗi
 * @param {Object} errorData - Thông tin lỗi
 */
const notifyApiError = (message, errorData) => {
  return logErrorAlert(
    `⚠️ API ERROR: ${message}`,
    {
      errorCode: errorData?.response?.status || 'unknown',
      errorMessage: errorData?.response?.data?.msg || errorData?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      type: 'API_ERROR'
    }
  );
};

/**
 * Thông báo khi crawler bị chặn hoàn toàn
 * @param {number} failedAttempts - Số lần thử thất bại
 */
const notifyCrawlerBlocked = (failedAttempts, lastErrors) => {
  return logErrorAlert(
    `🛑 CRAWLER BLOCKED! Đã thất bại ${failedAttempts} lần liên tiếp`,
    {
      failedAttempts,
      lastErrors: lastErrors || [],
      timestamp: new Date().toISOString(),
      type: 'CRAWLER_BLOCKED'
    }
  );
};

/**
 * Đọc các thông báo lỗi gần đây
 * @param {number} limit - Số lượng thông báo muốn đọc
 * @returns {Array} Danh sách thông báo
 */
const getRecentAlerts = (limit = 10) => {
  if (!fs.existsSync(ERROR_LOG_PATH)) {
    return [];
  }
  
  // Đọc file log
  const content = fs.readFileSync(ERROR_LOG_PATH, 'utf8');
  const lines = content.trim().split('\n');
  
  // Chuyển đổi mỗi dòng thành object và lấy các bản ghi mới nhất
  const alerts = lines
    .map(line => {
      try {
        return JSON.parse(line);
      } catch (err) {
        return null;
      }
    })
    .filter(item => item !== null)
    .slice(-limit);
  
  return alerts;
};

module.exports = {
  notifyAntiBotError,
  notifyApiError,
  notifyCrawlerBlocked,
  getRecentAlerts
}; 