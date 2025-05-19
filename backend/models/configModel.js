const mongoose = require('mongoose');

const configSchema = new mongoose.Schema(
  {
    apiKey: {
      type: String,
      required: true,
      trim: true,
    },
    baseUrl: {
      type: String,
      required: true,
      trim: true,
    },
    defaultHeaders: {
      type: Object,
      required: true,
    },
    googleSheetId: {
      type: String,
      trim: true,
    },
    // Thêm các cấu hình kiểm soát tốc độ crawl
    crawlSettings: {
      type: Object,
      default: {
        minDelay: 5000,       // Delay tối thiểu giữa các request (ms) - increased
        maxDelay: 15000,      // Delay tối đa giữa các request (ms) - increased
        maxRetries: 5,        // Số lần thử lại tối đa khi gặp lỗi - increased
        retryMinDelay: 20000, // Delay tối thiểu khi thử lại (ms) - increased
        retryMaxDelay: 40000, // Delay tối đa khi thử lại (ms) - increased
        maxRequestsPerHour: 30 // Giới hạn số request mỗi giờ - decreased
      }
    },
    // Thêm danh sách proxy
    proxyList: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true,
  }
);

// Ensure only one configuration document exists
configSchema.statics.getConfig = async function() {
  let config = await this.findOne({});
  if (!config) {
    config = await this.create({
      apiKey: '0dee81b23cmshb2c39a7c7a048edp15937cjsnf864e6e941f8',
      baseUrl: 'https://shopee-e-commerce-data.p.rapidapi.com/shopee/item/ratings',
      defaultHeaders: {
        'x-rapidapi-host': 'shopee-e-commerce-data.p.rapidapi.com',
      },
      crawlSettings: {
        minDelay: 5000,
        maxDelay: 15000,
        maxRetries: 5,
        retryMinDelay: 20000,
        retryMaxDelay: 40000,
        maxRequestsPerHour: 30
      },
      proxyList: []
    });
  }
  
  // Đảm bảo baseUrl và defaultHeaders luôn cố định
  config.baseUrl = 'https://shopee-e-commerce-data.p.rapidapi.com/shopee/item/ratings';
  config.defaultHeaders = {
    'x-rapidapi-host': 'shopee-e-commerce-data.p.rapidapi.com',
  };
  
  // Đảm bảo crawlSettings luôn có giá trị mặc định nếu chưa được thiết lập
  if (!config.crawlSettings) {
    config.crawlSettings = {
      minDelay: 5000,
      maxDelay: 15000,
      maxRetries: 5,
      retryMinDelay: 20000,
      retryMaxDelay: 40000,
      maxRequestsPerHour: 30
    };
  }
  
  // Đảm bảo proxyList luôn có giá trị mặc định nếu chưa được thiết lập
  if (!config.proxyList) {
    config.proxyList = [];
  }
  
  return config;
};

const Config = mongoose.model('Config', configSchema);

module.exports = Config; 