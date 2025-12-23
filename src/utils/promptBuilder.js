/**
 * Prompt Builder
 * Builds prompts for OpenAI API requests
 */

/**
 * Build system prompt for NMS AI assistant
 * @returns {string} - System prompt
 */
const buildSystemPrompt = () => {
  return `당신은 네트워크 관리 시스템(NMS)의 AI 분석 엔진입니다.
네트워크 장비의 메트릭 데이터를 분석하여 문제의 근본 원인을 파악하고, 
향후 발생 가능한 문제를 예측하며, 실용적인 권장 조치를 제공합니다.

응답 시 다음 원칙을 준수하세요:
1. 한국어로 응답합니다
2. 기술적이면서도 이해하기 쉽게 설명합니다
3. 구체적이고 실행 가능한 조치를 권장합니다
4. JSON 형식으로 응답을 요청받으면 반드시 유효한 JSON으로만 응답합니다
5. 불확실한 경우 그 점을 명시합니다`;
};

/**
 * Build prompt for alarm root cause analysis
 * @param {object} data - Alarm and metric data
 * @returns {string} - User prompt
 */
const buildAlarmRCAPrompt = (data) => {
  const { alarm, device, recentMetrics, interfaces } = data;

  let prompt = `## 알람 분석 요청

### 알람 정보
- 장비: ${device.name} (${device.ip_address})
- 장비 타입: ${device.device_type}
- 벤더: ${device.vendor || '알 수 없음'}
- 알람 제목: ${alarm.title}
- 심각도: ${alarm.severity}
- 메트릭: ${alarm.metric_type}
- 현재 값: ${alarm.current_value}
- 임계값: ${alarm.threshold_value}
- 최초 발생: ${alarm.first_occurrence}
- 발생 횟수: ${alarm.occurrence_count}

### 최근 1시간 메트릭 추이
| 시간 | CPU (%) | 메모리 (%) | 트래픽 In (Mbps) | 트래픽 Out (Mbps) |
|------|---------|------------|------------------|-------------------|
`;

  // Add metric rows
  if (recentMetrics && recentMetrics.length > 0) {
    const grouped = groupMetricsByTime(recentMetrics);
    Object.entries(grouped).slice(-12).forEach(([time, metrics]) => {
      prompt += `| ${time} | ${metrics.cpu || 'N/A'} | ${metrics.memory || 'N/A'} | ${formatTraffic(metrics.traffic_in)} | ${formatTraffic(metrics.traffic_out)} |\n`;
    });
  }

  // Add interface info
  if (interfaces && interfaces.length > 0) {
    prompt += `\n### 인터페이스 상태\n`;
    interfaces.forEach((iface) => {
      prompt += `- ${iface.if_name || iface.if_descr}: ${iface.if_oper_status} (속도: ${iface.speedFormatted || 'N/A'})\n`;
    });
  }

  prompt += `
### 분석 요청
위 알람을 분석하고 다음 JSON 형식으로 응답해주세요:

\`\`\`json
{
  "severity": "critical|warning|info",
  "root_cause": "문제의 가장 가능성 있는 근본 원인 설명",
  "contributing_factors": ["기여 요인 1", "기여 요인 2"],
  "immediate_actions": ["즉시 취해야 할 조치 1", "조치 2"],
  "long_term_recommendations": ["장기적 권장 사항 1", "권장 사항 2"],
  "urgency": "immediate|within_hours|within_days",
  "confidence": 0.0-1.0
}
\`\`\``;

  return prompt;
};

/**
 * Build prompt for issue prediction
 * @param {object} data - Device and metric data
 * @returns {string} - User prompt
 */
const buildPredictionPrompt = (data) => {
  const { device, statistics, trends, recentAlarms } = data;

  let prompt = `## 문제 예측 분석 요청

### 장비 정보
- 이름: ${device.name}
- IP: ${device.ip_address}
- 타입: ${device.device_type}
- 벤더: ${device.vendor || '알 수 없음'}
- 위치: ${device.location || '미지정'}
- 업타임: ${device.uptimeFormatted || '알 수 없음'}

### 최근 24시간 통계
`;

  if (statistics && statistics.length > 0) {
    statistics.forEach((stat) => {
      prompt += `- ${stat.metric_type}: 평균 ${stat.overall_avg?.toFixed(1) || 'N/A'}, 최소 ${stat.overall_min?.toFixed(1) || 'N/A'}, 최대 ${stat.overall_max?.toFixed(1) || 'N/A'}\n`;
    });
  }

  if (trends) {
    prompt += `\n### 7일간 추세\n`;
    Object.entries(trends).forEach(([metric, trend]) => {
      prompt += `- ${metric}: ${trend}\n`;
    });
  }

  if (recentAlarms && recentAlarms.length > 0) {
    prompt += `\n### 최근 알람 이력 (7일)\n`;
    recentAlarms.forEach((alarm) => {
      prompt += `- [${alarm.severity}] ${alarm.title} (${alarm.created_at})\n`;
    });
  }

  prompt += `
### 예측 분석 요청
위 데이터를 기반으로 향후 발생 가능한 문제를 예측하고 다음 JSON 형식으로 응답해주세요:

\`\`\`json
{
  "prediction_period": "24h|48h|7d",
  "overall_health": "healthy|attention_needed|at_risk",
  "predicted_issues": [
    {
      "issue": "예측되는 문제",
      "probability": 0.0-1.0,
      "estimated_time": "예상 발생 시점",
      "impact": "예상 영향",
      "metric_type": "관련 메트릭"
    }
  ],
  "preventive_actions": ["예방 조치 1", "예방 조치 2"],
  "monitoring_points": ["주의 깊게 모니터링할 항목 1", "항목 2"],
  "confidence": 0.0-1.0
}
\`\`\``;

  return prompt;
};

