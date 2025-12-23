const { Alarm, AlarmRule, Device, InterfaceInfo, User, sequelize } = require('../models');
const alarmService = require('../services/alarmService');
const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const getAlarms = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = 'all',
      severity,
      deviceId,
      metricType,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // 필터링
    if (status !== 'all') {
      where.status = status;
    }
    if (severity) {
      where.severity = severity;
    }
    if (deviceId) {
      where.device_id = deviceId;
    }
    if (metricType) {
      where.metric_type = metricType;
    }

    // 정렬 검증
    const allowedSortFields = ['created_at', 'updated_at', 'severity', 'status', 'occurrence_count'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const { count, rows: alarms } = await Alarm.findAndCountAll({
      where,
      include: [
        {
          model: Device,
          as: 'device',
          attributes: ['id', 'name', 'ip_address', 'device_type'],
        },
        {
          model: InterfaceInfo,
          as: 'interface',
          attributes: ['id', 'if_name'],
        },
        {
          model: AlarmRule,
          as: 'rule',
          attributes: ['id', 'name'],
        },
        {
          model: User,
          as: 'acknowledgedByUser',
          attributes: ['id', 'username'],
        },
        {
          model: User,
          as: 'resolvedByUser',
          attributes: ['id', 'username'],
        },
      ],
      order: [[sortField, order]],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      success: true,
      message: '알람 목록을 조회했습니다.',
      data: {
        alarms,
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
 * 알람 상세 조회
 * GET /api/v1/alarms/:id
 */
const getAlarmById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const alarm = await Alarm.findByPk(id, {
      include: [
        {
          model: Device,
          as: 'device',
        },
        {
          model: InterfaceInfo,
          as: 'interface',
        },
        {
          model: AlarmRule,
          as: 'rule',
        },
        {
          model: User,
          as: 'acknowledgedByUser',
          attributes: ['id', 'username', 'email'],
        },
        {
          model: User,
          as: 'resolvedByUser',
          attributes: ['id', 'username', 'email'],
        },
      ],
    });

    if (!alarm) {
      throw ApiError.notFound('알람을 찾을 수 없습니다.');
    }

    res.json({
      success: true,
      message: '알람 정보를 조회했습니다.',
      data: { alarm },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 알람 확인 처리
 * PATCH /api/v1/alarms/:id/acknowledge
 */
const acknowledgeAlarm = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const userId = req.user.id;

    const alarm = await Alarm.findByPk(id);

    if (!alarm) {
      throw ApiError.notFound('알람을 찾을 수 없습니다.');
    }

    if (alarm.status !== 'active') {
      throw ApiError.badRequest('이미 확인된 알람입니다.');
    }

    await alarm.update({
      status: 'acknowledged',
      acknowledged_by: userId,
      acknowledged_at: new Date(),
      acknowledgement_note: note,
    });

    logger.info(`Alarm acknowledged: ${id}`, { userId, alarmId: id });

    res.json({
      success: true,
      message: '알람이 확인 처리되었습니다.',
      data: { alarm },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 알람 해결 처리
 * PATCH /api/v1/alarms/:id/resolve
 */
const resolveAlarm = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const userId = req.user.id;

    const alarm = await Alarm.findByPk(id);

    if (!alarm) {
      throw ApiError.notFound('알람을 찾을 수 없습니다.');
    }

    if (alarm.status === 'resolved') {
      throw ApiError.badRequest('이미 해결된 알람입니다.');
    }

    await alarm.update({
      status: 'resolved',
      resolved_by: userId,
      resolved_at: new Date(),
      resolution_note: note,
    });

    logger.info(`Alarm resolved: ${id}`, { userId, alarmId: id });

    res.json({
      success: true,
      message: '알람이 해결 처리되었습니다.',
      data: { alarm },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 알람 일괄 확인 처리
 * PATCH /api/v1/alarms/bulk-acknowledge
 */
const bulkAcknowledgeAlarms = async (req, res, next) => {
  try {
    const { alarmIds, note } = req.body;
    const userId = req.user.id;

    if (!alarmIds || !Array.isArray(alarmIds) || alarmIds.length === 0) {
      throw ApiError.badRequest('알람 ID 목록이 필요합니다.');
    }

    const [updatedCount] = await Alarm.update(
      {
        status: 'acknowledged',
        acknowledged_by: userId,
        acknowledged_at: new Date(),
        acknowledgement_note: note,
      },
      {
        where: {
          id: { [Op.in]: alarmIds },
          status: 'active',
        },
      }
    );

    logger.info(`Bulk acknowledge: ${updatedCount} alarms`, { userId, alarmIds });

    res.json({
      success: true,
      message: `${updatedCount}개의 알람이 확인 처리되었습니다.`,
      data: { updatedCount },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 알람 일괄 해결 처리
 * PATCH /api/v1/alarms/bulk-resolve
 */
const bulkResolveAlarms = async (req, res, next) => {
  try {
    const { alarmIds, note } = req.body;
    const userId = req.user.id;

    if (!alarmIds || !Array.isArray(alarmIds) || alarmIds.length === 0) {
      throw ApiError.badRequest('알람 ID 목록이 필요합니다.');
    }

    const [updatedCount] = await Alarm.update(
      {
        status: 'resolved',
        resolved_by: userId,
        resolved_at: new Date(),
        resolution_note: note,
      },
      {
        where: {
          id: { [Op.in]: alarmIds },
          status: { [Op.in]: ['active', 'acknowledged'] },
        },
      }
    );

    logger.info(`Bulk resolve: ${updatedCount} alarms`, { userId, alarmIds });

    res.json({
      success: true,
      message: `${updatedCount}개의 알람이 해결 처리되었습니다.`,
      data: { updatedCount },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 알람 요약 통계
 * GET /api/v1/alarms/summary
 */
const getAlarmSummary = async (req, res, next) => {
  try {
    const summary = await alarmService.getAlarmSummary();

    res.json({
      success: true,
      message: '알람 요약 통계를 조회했습니다.',
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== 알람 규칙 관리 ====================

/**
 * 알람 규칙 목록 조회
 * GET /api/v1/alarms/rules
 */
const getAlarmRules = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, isEnabled } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (isEnabled !== undefined) {
      where.is_enabled = isEnabled === 'true';
    }

    const { count, rows: rules } = await AlarmRule.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      success: true,
      message: '알람 규칙 목록을 조회했습니다.',
      data: {
        rules,
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
 * 알람 규칙 상세 조회
 * GET /api/v1/alarms/rules/:id
 */
const getAlarmRuleById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const rule = await AlarmRule.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'email'],
        },
        {
          model: Alarm,
          as: 'alarms',
          limit: 10,
          order: [['created_at', 'DESC']],
        },
      ],
    });

    if (!rule) {
      throw ApiError.notFound('알람 규칙을 찾을 수 없습니다.');
    }

    res.json({
      success: true,
      message: '알람 규칙을 조회했습니다.',
      data: { rule },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 알람 규칙 생성
 * POST /api/v1/alarms/rules
 */
const createAlarmRule = async (req, res, next) => {
  try {
    const {
      name,
      description,
      metric_type,
      condition_operator = 'gt',
      threshold_warning,
      threshold_critical,
      duration_seconds = 0,
      cooldown_seconds = 300,
      device_filter,
    } = req.body;

    const userId = req.user.id;

    // 중복 이름 확인
    const existingRule = await AlarmRule.findOne({ where: { name } });
    if (existingRule) {
      throw ApiError.conflict('동일한 이름의 규칙이 이미 존재합니다.');
    }

    const rule = await AlarmRule.create({
      name,
      description,
      metric_type,
      condition_operator,
      threshold_warning,
      threshold_critical,
      duration_seconds,
      cooldown_seconds,
      device_filter,
      created_by: userId,
    });

    logger.info(`Alarm rule created: ${name}`, { userId, ruleId: rule.id });

    res.status(201).json({
      success: true,
      message: '알람 규칙이 생성되었습니다.',
      data: { rule },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 알람 규칙 수정
 * PUT /api/v1/alarms/rules/:id
 */
const updateAlarmRule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const rule = await AlarmRule.findByPk(id);

    if (!rule) {
      throw ApiError.notFound('알람 규칙을 찾을 수 없습니다.');
    }

    // 이름 변경 시 중복 확인
    if (updateData.name && updateData.name !== rule.name) {
      const existingRule = await AlarmRule.findOne({
        where: {
          name: updateData.name,
          id: { [Op.ne]: id },
        },
      });
      if (existingRule) {
        throw ApiError.conflict('동일한 이름의 규칙이 이미 존재합니다.');
      }
    }

    await rule.update(updateData);

    logger.info(`Alarm rule updated: ${rule.name}`, { ruleId: id });

    res.json({
      success: true,
      message: '알람 규칙이 수정되었습니다.',
      data: { rule },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 알람 규칙 삭제
 * DELETE /api/v1/alarms/rules/:id
 */
const deleteAlarmRule = async (req, res, next) => {
  try {
    const { id } = req.params;

    const rule = await AlarmRule.findByPk(id);

    if (!rule) {
      throw ApiError.notFound('알람 규칙을 찾을 수 없습니다.');
    }

    const ruleName = rule.name;
    await rule.destroy();

    logger.info(`Alarm rule deleted: ${ruleName}`, { ruleId: id });

    res.json({
      success: true,
      message: '알람 규칙이 삭제되었습니다.',
      data: { id: parseInt(id) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 알람 규칙 활성화/비활성화 토글
 * PATCH /api/v1/alarms/rules/:id/toggle
 */
const toggleAlarmRule = async (req, res, next) => {
  try {
    const { id } = req.params;

    const rule = await AlarmRule.findByPk(id);

    if (!rule) {
      throw ApiError.notFound('알람 규칙을 찾을 수 없습니다.');
    }

    const newStatus = !rule.is_enabled;
    await rule.update({ is_enabled: newStatus });

    logger.info(`Alarm rule ${newStatus ? 'enabled' : 'disabled'}: ${rule.name}`, { ruleId: id });

    res.json({
      success: true,
      message: `알람 규칙이 ${newStatus ? '활성화' : '비활성화'}되었습니다.`,
      data: {
        id: parseInt(id),
        is_enabled: newStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // 알람 관리
  getAlarms,
  getAlarmById,
  acknowledgeAlarm,
  resolveAlarm,
  bulkAcknowledgeAlarms,
  bulkResolveAlarms,
  getAlarmSummary,
  // 알람 규칙 관리
  getAlarmRules,
  getAlarmRuleById,
  createAlarmRule,
  updateAlarmRule,
  deleteAlarmRule,
  toggleAlarmRule,
};
