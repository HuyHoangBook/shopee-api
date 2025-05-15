const mongoose = require('mongoose');

const crawledDataSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      index: true,
    },
    originalUrl: {
      type: String,
      required: true,
    },
    ratingStar: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    commentId: {
      type: String,
      required: true,
    },
    commentText: {
      type: String,
    },
    commenterUsername: {
      type: String,
    },
    commentTimestamp: {
      type: Date,
    },
    anonymous: {
      type: Boolean,
      default: false
    },
    authorUserId: {
      type: Number
    },
    likeCount: {
      type: Number,
      default: 0
    },
    isHidden: {
      type: Boolean,
      default: false
    },
    isRepeatedPurchase: {
      type: Boolean,
      default: false
    },
    ratingStarDetail: {
      type: Object,
      default: {}
    },
    ratingImages: {
      type: [String],
      default: []
    },
    ratingVideos: {
      type: [String],
      default: []
    },
    skusInfo: {
      type: [Object],
      default: []
    },
    status: {
      type: Number
    },
    rawData: {
      type: Object,
    },
    savedToSheet: {
      type: Boolean,
      default: false,
    },
    sheetRowIndex: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for unique comments per product
crawledDataSchema.index({ productId: 1, commentId: 1 }, { unique: true });

const CrawledData = mongoose.model('CrawledData', crawledDataSchema);

module.exports = CrawledData; 