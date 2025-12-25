/**
 * OID Mapper - Multi-vendor SNMP OID definitions
 * Supports: Cisco, Juniper, HP/Aruba, Fortinet, Palo Alto, MikroTik, 
 *           Ubiquiti, Linux/Ubuntu, Windows, Synology, QNAP, Dell, and more
 */

// ============================================
// Standard MIB OIDs (RFC 1213, HOST-RESOURCES)
// ============================================
const STANDARD_OIDS = {
  system: {
    sysDescr: '1.3.6.1.2.1.1.1.0',
    sysObjectID: '1.3.6.1.2.1.1.2.0',
    sysUpTime: '1.3.6.1.2.1.1.3.0',
    sysContact: '1.3.6.1.2.1.1.4.0',
    sysName: '1.3.6.1.2.1.1.5.0',
    sysLocation: '1.3.6.1.2.1.1.6.0',
    sysServices: '1.3.6.1.2.1.1.7.0',
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
  // HOST-RESOURCES-MIB (RFC 2790)
  hrSystem: {
    hrSystemUptime: '1.3.6.1.2.1.25.1.1.0',
    hrSystemDate: '1.3.6.1.2.1.25.1.2.0',
    hrSystemNumUsers: '1.3.6.1.2.1.25.1.5.0',
    hrSystemProcesses: '1.3.6.1.2.1.25.1.6.0',
    hrSystemMaxProcesses: '1.3.6.1.2.1.25.1.7.0',
  },
  hrStorage: {
    hrStorageTable: '1.3.6.1.2.1.25.2.3.1',
    hrStorageIndex: '1.3.6.1.2.1.25.2.3.1.1',
    hrStorageType: '1.3.6.1.2.1.25.2.3.1.2',
    hrStorageDescr: '1.3.6.1.2.1.25.2.3.1.3',
    hrStorageAllocationUnits: '1.3.6.1.2.1.25.2.3.1.4',
    hrStorageSize: '1.3.6.1.2.1.25.2.3.1.5',
    hrStorageUsed: '1.3.6.1.2.1.25.2.3.1.6',
  },
  hrProcessor: {
    hrProcessorTable: '1.3.6.1.2.1.25.3.3.1',
    hrProcessorLoad: '1.3.6.1.2.1.25.3.3.1.2',
  },
  // TCP-MIB
  tcp: {
    tcpCurrEstab: '1.3.6.1.2.1.6.9.0',
    tcpActiveOpens: '1.3.6.1.2.1.6.5.0',
    tcpPassiveOpens: '1.3.6.1.2.1.6.6.0',
    tcpInSegs: '1.3.6.1.2.1.6.10.0',
    tcpOutSegs: '1.3.6.1.2.1.6.11.0',
  },
  // IP-MIB
  ip: {
    ipForwarding: '1.3.6.1.2.1.4.1.0',
    ipInReceives: '1.3.6.1.2.1.4.3.0',
    ipInDelivers: '1.3.6.1.2.1.4.9.0',
    ipOutRequests: '1.3.6.1.2.1.4.10.0',
  },
  // IP-MIB ARP Table (ipNetToMediaTable)
  arp: {
    ipNetToMediaIfIndex: '1.3.6.1.2.1.4.22.1.1',
    ipNetToMediaPhysAddress: '1.3.6.1.2.1.4.22.1.2',
    ipNetToMediaNetAddress: '1.3.6.1.2.1.4.22.1.3',
    ipNetToMediaType: '1.3.6.1.2.1.4.22.1.4',
  },
  // BRIDGE-MIB (RFC 4188) - MAC Address Table (FDB)
  bridge: {
    dot1dBaseBridgeAddress: '1.3.6.1.2.1.17.1.1.0',
    dot1dBaseNumPorts: '1.3.6.1.2.1.17.1.2.0',
    dot1dBaseType: '1.3.6.1.2.1.17.1.3.0',
    dot1dTpFdbAddress: '1.3.6.1.2.1.17.4.3.1.1',
    dot1dTpFdbPort: '1.3.6.1.2.1.17.4.3.1.2',
    dot1dTpFdbStatus: '1.3.6.1.2.1.17.4.3.1.3',
    dot1dBasePortIfIndex: '1.3.6.1.2.1.17.1.4.1.2',
  },
  // Q-BRIDGE-MIB (IEEE 802.1Q VLAN) - More common on modern switches
  qbridge: {
    dot1qTpFdbPort: '1.3.6.1.2.1.17.7.1.2.2.1.2',
    dot1qTpFdbStatus: '1.3.6.1.2.1.17.7.1.2.2.1.3',
    dot1qVlanCurrentEntry: '1.3.6.1.2.1.17.7.1.4.2.1',
    dot1qVlanStaticName: '1.3.6.1.2.1.17.7.1.4.3.1.1',
  },
};

// ============================================
// Vendor-Specific OIDs
// ============================================
const VENDOR_OIDS = {
  // ==========================================
  // CISCO
  // ==========================================
  cisco: {
    cpu: {
      cpmCPUTotal5sec: '1.3.6.1.4.1.9.9.109.1.1.1.1.3',
      cpmCPUTotal1min: '1.3.6.1.4.1.9.9.109.1.1.1.1.4',
      cpmCPUTotal5min: '1.3.6.1.4.1.9.9.109.1.1.1.1.5',
      cpmCPUTotal5secRev: '1.3.6.1.4.1.9.9.109.1.1.1.1.6',
      cpmCPUTotal1minRev: '1.3.6.1.4.1.9.9.109.1.1.1.1.7',
      cpmCPUTotal5minRev: '1.3.6.1.4.1.9.9.109.1.1.1.1.8',
      avgBusy5: '1.3.6.1.4.1.9.2.1.58.0',
    },
    memory: {
      ciscoMemoryPoolName: '1.3.6.1.4.1.9.9.48.1.1.1.2',
      ciscoMemoryPoolUsed: '1.3.6.1.4.1.9.9.48.1.1.1.5',
      ciscoMemoryPoolFree: '1.3.6.1.4.1.9.9.48.1.1.1.6',
      ciscoMemoryPoolLargestFree: '1.3.6.1.4.1.9.9.48.1.1.1.7',
      cempMemPoolUsed: '1.3.6.1.4.1.9.9.221.1.1.1.1.18',
      cempMemPoolFree: '1.3.6.1.4.1.9.9.221.1.1.1.1.20',
    },
    environment: {
      ciscoEnvMonTemperatureStatusDescr: '1.3.6.1.4.1.9.9.13.1.3.1.2',
      ciscoEnvMonTemperatureStatusValue: '1.3.6.1.4.1.9.9.13.1.3.1.3',
      ciscoEnvMonTemperatureThreshold: '1.3.6.1.4.1.9.9.13.1.3.1.4',
      ciscoEnvMonTemperatureState: '1.3.6.1.4.1.9.9.13.1.3.1.6',
      ciscoEnvMonFanStatusDescr: '1.3.6.1.4.1.9.9.13.1.4.1.2',
      ciscoEnvMonFanState: '1.3.6.1.4.1.9.9.13.1.4.1.3',
      ciscoEnvMonSupplyStatusDescr: '1.3.6.1.4.1.9.9.13.1.5.1.2',
      ciscoEnvMonSupplyState: '1.3.6.1.4.1.9.9.13.1.5.1.3',
    },
  },

  // ==========================================
  // JUNIPER
  // ==========================================
  juniper: {
    cpu: {
      jnxOperatingCPU: '1.3.6.1.4.1.2636.3.1.13.1.8',
      jnxOperating1MinLoadAvg: '1.3.6.1.4.1.2636.3.1.13.1.20',
      jnxOperating5MinLoadAvg: '1.3.6.1.4.1.2636.3.1.13.1.21',
      jnxOperating15MinLoadAvg: '1.3.6.1.4.1.2636.3.1.13.1.22',
    },
    memory: {
      jnxOperatingBuffer: '1.3.6.1.4.1.2636.3.1.13.1.11',
      jnxOperatingMemory: '1.3.6.1.4.1.2636.3.1.13.1.15',
      jnxOperatingHeapUsage: '1.3.6.1.4.1.2636.3.1.13.1.17',
    },
    environment: {
      jnxOperatingDescr: '1.3.6.1.4.1.2636.3.1.13.1.5',
      jnxOperatingTemp: '1.3.6.1.4.1.2636.3.1.13.1.7',
      jnxOperatingState: '1.3.6.1.4.1.2636.3.1.13.1.6',
      jnxFruState: '1.3.6.1.4.1.2636.3.1.15.1.8',
      jnxFruTemp: '1.3.6.1.4.1.2636.3.1.15.1.9',
    },
  },

  // ==========================================
  // HP / ProCurve
  // ==========================================
  hp: {
    cpu: {
      hpSwitchCpuStat: '1.3.6.1.4.1.11.2.14.11.5.1.9.6.1.0',
      hpicfSensorObjectId: '1.3.6.1.4.1.11.2.14.11.1.2.6.1.2',
    },
    memory: {
      hpLocalMemTotalBytes: '1.3.6.1.4.1.11.2.14.11.5.1.1.2.1.1.1.5',
      hpLocalMemFreeBytes: '1.3.6.1.4.1.11.2.14.11.5.1.1.2.1.1.1.6',
      hpLocalMemAllocBytes: '1.3.6.1.4.1.11.2.14.11.5.1.1.2.1.1.1.7',
      hpGlobalMemTotalBytes: '1.3.6.1.4.1.11.2.14.11.5.1.1.2.2.1.1.5',
      hpGlobalMemFreeBytes: '1.3.6.1.4.1.11.2.14.11.5.1.1.2.2.1.1.6',
    },
    environment: {
      hpicfSensorStatus: '1.3.6.1.4.1.11.2.14.11.1.2.6.1.4',
      hpicfSensorDescr: '1.3.6.1.4.1.11.2.14.11.1.2.6.1.7',
      hpSystemAirTempValue: '1.3.6.1.4.1.11.2.14.11.5.1.54.2.1.1.4',
      hpicfFanState: '1.3.6.1.4.1.11.2.14.11.5.1.54.2.2.1.4',
      hpicfPsState: '1.3.6.1.4.1.11.2.14.11.5.1.55.1.1.1.3',
    },
  },

  // ==========================================
  // ARUBA
  // ==========================================
  aruba: {
    cpu: {
      wlsxSysExtCpuUsedPercent: '1.3.6.1.4.1.14823.2.2.1.1.1.9.0',
    },
    memory: {
      wlsxSysExtMemoryUsedPercent: '1.3.6.1.4.1.14823.2.2.1.1.1.10.0',
      wlsxSysExtMemoryTotal: '1.3.6.1.4.1.14823.2.2.1.1.1.11.0',
      wlsxSysExtMemoryUsed: '1.3.6.1.4.1.14823.2.2.1.1.1.12.0',
      wlsxSysExtMemoryFree: '1.3.6.1.4.1.14823.2.2.1.1.1.13.0',
    },
    environment: {
      wlsxSysExtFanStatus: '1.3.6.1.4.1.14823.2.2.1.2.1.17.0',
      sysExtTemperature: '1.3.6.1.4.1.14823.2.2.1.1.1.14.0',
    },
    wireless: {
      wlsxSysExtNumAPs: '1.3.6.1.4.1.14823.2.2.1.1.1.1.0',
      wlsxSysExtNumStations: '1.3.6.1.4.1.14823.2.2.1.1.1.2.0',
    },
  },

  // ==========================================
  // FORTINET (FortiGate)
  // ==========================================
  fortinet: {
    cpu: {
      fgSysCpuUsage: '1.3.6.1.4.1.12356.101.4.1.3.0',
      fgProcessorUsage: '1.3.6.1.4.1.12356.101.4.4.2.1.2',
    },
    memory: {
      fgSysMemUsage: '1.3.6.1.4.1.12356.101.4.1.4.0',
      fgSysMemCapacity: '1.3.6.1.4.1.12356.101.4.1.5.0',
    },
    session: {
      fgSysSesCount: '1.3.6.1.4.1.12356.101.4.1.8.0',
      fgSysSesRate1: '1.3.6.1.4.1.12356.101.4.1.11.0',
    },
    environment: {
      fgHwSensorCount: '1.3.6.1.4.1.12356.101.4.3.1.0',
      fgHwSensorEntName: '1.3.6.1.4.1.12356.101.4.3.2.1.2',
      fgHwSensorEntValue: '1.3.6.1.4.1.12356.101.4.3.2.1.3',
      fgHwSensorEntAlarmStatus: '1.3.6.1.4.1.12356.101.4.3.2.1.4',
    },
  },

  // ==========================================
  // PALO ALTO
  // ==========================================
  paloalto: {
    cpu: {
      panSysCpuMgmt: '1.3.6.1.4.1.25461.2.1.2.3.1.0',
      panSysCpuData: '1.3.6.1.4.1.25461.2.1.2.3.2.0',
    },
    memory: {
      panSysSwMemoryUsed: '1.3.6.1.4.1.25461.2.1.2.3.6.0',
      panSessionActive: '1.3.6.1.4.1.25461.2.1.2.3.3.0',
    },
    session: {
      panSessionUtilization: '1.3.6.1.4.1.25461.2.1.2.3.4.0',
      panSessionMax: '1.3.6.1.4.1.25461.2.1.2.3.5.0',
    },
    globalprotect: {
      panGPGWUtilizationPct: '1.3.6.1.4.1.25461.2.1.2.5.1.1.0',
      panGPGWUtilizationMaxTunnels: '1.3.6.1.4.1.25461.2.1.2.5.1.2.0',
      panGPGWUtilizationActiveTunnels: '1.3.6.1.4.1.25461.2.1.2.5.1.3.0',
    },
  },

  // ==========================================
  // MIKROTIK
  // ==========================================
  mikrotik: {
    cpu: {
      mtxrProcessorLoad: '1.3.6.1.4.1.14988.1.1.3.14.0',
      mtxrProcessorFrequency: '1.3.6.1.4.1.14988.1.1.3.15.0',
    },
    memory: {
      mtxrMemoryTotal: '1.3.6.1.4.1.14988.1.1.3.7.0',
      mtxrMemoryUsed: '1.3.6.1.4.1.14988.1.1.3.8.0',
    },
    storage: {
      mtxrDiskTotal: '1.3.6.1.4.1.14988.1.1.3.9.0',
      mtxrDiskUsed: '1.3.6.1.4.1.14988.1.1.3.10.0',
    },
    environment: {
      mtxrBoardTemperature: '1.3.6.1.4.1.14988.1.1.3.100.0',
      mtxrCpuTemperature: '1.3.6.1.4.1.14988.1.1.3.101.0',
      mtxrActiveFanCount: '1.3.6.1.4.1.14988.1.1.3.16.0',
      mtxrFanSpeed1: '1.3.6.1.4.1.14988.1.1.3.17.0',
      mtxrFanSpeed2: '1.3.6.1.4.1.14988.1.1.3.18.0',
      mtxrVoltage: '1.3.6.1.4.1.14988.1.1.3.8.0',
      mtxrPowerConsumption: '1.3.6.1.4.1.14988.1.1.3.12.0',
    },
    wireless: {
      mtxrWlStatTxRate: '1.3.6.1.4.1.14988.1.1.1.3.1.2',
      mtxrWlStatRxRate: '1.3.6.1.4.1.14988.1.1.1.3.1.3',
      mtxrWlStatStrength: '1.3.6.1.4.1.14988.1.1.1.3.1.4',
      mtxrWlApClientCount: '1.3.6.1.4.1.14988.1.1.1.3.1.6',
    },
  },

  // ==========================================
  // UBIQUITI
  // ==========================================
  ubiquiti: {
    cpu: {
      hrProcessorLoad: '1.3.6.1.2.1.25.3.3.1.2',
    },
    memory: {
      hrStorageSize: '1.3.6.1.2.1.25.2.3.1.5',
      hrStorageUsed: '1.3.6.1.2.1.25.2.3.1.6',
    },
    environment: {
      unifiTemperature: '1.3.6.1.4.1.41112.1.6.1.1.1.3',
    },
    wireless: {
      unifiApSystemModel: '1.3.6.1.4.1.41112.1.6.1.1.1.1',
      unifiApSystemUptime: '1.3.6.1.4.1.41112.1.6.1.1.1.4',
      unifiVapEssid: '1.3.6.1.4.1.41112.1.6.1.2.1.6',
      unifiVapNumStations: '1.3.6.1.4.1.41112.1.6.1.2.1.8',
    },
  },

  // ==========================================
  // LINUX / UBUNTU (net-snmp)
  // ==========================================
  linux: {
    cpu: {
      ssCpuRawUser: '1.3.6.1.4.1.2021.11.50.0',
      ssCpuRawNice: '1.3.6.1.4.1.2021.11.51.0',
      ssCpuRawSystem: '1.3.6.1.4.1.2021.11.52.0',
      ssCpuRawIdle: '1.3.6.1.4.1.2021.11.53.0',
      ssCpuRawWait: '1.3.6.1.4.1.2021.11.54.0',
      ssCpuRawKernel: '1.3.6.1.4.1.2021.11.55.0',
      ssCpuRawInterrupt: '1.3.6.1.4.1.2021.11.56.0',
      ssCpuUser: '1.3.6.1.4.1.2021.11.9.0',
      ssCpuSystem: '1.3.6.1.4.1.2021.11.10.0',
      ssCpuIdle: '1.3.6.1.4.1.2021.11.11.0',
      laTable: '1.3.6.1.4.1.2021.10.1',
      laLoad1: '1.3.6.1.4.1.2021.10.1.3.1',
      laLoad5: '1.3.6.1.4.1.2021.10.1.3.2',
      laLoad15: '1.3.6.1.4.1.2021.10.1.3.3',
    },
    memory: {
      memTotalReal: '1.3.6.1.4.1.2021.4.5.0',
      memAvailReal: '1.3.6.1.4.1.2021.4.6.0',
      memTotalSwap: '1.3.6.1.4.1.2021.4.3.0',
      memAvailSwap: '1.3.6.1.4.1.2021.4.4.0',
      memBuffer: '1.3.6.1.4.1.2021.4.14.0',
      memCached: '1.3.6.1.4.1.2021.4.15.0',
      memShared: '1.3.6.1.4.1.2021.4.13.0',
      memTotalFree: '1.3.6.1.4.1.2021.4.11.0',
    },
    disk: {
      dskTable: '1.3.6.1.4.1.2021.9.1',
      dskIndex: '1.3.6.1.4.1.2021.9.1.1',
      dskPath: '1.3.6.1.4.1.2021.9.1.2',
      dskDevice: '1.3.6.1.4.1.2021.9.1.3',
      dskTotal: '1.3.6.1.4.1.2021.9.1.6',
      dskAvail: '1.3.6.1.4.1.2021.9.1.7',
      dskUsed: '1.3.6.1.4.1.2021.9.1.8',
      dskPercent: '1.3.6.1.4.1.2021.9.1.9',
      dskPercentNode: '1.3.6.1.4.1.2021.9.1.10',
    },
    process: {
      prTable: '1.3.6.1.4.1.2021.2.1',
      prNames: '1.3.6.1.4.1.2021.2.1.2',
      prCount: '1.3.6.1.4.1.2021.2.1.5',
    },
    system: {
      ssSwapIn: '1.3.6.1.4.1.2021.11.3.0',
      ssSwapOut: '1.3.6.1.4.1.2021.11.4.0',
      ssSysInterrupts: '1.3.6.1.4.1.2021.11.7.0',
      ssSysContext: '1.3.6.1.4.1.2021.11.8.0',
      ssIOSent: '1.3.6.1.4.1.2021.11.1.0',
      ssIOReceive: '1.3.6.1.4.1.2021.11.2.0',
    },
    lmSensors: {
      lmTempSensorsIndex: '1.3.6.1.4.1.2021.13.16.2.1.1',
      lmTempSensorsDevice: '1.3.6.1.4.1.2021.13.16.2.1.2',
      lmTempSensorsValue: '1.3.6.1.4.1.2021.13.16.2.1.3',
      lmFanSensorsIndex: '1.3.6.1.4.1.2021.13.16.3.1.1',
      lmFanSensorsDevice: '1.3.6.1.4.1.2021.13.16.3.1.2',
      lmFanSensorsValue: '1.3.6.1.4.1.2021.13.16.3.1.3',
    },
  },

  // ==========================================
  // WINDOWS
  // ==========================================
  windows: {
    cpu: {
      hrProcessorLoad: '1.3.6.1.2.1.25.3.3.1.2',
    },
    memory: {
      hrStorageDescr: '1.3.6.1.2.1.25.2.3.1.3',
      hrStorageSize: '1.3.6.1.2.1.25.2.3.1.5',
      hrStorageUsed: '1.3.6.1.2.1.25.2.3.1.6',
      hrStorageAllocationUnits: '1.3.6.1.2.1.25.2.3.1.4',
    },
    process: {
      hrSWRunName: '1.3.6.1.2.1.25.4.2.1.2',
      hrSWRunStatus: '1.3.6.1.2.1.25.4.2.1.7',
    },
    services: {
      svSvcName: '1.3.6.1.4.1.77.1.2.3.1.1',
      svSvcInstalledState: '1.3.6.1.4.1.77.1.2.3.1.2',
      svSvcOperatingState: '1.3.6.1.4.1.77.1.2.3.1.3',
    },
  },

  // ==========================================
  // SYNOLOGY NAS
  // ==========================================
  synology: {
    cpu: {
      cpuFanStatus: '1.3.6.1.4.1.6574.1.4.1.0',
      systemFanStatus: '1.3.6.1.4.1.6574.1.4.2.0',
    },
    memory: {
      hrStorageSize: '1.3.6.1.2.1.25.2.3.1.5',
      hrStorageUsed: '1.3.6.1.2.1.25.2.3.1.6',
    },
    storage: {
      spaceTotal: '1.3.6.1.4.1.6574.2.1.1.3',
      spaceUsed: '1.3.6.1.4.1.6574.2.1.1.4',
    },
    disk: {
      diskID: '1.3.6.1.4.1.6574.2.1.1.2',
      diskModel: '1.3.6.1.4.1.6574.2.1.1.3',
      diskStatus: '1.3.6.1.4.1.6574.2.1.1.5',
      diskTemperature: '1.3.6.1.4.1.6574.2.1.1.6',
    },
    raid: {
      raidName: '1.3.6.1.4.1.6574.3.1.1.2',
      raidStatus: '1.3.6.1.4.1.6574.3.1.1.3',
    },
    system: {
      systemStatus: '1.3.6.1.4.1.6574.1.1.0',
      temperature: '1.3.6.1.4.1.6574.1.2.0',
      powerStatus: '1.3.6.1.4.1.6574.1.3.0',
      systemFan: '1.3.6.1.4.1.6574.1.4.1.0',
      cpuFan: '1.3.6.1.4.1.6574.1.4.2.0',
      modelName: '1.3.6.1.4.1.6574.1.5.1.0',
      serialNumber: '1.3.6.1.4.1.6574.1.5.2.0',
      dsmVersion: '1.3.6.1.4.1.6574.1.5.3.0',
    },
  },

  // ==========================================
  // QNAP NAS
  // ==========================================
  qnap: {
    cpu: {
      cpuUsage: '1.3.6.1.4.1.24681.1.2.1.0',
    },
    memory: {
      systemTotalMem: '1.3.6.1.4.1.24681.1.2.2.0',
      systemFreeMem: '1.3.6.1.4.1.24681.1.2.3.0',
    },
    storage: {
      sysVolumeTotalSize: '1.3.6.1.4.1.24681.1.2.17.1.4',
      sysVolumeFreeSize: '1.3.6.1.4.1.24681.1.2.17.1.5',
      sysvolumeStatus: '1.3.6.1.4.1.24681.1.2.17.1.6',
    },
    disk: {
      hdDescr: '1.3.6.1.4.1.24681.1.2.11.1.2',
      hdTemperature: '1.3.6.1.4.1.24681.1.2.11.1.3',
      hdStatus: '1.3.6.1.4.1.24681.1.2.11.1.4',
      hdModel: '1.3.6.1.4.1.24681.1.2.11.1.5',
      hdSmartInfo: '1.3.6.1.4.1.24681.1.2.11.1.7',
    },
    system: {
      systemCPUTemp: '1.3.6.1.4.1.24681.1.2.5.0',
      systemTemp: '1.3.6.1.4.1.24681.1.2.6.0',
      systemUptime: '1.3.6.1.4.1.24681.1.2.4.0',
    },
    fan: {
      sysFanDescr: '1.3.6.1.4.1.24681.1.2.15.1.2',
      sysFanSpeed: '1.3.6.1.4.1.24681.1.2.15.1.3',
    },
  },

  // ==========================================
  // DELL (iDRAC, PowerEdge)
  // ==========================================
  dell: {
    cpu: {
      processorDeviceStatusStatus: '1.3.6.1.4.1.674.10892.5.4.1100.30.1.5',
      processorDeviceMaximumSpeed: '1.3.6.1.4.1.674.10892.5.4.1100.30.1.11',
    },
    memory: {
      memoryDeviceStatus: '1.3.6.1.4.1.674.10892.5.4.1100.50.1.5',
      memoryDeviceSize: '1.3.6.1.4.1.674.10892.5.4.1100.50.1.14',
    },
    environment: {
      temperatureProbeStatus: '1.3.6.1.4.1.674.10892.5.4.700.20.1.5',
      temperatureProbeReading: '1.3.6.1.4.1.674.10892.5.4.700.20.1.6',
      coolingDeviceStatus: '1.3.6.1.4.1.674.10892.5.4.700.12.1.5',
      coolingDeviceReading: '1.3.6.1.4.1.674.10892.5.4.700.12.1.6',
      powerSupplyStatus: '1.3.6.1.4.1.674.10892.5.4.600.12.1.5',
    },
    storage: {
      virtualDiskState: '1.3.6.1.4.1.674.10892.5.5.1.20.140.1.1.4',
      physicalDiskState: '1.3.6.1.4.1.674.10892.5.5.1.20.130.4.1.4',
    },
  },

  // ==========================================
  // GENERIC (fallback)
  // ==========================================
  generic: {
    cpu: {
      hrProcessorLoad: '1.3.6.1.2.1.25.3.3.1.2',
    },
    memory: {
      hrStorageDescr: '1.3.6.1.2.1.25.2.3.1.3',
      hrStorageSize: '1.3.6.1.2.1.25.2.3.1.5',
      hrStorageUsed: '1.3.6.1.2.1.25.2.3.1.6',
      hrStorageAllocationUnits: '1.3.6.1.2.1.25.2.3.1.4',
    },
    system: {
      hrSystemUptime: '1.3.6.1.2.1.25.1.1.0',
      hrSystemNumUsers: '1.3.6.1.2.1.25.1.5.0',
      hrSystemProcesses: '1.3.6.1.2.1.25.1.6.0',
    },
  },
};

// ============================================
// Vendor Detection Patterns
// ============================================
const VENDOR_PATTERNS = [
  // Cisco
  { pattern: /cisco/i, vendor: 'cisco', type: 'router' },
  { pattern: /ios(-|\s)?xe/i, vendor: 'cisco', type: 'router' },
  { pattern: /ios(-|\s)?xr/i, vendor: 'cisco', type: 'router' },
  { pattern: /nx(-|\s)?os/i, vendor: 'cisco', type: 'switch' },
  { pattern: /catalyst/i, vendor: 'cisco', type: 'switch' },
  { pattern: /nexus/i, vendor: 'cisco', type: 'switch' },
  { pattern: /asa/i, vendor: 'cisco', type: 'firewall' },
  { pattern: /meraki/i, vendor: 'cisco', type: 'access_point' },
  
  // Juniper
  { pattern: /juniper/i, vendor: 'juniper', type: 'router' },
  { pattern: /junos/i, vendor: 'juniper', type: 'router' },
  { pattern: /srx/i, vendor: 'juniper', type: 'firewall' },
  { pattern: /ex\d{4}/i, vendor: 'juniper', type: 'switch' },
  { pattern: /qfx/i, vendor: 'juniper', type: 'switch' },
  
  // HP / Aruba
  { pattern: /aruba/i, vendor: 'aruba', type: 'switch' },
  { pattern: /arubaos/i, vendor: 'aruba', type: 'access_point' },
  { pattern: /procurve/i, vendor: 'hp', type: 'switch' },
  { pattern: /hp\s+switch/i, vendor: 'hp', type: 'switch' },
  { pattern: /hewlett[\s-]?packard/i, vendor: 'hp', type: 'switch' },
  { pattern: /comware/i, vendor: 'hp', type: 'switch' },
  
  // Fortinet
  { pattern: /fortinet/i, vendor: 'fortinet', type: 'firewall' },
  { pattern: /fortigate/i, vendor: 'fortinet', type: 'firewall' },
  { pattern: /fortios/i, vendor: 'fortinet', type: 'firewall' },
  { pattern: /fortiswitch/i, vendor: 'fortinet', type: 'switch' },
  { pattern: /fortiap/i, vendor: 'fortinet', type: 'access_point' },
  
  // Palo Alto
  { pattern: /palo\s*alto/i, vendor: 'paloalto', type: 'firewall' },
  { pattern: /pan-?os/i, vendor: 'paloalto', type: 'firewall' },
  
  // MikroTik
  { pattern: /mikrotik/i, vendor: 'mikrotik', type: 'router' },
  { pattern: /routeros/i, vendor: 'mikrotik', type: 'router' },
  { pattern: /routerboard/i, vendor: 'mikrotik', type: 'router' },
  { pattern: /swos/i, vendor: 'mikrotik', type: 'switch' },
  
  // Ubiquiti
  { pattern: /ubiquiti/i, vendor: 'ubiquiti', type: 'access_point' },
  { pattern: /unifi/i, vendor: 'ubiquiti', type: 'access_point' },
  { pattern: /edgeswitch/i, vendor: 'ubiquiti', type: 'switch' },
  { pattern: /edgerouter/i, vendor: 'ubiquiti', type: 'router' },
  { pattern: /usg/i, vendor: 'ubiquiti', type: 'firewall' },
  
  // Linux distributions
  { pattern: /linux/i, vendor: 'linux', type: 'server' },
  { pattern: /ubuntu/i, vendor: 'linux', type: 'server' },
  { pattern: /debian/i, vendor: 'linux', type: 'server' },
  { pattern: /centos/i, vendor: 'linux', type: 'server' },
  { pattern: /red\s*hat/i, vendor: 'linux', type: 'server' },
  { pattern: /rhel/i, vendor: 'linux', type: 'server' },
  { pattern: /fedora/i, vendor: 'linux', type: 'server' },
  { pattern: /rocky/i, vendor: 'linux', type: 'server' },
  { pattern: /alma/i, vendor: 'linux', type: 'server' },
  { pattern: /suse/i, vendor: 'linux', type: 'server' },
  { pattern: /oracle\s*linux/i, vendor: 'linux', type: 'server' },
  { pattern: /amazon\s*linux/i, vendor: 'linux', type: 'server' },
  { pattern: /net-snmp/i, vendor: 'linux', type: 'server' },
  
  // Windows
  { pattern: /windows/i, vendor: 'windows', type: 'server' },
  { pattern: /microsoft/i, vendor: 'windows', type: 'server' },
  { pattern: /win32/i, vendor: 'windows', type: 'server' },
  
  // NAS devices
  { pattern: /synology/i, vendor: 'synology', type: 'server' },
  { pattern: /diskstation/i, vendor: 'synology', type: 'server' },
  { pattern: /rackstation/i, vendor: 'synology', type: 'server' },
  { pattern: /dsm/i, vendor: 'synology', type: 'server' },
  { pattern: /qnap/i, vendor: 'qnap', type: 'server' },
  { pattern: /turbo\s*nas/i, vendor: 'qnap', type: 'server' },
  { pattern: /qts/i, vendor: 'qnap', type: 'server' },
  
  // Dell
  { pattern: /dell/i, vendor: 'dell', type: 'server' },
  { pattern: /idrac/i, vendor: 'dell', type: 'server' },
  { pattern: /poweredge/i, vendor: 'dell', type: 'server' },
  { pattern: /force10/i, vendor: 'dell', type: 'switch' },
  
  // VMware
  { pattern: /vmware/i, vendor: 'linux', type: 'server' },
  { pattern: /esxi/i, vendor: 'linux', type: 'server' },
];

// ============================================
// Helper Functions
// ============================================

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

const getStorageOids = (vendor) => {
  const vendorOids = getVendorOids(vendor);
  return vendorOids.storage || vendorOids.disk || null;
};

const getSystemOids = (vendor) => {
  const vendorOids = getVendorOids(vendor);
  return vendorOids.system || VENDOR_OIDS.generic.system || null;
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
  const envOids = getEnvironmentOids(vendor);
  const storageOids = getStorageOids(vendor);
  const systemOids = getSystemOids(vendor);
  const ifOids = getInterfaceOids();
  
  const result = {
    system: { sysUpTime: STANDARD_OIDS.system.sysUpTime },
    cpu: {},
    memory: {},
    environment: {},
    storage: {},
    interfaces: {},
  };
  
  if (cpuOids) Object.entries(cpuOids).forEach(([key, oid]) => { result.cpu[key] = oid; });
  if (memoryOids) Object.entries(memoryOids).forEach(([key, oid]) => { result.memory[key] = oid; });
  if (envOids) Object.entries(envOids).forEach(([key, oid]) => { result.environment[key] = oid; });
  if (storageOids) Object.entries(storageOids).forEach(([key, oid]) => { result.storage[key] = oid; });
  if (systemOids) Object.entries(systemOids).forEach(([key, oid]) => { result.system[key] = oid; });
  
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

const getSupportedVendors = () => Object.keys(VENDOR_OIDS);

const isVendorSupported = (vendor) => {
  const normalizedVendor = vendor ? vendor.toLowerCase() : 'generic';
  return VENDOR_OIDS.hasOwnProperty(normalizedVendor);
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
  getStorageOids,
  getSystemOids,
  getInterfaceOids,
  buildInterfaceOid,
  getAllMetricOids,
  getSupportedVendors,
  isVendorSupported,
};
