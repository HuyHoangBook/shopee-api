const mongoose = require('mongoose');

const crawlQueueSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    productId: {
      type: String,
      required: true,
      trim: true,
    },
    shopId: {
      type: String,
      required: true,
      trim: true,
    },
    targetRatings: {
      type: [Number],
      required: true,
      validate: {
        validator: function(arr) {
          return arr.length > 0 && arr.every(rating => rating >= 1 && rating <= 5);
        },
        message: 'Target ratings must be between 1 and 5'
      }
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'processing', 'completed', 'error'],
      default: 'pending',
    },
    lastAttemptedAt: {
      type: Date,
    },
    errorMessage: {
      type: String,
    },
    completedRatings: {
      type: [Number],
      default: [],
    }
  },
  {
    timestamps: true,
  }
);

// Utility method to extract product ID from Shopee URL
crawlQueueSchema.statics.extractShopeeIds = function(url) {
  try {
    // Extract the shop ID and product ID from a Shopee URL
    // Example URL: https://shopee.vn/product-name-i.12345678.1234567890
    const regex = /i\.(\d+)\.(\d+)/;
    const match = url.match(regex);
    
    if (match && match.length >= 3) {
      return {
        shopId: match[1], // Shop ID
        itemId: match[2]  // Product/Item ID
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting Shopee IDs:', error);
    return null;
  }
};

// For backward compatibility
crawlQueueSchema.statics.extractProductId = function(url) {
  const ids = this.extractShopeeIds(url);
  return ids ? ids.itemId : null;
};

const CrawlQueue = mongoose.model('CrawlQueue', crawlQueueSchema);

module.exports = CrawlQueue; 