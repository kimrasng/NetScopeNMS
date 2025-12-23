/**
 * Alarm Rule Model
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const METRIC_TYPES = ['cpu', 'memory', 'traffic_in', 'traffic_out', 'uptime', 'errors_in', 'errors_out', 'discards_in', 'discards_out', 'bandwidth_util'];
const CONDITION_OPERATORS = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'];

const AlarmRule = sequelize.define('AlarmRule', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  metric_type: {
    type: DataTypes.ENUM(...METRIC_TYPES),
    allowNull: false,
  },
  condition_operator: {
    type: DataTypes.ENUM(...CONDITION_OPERATORS),
    allowNull: false,
    defaultValue: 'gt',
  },
  threshold_warning: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  threshold_critical: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  duration_seconds: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
    comment: '0 means immediate',
  },
  apply_to_all: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  device_ids: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'specific device IDs if not apply_to_all',
  },
  is_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  created_by: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
  },
}, {
  tableName: 'alarm_rules',
  timestamps: true,
  indexes: [
    { fields: ['metric_type'] },
    { fields: ['is_enabled'] },
  ],
});

/**
 * Instance Methods
 */

// Check if value matches rule condition
AlarmRule.prototype.checkCondition = function(value) {
  const operators = {
    gt: (a, b) => a > b,
    gte: (a, b) => a >= b,
    lt: (a, b) => a < b,
    lte: (a, b) => a <= b,
    eq: (a, b) => a === b,
    neq: (a, b) => a !== b,
  };
  
  const check = operators[this.condition_operator];
  if (!check) return { triggered: false, severity: null };
  
  // Check critical first
  if (check(value, this.threshold_critical)) {
    return { triggered: true, severity: 'critical' };
  }
  
  // Then check warning
  if (this.threshold_warning && check(value, this.threshold_warning)) {
    return { triggered: true, severity: 'warning' };
  }
  
  return { triggered: false, severity: null };
};

// Check if rule applies to device
AlarmRule.prototype.appliesToDevice = function(deviceId) {
  if (this.apply_to_all) return true;
  if (!this.device_ids || !Array.isArray(this.device_ids)) return false;
  return this.device_ids.includes(deviceId);
};

// Get public JSON
AlarmRule.prototype.toPublicJSON = function() {
  return {
    id: this.id,
    name: this.name,
    description: this.description,
    metricType: this.metric_type,
    conditionOperator: this.condition_operator,
    thresholdWarning: this.threshold_warning,
    thresholdCritical: this.threshold_critical,
    durationSeconds: this.duration_seconds,
    applyToAll: this.apply_to_all,
    deviceIds: this.device_ids,
    isEnabled: this.is_enabled,
    createdBy: this.created_by,
    createdAt: this.created_at,
    updatedAt: this.updated_at,
  };
};

/**
 * Class Methods
 */

// Get active rules for a metric type
AlarmRule.getActiveRulesForMetric = async function(metricType) {
  return this.findAll({
    where: {
      metric_type: metricType,
      is_enabled: true,
    },
  });
};

// Get all active rules
AlarmRule.getActiveRules = async function() {
  return this.findAll({
    where: { is_enabled: true },
  });
};

// Constants
AlarmRule.METRIC_TYPES = METRIC_TYPES;
AlarmRule.CONDITION_OPERATORS = CONDITION_OPERATORS;

module.exports = AlarmRule;
