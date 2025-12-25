/**
 * Audit Log Model
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
  },
  action: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  entity_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  entity_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  old_values: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  new_values: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
  user_agent: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
}, {
  tableName: 'audit_logs',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['action'] },
    { fields: ['entity_type', 'entity_id'] },
    { fields: ['created_at'] },
  ],
});

/**
 * Class Methods
 */

// Log an action
AuditLog.logAction = async function(data) {
  return this.create({
    user_id: data.userId,
    action: data.action,
    entity_type: data.entityType,
    entity_id: data.entityId ? String(data.entityId) : null,
    old_values: data.oldValues,
    new_values: data.newValues,
    ip_address: data.ipAddress,
    user_agent: data.userAgent,
  });
};

// Get logs for entity
AuditLog.getForEntity = async function(entityType, entityId, limit = 50) {
  return this.findAll({
    where: {
      entity_type: entityType,
      entity_id: String(entityId),
    },
    order: [['created_at', 'DESC']],
    limit,
    include: ['user'],
  });
};

// Get logs for user
AuditLog.getForUser = async function(userId, limit = 50) {
  return this.findAll({
    where: { user_id: userId },
    order: [['created_at', 'DESC']],
    limit,
  });
};

// Common action types
AuditLog.ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LOGIN: 'login',
  LOGOUT: 'logout',
  RESOLVE_ALARM: 'resolve_alarm',
  ACK_ALARM: 'acknowledge_alarm',
  RUN_AI_ANALYSIS: 'run_ai_analysis',
  TEST_SNMP: 'test_snmp_connection',
};

module.exports = AuditLog;
