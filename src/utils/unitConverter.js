const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  if (!bytes || isNaN(bytes)) return 'N/A';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

const formatBps = (bps, decimals = 2) => {
  if (bps === 0) return '0 bps';
  if (!bps || isNaN(bps)) return 'N/A';
  
  const k = 1000;
  const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
  const i = Math.floor(Math.log(bps) / Math.log(k));
  
  return `${parseFloat((bps / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

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

const calculateBandwidthUtil = (bps, maxBps) => {
  if (!maxBps || maxBps <= 0) return 0;
  const util = (bps / maxBps) * 100;
  return Math.min(100, Math.max(0, util));
};

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

const timeticksToSeconds = (timeticks) => {
  return Math.floor(timeticks / 100);
};

const calculateMemoryPercent = (used, total) => {
  if (!total || total <= 0) return 0;
  const percent = (used / total) * 100;
  return Math.min(100, Math.max(0, percent));
};

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

const formatPercent = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return `${parseFloat(value).toFixed(decimals)}%`;
};

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
