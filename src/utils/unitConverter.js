/**
 * Unit Converter
 * Converts SNMP values to human-readable units
 */

/**
 * Convert bytes to human-readable format
 * @param {number} bytes - Bytes value
 * @param {number} decimals - Decimal places
 * @returns {string} - Formatted string (e.g., "1.5 GB")
 */
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  if (!bytes || isNaN(bytes)) return 'N/A';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

/**
 * Convert bits per second to human-readable format
 * @param {number} bps - Bits per second
 * @param {number} decimals - Decimal places
 * @returns {string} - Formatted string (e.g., "100 Mbps")
 */
const formatBps = (bps, decimals = 2) => {
  if (bps === 0) return '0 bps';
  if (!bps || isNaN(bps)) return 'N/A';
  
  const k = 1000;
  const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
  const i = Math.floor(Math.log(bps) / Math.log(k));
  
  return `${parseFloat((bps / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

/**
 * Convert octets difference to bits per second
 * @param {number} octets1 - First octets value
 * @param {number} octets2 - Second octets value
 * @param {number} intervalSeconds - Time interval in seconds
 * @returns {number} - Bits per second
 */
const octetsToBps = (octets1, octets2, intervalSeconds) => {
  if (intervalSeconds <= 0) return 0;
  
  let diff = octets2 - octets1;
  
  // Handle counter wrap (32-bit or 64-bit)
  if (diff < 0) {
    // 64-bit counter wrap
    const max64 = BigInt('18446744073709551615');
    diff = Number(max64 - BigInt(octets1) + BigInt(octets2));
    
    // If still negative, try 32-bit wrap
    if (diff < 0 || diff > Number.MAX_SAFE_INTEGER) {
      const max32 = 4294967295;
      diff = max32 - octets1 + octets2;
    }
  }
  
  // Convert octets to bits
  return (diff * 8) / intervalSeconds;
};

/**
 * Calculate bandwidth utilization percentage
 * @param {number} bps - Current bits per second
 * @param {number} maxBps - Maximum interface speed in bps
 * @returns {number} - Percentage (0-100)
 */
const calculateBandwidthUtil = (bps, maxBps) => {
  if (!maxBps || maxBps <= 0) return 0;
  const util = (bps / maxBps) * 100;
  return Math.min(100, Math.max(0, util));
};

/**
 * Format uptime from timeticks
 * @param {number} timeticks - SNMP timeticks (hundredths of second)
 * @returns {string} - Formatted uptime string
 */
const formatUptime = (timeticks) => {
  if (!timeticks || isNaN(timeticks)) return 'Unknown';
  
  const totalSeconds = Math.floor(timeticks / 100);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push(`${seconds}s`);
  
  return parts.join(' ');
};

/**
 * Convert timeticks to seconds
 * @param {number} timeticks - SNMP timeticks
 * @returns {number} - Seconds
 */
const timeticksToSeconds = (timeticks) => {
  return Math.floor(timeticks / 100);
};

/**
 * Calculate memory usage percentage
 * @param {number} used - Used memory
 * @param {number} total - Total memory
 * @returns {number} - Percentage (0-100)
 */
const calculateMemoryPercent = (used, total) => {
  if (!total || total <= 0) return 0;
  const percent = (used / total) * 100;
  return Math.min(100, Math.max(0, percent));
};

/**
 * Calculate Linux memory usage (considering buffers/cache)
 * @param {number} total - Total memory
 * @param {number} available - Available memory
 * @param {number} buffers - Buffer memory
 * @param {number} cached - Cached memory
 * @returns {number} - Used memory percentage
 */
const calculateLinuxMemory = (total, available, buffers = 0, cached = 0) => {
  if (!total || total <= 0) return 0;
  
  // If available is provided (modern kernels)
  if (available !== undefined && available !== null) {
    return calculateMemoryPercent(total - available, total);
  }
  
  // Fallback: free + buffers + cached = available
  const effectiveAvailable = available + buffers + cached;
  return calculateMemoryPercent(total - effectiveAvailable, total);
};

/**
 * Parse MAC address from SNMP octet string
 * @param {Buffer|string} value - SNMP value
 * @returns {string} - Formatted MAC address
 */
const parseMacAddress = (value) => {
  if (!value) return null;
  
  let bytes;
  if (Buffer.isBuffer(value)) {
    bytes = value;
  } else if (typeof value === 'string') {
    // Handle hex string format
    bytes = Buffer.from(value.replace(/[:\-\s]/g, ''), 'hex');
  } else {
    return null;
  }
  
  if (bytes.length !== 6) return null;
  
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join(':')
    .toUpperCase();
};

/**
 * Convert interface admin/oper status number to string
 * @param {number} status - Status number
 * @returns {string} - Status string
 */
const parseIfStatus = (status) => {
  const statusMap = {
    1: 'up',
    2: 'down',
    3: 'testing',
    4: 'unknown',
    5: 'dormant',
    6: 'notPresent',
    7: 'lowerLayerDown',
  };
  return statusMap[status] || 'unknown';
};

/**
 * Format percentage value
 * @param {number} value - Percentage value
 * @param {number} decimals - Decimal places
 * @returns {string} - Formatted string (e.g., "75.5%")
 */
const formatPercent = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return `${parseFloat(value).toFixed(decimals)}%`;
};

/**
 * Round to specified decimal places
 * @param {number} value - Value to round
 * @param {number} decimals - Decimal places
 * @returns {number} - Rounded value
 */
const roundTo = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
};

module.exports = {
  formatBytes,
  formatBps,
  octetsToBps,
  calculateBandwidthUtil,
  formatUptime,
  timeticksToSeconds,
  calculateMemoryPercent,
  calculateLinuxMemory,
  parseMacAddress,
  parseIfStatus,
  formatPercent,
  roundTo,
};
