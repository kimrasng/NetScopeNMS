/**
 * Device Model
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Device = sequelize.define('Device', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: false,
    unique: true,
    validate: {
      isIP: true,
    },
  },
  device_type: {
    type: DataTypes.ENUM('router', 'switch', 'server', 'firewall', 'access_point', 'other'),
    allowNull: false,
    defaultValue: 'other',
  },
  vendor: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Cisco, Linux, Windows, etc.',
  },
  model: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  location: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  snmp_version: {
    type: DataTypes.ENUM('1', '2c', '3'),
    allowNull: false,
    defaultValue: '2c',
  },
  snmp_port: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 161,
  },
  poll_interval: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 60,
    comment: 'seconds (60, 300, 600)',
  },
  is_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  status: {
    type: DataTypes.ENUM('up', 'down', 'unknown', 'warning'),
    allowNull: false,
    defaultValue: 'unknown',
  },
  last_poll_time: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  last_poll_success: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  sys_descr: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  sys_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  sys_uptime: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    comment: 'timeticks',
  },
}, {
  tableName: 'devices',
  timestamps: true,
  indexes: [
    { fields: ['ip_address'], unique: true },
    { fields: ['device_type'] },
    { fields: ['status'] },
    { fields: ['is_enabled'] },
  ],
});

/**
 * Instance Methods
 */

// Get uptime in human-readable format
Device.prototype.getUptimeFormatted = function() {
  if (!this.sys_uptime) return 'Unknown';
  
  // sysUpTime is in hundredths of a second (timeticks)
  const totalSeconds = Math.floor(this.sys_uptime / 100);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

// Check if device needs polling
Device.prototype.needsPolling = function() {
  if (!this.is_enabled) return false;
  if (!this.last_poll_time) return true;
  
  const now = new Date();
  const lastPoll = new Date(this.last_poll_time);
  const elapsedSeconds = (now - lastPoll) / 1000;
  
  return elapsedSeconds >= this.poll_interval;
};

// Get public JSON
Device.prototype.toPublicJSON = function() {
  return {
    id: this.id,
    name: this.name,
    ipAddress: this.ip_address,
    deviceType: this.device_type,
    vendor: this.vendor,
    model: this.model,
    location: this.location,
    description: this.description,
    snmpVersion: this.snmp_version,
    snmpPort: this.snmp_port,
    pollInterval: this.poll_interval,
    isEnabled: this.is_enabled,
    status: this.status,
    lastPollTime: this.last_poll_time,
    lastPollSuccess: this.last_poll_success,
    sysDescr: this.sys_descr,
    sysName: this.sys_name,
    sysUptime: this.sys_uptime,
    uptimeFormatted: this.getUptimeFormatted(),
    createdAt: this.created_at,
    updatedAt: this.updated_at,
  };
};

/**
 * Class Methods
 */

// Get devices needing polling
Device.getDevicesForPolling = async function() {
  const { Op } = require('sequelize');
  const now = new Date();
  
  return this.findAll({
    where: {
      is_enabled: true,
      [Op.or]: [
        { last_poll_time: null },
        sequelize.literal(`TIMESTAMPDIFF(SECOND, last_poll_time, NOW()) >= poll_interval`),
      ],
    },
    include: ['credentials'],
  });
};

// Get device with all relations
Device.getWithRelations = async function(id) {
  return this.findByPk(id, {
    include: ['credentials', 'interfaces'],
  });
};

module.exports = Device;
