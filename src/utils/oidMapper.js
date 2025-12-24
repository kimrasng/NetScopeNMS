const STANDARD_OIDS = {
  system: {
    sysDescr: '1.3.6.1.2.1.1.1.0',
    sysObjectID: '1.3.6.1.2.1.1.2.0',
    sysUpTime: '1.3.6.1.2.1.1.3.0',
    sysContact: '1.3.6.1.2.1.1.4.0',
    sysName: '1.3.6.1.2.1.1.5.0',
    sysLocation: '1.3.6.1.2.1.1.6.0',
  },
  interfaces: {
    ifNumber: '1.3.6.1.2.1.2.1.0',
    ifTable: '1.3.6.1.2.1.2.2.1',
    ifIndex: '1.3.6.1.2.1.2.2.1.1',
    ifDescr: '1.3.6.1.2.1.2.2.1.2',
    ifType: '1.3.6.1.2.1.2.2.1.3',
    ifMtu: '1.3.6.1.2.1.2.2.1.4',
    ifSpeed: '1.3.6.1.2.1.2.2.1.5',
    ifPhysAddress: '1.3.6.1.2.1.2.2.1.6',
    ifAdminStatus: '1.3.6.1.2.1.2.2.1.7',
    ifOperStatus: '1.3.6.1.2.1.2.2.1.8',
    ifInOctets: '1.3.6.1.2.1.2.2.1.10',
    ifInUcastPkts: '1.3.6.1.2.1.2.2.1.11',
    ifInErrors: '1.3.6.1.2.1.2.2.1.14',
    ifOutOctets: '1.3.6.1.2.1.2.2.1.16',
    ifOutUcastPkts: '1.3.6.1.2.1.2.2.1.17',
    ifOutErrors: '1.3.6.1.2.1.2.2.1.20',
    ifInDiscards: '1.3.6.1.2.1.2.2.1.13',
    ifOutDiscards: '1.3.6.1.2.1.2.2.1.19',
  },
  ifXTable: {
    ifName: '1.3.6.1.2.1.31.1.1.1.1',
    ifHighSpeed: '1.3.6.1.2.1.31.1.1.1.15',
    ifHCInOctets: '1.3.6.1.2.1.31.1.1.1.6',
    ifHCOutOctets: '1.3.6.1.2.1.31.1.1.1.10',
    ifHCInUcastPkts: '1.3.6.1.2.1.31.1.1.1.7',
    ifHCOutUcastPkts: '1.3.6.1.2.1.31.1.1.1.11',
    ifAlias: '1.3.6.1.2.1.31.1.1.1.18',
  },
  hrSystem: {
    hrSystemUptime: '1.3.6.1.2.1.25.1.1.0',
    hrSystemNumUsers: '1.3.6.1.2.1.25.1.5.0',
    hrSystemProcesses: '1.3.6.1.2.1.25.1.6.0',
  },
  hrStorage: {
    hrStorageTable: '1.3.6.1.2.1.25.2.3.1',
    hrStorageIndex: '1.3.6.1.2.1.25.2.3.1.1',
    hrStorageType: '1.3.6.1.2.1.25.2.3.1.2',
    hrStorageDescr: '1.3.6.1.2.1.25.2.3.1.3',
    hrStorageSize: '1.3.6.1.2.1.25.2.3.1.5',
    hrStorageUsed: '1.3.6.1.2.1.25.2.3.1.6',
  },
  hrProcessor: {
    hrProcessorTable: '1.3.6.1.2.1.25.3.3.1',
    hrProcessorLoad: '1.3.6.1.2.1.25.3.3.1.2',
  },
};

