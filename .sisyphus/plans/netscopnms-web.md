# NetScopeNMS Web Frontend (React + Vite SPA)

## TL;DR

> **Quick Summary**: NetScopeNMS의 기존 Fastify API 서버에 연결하는 React + Vite SPA 웹 프론트엔드를 `apps/web-vite` 디렉토리에 신규 구축한다. 기존 `apps/web` (Next.js 14)과 별도로, shadcn/ui + Tailwind, Redux Toolkit, TanStack Query, Socket.IO 클라이언트를 사용하며 8개 주요 화면을 구현한다.
>
> **Deliverables**:
> - `apps/web-vite` — Vite + React 18 SPA 프로젝트 (Yarn workspaces + Turborepo monorepo 내)
> - 8개 화면: 로그인, 대시보드, 디바이스 관리, 토폴로지 맵, 인시던트/알림, 트래픽/성능 모니터링, AI 분석, 설정/관리
> - Socket.IO 실시간 연동 (incident:updated, incident:comment, notification)
> - RBAC 라우트 가드 (super_admin / admin / operator / viewer)
>
> **Estimated Effort**: Large (3-5주)
> **Parallel Execution**: YES — 5 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 8 → Task 14 → Task 19 → F1-F4

---

## Context

### Original Request
API 서버를 보고 웹을 제작하려고 한다.

### Interview Summary
**Key Discussions**:
- 프레임워크: React + Vite (SPA) — Next.js 아님, `apps/web-vite` 별도 디렉토리
- 패키지 매니저: Yarn (monorepo는 Yarn workspaces + Turborepo 사용 중)
- UI: shadcn/ui + Tailwind CSS
- 상태관리: Redux Toolkit (auth + socket 전용) + TanStack Query (서버 상태)
- AI 기능 포함: NL 쿼리, 인시던트 AI 채팅, RCA 생성
- 필요 화면: 디바이스 관리, 토폴로지 맵, 알림/이벤트, 트래픽/성능 모니터링, 설정/관리, 로그인/인증

**Research Findings**:
- API: 16개 라우트 모듈, JWT 인증, 4개 RBAC 역할, scope 기반 접근 제어
- 실시간: Socket.IO at `/ws`, 이벤트 3종 (incident:updated, incident:comment, notification)
- DB: 20개 테이블, TimescaleDB 시계열 메트릭, ReactFlow topology_positions 저장
- Docker compose에 web 컨테이너 정의됨 (README 기준 Next.js 계획이나 `apps/web` 미구현 상태, web-vite는 별도 포트 사용)
  - `apps/web` 디렉토리는 현재 존재하지 않음 — 충돌 없음

### Gap Analysis (Oracle Review)
**Identified Gaps** (addressed):
- JWT 저장 방식: localStorage 사용 (API가 httpOnly 쿠키 미사용 확인)
- Redux 범위 명확화: auth + socket 상태만, 나머지는 TanStack Query
- 커스텀 대시보드 편집: v1에서는 위젯 렌더링만, 드래그 편집은 제외
- 토폴로지: 위치 저장/불러오기만, 링크 편집 없음
- AI 채팅: 단순 텍스트 입출력, 스트리밍 없음

---

## Work Objectives

### Core Objective
기존 NetScopeNMS API 서버에 연결하는 완전한 웹 프론트엔드 SPA를 `apps/web-vite`에 구축한다. 기존 `apps/web` (Next.js 14)은 건드리지 않는다. 네트워크 운영자가 디바이스 상태 모니터링, 인시던트 대응, 성능 분석을 웹 브라우저에서 수행할 수 있게 한다.

### Concrete Deliverables
- `apps/web-vite` — Vite React SPA 프로젝트
- `apps/web-vite/src/pages/` — 8개 페이지 컴포넌트
- `apps/web-vite/src/store/` — Redux slices (auth, socket)
- `apps/web-vite/src/api/` — TanStack Query hooks (16개 API 모듈 대응)
- `apps/web-vite/src/components/` — 재사용 UI 컴포넌트
- `apps/web-vite/.env.example` — 환경변수 템플릿

### Definition of Done
- [ ] `yarn workspace @netpulse/web-vite dev` 실행 시 로그인 화면 표시
- [ ] JWT 로그인 후 대시보드 접근 가능
- [ ] 디바이스 목록 API 데이터 렌더링
- [ ] Socket.IO 연결 후 실시간 알림 수신
- [ ] 4개 역할별 라우트 가드 동작

### Must Have
- JWT 인증 + 자동 토큰 갱신 (401 인터셉터)
- RBAC 라우트 가드 (4개 역할)
- Socket.IO 실시간 연동
- 모든 API 엔드포인트 TanStack Query 연동
- 로딩/에러/빈 상태 처리 (스켈레톤 로더 통일)
- 반응형: 데스크탑 우선 (1280px+), 태블릿 지원 (768px+)

### Must NOT Have (Guardrails)
- 커스텀 컴포넌트 라이브러리 추상화 레이어 금지 (shadcn/ui 직접 사용)
- Redux에 서버 상태 저장 금지 (auth + socket만)
- 커스텀 대시보드 드래그 편집 금지 (v1 제외)
- 토폴로지 링크/노드 편집 금지 (위치 저장만)
- AI 스트리밍/대화 분기 금지 (단순 요청-응답만)
- `as any` / `@ts-ignore` 금지
- 불필요한 useEffect 체이닝 금지
- 주석은 "왜"만, "무엇"은 금지

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: NO (신규 프로젝트)
- **Automated tests**: NO (v1 범위 제외)
- **Agent-Executed QA**: ALWAYS (모든 태스크 필수)

### QA Policy
- **Frontend/UI**: Playwright — 브라우저 실행, DOM 검증, 스크린샷
- **API 연동**: Bash (curl) — 실제 API 호출 검증
- **빌드**: Bash — `yarn workspace @netpulse/web-vite build` 성공 여부

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (즉시 시작 — 기반 설정):
├── Task 1: 프로젝트 스캐폴딩 + Vite 설정 [quick]
├── Task 2: 타입 정의 + API 클라이언트 기반 [quick]
└── Task 3: Redux store + Auth slice + Socket slice [quick]

Wave 2 (Wave 1 완료 후 — 인증 + 레이아웃):
├── Task 4: 로그인 페이지 + JWT 인증 플로우 [visual-engineering]
├── Task 5: 앱 레이아웃 + 사이드바 + 라우트 가드 [visual-engineering]
└── Task 6: TanStack Query 설정 + API hooks 기반 [quick]

Wave 3 (Wave 2 완료 후 — 핵심 화면):
├── Task 7: 대시보드 페이지 (요약 통계, 차트, 최근 알림) [visual-engineering]
├── Task 8: 디바이스 목록 + 상세 페이지 [visual-engineering]
├── Task 9: 인시던트/알림 목록 + 상세 + 실시간 업데이트 [visual-engineering]
└── Task 10: Socket.IO 클라이언트 + 실시간 알림 토스트 [unspecified-high]

