const logger = require('../utils/logger');
const openaiConfig = require('../config/openai');
const promptBuilder = require('../utils/promptBuilder');
const { Device, Alarm, Metric, MetricDaily, AIAnalysis, InterfaceInfo } = require('../models');
const { Op } = require('sequelize');

// In-memory cache for AI results (1 hour default)
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

class AIService {
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

    // Get all interfaces with their status
    const interfaces = await InterfaceInfo.findAll({
      where: { device_id: deviceId },
    });

    // Get recent metrics (all types, last 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentMetrics = await Metric.getDeviceMetrics(
      deviceId,
      null, // all metric types
      twoHoursAgo,
      new Date()
    );

    // Get interface-specific traffic metrics
    const interfaceMetrics = await this.getInterfaceTrafficMetrics(deviceId, interfaces);

    // Merge interface traffic data
    const interfacesWithTraffic = interfaces.map(iface => {
      const ifaceData = iface.toPublicJSON();
      const metrics = interfaceMetrics[iface.id] || {};
      return {
        ...ifaceData,
        trafficIn: metrics.traffic_in,
        trafficOut: metrics.traffic_out,
        errorsIn: metrics.errors_in || 0,
        errorsOut: metrics.errors_out || 0,
        discardsIn: metrics.discards_in || 0,
        discardsOut: metrics.discards_out || 0,
      };
    });

    // Build prompt with comprehensive data
    const systemPrompt = promptBuilder.buildSystemPrompt();
    const userPrompt = promptBuilder.buildPredictionPrompt({
      device: {
        ...device.toJSON(),
        uptimeFormatted: device.getUptimeFormatted(),
      },
      statistics,
      trends,
      recentAlarms: recentAlarms.map(a => a.toJSON()),
      interfaces: interfacesWithTraffic,
      recentMetrics: recentMetrics.map(m => ({
        metric_type: m.metric_type,
        value: m.value,
        unit: m.unit,
        collected_at: m.collected_at,
      })),
      systemInfo: {
        sysDescr: device.sys_descr,
        sysContact: device.sys_contact,
        sysName: device.sys_name,
        sysLocation: device.sys_location,
      },
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
   * Get interface traffic metrics
   * @param {number} deviceId - Device ID
   * @param {Array} interfaces - Interface list
   * @returns {Promise<object>} - Interface metrics by interface ID
   */
  async getInterfaceTrafficMetrics(deviceId, interfaces) {
    const { sequelize } = require('../models');
    const interfaceMetrics = {};

    if (!interfaces || interfaces.length === 0) {
      return interfaceMetrics;
    }

    // Get latest metrics for each interface
    const results = await sequelize.query(`
      SELECT 
        m.interface_id,
        m.metric_type,
        m.value
      FROM metrics m
      INNER JOIN (
        SELECT interface_id, metric_type, MAX(collected_at) as max_time
        FROM metrics
        WHERE device_id = :deviceId
          AND interface_id IS NOT NULL
          AND metric_type IN ('traffic_in', 'traffic_out', 'errors_in', 'errors_out', 'discards_in', 'discards_out')
        GROUP BY interface_id, metric_type
      ) latest ON m.interface_id = latest.interface_id 
        AND m.metric_type = latest.metric_type 
        AND m.collected_at = latest.max_time
    `, {
      replacements: { deviceId },
      type: sequelize.QueryTypes.SELECT,
    });

    // Organize by interface ID
    results.forEach((row) => {
      if (!interfaceMetrics[row.interface_id]) {
        interfaceMetrics[row.interface_id] = {};
      }
      interfaceMetrics[row.interface_id][row.metric_type] = row.value;
    });

    return interfaceMetrics;
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
      return this.getMockResponse(options.analysisType, options);
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
      // API 오류 시 Mock 응답으로 폴백
      logger.warn('Falling back to mock response due to API error');
      return this.getMockResponse(options.analysisType, options);
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
  async getMockResponse(analysisType, options = {}) {
    const mockResponses = {
      alarm_rca: {
        severity: 'warning',
        root_cause: '⚠️ 테스트 모드: CPU 사용률이 임계값(80%)을 초과하여 95.5%에 도달했습니다. 주요 원인으로 프로세스 과부하가 의심됩니다.',
        contributing_factors: [
          '백그라운드 프로세스 증가',
          '메모리 스왑 발생으로 인한 CPU 부하',
          '네트워크 트래픽 처리 지연'
        ],
        immediate_actions: [
          '높은 CPU를 사용하는 프로세스 확인 (top, htop)',
          '불필요한 서비스 재시작 고려',
          '리소스 모니터링 강화'
        ],
        long_term_recommendations: [
          '서버 스케일업 또는 로드밸런싱 검토',
          '정기적인 성능 모니터링 체계 구축',
          '알람 임계값 재검토'
        ],
        urgency: 'within_hours',
        confidence: 85,
      },
      prediction: {
        prediction_period: '24h',
        overall_health: 'attention_needed',
        risk_level: 6,
        current_issues: [
          {
            issue: 'CPU 사용률 경고 수준',
            severity: 'warning',
            description: '현재 CPU 사용률이 높은 상태를 유지하고 있습니다. 지속될 경우 서비스 지연이 발생할 수 있습니다.',
            affected_component: 'CPU'
          }
        ],
        predicted_issues: [
          {
            issue: 'CPU 과부하 가능성',
            probability: 75,
            estimated_time: '6시간 이내',
            impact: '패킷 처리 지연, 라우팅 테이블 업데이트 지연, 관리 세션 응답 불가',
            metric_type: 'cpu',
            severity: 'warning'
          },
          {
            issue: '메모리 부족 위험',
            probability: 45,
            estimated_time: '12시간 이내',
            impact: '버퍼 부족으로 인한 패킷 손실, 프로세스 강제 종료',
            metric_type: 'memory',
            severity: 'warning'
          }
        ],
        immediate_actions: [
          {
            action: 'CPU 과부하 프로세스 확인',
            priority: 'high',
            command: 'show processes cpu sorted | head 10 (Cisco) 또는 top -n 1 (Linux)',
            reason: '높은 CPU를 유발하는 프로세스를 식별하여 조치 방안 수립'
          },
          {
            action: '불필요한 서비스 비활성화',
            priority: 'medium',
            command: 'no service [서비스명] 또는 systemctl stop [서비스]',
            reason: 'CPU 부하 감소'
          }
        ],
        preventive_actions: [
          {
            action: '리소스 모니터링 강화',
            when: '즉시',
            procedure: '폴링 주기를 5분에서 1분으로 단축하여 세밀한 모니터링 수행'
          },
          {
            action: '알람 임계값 조정',
            when: '24시간 이내',
            procedure: 'CPU 경고 임계값을 70%로 낮추어 조기 경보 설정'
          }
        ],
        monitoring_recommendations: [
          {
            metric: 'CPU 사용률',
            threshold: '70% 경고, 85% 긴급',
            interval: '1분'
          },
          {
            metric: '메모리 사용률',
            threshold: '80% 경고, 90% 긴급',
            interval: '1분'
          },
          {
            metric: '인터페이스 에러율',
            threshold: '0.1% 이상 시 경고',
            interval: '5분'
          }
        ],
        summary: '장비의 CPU 사용률이 지속적으로 높은 상태입니다. 현재 즉각적인 장애 상황은 아니지만, 6시간 내 CPU 과부하가 발생할 가능성이 75%로 예측됩니다. 프로세스 확인 및 불필요한 서비스 비활성화를 권장합니다.',
        confidence: 70,
      },
      daily_report: {
        summary: '📊 일일 시스템 상태 리포트 (테스트 모드)',
        highlights: [
          '전체 장비 가동률: 정상',
          '주요 알람 발생: 1건 (CPU 임계값 초과)',
          '네트워크 트래픽: 안정적'
        ],
        concerns: [
          'CPU 사용률 경고 알람 발생',
          '일부 장비 응답 지연 관찰'
        ],
        recommendations: [
          '리소스 모니터링 강화',
          '알람 규칙 검토',
          'OpenAI API 설정으로 실제 AI 분석 활성화'
        ],
        outlook: '시스템 전반적으로 안정적이나 일부 리소스 모니터링이 필요합니다.',
        health_score: 75,
      },
    };

    const result = mockResponses[analysisType];
    if (!result) {
      return { success: false, error: 'Unknown analysis type' };
    }

    // Mock 응답도 DB에 저장
    try {
      const analysis = await AIAnalysis.create({
        device_id: options.deviceId || null,
        alarm_id: options.alarmId || null,
        analysis_type: analysisType,
        prompt_summary: '(Mock Response - OpenAI API 미설정 또는 오류)',
        result: result,
        model_used: 'mock',
        tokens_used: 0,
        response_time_ms: 0,
        cache_key: options.cacheKey || null,
      });

      return {
        success: true,
        result: result,
        analysisId: analysis.id,
        mock: true,
      };
    } catch (error) {
      logger.error('Failed to save mock response:', error);
      return {
        success: true,
        result: result,
        mock: true,
      };
    }
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
