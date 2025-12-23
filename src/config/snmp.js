const snmp = require('net-snmp');

// Default SNMP settings
const defaults = {
  community: process.env.SNMP_DEFAULT_COMMUNITY || 'public',
  version: process.env.SNMP_DEFAULT_VERSION || '2c',
  port: parseInt(process.env.SNMP_DEFAULT_PORT, 10) || 161,
  timeout: parseInt(process.env.SNMP_TIMEOUT, 10) || 5000,
  retries: parseInt(process.env.SNMP_RETRIES, 10) || 3,
};

// SNMP version mapping
const versionMap = {
  '1': snmp.Version1,
  '2c': snmp.Version2c,
  '3': snmp.Version3,
};

// SNMPv3 Security levels
const securityLevelMap = {
  noAuthNoPriv: snmp.SecurityLevel.noAuthNoPriv,
  authNoPriv: snmp.SecurityLevel.authNoPriv,
  authPriv: snmp.SecurityLevel.authPriv,
};

// SNMPv3 Authentication protocols
const authProtocolMap = {
  MD5: snmp.AuthProtocols.md5,
  SHA: snmp.AuthProtocols.sha,
  'SHA-256': snmp.AuthProtocols.sha256,
  'SHA-384': snmp.AuthProtocols.sha384,
  'SHA-512': snmp.AuthProtocols.sha512,
};

// SNMPv3 Privacy protocols
const privProtocolMap = {
  DES: snmp.PrivProtocols.des,
  AES: snmp.PrivProtocols.aes,
  'AES-128': snmp.PrivProtocols.aes,
  'AES-192': snmp.PrivProtocols.aes192,
  'AES-256': snmp.PrivProtocols.aes256,
};

const createV1V2Options = (device, credentials) => {
  return {
    port: device.snmp_port || defaults.port,
    version: versionMap[device.snmp_version] || snmp.Version2c,
    timeout: defaults.timeout,
    retries: defaults.retries,
  };
};

const createV3User = (credentials) => {
  const user = {
    name: credentials.username,
    level: securityLevelMap[credentials.security_level] || snmp.SecurityLevel.noAuthNoPriv,
  };

  if (credentials.security_level !== 'noAuthNoPriv') {
    user.authProtocol = authProtocolMap[credentials.auth_protocol] || snmp.AuthProtocols.sha;
    user.authKey = credentials.auth_password;
  }

  if (credentials.security_level === 'authPriv') {
    user.privProtocol = privProtocolMap[credentials.priv_protocol] || snmp.PrivProtocols.aes;
    user.privKey = credentials.priv_password;
  }

  return user;
};

const createV3Options = (device, credentials) => {
  return {
    port: device.snmp_port || defaults.port,
    version: snmp.Version3,
    timeout: defaults.timeout,
    retries: defaults.retries,
    idBitsSize: 32,
  };
};

module.exports = {
  defaults,
  versionMap,
  securityLevelMap,
  authProtocolMap,
  privProtocolMap,
  createV1V2Options,
  createV3User,
  createV3Options,
  snmp,
};
