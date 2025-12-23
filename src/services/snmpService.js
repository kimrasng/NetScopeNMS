/**
 * SNMP Service
 * Handles all SNMP operations
 */

const snmp = require('net-snmp');
const logger = require('../utils/logger');
const snmpConfig = require('../config/snmp');
const oidMapper = require('../utils/oidMapper');
const unitConverter = require('../utils/unitConverter');
const { Device, SnmpCredential, InterfaceInfo, Metric } = require('../models');

class SNMPService {
  constructor() {
    this.sessions = new Map(); // Cache active sessions
    this.previousValues = new Map(); // Store previous counter values for rate calculation
  }

  /**
   * Create SNMP session for a device
   * @param {object} device - Device model instance
   * @param {object} credentials - SNMP credentials
   * @returns {object} - SNMP session
   */
  createSession(device, credentials) {
    const target = device.ip_address;
    const version = device.snmp_version;

    try {
      if (version === '3') {
        // SNMPv3 session
        const user = snmpConfig.createV3User(credentials);
        const options = snmpConfig.createV3Options(device, credentials);
        
        return snmp.createV3Session(target, user, options);
      } else {
        // SNMPv1/v2c session
        const community = credentials.communityString || snmpConfig.defaults.community;
        const options = snmpConfig.createV1V2Options(device, credentials);
        
        return snmp.createSession(target, community, options);
      }
    } catch (error) {
      logger.error(`Failed to create SNMP session for ${target}:`, error);
      throw error;
    }
  }

  /**
   * Close SNMP session
   * @param {object} session - SNMP session
   */
  closeSession(session) {
    try {
      if (session) {
        session.close();
      }
    } catch (error) {
      logger.warn('Error closing SNMP session:', error);
    }
  }

  /**
   * Get single OID value
   * @param {object} session - SNMP session
   * @param {string} oid - OID to query
   * @returns {Promise<any>} - OID value
   */
  get(session, oid) {
    return new Promise((resolve, reject) => {
      session.get([oid], (error, varbinds) => {
        if (error) {
          reject(error);
          return;
        }

        if (varbinds[0].type === snmp.ErrorStatus.NoSuchObject ||
            varbinds[0].type === snmp.ErrorStatus.NoSuchInstance ||
            varbinds[0].type === snmp.ErrorStatus.EndOfMibView) {
          resolve(null);
          return;
        }

        resolve(varbinds[0].value);
      });
    });
  }

