/**
 * Alarm Model
 */

const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

const METRIC_TYPES = ['cpu', 'memory', 'traffic_in', 'traffic_out', 'uptime', 'errors_in', 'errors_out', 'discards_in', 'discards_out', 'bandwidth_util', 'connectivity'];
const SEVERITIES = ['info', 'warning', 'critical'];
const STATUSES = ['active', 'acknowledged', 'resolved'];

const Alarm = sequelize.define('Alarm', {
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
  rule_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
  },
  severity: {
    type: DataTypes.ENUM(...SEVERITIES),
    allowNull: false,
    defaultValue: 'warning',
  },
  status: {
    type: DataTypes.ENUM(...STATUSES),
    allowNull: false,
    defaultValue: 'active',
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  metric_type: {
    type: DataTypes.ENUM(...METRIC_TYPES),
    allowNull: true,
  },
  current_value: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  threshold_value: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  first_occurrence: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  last_occurrence: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  occurrence_count: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 1,
  },
  acknowledged_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
  },
  acknowledged_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  resolved_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
  },
  resolved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  resolution_note: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'alarms',
  timestamps: true,
  indexes: [
    { fields: ['device_id'] },
    { fields: ['status'] },
    { fields: ['severity'] },
    { fields: ['created_at'] },
    { fields: ['status', 'severity', 'created_at'] },
  ],
});

/**
 * Instance Methods
 */

// Acknowledge alarm
Alarm.prototype.acknowledge = async function(userId) {
  this.status = 'acknowledged';
  this.acknowledged_by = userId;
  this.acknowledged_at = new Date();
  return this.save();
};

// Resolve alarm
Alarm.prototype.resolve = async function(userId, note = null) {
  this.status = 'resolved';
  this.resolved_by = userId;
  this.resolved_at = new Date();
  if (note) {
    this.resolution_note = note;
  }
  return this.save();
};

// Update occurrence
Alarm.prototype.updateOccurrence = async function(value) {
  this.last_occurrence = new Date();
  this.occurrence_count += 1;
  if (value !== undefined) {
    this.current_value = value;
  }
  return this.save();
};

// Get public JSON
Alarm.prototype.toPublicJSON = function() {
  return {
    id: this.id,
    deviceId: this.device_id,
    interfaceId: this.interface_id,
    ruleId: this.rule_id,
    severity: this.severity,
    status: this.status,
    title: this.title,
    message: this.message,
    metricType: this.metric_type,
    currentValue: this.current_value,
    thresholdValue: this.threshold_value,
    firstOccurrence: this.first_occurrence,
    lastOccurrence: this.last_occurrence,
    occurrenceCount: this.occurrence_count,
    acknowledgedBy: this.acknowledged_by,
    acknowledgedAt: this.acknowledged_at,
    resolvedBy: this.resolved_by,
    resolvedAt: this.resolved_at,
    resolutionNote: this.resolution_note,
    createdAt: this.created_at,
    updatedAt: this.updated_at,
  };
};

/**
 * Class Methods
 */

// Get active alarms
Alarm.getActiveAlarms = async function(filters = {}) {
  const where = {
    status: { [Op.ne]: 'resolved' },
  };
  
  if (filters.deviceId) {
    where.device_id = filters.deviceId;
  }
  if (filters.severity) {
    where.severity = filters.severity;
  }
  if (filters.status) {
    where.status = filters.status;
  }
  
  return this.findAll({
    where,
    order: [
      ['severity', 'DESC'],
      ['last_occurrence', 'DESC'],
    ],
    include: ['device', 'interface'],
  });
};

// Find or create alarm for deduplication
Alarm.findOrCreateAlarm = async function(data) {
  const { device_id, interface_id, metric_type, rule_id } = data;
  
  // Look for existing active alarm
  const existing = await this.findOne({
    where: {
      device_id,
      interface_id: interface_id || null,
      metric_type: metric_type || null,
      rule_id: rule_id || null,
      status: { [Op.ne]: 'resolved' },
    },
  });
  
  if (existing) {
    await existing.updateOccurrence(data.current_value);
    return { alarm: existing, created: false };
  }
  
  const alarm = await this.create(data);
  return { alarm, created: true };
};

// Get alarm statistics
Alarm.getStatistics = async function() {
  const results = await sequelize.query(`
    SELECT 
      status,
      severity,
      COUNT(*) as count
    FROM alarms
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    GROUP BY status, severity
  `, {
    type: sequelize.QueryTypes.SELECT,
  });
  
  return results;
};

// Get recent alarms for device
Alarm.getRecentForDevice = async function(deviceId, hours = 24) {
  return this.findAll({
    where: {
      device_id: deviceId,
      created_at: {
        [Op.gte]: new Date(Date.now() - hours * 60 * 60 * 1000),
      },
    },
    order: [['created_at', 'DESC']],
    limit: 50,
  });
};

// Constants
Alarm.SEVERITIES = SEVERITIES;
Alarm.STATUSES = STATUSES;
Alarm.METRIC_TYPES = METRIC_TYPES;

module.exports = Alarm;
