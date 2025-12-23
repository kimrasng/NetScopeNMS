/**
 * AI Controller
 * AI 분석 및 예측 API 핸들러
 */

const { AIAnalysis, Device, Alarm, sequelize } = require('../models');
const aiService = require('../services/aiService');
const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * 장비 AI 분석 요청
 * POST /api/v1/ai/devices/:deviceId/analyze
 */
const analyzeDevice = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { forceRefresh = false } = req.body;

    // 장비 존재 확인
    const device = await Device.findByPk(deviceId);
    if (!device) {
      throw ApiError.notFound('장비를 찾을 수 없습니다.');
    }

    // AI 분석 실행
    const result = await aiService.predictIssues(deviceId);

    logger.info(`AI analysis requested for device: ${device.name}`, { 
      deviceId, 
      cached: result.cached || false 
    });

    res.json({
      success: true,
      message: result.cached ? '캐시된 분석 결과입니다.' : 'AI 분석이 완료되었습니다.',
      data: {
        deviceId: parseInt(deviceId),
        deviceName: device.name,
        ...result,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 알람 근본 원인 분석
 * POST /api/v1/ai/alarms/:alarmId/analyze
 */
const analyzeAlarm = async (req, res, next) => {
  try {
    const { alarmId } = req.params;

    // 알람 존재 확인
    const alarm = await Alarm.findByPk(alarmId);
    if (!alarm) {
      throw ApiError.notFound('알람을 찾을 수 없습니다.');
    }

    // AI 분석 실행
    const result = await aiService.analyzeAlarm(alarmId);

    if (result.skipped) {
      return res.json({
        success: true,
        message: `분석이 생략되었습니다: ${result.reason}`,
        data: { skipped: true, reason: result.reason },
      });
    }

    logger.info(`AI alarm analysis completed for alarm: ${alarmId}`, { 
      alarmId, 
      cached: result.cached || false 
    });

    res.json({
      success: true,
      message: result.cached ? '캐시된 분석 결과입니다.' : '알람 분석이 완료되었습니다.',
      data: {
        alarmId: parseInt(alarmId),
        ...result,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 장비 예측 분석
 * POST /api/v1/ai/devices/:deviceId/predict
 */
const predictDevice = async (req, res, next) => {
  try {
    const { deviceId } = req.params;

    const device = await Device.findByPk(deviceId);
    if (!device) {
      throw ApiError.notFound('장비를 찾을 수 없습니다.');
    }

    const result = await aiService.predictIssues(deviceId);

    res.json({
      success: true,
      message: result.cached ? '캐시된 예측 결과입니다.' : '예측 분석이 완료되었습니다.',
      data: {
        deviceId: parseInt(deviceId),
        deviceName: device.name,
        ...result,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 일일 리포트 생성
 * POST /api/v1/ai/reports/daily
 */
const generateDailyReport = async (req, res, next) => {
  try {
    const result = await aiService.generateDailyReport();

    logger.info('Daily report generated', { cached: result.cached || false });

    res.json({
      success: true,
      message: result.cached ? '캐시된 리포트입니다.' : '일일 리포트가 생성되었습니다.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 주간 리포트 생성
 * POST /api/v1/ai/reports/weekly
 */
const generateWeeklyReport = async (req, res, next) => {
  try {
    // aiService에 주간 리포트 메서드가 있다면 사용, 없다면 일일 리포트 기반으로 생성
    const result = await aiService.generateDailyReport(); // TODO: 주간 리포트 로직 구현

    res.json({
      success: true,
      message: '주간 리포트가 생성되었습니다.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * AI 분석 이력 조회
 * GET /api/v1/ai/history
 */
const getAnalysisHistory = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      deviceId,
      type,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    if (deviceId) {
      where.device_id = deviceId;
    }
    if (type) {
      where.analysis_type = type;
    }

    const { count, rows: analyses } = await AIAnalysis.findAndCountAll({
      where,
      include: [
        {
          model: Device,
          as: 'device',
          attributes: ['id', 'name', 'ip_address'],
        },
        {
          model: Alarm,
          as: 'alarm',
          attributes: ['id', 'title', 'severity'],
        },
      ],
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      success: true,
      message: 'AI 분석 이력을 조회했습니다.',
      data: {
        analyses,
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
 * AI 분석 상세 조회
 * GET /api/v1/ai/history/:id
 */
const getAnalysisById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const analysis = await AIAnalysis.findByPk(id, {
      include: [
        {
          model: Device,
          as: 'device',
        },
        {
          model: Alarm,
          as: 'alarm',
        },
      ],
    });

    if (!analysis) {
      throw ApiError.notFound('분석 결과를 찾을 수 없습니다.');
    }

    res.json({
      success: true,
      message: 'AI 분석 결과를 조회했습니다.',
      data: { analysis },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * AI 분석 통계
 * GET /api/v1/ai/statistics
 */
const getAnalysisStatistics = async (req, res, next) => {
  try {
    const { period = '7d' } = req.query;

    let startDate;
    const now = new Date();

    switch (period) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // 분석 타입별 통계
    const typeStats = await AIAnalysis.findAll({
      where: {
        created_at: { [Op.gte]: startDate },
      },
      attributes: [
        'analysis_type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('tokens_used')), 'total_tokens'],
        [sequelize.fn('AVG', sequelize.col('response_time_ms')), 'avg_response_time'],
      ],
      group: ['analysis_type'],
      raw: true,
    });

    // 총계
    const totals = await AIAnalysis.findOne({
      where: {
        created_at: { [Op.gte]: startDate },
      },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_analyses'],
        [sequelize.fn('SUM', sequelize.col('tokens_used')), 'total_tokens'],
        [sequelize.fn('AVG', sequelize.col('response_time_ms')), 'avg_response_time'],
      ],
      raw: true,
    });

    // 캐시 적중률 계산 (간단한 추정)
    const cachedCount = await AIAnalysis.count({
      where: {
        created_at: { [Op.gte]: startDate },
        tokens_used: 0,
      },
    });

    const totalCount = totals?.total_analyses || 0;
    const cacheHitRate = totalCount > 0 ? (cachedCount / totalCount) * 100 : 0;

    res.json({
      success: true,
      message: 'AI 분석 통계를 조회했습니다.',
      data: {
        period,
        startDate,
        endDate: now,
        totals: {
          analyses: parseInt(totals?.total_analyses) || 0,
          tokensUsed: parseInt(totals?.total_tokens) || 0,
          avgResponseTimeMs: parseFloat(totals?.avg_response_time) || 0,
          cacheHitRate: cacheHitRate.toFixed(2),
        },
        byType: typeStats.map(stat => ({
          type: stat.analysis_type,
          count: parseInt(stat.count),
          tokensUsed: parseInt(stat.total_tokens) || 0,
          avgResponseTimeMs: parseFloat(stat.avg_response_time) || 0,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 전체 장비 예측 분석 실행
 * POST /api/v1/ai/predict-all
 */
const predictAllDevices = async (req, res, next) => {
  try {
    // 관리자 권한 확인은 라우트에서 처리

    const results = await aiService.runPredictionForAllDevices();

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    logger.info(`Prediction for all devices completed`, { 
      total: results.length, 
      success: successCount, 
      failed: failCount 
    });

    res.json({
      success: true,
      message: `전체 장비 예측 분석이 완료되었습니다. (성공: ${successCount}, 실패: ${failCount})`,
      data: {
        total: results.length,
        successCount,
        failCount,
        results,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * AI 분석 결과 삭제
 * DELETE /api/v1/ai/history/:id
 */
const deleteAnalysis = async (req, res, next) => {
  try {
    const { id } = req.params;

    const analysis = await AIAnalysis.findByPk(id);

    if (!analysis) {
      throw ApiError.notFound('분석 결과를 찾을 수 없습니다.');
    }

    await analysis.destroy();

    logger.info(`AI analysis deleted: ${id}`);

    res.json({
      success: true,
      message: '분석 결과가 삭제되었습니다.',
      data: { id: parseInt(id) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * AI 분석 캐시 초기화
 * POST /api/v1/ai/cache/clear
 */
const clearAnalysisCache = async (req, res, next) => {
  try {
    const { deviceId, type } = req.body;

    const where = { cache_expires_at: { [Op.gt]: new Date() } };
    
    if (deviceId) {
      where.device_id = deviceId;
    }
    if (type) {
      where.analysis_type = type;
    }

    // 캐시 만료 시간을 현재로 설정하여 무효화
    const [updatedCount] = await AIAnalysis.update(
      { cache_expires_at: new Date() },
      { where }
    );

    logger.info(`AI analysis cache cleared`, { deviceId, type, clearedCount: updatedCount });

    res.json({
      success: true,
      message: `${updatedCount}개의 캐시가 초기화되었습니다.`,
      data: { clearedCount: updatedCount },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  analyzeDevice,
  analyzeAlarm,
  predictDevice,
  generateDailyReport,
  generateWeeklyReport,
  getAnalysisHistory,
  getAnalysisById,
  getAnalysisStatistics,
  predictAllDevices,
  deleteAnalysis,
  clearAnalysisCache,
};
