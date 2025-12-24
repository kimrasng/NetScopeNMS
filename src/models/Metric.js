/**
 * Metric Model (Raw metrics - 30 days retention)
 */

const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

const METRIC_TYPES = [
  'cpu', 'memory', 'traffic_in', 'traffic_out', 'uptime', 
  'errors_in', 'errors_out', 'discards_in', 'discards_out', 'bandwidth_util',
  // Extended metrics
  'temperature', 'disk_usage', 'load_avg_1', 'load_avg_5', 'load_avg_15',
  'swap_usage', 'fan_speed', 'power_status', 'process_count', 'tcp_connections'
];

const Metric = sequelize.define('Metric', {
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
    comment: 'NULL for device-level metrics',
  },
  metric_type: {
    type: DataTypes.ENUM(...METRIC_TYPES),
    allowNull: false,
  },
  value: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  unit: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'percent, bytes, bps, etc.',
  },
  collected_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'metrics',
  timestamps: false,
  indexes: [
    { fields: ['device_id', 'metric_type', 'collected_at'] },
    { fields: ['collected_at'] },
    { fields: ['interface_id', 'metric_type', 'collected_at'] },
  ],
});

/**
 * Class Methods
 */

// Get metrics for a device within time range
Metric.getDeviceMetrics = async function(deviceId, metricTypes, startTime, endTime, limit = 1000) {
  const where = {
    device_id: deviceId,
    collected_at: {
      [Op.between]: [startTime, endTime],
    },
  };
  
  if (metricTypes && metricTypes.length > 0) {
    where.metric_type = { [Op.in]: metricTypes };
  }
  
  return this.findAll({
    where,
    order: [['collected_at', 'ASC']],
    limit,
  });
};

// Get latest metric for each type
Metric.getLatestMetrics = async function(deviceId) {
  return sequelize.query(`
    SELECT m.*
    FROM metrics m
    INNER JOIN (
      SELECT device_id, metric_type, MAX(collected_at) as max_time
      FROM metrics
      WHERE device_id = :deviceId
      GROUP BY device_id, metric_type
    ) latest ON m.device_id = latest.device_id 
      AND m.metric_type = latest.metric_type 
      AND m.collected_at = latest.max_time
  `, {
    replacements: { deviceId },
    type: sequelize.QueryTypes.SELECT,
  });
};

// Bulk insert metrics
Metric.bulkInsertMetrics = async function(metrics) {
  if (!metrics || metrics.length === 0) return;
  
  return this.bulkCreate(metrics, {
    ignoreDuplicates: true,
  });
};

// Delete old metrics
Metric.deleteOldMetrics = async function(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.destroy({
    where: {
      collected_at: {
        [Op.lt]: cutoffDate,
      },
    },
  });
};

// Get metrics for aggregation
Metric.getMetricsForHourlyAggregation = async function(hourStart, hourEnd) {
  return sequelize.query(`
    SELECT 
      device_id,
      interface_id,
      metric_type,
      AVG(value) as avg_value,
      MIN(value) as min_value,
      MAX(value) as max_value,
      COUNT(*) as sample_count
    FROM metrics
    WHERE collected_at >= :hourStart AND collected_at < :hourEnd
    GROUP BY device_id, interface_id, metric_type
  `, {
    replacements: { hourStart, hourEnd },
    type: sequelize.QueryTypes.SELECT,
  });
};

// Constants
Metric.METRIC_TYPES = METRIC_TYPES;

module.exports = Metric;
