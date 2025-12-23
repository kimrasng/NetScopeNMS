/**
 * Metric Daily Model (3 years retention)
 */

const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

const METRIC_TYPES = ['cpu', 'memory', 'traffic_in', 'traffic_out', 'uptime', 'errors_in', 'errors_out', 'discards_in', 'discards_out', 'bandwidth_util'];

const MetricDaily = sequelize.define('MetricDaily', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },
  device_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  interface_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
  },
  metric_type: {
    type: DataTypes.ENUM(...METRIC_TYPES),
    allowNull: false,
  },
  day_timestamp: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  avg_value: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  min_value: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  max_value: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  sample_count: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
}, {
  tableName: 'metrics_daily',
  timestamps: false,
  indexes: [
    { 
      fields: ['device_id', 'interface_id', 'metric_type', 'day_timestamp'], 
      unique: true,
      name: 'idx_metrics_daily_unique',
    },
    { fields: ['day_timestamp'] },
  ],
});

/**
 * Class Methods
 */

// Upsert daily aggregation
MetricDaily.upsertAggregation = async function(data) {
  const { device_id, interface_id, metric_type, day_timestamp, avg_value, min_value, max_value, sample_count } = data;
  
  return sequelize.query(`
    INSERT INTO metrics_daily 
      (device_id, interface_id, metric_type, day_timestamp, avg_value, min_value, max_value, sample_count)
    VALUES 
      (:device_id, :interface_id, :metric_type, :day_timestamp, :avg_value, :min_value, :max_value, :sample_count)
    ON DUPLICATE KEY UPDATE
      avg_value = (avg_value * sample_count + :avg_value * :sample_count) / (sample_count + :sample_count),
      min_value = LEAST(min_value, :min_value),
      max_value = GREATEST(max_value, :max_value),
      sample_count = sample_count + :sample_count
  `, {
    replacements: {
      device_id,
      interface_id: interface_id || null,
      metric_type,
      day_timestamp,
      avg_value,
      min_value,
      max_value,
      sample_count,
    },
    type: sequelize.QueryTypes.INSERT,
  });
};

// Get daily metrics
MetricDaily.getDeviceMetrics = async function(deviceId, metricTypes, startDate, endDate) {
  const where = {
    device_id: deviceId,
    day_timestamp: {
      [Op.between]: [startDate, endDate],
    },
  };
  
  if (metricTypes && metricTypes.length > 0) {
    where.metric_type = { [Op.in]: metricTypes };
  }
  
  return this.findAll({
    where,
    order: [['day_timestamp', 'ASC']],
  });
};

// Delete old daily metrics
MetricDaily.deleteOldMetrics = async function(days = 1095) { // 3 years
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.destroy({
    where: {
      day_timestamp: {
        [Op.lt]: cutoffDate,
      },
    },
  });
};

// Get statistics for a device
MetricDaily.getDeviceStatistics = async function(deviceId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return sequelize.query(`
    SELECT 
      metric_type,
      AVG(avg_value) as overall_avg,
      MIN(min_value) as overall_min,
      MAX(max_value) as overall_max,
      AVG(max_value - min_value) as avg_variance
    FROM metrics_daily
    WHERE device_id = :deviceId AND day_timestamp >= :startDate
    GROUP BY metric_type
  `, {
    replacements: { deviceId, startDate },
    type: sequelize.QueryTypes.SELECT,
  });
};

module.exports = MetricDaily;