Wave 4 (Wave 3 완료 후 — 고급 화면):
├── Task 11: 토폴로지 맵 (ReactFlow + 위치 저장) [visual-engineering]
├── Task 12: 트래픽/성능 모니터링 (Recharts 시계열) [visual-engineering]
├── Task 13: AI 분석 페이지 (NL 쿼리, 인시던트 채팅, RCA) [visual-engineering]
└── Task 14: 설정/관리 페이지 (사용자, 알림채널, 알림규칙, 유지보수) [visual-engineering]

Wave 5 (Wave 4 완료 후 — 마무리):
├── Task 15: 보고서 페이지 [visual-engineering]
├── Task 16: 감사 로그 + 설정 스냅샷 페이지 [visual-engineering]
├── Task 17: 환경변수 + Docker 통합 + 빌드 최적화 [quick]
└── Task 18: 전체 에러 바운더리 + 로딩 상태 통일 [unspecified-high]

Wave FINAL (전체 완료 후 — 4개 병렬 검토):
├── F1: Plan Compliance Audit (oracle)
├── F2: Code Quality Review (unspecified-high)
├── F3: Real Manual QA (unspecified-high + playwright)
└── F4: Scope Fidelity Check (deep)
→ 결과 취합 → 사용자 승인

Critical Path: T1 → T2 → T3 → T4 → T5 → T7 → T9 → T10 → T11 → F1-F4
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 4 (Wave 3 & 4)
```

### Agent Dispatch Summary
- **Wave 1**: 3 tasks → T1-T3 `quick`
- **Wave 2**: 3 tasks → T4-T5 `visual-engineering`, T6 `quick`
- **Wave 3**: 4 tasks → T7-T9 `visual-engineering`, T10 `unspecified-high`
- **Wave 4**: 4 tasks → T11-T14 `visual-engineering`
- **Wave 5**: 4 tasks → T15-T16 `visual-engineering`, T17 `quick`, T18 `unspecified-high`
- **FINAL**: 4 tasks → F1 `oracle`, F2 `unspecified-high`, F3 `unspecified-high`+`playwright`, F4 `deep`

---

## TODOs

- [ ] 1. 프로젝트 스캐폴딩 + Vite 설정

  **What to do**:
  - `apps/web-vite` 디렉토리에 `yarn create vite . --template react-ts` 실행
  - `apps/web-vite/package.json`: name을 `@netpulse/web-vite`로 설정
  - 루트 `package.json` workspaces 배열에 `"apps/web-vite"` 추가
  - `turbo.json`에 `web-vite#dev`, `web-vite#build` 태스크 추가
  - `vite.config.ts`: proxy 설정 (`/api` → `VITE_API_URL`, `/ws` → WebSocket proxy)
  - `tailwind.config.ts` + `postcss.config.js` 설정
  - shadcn/ui 초기화: `npx shadcn-ui@latest init` (style: default, baseColor: slate)
  - `tsconfig.json`: strict mode, path alias `@/` → `src/`
  - `apps/web-vite/.env.example`: `VITE_API_URL=http://localhost:4000`, `VITE_WS_URL=http://localhost:4000`
  - `apps/web-vite/package.json` 의존성 추가: react-router-dom, @reduxjs/toolkit, react-redux, @tanstack/react-query, socket.io-client, recharts, reactflow, axios, date-fns, lucide-react, react-hook-form, zod, @hookform/resolvers

  **Must NOT do**:
  - 기존 `apps/web` (Next.js) 수정 금지
  - Next.js, SSR 관련 설정 추가 금지
  - 커스텀 컴포넌트 라이브러리 디렉토리 생성 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (단독 선행)
  - **Blocks**: Task 2, 3, 4, 5, 6
  - **Blocked By**: None

  **References**:
  - `package.json` (루트) — workspaces 배열 패턴 확인
  - `turbo.json` — 태스크 파이프라인 패턴 확인
  - `docker-compose.yml` — API 포트 확인 (4000)
  - `.env.example` (루트) — 환경변수 키 확인
  - `apps/web/package.json` — 기존 web 앱이 존재할 경우 이름 충돌 방지 참고 (없으면 무시)

  **Acceptance Criteria**:
  - [ ] `apps/web-vite/` 디렉토리 생성됨
  - [ ] `yarn workspace @netpulse/web-vite dev` 실행 시 Vite dev server 시작 (포트 5173)
  - [ ] `yarn workspace @netpulse/web-vite build` 에러 없이 성공
  - [ ] 기존 monorepo 빌드 영향 없음

  **QA Scenarios**:
  ```
  Scenario: Vite dev server 정상 시작
    Tool: Bash
    Steps:
      1. cd apps/web-vite && yarn dev &
      2. sleep 3 && curl -s http://localhost:5173 | grep -c "<!DOCTYPE html"
    Expected Result: 1 (HTML 응답 확인)
    Evidence: .sisyphus/evidence/task-1-vite-start.txt

  Scenario: 빌드 성공
    Tool: Bash
    Steps:
      1. yarn workspace @netpulse/web-vite build 2>&1
    Expected Result: "built in" 포함, exit code 0
    Evidence: .sisyphus/evidence/task-1-build.txt

  Scenario: 기존 monorepo 빌드 영향 없음
    Tool: Bash
    Steps:
      1. yarn build 2>&1 | tail -10
    Expected Result: 기존 패키지 빌드 성공 (에러 없음)
    Evidence: .sisyphus/evidence/task-1-existing-build.txt
  ```

  **Commit**: YES (Wave 1 완료 시)
  - Message: `feat(web-vite): scaffold vite react project with base config`

- [ ] 2. 타입 정의 + API 클라이언트 기반

  **What to do**:
  - `src/types/api.ts`: API 응답 타입 정의
    - `Device`, `Interface`, `Metric`, `Incident`, `IncidentEvent`, `AlertRule`
    - `User`, `Dashboard`, `DashboardWidget`, `NotificationChannel`
    - `Report`, `AuditLog`, `ConfigSnapshot`, `MaintenanceWindow`, `ApiKey`
    - `PaginatedResponse<T>`, `ApiError` 공통 타입
  - `src/types/enums.ts`: 열거형 — `DeviceType`, `DeviceStatus`, `Severity`, `IncidentStatus`, `UserRole`, `NotificationChannelType`
  - `src/lib/axios.ts`: axios 인스턴스 생성
    - baseURL: `import.meta.env.VITE_API_URL`
    - 요청 인터셉터: localStorage에서 JWT 읽어 `Authorization: Bearer` 헤더 추가
    - 응답 인터셉터: 401 → localStorage 토큰 삭제 → `/login` 리다이렉트
  - `src/lib/queryClient.ts`: TanStack Query QueryClient 설정 (staleTime: 30s, retry: 2)

  **Must NOT do**:
  - `as any` 사용 금지
  - 타입을 추측으로 작성 금지 — 반드시 API 라우트 파일 참조

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Task 3과 병렬)
  - **Parallel Group**: Wave 1 (Task 3과 함께)
  - **Blocks**: Task 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14
  - **Blocked By**: Task 1

  **References**:
  - `apps/api/src/routes/devices.ts` — Device 응답 형태
  - `apps/api/src/routes/incidents.ts` — Incident 응답 형태
  - `apps/api/src/routes/auth.ts` — 로그인 응답 (JWT 구조)
  - `packages/shared/src/schema/index.ts` — DB 스키마 (타입의 원천)

  **Acceptance Criteria**:
  - [ ] `src/types/api.ts` 생성, TypeScript 컴파일 에러 없음
  - [ ] `src/lib/axios.ts` 생성, 401 인터셉터 포함
  - [ ] `yarn workspace @netpulse/web-vite build` 타입 에러 없음

  **QA Scenarios**:
  ```
  Scenario: axios 인스턴스 baseURL 설정 확인
    Tool: Bash
    Steps:
      1. cd apps/web-vite && grep -r "VITE_API_URL" src/lib/axios.ts
    Expected Result: import.meta.env.VITE_API_URL 참조 확인
    Evidence: .sisyphus/evidence/task-2-axios-config.txt

  Scenario: TypeScript 타입 컴파일 확인
    Tool: Bash
    Steps:
      1. cd apps/web-vite && npx tsc --noEmit 2>&1
    Expected Result: 에러 없음 (exit code 0)
    Evidence: .sisyphus/evidence/task-2-tsc.txt
  ```

  **Commit**: YES (Wave 1 완료 시 Task 1, 3과 함께)

