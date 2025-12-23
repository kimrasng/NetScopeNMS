const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { sequelize, Metric, MetricHourly, MetricDaily } = require('../models');

class AggregationService {
  async aggregateToHourly(hourStart, hourEnd) {
    logger.info(`Aggregating metrics for hour: ${hourStart.toISOString()}`);

    try {
      // Get aggregated data from raw metrics
      const aggregations = await Metric.getMetricsForHourlyAggregation(hourStart, hourEnd);

      if (aggregations.length === 0) {
        logger.info('No metrics to aggregate for this hour');
        return 0;
      }

      // Upsert each aggregation
      for (const agg of aggregations) {
        await MetricHourly.upsertAggregation({
          device_id: agg.device_id,
          interface_id: agg.interface_id,
          metric_type: agg.metric_type,
          hour_timestamp: hourStart,
          avg_value: agg.avg_value,
          min_value: agg.min_value,
          max_value: agg.max_value,
          sample_count: parseInt(agg.sample_count, 10),
        });
      }

      logger.info(`Created ${aggregations.length} hourly aggregations`);
      return aggregations.length;
    } catch (error) {
      logger.error('Error in hourly aggregation:', error);
      throw error;
    }
  }

  async aggregateToDaily(dayStart, dayEnd) {
    logger.info(`Aggregating metrics for day: ${dayStart.toISOString().split('T')[0]}`);

    try {
      // Get aggregated data from hourly metrics
      const aggregations = await MetricHourly.getMetricsForDailyAggregation(dayStart, dayEnd);

      if (aggregations.length === 0) {
        logger.info('No hourly metrics to aggregate for this day');
        return 0;
      }

      // Format day timestamp
      const dayTimestamp = dayStart.toISOString().split('T')[0];

      // Upsert each aggregation
      for (const agg of aggregations) {
        await MetricDaily.upsertAggregation({
          device_id: agg.device_id,
          interface_id: agg.interface_id,
          metric_type: agg.metric_type,
          day_timestamp: dayTimestamp,
          avg_value: agg.avg_value,
          min_value: agg.min_value,
          max_value: agg.max_value,
          sample_count: parseInt(agg.sample_count, 10),
        });
      }

      logger.info(`Created ${aggregations.length} daily aggregations`);
      return aggregations.length;
    } catch (error) {
      logger.error('Error in daily aggregation:', error);
      throw error;
    }
  }

  async aggregateLastHour() {
    const now = new Date();
    const hourEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
    const hourStart = new Date(hourEnd.getTime() - 60 * 60 * 1000);

    return this.aggregateToHourly(hourStart, hourEnd);
  }

  /**
   * Aggregate yesterday's data to daily
   * @returns {Promise<number>} - Number of aggregations
   */
  async aggregateYesterday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    return this.aggregateToDaily(yesterday, today);
  }

  /**
   * Clean up old raw metrics
   * @param {number} days - Days to retain (default: 30)
   * @returns {Promise<number>} - Number of deleted records
   */
  async cleanupRawMetrics(days = 30) {
    logger.info(`Cleaning up raw metrics older than ${days} days`);

    try {
      const deletedCount = await Metric.deleteOldMetrics(days);
      logger.info(`Deleted ${deletedCount} old raw metric records`);
      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up raw metrics:', error);
      throw error;
    }
  }

  /**
   * Clean up old hourly metrics
   * @param {number} days - Days to retain (default: 365)
   * @returns {Promise<number>} - Number of deleted records
   */
  async cleanupHourlyMetrics(days = 365) {
    logger.info(`Cleaning up hourly metrics older than ${days} days`);

    try {
      const deletedCount = await MetricHourly.deleteOldMetrics(days);
      logger.info(`Deleted ${deletedCount} old hourly metric records`);
      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up hourly metrics:', error);
      throw error;
    }
  }

  /**
   * Clean up old daily metrics
   * @param {number} days - Days to retain (default: 1095 = 3 years)
   * @returns {Promise<number>} - Number of deleted records
   */
  async cleanupDailyMetrics(days = 1095) {
    logger.info(`Cleaning up daily metrics older than ${days} days`);

    try {
      const deletedCount = await MetricDaily.deleteOldMetrics(days);
      logger.info(`Deleted ${deletedCount} old daily metric records`);
      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up daily metrics:', error);
      throw error;
    }
  }

  /**
   * Run all cleanup tasks
   * @returns {Promise<object>} - Cleanup results
   */
  async runAllCleanup() {
    const retentionDays = {
      raw: parseInt(process.env.RETENTION_RAW_DAYS, 10) || 30,
      hourly: parseInt(process.env.RETENTION_HOURLY_DAYS, 10) || 365,
      daily: parseInt(process.env.RETENTION_DAILY_DAYS, 10) || 1095,
    };

    const results = {
      raw: await this.cleanupRawMetrics(retentionDays.raw),
      hourly: await this.cleanupHourlyMetrics(retentionDays.hourly),
      daily: await this.cleanupDailyMetrics(retentionDays.daily),
    };

    logger.info('All cleanup tasks completed:', results);
    return results;
  }

  /**
   * Backfill missing hourly aggregations
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<number>} - Total aggregations created
   */
  async backfillHourly(startDate, endDate) {
    logger.info(`Backfilling hourly aggregations from ${startDate} to ${endDate}`);
    
    let current = new Date(startDate);
    current.setMinutes(0, 0, 0);
    
    let totalAggregations = 0;
    
    while (current < endDate) {
      const hourEnd = new Date(current.getTime() + 60 * 60 * 1000);
      const count = await this.aggregateToHourly(current, hourEnd);
      totalAggregations += count;
      current = hourEnd;
    }
    
    logger.info(`Backfill complete. Total hourly aggregations: ${totalAggregations}`);
    return totalAggregations;
  }

  /**
   * Backfill missing daily aggregations
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<number>} - Total aggregations created
   */
  async backfillDaily(startDate, endDate) {
    logger.info(`Backfilling daily aggregations from ${startDate} to ${endDate}`);
    
    let current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    
    let totalAggregations = 0;
    
    while (current < endDate) {
      const dayEnd = new Date(current.getTime() + 24 * 60 * 60 * 1000);
      const count = await this.aggregateToDaily(current, dayEnd);
      totalAggregations += count;
      current = dayEnd;
    }
    
    logger.info(`Backfill complete. Total daily aggregations: ${totalAggregations}`);
    return totalAggregations;
  }

  /**
   * Get aggregation statistics
   * @returns {Promise<object>} - Aggregation stats
   */
  async getStats() {
    const [rawCount, hourlyCount, dailyCount] = await Promise.all([
      Metric.count(),
      MetricHourly.count(),
      MetricDaily.count(),
    ]);

    const [rawOldest, hourlyOldest, dailyOldest] = await Promise.all([
      Metric.min('collected_at'),
      MetricHourly.min('hour_timestamp'),
      MetricDaily.min('day_timestamp'),
    ]);

    return {
      raw: {
        count: rawCount,
        oldestRecord: rawOldest,
      },
      hourly: {
        count: hourlyCount,
        oldestRecord: hourlyOldest,
      },
      daily: {
        count: dailyCount,
        oldestRecord: dailyOldest,
      },
    };
  }
}

// Export singleton instance
module.exports = new AggregationService();