const VENDOR_OIDS = {
  cisco: {
    cpu: {
      // Cisco CPU utilization (5 second average) - instance .1 for first CPU
      cpmCPUTotal5sec: '1.3.6.1.4.1.9.9.109.1.1.1.1.3.1',
      // Cisco CPU utilization (1 minute average) - instance .1 for first CPU
      cpmCPUTotal1min: '1.3.6.1.4.1.9.9.109.1.1.1.1.4.1',
      // Cisco CPU utilization (5 minute average) - instance .1 for first CPU
      cpmCPUTotal5min: '1.3.6.1.4.1.9.9.109.1.1.1.1.5.1',
      // Old Cisco CPU OID
      avgBusy5: '1.3.6.1.4.1.9.2.1.58.0',
    },
    memory: {
      // Cisco memory pool used - instance .1 for processor memory pool
      ciscoMemoryPoolUsed: '1.3.6.1.4.1.9.9.48.1.1.1.5.1',
      // Cisco memory pool free - instance .1 for processor memory pool
      ciscoMemoryPoolFree: '1.3.6.1.4.1.9.9.48.1.1.1.6.1',
    },
    environment: {
      // Temperature
      ciscoEnvMonTemperatureStatusValue: '1.3.6.1.4.1.9.9.13.1.3.1.3',
      // Fan status
      ciscoEnvMonFanState: '1.3.6.1.4.1.9.9.13.1.4.1.3',
      // Power supply status
      ciscoEnvMonSupplyState: '1.3.6.1.4.1.9.9.13.1.5.1.3',
    },
  },
  linux: {
    cpu: {
      // CPU user time
      ssCpuUser: '1.3.6.1.4.1.2021.11.9.0',
      // CPU system time
      ssCpuSystem: '1.3.6.1.4.1.2021.11.10.0',
      // CPU idle time
      ssCpuIdle: '1.3.6.1.4.1.2021.11.11.0',
      // Load averages
      laLoad1: '1.3.6.1.4.1.2021.10.1.3.1',
      laLoad5: '1.3.6.1.4.1.2021.10.1.3.2',
      laLoad15: '1.3.6.1.4.1.2021.10.1.3.3',
    },
    memory: {
      // Total memory
      memTotalReal: '1.3.6.1.4.1.2021.4.5.0',
      // Available memory
      memAvailReal: '1.3.6.1.4.1.2021.4.6.0',
      // Total swap
      memTotalSwap: '1.3.6.1.4.1.2021.4.3.0',
      // Available swap
      memAvailSwap: '1.3.6.1.4.1.2021.4.4.0',
      // Buffered memory
      memBuffer: '1.3.6.1.4.1.2021.4.14.0',
      // Cached memory
      memCached: '1.3.6.1.4.1.2021.4.15.0',
    },
    disk: {
      // Disk table
      dskTable: '1.3.6.1.4.1.2021.9.1',
      dskPath: '1.3.6.1.4.1.2021.9.1.2',
      dskTotal: '1.3.6.1.4.1.2021.9.1.6',
      dskAvail: '1.3.6.1.4.1.2021.9.1.7',
      dskUsed: '1.3.6.1.4.1.2021.9.1.8',
      dskPercent: '1.3.6.1.4.1.2021.9.1.9',
    },
  },
  windows: {
    cpu: {
      // Uses hrProcessorLoad from HOST-RESOURCES-MIB
    },
    memory: {
      // Uses hrStorage from HOST-RESOURCES-MIB
    },
  },
  // Generic fallback using HOST-RESOURCES-MIB
  generic: {
    cpu: {
      hrProcessorLoad: '1.3.6.1.2.1.25.3.3.1.2',
    },
    memory: {
      hrStorageSize: '1.3.6.1.2.1.25.2.3.1.5',
      hrStorageUsed: '1.3.6.1.2.1.25.2.3.1.6',
    },
  },
};

const VENDOR_PATTERNS = [
  { pattern: /cisco/i, vendor: 'cisco', type: 'router' },
  { pattern: /ios/i, vendor: 'cisco', type: 'router' },
  { pattern: /catalyst/i, vendor: 'cisco', type: 'switch' },
  { pattern: /nexus/i, vendor: 'cisco', type: 'switch' },
  { pattern: /linux/i, vendor: 'linux', type: 'server' },
  { pattern: /ubuntu/i, vendor: 'linux', type: 'server' },
  { pattern: /centos/i, vendor: 'linux', type: 'server' },
  { pattern: /red\s*hat/i, vendor: 'linux', type: 'server' },
  { pattern: /debian/i, vendor: 'linux', type: 'server' },
  { pattern: /windows/i, vendor: 'windows', type: 'server' },
  { pattern: /microsoft/i, vendor: 'windows', type: 'server' },
  { pattern: /juniper/i, vendor: 'juniper', type: 'router' },
  { pattern: /junos/i, vendor: 'juniper', type: 'router' },
  { pattern: /hp|hewlett/i, vendor: 'hp', type: 'switch' },
  { pattern: /aruba/i, vendor: 'aruba', type: 'access_point' },
  { pattern: /fortinet|fortigate/i, vendor: 'fortinet', type: 'firewall' },
  { pattern: /palo\s*alto/i, vendor: 'paloalto', type: 'firewall' },
  { pattern: /synology/i, vendor: 'synology', type: 'server' },
  { pattern: /qnap/i, vendor: 'qnap', type: 'server' },
  { pattern: /mikrotik/i, vendor: 'mikrotik', type: 'router' },
  { pattern: /ubiquiti|unifi/i, vendor: 'ubiquiti', type: 'access_point' },
];

