/**
 * SNMP Service - Multi-vendor Network Monitoring
 * Supports: Cisco, Juniper, HP/Aruba, Fortinet, Palo Alto, MikroTik, 
 *           Ubiquiti, Linux/Ubuntu, Windows, Synology, QNAP, Dell, and more
 */

const snmp = require('net-snmp');
const logger = require('../utils/logger');
const snmpConfig = require('../config/snmp');
const oidMapper = require('../utils/oidMapper');
const unitConverter = require('../utils/unitConverter');
const { Device, SnmpCredential, InterfaceInfo, Metric } = require('../models');

class SNMPService {
  constructor() {
    this.sessions = new Map();
    this.previousValues = new Map();
    this.cpuCounters = new Map(); // For Linux raw CPU counters
  }

  createSession(device, credentials) {
    const target = device.ip_address;
    const version = device.snmp_version;

    try {
      if (version === '3') {
        const user = snmpConfig.createV3User(credentials);
        const options = snmpConfig.createV3Options(device, credentials);
        return snmp.createV3Session(target, user, options);
      } else {
        const community = credentials.communityString || snmpConfig.defaults.community;
        const options = snmpConfig.createV1V2Options(device, credentials);
        return snmp.createSession(target, community, options);
      }
    } catch (error) {
      logger.error(`Failed to create SNMP session for ${target}:`, error);
      throw error;
    }
  }

  closeSession(session) {
    try {
      if (session) session.close();
    } catch (error) {
      logger.warn('Error closing SNMP session:', error);
    }
  }

  get(session, oid) {
    return new Promise((resolve, reject) => {
      session.get([oid], (error, varbinds) => {
        if (error) { reject(error); return; }
        if (varbinds[0].type === snmp.ErrorStatus.NoSuchObject ||
            varbinds[0].type === snmp.ErrorStatus.NoSuchInstance ||
            varbinds[0].type === snmp.ErrorStatus.EndOfMibView) {
          resolve(null); return;
        }
        let value = varbinds[0].value;
        // OctetString type (4) should be returned as string
        if (Buffer.isBuffer(value)) {
          // Check if it looks like a printable string
          const str = value.toString();
          if (/^[\x20-\x7E\s]*$/.test(str) && str.length > 0) {
            // Printable ASCII - return as string
            resolve(str);
            return;
          }
          // Binary data - convert to number based on length
          if (value.length >= 8) {
            try {
              value = Number(value.readBigUInt64BE(0));
            } catch (e) {
              value = str;
            }
          } else if (value.length >= 4) {
            value = value.readUInt32BE(0);
          } else if (value.length >= 2) {
            value = value.readUInt16BE(0);
          } else if (value.length === 1) {
            value = value.readUInt8(0);
          } else {
            value = str;
          }
        }
        resolve(value);
      });
    });
  }

  getMultiple(session, oids) {
    return new Promise((resolve, reject) => {
      session.get(oids, (error, varbinds) => {
        if (error) { reject(error); return; }
        const result = {};
        varbinds.forEach((vb) => {
          if (vb.type !== snmp.ErrorStatus.NoSuchObject &&
              vb.type !== snmp.ErrorStatus.NoSuchInstance &&
              vb.type !== snmp.ErrorStatus.EndOfMibView) {
            result[vb.oid] = vb.value;
          }
        });
        resolve(result);
      });
    });
  }

  walk(session, oid) {
    return new Promise((resolve, reject) => {
      const results = [];
      session.subtree(oid, (varbinds) => {
        varbinds.forEach((vb) => {
          if (vb.type !== snmp.ErrorStatus.NoSuchObject &&
              vb.type !== snmp.ErrorStatus.NoSuchInstance &&
              vb.type !== snmp.ErrorStatus.EndOfMibView) {
            results.push({ oid: vb.oid, value: vb.value, type: vb.type });
          }
        });
      }, (error) => {
        if (error) reject(error);
        else resolve(results);
      });
    });
  }

  async testConnection(device, credentials) {
    let session = null;
    const startTime = Date.now();

    try {
      session = this.createSession(device, credentials);
      const sysDescr = await this.get(session, oidMapper.STANDARD_OIDS.system.sysDescr);
      const sysName = await this.get(session, oidMapper.STANDARD_OIDS.system.sysName);
      const sysUpTime = await this.get(session, oidMapper.STANDARD_OIDS.system.sysUpTime);

      const responseTime = Date.now() - startTime;
      const vendorInfo = oidMapper.detectVendor(sysDescr?.toString());

      return {
        success: true,
        responseTimeMs: responseTime,
        sysDescr: sysDescr?.toString() || null,
        sysName: sysName?.toString() || null,
        sysUpTime: sysUpTime ? Number(sysUpTime) : null,
        uptimeFormatted: sysUpTime ? unitConverter.formatUptime(Number(sysUpTime)) : null,
        detectedVendor: vendorInfo.vendor,
        detectedType: vendorInfo.type,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        responseTimeMs: Date.now() - startTime,
      };
    } finally {
      this.closeSession(session);
    }
  }

