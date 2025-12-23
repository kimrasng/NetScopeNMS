/**
 * Device Controller
 * 장비 관리 및 SNMP 관련 API 핸들러
 */

const { Device, SnmpCredential, InterfaceInfo, sequelize } = require('../models');
const snmpService = require('../services/snmpService');
const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * 장비 목록 조회
 * GET /api/v1/devices
 */
const getDevices = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      type, 
      search,
      sortBy = 'name',
      sortOrder = 'ASC' 
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // 필터링
    if (status && status !== 'all') {
      where.status = status;
    }
    if (type && type !== 'all') {
      where.device_type = type;
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { ip_address: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } },
      ];
    }

    // 정렬 검증
    const allowedSortFields = ['name', 'ip_address', 'status', 'device_type', 'created_at', 'last_poll_time'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'name';
    const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const { count, rows: devices } = await Device.findAndCountAll({
      where,
      include: [{
        model: InterfaceInfo,
        as: 'interfaces',
        attributes: ['id', 'if_name', 'if_status', 'if_speed'],
      }],
      order: [[sortField, order]],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      success: true,
      message: '장비 목록을 조회했습니다.',
      data: {
        devices: devices.map(d => ({
          ...d.toJSON(),
          interfaceCount: d.interfaces?.length || 0,
        })),
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 장비 상세 조회
 * GET /api/v1/devices/:id
 */
const getDeviceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const device = await Device.findByPk(id, {
      include: [
        {
          model: SnmpCredential,
          as: 'credentials',
          attributes: { exclude: ['community_encrypted', 'auth_password_encrypted', 'priv_password_encrypted'] },
        },
        {
          model: InterfaceInfo,
          as: 'interfaces',
        },
      ],
    });

    if (!device) {
      throw ApiError.notFound('장비를 찾을 수 없습니다.');
    }

    res.json({
      success: true,
      message: '장비 정보를 조회했습니다.',
      data: {
        device: {
          ...device.toJSON(),
          uptimeFormatted: device.getUptimeFormatted ? device.getUptimeFormatted() : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 장비 등록
 * POST /api/v1/devices
 */
const createDevice = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      name,
      ip_address,
      device_type = 'other',
      vendor,
      model,
      location,
      description,
      snmp_version = '2c',
      snmp_port = 161,
      poll_interval = 60,
      // SNMP credentials
      community,
      username,
      security_level,
      auth_protocol,
      auth_password,
      priv_protocol,
      priv_password,
    } = req.body;

    // IP 중복 확인
    const existingDevice = await Device.findOne({ 
      where: { ip_address },
      transaction,
    });

    if (existingDevice) {
      throw ApiError.conflict('이미 등록된 IP 주소입니다.');
    }

    // 장비 생성
    const device = await Device.create({
      name,
      ip_address,
      device_type,
      vendor,
      model,
      location,
      description,
      snmp_version,
      snmp_port,
      poll_interval,
    }, { transaction });

    // SNMP 자격증명 생성
    const credentialData = {
      device_id: device.id,
      snmp_version,
    };

    if (snmp_version === '3') {
      credentialData.username = username;
      credentialData.security_level = security_level;
      credentialData.auth_protocol = auth_protocol;
      credentialData.auth_password_encrypted = auth_password; // Model hook에서 암호화 처리
      credentialData.priv_protocol = priv_protocol;
      credentialData.priv_password_encrypted = priv_password;
    } else {
      credentialData.community_encrypted = community || 'public';
    }

    await SnmpCredential.create(credentialData, { transaction });

    await transaction.commit();

    logger.info(`Device created: ${name} (${ip_address})`, { deviceId: device.id });

    res.status(201).json({
      success: true,
      message: '장비가 성공적으로 등록되었습니다.',
      data: {
        device: device.toJSON(),
      },
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * 장비 수정
 * PUT /api/v1/devices/:id
 */
const updateDevice = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const updateData = req.body;

    const device = await Device.findByPk(id, { transaction });

    if (!device) {
      throw ApiError.notFound('장비를 찾을 수 없습니다.');
    }

    // IP 변경 시 중복 확인
    if (updateData.ip_address && updateData.ip_address !== device.ip_address) {
      const existingDevice = await Device.findOne({
        where: { 
          ip_address: updateData.ip_address,
          id: { [Op.ne]: id },
        },
        transaction,
      });

      if (existingDevice) {
        throw ApiError.conflict('이미 사용 중인 IP 주소입니다.');
      }
    }

    // 장비 정보 업데이트
    await device.update(updateData, { transaction });

    // SNMP 자격증명 업데이트 (별도 요청 처리)
    if (updateData.credentials) {
      await SnmpCredential.update(updateData.credentials, {
        where: { device_id: id },
        transaction,
      });
    }

    await transaction.commit();

    logger.info(`Device updated: ${device.name}`, { deviceId: id });

    res.json({
      success: true,
      message: '장비 정보가 수정되었습니다.',
      data: {
        device: device.toJSON(),
      },
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * 장비 삭제
 * DELETE /api/v1/devices/:id
 */
const deleteDevice = async (req, res, next) => {
  try {
    const { id } = req.params;

    const device = await Device.findByPk(id);

    if (!device) {
      throw ApiError.notFound('장비를 찾을 수 없습니다.');
    }

    const deviceName = device.name;
    await device.destroy(); // CASCADE로 관련 데이터 자동 삭제

    logger.info(`Device deleted: ${deviceName}`, { deviceId: id });

    res.json({
      success: true,
      message: '장비가 삭제되었습니다.',
      data: { id: parseInt(id) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * SNMP 연결 테스트
 * POST /api/v1/devices/:id/test-connection
 * POST /api/v1/devices/test-connection (신규 장비 테스트)
 */
const testConnection = async (req, res, next) => {
  try {
    const { id } = req.params;
    let device, credentials;

    if (id) {
      // 기존 장비 테스트
      device = await Device.findByPk(id, {
        include: [{
          model: SnmpCredential,
          as: 'credentials',
        }],
      });

      if (!device) {
        throw ApiError.notFound('장비를 찾을 수 없습니다.');
      }

      credentials = device.credentials;
    } else {
      // 신규 장비 테스트 (body에서 정보 가져옴)
      const {
        ip_address,
        snmp_version = '2c',
        snmp_port = 161,
        community,
        username,
        security_level,
        auth_protocol,
        auth_password,
        priv_protocol,
        priv_password,
      } = req.body;

      device = {
        ip_address,
        snmp_version,
        snmp_port,
      };

      credentials = {
        communityString: community,
        username,
        security_level,
        auth_protocol,
        authPassword: auth_password,
        priv_protocol,
        privPassword: priv_password,
      };
    }

    const result = await snmpService.testConnection(device, credentials);

    res.json({
      success: true,
      message: result.success ? 'SNMP 연결에 성공했습니다.' : 'SNMP 연결에 실패했습니다.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 장비 인터페이스 검색
 * POST /api/v1/devices/:id/discover-interfaces
 */
const discoverInterfaces = async (req, res, next) => {
  try {
    const { id } = req.params;

    const device = await Device.findByPk(id);

    if (!device) {
      throw ApiError.notFound('장비를 찾을 수 없습니다.');
    }

    const interfaces = await snmpService.discoverInterfaces(id);

    res.json({
      success: true,
      message: `${interfaces.length}개의 인터페이스를 검색했습니다.`,
      data: {
        deviceId: parseInt(id),
        interfaces,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 장비 인터페이스 목록 조회
 * GET /api/v1/devices/:id/interfaces
 */
const getDeviceInterfaces = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.query;

    const device = await Device.findByPk(id);

    if (!device) {
      throw ApiError.notFound('장비를 찾을 수 없습니다.');
    }

    const where = { device_id: id };
    if (status) {
      where.if_status = status;
    }

    const interfaces = await InterfaceInfo.findAll({
      where,
      order: [['if_index', 'ASC']],
    });

    res.json({
      success: true,
      message: '인터페이스 목록을 조회했습니다.',
      data: {
        deviceId: parseInt(id),
        interfaces: interfaces.map(i => i.toPublicJSON()),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 장비 상태 요약
 * GET /api/v1/devices/summary
 */
const getDeviceSummary = async (req, res, next) => {
  try {
    const [statusCounts, typeCounts] = await Promise.all([
      Device.findAll({
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        group: ['status'],
        raw: true,
      }),
      Device.findAll({
        attributes: [
          'device_type',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        group: ['device_type'],
        raw: true,
      }),
    ]);

    const total = await Device.count();

    const summary = {
      total,
      byStatus: {
        up: 0,
        down: 0,
        warning: 0,
        unknown: 0,
      },
      byType: {},
    };

    statusCounts.forEach(row => {
      summary.byStatus[row.status] = parseInt(row.count);
    });

    typeCounts.forEach(row => {
      summary.byType[row.device_type] = parseInt(row.count);
    });

    res.json({
      success: true,
      message: '장비 요약 정보를 조회했습니다.',
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 장비 활성화/비활성화 토글
 * PATCH /api/v1/devices/:id/toggle
 */
const toggleDevice = async (req, res, next) => {
  try {
    const { id } = req.params;

    const device = await Device.findByPk(id);

    if (!device) {
      throw ApiError.notFound('장비를 찾을 수 없습니다.');
    }

    const newStatus = !device.is_enabled;
    await device.update({ is_enabled: newStatus });

    logger.info(`Device ${newStatus ? 'enabled' : 'disabled'}: ${device.name}`, { deviceId: id });

    res.json({
      success: true,
      message: `장비가 ${newStatus ? '활성화' : '비활성화'}되었습니다.`,
      data: {
        id: parseInt(id),
        is_enabled: newStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 수동 폴링 실행
 * POST /api/v1/devices/:id/poll
 */
const pollDevice = async (req, res, next) => {
  try {
    const { id } = req.params;

    const device = await Device.findByPk(id);

    if (!device) {
      throw ApiError.notFound('장비를 찾을 수 없습니다.');
    }

    const result = await snmpService.pollDevice(id);

    res.json({
      success: true,
      message: '장비 폴링이 완료되었습니다.',
      data: {
        deviceId: parseInt(id),
        pollResult: result,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  testConnection,
  discoverInterfaces,
  getDeviceInterfaces,
  getDeviceSummary,
  toggleDevice,
  pollDevice,
};
