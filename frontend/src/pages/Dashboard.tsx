import React, { useEffect, useState } from 'react';
import apiService from '../services/api';
import './Dashboard.css';

interface DashboardSummary {
  devices: {
    total: number;
    up: number;
    down: number;
    warning: number;
    unknown: number;
  };
  alarms: {
    active: number;
    critical: number;
    warning: number;
    info: number;
  };
  metrics: {
    totalDevices: number;
  };
}

export const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    try {
      const [deviceSummary, alarmSummary, metricSummary] = await Promise.all([
        apiService.getDeviceSummary(),
        apiService.getAlarmSummary(),
        apiService.getDashboardSummary(),
      ]);

      // API 응답 구조 확인 및 정규화
      // deviceSummary.data는 { total, byStatus: { up, down, warning, unknown }, byType: {} } 형태
      const devicesData = deviceSummary.data || deviceSummary;
      const devicesByStatus = devicesData?.byStatus || devicesData || {};
      
      const devices = {
        total: Number(devicesData?.total) || 0,
        up: Number(devicesByStatus.up) || 0,
        down: Number(devicesByStatus.down) || 0,
        warning: Number(devicesByStatus.warning) || 0,
        unknown: Number(devicesByStatus.unknown) || 0,
      };

      // alarmSummary.data는 { active: { info, warning, critical }, acknowledged: {...}, resolved: {...}, totalActive, totalCritical } 형태
      const alarmsData = alarmSummary.data || alarmSummary || {};
      
      // alarms 데이터 정규화
      let normalizedAlarms = {
        active: 0,
        critical: 0,
        warning: 0,
        info: 0,
      };

      if (typeof alarmsData === 'object' && alarmsData !== null) {
        // active가 객체인 경우 (백엔드 응답 구조)
        if (alarmsData.active && typeof alarmsData.active === 'object') {
          normalizedAlarms.critical = Number(alarmsData.active.critical) || 0;
          normalizedAlarms.warning = Number(alarmsData.active.warning) || 0;
          normalizedAlarms.info = Number(alarmsData.active.info) || 0;
          normalizedAlarms.active = normalizedAlarms.critical + normalizedAlarms.warning + normalizedAlarms.info;
        } 
        // totalActive가 있는 경우
        else if (typeof alarmsData.totalActive === 'number') {
          normalizedAlarms.active = alarmsData.totalActive;
          // critical, warning, info는 active 객체에서 가져오거나 기본값
          if (alarmsData.active && typeof alarmsData.active === 'object') {
            normalizedAlarms.critical = Number(alarmsData.active.critical) || 0;
            normalizedAlarms.warning = Number(alarmsData.active.warning) || 0;
            normalizedAlarms.info = Number(alarmsData.active.info) || 0;
          }
        }
        // 평면 구조인 경우 (레거시)
        else {
          if (typeof alarmsData.active === 'number') {
            normalizedAlarms.active = alarmsData.active;
          }
          if (typeof alarmsData.critical === 'number') {
            normalizedAlarms.critical = alarmsData.critical;
          }
          if (typeof alarmsData.warning === 'number') {
            normalizedAlarms.warning = alarmsData.warning;
          }
          if (typeof alarmsData.info === 'number') {
            normalizedAlarms.info = alarmsData.info;
          }
          
          // active가 없으면 critical + warning + info의 합으로 계산
          if (normalizedAlarms.active === 0) {
            normalizedAlarms.active = normalizedAlarms.critical + normalizedAlarms.warning + normalizedAlarms.info;
          }
        }
      }

      // metricSummary.data는 { devices: {...}, topCpuDevices: [...], topMemoryDevices: [...] } 형태
      const metricsData = metricSummary.data || metricSummary || {};
      const metricsDevices = metricsData.devices || {};

      setSummary({
        devices,
        alarms: normalizedAlarms,
        metrics: {
          totalDevices: Number(metricsDevices.total) || Number(metricsData.totalDevices) || 0,
        },
      });
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      // 에러 발생 시 기본값 설정
      setSummary({
        devices: {
          total: 0,
          up: 0,
          down: 0,
          warning: 0,
          unknown: 0,
        },
        alarms: {
          active: 0,
          critical: 0,
          warning: 0,
          info: 0,
        },
        metrics: {
          totalDevices: 0,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  if (!summary) {
    return <div className="error">데이터를 불러올 수 없습니다.</div>;
  }

  return (
    <div className="dashboard">
      <h1 className="page-title">대시보드</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <h3>전체 장비</h3>
            <span className="stat-icon">🖥️</span>
          </div>
          <div className="stat-value">{summary.devices.total}</div>
          <div className="stat-details">
            <span className="stat-item up">UP: {summary.devices.up}</span>
            <span className="stat-item down">DOWN: {summary.devices.down}</span>
            <span className="stat-item warning">WARNING: {summary.devices.warning}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <h3>활성 알람</h3>
            <span className="stat-icon">🚨</span>
          </div>
          <div className="stat-value">{summary.alarms.active}</div>
          <div className="stat-details">
            <span className="stat-item critical">Critical: {summary.alarms.critical}</span>
            <span className="stat-item warning">Warning: {summary.alarms.warning}</span>
            <span className="stat-item info">Info: {summary.alarms.info}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="dashboard-section">
          <h2>장비 상태</h2>
          <div className="device-status-grid">
            <div className="status-item">
              <div className="status-indicator up"></div>
              <span>정상 (UP)</span>
              <strong>{summary.devices.up}</strong>
            </div>
            <div className="status-item">
              <div className="status-indicator down"></div>
              <span>다운 (DOWN)</span>
              <strong>{summary.devices.down}</strong>
            </div>
            <div className="status-item">
              <div className="status-indicator warning"></div>
              <span>경고 (WARNING)</span>
              <strong>{summary.devices.warning}</strong>
            </div>
            <div className="status-item">
              <div className="status-indicator unknown"></div>
              <span>알 수 없음</span>
              <strong>{summary.devices.unknown}</strong>
            </div>
          </div>
        </div>

        <div className="dashboard-section">
          <h2>알람 심각도</h2>
          <div className="alarm-severity-grid">
            <div className="severity-item critical">
              <span>Critical</span>
              <strong>{summary.alarms.critical}</strong>
            </div>
            <div className="severity-item warning">
              <span>Warning</span>
              <strong>{summary.alarms.warning}</strong>
            </div>
            <div className="severity-item info">
              <span>Info</span>
              <strong>{summary.alarms.info}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