  async discoverInterfaces(deviceId) {
    const device = await Device.getWithRelations(deviceId);
    if (!device) throw new Error(`Device ${deviceId} not found`);

    const credentials = device.credentials?.getSessionCredentials() || {};
    let session = null;

    try {
      session = this.createSession(device, credentials);
      const ifOids = oidMapper.getInterfaceOids();
      const interfaces = [];

      const ifDescrResults = await this.walk(session, ifOids.ifDescr);
      
      for (const result of ifDescrResults) {
        const ifIndex = parseInt(result.oid.split('.').pop(), 10);
        interfaces.push({
          device_id: deviceId,
          if_index: ifIndex,
          if_descr: result.value?.toString() || null,
        });
      }

      for (const iface of interfaces) {
        const ifIndex = iface.if_index;
        try {
          const [ifName, ifAlias, ifType, ifSpeed, ifHighSpeed, ifPhysAddress, ifAdminStatus, ifOperStatus] = await Promise.all([
            this.get(session, `${ifOids.ifName}.${ifIndex}`).catch(() => null),
            this.get(session, `${ifOids.ifAlias}.${ifIndex}`).catch(() => null),
            this.get(session, `${ifOids.ifType}.${ifIndex}`).catch(() => null),
            this.get(session, `${ifOids.ifSpeed}.${ifIndex}`).catch(() => null),
            this.get(session, `${ifOids.ifHighSpeed}.${ifIndex}`).catch(() => null),
            this.get(session, `${ifOids.ifPhysAddress}.${ifIndex}`).catch(() => null),
            this.get(session, `${ifOids.ifAdminStatus}.${ifIndex}`).catch(() => null),
            this.get(session, `${ifOids.ifOperStatus}.${ifIndex}`).catch(() => null),
          ]);

          iface.if_name = ifName?.toString() || null;
          iface.if_alias = ifAlias?.toString() || null;
          iface.if_type = ifType ? Number(ifType) : null;
          iface.if_speed = ifSpeed ? Number(ifSpeed) : null;
          iface.if_high_speed = ifHighSpeed ? Number(ifHighSpeed) : null;
          iface.if_phys_address = unitConverter.parseMacAddress(ifPhysAddress);
          iface.if_admin_status = unitConverter.parseIfStatus(ifAdminStatus);
          iface.if_oper_status = unitConverter.parseIfStatus(ifOperStatus);
        } catch (error) {
          logger.warn(`Error getting interface ${ifIndex} details:`, error);
        }
      }

      for (const iface of interfaces) {
        await InterfaceInfo.upsert(iface, { conflictFields: ['device_id', 'if_index'] });
      }

      logger.info(`Discovered ${interfaces.length} interfaces for device ${deviceId}`);
      return interfaces;
    } finally {
      this.closeSession(session);
    }
  }

  /**
   * Collect basic system information (sysDescr, sysName, sysLocation, sysContact, sysUpTime)
   */
  async collectSystemInfo(session) {
    const systemOids = oidMapper.STANDARD_OIDS.system;
    const result = {
      sysDescr: null,
      sysName: null,
      sysLocation: null,
      sysContact: null,
      sysUpTime: null,
      sysObjectID: null,
    };

    try {
      const oids = [
        systemOids.sysDescr,
        systemOids.sysName,
        systemOids.sysLocation,
        systemOids.sysContact,
        systemOids.sysUpTime,
        systemOids.sysObjectID,
      ];

      const values = await this.getMultiple(session, oids);

      // Parse sysDescr
      if (values[systemOids.sysDescr]) {
        const val = values[systemOids.sysDescr];
        result.sysDescr = Buffer.isBuffer(val) ? val.toString('utf8') : String(val);
      }

      // Parse sysName
      if (values[systemOids.sysName]) {
        const val = values[systemOids.sysName];
        result.sysName = Buffer.isBuffer(val) ? val.toString('utf8') : String(val);
      }

      // Parse sysLocation
      if (values[systemOids.sysLocation]) {
        const val = values[systemOids.sysLocation];
        result.sysLocation = Buffer.isBuffer(val) ? val.toString('utf8') : String(val);
      }

      // Parse sysContact
      if (values[systemOids.sysContact]) {
        const val = values[systemOids.sysContact];
        result.sysContact = Buffer.isBuffer(val) ? val.toString('utf8') : String(val);
      }

      // Parse sysUpTime
      if (values[systemOids.sysUpTime]) {
        result.sysUpTime = Number(values[systemOids.sysUpTime]);
      }

      // Parse sysObjectID
      if (values[systemOids.sysObjectID]) {
        const val = values[systemOids.sysObjectID];
        result.sysObjectID = Buffer.isBuffer(val) ? val.toString('utf8') : String(val);
      }

      logger.debug(`System info collected: ${result.sysName || 'unknown'}`);
    } catch (error) {
      logger.warn('Error collecting system info:', error.message);
    }

    return result;
  }

  async collectMetrics(deviceId) {
    const device = await Device.getWithRelations(deviceId);
    if (!device) throw new Error(`Device ${deviceId} not found`);

    const credentials = device.credentials?.getSessionCredentials() || {};
    let session = null;
    const collectedAt = new Date();
    const metrics = [];
    const vendor = device.vendor?.toLowerCase() || 'generic';

    try {
      session = this.createSession(device, credentials);

      // Collect basic system information
      const sysInfo = await this.collectSystemInfo(session);
      
      // System uptime
      const sysUpTime = sysInfo.sysUpTime || await this.get(session, oidMapper.STANDARD_OIDS.system.sysUpTime);
      if (sysUpTime) {
        metrics.push({
          device_id: deviceId,
          metric_type: 'uptime',
          value: Number(sysUpTime),
          unit: 'timeticks',
          collected_at: collectedAt,
        });
      }
      
      // Update device with system information
      await device.update({
        sys_descr: sysInfo.sysDescr || device.sys_descr,
        sys_name: sysInfo.sysName || device.sys_name,
        sys_location: sysInfo.sysLocation || device.location,
        sys_contact: sysInfo.sysContact || device.sys_contact,
        sys_uptime: Number(sysUpTime) || device.sys_uptime,
        last_poll_time: collectedAt,
        last_poll_success: true,
        status: 'up',
      });

      // CPU metrics
      const cpuValue = await this.collectCpuMetric(session, vendor, deviceId);
      if (cpuValue !== null) {
        metrics.push({
          device_id: deviceId,
          metric_type: 'cpu',
          value: cpuValue,
          unit: 'percent',
          collected_at: collectedAt,
        });
      }

      // Memory metrics
      const memoryValue = await this.collectMemoryMetric(session, vendor);
      if (memoryValue !== null) {
        metrics.push({
          device_id: deviceId,
          metric_type: 'memory',
          value: memoryValue,
          unit: 'percent',
          collected_at: collectedAt,
        });
      }

      // Temperature metrics
      const temperatureValue = await this.collectTemperatureMetric(session, vendor);
      if (temperatureValue !== null) {
        metrics.push({
          device_id: deviceId,
          metric_type: 'temperature',
          value: temperatureValue,
          unit: 'celsius',
          collected_at: collectedAt,
        });
      }

      // Disk/Storage metrics (Linux/Servers)
      const diskUsage = await this.collectDiskMetric(session, vendor);
      if (diskUsage !== null) {
        metrics.push({
          device_id: deviceId,
          metric_type: 'disk_usage',
          value: diskUsage,
          unit: 'percent',
          collected_at: collectedAt,
        });
      }

      // Load averages (Linux)
      const loadAvgs = await this.collectLoadAverages(session, vendor);
      if (loadAvgs) {
        if (loadAvgs.load1 !== null) {
          metrics.push({ device_id: deviceId, metric_type: 'load_avg_1', value: loadAvgs.load1, unit: 'load', collected_at: collectedAt });
        }
        if (loadAvgs.load5 !== null) {
          metrics.push({ device_id: deviceId, metric_type: 'load_avg_5', value: loadAvgs.load5, unit: 'load', collected_at: collectedAt });
        }
        if (loadAvgs.load15 !== null) {
          metrics.push({ device_id: deviceId, metric_type: 'load_avg_15', value: loadAvgs.load15, unit: 'load', collected_at: collectedAt });
        }
      }

      // Swap usage (Linux)
      const swapUsage = await this.collectSwapMetric(session, vendor);
      if (swapUsage !== null) {
        metrics.push({
          device_id: deviceId,
          metric_type: 'swap_usage',
          value: swapUsage,
          unit: 'percent',
          collected_at: collectedAt,
        });
      }

      // TCP connections
      const tcpConns = await this.collectTcpConnections(session);
      if (tcpConns !== null) {
        metrics.push({
          device_id: deviceId,
          metric_type: 'tcp_connections',
          value: tcpConns,
          unit: 'connections',
          collected_at: collectedAt,
        });
      }

      // Process count
      const processCount = await this.collectProcessCount(session);
      if (processCount !== null) {
        metrics.push({
          device_id: deviceId,
          metric_type: 'process_count',
          value: processCount,
          unit: 'processes',
          collected_at: collectedAt,
        });
      }

      // Interface metrics
      const interfaces = await InterfaceInfo.findAll({
        where: { device_id: deviceId, is_monitored: true },
      });

      for (const iface of interfaces) {
        const ifMetrics = await this.collectInterfaceMetrics(session, deviceId, iface, collectedAt);
        metrics.push(...ifMetrics);
      }

      if (metrics.length > 0) {
        await Metric.bulkInsertMetrics(metrics);
      }

      logger.debug(`Collected ${metrics.length} metrics for device ${deviceId} (${vendor})`);
      return { success: true, metricsCount: metrics.length };
    } catch (error) {
      logger.error(`Error collecting metrics for device ${deviceId}:`, error);
      await device.update({
        last_poll_time: collectedAt,
        last_poll_success: false,
        status: 'down',
      });
      return { success: false, error: error.message };
    } finally {
      this.closeSession(session);
    }
  }