- [ ] 3. Redux store + Auth slice + Socket slice

  **What to do**:
  - `src/store/index.ts`: Redux store 설정 (`configureStore`)
  - `src/store/authSlice.ts`:
    - state: `{ user: User | null, token: string | null, isAuthenticated: boolean }`
    - actions: `setCredentials(user, token)`, `logout()`
    - localStorage 동기화 (token 저장/삭제)
  - `src/store/socketSlice.ts`:
    - state: `{ connected: boolean, lastNotification: NotificationPayload | null }`
    - actions: `setConnected(boolean)`, `setLastNotification(payload)`
  - `src/hooks/useAppDispatch.ts`, `src/hooks/useAppSelector.ts` — 타입된 훅

  **Must NOT do**:
  - 서버 상태(디바이스 목록, 인시던트 등) Redux에 저장 금지
  - Redux에 3개 이상 slice 추가 금지 (auth + socket만)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Task 2와 병렬)
  - **Parallel Group**: Wave 1 (Task 2와 함께)
  - **Blocks**: Task 4, 5, 10
  - **Blocked By**: Task 1

  **References**:
  - `apps/api/src/routes/auth.ts` — 로그인 응답 구조 (user 객체 필드)
  - `apps/api/src/types.ts` — JWT payload 구조

  **Acceptance Criteria**:
  - [ ] `src/store/` 디렉토리 생성
  - [ ] auth slice: setCredentials, logout 액션 동작
  - [ ] socket slice: connected 상태 관리
  - [ ] `yarn workspace @netpulse/web-vite build` 에러 없음

  **QA Scenarios**:
  ```
  Scenario: Redux store 초기 상태 확인
    Tool: Bash
    Steps:
      1. cd apps/web-vite && npx tsc --noEmit 2>&1
    Expected Result: 타입 에러 없음
    Evidence: .sisyphus/evidence/task-3-store-types.txt
  ```

  **Commit**: YES (Wave 1 완료 시 Task 1, 2와 함께)

- [ ] 4. 로그인 페이지 + JWT 인증 플로우

  **What to do**:
  - `src/pages/LoginPage.tsx`: 로그인 폼 (email, password)
    - shadcn/ui: `Card`, `Input`, `Button`, `Label`, `Form` 사용
    - react-hook-form + zod 유효성 검사
    - 제출 시 `POST /api/auth/login` 호출
    - 성공: JWT + user 정보 → Redux authSlice.setCredentials → `/dashboard` 리다이렉트
    - 실패: 에러 메시지 표시 (shadcn `Alert`)
  - `src/pages/SetupPage.tsx`: 초기 설정 마법사 (간단한 안내 + `/api/setup` 연동)
  - 이미 로그인된 경우 `/login` 접근 시 `/dashboard`로 리다이렉트

  **Must NOT do**:
  - httpOnly 쿠키 방식 사용 금지 (localStorage JWT 방식 유지)
  - 소셜 로그인 버튼 추가 금지 (v1 제외)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Task 5와 병렬)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 7, 8, 9
  - **Blocked By**: Task 1, 2, 3

  **References**:
  - `apps/api/src/routes/auth.ts` — `POST /api/auth/login` 요청/응답 형태
  - `apps/api/src/routes/setup.ts` — 설정 마법사 엔드포인트

  **Acceptance Criteria**:
  - [ ] 로그인 폼 렌더링
  - [ ] 잘못된 자격증명 시 에러 메시지 표시
  - [ ] 성공 시 `/dashboard` 리다이렉트

  **QA Scenarios**:
  ```
  Scenario: 로그인 성공 플로우
    Tool: Playwright
    Preconditions: API 서버 실행 중, 테스트 계정 존재
    Steps:
      1. page.goto('http://localhost:5173/login')
      2. page.fill('input[name="email"]', 'admin@test.com')
      3. page.fill('input[name="password"]', 'password123')
      4. page.click('button[type="submit"]')
      5. page.waitForURL('**/dashboard', {timeout: 5000})
      6. expect(page.url()).toContain('/dashboard')
    Expected Result: /dashboard URL로 이동
    Evidence: .sisyphus/evidence/task-4-login-success.png

  Scenario: 잘못된 자격증명 에러 표시
    Tool: Playwright
    Steps:
      1. page.goto('http://localhost:5173/login')
      2. page.fill('input[name="email"]', 'wrong@test.com')
      3. page.fill('input[name="password"]', 'wrongpass')
      4. page.click('button[type="submit"]')
      5. page.waitForSelector('[role="alert"]', {timeout: 3000})
    Expected Result: 에러 Alert 컴포넌트 표시
    Evidence: .sisyphus/evidence/task-4-login-error.png
  ```

  **Commit**: YES (Wave 2 완료 시)

