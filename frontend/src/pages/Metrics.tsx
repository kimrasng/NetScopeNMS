import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import apiService from '../services/api';
import './Metrics.css';

export const Metrics: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [deviceId, setDeviceId] = useState<number | null>(
    searchParams.get('deviceId') ? parseInt(searchParams.get('deviceId')!) : null
  );
  const [devices, setDevices] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [period, setPeriod] = useState('24h');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    if (deviceId) {
      loadMetrics();
    }
  }, [deviceId, period]);

  const loadDevices = async () => {
    try {
      const response = await apiService.getDevices({ limit: 100 });
      if (response.success) {
        setDevices(response.data.devices || []);
      }
    } catch (error) {
      console.error('Failed to load devices:', error);
    }
  };

  const loadMetrics = async () => {
    if (!deviceId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getDeviceMetrics(deviceId, {
        period,
        metrics: 'cpu,memory,traffic_in,traffic_out',
      });
      if (response.success && response.data) {
        // 백엔드는 메트릭을 타입별로 그룹화해서 반환: { cpu: [...], memory: [...] }
        // 프론트엔드는 타임스탬프별로 통합된 배열이 필요: [{ timestamp, cpu, memory, ... }]
        const groupedMetrics = response.data.metrics || {};
        
        // 모든 타임스탬프 수집
        const timestamps = new Set<string>();
        Object.values(groupedMetrics).forEach((metricArray: any[]) => {
          if (Array.isArray(metricArray)) {
            metricArray.forEach((point: any) => {
              const ts = point.timestamp || point.hour_timestamp || point.day_timestamp;
              if (ts) {
                timestamps.add(new Date(ts).toISOString());
              }
            });
          }
        });

        // 타임스탬프별로 데이터 통합
        const mergedMetrics = Array.from(timestamps)
          .sort()
          .map((ts) => {
            const point: any = { timestamp: ts };
            
            // 각 메트릭 타입별로 해당 타임스탬프의 값 찾기
            Object.keys(groupedMetrics).forEach((metricType) => {
              const metricArray = groupedMetrics[metricType] as any[];
              if (Array.isArray(metricArray)) {
                const metricPoint = metricArray.find((p: any) => {
                  const pTs = p.timestamp || p.hour_timestamp || p.day_timestamp;
                  return pTs && new Date(pTs).toISOString() === ts;
                });
                
                if (metricPoint) {
                  // raw 데이터는 value, aggregated 데이터는 avg 사용
                  point[metricType] = metricPoint.value !== undefined 
                    ? metricPoint.value 
                    : (metricPoint.avg !== undefined ? metricPoint.avg : null);
                } else {
                  point[metricType] = null;
      }
              } else {
                point[metricType] = null;
              }
            });
            
            return point;
          });

        // 데이터가 일부라도 있으면 표시
        // mergedMetrics가 비어있지 않고, 최소한 하나의 메트릭 값이라도 있는지 확인
        const hasData = mergedMetrics.length > 0 && mergedMetrics.some(point => {
          // 최소한 하나의 메트릭 타입에 유효한 값이 있는지 확인
          return Object.values(point).some((value, index) => {
            // timestamp는 제외하고 실제 메트릭 값만 확인
            if (index === 0) return false; // timestamp는 건너뛰기
            return value !== null && value !== undefined && !isNaN(Number(value));
          });
        });

        if (hasData) {
          setMetrics(mergedMetrics);
          setError(null); // 데이터가 있으면 에러 메시지 제거
        } else {
          // 완전히 데이터가 없을 때만 에러 표시
          setMetrics([]);
          setError('해당 기간에 메트릭 데이터가 없습니다.');
        }
      } else {
        setMetrics([]);
        setError('메트릭 데이터를 불러올 수 없습니다.');
      }
    } catch (err: any) {
      console.error('Failed to load metrics:', err);
      setMetrics([]);
      setError(err.response?.data?.message || err.message || '메트릭 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string | Date) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTooltipLabel = (label: string | number) => {
    if (!label) return '';
    const date = new Date(label);
    if (isNaN(date.getTime())) return String(label);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="metrics-page">
      <h1 className="page-title">메트릭</h1>

      <div className="metrics-controls">
        <select
          value={deviceId || ''}
          onChange={(e) => {
            const id = e.target.value ? parseInt(e.target.value) : null;
            setDeviceId(id);
            if (id) {
              setSearchParams({ deviceId: id.toString() });
            } else {
              setSearchParams({});
            }
          }}
          className="device-select"
        >
          <option value="">장비 선택</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name} ({device.ipAddress})
            </option>
          ))}
        </select>

        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="period-select">
          <option value="1h">1시간</option>
          <option value="6h">6시간</option>
          <option value="24h">24시간</option>
          <option value="7d">7일</option>
          <option value="30d">30일</option>
        </select>
      </div>

      {!deviceId ? (
        <div className="empty-state">장비를 선택해주세요.</div>
      ) : loading ? (
        <div className="loading">로딩 중...</div>
      ) : error && metrics.length === 0 ? (
        <div className="empty-state">{error}</div>
      ) : metrics.length === 0 ? (
        <div className="empty-state">메트릭 데이터가 없습니다.</div>
      ) : (
        <div className="metrics-charts">
          <div className="chart-card">
            <h3>CPU 사용률 (%)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3a3f4f" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTime}
                  stroke="#b0b3b8"
                  style={{ fontSize: '12px' }}
                />
                <YAxis stroke="#b0b3b8" style={{ fontSize: '12px' }} />
                <Tooltip
                  labelFormatter={formatTooltipLabel}
                  formatter={(value: any) => {
                    if (value === null || value === undefined) return 'N/A';
                    return typeof value === 'number' ? value.toFixed(2) : value;
                  }}
                  contentStyle={{
                    backgroundColor: '#232630',
                    border: '1px solid #3a3f4f',
                    color: '#e4e7eb',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cpu"
                  stroke="#4a9eff"
                  strokeWidth={2}
                  dot={false}
                  name="CPU (%)"
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>메모리 사용률 (%)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3a3f4f" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTime}
                  stroke="#b0b3b8"
                  style={{ fontSize: '12px' }}
                />
                <YAxis stroke="#b0b3b8" style={{ fontSize: '12px' }} />
                <Tooltip
                  labelFormatter={formatTooltipLabel}
                  formatter={(value: any) => {
                    if (value === null || value === undefined) return 'N/A';
                    return typeof value === 'number' ? value.toFixed(2) : value;
                  }}
                  contentStyle={{
                    backgroundColor: '#232630',
                    border: '1px solid #3a3f4f',
                    color: '#e4e7eb',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="memory"
                  stroke="#28a745"
                  strokeWidth={2}
                  dot={false}
                  name="Memory (%)"
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>트래픽 (bps)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3a3f4f" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTime}
                  stroke="#b0b3b8"
                  style={{ fontSize: '12px' }}
                />
                <YAxis stroke="#b0b3b8" style={{ fontSize: '12px' }} />
                <Tooltip
                  labelFormatter={formatTooltipLabel}
                  formatter={(value: any) => {
                    if (value === null || value === undefined) return 'N/A';
                    return typeof value === 'number' ? value.toFixed(2) : value;
                  }}
                  contentStyle={{
                    backgroundColor: '#232630',
                    border: '1px solid #3a3f4f',
                    color: '#e4e7eb',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="traffic_in"
                  stroke="#ffc107"
                  strokeWidth={2}
                  dot={false}
                  name="Inbound"
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="traffic_out"
                  stroke="#dc3545"
                  strokeWidth={2}
                  dot={false}
                  name="Outbound"
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