  // ==========================================
  // CPU Collection by Vendor
  // ==========================================
  async collectCpuMetric(session, vendor, deviceId) {
    const cpuOids = oidMapper.getCpuOids(vendor);

    try {
      switch (vendor) {
        case 'cisco':
          return await this.collectCiscoCpu(session, cpuOids);
        case 'juniper':
          return await this.collectJuniperCpu(session, cpuOids);
        case 'fortinet':
          return await this.collectFortinetCpu(session, cpuOids);
        case 'paloalto':
          return await this.collectPaloAltoCpu(session, cpuOids);
        case 'mikrotik':
          return await this.collectMikroTikCpu(session, cpuOids);
        case 'aruba':
          return await this.collectArubaCpu(session, cpuOids);
        case 'hp':
          return await this.collectHpCpu(session, cpuOids);
        case 'linux':
          return await this.collectLinuxCpu(session, cpuOids, deviceId);
        case 'qnap':
          return await this.collectQnapCpu(session, cpuOids);
        default:
          return await this.collectGenericCpu(session, cpuOids);
      }
    } catch (error) {
      logger.warn(`Error collecting CPU metric for ${vendor}:`, error.message);
      return null;
    }
  }

  async collectCiscoCpu(session, cpuOids) {
    // Try multiple Cisco CPU OIDs
    const oidList = [
      cpuOids.cpmCPUTotal5minRev,
      cpuOids.cpmCPUTotal5min,
      cpuOids.cpmCPUTotal1minRev,
      cpuOids.cpmCPUTotal1min,
      cpuOids.avgBusy5,
    ].filter(Boolean);

    for (const oid of oidList) {
      const value = await this.get(session, `${oid}.1`).catch(() => null);
      if (value !== null) return Number(value);
      
      // Try walking the table
      const results = await this.walk(session, oid).catch(() => []);
      if (results.length > 0) {
        const total = results.reduce((sum, r) => sum + Number(r.value), 0);
        return unitConverter.roundTo(total / results.length, 1);
      }
    }
    return null;
  }

  async collectJuniperCpu(session, cpuOids) {
    const results = await this.walk(session, cpuOids.jnxOperatingCPU).catch(() => []);
    if (results.length > 0) {
      // Filter for Routing Engine (usually highest CPU users)
      const cpuValues = results.map(r => Number(r.value)).filter(v => !isNaN(v) && v >= 0);
      if (cpuValues.length > 0) {
        return unitConverter.roundTo(Math.max(...cpuValues), 1);
      }
    }
    return null;
  }

  async collectFortinetCpu(session, cpuOids) {
    const value = await this.get(session, cpuOids.fgSysCpuUsage);
    if (value !== null) return Number(value);
    
    // Try per-processor table
    const results = await this.walk(session, cpuOids.fgProcessorUsage).catch(() => []);
    if (results.length > 0) {
      const total = results.reduce((sum, r) => sum + Number(r.value), 0);
      return unitConverter.roundTo(total / results.length, 1);
    }
    return null;
  }

  async collectPaloAltoCpu(session, cpuOids) {
    // Get both management and data plane CPU
    const [mgmtCpu, dataCpu] = await Promise.all([
      this.get(session, cpuOids.panSysCpuMgmt).catch(() => null),
      this.get(session, cpuOids.panSysCpuData).catch(() => null),
    ]);

    if (mgmtCpu !== null && dataCpu !== null) {
      return unitConverter.roundTo((Number(mgmtCpu) + Number(dataCpu)) / 2, 1);
    }
    return mgmtCpu !== null ? Number(mgmtCpu) : (dataCpu !== null ? Number(dataCpu) : null);
  }

  async collectMikroTikCpu(session, cpuOids) {
    const value = await this.get(session, cpuOids.mtxrProcessorLoad);
    return value !== null ? Number(value) : null;
  }