- [ ] 5. 앱 레이아웃 + 사이드바 + 라우트 가드

  **What to do**:
  - `src/components/layout/AppLayout.tsx`: 전체 레이아웃 (사이드바 + 메인 콘텐츠)
  - `src/components/layout/Sidebar.tsx`: 네비게이션 사이드바
    - 메뉴: 대시보드, 디바이스, 인시던트, 토폴로지, 메트릭, AI 분석, 보고서, 설정
    - 역할별 메뉴 표시/숨김 (viewer는 설정 메뉴 숨김)
    - 실시간 알림 배지 (socketSlice.lastNotification 기반)
  - `src/components/layout/Header.tsx`: 상단 헤더 (사용자 정보, 로그아웃)
  - `src/components/auth/ProtectedRoute.tsx`: 라우트 가드
    - 미인증 → `/login` 리다이렉트
    - 역할 부족 → 403 페이지
    - props: `allowedRoles?: UserRole[]`
  - `src/router/index.tsx`: react-router-dom v6 라우트 설정
    - `/login`, `/setup` — 공개
    - `/dashboard`, `/devices`, `/incidents`, `/topology`, `/metrics`, `/ai`, `/reports`, `/settings/*` — 보호됨

  **Must NOT do**:
  - 중첩 레이아웃 4단계 이상 금지
  - 각 페이지에 개별 auth 체크 금지 (ProtectedRoute 단일 사용)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Task 4와 병렬)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 7, 8, 9, 10, 11, 12, 13, 14
  - **Blocked By**: Task 1, 2, 3

  **References**:
  - `apps/api/src/routes/auth.ts` — UserRole 열거형 값
  - `packages/shared/src/schema/index.ts` — user_role enum

  **Acceptance Criteria**:
  - [ ] 사이드바 렌더링, 모든 메뉴 링크 동작
  - [ ] 미인증 상태에서 `/dashboard` 접근 시 `/login` 리다이렉트
  - [ ] viewer 역할로 로그인 시 설정 메뉴 숨김

  **QA Scenarios**:
  ```
  Scenario: 미인증 라우트 가드 동작
    Tool: Playwright
    Steps:
      1. page.goto('http://localhost:5173/dashboard')
      2. page.waitForURL('**/login', {timeout: 3000})
    Expected Result: /login으로 리다이렉트
    Evidence: .sisyphus/evidence/task-5-route-guard.png

  Scenario: 사이드바 네비게이션 동작
    Tool: Playwright
    Preconditions: admin 계정으로 로그인
    Steps:
      1. page.click('a[href="/devices"]')
      2. expect(page.url()).toContain('/devices')
      3. page.click('a[href="/incidents"]')
      4. expect(page.url()).toContain('/incidents')
    Expected Result: 각 링크 클릭 시 해당 URL로 이동
    Evidence: .sisyphus/evidence/task-5-sidebar-nav.png
  ```

  **Commit**: YES (Wave 2 완료 시 Task 4와 함께)

- [ ] 6. TanStack Query 설정 + API hooks 기반

  **What to do**:
  - `src/api/devices.ts`: `useDevices()`, `useDevice(id)`, `useDeviceInterfaces(id)` hooks
  - `src/api/incidents.ts`: `useIncidents()`, `useIncident(id)`, `useAcknowledgeIncident()`, `useResolveIncident()`
  - `src/api/metrics.ts`: `useMetrics(deviceId, metricName, from, to, bucket)` hook
  - `src/api/dashboard.ts`: `useDashboardSummary()`, `useTopDevices()`, `useRecentAlerts()`, `useThroughputChart()`
  - `src/api/alertRules.ts`: `useAlertRules()`, `useCreateAlertRule()`, `useUpdateAlertRule()`, `useDeleteAlertRule()`
  - `src/api/notifications.ts`: `useNotificationChannels()`, `useCreateChannel()`, `useUpdateChannel()`
  - `src/api/users.ts`: `useUsers()`, `useInviteUser()`, `useUpdateUser()`
  - `src/api/ai.ts`: `useAiQuery()`, `useAiIncidentChat()`, `useAiRca()`
  - `src/api/reports.ts`: `useReports()`, `useGenerateReport()`
  - `src/api/topology.ts`: `useTopologyPositions()`, `useSaveTopologyPositions()`
  - `src/api/maintenanceWindows.ts`: `useMaintenanceWindows()`, `useCreateMaintenanceWindow()`
  - `src/api/auditLogs.ts`: `useAuditLogs()`
  - `src/api/configSnapshots.ts`: `useConfigSnapshots(deviceId)`, `useConfigSnapshotDiff(id1, id2)`
  - `src/api/apiKeys.ts`: `useApiKeys()`, `useCreateApiKey()`, `useDeleteApiKey()`

  **Must NOT do**:
  - 서버 상태를 Redux에 복사 금지
  - 수동 fetch 사용 금지 (모두 TanStack Query 통해서)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Task 4, 5와 병렬)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 7, 8, 9, 11, 12, 13, 14, 15, 16
  - **Blocked By**: Task 1, 2

  **References**:
  - `apps/api/src/routes/` — 각 라우트 파일의 엔드포인트 URL, 쿼리 파라미터, 응답 형태
  - `apps/api/src/index.ts` — 라우트 prefix 확인

  **Acceptance Criteria**:
  - [ ] 모든 API hook 파일 생성
  - [ ] `npx tsc --noEmit` 에러 없음
  - [ ] `useDevices()` 실제 API 호출 시 데이터 반환

  **QA Scenarios**:
  ```
  Scenario: API hook 타입 안전성 확인
    Tool: Bash
    Steps:
      1. cd apps/web-vite && npx tsc --noEmit 2>&1
    Expected Result: 에러 없음
    Evidence: .sisyphus/evidence/task-6-tsc.txt
  ```

  **Commit**: YES (Wave 2 완료 시)


- [ ] 7. Dashboard Page

  **What to do**:
  - `src/pages/DashboardPage.tsx`: main dashboard with 4 widget sections
  - Summary stats row: total devices, up/down/warning counts, active incidents (use `useDashboardSummary()`)
  - Throughput chart: Recharts AreaChart, bandwidth in/out over time (use `useThroughputChart()`)
  - Top devices table: sortable by CPU/memory/bandwidth (use `useTopDevices()`)
  - Recent alerts feed: last 10 incidents with severity badge (use `useRecentAlerts()`)
  - Skeleton loaders for all 4 sections while loading
  - Auto-refresh every 30s via TanStack Query refetchInterval

  **Must NOT do**:
  - No custom dashboard widget drag-and-drop (v1 excluded)
  - No Redux for dashboard data

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Tasks 8, 9, 10 with)
  - **Parallel Group**: Wave 3
  - **Blocks**: None (leaf node)
  - **Blocked By**: Task 4, 5, 6

  **References**:
  - `apps/api/src/routes/dashboard.ts` - all 4 endpoints: /summary, /top-devices, /recent-alerts, /throughput
  - `apps/api/src/routes/dashboards.ts` - custom dashboard structure (for future reference only)

  **Acceptance Criteria**:
  - [ ] Dashboard renders 4 sections with real API data
  - [ ] Skeleton loaders shown during fetch
  - [ ] Throughput chart displays line/area graph

  **QA Scenarios**:
  ```
  Scenario: Dashboard loads with real data
    Tool: Playwright
    Preconditions: logged in as admin, API running with seed data
    Steps:
      1. page.goto('http://localhost:5173/dashboard')
      2. page.waitForSelector('[data-testid="summary-stats"]', {timeout: 5000})
      3. page.screenshot({path: '.sisyphus/evidence/task-7-dashboard.png'})
    Expected Result: 4 sections visible, no error states
    Evidence: .sisyphus/evidence/task-7-dashboard.png

  Scenario: Loading skeleton shown
    Tool: Playwright
    Steps:
      1. page.goto('http://localhost:5173/dashboard')
      2. page.waitForSelector('.animate-pulse', {timeout: 1000})
    Expected Result: skeleton loader visible before data loads
    Evidence: .sisyphus/evidence/task-7-skeleton.png
  ```

  **Commit**: YES (Wave 3 complete)

