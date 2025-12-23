const { sequelize, Sequelize } = require('../config/database');

// Import models
const User = require('./User');
const Device = require('./Device');
const SnmpCredential = require('./SnmpCredential');
const InterfaceInfo = require('./InterfaceInfo');
const Metric = require('./Metric');
const MetricHourly = require('./MetricHourly');
const MetricDaily = require('./MetricDaily');
const AlarmRule = require('./AlarmRule');
const Alarm = require('./Alarm');
const AIAnalysis = require('./AIAnalysis');
const AuditLog = require('./AuditLog');

// Define associations

// Device <-> SnmpCredential (1:1)
Device.hasOne(SnmpCredential, {
  foreignKey: 'device_id',
  as: 'credentials',
  onDelete: 'CASCADE',
});
SnmpCredential.belongsTo(Device, {
  foreignKey: 'device_id',
  as: 'device',
});

// Device <-> InterfaceInfo (1:N)
Device.hasMany(InterfaceInfo, {
  foreignKey: 'device_id',
  as: 'interfaces',
  onDelete: 'CASCADE',
});
InterfaceInfo.belongsTo(Device, {
  foreignKey: 'device_id',
  as: 'device',
});

// Device <-> Metric (1:N)
Device.hasMany(Metric, {
  foreignKey: 'device_id',
  as: 'metrics',
  onDelete: 'CASCADE',
});
Metric.belongsTo(Device, {
  foreignKey: 'device_id',
  as: 'device',
});

// InterfaceInfo <-> Metric (1:N)
InterfaceInfo.hasMany(Metric, {
  foreignKey: 'interface_id',
  as: 'metrics',
  onDelete: 'CASCADE',
});
Metric.belongsTo(InterfaceInfo, {
  foreignKey: 'interface_id',
  as: 'interface',
});

// Device <-> MetricHourly (1:N)
Device.hasMany(MetricHourly, {
  foreignKey: 'device_id',
  as: 'hourlyMetrics',
  onDelete: 'CASCADE',
});
MetricHourly.belongsTo(Device, {
  foreignKey: 'device_id',
  as: 'device',
});

// Device <-> MetricDaily (1:N)
Device.hasMany(MetricDaily, {
  foreignKey: 'device_id',
  as: 'dailyMetrics',
  onDelete: 'CASCADE',
});
MetricDaily.belongsTo(Device, {
  foreignKey: 'device_id',
  as: 'device',
});

// AlarmRule <-> User (N:1 - created_by)
AlarmRule.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'creator',
  onDelete: 'SET NULL',
});

// Device <-> Alarm (1:N)
Device.hasMany(Alarm, {
  foreignKey: 'device_id',
  as: 'alarms',
  onDelete: 'CASCADE',
});
Alarm.belongsTo(Device, {
  foreignKey: 'device_id',
  as: 'device',
});

// InterfaceInfo <-> Alarm (1:N)
InterfaceInfo.hasMany(Alarm, {
  foreignKey: 'interface_id',
  as: 'alarms',
  onDelete: 'CASCADE',
});
Alarm.belongsTo(InterfaceInfo, {
  foreignKey: 'interface_id',
  as: 'interface',
});

// AlarmRule <-> Alarm (1:N)
AlarmRule.hasMany(Alarm, {
  foreignKey: 'rule_id',
  as: 'alarms',
  onDelete: 'SET NULL',
});
Alarm.belongsTo(AlarmRule, {
  foreignKey: 'rule_id',
  as: 'rule',
});

// User <-> Alarm (acknowledged_by, resolved_by)
Alarm.belongsTo(User, {
  foreignKey: 'acknowledged_by',
  as: 'acknowledgedByUser',
  onDelete: 'SET NULL',
});
Alarm.belongsTo(User, {
  foreignKey: 'resolved_by',
  as: 'resolvedByUser',
  onDelete: 'SET NULL',
});

// Device <-> AIAnalysis (1:N)
Device.hasMany(AIAnalysis, {
  foreignKey: 'device_id',
  as: 'aiAnalyses',
  onDelete: 'CASCADE',
});
AIAnalysis.belongsTo(Device, {
  foreignKey: 'device_id',
  as: 'device',
});

// Alarm <-> AIAnalysis (1:N)
Alarm.hasMany(AIAnalysis, {
  foreignKey: 'alarm_id',
  as: 'aiAnalyses',
  onDelete: 'CASCADE',
});
AIAnalysis.belongsTo(Alarm, {
  foreignKey: 'alarm_id',
  as: 'alarm',
});

// User <-> AuditLog (1:N)
User.hasMany(AuditLog, {
  foreignKey: 'user_id',
  as: 'auditLogs',
  onDelete: 'SET NULL',
});
AuditLog.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

module.exports = {
  sequelize,
  Sequelize,
  User,
  Device,
  SnmpCredential,
  InterfaceInfo,
  Metric,
  MetricHourly,
  MetricDaily,
  AlarmRule,
  Alarm,
  AIAnalysis,
  AuditLog,
};