  async collectArubaCpu(session, cpuOids) {
    const value = await this.get(session, cpuOids.wlsxSysExtCpuUsedPercent);
    return value !== null ? Number(value) : null;
  }

  async collectHpCpu(session, cpuOids) {
    const value = await this.get(session, cpuOids.hpSwitchCpuStat);
    return value !== null ? Number(value) : null;
  }

  async collectLinuxCpu(session, cpuOids, deviceId) {
    // Try percentage-based OIDs first
    const [cpuUser, cpuSystem, cpuIdle] = await Promise.all([
      this.get(session, cpuOids.ssCpuUser).catch(() => null),
      this.get(session, cpuOids.ssCpuSystem).catch(() => null),
      this.get(session, cpuOids.ssCpuIdle).catch(() => null),
    ]);

    if (cpuUser !== null && cpuSystem !== null) {
      return Number(cpuUser) + Number(cpuSystem);
    }
    if (cpuIdle !== null) {
      return 100 - Number(cpuIdle);
    }

    // Try raw counters (more accurate)
    const [rawUser, rawNice, rawSystem, rawIdle, rawWait] = await Promise.all([
      this.get(session, cpuOids.ssCpuRawUser).catch(() => null),
      this.get(session, cpuOids.ssCpuRawNice).catch(() => null),
      this.get(session, cpuOids.ssCpuRawSystem).catch(() => null),
      this.get(session, cpuOids.ssCpuRawIdle).catch(() => null),
      this.get(session, cpuOids.ssCpuRawWait).catch(() => null),
    ]);

    if (rawUser !== null && rawSystem !== null && rawIdle !== null) {
      const now = Date.now();
      const prevKey = `cpu-${deviceId}`;
      const prev = this.cpuCounters.get(prevKey);

      const current = {
        user: Number(rawUser),
        nice: Number(rawNice) || 0,
        system: Number(rawSystem),
        idle: Number(rawIdle),
        wait: Number(rawWait) || 0,
        timestamp: now,
      };

      this.cpuCounters.set(prevKey, current);

      if (prev && (now - prev.timestamp) < 600000) { // Max 10 min
        const userDiff = current.user - prev.user;
        const niceDiff = current.nice - prev.nice;
        const systemDiff = current.system - prev.system;
        const idleDiff = current.idle - prev.idle;
        const waitDiff = current.wait - prev.wait;
        const totalDiff = userDiff + niceDiff + systemDiff + idleDiff + waitDiff;

        if (totalDiff > 0) {
          const cpuUsage = ((userDiff + niceDiff + systemDiff + waitDiff) / totalDiff) * 100;
          return unitConverter.roundTo(cpuUsage, 1);
        }
      }
    }

    // Fallback to hrProcessorLoad
    return await this.collectGenericCpu(session, oidMapper.VENDOR_OIDS.generic.cpu);
  }

  async collectQnapCpu(session, cpuOids) {
    const value = await this.get(session, cpuOids.cpuUsage);
    return value !== null ? Number(value) : null;
  }

  async collectGenericCpu(session, cpuOids) {
    const loadResults = await this.walk(session, cpuOids.hrProcessorLoad).catch(() => []);
    if (loadResults.length > 0) {
      const total = loadResults.reduce((sum, r) => sum + Number(r.value), 0);
      return unitConverter.roundTo(total / loadResults.length, 1);
    }
    return null;
  }

  // ==========================================
  // Memory Collection by Vendor
  // ==========================================
  async collectMemoryMetric(session, vendor) {
    const memoryOids = oidMapper.getMemoryOids(vendor);

    try {
      switch (vendor) {
        case 'cisco':
          return await this.collectCiscoMemory(session, memoryOids);
        case 'juniper':
          return await this.collectJuniperMemory(session, memoryOids);
        case 'fortinet':
          return await this.collectFortinetMemory(session, memoryOids);
        case 'paloalto':
          return await this.collectPaloAltoMemory(session, memoryOids);
        case 'mikrotik':
          return await this.collectMikroTikMemory(session, memoryOids);
        case 'aruba':
          return await this.collectArubaMemory(session, memoryOids);
        case 'hp':
          return await this.collectHpMemory(session, memoryOids);
        case 'linux':
          return await this.collectLinuxMemory(session, memoryOids);
        case 'qnap':
          return await this.collectQnapMemory(session, memoryOids);
        case 'synology':
          return await this.collectGenericMemory(session);
        default:
          return await this.collectGenericMemory(session);
      }
    } catch (error) {
      logger.warn(`Error collecting memory metric for ${vendor}:`, error.message);
      return null;
    }
  }

  async collectCiscoMemory(session, memoryOids) {
    // Try enhanced memory pool first
    let used = await this.get(session, `${memoryOids.cempMemPoolUsed}.1`).catch(() => null);
    let free = await this.get(session, `${memoryOids.cempMemPoolFree}.1`).catch(() => null);

    if (used === null || free === null) {
      // Fall back to classic memory pool
      used = await this.get(session, `${memoryOids.ciscoMemoryPoolUsed}.1`).catch(() => null);
      free = await this.get(session, `${memoryOids.ciscoMemoryPoolFree}.1`).catch(() => null);
    }

    if (used !== null && free !== null) {
      const total = Number(used) + Number(free);
      return unitConverter.calculateMemoryPercent(Number(used), total);
    }
    return null;
  }

  async collectJuniperMemory(session, memoryOids) {
    const results = await this.walk(session, memoryOids.jnxOperatingBuffer).catch(() => []);
    if (results.length > 0) {
      const values = results.map(r => Number(r.value)).filter(v => !isNaN(v) && v >= 0);
      if (values.length > 0) {
        return unitConverter.roundTo(Math.max(...values), 1);
      }
    }

    // Try heap usage
    const heapResults = await this.walk(session, memoryOids.jnxOperatingHeapUsage).catch(() => []);
    if (heapResults.length > 0) {
      const values = heapResults.map(r => Number(r.value)).filter(v => !isNaN(v) && v >= 0);
      if (values.length > 0) {
        return unitConverter.roundTo(Math.max(...values), 1);
      }
    }
    return null;
  }

  async collectFortinetMemory(session, memoryOids) {
    const value = await this.get(session, memoryOids.fgSysMemUsage);
    return value !== null ? Number(value) : null;
  }

