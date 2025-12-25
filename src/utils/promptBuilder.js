const buildSystemPrompt = () => {
  return `당신은 네트워크 관리 시스템(NMS)의 전문 AI 분석 엔진입니다.
네트워크 장비의 메트릭 데이터, 인터페이스 트래픽, 시스템 정보를 종합 분석하여:
- 문제의 근본 원인을 정확히 파악
- 현재 상황의 위험도 평가
- 향후 발생 가능한 문제 예측
- **구체적이고 즉시 실행 가능한 대처 방안** 제공

응답 시 다음 원칙을 준수하세요:
1. 한국어로 응답합니다
2. 기술적이면서도 현장 엔지니어가 바로 실행할 수 있도록 구체적으로 설명합니다
3. 위험 상황에 대해 명확히 경고하고, 단계별 대처 방안을 제시합니다
4. CLI 명령어나 설정 변경 등 구체적인 조치를 포함합니다
5. JSON 형식으로 응답을 요청받으면 반드시 유효한 JSON으로만 응답합니다
6. 불확실한 경우 그 점을 명시하고, 추가 확인이 필요한 항목을 제안합니다`;
};

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

const buildPredictionPrompt = (data) => {
  const { device, statistics, trends, recentAlarms, interfaces, recentMetrics, systemInfo } = data;

  let prompt = `## 🔍 장비 종합 분석 및 위험 예측 요청

### 📌 장비 기본 정보
- **장비명**: ${device.name}
- **IP 주소**: ${device.ip_address}
- **장비 타입**: ${device.device_type}
- **벤더/제조사**: ${device.vendor || '알 수 없음'}
- **모델**: ${device.model || '알 수 없음'}
- **위치**: ${device.location || '미지정'}
- **업타임**: ${device.uptimeFormatted || '알 수 없음'}
- **현재 상태**: ${device.status || 'unknown'}
- **SNMP 버전**: ${device.snmp_version || 'v2c'}
`;

  // 시스템 정보 추가
  if (systemInfo) {
    prompt += `
### 🖥️ 시스템 상세 정보
- **시스템 설명**: ${systemInfo.sysDescr || 'N/A'}
- **시스템 연락처**: ${systemInfo.sysContact || 'N/A'}
- **시스템 이름**: ${systemInfo.sysName || 'N/A'}
- **시스템 위치**: ${systemInfo.sysLocation || 'N/A'}
`;
  }

  // 최근 메트릭 상세 (가장 최신 데이터 강조)
  prompt += `
### 📊 최근 메트릭 데이터 (실시간 - 가장 최신 값)
**중요: 아래 데이터는 실제 장비에서 수집된 최신 메트릭 값입니다. 알람 데이터와 다를 수 있으니 실제 메트릭 값을 우선적으로 참고하세요.**

| 메트릭 타입 | 현재 값 | 단위 | 수집 시간 |
|------------|---------|------|----------|
`;

  if (recentMetrics && recentMetrics.length > 0) {
    const latestByType = {};
    recentMetrics.forEach((m) => {
      if (!latestByType[m.metric_type] || new Date(m.collected_at) > new Date(latestByType[m.metric_type].collected_at)) {
        latestByType[m.metric_type] = m;
      }
    });
    Object.values(latestByType).forEach((m) => {
      const time = new Date(m.collected_at).toLocaleString('ko-KR');
      const value = m.value !== null && m.value !== undefined ? m.value.toFixed(2) : 'N/A';
      prompt += `| ${m.metric_type} | **${value}** | ${m.unit || '-'} | ${time} |\n`;
    });
  } else {
    prompt += `| 데이터 없음 | - | - | - |\n`;
  }

  // 통계 정보
  if (statistics && statistics.length > 0) {
    prompt += `
### 📈 24시간 통계 분석
| 메트릭 | 평균 | 최소 | 최대 | 표준편차 |
|--------|------|------|------|----------|
`;
    statistics.forEach((stat) => {
      prompt += `| ${stat.metric_type} | ${stat.overall_avg?.toFixed(1) || 'N/A'} | ${stat.overall_min?.toFixed(1) || 'N/A'} | ${stat.overall_max?.toFixed(1) || 'N/A'} | ${stat.stddev?.toFixed(1) || 'N/A'} |\n`;
    });
  }

  // 추세 정보
  if (trends) {
    prompt += `
### 📉 7일간 추세 분석
`;
    Object.entries(trends).forEach(([metric, trend]) => {
      prompt += `- **${metric}**: ${trend}\n`;
    });
  }

  // 인터페이스 상세 정보
  if (interfaces && interfaces.length > 0) {
    prompt += `
### 🔌 인터페이스 상태 및 트래픽
| 인터페이스 | 상태 | 속도 | IN 트래픽 | OUT 트래픽 | IN 에러 | OUT 에러 | 설명 |
|-----------|------|------|----------|-----------|---------|---------|------|
`;
    interfaces.forEach((iface) => {
      const name = iface.ifName || iface.ifDescr || `Index ${iface.ifIndex}`;
      const status = iface.ifOperStatus === 'up' ? '🟢 UP' : '🔴 DOWN';
      const speed = iface.speedFormatted || 'N/A';
      const trafficIn = iface.trafficIn ? formatTraffic(iface.trafficIn) : 'N/A';
      const trafficOut = iface.trafficOut ? formatTraffic(iface.trafficOut) : 'N/A';
      const errorsIn = iface.errorsIn || 0;
      const errorsOut = iface.errorsOut || 0;
      const desc = iface.ifAlias || '-';
      prompt += `| ${name} | ${status} | ${speed} | ${trafficIn} | ${trafficOut} | ${errorsIn} | ${errorsOut} | ${desc} |\n`;
    });
  }

  // 알람 이력 (실제 메트릭과 비교 필요)
  if (recentAlarms && recentAlarms.length > 0) {
    prompt += `
### ⚠️ 최근 알람 이력 (7일)
**주의: 아래 알람은 과거에 발생한 것이며, 현재 실제 메트릭 값과 다를 수 있습니다. 실제 메트릭 데이터를 우선적으로 확인하세요.**

| 시간 | 심각도 | 제목 | 상태 | 발생 횟수 | 알람 값 |
|------|--------|-----|------|----------|---------|
`;
    recentAlarms.forEach((alarm) => {
      const time = new Date(alarm.created_at).toLocaleString('ko-KR');
      const severity = alarm.severity === 'critical' ? '🔴 긴급' : alarm.severity === 'warning' ? '🟡 경고' : '🔵 정보';
      const alarmValue = alarm.current_value !== null && alarm.current_value !== undefined ? alarm.current_value.toFixed(2) : 'N/A';
      prompt += `| ${time} | ${severity} | ${alarm.title} | ${alarm.status} | ${alarm.occurrence_count || 1} | ${alarmValue} |\n`;
    });
  }

  prompt += `

### ❓ 분석 요청

**중요 지침:**
1. **실제 메트릭 데이터를 우선적으로 참고하세요.** 알람 데이터는 과거에 발생한 것이며, 현재 실제 메트릭 값과 다를 수 있습니다.
2. **실제 메트릭 값이 정상 범위라면**, 알람이 해결되었거나 오탐일 가능성이 높습니다.
3. **데이터 불일치 시**: 실제 메트릭 값이 정상인데 알람이 있다면, 알람이 해결되었거나 오탐임을 명시하세요.
4. **정확한 분석**: 실제 메트릭 데이터를 기반으로만 위험도를 평가하고 예측하세요.

위의 모든 데이터를 종합하여 다음 사항을 분석해주세요:

1. **현재 위험 상황 평가**: 실제 최신 메트릭 데이터를 기반으로 즉시 조치가 필요한 문제가 있는지 평가
2. **향후 예측되는 문제**: 실제 메트릭 추세를 기반으로 24시간~7일 내 발생 가능한 문제 예측
3. **구체적인 대처 방안**: CLI 명령어, 설정 변경 등 실행 가능한 조치
4. **모니터링 권장 사항**: 주의 깊게 살펴봐야 할 지표

다음 JSON 형식으로 응답해주세요:

\`\`\`json
{
  "prediction_period": "24h",
  "overall_health": "healthy|attention_needed|warning|critical",
  "risk_level": 1-10,
  "current_issues": [
    {
      "issue": "현재 발견된 문제",
      "severity": "critical|warning|info",
      "description": "문제에 대한 상세 설명",
      "affected_component": "영향받는 구성요소 (예: CPU, 인터페이스명 등)"
    }
  ],
  "predicted_issues": [
    {
      "issue": "예측되는 문제",
      "probability": 0-100,
      "estimated_time": "예상 발생 시점",
      "impact": "예상되는 영향과 피해 범위",
      "metric_type": "관련 메트릭",
      "severity": "critical|warning|info"
    }
  ],
  "immediate_actions": [
    {
      "action": "즉시 수행해야 할 조치",
      "priority": "high|medium|low",
      "command": "실행할 CLI 명령어나 절차 (해당시)",
      "reason": "이 조치가 필요한 이유"
    }
  ],
  "preventive_actions": [
    {
      "action": "예방 조치",
      "when": "언제까지 수행해야 하는지",
      "procedure": "상세 절차"
    }
  ],
  "monitoring_recommendations": [
    {
      "metric": "모니터링할 지표",
      "threshold": "권장 임계값",
      "interval": "점검 주기"
    }
  ],
  "summary": "전체 상황 요약 (2-3문장)",
  "confidence": 0-100
}
\`\`\``;

  return prompt;
};

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
