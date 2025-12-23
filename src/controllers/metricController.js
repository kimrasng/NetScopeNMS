const { Metric, MetricHourly, MetricDaily, Device, InterfaceInfo, sequelize } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const parsePeriod = (period, from, to) => {
  const now = new Date();
  let startDate, endDate;

  if (period === 'custom' && from && to) {
    startDate = new Date(from);
    endDate = new Date(to);
  } else {
    endDate = now;
    switch (period) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  return { startDate, endDate };
};

const determineDataSource = (interval, startDate, endDate) => {
  const durationHours = (endDate - startDate) / (1000 * 60 * 60);

  if (interval === 'raw') return 'raw';
  if (interval === '5m') return 'raw';
  if (interval === '1h') return 'hourly';
  if (interval === '1d') return 'daily';
  
  // auto 또는 기본값
  if (durationHours <= 6) return 'raw';
  if (durationHours <= 72) return 'hourly';
  return 'daily';
};

const getDeviceMetrics = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { 
      period = '24h', 
      interval = 'auto', 
      metrics = 'cpu,memory,traffic_in,traffic_out',
      from,
      to,
    } = req.query;

    // 장비 존재 확인
    const device = await Device.findByPk(deviceId);
    if (!device) {
      throw ApiError.notFound('장비를 찾을 수 없습니다.');
    }

    const { startDate, endDate } = parsePeriod(period, from, to);
    const dataSource = determineDataSource(interval, startDate, endDate);
    const metricTypes = metrics.split(',').map(m => m.trim());

    let data;

    switch (dataSource) {
      case 'raw':
        data = await Metric.findAll({
          where: {
            device_id: deviceId,
            metric_type: { [Op.in]: metricTypes },
            collected_at: {
              [Op.between]: [startDate, endDate],
            },
          },
          order: [['collected_at', 'ASC']],
          attributes: ['metric_type', 'value', 'collected_at'],
        });
        break;

      case 'hourly':
        data = await MetricHourly.findAll({
          where: {
            device_id: deviceId,
            metric_type: { [Op.in]: metricTypes },
            hour_timestamp: {
              [Op.between]: [startDate, endDate],
            },
          },
          order: [['hour_timestamp', 'ASC']],
          attributes: ['metric_type', 'avg_value', 'min_value', 'max_value', 'sample_count', 'hour_timestamp'],
        });
        break;

      case 'daily':
        data = await MetricDaily.findAll({
          where: {
            device_id: deviceId,
            metric_type: { [Op.in]: metricTypes },
            day_timestamp: {
              [Op.between]: [startDate, endDate],
            },
          },
          order: [['day_timestamp', 'ASC']],
          attributes: ['metric_type', 'avg_value', 'min_value', 'max_value', 'p95_value', 'sample_count', 'day_timestamp'],
        });
        break;
    }

    // 메트릭 타입별로 그룹화
    const groupedData = {};
    metricTypes.forEach(type => {
      groupedData[type] = [];
    });

    data.forEach(item => {
      const point = dataSource === 'raw' 
        ? { timestamp: item.collected_at, value: item.value }
        : {
            timestamp: item.hour_timestamp || item.day_timestamp,
            avg: item.avg_value,
            min: item.min_value,
            max: item.max_value,
            p95: item.p95_value,
            samples: item.sample_count,
          };
      
      if (groupedData[item.metric_type]) {
        groupedData[item.metric_type].push(point);
      }
    });

    res.json({
      success: true,
      message: '메트릭 데이터를 조회했습니다.',
      data: {
        deviceId: parseInt(deviceId),
        deviceName: device.name,
        period,
        interval: dataSource,
        startDate,
        endDate,
        metrics: groupedData,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 인터페이스 메트릭 조회
 * GET /api/v1/metrics/interfaces/:interfaceId
 */
const getInterfaceMetrics = async (req, res, next) => {
  try {
    const { interfaceId } = req.params;
    const { 
      period = '24h', 
      interval = 'auto',
      from,
      to,
    } = req.query;

    // 인터페이스 존재 확인
    const iface = await InterfaceInfo.findByPk(interfaceId, {
      include: [{ model: Device, as: 'device', attributes: ['id', 'name'] }],
    });

    if (!iface) {
      throw ApiError.notFound('인터페이스를 찾을 수 없습니다.');
    }

    const { startDate, endDate } = parsePeriod(period, from, to);
    const dataSource = determineDataSource(interval, startDate, endDate);

    const metricTypes = ['traffic_in', 'traffic_out', 'bandwidth_util', 'errors_in', 'errors_out'];

    let data;

    if (dataSource === 'raw') {
      data = await Metric.findAll({
        where: {
          interface_id: interfaceId,
          metric_type: { [Op.in]: metricTypes },
          collected_at: {
            [Op.between]: [startDate, endDate],
          },
        },
        order: [['collected_at', 'ASC']],
        attributes: ['metric_type', 'value', 'collected_at'],
      });
    } else if (dataSource === 'hourly') {
      data = await MetricHourly.findAll({
        where: {
          interface_id: interfaceId,
          metric_type: { [Op.in]: metricTypes },
          hour_timestamp: {
            [Op.between]: [startDate, endDate],
          },
        },
        order: [['hour_timestamp', 'ASC']],
      });
    } else {
      data = await MetricDaily.findAll({
        where: {
          interface_id: interfaceId,
          metric_type: { [Op.in]: metricTypes },
          day_timestamp: {
            [Op.between]: [startDate, endDate],
          },
        },
        order: [['day_timestamp', 'ASC']],
      });
    }

    // 메트릭 타입별 그룹화
    const groupedData = {};
    metricTypes.forEach(type => {
      groupedData[type] = [];
    });

    data.forEach(item => {
      const point = dataSource === 'raw'
        ? { timestamp: item.collected_at, value: item.value }
        : {
            timestamp: item.hour_timestamp || item.day_timestamp,
            avg: item.avg_value,
            min: item.min_value,
            max: item.max_value,
          };

      if (groupedData[item.metric_type]) {
        groupedData[item.metric_type].push(point);
      }
    });

    res.json({
      success: true,
      message: '인터페이스 메트릭을 조회했습니다.',
      data: {
        interfaceId: parseInt(interfaceId),
        interfaceName: iface.if_name,
        deviceId: iface.device?.id,
        deviceName: iface.device?.name,
        period,
        interval: dataSource,
        startDate,
        endDate,
        metrics: groupedData,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 최신 메트릭 조회 (실시간 대시보드용)
 * GET /api/v1/metrics/devices/:deviceId/latest
 */
const getLatestMetrics = async (req, res, next) => {
  try {
    const { deviceId } = req.params;

    const device = await Device.findByPk(deviceId);
    if (!device) {
      throw ApiError.notFound('장비를 찾을 수 없습니다.');
    }

    // 각 메트릭 타입의 최신 값 조회
    const metricTypes = ['cpu', 'memory', 'traffic_in', 'traffic_out'];
    const latestMetrics = {};

    for (const metricType of metricTypes) {
      const latest = await Metric.findOne({
        where: {
          device_id: deviceId,
          metric_type: metricType,
        },
        order: [['collected_at', 'DESC']],
        attributes: ['value', 'collected_at'],
      });

      latestMetrics[metricType] = latest 
        ? { value: latest.value, timestamp: latest.collected_at }
        : null;
    }

    // 인터페이스별 최신 트래픽
    const interfaces = await InterfaceInfo.findAll({
      where: { device_id: deviceId, if_oper_status: 'up' },
      attributes: ['id', 'if_name', 'if_speed'],
    });

    const interfaceMetrics = [];
    for (const iface of interfaces) {
      const [trafficIn, trafficOut] = await Promise.all([
        Metric.findOne({
          where: { interface_id: iface.id, metric_type: 'traffic_in' },
          order: [['collected_at', 'DESC']],
        }),
        Metric.findOne({
          where: { interface_id: iface.id, metric_type: 'traffic_out' },
          order: [['collected_at', 'DESC']],
        }),
      ]);

      interfaceMetrics.push({
        id: iface.id,
        name: iface.if_name,
        speed: iface.if_speed,
        trafficIn: trafficIn?.value || 0,
        trafficOut: trafficOut?.value || 0,
        timestamp: trafficIn?.collected_at || trafficOut?.collected_at,
      });
    }

    res.json({
      success: true,
      message: '최신 메트릭을 조회했습니다.',
      data: {
        deviceId: parseInt(deviceId),
        deviceName: device.name,
        deviceStatus: device.status,
        lastPollTime: device.last_poll_time,
        metrics: latestMetrics,
        interfaces: interfaceMetrics,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 메트릭 통계 조회
 * GET /api/v1/metrics/devices/:deviceId/statistics
 */
const getMetricStatistics = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { period = '7d' } = req.query;

    const device = await Device.findByPk(deviceId);
    if (!device) {
      throw ApiError.notFound('장비를 찾을 수 없습니다.');
    }

    const { startDate, endDate } = parsePeriod(period);

    // 집계 통계 계산
    const statistics = await MetricDaily.findAll({
      where: {
        device_id: deviceId,
        day_timestamp: { [Op.between]: [startDate, endDate] },
      },
      attributes: [
        'metric_type',
        [sequelize.fn('AVG', sequelize.col('avg_value')), 'avg'],
        [sequelize.fn('MIN', sequelize.col('min_value')), 'min'],
        [sequelize.fn('MAX', sequelize.col('max_value')), 'max'],
        [sequelize.fn('AVG', sequelize.col('p95_value')), 'p95_avg'],
      ],
      group: ['metric_type'],
      raw: true,
    });

    const statsMap = {};
    statistics.forEach(stat => {
      statsMap[stat.metric_type] = {
        avg: parseFloat(stat.avg) || 0,
        min: parseFloat(stat.min) || 0,
        max: parseFloat(stat.max) || 0,
        p95: parseFloat(stat.p95_avg) || 0,
      };
    });

    res.json({
      success: true,
      message: '메트릭 통계를 조회했습니다.',
      data: {
        deviceId: parseInt(deviceId),
        deviceName: device.name,
        period,
        startDate,
        endDate,
        statistics: statsMap,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 전체 대시보드 요약
 * GET /api/v1/metrics/dashboard
 */
const getDashboardSummary = async (req, res, next) => {
  try {
    // 장비 상태 요약
    const deviceStats = await Device.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    });

    const deviceSummary = {
      total: 0,
      up: 0,
      down: 0,
      warning: 0,
      unknown: 0,
    };

    deviceStats.forEach(stat => {
      const count = parseInt(stat.count);
      deviceSummary[stat.status] = count;
      deviceSummary.total += count;
    });

    // 상위 CPU/메모리 사용 장비
    const topCpuDevices = await Metric.findAll({
      where: { metric_type: 'cpu' },
      attributes: [
        'device_id',
        [sequelize.fn('AVG', sequelize.col('value')), 'avg_cpu'],
      ],
      include: [{ model: Device, as: 'device', attributes: ['name'] }],
      group: ['device_id'],
      order: [[sequelize.fn('AVG', sequelize.col('value')), 'DESC']],
      limit: 5,
      raw: true,
      nest: true,
    });

    const topMemoryDevices = await Metric.findAll({
      where: { metric_type: 'memory' },
      attributes: [
        'device_id',
        [sequelize.fn('AVG', sequelize.col('value')), 'avg_memory'],
      ],
      include: [{ model: Device, as: 'device', attributes: ['name'] }],
      group: ['device_id'],
      order: [[sequelize.fn('AVG', sequelize.col('value')), 'DESC']],
      limit: 5,
      raw: true,
      nest: true,
    });

    res.json({
      success: true,
      message: '대시보드 요약 정보를 조회했습니다.',
      data: {
        devices: deviceSummary,
        topCpuDevices: topCpuDevices.map(d => ({
          deviceId: d.device_id,
          deviceName: d.device?.name,
          avgCpu: parseFloat(d.avg_cpu) || 0,
        })),
        topMemoryDevices: topMemoryDevices.map(d => ({
          deviceId: d.device_id,
          deviceName: d.device?.name,
          avgMemory: parseFloat(d.avg_memory) || 0,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 메트릭 데이터 내보내기
 * GET /api/v1/metrics/devices/:deviceId/export
 */
const exportMetrics = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { 
      period = '24h', 
      metrics = 'cpu,memory,traffic_in,traffic_out',
      format = 'json',
      from,
      to,
    } = req.query;

    const device = await Device.findByPk(deviceId);
    if (!device) {
      throw ApiError.notFound('장비를 찾을 수 없습니다.');
    }

    const { startDate, endDate } = parsePeriod(period, from, to);
    const metricTypes = metrics.split(',').map(m => m.trim());

    const data = await Metric.findAll({
      where: {
        device_id: deviceId,
        metric_type: { [Op.in]: metricTypes },
        collected_at: {
          [Op.between]: [startDate, endDate],
        },
      },
      order: [['collected_at', 'ASC']],
      raw: true,
    });

    if (format === 'csv') {
      // CSV 형식으로 변환
      const headers = 'timestamp,metric_type,value\n';
      const rows = data.map(d => 
        `${d.collected_at},${d.metric_type},${d.value}`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=metrics_${deviceId}_${period}.csv`);
      res.send(headers + rows);
    } else {
      res.json({
        success: true,
        message: '메트릭 데이터를 내보냈습니다.',
        data: {
          deviceId: parseInt(deviceId),
          deviceName: device.name,
          period,
          startDate,
          endDate,
          records: data,
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDeviceMetrics,
  getInterfaceMetrics,
  getLatestMetrics,
  getMetricStatistics,
  getDashboardSummary,
  exportMetrics,
};
