import React, { useEffect, useState } from 'react';
import apiService from '../services/api';
import './AI.css';

interface Analysis {
  id: number;
  deviceId?: number;
  device_id?: number;
  type?: string;
  analysisType?: string;
  result: any;
  createdAt?: string;
  created_at?: string;
  device?: {
    name: string;
    ipAddress?: string;
    ip_address?: string;
  };
}

export const AI: React.FC = () => {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    loadDevices();
    loadAnalyses();
  }, [page, selectedDevice]);

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

  const loadAnalyses = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit: 20,
      };
      if (selectedDevice) params.deviceId = selectedDevice;

      const response = await apiService.getAnalysisHistory(params);
      if (response.success) {
        setAnalyses(response.data.analyses || []);
        setTotalPages(response.data.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to load analyses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (deviceId: number) => {
    setAnalyzing(true);
    try {
      await apiService.analyzeDevice(deviceId);
      loadAnalyses();
    } catch (error) {
      console.error('Failed to analyze device:', error);
      alert('분석에 실패했습니다.');
    } finally {
      setAnalyzing(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      alarm_rca: '알람 근본 원인 분석',
      prediction: '예측 분석',
      daily_report: '일일 리포트',
      weekly_report: '주간 리포트',
      anomaly_detection: '이상 탐지',
    };
    return labels[type] || type;
  };

  const formatAnalysisResult = (result: any, type: string): React.ReactNode => {
    // result가 문자열이면 JSON 파싱 시도
    let parsedResult = result;
    if (typeof result === 'string') {
      try {
        parsedResult = JSON.parse(result);
      } catch (e) {
        // JSON이 아니면 그대로 표시
        return <pre className="analysis-result-text">{result}</pre>;
      }
    }
    
    // parsedResult가 null이거나 undefined면 기본 JSON 표시
    if (!parsedResult || typeof parsedResult !== 'object') {
      return (
        <pre className="analysis-result-json">
          {JSON.stringify(result, null, 2)}
        </pre>
      );
    }

    // Prediction 타입 처리 - 요약만 표시
    if (type === 'prediction') {
      return (
        <div className="analysis-result-formatted">
          {/* 요약만 표시 */}
          {parsedResult.summary && (
            <div className="result-section summary-only">
              <p className="result-text summary-text">{parsedResult.summary}</p>
            </div>
          )}
          {!parsedResult.summary && (
            <div className="result-section">
              <p className="result-text">분석 요약이 없습니다.</p>
            </div>
          )}
        </div>
      );
    }

    // Alarm RCA 타입 처리
    if (type === 'alarm_rca') {
      return (
        <div className="analysis-result-formatted">
          {parsedResult.root_cause && (
            <div className="result-section">
              <h4 className="section-title">🔍 근본 원인</h4>
              <p className="result-text">{parsedResult.root_cause}</p>
            </div>
          )}
          {parsedResult.contributing_factors && parsedResult.contributing_factors.length > 0 && (
            <div className="result-section">
              <h4 className="section-title">📌 기여 요인</h4>
              <ul className="factors-list">
                {parsedResult.contributing_factors.map((factor: string, idx: number) => (
                  <li key={idx}>{factor}</li>
                ))}
              </ul>
            </div>
          )}
          {parsedResult.immediate_actions && parsedResult.immediate_actions.length > 0 && (
            <div className="result-section">
              <h4 className="section-title">⚡ 즉시 조치</h4>
              <ol className="actions-list">
                {parsedResult.immediate_actions.map((action: string, idx: number) => (
                  <li key={idx}>{action}</li>
                ))}
              </ol>
            </div>
          )}
          {parsedResult.long_term_recommendations && parsedResult.long_term_recommendations.length > 0 && (
            <div className="result-section">
              <h4 className="section-title">🛡️ 장기 권장사항</h4>
              <ul className="recommendations-list">
                {parsedResult.long_term_recommendations.map((rec: string, idx: number) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    // Daily Report 타입 처리
    if (type === 'daily_report') {
      return (
        <div className="analysis-result-formatted">
          {parsedResult.summary && (
            <div className="result-section">
              <h4 className="section-title">📋 요약</h4>
              <p className="result-text">{parsedResult.summary}</p>
            </div>
          )}
          {parsedResult.highlights && parsedResult.highlights.length > 0 && (
            <div className="result-section">
              <h4 className="section-title">✨ 하이라이트</h4>
              <ul className="highlights-list">
                {parsedResult.highlights.map((highlight: string, idx: number) => (
                  <li key={idx}>{highlight}</li>
                ))}
              </ul>
            </div>
          )}
          {parsedResult.concerns && parsedResult.concerns.length > 0 && (
            <div className="result-section">
              <h4 className="section-title">⚠️ 우려사항</h4>
              <ul className="concerns-list">
                {parsedResult.concerns.map((concern: string, idx: number) => (
                  <li key={idx}>{concern}</li>
                ))}
              </ul>
            </div>
          )}
          {parsedResult.recommendations && parsedResult.recommendations.length > 0 && (
            <div className="result-section">
              <h4 className="section-title">💡 권장사항</h4>
              <ul className="recommendations-list">
                {parsedResult.recommendations.map((rec: string, idx: number) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    // 기본: JSON 표시
    return (
      <pre className="analysis-result-json">
        {JSON.stringify(parsedResult, null, 2)}
      </pre>
    );
  };

  return (
    <div className="ai-page">
      <div className="page-header">
        <h1 className="page-title">AI 분석</h1>
        <div className="ai-controls">
          <select
            value={selectedDevice || ''}
            onChange={(e) => {
              setSelectedDevice(e.target.value ? parseInt(e.target.value) : null);
              setPage(1);
            }}
            className="device-select"
          >
            <option value="">모든 장비</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name} ({device.ipAddress})
              </option>
            ))}
          </select>
          {selectedDevice && (
            <button
              className="analyze-btn"
              onClick={() => handleAnalyze(selectedDevice)}
              disabled={analyzing}
            >
              {analyzing ? '분석 중...' : 'AI 분석 실행'}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading">로딩 중...</div>
      ) : (
        <>
          <div className="analyses-list">
            {analyses.length === 0 ? (
              <div className="empty-state">분석 결과가 없습니다.</div>
            ) : (
              analyses.map((analysis) => {
                const analysisType = analysis.type || analysis.analysisType || 'prediction';
                const deviceId = analysis.deviceId || analysis.device_id;
                const createdAt = analysis.createdAt || analysis.created_at;
                const ipAddress = analysis.device?.ipAddress || analysis.device?.ip_address;
                
                return (
                  <div key={analysis.id} className="analysis-card">
                    <div className="analysis-header">
                      <div>
                        <h3>{getTypeLabel(analysisType)}</h3>
                        <p className="analysis-device">
                          {analysis.device?.name || `Device ID: ${deviceId}`} (
                          {ipAddress || 'N/A'})
                        </p>
                      </div>
                      <span className="analysis-date">
                        {createdAt ? new Date(createdAt).toLocaleString('ko-KR') : 'N/A'}
                      </span>
                    </div>
                    <div className="analysis-content">
                      {formatAnalysisResult(analysis.result, analysisType)}
                    </div>
                  </div>
                );
              })
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