  async collectPaloAltoMemory(session, memoryOids) {
    const value = await this.get(session, memoryOids.panSysSwMemoryUsed);
    return value !== null ? Number(value) : null;
  }

  async collectMikroTikMemory(session, memoryOids) {
    const [total, used] = await Promise.all([
      this.get(session, memoryOids.mtxrMemoryTotal),
      this.get(session, memoryOids.mtxrMemoryUsed),
    ]);

    if (total !== null && used !== null) {
      return unitConverter.calculateMemoryPercent(Number(used), Number(total));
    }
    return null;
  }

  async collectArubaMemory(session, memoryOids) {
    const value = await this.get(session, memoryOids.wlsxSysExtMemoryUsedPercent);
    return value !== null ? Number(value) : null;
  }

  async collectHpMemory(session, memoryOids) {
    const [total, free] = await Promise.all([
      this.get(session, memoryOids.hpGlobalMemTotalBytes).catch(() => null),
      this.get(session, memoryOids.hpGlobalMemFreeBytes).catch(() => null),
    ]);

    if (total !== null && free !== null) {
      const used = Number(total) - Number(free);
      return unitConverter.calculateMemoryPercent(used, Number(total));
    }
    return null;
  }

  async collectLinuxMemory(session, memoryOids) {
    const [memTotal, memAvail, memBuffer, memCached] = await Promise.all([
      this.get(session, memoryOids.memTotalReal),
      this.get(session, memoryOids.memAvailReal),
      this.get(session, memoryOids.memBuffer).catch(() => 0),
      this.get(session, memoryOids.memCached).catch(() => 0),
    ]);

    if (memTotal !== null && memAvail !== null) {
      // Linux memory calculation: used = total - available - buffer - cached
      const total = Number(memTotal);
      const available = Number(memAvail);
      const buffer = Number(memBuffer) || 0;
      const cached = Number(memCached) || 0;
      const actualUsed = total - available - buffer - cached;
      return unitConverter.roundTo((actualUsed / total) * 100, 1);
    }
    return null;
  }

  async collectQnapMemory(session, memoryOids) {
    const [total, free] = await Promise.all([
      this.get(session, memoryOids.systemTotalMem),
      this.get(session, memoryOids.systemFreeMem),
    ]);

    if (total !== null && free !== null) {
      const used = Number(total) - Number(free);
      return unitConverter.calculateMemoryPercent(used, Number(total));
    }
    return null;
  }

  async collectGenericMemory(session) {
    const storageResults = await this.walk(session, oidMapper.STANDARD_OIDS.hrStorage.hrStorageDescr).catch(() => []);
    
    for (const result of storageResults) {
      const descr = result.value?.toString()?.toLowerCase() || '';
      if (descr.includes('ram') || descr.includes('physical memory') || descr.includes('real memory')) {
        const index = result.oid.split('.').pop();
        const [size, used, allocUnits] = await Promise.all([
          this.get(session, `${oidMapper.STANDARD_OIDS.hrStorage.hrStorageSize}.${index}`),
          this.get(session, `${oidMapper.STANDARD_OIDS.hrStorage.hrStorageUsed}.${index}`),
          this.get(session, `${oidMapper.STANDARD_OIDS.hrStorage.hrStorageAllocationUnits}.${index}`),
        ]);
        
        if (size && used) {
          return unitConverter.calculateMemoryPercent(Number(used), Number(size));
        }
      }
    }
    return null;
  }

  // ==========================================
  // Temperature Collection by Vendor
  // ==========================================
  async collectTemperatureMetric(session, vendor) {
    const envOids = oidMapper.getEnvironmentOids(vendor);
    if (!envOids) return null;

    try {
      switch (vendor) {
        case 'cisco':
          return await this.collectCiscoTemperature(session, envOids);
        case 'juniper':
          return await this.collectJuniperTemperature(session, envOids);
        case 'fortinet':
          return await this.collectFortinetTemperature(session, envOids);
        case 'mikrotik':
          return await this.collectMikroTikTemperature(session, envOids);
        case 'aruba':
          return await this.collectArubaTemperature(session, envOids);
        case 'synology':
          return await this.collectSynologyTemperature(session);
        case 'qnap':
          return await this.collectQnapTemperature(session);
        case 'dell':
          return await this.collectDellTemperature(session, envOids);
        case 'linux':
          return await this.collectLinuxTemperature(session);
        default:
          return null;
      }
    } catch (error) {
      logger.warn(`Error collecting temperature for ${vendor}:`, error.message);
      return null;
    }
  }

  async collectCiscoTemperature(session, envOids) {
    const results = await this.walk(session, envOids.ciscoEnvMonTemperatureStatusValue).catch(() => []);
    if (results.length > 0) {
      const temps = results.map(r => Number(r.value)).filter(v => !isNaN(v) && v > 0 && v < 150);
      if (temps.length > 0) return Math.max(...temps);
    }
    return null;
  }

  async collectJuniperTemperature(session, envOids) {
    const results = await this.walk(session, envOids.jnxOperatingTemp).catch(() => []);
    if (results.length > 0) {
      const temps = results.map(r => Number(r.value)).filter(v => !isNaN(v) && v > 0 && v < 150);
      if (temps.length > 0) return Math.max(...temps);
    }
    return null;
  }

  async collectFortinetTemperature(session, envOids) {
    const results = await this.walk(session, envOids.fgHwSensorEntValue).catch(() => []);
    if (results.length > 0) {
      // Fortinet sensor values may include temperature sensors
      const temps = results.map(r => Number(r.value)).filter(v => !isNaN(v) && v > 0 && v < 150);
      if (temps.length > 0) return Math.max(...temps);
    }
    return null;
  }

  async collectMikroTikTemperature(session, envOids) {
    // Try CPU temperature first, then board temperature
    let temp = await this.get(session, envOids.mtxrCpuTemperature).catch(() => null);
    if (temp !== null && Number(temp) > 0) return Number(temp) / 10; // MikroTik returns temp * 10

    temp = await this.get(session, envOids.mtxrBoardTemperature).catch(() => null);
    if (temp !== null && Number(temp) > 0) return Number(temp) / 10;

    return null;
  }

