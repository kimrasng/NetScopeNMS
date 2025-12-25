import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiService from '../services/api';
import './DeviceForm.css';

export const DeviceForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;
  const [loading, setLoading] = useState(false);
  const [loadingDevice, setLoadingDevice] = useState(isEditMode);
  const [error, setError] = useState<string | null>(null);
  const [snmpVersion, setSnmpVersion] = useState<'1' | '2c' | '3'>('2c');
  const [securityLevel, setSecurityLevel] = useState<'noAuthNoPriv' | 'authNoPriv' | 'authPriv'>('noAuthNoPriv');

  const [formData, setFormData] = useState({
    name: '',
    ip_address: '',
    device_type: 'other',
    vendor: '',
    model: '',
    location: '',
    description: '',
    snmp_port: 161,
    poll_interval: 60,
    // SNMP v1/v2c
    community: 'public',
    // SNMP v3
    username: '',
    auth_protocol: 'MD5',
    auth_password: '',
    priv_protocol: 'AES',
    priv_password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'snmp_port' || name === 'poll_interval' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSnmpVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSnmpVersion(e.target.value as '1' | '2c' | '3');
  };

  const handleSecurityLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSecurityLevel(e.target.value as 'noAuthNoPriv' | 'authNoPriv' | 'authPriv');
  };

  useEffect(() => {
    if (isEditMode && id) {
      loadDevice();
    }
  }, [id, isEditMode]);

  const loadDevice = async () => {
    if (!id) return;
    setLoadingDevice(true);
    try {
      const response = await apiService.getDeviceById(parseInt(id));
      if (response.success && response.data) {
        const device = response.data.device;
        const credentials = device.credentials?.[0] || {};
        
        setFormData({
          name: device.name || '',
          ip_address: device.ip_address || device.ipAddress || '',
          device_type: device.device_type || device.deviceType || 'other',
          vendor: device.vendor || '',
          model: device.model || '',
          location: device.location || '',
          description: device.description || '',
          snmp_port: device.snmp_port || 161,
          poll_interval: device.poll_interval || 60,
          community: credentials.community_string || 'public',
          username: credentials.username || '',
          auth_protocol: credentials.auth_protocol || 'MD5',
          auth_password: '', // 보안상 비밀번호는 로드하지 않음
          priv_protocol: credentials.priv_protocol || 'AES',
          priv_password: '', // 보안상 비밀번호는 로드하지 않음
        });
        
        setSnmpVersion((device.snmp_version || '2c') as '1' | '2c' | '3');
        setSecurityLevel((credentials.security_level || 'noAuthNoPriv') as 'noAuthNoPriv' | 'authNoPriv' | 'authPriv');
      }
    } catch (error) {
      console.error('Failed to load device:', error);
      setError('장비 정보를 불러올 수 없습니다.');
    } finally {
      setLoadingDevice(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const submitData: any = {
        name: formData.name,
        ip_address: formData.ip_address,
        device_type: formData.device_type,
        snmp_version: snmpVersion,
        snmp_port: formData.snmp_port,
        poll_interval: formData.poll_interval,
      };

      // 선택적 필드 추가
      if (formData.vendor) submitData.vendor = formData.vendor;
      if (formData.model) submitData.model = formData.model;
      if (formData.location) submitData.location = formData.location;
      if (formData.description) submitData.description = formData.description;

      // SNMP 자격증명 추가
      if (snmpVersion === '3') {
        submitData.username = formData.username;
        submitData.security_level = securityLevel;
        if (securityLevel !== 'noAuthNoPriv') {
          submitData.auth_protocol = formData.auth_protocol;
          submitData.auth_password = formData.auth_password;
        }
        if (securityLevel === 'authPriv') {
          submitData.priv_protocol = formData.priv_protocol;
          submitData.priv_password = formData.priv_password;
        }
      } else {
        submitData.community = formData.community;
      }

      let response;
      if (isEditMode && id) {
        response = await apiService.updateDevice(parseInt(id), submitData);
      } else {
        response = await apiService.createDevice(submitData);
      }

      if (response.success) {
        alert(response.message || (isEditMode ? '장비가 성공적으로 수정되었습니다.' : '장비가 성공적으로 추가되었습니다.'));
        navigate('/devices');
      } else {
        setError(response.message || (isEditMode ? '장비 수정에 실패했습니다.' : '장비 추가에 실패했습니다.'));
      }
    } catch (err: any) {
      console.error('Device creation error:', err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response?.data?.details) {
        const details = err.response.data.details;
        const errorMessages = Array.isArray(details)
          ? details.map((d: any) => `${d.field}: ${d.message}`).join(', ')
          : '입력값을 확인해주세요.';
        setError(errorMessages);
      } else {
        setError(err.message || '장비 추가 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loadingDevice) {
    return <div className="loading">장비 정보를 불러오는 중...</div>;
  }

  return (
    <div className="device-form-page">
      <div className="page-header">
        <h1 className="page-title">{isEditMode ? '장비 수정' : '장비 추가'}</h1>
        <button className="btn-secondary" onClick={() => navigate('/devices')}>
          취소
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="device-form">
        <div className="form-section">
          <h2 className="section-title">기본 정보</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="name">장비 이름 *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="예: Core-Router-01"
              />
            </div>

            <div className="form-group">
              <label htmlFor="ip_address">IP 주소 *</label>
              <input
                type="text"
                id="ip_address"
                name="ip_address"
                value={formData.ip_address}
                onChange={handleChange}
                required
                disabled={isEditMode}
                placeholder="예: 192.168.1.1"
                style={isEditMode ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
              />
              {isEditMode && <small style={{ color: '#b0b3b8', fontSize: '12px', marginTop: '4px' }}>IP 주소는 수정할 수 없습니다.</small>}
            </div>

            <div className="form-group">
              <label htmlFor="device_type">장비 유형</label>
              <select
                id="device_type"
                name="device_type"
                value={formData.device_type}
                onChange={handleChange}
              >
                <option value="router">라우터</option>
                <option value="switch">스위치</option>
                <option value="server">서버</option>
                <option value="firewall">방화벽</option>
                <option value="access_point">액세스 포인트</option>
                <option value="other">기타</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="vendor">벤더</label>
              <input
                type="text"
                id="vendor"
                name="vendor"
                value={formData.vendor}
                onChange={handleChange}
                placeholder="예: Cisco"
              />
            </div>

            <div className="form-group">
              <label htmlFor="model">모델</label>
              <input
                type="text"
                id="model"
                name="model"
                value={formData.model}
                onChange={handleChange}
                placeholder="예: ISR 4331"
              />
            </div>

            <div className="form-group">
              <label htmlFor="location">위치</label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="예: 본관 서버실"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">설명</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="장비에 대한 추가 설명"
            />
          </div>
        </div>

        <div className="form-section">
          <h2 className="section-title">SNMP 설정</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="snmp_version">SNMP 버전</label>
              <select
                id="snmp_version"
                name="snmp_version"
                value={snmpVersion}
                onChange={handleSnmpVersionChange}
              >
                <option value="1">SNMPv1</option>
                <option value="2c">SNMPv2c</option>
                <option value="3">SNMPv3</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="snmp_port">SNMP 포트</label>
              <input
                type="number"
                id="snmp_port"
                name="snmp_port"
                value={formData.snmp_port}
                onChange={handleChange}
                min={1}
                max={65535}
              />
            </div>

            <div className="form-group">
              <label htmlFor="poll_interval">폴링 간격 (초)</label>
              <input
                type="number"
                id="poll_interval"
                name="poll_interval"
                value={formData.poll_interval}
                onChange={handleChange}
                min={30}
                max={3600}
              />
            </div>
          </div>

          {snmpVersion === '3' ? (
            <div className="snmp-v3-section">
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="username">사용자명 *</label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    placeholder="SNMPv3 사용자명"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="security_level">보안 레벨</label>
                  <select
                    id="security_level"
                    name="security_level"
                    value={securityLevel}
                    onChange={handleSecurityLevelChange}
                  >
                    <option value="noAuthNoPriv">noAuthNoPriv</option>
                    <option value="authNoPriv">authNoPriv</option>
                    <option value="authPriv">authPriv</option>
                  </select>
                </div>
              </div>

              {securityLevel !== 'noAuthNoPriv' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="auth_protocol">인증 프로토콜 *</label>
                    <select
                      id="auth_protocol"
                      name="auth_protocol"
                      value={formData.auth_protocol}
                      onChange={handleChange}
                      required
                    >
                      <option value="MD5">MD5</option>
                      <option value="SHA">SHA</option>
                      <option value="SHA-256">SHA-256</option>
                      <option value="SHA-384">SHA-384</option>
                      <option value="SHA-512">SHA-512</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="auth_password">인증 비밀번호 *</label>
                    <input
                      type="password"
                      id="auth_password"
                      name="auth_password"
                      value={formData.auth_password}
                      onChange={handleChange}
                      required
                      minLength={8}
                      placeholder="최소 8자 이상"
                    />
                  </div>
                </div>
              )}

              {securityLevel === 'authPriv' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="priv_protocol">프라이버시 프로토콜 *</label>
                    <select
                      id="priv_protocol"
                      name="priv_protocol"
                      value={formData.priv_protocol}
                      onChange={handleChange}
                      required
                    >
                      <option value="DES">DES</option>
                      <option value="AES">AES</option>
                      <option value="AES-128">AES-128</option>
                      <option value="AES-192">AES-192</option>
                      <option value="AES-256">AES-256</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="priv_password">프라이버시 비밀번호 *</label>
                    <input
                      type="password"
                      id="priv_password"
                      name="priv_password"
                      value={formData.priv_password}
                      onChange={handleChange}
                      required
                      minLength={8}
                      placeholder="최소 8자 이상"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="community">커뮤니티 문자열</label>
              <input
                type="text"
                id="community"
                name="community"
                value={formData.community}
                onChange={handleChange}
                placeholder="기본값: public"
              />
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/devices')}>
            취소
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '저장 중...' : isEditMode ? '장비 수정' : '장비 추가'}
          </button>
        </div>
      </form>
    </div>
  );
};