- [ ] 8. Device List + Detail Page

  **What to do**:
  - `src/pages/DevicesPage.tsx`: paginated device list
    - Table: name, IP, type, status badge, group, last polled
    - Search by name/IP, filter by type/status/group
    - Status badge colors: up=green, down=red, warning=yellow, unknown=gray, maintenance=blue
    - Row click -> device detail
  - `src/pages/DeviceDetailPage.tsx`: device detail
    - Header: name, IP, status, vendor, model, OS version
    - Tabs: Overview, Interfaces, Metrics, Config Snapshots
    - Overview: SNMP config summary, location, tags, polling interval
    - Interfaces tab: table of interfaces with speed, status, in/out traffic
    - Metrics tab: mini charts for CPU, memory, bandwidth (last 1h)
    - Config Snapshots tab: list of snapshots with diff viewer
  - Skeleton loaders for all sections

  **Must NOT do**:
  - No inline device editing on detail page (separate edit modal only)
  - No bulk delete in v1

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Tasks 7, 9, 10 with)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Task 4, 5, 6

  **References**:
  - `apps/api/src/routes/devices.ts` - GET /devices (pagination, search, filter), GET /devices/:id, GET /devices/:id/interfaces, GET /devices/:id/metrics
  - `apps/api/src/routes/config-snapshots.ts` - GET /config-snapshots, GET /config-snapshots/:id
  - `packages/shared/src/schema/index.ts` - device_type, device_status enums

  **Acceptance Criteria**:
  - [ ] Device list renders with pagination
  - [ ] Search and filter controls work
  - [ ] Device detail shows all 4 tabs
  - [ ] Interface table shows traffic data

  **QA Scenarios**:
  ```
  Scenario: Device list search
    Tool: Playwright
    Preconditions: logged in, devices exist in DB
    Steps:
      1. page.goto('http://localhost:5173/devices')
      2. page.waitForSelector('table tbody tr', {timeout: 5000})
      3. page.fill('input[placeholder*="search"]', 'router')
      4. page.waitForTimeout(500)
      5. page.screenshot({path: '.sisyphus/evidence/task-8-device-search.png'})
    Expected Result: filtered device list shown
    Evidence: .sisyphus/evidence/task-8-device-search.png

  Scenario: Device detail tabs
    Tool: Playwright
    Steps:
      1. page.goto('http://localhost:5173/devices')
      2. page.click('table tbody tr:first-child')
      3. page.waitForSelector('[role="tablist"]', {timeout: 3000})
      4. page.click('[role="tab"]:has-text("Interfaces")')
      5. page.waitForSelector('table', {timeout: 3000})
    Expected Result: interfaces table visible
    Evidence: .sisyphus/evidence/task-8-device-detail.png
  ```

  **Commit**: YES (Wave 3 complete)

- [ ] 9. Incidents Page + Detail + Realtime Updates

  **What to do**:
  - `src/pages/IncidentsPage.tsx`: incident list
    - Table: title, device, severity badge, status, started at, assigned to
    - Filter by severity/status, search by title/device
    - Status badge: problem=red, acknowledged=yellow, resolved=green
    - Real-time: on `incident:updated` socket event, invalidate TanStack Query cache
  - `src/pages/IncidentDetailPage.tsx`: incident detail
    - Header: title, severity, status, device link, metric value
    - Action buttons: Acknowledge, Resolve (role-based: operator+)
    - AI Analysis button: triggers `POST /api/incidents/:id/ai-analysis`
    - AI RCA section: displays `aiRca` and `aiSummary` when available
    - Timeline: incident events (acknowledged, resolved, comments, AI analysis)
    - Add comment form at bottom
    - Real-time: on `incident:comment` socket event, append to timeline

  **Must NOT do**:
  - No incident creation from UI (incidents are auto-created by alert rules)
  - No bulk acknowledge/resolve in v1

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Tasks 7, 8, 10 with)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Task 4, 5, 6

  **References**:
  - `apps/api/src/routes/incidents.ts` - all endpoints including acknowledge, resolve, ai-analysis, comments
  - `apps/api/src/index.ts` - Socket.IO event names: incident:updated, incident:comment

  **Acceptance Criteria**:
  - [ ] Incident list renders with severity/status badges
  - [ ] Acknowledge/Resolve buttons work for operator+ roles
  - [ ] AI Analysis button triggers and displays result
  - [ ] Comment form submits and appears in timeline
  - [ ] Real-time update on socket event

  **QA Scenarios**:
  ```
  Scenario: Acknowledge incident
    Tool: Playwright
    Preconditions: logged in as operator, active incident exists
    Steps:
      1. page.goto('http://localhost:5173/incidents')
      2. page.click('table tbody tr:first-child')
      3. page.waitForSelector('button:has-text("Acknowledge")', {timeout: 3000})
      4. page.click('button:has-text("Acknowledge")')
      5. page.waitForSelector('[data-status="acknowledged"]', {timeout: 3000})
    Expected Result: status badge changes to acknowledged
    Evidence: .sisyphus/evidence/task-9-acknowledge.png

  Scenario: Add comment to incident
    Tool: Playwright
    Steps:
      1. Navigate to incident detail page
      2. page.fill('textarea[name="comment"]', 'Investigating the issue')
      3. page.click('button:has-text("Add Comment")')
      4. page.waitForSelector('.timeline-event:has-text("Investigating")', {timeout: 3000})
    Expected Result: comment appears in timeline
    Evidence: .sisyphus/evidence/task-9-comment.png
  ```

  **Commit**: YES (Wave 3 complete)

- [ ] 10. Socket.IO Client + Realtime Notification Toast

  **What to do**:
  - `src/lib/socket.ts`: Socket.IO client singleton
    - Connect to `VITE_WS_URL` with path `/ws`
    - JWT auth via handshake: `{ auth: { token } }`
    - Auto-reconnect on disconnect
    - Export: `getSocket()`, `connectSocket(token)`, `disconnectSocket()`
  - `src/hooks/useSocket.ts`: React hook for socket lifecycle
    - Connect on auth, disconnect on logout
    - Listen to `incident:updated` -> invalidate incidents query
    - Listen to `incident:comment` -> invalidate incident detail query
    - Listen to `notification` -> dispatch to socketSlice.setLastNotification + show toast
  - `src/components/notifications/NotificationToast.tsx`: toast notification
    - Uses shadcn/ui `Toast` component
    - Shows: device name, severity badge, metric value, timestamp
    - Auto-dismiss after 5s
    - Click -> navigate to incident detail
  - Mount `useSocket` in `AppLayout.tsx`

  **Must NOT do**:
  - No manual polling as fallback (socket reconnect handles it)
  - No notification history stored in Redux (use TanStack Query for history)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Tasks 7, 8, 9 with)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Task 3, 5

  **References**:
  - `apps/api/src/index.ts` - Socket.IO setup, JWT handshake auth, event names
  - `apps/api/src/routes/incidents.ts` - incident:updated emit payload
  - `apps/api/src/routes/notifications.ts` - notification event payload shape

  **Acceptance Criteria**:
  - [ ] Socket connects after login with JWT
  - [ ] Socket disconnects on logout
  - [ ] Toast appears on `notification` event
  - [ ] Incident list auto-refreshes on `incident:updated`

  **QA Scenarios**:
  ```
  Scenario: Socket connection established after login
    Tool: Playwright
    Preconditions: API running with Socket.IO
    Steps:
      1. Login as admin
      2. page.waitForFunction(() => window.__socketConnected === true, {timeout: 5000})
      3. page.screenshot({path: '.sisyphus/evidence/task-10-socket-connected.png'})
    Expected Result: socket connected state = true
    Evidence: .sisyphus/evidence/task-10-socket-connected.png

  Scenario: Notification toast appears on socket event
    Tool: Bash (curl to trigger notification + Playwright to verify)
    Steps:
      1. curl -X POST http://localhost:4000/api/notifications/test/:channelId
      2. page.waitForSelector('[data-testid="notification-toast"]', {timeout: 5000})
    Expected Result: toast notification visible
    Evidence: .sisyphus/evidence/task-10-toast.png
  ```

  **Commit**: YES (Wave 3 complete)

