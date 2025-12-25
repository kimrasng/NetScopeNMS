const logger = require('../utils/logger');
const { Alarm, AlarmRule, Device, Metric } = require('../models');

class AlarmService {
  constructor() {
    // In-memory cache for tracking alarm state duration
    this.alarmStateCache = new Map();
  }

  async evaluateMetric(metric) {
    const { device_id, interface_id, metric_type, value } = metric;
    const triggeredAlarms = [];

    try {
      // Get active rules for this metric type
      const rules = await AlarmRule.getActiveRulesForMetric(metric_type);

      for (const rule of rules) {
        // Check if rule applies to this device
        if (!rule.appliesToDevice(device_id)) {
          continue;
        }

        // Check condition
        const result = rule.checkCondition(value);

        if (result.triggered) {
          // Check duration requirement
          const cacheKey = `${device_id}-${interface_id || 'null'}-${metric_type}-${rule.id}`;
          const cachedState = this.alarmStateCache.get(cacheKey);

          if (rule.duration_seconds > 0) {
            if (!cachedState) {
              // First occurrence, start tracking
              this.alarmStateCache.set(cacheKey, {
                startTime: Date.now(),
                severity: result.severity,
                value,
              });
              continue; // Don't create alarm yet
            }

            const elapsedSeconds = (Date.now() - cachedState.startTime) / 1000;
            if (elapsedSeconds < rule.duration_seconds) {
              // Duration not met yet
              continue;
            }
          }

          // Create or update alarm
          const alarm = await this.createOrUpdateAlarm({
            device_id,
            interface_id,
            rule_id: rule.id,
            severity: result.severity,
            metric_type,
            current_value: value,
            threshold_value: result.severity === 'critical' 
              ? rule.threshold_critical 
              : rule.threshold_warning,
          });

          triggeredAlarms.push(alarm);

          // Clear duration cache after alarm is created
          this.alarmStateCache.delete(cacheKey);
        } else {
          // Condition not triggered, clear cache
          const cacheKey = `${device_id}-${interface_id || 'null'}-${metric_type}-${rule.id}`;
          this.alarmStateCache.delete(cacheKey);
        }
      }
    } catch (error) {
      logger.error('Error evaluating metric for alarms:', error);
    }

    return triggeredAlarms;
  }

  async createOrUpdateAlarm(data) {
    const device = await Device.findByPk(data.device_id);
    const deviceName = device?.name || `Device ${data.device_id}`;

    const alarmData = {
      device_id: data.device_id,
      interface_id: data.interface_id || null,
      rule_id: data.rule_id,
      severity: data.severity,
      title: this.generateAlarmTitle(data.metric_type, data.severity, deviceName),
      message: this.generateAlarmMessage(data),
      metric_type: data.metric_type,
      current_value: data.current_value,
      threshold_value: data.threshold_value,
    };

    const { alarm, created } = await Alarm.findOrCreateAlarm(alarmData);

    if (created) {
      logger.warn(`New alarm created: ${alarm.title}`, {
        alarmId: alarm.id,
        deviceId: data.device_id,
        severity: data.severity,
      });
    } else {
      logger.debug(`Alarm updated: ${alarm.title}`, {
        alarmId: alarm.id,
        occurrenceCount: alarm.occurrence_count,
      });
    }

    return alarm;
  }

  /**
   * Generate alarm title
   * @param {string} metricType - Metric type
   * @param {string} severity - Alarm severity
   * @param {string} deviceName - Device name
   * @returns {string} - Alarm title
   */
  generateAlarmTitle(metricType, severity, deviceName) {
    const metricNames = {
      cpu: 'CPU 사용률',
      memory: '메모리 사용률',
      traffic_in: '인바운드 트래픽',
      traffic_out: '아웃바운드 트래픽',
      bandwidth_util: '대역폭 사용률',
      errors_in: '인바운드 에러',
      errors_out: '아웃바운드 에러',
      connectivity: '연결 상태',
    };

    const severityPrefix = severity === 'critical' ? '🔴 [긴급]' : '🟡 [경고]';
    const metricName = metricNames[metricType] || metricType;

    return `${severityPrefix} ${deviceName} - ${metricName} 임계값 초과`;
  }

