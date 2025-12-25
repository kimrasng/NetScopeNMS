import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import apiService from '../services/api';
import './DeviceDetail.css';

interface Device {
  id: number;
  name: string;
  ipAddress: string;
  deviceType: string;
  vendor: string;
  model: string;
  location: string;
  status: string;
  description: string;
  sysDescr: string;
  sysName: string;
  lastPollTime: string;
  interfaces?: Interface[];
}

interface Interface {
  id: number;
  ifIndex: number;
  ifName: string;
  ifDescr: string;
  ifAlias: string;
  ifSpeed: number;
  ifHighSpeed: number;
  speedFormatted: string;
  ifAdminStatus: string;
  ifOperStatus: string;
  displayName: string;
}

interface LatestMetrics {
  metrics: {
    cpu?: { value: number; timestamp: string };
    memory?: { value: number; timestamp: string };
    temperature?: { value: number; timestamp: string };
  };
  interfaces: Array<{
    id: number;
    name: string;
    description: string;
    status: string;
    speed: number;
    speedFormatted: string;
    trafficIn: number;
    trafficOut: number;
    trafficInFormatted: string;
    trafficOutFormatted: string;
    bandwidthUtil: number;
  }>;
}

export const DeviceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [latestMetrics, setLatestMetrics] = useState<LatestMetrics | null>(null);
  const [interfaceMetrics, setInterfaceMetrics] = useState<{ [key: number]: any[] }>({});
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState<{ [key: number]: boolean }>({});
  const [selectedInterface, setSelectedInterface] = useState<number | null>(null);
  const [chartPeriod, setChartPeriod] = useState<string>('24h');
  const [discoveringInterfaces, setDiscoveringInterfaces] = useState(false);

  useEffect(() => {
    if (id) {
      loadDevice();
      loadLatestMetrics();
    }
  }, [id]);

  // useEffect는 제거 - 버튼 클릭 시에만 로드하도록 변경

  const loadDevice = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await apiService.getDeviceById(parseInt(id));
      if (response.success && response.data) {
        const deviceData = response.data.device;
        // 인터페이스 데이터 변환 (백엔드는 toPublicJSON() 사용)
        const interfaces = deviceData.interfaces
          ? deviceData.interfaces.map((iface: any) => {
              const ifSpeed = iface.ifSpeed || iface.if_speed || 0;
              const ifHighSpeed = iface.ifHighSpeed || iface.if_high_speed || 0;
              
              // speedFormatted 포맷팅 함수
              const formatSpeed = (speed: number, highSpeed: number): string => {
                // ifHighSpeed 우선 (Mbps 단위)
                if (highSpeed > 0 && highSpeed < 100000) {
                  if (highSpeed >= 1000) {
                    return `${Math.round(highSpeed / 1000)}gbps`;
                  } else {
                    return `${highSpeed}mbps`;
                  }
                }
                // ifSpeed 사용 (bps 단위)
                if (speed > 0 && speed < 4294967295) {
                  if (speed >= 1000000000) {
                    return `${Math.round(speed / 1000000000)}gbps`;
                  } else if (speed >= 1000000) {
                    return `${Math.round(speed / 1000000)}mbps`;
                  } else if (speed >= 1000) {
                    return `${Math.round(speed / 1000)}kbps`;
                  } else {
                    return `${speed}bps`;
                  }
                }
                return 'Unknown';
              };

              // speedFormatted가 없거나 'Unknown'이면 직접 계산
              let speedFormatted = iface.speedFormatted || iface.speed_formatted;
              if (!speedFormatted || speedFormatted === 'Unknown') {
                speedFormatted = formatSpeed(ifSpeed, ifHighSpeed);
              } else {
                // 백엔드에서 온 값도 포맷 변환 (예: "200.0 Mbps" -> "200mbps")
                const match = speedFormatted.match(/([\d.]+)\s*(gbps|mbps|kbps|bps)/i);
                if (match) {
                  const value = parseFloat(match[1]);
                  const unit = match[2].toLowerCase();
                  speedFormatted = `${Math.round(value)}${unit}`;
                }
              }
              
              return {
                id: iface.id,
                ifIndex: iface.ifIndex || iface.if_index,
                ifName: iface.ifName || iface.if_name,
                ifDescr: iface.ifDescr || iface.if_descr,
                ifAlias: iface.ifAlias || iface.if_alias,
                ifSpeed: ifSpeed,
                ifHighSpeed: ifHighSpeed,
                speedFormatted: speedFormatted,
                ifAdminStatus: iface.ifAdminStatus || iface.if_admin_status,
                ifOperStatus: iface.ifOperStatus || iface.if_oper_status,
                displayName: iface.displayName || iface.ifName || iface.if_name || `Interface ${iface.ifIndex || iface.if_index}`,
              };
            })
          : [];
        
        setDevice({
          id: deviceData.id,
          name: deviceData.name || '',
          ipAddress: deviceData.ipAddress || deviceData.ip_address || '',
          deviceType: deviceData.deviceType || deviceData.device_type || 'other',
          vendor: deviceData.vendor || '',
          model: deviceData.model || '',
          location: deviceData.location || '',
          status: deviceData.status || 'unknown',
          description: deviceData.description || '',
          sysDescr: deviceData.sysDescr || deviceData.sys_descr || '',
          sysName: deviceData.sysName || deviceData.sys_name || '',
          lastPollTime: deviceData.lastPollTime || deviceData.last_poll_time || '',
          interfaces,
        });
      }
    } catch (error) {
      console.error('Failed to load device:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLatestMetrics = async () => {
    if (!id) return;
    setMetricsLoading(true);
    try {
      const response = await apiService.getLatestMetrics(parseInt(id));
      if (response.success && response.data) {
        setLatestMetrics(response.data);
      }
    } catch (error) {
      console.error('Failed to load latest metrics:', error);
    } finally {
      setMetricsLoading(false);
    }
  };

  const discoverInterfaces = async () => {
    if (!id) return;
    setDiscoveringInterfaces(true);
    try {
      const response = await apiService.discoverInterfaces(parseInt(id));
      if (response.success) {
        alert(`${response.data.interfaces.length}개의 인터페이스를 검색했습니다.`);
        // 장비 정보 다시 로드
        await loadDevice();
      } else {
        alert('인터페이스 검색에 실패했습니다: ' + (response.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Failed to discover interfaces:', error);
      alert(error.response?.data?.message || '인터페이스 검색 중 오류가 발생했습니다.');
    } finally {
      setDiscoveringInterfaces(false);
    }
  };

  const loadInterfaceMetrics = async (interfaceId: number, period: string = chartPeriod) => {
    setChartLoading(prev => ({ ...prev, [interfaceId]: true }));
    try {
      const response = await apiService.getInterfaceMetrics(interfaceId, { period });
      if (response.success && response.data) {
        // 백엔드 응답 구조 변환
        const groupedMetrics = response.data.metrics || {};
        const timestamps = new Set<string>();
        
        Object.values(groupedMetrics).forEach((metricArray: any[]) => {
          if (Array.isArray(metricArray)) {
            metricArray.forEach((point: any) => {
              const ts = point.timestamp || point.hour_timestamp || point.day_timestamp;
              if (ts) {
                // 타임스탬프를 정규화 (밀리초 단위로 변환)
                const date = new Date(ts);
                if (!isNaN(date.getTime())) {
                  timestamps.add(date.toISOString());
                }
              }
            });
          }
        });

        const mergedMetrics = Array.from(timestamps)
          .sort()
          .map((ts) => {
            const point: any = { timestamp: ts };
            Object.keys(groupedMetrics).forEach((metricType) => {
              const metricArray = groupedMetrics[metricType] as any[];
              if (Array.isArray(metricArray)) {
                const metricPoint = metricArray.find((p: any) => {
                  const pTs = p.timestamp || p.hour_timestamp || p.day_timestamp;
                  if (!pTs) return false;
                  // 타임스탬프를 비교할 때 정규화
                  const pDate = new Date(pTs);
                  const tDate = new Date(ts);
                  if (isNaN(pDate.getTime()) || isNaN(tDate.getTime())) return false;
                  // 같은 시간대면 매칭 (초 단위까지 비교)
                  return Math.abs(pDate.getTime() - tDate.getTime()) < 60000; // 1분 이내
                });
                point[metricType] = metricPoint
                  ? (metricPoint.value !== undefined ? metricPoint.value : (metricPoint.avg !== undefined ? metricPoint.avg : null))
                  : null;
              }
            });
            return point;
          });

        // 데이터가 일부라도 있으면 표시 (빈 배열이 아니면)
        if (mergedMetrics.length > 0) {
          setInterfaceMetrics(prev => ({
            ...prev,
            [interfaceId]: mergedMetrics,
          }));
        } else {
          // 완전히 데이터가 없을 때만 빈 배열 설정
          setInterfaceMetrics(prev => ({
            ...prev,
            [interfaceId]: [],
          }));
        }
      } else {
        // 응답은 성공했지만 데이터가 없을 때
        setInterfaceMetrics(prev => ({
          ...prev,
          [interfaceId]: [],
        }));
      }
    } catch (error) {
      console.error('Failed to load interface metrics:', error);
      setInterfaceMetrics(prev => ({
        ...prev,
        [interfaceId]: [],
      }));
    } finally {
      setChartLoading(prev => ({ ...prev, [interfaceId]: false }));
    }
  };

  const formatSpeed = (bps: number) => {
    if (!bps || bps === 0) return '0 bps';
    if (bps >= 1000000000000) return `${(bps / 1000000000000).toFixed(2)} Tbps`;
    if (bps >= 1000000000) return `${(bps / 1000000000).toFixed(2)} Gbps`;
    if (bps >= 1000000) return `${(bps / 1000000).toFixed(2)} Mbps`;
    if (bps >= 1000) return `${(bps / 1000).toFixed(2)} Kbps`;
    return `${bps.toFixed(0)} bps`;
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

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'up':
        return 'status-up';
      case 'down':
        return 'status-down';
      case 'warning':
        return 'status-warning';
      default:
        return 'status-unknown';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      up: '정상',
      down: '다운',
      warning: '경고',
      unknown: '알 수 없음',
    };
    return labels[status] || status;
  };

  const getOperStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      up: 'UP',
      down: 'DOWN',
      testing: 'TESTING',
      unknown: 'UNKNOWN',
      dormant: 'DORMANT',
      notPresent: 'NOT PRESENT',
      lowerLayerDown: 'LOWER LAYER DOWN',
    };
    return labels[status] || status;
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  if (!device) {
    return (
      <div className="device-detail-page">
        <div className="error-message">장비를 찾을 수 없습니다.</div>
        <button className="btn-primary" onClick={() => navigate('/devices')}>
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  const isSwitch = device.deviceType === 'switch';
  const isServer = device.deviceType === 'server';

  return (
    <div className="device-detail-page">
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn-back" onClick={() => navigate('/devices')}>
            ← 목록으로
          </button>
          <div className="page-title-section">
            <h1 className="page-title">{device.name}</h1>
            <span className="page-subtitle">{device.ipAddress} • {device.deviceType}</span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn-secondary" onClick={() => navigate(`/devices/${device.id}/edit`)}>
            수정
          </button>
          <button 
            className="btn-danger" 
            onClick={async () => {
              if (window.confirm(`정말로 "${device.name}" 장비를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
                try {
                  const response = await apiService.deleteDevice(device.id);
                  if (response.success) {
                    alert('장비가 삭제되었습니다.');
                    navigate('/devices');
                  } else {
                    alert('장비 삭제에 실패했습니다.');
                  }
                } catch (error: any) {
                  console.error('Failed to delete device:', error);
                  alert(error.response?.data?.message || '장비 삭제 중 오류가 발생했습니다.');
                }
              }
            }}
          >
            삭제
          </button>
        </div>
      </div>

      {/* 장비 기본 정보 */}
      <div className="info-section">
        <h2 className="section-title">기본 정보</h2>
        <div className="info-grid">
          <div className="info-item">
            <label>IP 주소</label>
            <span>{device.ipAddress}</span>
          </div>
          <div className="info-item">
            <label>장비 유형</label>
            <span>{device.deviceType}</span>
          </div>
          <div className="info-item">
            <label>벤더/모델</label>
            <span>{device.vendor || '-'} {device.model ? `/ ${device.model}` : ''}</span>
          </div>
          <div className="info-item">
            <label>위치</label>
            <span>{device.location || '-'}</span>
          </div>
          <div className="info-item">
            <label>상태</label>
            <span className={`status-badge ${getStatusClass(device.status)}`}>
              {getStatusLabel(device.status)}
            </span>
          </div>
          <div className="info-item">
            <label>마지막 폴링</label>
            <span>
              {device.lastPollTime
                ? new Date(device.lastPollTime).toLocaleString('ko-KR')
                : '-'}
            </span>
          </div>
        </div>
        {device.sysDescr && (
          <div className="info-item-full">
            <label>시스템 설명</label>
            <span>{device.sysDescr}</span>
          </div>
        )}
        {device.description && (
          <div className="info-item-full">
            <label>설명</label>
            <span>{device.description}</span>
          </div>
        )}
      </div>

      {/* 서버의 경우: CPU, 메모리 등 상세 메트릭 */}
      {isServer && latestMetrics && (
        <div className="metrics-section">
          <h2 className="section-title">시스템 메트릭</h2>
          <div className="metrics-grid">
            {latestMetrics.metrics.cpu && (
              <div className="metric-card">
                <div className="metric-header">
                  <h3>CPU 사용률</h3>
                  <span className="metric-value">{latestMetrics.metrics.cpu.value.toFixed(1)}%</span>
                </div>
                <div className="metric-progress">
                  <div
                    className="metric-progress-bar"
                    style={{ width: `${latestMetrics.metrics.cpu.value}%` }}
                  ></div>
                </div>
                <div className="metric-time">
                  {new Date(latestMetrics.metrics.cpu.timestamp).toLocaleString('ko-KR')}
                </div>
              </div>
            )}
            {latestMetrics.metrics.memory && (
              <div className="metric-card">
                <div className="metric-header">
                  <h3>메모리 사용률</h3>
                  <span className="metric-value">{latestMetrics.metrics.memory.value.toFixed(1)}%</span>
                </div>
                <div className="metric-progress">
                  <div
                    className="metric-progress-bar"
                    style={{ width: `${latestMetrics.metrics.memory.value}%` }}
                  ></div>
                </div>
                <div className="metric-time">
                  {new Date(latestMetrics.metrics.memory.timestamp).toLocaleString('ko-KR')}
                </div>
              </div>
            )}
            {latestMetrics.metrics.temperature && (
              <div className="metric-card">
                <div className="metric-header">
                  <h3>온도</h3>
                  <span className="metric-value">{latestMetrics.metrics.temperature.value.toFixed(1)}°C</span>
                </div>
                <div className="metric-time">
                  {new Date(latestMetrics.metrics.temperature.timestamp).toLocaleString('ko-KR')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 스위치의 경우: 인터페이스/포트 목록 */}
      {isSwitch && (
        <div className="interfaces-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className="section-title">인터페이스/포트 목록</h2>
            {(!device.interfaces || device.interfaces.length === 0) && (
              <button 
                className="btn-primary" 
                onClick={discoverInterfaces}
                disabled={discoveringInterfaces}
              >
                {discoveringInterfaces ? '검색 중...' : '인터페이스 검색'}
              </button>
            )}
          </div>
          {device.interfaces && device.interfaces.length > 0 ? (
            <div className="interfaces-table-container">
            <table className="interfaces-table">
              <thead>
                <tr>
                  <th>인덱스</th>
                  <th>이름</th>
                  <th>설명</th>
                  <th>속도</th>
                  <th>관리 상태</th>
                  <th>운영 상태</th>
                  <th>트래픽 (In/Out)</th>
                  <th>대역폭 사용률</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {device.interfaces.map((iface) => {
                  const interfaceMetricsData = latestMetrics?.interfaces.find(
                    (i) => i.id === iface.id
                  );
                  return (
                    <tr key={iface.id}>
                      <td>{iface.ifIndex}</td>
                      <td>{iface.ifName || '-'}</td>
                      <td>{iface.ifDescr || '-'}</td>
                      <td>{iface.speedFormatted || 'Unknown'}</td>
                      <td>
                        <span className={`status-badge ${iface.ifAdminStatus === 'up' ? 'status-up' : 'status-down'}`}>
                          {iface.ifAdminStatus.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${iface.ifOperStatus === 'up' ? 'status-up' : 'status-down'}`}>
                          {getOperStatusLabel(iface.ifOperStatus)}
                        </span>
                      </td>
                      <td>
                        {interfaceMetricsData ? (
                          <div className="traffic-info">
                            <span className="traffic-in">
                              ↓ {interfaceMetricsData.trafficInFormatted}
                            </span>
                            <span className="traffic-out">
                              ↑ {interfaceMetricsData.trafficOutFormatted}
                            </span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        {interfaceMetricsData ? (
                          <div className="bandwidth-util">
                            <span className="util-value">
                              {interfaceMetricsData.bandwidthUtil.toFixed(1)}%
                            </span>
                            <div className="util-bar">
                              <div
                                className="util-bar-fill"
                                style={{ width: `${Math.min(interfaceMetricsData.bandwidthUtil, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        <button
                          className="btn-small"
                          onClick={() => {
                            if (selectedInterface === iface.id) {
                              setSelectedInterface(null);
                            } else {
                              setSelectedInterface(iface.id);
                              // 데이터가 없거나 오래된 경우 다시 로드
                              if (!interfaceMetrics[iface.id] || interfaceMetrics[iface.id].length === 0) {
                                loadInterfaceMetrics(iface.id, chartPeriod);
                              }
                            }
                          }}
                        >
                          {selectedInterface === iface.id ? '차트 닫기' : '차트 보기'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          ) : (
            <div className="no-data-message">
              <p>인터페이스 정보가 없습니다. "인터페이스 검색" 버튼을 클릭하여 장비에서 인터페이스를 검색하세요.</p>
            </div>
          )}
          
          {/* 선택된 인터페이스의 트래픽 차트 */}
          {selectedInterface && (
            <div className="interface-chart-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="chart-title" style={{ margin: 0 }}>
                  {
                    device.interfaces.find((i) => i.id === selectedInterface)?.displayName ||
                    `Interface ${selectedInterface}`
                  }{' '}
                  트래픽 차트
                </h3>
                <select
                  value={chartPeriod}
                  onChange={(e) => {
                    setChartPeriod(e.target.value);
                    loadInterfaceMetrics(selectedInterface, e.target.value);
                  }}
                  className="period-select"
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#1a1d26',
                    border: '1px solid #3a3f4f',
                    borderRadius: '4px',
                    color: '#e4e7eb',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  <option value="1h">1시간</option>
                  <option value="6h">6시간</option>
                  <option value="24h">24시간</option>
                  <option value="7d">7일</option>
                  <option value="30d">30일</option>
                </select>
              </div>
              {chartLoading[selectedInterface] ? (
                <div className="loading" style={{ padding: '40px', textAlign: 'center' }}>
                  차트 데이터를 불러오는 중...
                </div>
              ) : interfaceMetrics[selectedInterface] && interfaceMetrics[selectedInterface].length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={interfaceMetrics[selectedInterface]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3a3f4f" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={formatTime}
                      stroke="#b0b3b8"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="#b0b3b8" 
                      style={{ fontSize: '12px' }}
                      tickFormatter={(value: number) => {
                        if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}G`;
                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                        return value.toString();
                      }}
                    />
                    <Tooltip
                      labelFormatter={formatTooltipLabel}
                      formatter={(value: any, name: string) => {
                        if (value === null || value === undefined) return ['N/A', name];
                        if (name === 'Bandwidth Util (%)') {
                          return [`${Number(value).toFixed(2)}%`, name];
                        }
                        return [typeof value === 'number' ? formatSpeed(value) : value, name];
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
                    <Line
                      type="monotone"
                      dataKey="bandwidth_util"
                      stroke="#4a9eff"
                      strokeWidth={2}
                      dot={false}
                      name="Bandwidth Util (%)"
                      connectNulls={false}
                      yAxisId={0}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state" style={{ padding: '40px', textAlign: 'center', color: '#b0b3b8' }}>
                  메트릭 데이터가 없습니다.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 서버가 아닌 경우에도 인터페이스가 있으면 표시 */}
      {!isSwitch && (
        <div className="interfaces-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className="section-title">인터페이스 목록</h2>
            {(!device.interfaces || device.interfaces.length === 0) && (
              <button 
                className="btn-primary" 
                onClick={discoverInterfaces}
                disabled={discoveringInterfaces}
              >
                {discoveringInterfaces ? '검색 중...' : '인터페이스 검색'}
              </button>
            )}
          </div>
          {device.interfaces && device.interfaces.length > 0 ? (
          <>
          <div className="interfaces-table-container">
            <table className="interfaces-table">
              <thead>
                <tr>
                  <th>인덱스</th>
                  <th>이름</th>
                  <th>설명</th>
                  <th>속도</th>
                  <th>관리 상태</th>
                  <th>운영 상태</th>
                </tr>
              </thead>
              <tbody>
                {device.interfaces.map((iface) => (
                  <tr key={iface.id}>
                    <td>{iface.ifIndex}</td>
                    <td>{iface.ifName || '-'}</td>
                    <td>{iface.ifDescr || '-'}</td>
                    <td>{iface.speedFormatted || 'Unknown'}</td>
                    <td>
                      <span className={`status-badge ${iface.ifAdminStatus === 'up' ? 'status-up' : 'status-down'}`}>
                        {iface.ifAdminStatus.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${iface.ifOperStatus === 'up' ? 'status-up' : 'status-down'}`}>
                        {getOperStatusLabel(iface.ifOperStatus)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
          ) : (
            <div className="no-data-message">
              <p>인터페이스 정보가 없습니다. "인터페이스 검색" 버튼을 클릭하여 장비에서 인터페이스를 검색하세요.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

