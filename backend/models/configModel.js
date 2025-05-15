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
      }
    });
  }
  
  // Đảm bảo baseUrl và defaultHeaders luôn cố định
  config.baseUrl = 'https://shopee-e-commerce-data.p.rapidapi.com/shopee/item/ratings';
  config.defaultHeaders = {
    'x-rapidapi-host': 'shopee-e-commerce-data.p.rapidapi.com',
  };
  
  return config;
};

const Config = mongoose.model('Config', configSchema);

module.exports = Config; 