/**
 * Build prompt for daily report
 * @param {object} data - Summary data
 * @returns {string} - User prompt
 */
const buildDailyReportPrompt = (data) => {
  const { date, deviceSummary, alarmSummary, topDevices, events } = data;

  let prompt = `## 일일 네트워크 상태 리포트 요청

### 날짜: ${date}

### 장비 현황
- 총 장비 수: ${deviceSummary.total}
- 정상 (UP): ${deviceSummary.up}
- 장애 (DOWN): ${deviceSummary.down}
- 경고: ${deviceSummary.warning}
- 알 수 없음: ${deviceSummary.unknown}

### 알람 요약
- 총 알람 수 (24시간): ${alarmSummary.total}
- 긴급 (Critical): ${alarmSummary.critical}
- 경고 (Warning): ${alarmSummary.warning}
- 미해결 알람: ${alarmSummary.activeCount}

### 리소스 사용률 TOP 5 장비
`;

  if (topDevices && topDevices.length > 0) {
    topDevices.forEach((device, idx) => {
      prompt += `${idx + 1}. ${device.name} - CPU: ${device.cpu?.toFixed(1) || 'N/A'}%, 메모리: ${device.memory?.toFixed(1) || 'N/A'}%\n`;
    });
  }

  if (events && events.length > 0) {
    prompt += `\n### 주요 이벤트\n`;
    events.forEach((event) => {
      prompt += `- ${event.time}: ${event.description}\n`;
    });
  }

  prompt += `
### 리포트 작성 요청
위 데이터를 기반으로 오늘의 네트워크 상태 리포트를 작성해주세요.

응답 형식:
\`\`\`json
{
  "summary": "전반적인 네트워크 상태 요약 (2-3문장)",
  "highlights": ["주요 하이라이트 1", "하이라이트 2"],
  "concerns": ["주의가 필요한 사항 1", "사항 2"],
  "recommendations": ["권장 조치 1", "조치 2"],
  "outlook": "내일 주의해야 할 사항 및 모니터링 포인트",
  "health_score": 0-100
}
\`\`\``;

  return prompt;
};

/**
 * Build prompt for anomaly detection
 * @param {object} data - Metric data with baseline
 * @returns {string} - User prompt
 */
const buildAnomalyDetectionPrompt = (data) => {
  const { device, currentMetrics, baseline, deviations } = data;

  let prompt = `## 이상 징후 탐지 분석 요청

### 장비: ${device.name} (${device.ip_address})

### 현재 메트릭 vs 기준선
| 메트릭 | 현재 값 | 기준선 (평균) | 표준편차 | 편차 (σ) |
|--------|---------|--------------|----------|---------|
`;

  if (deviations && deviations.length > 0) {
    deviations.forEach((d) => {
      prompt += `| ${d.metric} | ${d.current?.toFixed(2)} | ${d.baseline?.toFixed(2)} | ${d.stddev?.toFixed(2)} | ${d.deviation?.toFixed(2)} |\n`;
    });
  }

  prompt += `
### 분석 요청
위 데이터에서 이상 징후가 있는지 분석하고 다음 JSON 형식으로 응답해주세요:

\`\`\`json
{
  "anomalies_detected": true|false,
  "anomalies": [
    {
      "metric": "메트릭 이름",
      "description": "이상 징후 설명",
      "severity": "high|medium|low",
      "possible_causes": ["가능한 원인 1", "원인 2"]
    }
  ],
  "overall_assessment": "정상|주의|경고|위험",
  "recommendations": ["권장 조치 1", "조치 2"]
}
\`\`\``;

  return prompt;
};

/**
 * Helper: Group metrics by time
 * @param {Array} metrics - Metric array
 * @returns {object} - Grouped metrics
 */
const groupMetricsByTime = (metrics) => {
  const grouped = {};
  
  metrics.forEach((m) => {
    const time = new Date(m.collected_at).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    
    if (!grouped[time]) {
      grouped[time] = {};
    }
    
    grouped[time][m.metric_type] = m.value;
  });
  
  return grouped;
};

/**
 * Helper: Format traffic value
 * @param {number} value - Bytes per second
 * @returns {string} - Formatted value
 */
const formatTraffic = (value) => {
  if (!value) return 'N/A';
  const mbps = value / 1000000;
  return mbps.toFixed(2);
};

module.exports = {
  buildSystemPrompt,
  buildAlarmRCAPrompt,
  buildPredictionPrompt,
  buildDailyReportPrompt,
  buildAnomalyDetectionPrompt,
  groupMetricsByTime,
  formatTraffic,
};