  async collectArubaTemperature(session, envOids) {
    const value = await this.get(session, envOids.sysExtTemperature);
    return value !== null ? Number(value) : null;
  }

  async collectSynologyTemperature(session) {
    const sysOids = oidMapper.VENDOR_OIDS.synology.system;
    const value = await this.get(session, sysOids.temperature);
    return value !== null ? Number(value) : null;
  }

  async collectQnapTemperature(session) {
    const sysOids = oidMapper.VENDOR_OIDS.qnap.system;
    // Try CPU temp first
    let temp = await this.get(session, sysOids.systemCPUTemp).catch(() => null);
    if (temp !== null) return Number(temp);

    temp = await this.get(session, sysOids.systemTemp).catch(() => null);
    return temp !== null ? Number(temp) : null;
  }

  async collectDellTemperature(session, envOids) {
    const results = await this.walk(session, envOids.temperatureProbeReading).catch(() => []);
    if (results.length > 0) {
      // Dell returns temperature * 10
      const temps = results.map(r => Number(r.value) / 10).filter(v => !isNaN(v) && v > 0 && v < 150);
      if (temps.length > 0) return Math.max(...temps);
    }
    return null;
  }

  async collectLinuxTemperature(session) {
    const lmOids = oidMapper.VENDOR_OIDS.linux.lmSensors;
    const results = await this.walk(session, lmOids.lmTempSensorsValue).catch(() => []);
    if (results.length > 0) {
      // lm_sensors returns temperature * 1000
      const temps = results.map(r => Number(r.value) / 1000).filter(v => !isNaN(v) && v > 0 && v < 150);
      if (temps.length > 0) return unitConverter.roundTo(Math.max(...temps), 1);
    }
    return null;
  }

  // ==========================================
  // Additional Metrics (Disk, Load, Swap, etc.)
  // ==========================================
  async collectDiskMetric(session, vendor) {
    try {
      // Linux: Try UCD-SNMP dskPercent first
      if (vendor === 'linux') {
        const diskOids = oidMapper.VENDOR_OIDS.linux.disk;
        
        // Walk the disk path first to find root partition
        const pathResults = await this.walk(session, diskOids.dskPath).catch(() => []);
        const percentResults = await this.walk(session, diskOids.dskPercent).catch(() => []);
        
        if (pathResults.length > 0 && percentResults.length > 0) {
          // Find root partition (/) or return max
          for (const pathResult of pathResults) {
            const path = pathResult.value?.toString() || '';
            if (path === '/') {
              const index = pathResult.oid.split('.').pop();
              const matchingPercent = percentResults.find(p => p.oid.endsWith(`.${index}`));
              if (matchingPercent) {
                return Number(matchingPercent.value);
              }
            }
          }
          // Fallback: return max non-tmpfs disk usage
          const values = percentResults.map(r => Number(r.value)).filter(v => !isNaN(v) && v > 0);
          if (values.length > 0) return Math.max(...values);
        }
      }

      // MikroTik
      if (vendor === 'mikrotik') {
        const storageOids = oidMapper.VENDOR_OIDS.mikrotik.storage;
        const [total, used] = await Promise.all([
          this.get(session, storageOids.mtxrDiskTotal),
          this.get(session, storageOids.mtxrDiskUsed),
        ]);
        if (total !== null && used !== null) {
          return unitConverter.calculateMemoryPercent(Number(used), Number(total));
        }
      }

      // Synology
      if (vendor === 'synology') {
        const storageOids = oidMapper.VENDOR_OIDS.synology.storage;
        const [total, used] = await Promise.all([
          this.get(session, storageOids.spaceTotal + '.0'),
          this.get(session, storageOids.spaceUsed + '.0'),
        ]);
        if (total !== null && used !== null && Number(total) > 0) {
          return unitConverter.calculateMemoryPercent(Number(used), Number(total));
        }
      }

      // QNAP
      if (vendor === 'qnap') {
        const storageOids = oidMapper.VENDOR_OIDS.qnap.storage;
        const [total, free] = await Promise.all([
          this.get(session, storageOids.systemTotalSpace),
          this.get(session, storageOids.systemFreeSpace),
        ]);
        if (total !== null && free !== null && Number(total) > 0) {
          const used = Number(total) - Number(free);
          return unitConverter.calculateMemoryPercent(used, Number(total));
        }
      }

      // Generic: use hrStorage for fixed disk (Windows, etc.)
      const storageResults = await this.walk(session, oidMapper.STANDARD_OIDS.hrStorage.hrStorageDescr).catch(() => []);
      for (const result of storageResults) {
        const descr = result.value?.toString()?.toLowerCase() || '';
        // Look for root filesystem or C: drive
        if (descr === '/' || descr.includes('c:') || descr.includes('c:\\') || 
            (descr.includes('fixed') && descr.includes('disk'))) {
          const index = result.oid.split('.').pop();
          const [size, used, units] = await Promise.all([
            this.get(session, `${oidMapper.STANDARD_OIDS.hrStorage.hrStorageSize}.${index}`),
            this.get(session, `${oidMapper.STANDARD_OIDS.hrStorage.hrStorageUsed}.${index}`),
            this.get(session, `${oidMapper.STANDARD_OIDS.hrStorage.hrStorageAllocationUnits}.${index}`),
          ]);
          if (size && used && Number(size) > 0) {
            return unitConverter.calculateMemoryPercent(Number(used), Number(size));
          }
        }
      }
    } catch (error) {
      logger.warn(`Error collecting disk metric for ${vendor}:`, error.message);
    }
    return null;
  }

  async collectLoadAverages(session, vendor) {
    // Linux/Unix systems have load averages
    if (!['linux', 'synology', 'qnap'].includes(vendor)) return null;

    try {
      const cpuOids = oidMapper.VENDOR_OIDS.linux.cpu;
      const [load1, load5, load15] = await Promise.all([
        this.get(session, cpuOids.laLoad1),
        this.get(session, cpuOids.laLoad5),
        this.get(session, cpuOids.laLoad15),
      ]);

      return {
        load1: load1 !== null ? parseFloat(load1.toString()) : null,
        load5: load5 !== null ? parseFloat(load5.toString()) : null,
        load15: load15 !== null ? parseFloat(load15.toString()) : null,
      };
    } catch (error) {
      logger.warn(`Error collecting load averages:`, error.message);
    }
    return null;
  }

