import React, { useEffect, useState } from 'react';
import apiService from '../services/api';
import './Alarms.css';

interface Alarm {
  id: number;
  deviceId: number;
  severity: string;
  status: string;
  title: string;
  message: string;
  metricType: string;
  currentValue: number;
  thresholdValue: number;
  firstOccurrence: string;
  lastOccurrence: string;
  occurrenceCount: number;
  device?: {
    name: string;
    ipAddress: string;
  };
}

export const Alarms: React.FC = () => {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    status: 'active',
    severity: 'all',
  });

  useEffect(() => {
    loadAlarms();
    const interval = setInterval(loadAlarms, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [page, filters]);

  const loadAlarms = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit: 20,
      };
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.severity !== 'all') params.severity = filters.severity;

      const response = await apiService.getAlarms(params);
      if (response.success) {
        setAlarms(response.data.alarms || []);
        setTotalPages(response.data.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to load alarms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (id: number) => {
    try {
      await apiService.acknowledgeAlarm(id);
      loadAlarms();
    } catch (error) {
      console.error('Failed to acknowledge alarm:', error);
    }
  };

  const handleResolve = async (id: number) => {
    try {
      await apiService.resolveAlarm(id);
      loadAlarms();
    } catch (error) {
      console.error('Failed to resolve alarm:', error);
    }
  };

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'severity-critical';
      case 'warning':
        return 'severity-warning';
      case 'info':
        return 'severity-info';
      default:
        return '';
    }
  };

  const getSeverityLabel = (severity: string) => {
    const labels: { [key: string]: string } = {
      critical: 'Critical',
      warning: 'Warning',
      info: 'Info',
    };
    return labels[severity] || severity;
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      active: '활성',
      acknowledged: '확인됨',
      resolved: '해결됨',
    };
    return labels[status] || status;
  };

  return (
    <div className="alarms-page">
      <h1 className="page-title">알람</h1>

      <div className="filters">
        <select
          value={filters.status}
          onChange={(e) => {
            setFilters({ ...filters, status: e.target.value });
            setPage(1);
          }}
          className="filter-select"
        >
          <option value="all">모든 상태</option>
          <option value="active">활성</option>
          <option value="acknowledged">확인됨</option>
          <option value="resolved">해결됨</option>
        </select>
        <select
          value={filters.severity}
          onChange={(e) => {
            setFilters({ ...filters, severity: e.target.value });
            setPage(1);
          }}
          className="filter-select"
        >
          <option value="all">모든 심각도</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">로딩 중...</div>
      ) : (
        <>
          <div className="alarms-list">
            {alarms.length === 0 ? (
              <div className="empty-state">알람이 없습니다.</div>
            ) : (
              alarms.map((alarm) => (
                <div key={alarm.id} className={`alarm-card ${getSeverityClass(alarm.severity)}`}>
                  <div className="alarm-header">
                    <div className="alarm-title-section">
                      <span className={`severity-badge ${getSeverityClass(alarm.severity)}`}>
                        {getSeverityLabel(alarm.severity)}
                      </span>
                      <h3>{alarm.title}</h3>
                      <span className="alarm-status">{getStatusLabel(alarm.status)}</span>
                    </div>
                    <div className="alarm-actions">
                      {alarm.status === 'active' && (
                        <>
                          <button
                            className="btn-acknowledge"
                            onClick={() => handleAcknowledge(alarm.id)}
                          >
                            확인
                          </button>
                          <button
                            className="btn-resolve"
                            onClick={() => handleResolve(alarm.id)}
                          >
                            해결
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="alarm-body">
                    <p className="alarm-message">{alarm.message}</p>
                    <div className="alarm-details">
                      <span>
                        장비: {alarm.device?.name || `ID: ${alarm.deviceId}`} (
                        {alarm.device?.ipAddress || 'N/A'})
                      </span>
                      {alarm.metricType && <span>메트릭: {alarm.metricType}</span>}
                      {alarm.currentValue !== null && (
                        <span>
                          현재값: {alarm.currentValue} / 임계값: {alarm.thresholdValue}
                        </span>
                      )}
                      <span>
                        발생: {new Date(alarm.firstOccurrence).toLocaleString('ko-KR')}
                      </span>
                      {alarm.occurrenceCount > 1 && (
                        <span>발생 횟수: {alarm.occurrenceCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="page-btn"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                이전
              </button>
              <span className="page-info">
                페이지 {page} / {totalPages}
              </span>
              <button
                className="page-btn"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

