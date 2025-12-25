/**
 * Metric Hourly Model (1 year retention)
 */

const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

const METRIC_TYPES = [
  'cpu', 'memory', 'traffic_in', 'traffic_out', 'uptime', 
  'errors_in', 'errors_out', 'discards_in', 'discards_out', 'bandwidth_util',
  'temperature', 'disk_usage', 'load_avg_1', 'load_avg_5', 'load_avg_15',
  'swap_usage', 'fan_speed', 'power_status', 'process_count', 'tcp_connections'
];

const MetricHourly = sequelize.define('MetricHourly', {
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
  hour_timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'truncated to hour',
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
  tableName: 'metrics_hourly',
  timestamps: false,
  indexes: [
    { 
      fields: ['device_id', 'interface_id', 'metric_type', 'hour_timestamp'], 
      unique: true,
      name: 'idx_metrics_hourly_unique',
    },
    { fields: ['hour_timestamp'] },
  ],
});

/**
 * Class Methods
 */

// Upsert hourly aggregation
MetricHourly.upsertAggregation = async function(data) {
  const { device_id, interface_id, metric_type, hour_timestamp, avg_value, min_value, max_value, sample_count } = data;
  
  // Use ON DUPLICATE KEY UPDATE
  return sequelize.query(`
    INSERT INTO metrics_hourly 
      (device_id, interface_id, metric_type, hour_timestamp, avg_value, min_value, max_value, sample_count)
    VALUES 
      (:device_id, :interface_id, :metric_type, :hour_timestamp, :avg_value, :min_value, :max_value, :sample_count)
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
      hour_timestamp,
      avg_value,
      min_value,
      max_value,
      sample_count,
    },
    type: sequelize.QueryTypes.INSERT,
  });
};

// Get hourly metrics
MetricHourly.getDeviceMetrics = async function(deviceId, metricTypes, startTime, endTime) {
  const where = {
    device_id: deviceId,
    hour_timestamp: {
      [Op.between]: [startTime, endTime],
    },
  };
  
  if (metricTypes && metricTypes.length > 0) {
    where.metric_type = { [Op.in]: metricTypes };
  }
  
  return this.findAll({
    where,
    order: [['hour_timestamp', 'ASC']],
  });
};

// Delete old hourly metrics
MetricHourly.deleteOldMetrics = async function(days = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.destroy({
    where: {
      hour_timestamp: {
        [Op.lt]: cutoffDate,
      },
    },
  });
};

// Get metrics for daily aggregation
MetricHourly.getMetricsForDailyAggregation = async function(dayStart, dayEnd) {
  return sequelize.query(`
    SELECT 
      device_id,
      interface_id,
      metric_type,
      AVG(avg_value) as avg_value,
      MIN(min_value) as min_value,
      MAX(max_value) as max_value,
      SUM(sample_count) as sample_count
    FROM metrics_hourly
    WHERE hour_timestamp >= :dayStart AND hour_timestamp < :dayEnd
    GROUP BY device_id, interface_id, metric_type
  `, {
    replacements: { dayStart, dayEnd },
    type: sequelize.QueryTypes.SELECT,
  });
};

module.exports = MetricHourly;