- [ ] 11. Topology Map (ReactFlow + Position Persistence)

  **What to do**:
  - `src/pages/TopologyPage.tsx`: network topology visualization
    - ReactFlow canvas with device nodes
    - Node data: device name, IP, status color, type icon
    - Edges: connections between devices (from LLDP/ARP discovery data)
    - Load per-user node positions from `GET /api/topology` on mount
    - Save positions on drag-end via `PUT /api/topology` (debounced 1s)
    - Controls: zoom in/out, fit view, minimap
    - Node click -> side panel with device summary + link to detail page
    - Status color coding: up=green, down=red, warning=yellow
  - `src/components/topology/DeviceNode.tsx`: custom ReactFlow node component
  - `src/components/topology/TopologySidePanel.tsx`: device info panel on node click

  **Must NOT do**:
  - No link/edge creation or deletion from UI
  - No node creation from topology (use devices page)
  - No auto-layout algorithm (use saved positions only)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Tasks 12, 13, 14 with)
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Task 5, 6

  **References**:
  - `apps/api/src/routes/topology.ts` - GET /topology (positions), PUT /topology (save)
  - `apps/api/src/routes/devices.ts` - device list for node data
  - `packages/shared/src/schema/index.ts` - topology_positions table (userId, deviceId, x, y)

  **Acceptance Criteria**:
  - [ ] ReactFlow canvas renders with device nodes
  - [ ] Node positions load from API on mount
  - [ ] Dragging node saves position to API (debounced)
  - [ ] Node click shows side panel with device info

  **QA Scenarios**:
  ```
  Scenario: Topology map renders nodes
    Tool: Playwright
    Preconditions: logged in, devices exist
    Steps:
      1. page.goto('http://localhost:5173/topology')
      2. page.waitForSelector('.react-flow__node', {timeout: 5000})
      3. page.screenshot({path: '.sisyphus/evidence/task-11-topology.png'})
    Expected Result: device nodes visible on canvas
    Evidence: .sisyphus/evidence/task-11-topology.png

  Scenario: Node click shows side panel
    Tool: Playwright
    Steps:
      1. page.click('.react-flow__node:first-child')
      2. page.waitForSelector('[data-testid="topology-side-panel"]', {timeout: 2000})
    Expected Result: side panel with device name and IP visible
    Evidence: .sisyphus/evidence/task-11-side-panel.png
  ```

  **Commit**: YES (Wave 4 complete)

- [ ] 12. Traffic/Performance Monitoring Page (Recharts Time-Series)

  **What to do**:
  - `src/pages/MetricsPage.tsx`: performance monitoring dashboard
    - Device selector dropdown (search + select)
    - Metric selector: CPU, memory, bandwidth_in, bandwidth_out, ping
    - Time range presets: 1h, 6h, 24h, 7d, 30d
    - Primary chart: Recharts LineChart with time-series data
    - Anomaly overlay: highlight anomaly points in red (from GET /api/metrics/anomalies)
    - Trend prediction line: dashed line showing predicted threshold breach (from GET /api/metrics/predict)
    - Stats summary: min, max, avg, current value
    - Multi-device comparison: add up to 3 devices on same chart
  - `src/components/metrics/MetricChart.tsx`: reusable chart component
  - `src/components/metrics/TimeRangeSelector.tsx`: time range picker

  **Must NOT do**:
  - No chart annotation or threshold drawing from UI
  - No custom query builder (preset metrics only)
  - No more than 3 devices on comparison chart (performance limit)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Tasks 11, 13, 14 with)
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Task 5, 6

  **References**:
  - `apps/api/src/routes/metrics.ts` - GET /metrics (time-series), GET /metrics/anomalies, GET /metrics/predict
  - Query params: deviceId, metricName, from, to, bucket (1min/5min/15min/1hour/6hour/1day)

  **Acceptance Criteria**:
  - [ ] Device + metric selector renders
  - [ ] Time-series chart displays with real data
  - [ ] Anomaly points highlighted
  - [ ] Time range presets change chart data

  **QA Scenarios**:
  ```
  Scenario: Metrics chart renders with data
    Tool: Playwright
    Preconditions: logged in, device with metrics exists
    Steps:
      1. page.goto('http://localhost:5173/metrics')
      2. page.click('[data-testid="device-selector"]')
      3. page.click('.device-option:first-child')
      4. page.waitForSelector('.recharts-line', {timeout: 5000})
      5. page.screenshot({path: '.sisyphus/evidence/task-12-metrics-chart.png'})
    Expected Result: line chart visible with data points
    Evidence: .sisyphus/evidence/task-12-metrics-chart.png

  Scenario: Time range change updates chart
    Tool: Playwright
    Steps:
      1. Select a device and metric
      2. page.click('button:has-text("24h")')
      3. page.waitForSelector('.recharts-line', {timeout: 3000})
    Expected Result: chart re-renders with 24h data range
    Evidence: .sisyphus/evidence/task-12-time-range.png
  ```

  **Commit**: YES (Wave 4 complete)

- [ ] 13. AI Analysis Page (NL Query, Incident Chat, RCA)

  **What to do**:
  - `src/pages/AiPage.tsx`: AI analysis hub with 3 tabs
  - Tab 1 - Natural Language Query:
    - Text input: "Show me devices with CPU > 80% in the last hour"
    - Submit -> POST /api/ai/query
    - Display result as formatted table or text
    - Query history (last 10, stored in localStorage)
  - Tab 2 - Incident Chat:
    - Incident selector dropdown
    - Chat-style message list (user messages + AI responses)
    - Text input + send button
    - POST /api/ai/chat with incidentId + message
    - No streaming - show loading spinner, then full response
  - Tab 3 - AI Providers (admin only):
    - List of configured AI providers (name, type, model, enabled status)
    - Add/edit/delete provider (admin+ role)
    - Test connection button per provider
  - `src/components/ai/ChatMessage.tsx`: chat bubble component
  - `src/components/ai/QueryResult.tsx`: formatted query result renderer

  **Must NOT do**:
  - No streaming responses (simple request-response only)
  - No conversation branching or thread management
  - No prompt template management UI

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Tasks 11, 12, 14 with)
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Task 5, 6

  **References**:
  - `apps/api/src/routes/ai.ts` - POST /ai/query, POST /ai/chat, POST /ai/rca/:incidentId, GET/POST/PUT/DELETE /ai/providers
  - Role check: admin+ for provider management

  **Acceptance Criteria**:
  - [ ] NL query submits and displays result
  - [ ] Incident chat sends message and shows AI response
  - [ ] AI providers tab visible for admin, hidden for viewer/operator
  - [ ] Loading state shown during AI request

  **QA Scenarios**:
  ```
  Scenario: NL query returns result
    Tool: Playwright
    Preconditions: AI provider configured, logged in as admin
    Steps:
      1. page.goto('http://localhost:5173/ai')
      2. page.fill('[data-testid="nl-query-input"]', 'show all devices')
      3. page.click('button:has-text("Run Query")')
      4. page.waitForSelector('[data-testid="query-result"]', {timeout: 10000})
      5. page.screenshot({path: '.sisyphus/evidence/task-13-nl-query.png'})
    Expected Result: query result displayed
    Evidence: .sisyphus/evidence/task-13-nl-query.png

  Scenario: AI providers tab hidden for viewer role
    Tool: Playwright
    Preconditions: logged in as viewer
    Steps:
      1. page.goto('http://localhost:5173/ai')
      2. expect(page.locator('[role="tab"]:has-text("AI Providers")')).not.toBeVisible()
    Expected Result: AI Providers tab not visible
    Evidence: .sisyphus/evidence/task-13-viewer-rbac.png
  ```

  **Commit**: YES (Wave 4 complete)

