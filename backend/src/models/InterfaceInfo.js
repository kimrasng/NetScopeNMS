/**
 * Interface Info Model
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InterfaceInfo = sequelize.define('InterfaceInfo', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },
  device_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  if_index: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  if_descr: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  if_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  if_alias: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  if_type: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
  },
  if_speed: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    comment: 'bits per second',
  },
  if_high_speed: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    comment: 'Mbps for high-speed interfaces',
  },
  if_phys_address: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'MAC address',
  },
  if_admin_status: {
    type: DataTypes.ENUM('up', 'down', 'testing'),
    allowNull: true,
  },
  if_oper_status: {
    type: DataTypes.ENUM('up', 'down', 'testing', 'unknown', 'dormant', 'notPresent', 'lowerLayerDown'),
    allowNull: true,
  },
  is_monitored: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'interface_info',
  timestamps: true,
  indexes: [
    { fields: ['device_id', 'if_index'], unique: true },
    { fields: ['is_monitored'] },
  ],
});

/**
 * Instance Methods
 */

// Get speed in human-readable format
InterfaceInfo.prototype.getSpeedFormatted = function() {
  // Prefer ifHighSpeed for high-speed interfaces
  if (this.if_high_speed && this.if_high_speed > 0) {
    const mbps = this.if_high_speed;
    if (mbps >= 1000) {
      return `${(mbps / 1000).toFixed(1)} Gbps`;
    }
    return `${mbps} Mbps`;
  }
  
  if (this.if_speed && this.if_speed > 0) {
    const bps = this.if_speed;
    if (bps >= 1000000000) {
      return `${(bps / 1000000000).toFixed(1)} Gbps`;
    }
    if (bps >= 1000000) {
      return `${(bps / 1000000).toFixed(1)} Mbps`;
    }
    if (bps >= 1000) {
      return `${(bps / 1000).toFixed(1)} Kbps`;
    }
    return `${bps} bps`;
  }
  
  return 'Unknown';
};

// Get effective speed in bps
InterfaceInfo.prototype.getEffectiveSpeed = function() {
  if (this.if_high_speed && this.if_high_speed > 0) {
    return this.if_high_speed * 1000000; // Convert Mbps to bps
  }
  return this.if_speed || 0;
};

// Get display name
InterfaceInfo.prototype.getDisplayName = function() {
  return this.if_name || this.if_descr || `Interface ${this.if_index}`;
};

// Get public JSON
InterfaceInfo.prototype.toPublicJSON = function() {
  return {
    id: this.id,
    deviceId: this.device_id,
    ifIndex: this.if_index,
    ifDescr: this.if_descr,
    ifName: this.if_name,
    ifAlias: this.if_alias,
    ifType: this.if_type,
    ifSpeed: this.if_speed,
    ifHighSpeed: this.if_high_speed,
    speedFormatted: this.getSpeedFormatted(),
    ifPhysAddress: this.if_phys_address,
    ifAdminStatus: this.if_admin_status,
    ifOperStatus: this.if_oper_status,
    displayName: this.getDisplayName(),
    isMonitored: this.is_monitored,
  };
};

// Interface type names (RFC 2863)
InterfaceInfo.IF_TYPES = {
  1: 'other',
  6: 'ethernetCsmacd',
  24: 'softwareLoopback',
  53: 'propVirtual',
  131: 'tunnel',
  135: 'l2vlan',
  136: 'l3ipvlan',
};

module.exports = InterfaceInfo;