const detectVendor = (sysDescr) => {
  if (!sysDescr) {
    return { vendor: 'generic', type: 'other' };
  }
  
  for (const { pattern, vendor, type } of VENDOR_PATTERNS) {
    if (pattern.test(sysDescr)) {
      return { vendor, type };
    }
  }
  
  return { vendor: 'generic', type: 'other' };
};

const getVendorOids = (vendor) => {
  // Normalize vendor to lowercase for matching
  const normalizedVendor = vendor ? vendor.toLowerCase() : 'generic';
  return VENDOR_OIDS[normalizedVendor] || VENDOR_OIDS.generic;
};

const getCpuOids = (vendor) => {
  const vendorOids = getVendorOids(vendor);
  return vendorOids.cpu || VENDOR_OIDS.generic.cpu;
};

const getMemoryOids = (vendor) => {
  const vendorOids = getVendorOids(vendor);
  return vendorOids.memory || VENDOR_OIDS.generic.memory;
};

const getEnvironmentOids = (vendor) => {
  const vendorOids = getVendorOids(vendor);
  return vendorOids.environment || null;
};

const getInterfaceOids = (use64bit = true) => {
  const base = STANDARD_OIDS.interfaces;
  const ext = STANDARD_OIDS.ifXTable;
  
  return {
    ifDescr: base.ifDescr,
    ifName: ext.ifName,
    ifAlias: ext.ifAlias,
    ifType: base.ifType,
    ifSpeed: base.ifSpeed,
    ifHighSpeed: ext.ifHighSpeed,
    ifPhysAddress: base.ifPhysAddress,
    ifAdminStatus: base.ifAdminStatus,
    ifOperStatus: base.ifOperStatus,
    ifInOctets: use64bit ? ext.ifHCInOctets : base.ifInOctets,
    ifOutOctets: use64bit ? ext.ifHCOutOctets : base.ifOutOctets,
    ifInErrors: base.ifInErrors,
    ifOutErrors: base.ifOutErrors,
    ifInDiscards: base.ifInDiscards,
    ifOutDiscards: base.ifOutDiscards,
  };
};

const buildInterfaceOid = (baseOid, ifIndex) => {
  return `${baseOid}.${ifIndex}`;
};

const getAllMetricOids = (vendor, interfaces = []) => {
  const cpuOids = getCpuOids(vendor);
  const memoryOids = getMemoryOids(vendor);
  const ifOids = getInterfaceOids();
  
  const result = {
    system: {
      sysUpTime: STANDARD_OIDS.system.sysUpTime,
    },
    cpu: {},
    memory: {},
    interfaces: {},
  };
  
  // Add CPU OIDs
  Object.entries(cpuOids).forEach(([key, oid]) => {
    result.cpu[key] = oid;
  });
  
  // Add memory OIDs
  Object.entries(memoryOids).forEach(([key, oid]) => {
    result.memory[key] = oid;
  });
  
  // Add interface OIDs for each interface
  interfaces.forEach((iface) => {
    const ifIndex = iface.if_index || iface.ifIndex;
    result.interfaces[ifIndex] = {
      ifInOctets: buildInterfaceOid(ifOids.ifInOctets, ifIndex),
      ifOutOctets: buildInterfaceOid(ifOids.ifOutOctets, ifIndex),
      ifInErrors: buildInterfaceOid(ifOids.ifInErrors, ifIndex),
      ifOutErrors: buildInterfaceOid(ifOids.ifOutErrors, ifIndex),
      ifOperStatus: buildInterfaceOid(ifOids.ifOperStatus, ifIndex),
    };
  });
  
  return result;
};

module.exports = {
  STANDARD_OIDS,
  VENDOR_OIDS,
  VENDOR_PATTERNS,
  detectVendor,
  getVendorOids,
  getCpuOids,
  getMemoryOids,
  getEnvironmentOids,
  getInterfaceOids,
  buildInterfaceOid,
  getAllMetricOids,
};