- [ ] 14. Settings/Admin Page

  **What to do**:
  - `src/pages/settings/SettingsLayout.tsx`: settings sub-navigation (left sidebar)
  - `src/pages/settings/UsersPage.tsx`: user management (admin+)
    - User list: name, email, role, scope, status
    - Invite user modal: email, role, scope selection
    - Edit user: role change, scope change, enable/disable
    - Delete user (super_admin only)
  - `src/pages/settings/AlertRulesPage.tsx`: alert rule management (admin+)
    - Rule list: name, device/group, metric, operator, threshold, severity, enabled
    - Create/edit rule form with all fields
    - Enable/disable toggle
  - `src/pages/settings/NotificationChannelsPage.tsx`: notification channels (admin+)
    - Channel list: name, type, enabled
    - Create/edit channel with type-specific config fields
    - Test send button per channel
  - `src/pages/settings/MaintenanceWindowsPage.tsx`: maintenance windows (admin+)
    - Window list: name, devices/groups, start/end, recurring
    - Create/edit window form with cron support
  - `src/pages/settings/SiteSettingsPage.tsx`: site settings (admin+)
    - Site name, logo URL
  - `src/pages/settings/ApiKeysPage.tsx`: API key management (all users)
    - Key list: name, prefix, last used, expires
    - Create key: show raw key once in modal
    - Revoke key

  **Must NOT do**:
  - No settings accessible to viewer role (redirect to 403)
  - No bulk user operations in v1

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Tasks 11, 12, 13 with)
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Task 5, 6

  **References**:
  - `apps/api/src/routes/setup.ts` - user management, invitations, site settings
  - `apps/api/src/routes/alert-rules.ts` - CRUD endpoints
  - `apps/api/src/routes/notifications.ts` - channel CRUD + test
  - `apps/api/src/routes/maintenance-windows.ts` - window CRUD
  - `apps/api/src/routes/api-keys.ts` - key management

  **Acceptance Criteria**:
  - [ ] All 6 settings sub-pages render
  - [ ] Invite user flow works end-to-end
  - [ ] Alert rule create/edit/delete works
  - [ ] Notification channel test send works
  - [ ] API key create shows raw key once

  **QA Scenarios**:
  ```
  Scenario: Invite user flow
    Tool: Playwright
    Preconditions: logged in as admin
    Steps:
      1. page.goto('http://localhost:5173/settings/users')
      2. page.click('button:has-text("Invite User")')
      3. page.fill('input[name="email"]', 'newuser@test.com')
      4. page.click('[data-value="operator"]')
      5. page.click('button:has-text("Send Invitation")')
      6. page.waitForSelector('.toast:has-text("Invitation sent")', {timeout: 3000})
    Expected Result: success toast shown
    Evidence: .sisyphus/evidence/task-14-invite-user.png

  Scenario: Viewer cannot access settings
    Tool: Playwright
    Preconditions: logged in as viewer
    Steps:
      1. page.goto('http://localhost:5173/settings/users')
      2. page.waitForSelector('[data-testid="403-page"]', {timeout: 3000})
    Expected Result: 403 forbidden page shown
    Evidence: .sisyphus/evidence/task-14-viewer-403.png
  ```

  **Commit**: YES (Wave 4 complete)

- [ ] 15. Reports Page

  **What to do**:
  - `src/pages/ReportsPage.tsx`: report list + generation
    - Report list: type, title, period, created at, AI summary preview
    - Generate report button: opens modal with type + period selector
    - Report types: availability, performance, alert_summary, ai_narrative
    - Period: daily, weekly, monthly
    - POST /api/reports/generate -> show loading -> refresh list
    - Report detail: click row -> expand/modal with full content
    - AI summary section highlighted if present

  **Must NOT do**:
  - No report scheduling UI in v1 (manual generation only)
  - No PDF export in v1

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Tasks 16, 17, 18 with)
  - **Parallel Group**: Wave 5
  - **Blocks**: None
  - **Blocked By**: Task 5, 6

  **References**:
  - `apps/api/src/routes/reports.ts` - GET /reports, GET /reports/:id, POST /reports/generate
  - Report types: availability, performance, alert_summary, ai_narrative

  **Acceptance Criteria**:
  - [ ] Report list renders
  - [ ] Generate report modal works with all 4 types
  - [ ] Generated report appears in list after creation

  **QA Scenarios**:
  ```
  Scenario: Generate availability report
    Tool: Playwright
    Preconditions: logged in as admin
    Steps:
      1. page.goto('http://localhost:5173/reports')
      2. page.click('button:has-text("Generate Report")')
      3. page.click('[data-value="availability"]')
      4. page.click('[data-value="weekly"]')
      5. page.click('button:has-text("Generate")')
      6. page.waitForSelector('table tbody tr', {timeout: 10000})
    Expected Result: new report row appears in list
    Evidence: .sisyphus/evidence/task-15-report-generated.png
  ```

  **Commit**: YES (Wave 5 complete)

- [ ] 16. Audit Logs + Config Snapshots Pages

  **What to do**:
  - `src/pages/AuditLogsPage.tsx`: audit log viewer (admin+)
    - Table: timestamp, user, action, resource, resource ID, IP address
    - Filter by user, action, resource, date range
    - Pagination (server-side)
  - `src/pages/ConfigSnapshotsPage.tsx`: config snapshot browser
    - Device selector to filter snapshots
    - Snapshot list: device, hash (first 8 chars), created at
    - Click snapshot -> view full config text in code block
    - Select 2 snapshots -> diff view (side-by-side or unified)

  **Must NOT do**:
  - No audit log deletion from UI
  - No config snapshot editing

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Tasks 15, 17, 18 with)
  - **Parallel Group**: Wave 5
  - **Blocks**: None
  - **Blocked By**: Task 5, 6

  **References**:
  - `apps/api/src/routes/audit-logs.ts` - GET /audit-logs with filters
  - `apps/api/src/routes/config-snapshots.ts` - GET /config-snapshots, GET /config-snapshots/:id (includes diff field)

  **Acceptance Criteria**:
  - [ ] Audit log table renders with filters
  - [ ] Config snapshot list renders
  - [ ] Snapshot diff view shows changes

  **QA Scenarios**:
  ```
  Scenario: Audit log filter by action
    Tool: Playwright
    Preconditions: logged in as admin, audit logs exist
    Steps:
      1. page.goto('http://localhost:5173/settings/audit-logs')
      2. page.fill('input[placeholder*="action"]', 'login')
      3. page.waitForTimeout(500)
      4. page.screenshot({path: '.sisyphus/evidence/task-16-audit-filter.png'})
    Expected Result: filtered audit log entries shown
    Evidence: .sisyphus/evidence/task-16-audit-filter.png
  ```

  **Commit**: YES (Wave 5 complete)

