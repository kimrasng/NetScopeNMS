# NetScopeNMS Frontend

NetScopeNMS의 프론트엔드 애플리케이션입니다. Zabbix/LibreNMS 스타일의 다크 테마 네트워크 모니터링 인터페이스를 제공합니다.

## 기술 스택

- **React 19** - UI 라이브러리
- **TypeScript** - 타입 안정성
- **Vite** - 빌드 도구
- **React Router** - 라우팅
- **Axios** - HTTP 클라이언트
- **Recharts** - 차트 라이브러리

## 주요 기능

- 📊 **대시보드** - 전체 시스템 요약 및 통계
- 🖥️ **장비 관리** - 네트워크 장비 목록, 추가, 수정, 삭제
- 📈 **메트릭** - CPU, 메모리, 트래픽 등 실시간 그래프
- 🚨 **알람** - 알람 목록, 확인, 해결
- 🤖 **AI 분석** - AI 기반 분석 결과 조회
- 👥 **사용자 관리** - 사용자 관리 (관리자 전용)

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속하세요.

### 4. 프로덕션 빌드

```bash
npm run build
```

빌드된 파일은 `dist` 디렉토리에 생성됩니다.

## 프로젝트 구조

```
src/
├── components/          # 재사용 가능한 컴포넌트
│   ├── Layout.tsx       # 메인 레이아웃
│   └── ProtectedRoute.tsx  # 인증 보호 라우트
├── contexts/            # React Context
│   └── AuthContext.tsx # 인증 컨텍스트
├── pages/               # 페이지 컴포넌트
│   ├── Dashboard.tsx    # 대시보드
│   ├── Devices.tsx      # 장비 관리
│   ├── Metrics.tsx      # 메트릭
│   ├── Alarms.tsx       # 알람
│   ├── AI.tsx           # AI 분석
│   ├── Users.tsx        # 사용자 관리
│   └── Login.tsx        # 로그인
├── services/            # API 서비스
│   └── api.ts           # API 클라이언트
├── App.tsx              # 메인 앱 컴포넌트
└── main.tsx             # 진입점
```

## 디자인

Zabbix와 LibreNMS에서 영감을 받은 다크 테마 디자인을 사용합니다:

- **주요 색상**: 다크 블루/그레이 톤 (#1a1d29, #232630, #2b2f3e)
- **강조 색상**: 블루 (#4a9eff)
- **상태 색상**: 
  - 성공: 그린 (#28a745)
  - 경고: 옐로우 (#ffc107)
  - 위험: 레드 (#dc3545)
  - 정보: 시안 (#17a2b8)

## API 연동

모든 API 호출은 `src/services/api.ts`에서 관리됩니다. 백엔드 API와 통신하며 JWT 토큰을 사용한 인증을 지원합니다.

## 라이선스

프로젝트의 라이선스를 따릅니다.
