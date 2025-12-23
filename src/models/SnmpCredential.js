/**
 * SNMP Credential Model
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const crypto = require('crypto');

// Encryption helpers
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_32_char_encryption_key_!';
const IV_LENGTH = 16;

const encrypt = (text) => {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
};

const decrypt = (text) => {
  if (!text) return null;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    return null;
  }
};

const SnmpCredential = sequelize.define('SnmpCredential', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },
  device_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    unique: true,
  },
  // SNMPv1/v2c
  community_string: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'encrypted',
    set(value) {
      this.setDataValue('community_string', encrypt(value));
    },
  },
  // SNMPv3
  security_level: {
    type: DataTypes.ENUM('noAuthNoPriv', 'authNoPriv', 'authPriv'),
    allowNull: true,
  },
  username: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  auth_protocol: {
    type: DataTypes.ENUM('MD5', 'SHA', 'SHA-256', 'SHA-384', 'SHA-512'),
    allowNull: true,
  },
  auth_password: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'encrypted',
    set(value) {
      this.setDataValue('auth_password', encrypt(value));
    },
  },
  priv_protocol: {
    type: DataTypes.ENUM('DES', 'AES', 'AES-128', 'AES-192', 'AES-256'),
    allowNull: true,
  },
  priv_password: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'encrypted',
    set(value) {
      this.setDataValue('priv_password', encrypt(value));
    },
  },
}, {
  tableName: 'snmp_credentials',
  timestamps: true,
});

/**
 * Instance Methods
 */

// Get decrypted community string
SnmpCredential.prototype.getCommunityString = function() {
  return decrypt(this.community_string);
};

// Get decrypted auth password
SnmpCredential.prototype.getAuthPassword = function() {
  return decrypt(this.auth_password);
};

// Get decrypted priv password
SnmpCredential.prototype.getPrivPassword = function() {
  return decrypt(this.priv_password);
};

// Get credentials for SNMP session
SnmpCredential.prototype.getSessionCredentials = function() {
  return {
    communityString: this.getCommunityString(),
    securityLevel: this.security_level,
    username: this.username,
    authProtocol: this.auth_protocol,
    authPassword: this.getAuthPassword(),
    privProtocol: this.priv_protocol,
    privPassword: this.getPrivPassword(),
  };
};

// Export encryption helpers for external use
SnmpCredential.encrypt = encrypt;
SnmpCredential.decrypt = decrypt;

module.exports = SnmpCredential;