  /**
   * Generate alarm message
   * @param {object} data - Alarm data
   * @returns {string} - Alarm message
   */
  generateAlarmMessage(data) {
    const { metric_type, current_value, threshold_value, severity } = data;
    
    const unitMap = {
      cpu: '%',
      memory: '%',
      traffic_in: 'bps',
      traffic_out: 'bps',
      bandwidth_util: '%',
      errors_in: 'errors/s',
      errors_out: 'errors/s',
    };

    const unit = unitMap[metric_type] || '';
    const valueStr = this.formatValue(current_value, metric_type);
    const thresholdStr = this.formatValue(threshold_value, metric_type);

    return `현재 값: ${valueStr}${unit}\n임계값: ${thresholdStr}${unit}\n심각도: ${severity === 'critical' ? '긴급' : '경고'}`;
  }

  /**
   * Format metric value for display
   * @param {number} value - Metric value
   * @param {string} metricType - Metric type
   * @returns {string} - Formatted value
   */
  formatValue(value, metricType) {
    if (value === null || value === undefined) return 'N/A';

    // Format traffic values
    if (['traffic_in', 'traffic_out'].includes(metricType)) {
      if (value >= 1000000000) {
        return `${(value / 1000000000).toFixed(2)} G`;
      }
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(2)} M`;
      }
      if (value >= 1000) {
        return `${(value / 1000).toFixed(2)} K`;
      }
      return value.toFixed(2);
    }

    return value.toFixed(2);
  }

  /**
   * Create connectivity alarm when device is down
   * @param {number} deviceId - Device ID
   * @returns {Promise<object>} - Alarm instance
   */
  async createConnectivityAlarm(deviceId) {
    const device = await Device.findByPk(deviceId);
    if (!device) return null;

    return this.createOrUpdateAlarm({
      device_id: deviceId,
      severity: 'critical',
      metric_type: 'connectivity',
      current_value: 0,
      threshold_value: 1,
    });
  }

  /**
   * Auto-resolve alarms when condition is no longer met
   * @param {number} deviceId - Device ID
   * @param {string} metricType - Metric type
   * @param {number} currentValue - Current metric value
   */
  async autoResolveAlarms(deviceId, metricType, currentValue) {
    try {
      // Get active alarms for this device/metric
      const activeAlarms = await Alarm.findAll({
        where: {
          device_id: deviceId,
          metric_type: metricType,
          status: ['active', 'acknowledged'],
        },
        include: ['rule'],
      });

      for (const alarm of activeAlarms) {
        if (alarm.rule) {
          const result = alarm.rule.checkCondition(currentValue);
          if (!result.triggered) {
            // Condition no longer met, auto-resolve
            await alarm.update({
              status: 'resolved',
              resolved_at: new Date(),
              resolution_note: '자동 해결: 지표가 정상 범위로 돌아옴',
            });

            logger.info(`Auto-resolved alarm ${alarm.id}`, {
              deviceId,
              metricType,
              currentValue,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error auto-resolving alarms:', error);
    }
  }

  /**
   * Get alarm summary statistics
   * @returns {Promise<object>} - Alarm statistics
   */
  async getAlarmSummary() {
    const stats = await Alarm.getStatistics();
    
    const summary = {
      active: { info: 0, warning: 0, critical: 0 },
      acknowledged: { info: 0, warning: 0, critical: 0 },
      resolved: { info: 0, warning: 0, critical: 0 },
      total24h: 0,
    };

    stats.forEach((stat) => {
      if (summary[stat.status]) {
        summary[stat.status][stat.severity] = parseInt(stat.count, 10);
      }
      summary.total24h += parseInt(stat.count, 10);
    });

    summary.totalActive = summary.active.info + summary.active.warning + summary.active.critical;
    summary.totalCritical = summary.active.critical + summary.acknowledged.critical;

    return summary;
  }

  /**
   * Clean up old resolved alarms
   * @param {number} days - Days to retain
   * @returns {Promise<number>} - Number of deleted alarms
   */
  async cleanupOldAlarms(days = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await Alarm.destroy({
      where: {
        status: 'resolved',
        resolved_at: {
          [require('sequelize').Op.lt]: cutoffDate,
        },
      },
    });

    logger.info(`Cleaned up ${result} old resolved alarms`);
    return result;
  }
}

// Export singleton instance
module.exports = new AlarmService();
