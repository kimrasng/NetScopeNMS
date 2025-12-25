// 간단한 테스트 버전 - 패키지 설치 전 확인용
import React from 'react';

function App() {
  return (
    <div style={{
      padding: '40px',
      backgroundColor: '#1a1d29',
      color: '#e4e7eb',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ color: '#4a9eff', marginBottom: '20px' }}>NetScopeNMS</h1>
      <p style={{ marginBottom: '20px' }}>프론트엔드가 로드되었습니다!</p>
      <div style={{
        padding: '20px',
        backgroundColor: '#232630',
        borderRadius: '8px',
        border: '1px solid #3a3f4f'
      }}>
        <h2 style={{ marginBottom: '15px' }}>다음 단계:</h2>
        <ol style={{ lineHeight: '1.8' }}>
          <li>터미널에서 <code style={{ backgroundColor: '#2b2f3e', padding: '2px 6px', borderRadius: '4px' }}>cd frontend</code> 실행</li>
          <li><code style={{ backgroundColor: '#2b2f3e', padding: '2px 6px', borderRadius: '4px' }}>npm install</code> 실행</li>
          <li>설치 완료 후 개발 서버 재시작</li>
        </ol>
      </div>
      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#dc3545', borderRadius: '4px', color: 'white' }}>
        ⚠️ 패키지가 설치되지 않아 일부 기능이 작동하지 않을 수 있습니다.
      </div>
    </div>
  );
}

export default App;