  /**
   * Get multiple OID values
   * @param {object} session - SNMP session
   * @param {Array<string>} oids - OIDs to query
   * @returns {Promise<object>} - OID values map
   */
  getMultiple(session, oids) {
    return new Promise((resolve, reject) => {
      session.get(oids, (error, varbinds) => {
        if (error) {
          reject(error);
          return;
        }

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

  /**
   * Walk an OID subtree
   * @param {object} session - SNMP session
   * @param {string} oid - Base OID
   * @returns {Promise<Array>} - Array of varbinds
   */
  walk(session, oid) {
    return new Promise((resolve, reject) => {
      const results = [];

      session.subtree(oid, (varbinds) => {
        varbinds.forEach((vb) => {
          if (vb.type !== snmp.ErrorStatus.NoSuchObject &&
              vb.type !== snmp.ErrorStatus.NoSuchInstance &&
              vb.type !== snmp.ErrorStatus.EndOfMibView) {
            results.push({
              oid: vb.oid,
              value: vb.value,
              type: vb.type,
            });
          }
        });
      }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
  }

  /**
   * Test SNMP connection to a device
   * @param {object} device - Device model or config
   * @param {object} credentials - SNMP credentials
   * @returns {Promise<object>} - Test result
   */
  async testConnection(device, credentials) {
    let session = null;
    const startTime = Date.now();

    try {
      session = this.createSession(device, credentials);
      
      // Try to get sysDescr
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

  /**
   * Discover interfaces on a device
   * @param {number} deviceId - Device ID
   * @returns {Promise<Array>} - Discovered interfaces
   */
  async discoverInterfaces(deviceId) {
    const device = await Device.getWithRelations(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    const credentials = device.credentials?.getSessionCredentials() || {};
    let session = null;

    try {
      session = this.createSession(device, credentials);
      
      const ifOids = oidMapper.getInterfaceOids();
      const interfaces = [];

      // Walk interface description table
      const ifDescrResults = await this.walk(session, ifOids.ifDescr);
      
      for (const result of ifDescrResults) {
        // Extract ifIndex from OID
        const ifIndex = parseInt(result.oid.split('.').pop(), 10);
        
        interfaces.push({
          device_id: deviceId,
          if_index: ifIndex,
          if_descr: result.value?.toString() || null,
        });
      }

      // Get additional interface info
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

      // Save interfaces to database
      for (const iface of interfaces) {
        await InterfaceInfo.upsert(iface, {
          conflictFields: ['device_id', 'if_index'],
        });
      }

      logger.info(`Discovered ${interfaces.length} interfaces for device ${deviceId}`);
      return interfaces;
    } finally {
      this.closeSession(session);
    }
  }

  /**
   * Collect all metrics for a device
   * @param {number} deviceId - Device ID
   * @returns {Promise<object>} - Collected metrics
   */
  async collectMetrics(deviceId) {
    const device = await Device.getWithRelations(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    const credentials = device.credentials?.getSessionCredentials() || {};
    let session = null;
    const collectedAt = new Date();
    const metrics = [];

    try {
      session = this.createSession(device, credentials);

      // Get system uptime
      const sysUpTime = await this.get(session, oidMapper.STANDARD_OIDS.system.sysUpTime);
      if (sysUpTime) {
        metrics.push({
          device_id: deviceId,
          metric_type: 'uptime',
          value: Number(sysUpTime),
          unit: 'timeticks',
          collected_at: collectedAt,
        });
        
        // Update device uptime
        await device.update({
          sys_uptime: Number(sysUpTime),
          last_poll_time: collectedAt,
          last_poll_success: true,
          status: 'up',
        });
      }

      // Get CPU metrics
      const cpuValue = await this.collectCpuMetric(session, device.vendor);
      if (cpuValue !== null) {
        metrics.push({
          device_id: deviceId,
          metric_type: 'cpu',
          value: cpuValue,
          unit: 'percent',
          collected_at: collectedAt,
        });
      }

      // Get memory metrics
      const memoryValue = await this.collectMemoryMetric(session, device.vendor);
      if (memoryValue !== null) {
        metrics.push({
          device_id: deviceId,
          metric_type: 'memory',
          value: memoryValue,
          unit: 'percent',
          collected_at: collectedAt,
        });
      }

      // Get interface metrics
      const interfaces = await InterfaceInfo.findAll({
        where: { device_id: deviceId, is_monitored: true },
      });

      for (const iface of interfaces) {
        const ifMetrics = await this.collectInterfaceMetrics(session, deviceId, iface, collectedAt);
        metrics.push(...ifMetrics);
      }

      // Bulk insert metrics
      if (metrics.length > 0) {
        await Metric.bulkInsertMetrics(metrics);
      }

      logger.debug(`Collected ${metrics.length} metrics for device ${deviceId}`);
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

  /**
   * Collect CPU metric based on vendor
   * @param {object} session - SNMP session
   * @param {string} vendor - Device vendor
   * @returns {Promise<number|null>} - CPU percentage
   */
  async collectCpuMetric(session, vendor) {
    const cpuOids = oidMapper.getCpuOids(vendor || 'generic');

    try {
      switch (vendor) {
        case 'cisco':
          // Try Cisco CPU OIDs
          for (const oid of [cpuOids.cpmCPUTotal5min, cpuOids.cpmCPUTotal1min, cpuOids.avgBusy5]) {
            if (oid) {
              const value = await this.get(session, oid);
              if (value !== null) {
                return Number(value);
              }
            }
          }
          break;

        case 'linux':
          // Linux: calculate from user + system time
          const [cpuUser, cpuSystem, cpuIdle] = await Promise.all([
            this.get(session, cpuOids.ssCpuUser),
            this.get(session, cpuOids.ssCpuSystem),
            this.get(session, cpuOids.ssCpuIdle),
          ]);
          
          if (cpuUser !== null && cpuSystem !== null) {
            return Number(cpuUser) + Number(cpuSystem);
          }
          if (cpuIdle !== null) {
            return 100 - Number(cpuIdle);
          }
          break;

        default:
          // Generic: use hrProcessorLoad
          const loadResults = await this.walk(session, cpuOids.hrProcessorLoad);
          if (loadResults.length > 0) {
            // Average across all processors
            const total = loadResults.reduce((sum, r) => sum + Number(r.value), 0);
            return unitConverter.roundTo(total / loadResults.length, 1);
          }
      }
    } catch (error) {
      logger.warn(`Error collecting CPU metric:`, error.message);
    }

    return null;
  }

  /**
   * Collect memory metric based on vendor
   * @param {object} session - SNMP session
   * @param {string} vendor - Device vendor
   * @returns {Promise<number|null>} - Memory percentage
   */
  async collectMemoryMetric(session, vendor) {
    const memoryOids = oidMapper.getMemoryOids(vendor || 'generic');

    try {
      switch (vendor) {
        case 'cisco':
          const [ciscoUsed, ciscoFree] = await Promise.all([
            this.get(session, memoryOids.ciscoMemoryPoolUsed),
            this.get(session, memoryOids.ciscoMemoryPoolFree),
          ]);
          
          if (ciscoUsed !== null && ciscoFree !== null) {
            const total = Number(ciscoUsed) + Number(ciscoFree);
            return unitConverter.calculateMemoryPercent(Number(ciscoUsed), total);
          }
          break;

        case 'linux':
          const [memTotal, memAvail, memBuffer, memCached] = await Promise.all([
            this.get(session, memoryOids.memTotalReal),
            this.get(session, memoryOids.memAvailReal),
            this.get(session, memoryOids.memBuffer).catch(() => 0),
            this.get(session, memoryOids.memCached).catch(() => 0),
          ]);
          
          if (memTotal !== null && memAvail !== null) {
            return unitConverter.calculateLinuxMemory(
              Number(memTotal),
              Number(memAvail),
              Number(memBuffer) || 0,
              Number(memCached) || 0
            );
          }
          break;

        default:
          // Generic: use hrStorage for RAM
          const storageResults = await this.walk(session, oidMapper.STANDARD_OIDS.hrStorage.hrStorageDescr);
          
          for (const result of storageResults) {
            const descr = result.value?.toString()?.toLowerCase() || '';
            if (descr.includes('ram') || descr.includes('physical memory') || descr.includes('real memory')) {
              const index = result.oid.split('.').pop();
              const [size, used] = await Promise.all([
                this.get(session, `${memoryOids.hrStorageSize}.${index}`),
                this.get(session, `${memoryOids.hrStorageUsed}.${index}`),
              ]);
              
              if (size && used) {
                return unitConverter.calculateMemoryPercent(Number(used), Number(size));
              }
            }
          }
      }
    } catch (error) {
      logger.warn(`Error collecting memory metric:`, error.message);
    }

    return null;
  }

  /**
   * Collect interface metrics
   * @param {object} session - SNMP session
   * @param {number} deviceId - Device ID
   * @param {object} iface - Interface model
   * @param {Date} collectedAt - Collection timestamp
   * @returns {Promise<Array>} - Interface metrics
   */
  async collectInterfaceMetrics(session, deviceId, iface, collectedAt) {
    const metrics = [];
    const ifIndex = iface.if_index;
    const ifOids = oidMapper.getInterfaceOids();
    const prevKey = `${deviceId}-${ifIndex}`;

    try {
      // Get counter values
      const [inOctets, outOctets, inErrors, outErrors, operStatus] = await Promise.all([
        this.get(session, oidMapper.buildInterfaceOid(ifOids.ifInOctets, ifIndex)),
        this.get(session, oidMapper.buildInterfaceOid(ifOids.ifOutOctets, ifIndex)),
        this.get(session, oidMapper.buildInterfaceOid(ifOids.ifInErrors, ifIndex)),
        this.get(session, oidMapper.buildInterfaceOid(ifOids.ifOutErrors, ifIndex)),
        this.get(session, oidMapper.buildInterfaceOid(ifOids.ifOperStatus, ifIndex)),
      ]);

      // Update interface status
      if (operStatus !== null) {
        const newStatus = unitConverter.parseIfStatus(operStatus);
        if (newStatus !== iface.if_oper_status) {
          await iface.update({ if_oper_status: newStatus });
        }
      }

      // Calculate rates using previous values
      const prevValues = this.previousValues.get(prevKey);
      const now = collectedAt.getTime();

      if (prevValues && inOctets !== null && outOctets !== null) {
        const intervalSeconds = (now - prevValues.timestamp) / 1000;
        
        if (intervalSeconds > 0 && intervalSeconds < 600) { // Max 10 min interval
          // Traffic in (bps)
          const trafficIn = unitConverter.octetsToBps(
            prevValues.inOctets,
            Number(inOctets),
            intervalSeconds
          );
          
          metrics.push({
            device_id: deviceId,
            interface_id: iface.id,
            metric_type: 'traffic_in',
            value: unitConverter.roundTo(trafficIn, 2),
            unit: 'bps',
            collected_at: collectedAt,
          });

          // Traffic out (bps)
          const trafficOut = unitConverter.octetsToBps(
            prevValues.outOctets,
            Number(outOctets),
            intervalSeconds
          );
          
          metrics.push({
            device_id: deviceId,
            interface_id: iface.id,
            metric_type: 'traffic_out',
            value: unitConverter.roundTo(trafficOut, 2),
            unit: 'bps',
            collected_at: collectedAt,
          });

          // Bandwidth utilization
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

          // Error rates
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

      // Store current values for next iteration
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

  /**
   * Detect and register a new device
   * @param {string} ipAddress - Device IP
   * @param {object} snmpConfig - SNMP configuration
   * @returns {Promise<object>} - Detection result with device info
   */
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
}

// Export singleton instance
module.exports = new SNMPService();
