const cron = require('node-cron');
const Config = require('../models/configModel');
const shopeeApiService = require('../services/shopeeApiService');

let activeCronJob = null;

// Hàm tạo delay ngẫu nhiên (±30 phút)
function getRandomStartDelay() {
  // Ngẫu nhiên từ -30 đến +30 phút (tính bằng mili giây)
  return Math.floor(Math.random() * 60 * 60 * 1000) - 30 * 60 * 1000;
}

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
          // Nếu cấu hình ngẫu nhiên hóa thời điểm bắt đầu, thêm delay ngẫu nhiên
          if (config.cronjobSettings.randomizeStartTime) {
            const delay = getRandomStartDelay();
            const delayMinutes = Math.round(delay / 60000);
            const delayDirection = delayMinutes >= 0 ? 'delay' : 'advance';
            
            console.log(`Randomizing start time: ${Math.abs(delayMinutes)} minutes ${delayDirection}`);
            
            setTimeout(() => {
              console.log(`Running scheduled crawl at ${new Date().toISOString()} (with randomized timing)`);
              shopeeApiService.processCrawlQueue();
            }, Math.max(0, delay)); // Đảm bảo delay không âm
          } else {
            console.log(`Running scheduled crawl at ${new Date().toISOString()}`);
            shopeeApiService.processCrawlQueue();
          }
        });
        
        console.log(`Cronjob initialized with schedule: ${schedule}`);
        if (config.cronjobSettings.randomizeStartTime) {
          console.log('Start time randomization is enabled (±30 minutes)');
        }
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
      const randomizeStartTime = config.cronjobSettings?.randomizeStartTime;
      
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
        // Check if schedule or randomization setting has changed
        const currentSchedule = activeCronJob._schedule ? activeCronJob._schedule.source : null;
        if (currentSchedule !== schedule || 
            config._previousRandomizeStartTime !== randomizeStartTime) {
          console.log('Cronjob schedule or randomization setting changed, reinitializing');
          config._previousRandomizeStartTime = randomizeStartTime;
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