  async collectSwapMetric(session, vendor) {
    // Linux, Synology, QNAP support swap via UCD-SNMP MIB
    if (!['linux', 'synology', 'qnap'].includes(vendor)) return null;

    try {
      const memOids = oidMapper.VENDOR_OIDS.linux.memory;
      const [swapTotal, swapAvail] = await Promise.all([
        this.get(session, memOids.memTotalSwap),
        this.get(session, memOids.memAvailSwap),
      ]);

      if (swapTotal !== null && swapAvail !== null && Number(swapTotal) > 0) {
        const used = Number(swapTotal) - Number(swapAvail);
        return unitConverter.calculateMemoryPercent(used, Number(swapTotal));
      }
    } catch (error) {
      logger.warn(`Error collecting swap metric:`, error.message);
    }
    return null;
  }

  async collectTcpConnections(session) {
    try {
      const value = await this.get(session, oidMapper.STANDARD_OIDS.tcp.tcpCurrEstab);
      return value !== null ? Number(value) : null;
    } catch (error) {
      return null;
    }
  }

  async collectProcessCount(session) {
    try {
      const value = await this.get(session, oidMapper.STANDARD_OIDS.hrSystem.hrSystemProcesses);
      return value !== null ? Number(value) : null;
    } catch (error) {
      return null;
    }
  }

  // ==========================================
  // Interface Metrics
  // ==========================================
  async collectInterfaceMetrics(session, deviceId, iface, collectedAt) {
    const metrics = [];
    const ifIndex = iface.if_index;
    const ifOids = oidMapper.getInterfaceOids();
    const prevKey = `${deviceId}-${ifIndex}`;

    try {
      const [inOctets, outOctets, inErrors, outErrors, operStatus] = await Promise.all([
        this.get(session, oidMapper.buildInterfaceOid(ifOids.ifInOctets, ifIndex)),
        this.get(session, oidMapper.buildInterfaceOid(ifOids.ifOutOctets, ifIndex)),
        this.get(session, oidMapper.buildInterfaceOid(ifOids.ifInErrors, ifIndex)),
        this.get(session, oidMapper.buildInterfaceOid(ifOids.ifOutErrors, ifIndex)),
        this.get(session, oidMapper.buildInterfaceOid(ifOids.ifOperStatus, ifIndex)),
      ]);

      if (operStatus !== null) {
        const newStatus = unitConverter.parseIfStatus(operStatus);
        if (newStatus !== iface.if_oper_status) {
          await iface.update({ if_oper_status: newStatus });
        }
      }

      const prevValues = this.previousValues.get(prevKey);
      const now = collectedAt.getTime();

      if (prevValues && inOctets !== null && outOctets !== null) {
        const intervalSeconds = (now - prevValues.timestamp) / 1000;
        
        if (intervalSeconds > 0 && intervalSeconds < 600) {
          const trafficIn = unitConverter.octetsToBps(prevValues.inOctets, Number(inOctets), intervalSeconds);
          metrics.push({
            device_id: deviceId,
            interface_id: iface.id,
            metric_type: 'traffic_in',
            value: unitConverter.roundTo(trafficIn, 2),
            unit: 'bps',
            collected_at: collectedAt,
          });

          const trafficOut = unitConverter.octetsToBps(prevValues.outOctets, Number(outOctets), intervalSeconds);
          metrics.push({
            device_id: deviceId,
            interface_id: iface.id,
            metric_type: 'traffic_out',
            value: unitConverter.roundTo(trafficOut, 2),
            unit: 'bps',
            collected_at: collectedAt,
          });

          const ifSpeed = iface.getEffectiveSpeed();
          if (ifSpeed > 0) {
            const maxTraffic = Math.max(trafficIn, trafficOut);
            const bandwidthUtil = unitConverter.calculateBandwidthUtil(maxTraffic, ifSpeed);
            metrics.push({
              device_id: deviceId,
              interface_id: iface.id,
              metric_type: 'bandwidth_util',
              value: unitConverter.roundTo(bandwidthUtil, 2),
              unit: 'percent',
              collected_at: collectedAt,
            });
          }

          if (prevValues.inErrors !== undefined && inErrors !== null) {
            const errorRate = (Number(inErrors) - prevValues.inErrors) / intervalSeconds;
            if (errorRate >= 0) {
              metrics.push({
                device_id: deviceId,
                interface_id: iface.id,
                metric_type: 'errors_in',
                value: unitConverter.roundTo(errorRate, 2),
                unit: 'errors/s',
                collected_at: collectedAt,
              });
            }
          }

          if (prevValues.outErrors !== undefined && outErrors !== null) {
            const errorRate = (Number(outErrors) - prevValues.outErrors) / intervalSeconds;
            if (errorRate >= 0) {
              metrics.push({
                device_id: deviceId,
                interface_id: iface.id,
                metric_type: 'errors_out',
                value: unitConverter.roundTo(errorRate, 2),
                unit: 'errors/s',
                collected_at: collectedAt,
              });
            }
          }
        }
      }

      this.previousValues.set(prevKey, {
        timestamp: now,
        inOctets: inOctets !== null ? Number(inOctets) : undefined,
        outOctets: outOctets !== null ? Number(outOctets) : undefined,
        inErrors: inErrors !== null ? Number(inErrors) : undefined,
        outErrors: outErrors !== null ? Number(outErrors) : undefined,
      });
    } catch (error) {
      logger.warn(`Error collecting interface ${ifIndex} metrics:`, error.message);
    }

    return metrics;
  }

  async detectDevice(ipAddress, snmpConfig) {
    const testDevice = {
      ip_address: ipAddress,
      snmp_version: snmpConfig.version || '2c',
      snmp_port: snmpConfig.port || 161,
    };

    const credentials = {
      communityString: snmpConfig.community,
      securityLevel: snmpConfig.securityLevel,
      username: snmpConfig.username,
      authProtocol: snmpConfig.authProtocol,
      authPassword: snmpConfig.authPassword,
      privProtocol: snmpConfig.privProtocol,
      privPassword: snmpConfig.privPassword,
    };

    const result = await this.testConnection(testDevice, credentials);

    if (result.success) {
      return {
        success: true,
        suggestedName: result.sysName || `Device-${ipAddress}`,
        sysDescr: result.sysDescr,
        vendor: result.detectedVendor,
        deviceType: result.detectedType,
        responseTimeMs: result.responseTimeMs,
        uptime: result.uptimeFormatted,
      };
    }

    return result;
  }