- [ ] 17. Environment Config + Build Optimization

  **What to do**:
  - `apps/web-vite/.env.example`: document all env vars with descriptions
    - VITE_API_URL, VITE_WS_URL
  - `vite.config.ts`: production build optimizations
    - Code splitting: vendor chunk (react, recharts, reactflow separate)
    - Asset optimization
  - `apps/web-vite/Dockerfile`: multi-stage build
    - Stage 1: node:22-alpine, yarn install, yarn build
    - Stage 2: nginx:alpine, copy dist, nginx.conf for SPA routing
  - `apps/web-vite/nginx.conf`: SPA fallback (try_files $uri /index.html)
  - Update `turbo.json` with web-vite build pipeline

  **Must NOT do**:
  - Do not modify existing docker-compose.yml web service (Next.js)
  - No SSR configuration

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Tasks 15, 16, 18 with)
  - **Parallel Group**: Wave 5
  - **Blocks**: None
  - **Blocked By**: Task 1

  **References**:
  - `docker-compose.yml` - existing web service pattern to follow (but separate)
  - `turbo.json` - pipeline config pattern
  - `apps/api/Dockerfile` - multi-stage build pattern to follow

  **Acceptance Criteria**:
  - [ ] `yarn workspace @netpulse/web-vite build` produces optimized dist/
  - [ ] Dockerfile builds successfully
  - [ ] nginx serves SPA with correct fallback routing

  **QA Scenarios**:
  ```
  Scenario: Production build succeeds
    Tool: Bash
    Steps:
      1. yarn workspace @netpulse/web-vite build 2>&1
      2. ls apps/web-vite/dist/
    Expected Result: dist/ directory with index.html and assets/
    Evidence: .sisyphus/evidence/task-17-build-output.txt

  Scenario: Docker build succeeds
    Tool: Bash
    Steps:
      1. docker build -t web-vite-test apps/web-vite/ 2>&1 | tail -5
    Expected Result: "Successfully built" or "writing image"
    Evidence: .sisyphus/evidence/task-17-docker-build.txt
  ```

  **Commit**: YES (Wave 5 complete)

- [ ] 18. Global Error Boundaries + Loading State Unification

  **What to do**:
  - `src/components/error/ErrorBoundary.tsx`: React error boundary
    - Catches render errors, shows friendly error UI
    - "Try again" button to reset boundary
    - Wrap all page-level routes
  - `src/components/error/ErrorPage.tsx`: 404 and 403 pages
  - `src/components/ui/SkeletonLoader.tsx`: unified skeleton components
    - `TableSkeleton`: rows x cols skeleton for tables
    - `CardSkeleton`: card-shaped skeleton
    - `ChartSkeleton`: chart area skeleton
  - Audit all pages: replace any spinner with appropriate skeleton
  - `src/components/ui/EmptyState.tsx`: unified empty state component
    - Props: icon, title, description, optional action button
  - Apply EmptyState to all list pages when data is empty

  **Must NOT do**:
  - No mixing of spinners and skeletons (pick skeleton as standard)
  - No error boundary around individual small components (page-level only)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Tasks 15, 16, 17 with)
  - **Parallel Group**: Wave 5
  - **Blocks**: None
  - **Blocked By**: Task 5

  **References**:
  - All page components in `src/pages/` - audit for loading/error/empty states
  - shadcn/ui Skeleton component docs

  **Acceptance Criteria**:
  - [ ] ErrorBoundary wraps all routes
  - [ ] 404 page renders for unknown routes
  - [ ] All list pages show EmptyState when no data
  - [ ] All loading states use skeleton (no spinners)

  **QA Scenarios**:
  ```
  Scenario: 404 page for unknown route
    Tool: Playwright
    Steps:
      1. page.goto('http://localhost:5173/nonexistent-route')
      2. page.waitForSelector('[data-testid="404-page"]', {timeout: 2000})
    Expected Result: 404 page rendered
    Evidence: .sisyphus/evidence/task-18-404.png

  Scenario: Empty state on devices page with no data
    Tool: Playwright
    Preconditions: logged in, no devices in DB
    Steps:
      1. page.goto('http://localhost:5173/devices')
      2. page.waitForSelector('[data-testid="empty-state"]', {timeout: 3000})
    Expected Result: empty state component visible
    Evidence: .sisyphus/evidence/task-18-empty-state.png
  ```

  **Commit**: YES (Wave 5 complete)

---

## Final Verification Wave

> 4개 검토 에이전트 병렬 실행. 전부 APPROVE 후 사용자 승인 필요.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  플랜 전체 검토. Must Have 항목별 구현 확인 (파일 읽기, curl). Must NOT Have 패턴 코드베이스 검색. evidence 파일 존재 확인.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  `yarn workspace @netpulse/web-vite build` + TypeScript 타입 체크. `as any`/`@ts-ignore`, 빈 catch, console.log, 미사용 import 검사. AI slop 패턴 확인.
  Output: `Build [PASS/FAIL] | Types [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` + `playwright`
  클린 상태에서 모든 QA 시나리오 실행. 화면 간 통합 테스트. 빈 상태/에러 상태/빠른 액션 엣지 케이스. `.sisyphus/evidence/final-qa/` 저장.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  태스크별 스펙 vs 실제 구현 1:1 대조. Must NOT do 준수 확인. 태스크 간 파일 오염 감지.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | VERDICT`

---

## Commit Strategy

- Wave 1: `feat(web-vite): scaffold vite react project with base config`
- Wave 2: `feat(web-vite): add auth flow, layout, and route guards`
- Wave 3: `feat(web-vite): add dashboard, devices, incidents pages with realtime`
- Wave 4: `feat(web-vite): add topology, metrics, ai, settings pages`
- Wave 5: `feat(web-vite): add reports, audit logs, docker integration, error boundaries`

---

## Success Criteria

### Verification Commands
```bash
yarn workspace @netpulse/web-vite build   # Expected: Build successful, no TS errors
yarn workspace @netpulse/web-vite dev      # Expected: Dev server starts on port 5173
curl http://localhost:4000/api/health      # Expected: {"status":"ok"}
```

### Final Checklist
- [ ] 로그인 → 대시보드 플로우 동작
- [ ] 모든 API 엔드포인트 연동 확인
- [ ] Socket.IO 실시간 알림 수신 확인
- [ ] 4개 역할별 접근 제어 동작
- [ ] `yarn workspace @netpulse/web-vite build` 에러 없음
- [ ] 스켈레톤 로더 통일 적용
- [ ] `as any` / `@ts-ignore` 없음
