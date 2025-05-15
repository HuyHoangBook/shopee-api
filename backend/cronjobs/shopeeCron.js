const cron = require('node-cron');
const Config = require('../models/configModel');
const shopeeApiService = require('../services/shopeeApiService');

let activeCronJob = null;

// Initialize cronjob based on configuration
const initCronJob = async () => {
  try {
    // Get configuration
    const config = await Config.getConfig();
    
    // If there's an active job, stop it first
    if (activeCronJob) {
      activeCronJob.stop();
      activeCronJob = null;
    }
    
    // If cronjob is enabled, start a new one
    if (config.cronjobSettings && config.cronjobSettings.enabled) {
      const schedule = config.cronjobSettings.schedule || '0 2 * * *'; // Default: 2 AM daily
      
      // Validate cron schedule
      if (cron.validate(schedule)) {
        activeCronJob = cron.schedule(schedule, () => {
          console.log(`Running scheduled crawl at ${new Date().toISOString()}`);
          shopeeApiService.processCrawlQueue();
        });
        
        console.log(`Cronjob initialized with schedule: ${schedule}`);
      } else {
        console.error(`Invalid cron schedule: ${schedule}`);
      }
    } else {
      console.log('Cronjob is disabled in configuration');
    }
  } catch (error) {
    console.error('Error initializing cronjob:', error);
  }
};

// Listen for configuration changes and update cronjob
const setupConfigListener = () => {
  // This is a basic implementation - in production, you might want to use a more robust approach
  // such as event emitters, message queues, or periodic checks
  setInterval(async () => {
    try {
      const config = await Config.getConfig();
      
      // Check if cronjob status or schedule has changed
      const isEnabled = config.cronjobSettings && config.cronjobSettings.enabled;
      const schedule = config.cronjobSettings?.schedule || '0 2 * * *';
      
      const hasActiveCron = activeCronJob !== null;
      
      if (isEnabled && !hasActiveCron) {
        // Enable cronjob if it was disabled
        initCronJob();
      } else if (!isEnabled && hasActiveCron) {
        // Disable cronjob if it was enabled
        if (activeCronJob) {
          activeCronJob.stop();
          activeCronJob = null;
          console.log('Cronjob stopped due to configuration change');
        }
      } else if (isEnabled && hasActiveCron) {
        // Check if schedule has changed
        if (activeCronJob._schedule.source !== schedule) {
          console.log('Cronjob schedule changed, reinitializing');
          initCronJob();
        }
      }
    } catch (error) {
      console.error('Error checking for cronjob config changes:', error);
    }
  }, 60000); // Check every minute
};

// Export functions for use in main server file
module.exports = {
  initCronJob,
  setupConfigListener,
}; 