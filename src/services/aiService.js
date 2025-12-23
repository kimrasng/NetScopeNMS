/**
 * AI Service
 * Handles all OpenAI API interactions
 */

const logger = require('../utils/logger');
const openaiConfig = require('../config/openai');
const promptBuilder = require('../utils/promptBuilder');
const { Device, Alarm, Metric, MetricDaily, AIAnalysis, InterfaceInfo } = require('../models');
const { Op } = require('sequelize');

// In-memory cache for AI results (1 hour default)
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

class AIService {
  /**
   * Analyze alarm and find root cause
   * @param {number} alarmId - Alarm ID
   * @returns {Promise<object>} - Analysis result
   */
  async analyzeAlarm(alarmId) {
    const alarm = await Alarm.findByPk(alarmId, {
      include: ['device', 'interface'],
    });

    if (!alarm) {
      throw new Error(`Alarm ${alarmId} not found`);
    }

    // Check cache
    const cacheKey = `alarm_rca_${alarmId}_${alarm.occurrence_count}`;
    const cached = await this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    // Skip AI for low-severity alarms if needed
    if (alarm.severity === 'info') {
      logger.debug(`Skipping AI analysis for info-level alarm ${alarmId}`);
      return { skipped: true, reason: 'info-level alarm' };
    }

    const device = alarm.device;

    // Get recent metrics
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentMetrics = await Metric.getDeviceMetrics(
      device.id,
      ['cpu', 'memory', 'traffic_in', 'traffic_out'],
      oneHourAgo,
      new Date()
    );

    // Get interfaces
    const interfaces = await InterfaceInfo.findAll({
      where: { device_id: device.id },
    });

    // Build prompt
    const systemPrompt = promptBuilder.buildSystemPrompt();
    const userPrompt = promptBuilder.buildAlarmRCAPrompt({
      alarm: alarm.toJSON(),
      device: device.toJSON(),
      recentMetrics,
      interfaces: interfaces.map(i => i.toPublicJSON()),
    });

    // Call OpenAI
    const result = await this.callOpenAI(systemPrompt, userPrompt, {
      cacheKey,
      analysisType: 'alarm_rca',
      deviceId: device.id,
      alarmId,
    });

    return result;
  }