  /**
   * Get MAC Address Table (FDB - Forwarding Database)
   * Works on switches and L2/L3 devices
   */
  async getMacAddressTable(device, credentials) {
    const session = await this.createSession(device, credentials);
    const bridgeOids = oidMapper.STANDARD_OIDS.bridge;
    const qbridgeOids = oidMapper.STANDARD_OIDS.qbridge;
    const macTable = [];

    try {
      // First, try Q-BRIDGE-MIB (IEEE 802.1Q) - more common on modern VLAN-aware switches
      const qbridgeFdbPort = await this.walk(session, qbridgeOids.dot1qTpFdbPort).catch(() => []);
      
      if (qbridgeFdbPort && qbridgeFdbPort.length > 0) {
        // Q-BRIDGE format: OID ends with VLAN.MAC (6 octets)
        for (const item of qbridgeFdbPort) {
          const oidParts = item.oid.split('.');
          // Last 6 parts are MAC address, the one before is VLAN ID
          const macParts = oidParts.slice(-6);
          const vlanId = parseInt(oidParts[oidParts.length - 7], 10);
          
          const macAddress = macParts.map(p => parseInt(p, 10).toString(16).padStart(2, '0')).join(':');
          const port = parseInt(item.value, 10);
          
          // Get FDB status
          const statusOid = `${qbridgeOids.dot1qTpFdbStatus}.${vlanId}.${macParts.join('.')}`;
          const status = await this.get(session, statusOid).catch(() => null);
          
          macTable.push({
            mac_address: macAddress.toUpperCase(),
            port: port,
            vlan_id: vlanId,
            status: this.parseFdbStatus(status),
            type: 'dynamic',
          });
        }
      } else {
        // Fall back to BRIDGE-MIB (RFC 4188)
        const bridgeFdbAddress = await this.walk(session, bridgeOids.dot1dTpFdbAddress).catch(() => []);
        const bridgeFdbPort = await this.walk(session, bridgeOids.dot1dTpFdbPort).catch(() => []);
        const bridgeFdbStatus = await this.walk(session, bridgeOids.dot1dTpFdbStatus).catch(() => []);
        
        // Build port mapping from bridge port to interface index
        const portToIfIndex = {};
        const portMappings = await this.walk(session, bridgeOids.dot1dBasePortIfIndex).catch(() => []);
        for (const mapping of portMappings) {
          const bridgePort = mapping.oid.split('.').pop();
          portToIfIndex[bridgePort] = parseInt(mapping.value, 10);
        }
        
        // Create lookup maps
        const portMap = {};
        for (const item of bridgeFdbPort) {
          const key = item.oid.replace(`${bridgeOids.dot1dTpFdbPort}.`, '');
          portMap[key] = parseInt(item.value, 10);
        }
        
        const statusMap = {};
        for (const item of bridgeFdbStatus) {
          const key = item.oid.replace(`${bridgeOids.dot1dTpFdbStatus}.`, '');
          statusMap[key] = parseInt(item.value, 10);
        }
        
        for (const item of bridgeFdbAddress) {
          const key = item.oid.replace(`${bridgeOids.dot1dTpFdbAddress}.`, '');
          const macAddress = unitConverter.parseMacAddress(item.value);
          const bridgePort = portMap[key];
          const status = statusMap[key];
          
          macTable.push({
            mac_address: macAddress,
            bridge_port: bridgePort,
            if_index: portToIfIndex[bridgePort] || null,
            status: this.parseFdbStatus(status),
            type: 'dynamic',
          });
        }
      }
      
      logger.info(`Retrieved ${macTable.length} MAC address entries from device ${device.id}`);
      return macTable;
    } finally {
      this.closeSession(session);
    }
  }

  /**
   * Get ARP Table (IP to MAC mappings)
   */
  async getArpTable(device, credentials) {
    const session = await this.createSession(device, credentials);
    const arpOids = oidMapper.STANDARD_OIDS.arp;
    const arpTable = [];

    try {
      // Walk ipNetToMediaPhysAddress to get IP-to-MAC mappings
      const arpEntries = await this.walk(session, arpOids.ipNetToMediaPhysAddress).catch(() => []);
      const arpTypes = await this.walk(session, arpOids.ipNetToMediaType).catch(() => []);
      
      // Build type lookup
      const typeMap = {};
      for (const item of arpTypes) {
        // OID format: 1.3.6.1.2.1.4.22.1.4.<ifIndex>.<ip1>.<ip2>.<ip3>.<ip4>
        const key = item.oid.replace(`${arpOids.ipNetToMediaType}.`, '');
        typeMap[key] = parseInt(item.value, 10);
      }
      
      for (const item of arpEntries) {
        // OID format: 1.3.6.1.2.1.4.22.1.2.<ifIndex>.<ip1>.<ip2>.<ip3>.<ip4>
        const key = item.oid.replace(`${arpOids.ipNetToMediaPhysAddress}.`, '');
        const parts = key.split('.');
        const ifIndex = parseInt(parts[0], 10);
        const ipAddress = parts.slice(1).join('.');
        
        const macAddress = unitConverter.parseMacAddress(item.value);
        const arpType = typeMap[key];
        
        arpTable.push({
          ip_address: ipAddress,
          mac_address: macAddress,
          if_index: ifIndex,
          type: this.parseArpType(arpType),
        });
      }
      
      logger.info(`Retrieved ${arpTable.length} ARP entries from device ${device.id}`);
      return arpTable;
    } finally {
      this.closeSession(session);
    }
  }

  /**
   * Parse FDB (Forwarding Database) status
   */
  parseFdbStatus(status) {
    const statusMap = {
      1: 'other',
      2: 'invalid',
      3: 'learned',
      4: 'self',
      5: 'mgmt',
    };
    return statusMap[status] || 'unknown';
  }

  /**
   * Parse ARP entry type
   */
  parseArpType(type) {
    const typeMap = {
      1: 'other',
      2: 'invalid',
      3: 'dynamic',
      4: 'static',
    };
    return typeMap[type] || 'unknown';
  }
}

module.exports = new SNMPService();
