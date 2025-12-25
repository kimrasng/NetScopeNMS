import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import './Devices.css';

interface Device {
  id: number;
  name: string;
  ipAddress: string;
  deviceType: string;
  vendor: string;
  model: string;
  location: string;
  status: string;
  isEnabled: boolean;
  lastPollTime: string;
  lastPollSuccess: boolean;
}

export const Devices: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    search: '',
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadDevices();
  }, [page, filters]);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit: 20,
      };
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.type !== 'all') params.type = filters.type;
      if (filters.search) params.search = filters.search;

      const response = await apiService.getDevices(params);
      if (response.success) {
        setDevices(response.data.devices || []);
        // pagination 객체에서 total을 기반으로 직접 계산
        // 백엔드에서 totalPages를 계산하지만, 직접 계산하여 확실하게 함
        const total = response.data.pagination?.total ?? 0;
        const limit = params.limit || 20;
        // total이 0이면 devices.length를 사용 (fallback)
        const actualTotal = total > 0 ? total : (response.data.devices?.length || 0);
        const calculatedTotalPages = actualTotal > 0 ? Math.max(1, Math.ceil(actualTotal / limit)) : 1;
        setTotalPages(calculatedTotalPages);
      }
    } catch (error: any) {
      console.error('Failed to load devices:', error);
      // 에러 발생 시 빈 배열로 설정하여 UI가 깨지지 않도록
      setDevices([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ ...filters, status: e.target.value });
    setPage(1);
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ ...filters, type: e.target.value });
    setPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, search: e.target.value });
    setPage(1);
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

  return (
    <div className="devices-page">
      <div className="page-header">
        <h1 className="page-title">장비 관리</h1>
        <button className="btn-primary" onClick={() => navigate('/devices/new')}>
          + 장비 추가
        </button>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="검색 (이름, IP, 위치)..."
          value={filters.search}
          onChange={handleSearchChange}
          className="search-input"
        />
        <select value={filters.status} onChange={handleStatusChange} className="filter-select">
          <option value="all">모든 상태</option>
          <option value="up">정상</option>
          <option value="down">다운</option>
          <option value="warning">경고</option>
          <option value="unknown">알 수 없음</option>
        </select>
        <select value={filters.type} onChange={handleTypeChange} className="filter-select">
          <option value="all">모든 유형</option>
          <option value="router">라우터</option>
          <option value="switch">스위치</option>
          <option value="server">서버</option>
          <option value="firewall">방화벽</option>
          <option value="access_point">액세스 포인트</option>
          <option value="other">기타</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">로딩 중...</div>
      ) : (
        <>
          <div className="devices-table-container">
            <table className="devices-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>IP 주소</th>
                  <th>유형</th>
                  <th>벤더/모델</th>
                  <th>위치</th>
                  <th>상태</th>
                  <th>마지막 폴링</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-state">
                      장비가 없습니다.
                    </td>
                  </tr>
                ) : (
                  devices.map((device) => (
                    <tr key={device.id}>
                      <td>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(`/devices/${device.id}`);
                          }}
                          className="device-link"
                        >
                          {device.name}
                        </a>
                      </td>
                      <td>{device.ipAddress}</td>
                      <td>{device.deviceType}</td>
                      <td>
                        {device.vendor || '-'} {device.model ? `/ ${device.model}` : ''}
                      </td>
                      <td>{device.location || '-'}</td>
                      <td>
                        <span className={`status-badge ${getStatusClass(device.status)}`}>
                          {getStatusLabel(device.status)}
                        </span>
                      </td>
                      <td>
                        {device.lastPollTime
                          ? new Date(device.lastPollTime).toLocaleString('ko-KR')
                          : '-'}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-small"
                            onClick={() => navigate(`/devices/${device.id}`)}
                          >
                            상세
                          </button>
                          <button
                            className="btn-small"
                            onClick={() => navigate(`/devices/${device.id}/edit`)}
                            style={{ marginLeft: '8px' }}
                          >
                            수정
                          </button>
                          <button
                            className="btn-small"
                            onClick={async () => {
                              if (window.confirm(`정말로 "${device.name}" 장비를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
                                try {
                                  const response = await apiService.deleteDevice(device.id);
                                  if (response.success) {
                                    alert('장비가 삭제되었습니다.');
                                    loadDevices();
                                  } else {
                                    alert('장비 삭제에 실패했습니다.');
                                  }
                                } catch (error: any) {
                                  console.error('Failed to delete device:', error);
                                  alert(error.response?.data?.message || '장비 삭제 중 오류가 발생했습니다.');
                                }
                              }
                            }}
                            style={{
                              marginLeft: '8px',
                              backgroundColor: '#dc3545',
                              color: 'white',
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
                disabled={page >= totalPages}
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