  /**
   * Predict issues for a device
   * @param {number} deviceId - Device ID
   * @returns {Promise<object>} - Prediction result
   */
  async predictIssues(deviceId) {
    const device = await Device.findByPk(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    // Check cache
    const cacheKey = `prediction_${deviceId}_${new Date().getHours()}`;
    const cached = await this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    // Get statistics
    const statistics = await MetricDaily.getDeviceStatistics(deviceId, 7);

    // Calculate trends
    const trends = await this.calculateTrends(deviceId);

    // Get recent alarms
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentAlarms = await Alarm.findAll({
      where: {
        device_id: deviceId,
        created_at: { [Op.gte]: sevenDaysAgo },
      },
      order: [['created_at', 'DESC']],
      limit: 10,
    });

    // Build prompt
    const systemPrompt = promptBuilder.buildSystemPrompt();
    const userPrompt = promptBuilder.buildPredictionPrompt({
      device: {
        ...device.toJSON(),
        uptimeFormatted: device.getUptimeFormatted(),
      },
      statistics,
      trends,
      recentAlarms: recentAlarms.map(a => a.toJSON()),
    });

    // Call OpenAI
    const result = await this.callOpenAI(systemPrompt, userPrompt, {
      cacheKey,
      analysisType: 'prediction',
      deviceId,
    });

    return result;
  }

  /**
   * Generate daily report
   * @returns {Promise<object>} - Daily report
   */
  async generateDailyReport() {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `daily_report_${today}`;

    // Check cache
    const cached = await this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    // Get device summary
    const devices = await Device.findAll();
    const deviceSummary = {
      total: devices.length,
      up: devices.filter(d => d.status === 'up').length,
      down: devices.filter(d => d.status === 'down').length,
      warning: devices.filter(d => d.status === 'warning').length,
      unknown: devices.filter(d => d.status === 'unknown').length,
    };

    // Get alarm summary
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const alarms = await Alarm.findAll({
      where: { created_at: { [Op.gte]: oneDayAgo } },
    });

    const alarmSummary = {
      total: alarms.length,
      critical: alarms.filter(a => a.severity === 'critical').length,
      warning: alarms.filter(a => a.severity === 'warning').length,
      activeCount: alarms.filter(a => a.status !== 'resolved').length,
    };

    // Get top devices by resource usage
    const topDevices = await this.getTopDevicesByUsage();

    // Get significant events
    const events = await this.getSignificantEvents();

    // Build prompt
    const systemPrompt = promptBuilder.buildSystemPrompt();
    const userPrompt = promptBuilder.buildDailyReportPrompt({
      date: today,
      deviceSummary,
      alarmSummary,
      topDevices,
      events,
    });

    // Call OpenAI
    const result = await this.callOpenAI(systemPrompt, userPrompt, {
      cacheKey,
      analysisType: 'daily_report',
      deviceId: null,
    });

    return result;
  }

  /**
   * Run prediction for all active devices
   * @returns {Promise<Array>} - Prediction results
   */
  async runPredictionForAllDevices() {
    const devices = await Device.findAll({
      where: { is_enabled: true, status: { [Op.ne]: 'unknown' } },
    });

    const results = [];
    
    // Process devices sequentially to avoid rate limiting
    for (const device of devices) {
      try {
        const result = await this.predictIssues(device.id);
        results.push({ deviceId: device.id, success: true, result });
      } catch (error) {
        logger.error(`Prediction failed for device ${device.id}:`, error);
        results.push({ deviceId: device.id, success: false, error: error.message });
      }

      // Add small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }

  /**
   * Call OpenAI API and save result
   * @param {string} systemPrompt - System prompt
   * @param {string} userPrompt - User prompt
   * @param {object} options - Options including cacheKey, analysisType, deviceId
   * @returns {Promise<object>} - Analysis result
   */
  async callOpenAI(systemPrompt, userPrompt, options) {
    if (!openaiConfig.isConfigured()) {
      logger.warn('OpenAI not configured, returning mock response');
      return this.getMockResponse(options.analysisType);
    }

    try {
      const response = await openaiConfig.createCompletion(systemPrompt, userPrompt, {
        jsonMode: true,
      });

      // Parse JSON response
      const parsedResult = openaiConfig.parseJsonResponse(response.content);

      // Save to database
      const analysis = await AIAnalysis.createWithCache({
        device_id: options.deviceId,
        alarm_id: options.alarmId,
        analysis_type: options.analysisType,
        prompt_summary: userPrompt.substring(0, 500),
        result: parsedResult || { raw: response.content },
        model_used: response.model,
        tokens_used: response.usage?.totalTokens,
        response_time_ms: response.responseTimeMs,
        cache_key: options.cacheKey,
      }, 1); // 1 hour cache

      // Update in-memory cache
      if (options.cacheKey) {
        cache.set(options.cacheKey, {
          result: parsedResult || { raw: response.content },
          timestamp: Date.now(),
        });
      }

      return {
        success: true,
        result: parsedResult || { raw: response.content },
        analysisId: analysis.id,
        tokensUsed: response.usage?.totalTokens,
      };
    } catch (error) {
      logger.error('OpenAI API call failed:', error);
      throw error;
    }
  }

  /**
   * Get cached result from memory or database
   * @param {string} cacheKey - Cache key
   * @returns {Promise<object|null>} - Cached result or null
   */
  async getCachedResult(cacheKey) {
    // Check in-memory cache first
    const memCached = cache.get(cacheKey);
    if (memCached && Date.now() - memCached.timestamp < CACHE_TTL) {
      logger.debug(`Cache hit (memory): ${cacheKey}`);
      return { success: true, result: memCached.result, cached: true };
    }

    // Check database cache
    const dbCached = await AIAnalysis.findCached(cacheKey);
    if (dbCached) {
      logger.debug(`Cache hit (db): ${cacheKey}`);
      // Update memory cache
      cache.set(cacheKey, {
        result: dbCached.result,
        timestamp: Date.now(),
      });
      return { success: true, result: dbCached.result, cached: true };
    }

    return null;
  }

  /**
   * Calculate metric trends for a device
   * @param {number} deviceId - Device ID
   * @returns {Promise<object>} - Trends object
   */
  async calculateTrends(deviceId) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const metrics = await MetricDaily.findAll({
      where: {
        device_id: deviceId,
        day_timestamp: { [Op.gte]: sevenDaysAgo },
      },
      order: [['day_timestamp', 'ASC']],
    });

    const trends = {};
    const metricTypes = ['cpu', 'memory', 'bandwidth_util'];

    metricTypes.forEach((type) => {
      const typeMetrics = metrics.filter(m => m.metric_type === type);
      if (typeMetrics.length >= 2) {
        const first = typeMetrics[0].avg_value;
        const last = typeMetrics[typeMetrics.length - 1].avg_value;
        const change = ((last - first) / first) * 100;

        if (change > 10) {
          trends[type] = `상승 추세 (+${change.toFixed(1)}%)`;
        } else if (change < -10) {
          trends[type] = `하락 추세 (${change.toFixed(1)}%)`;
        } else {
          trends[type] = '안정적';
        }
      } else {
        trends[type] = '데이터 부족';
      }
    });

    return trends;
  }

  /**
   * Get top devices by resource usage
   * @returns {Promise<Array>} - Top devices
   */
  async getTopDevicesByUsage() {
    const { sequelize } = require('../models');
    
    const results = await sequelize.query(`
      SELECT 
        d.id, d.name,
        MAX(CASE WHEN m.metric_type = 'cpu' THEN m.value END) as cpu,
        MAX(CASE WHEN m.metric_type = 'memory' THEN m.value END) as memory
      FROM devices d
      LEFT JOIN (
        SELECT device_id, metric_type, value
        FROM metrics
        WHERE collected_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
          AND metric_type IN ('cpu', 'memory')
      ) m ON d.id = m.device_id
      GROUP BY d.id, d.name
      ORDER BY COALESCE(cpu, 0) + COALESCE(memory, 0) DESC
      LIMIT 5
    `, { type: sequelize.QueryTypes.SELECT });

    return results;
  }

  /**
   * Get significant events from last 24 hours
   * @returns {Promise<Array>} - Events
   */
  async getSignificantEvents() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const alarms = await Alarm.findAll({
      where: {
        severity: 'critical',
        created_at: { [Op.gte]: oneDayAgo },
      },
      include: ['device'],
      order: [['created_at', 'DESC']],
      limit: 10,
    });

    return alarms.map(alarm => ({
      time: new Date(alarm.created_at).toLocaleTimeString('ko-KR'),
      description: `${alarm.device?.name || 'Unknown'}: ${alarm.title}`,
    }));
  }

  /**
   * Get mock response for when OpenAI is not configured
   * @param {string} analysisType - Type of analysis
   * @returns {object} - Mock response
   */
  getMockResponse(analysisType) {
    const mockResponses = {
      alarm_rca: {
        success: true,
        result: {
          severity: 'warning',
          root_cause: 'OpenAI API가 설정되지 않아 분석을 수행할 수 없습니다.',
          contributing_factors: ['API 키 미설정'],
          immediate_actions: ['OpenAI API 키를 설정하세요'],
          long_term_recommendations: ['.env 파일에 OPENAI_API_KEY 추가'],
          urgency: 'within_days',
          confidence: 0,
        },
        mock: true,
      },
      prediction: {
        success: true,
        result: {
          prediction_period: '24h',
          overall_health: 'unknown',
          predicted_issues: [],
          preventive_actions: ['OpenAI API 설정 후 예측 기능 활성화'],
          monitoring_points: [],
          confidence: 0,
        },
        mock: true,
      },
      daily_report: {
        success: true,
        result: {
          summary: 'OpenAI API가 설정되지 않아 AI 분석 리포트를 생성할 수 없습니다.',
          highlights: ['시스템이 정상 작동 중입니다'],
          concerns: ['AI 분석 기능이 비활성화 상태입니다'],
          recommendations: ['OPENAI_API_KEY 환경 변수를 설정하세요'],
          outlook: 'API 설정 후 자동 분석이 활성화됩니다.',
          health_score: 50,
        },
        mock: true,
      },
    };

    return mockResponses[analysisType] || { success: false, error: 'Unknown analysis type' };
  }

  /**
   * Get AI analysis history
   * @param {object} filters - Filters
   * @returns {Promise<Array>} - Analysis history
   */
  async getAnalysisHistory(filters = {}) {
    const where = {};
    
    if (filters.deviceId) {
      where.device_id = filters.deviceId;
    }
    if (filters.type) {
      where.analysis_type = filters.type;
    }
    if (filters.startDate) {
      where.created_at = { [Op.gte]: filters.startDate };
    }

    const analyses = await AIAnalysis.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: filters.limit || 50,
      include: ['device', 'alarm'],
    });

    return analyses.map(a => a.toPublicJSON());
  }

  /**
   * Get usage statistics
   * @param {number} days - Days to analyze
   * @returns {Promise<object>} - Usage stats
   */
  async getUsageStats(days = 30) {
    return AIAnalysis.getUsageStats(days);
  }

  /**
   * Clear cache
   * @param {string} cacheKey - Specific cache key or null for all
   */
  clearCache(cacheKey = null) {
    if (cacheKey) {
      cache.delete(cacheKey);
    } else {
      cache.clear();
    }
    logger.info(`AI cache cleared: ${cacheKey || 'all'}`);
  }
}

// Export singleton instance
module.exports = new AIService();
