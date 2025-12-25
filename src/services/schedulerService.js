const cron = require('node-cron');
const logger = require('../utils/logger');
const snmpService = require('./snmpService');
const aggregationService = require('./aggregationService');
const alarmService = require('./alarmService');
const { Device } = require('../models');

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.isPolling = false;
    this.pollingQueue = [];
  }

  startAll() {
    logger.info('Starting all schedulers...');
    
    this.startPollingScheduler();
    this.startHourlyAggregation();
    this.startDailyTasks();
    this.startAIPredictionScheduler();
    
    logger.info('All schedulers started');
  }

  stopAll() {
    logger.info('Stopping all schedulers...');
    
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped scheduler: ${name}`);
    });
    
    this.jobs.clear();
    logger.info('All schedulers stopped');
  }

  startPollingScheduler() {
    const job = cron.schedule('* * * * *', async () => {
      await this.pollDevices();
    }, {
      scheduled: true,
      timezone: 'Asia/Seoul',
    });

    this.jobs.set('polling', job);
    logger.info('Polling scheduler started (every minute)');
  }

  async pollDevices() {
    if (this.isPolling) {
      logger.debug('Previous polling still in progress, skipping...');
      return;
    }

    this.isPolling = true;
    const startTime = Date.now();

    try {
      // Get devices that need polling
      const devices = await Device.getDevicesForPolling();
      
      if (devices.length === 0) {
        logger.debug('No devices need polling');
        return;
      }

      logger.info(`Polling ${devices.length} devices...`);

      // Process devices in batches
      const batchSize = parseInt(process.env.POLL_BATCH_SIZE, 10) || 10;
      
      for (let i = 0; i < devices.length; i += batchSize) {
        const batch = devices.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (device) => {
          try {
            const result = await snmpService.collectMetrics(device.id);
            
            if (!result.success) {
              // Device is down, create connectivity alarm
              await alarmService.createConnectivityAlarm(device.id);
            }
          } catch (error) {
            logger.error(`Error polling device ${device.id}:`, error);
          }
        }));
      }

      const elapsed = Date.now() - startTime;
      logger.info(`Polling completed in ${elapsed}ms`);
    } catch (error) {
      logger.error('Error in polling scheduler:', error);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Start hourly aggregation scheduler
   */
  startHourlyAggregation() {
    // Run at minute 5 of every hour
    const job = cron.schedule('5 * * * *', async () => {
      try {
        logger.info('Starting hourly aggregation...');
        await aggregationService.aggregateLastHour();
        logger.info('Hourly aggregation completed');
      } catch (error) {
        logger.error('Error in hourly aggregation:', error);

    }, {
      scheduled: true,
      timezone: 'Asia/Seoul',
    });

    this.jobs.set('hourlyAggregation', job);
    logger.info('Hourly aggregation scheduler started (at :05 every hour)');
  }

  /**
   * Start daily tasks scheduler
   */
  startDailyTasks() {
    // Run at 00:30 every day
    const job = cron.schedule('30 0 * * *', async () => {
      try {
        logger.info('Starting daily tasks...');

        // Daily aggregation
        await aggregationService.aggregateYesterday();


        await aggregationService.runAllCleanup();

        // Cleanup old alarms
        await alarmService.cleanupOldAlarms(90);

        logger.info('Daily tasks completed');
      } catch (error) {
        logger.error('Error in daily tasks:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Seoul',
    });

    this.jobs.set('dailyTasks', job);
    logger.info('Daily tasks scheduler started (at 00:30 every day)');
  }

  /**
   * Start AI prediction scheduler
   */
  startAIPredictionScheduler() {
    // Run every hour at minute 30
    const job = cron.schedule('30 * * * *', async () => {
      try {
        // Only run if AI is configured
        const aiConfig = require('../config/openai');
        if (!aiConfig.isConfigured()) {
          logger.debug('AI not configured, skipping prediction');
          return;
        }

        logger.info('Starting AI prediction run...');
        
        // Import AI service dynamically to avoid circular dependency
        const aiService = require('./aiService');
        await aiService.runPredictionForAllDevices();
        
        logger.info('AI prediction run completed');
      } catch (error) {
        logger.error('Error in AI prediction scheduler:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Seoul',
    });

    this.jobs.set('aiPrediction', job);
    logger.info('AI prediction scheduler started (at :30 every hour)');
  }

  /**
   * Start daily report scheduler
   */
  startDailyReportScheduler() {
    // Run at 08:00 every day
    const job = cron.schedule('0 8 * * *', async () => {
      try {
        const aiConfig = require('../config/openai');
        if (!aiConfig.isConfigured()) {
          return;
        }

        logger.info('Generating daily AI report...');
        
        const aiService = require('./aiService');
        await aiService.generateDailyReport();
        
        logger.info('Daily AI report generated');
      } catch (error) {
        logger.error('Error generating daily report:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Seoul',
    });

    this.jobs.set('dailyReport', job);
    logger.info('Daily report scheduler started (at 08:00 every day)');
  }

  /**
   * Manually trigger device polling
   * @param {number} deviceId - Specific device ID (optional)
   */
  async triggerPolling(deviceId = null) {
    if (deviceId) {
      logger.info(`Manual poll triggered for device ${deviceId}`);
      return snmpService.collectMetrics(deviceId);
    } else {
      logger.info('Manual poll triggered for all devices');
      return this.pollDevices();
    }
  }

  /**
   * Manually trigger aggregation
   * @param {string} type - 'hourly' or 'daily'
   */
  async triggerAggregation(type = 'hourly') {
    logger.info(`Manual ${type} aggregation triggered`);
    
    if (type === 'hourly') {
      return aggregationService.aggregateLastHour();
    } else if (type === 'daily') {
      return aggregationService.aggregateYesterday();
    }
  }

  /**
   * Get scheduler status
   * @returns {object} - Status of all schedulers
   */
  getStatus() {
    const status = {};
    
    this.jobs.forEach((job, name) => {
      status[name] = {
        running: job.running || false,
      };
    });

    status.isPolling = this.isPolling;
    
    return status;
  }
}

// Export singleton instance
module.exports = new SchedulerService();
