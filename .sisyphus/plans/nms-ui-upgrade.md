# NetScopeNMS UI/UX Full Upgrade

## TL;DR

> **Quick Summary**: 오픈소스 NMS 경쟁작(Zabbix, LibreNMS, Observium, Uptime Kuma) 대비 부족한 UI/UX를 전면 업그레이드. 커스텀 대시보드 시스템, 차트 라이브러리 교체(Nivo+Visx), 토폴로지 웨더맵, 미구현 페이지 5개 완성, 반응형 개선, 데이터 밀도 높은 UI 폴리시.
> 
> **Deliverables**:
> - 커스텀 대시보드 시스템 (10개 위젯, 드래그앤드롭, 위젯 통신, 템플릿)
> - 차트 라이브러리 Recharts → Nivo/Visx 마이그레이션
> - 토폴로지 웨더맵 (실시간 트래픽, 색상 그라데이션, 레이아웃 저장)
> - 미구현 페이지 5개 (Alert Rules, Audit Logs, Config Snapshots, Maintenance Windows, API Keys)
> - 공통 컴포넌트 추출 + React Query 도입
> - 반응형 모바일 개선
> - 프론트엔드 테스트 인프라 + 테스트
> - 최소 백엔드 추가 (대시보드 저장, 토폴로지 위치, audit 와이어링)
> 
> **Estimated Effort**: XL (5-6주)
> **Parallel Execution**: YES - 6 waves
> **Critical Path**: T1(인프라) → T2(React Query) → T5(위젯 인터페이스) → T10-19(위젯) → T22(위젯 통신) → T23(템플릿) → F1-F4

---

## Context

### Original Request
오픈소스 NMS와 비교하여 부족한 점을 찾고, UI/UX를 업그레이드하는 풀 기획.

### Interview Summary
**Key Discussions**:
- 커스텀 대시보드: 고급 (위젯 통신 + 템플릿, Zabbix 수준)
- 토폴로지: 웨더맵 스타일 (LibreNMS 참고)
- 차트: Nivo 메인 + Visx 보조 (Recharts 교체)
- UI 방향: 데이터 밀도 높게 (Zabbix 스타일)
- 리팩토링: 점진적 (기능 구현 중 분리)
- 테스트: 구현 후 테스트
- 모바일: 반응형 개선만 (별도 뷰 없음)
- 위젯 10개: 통계 카드, 시계열 그래프, 파이/도넛, Top N 바, 알림 피드, 상태 그리드/허니콤, 지도 위젯, 토폴로지 위젯, 시스템 정보, AI 요약

**Research Findings**:
- Zabbix: 30+ 위젯, 위젯 간 통신 프레임워크 (업계 최고 대시보드)
- LibreNMS: 자동 CDP/LLDP 토폴로지 + 커스텀 웨더맵 (포트 사용률 색상)
- Observium: 깔끔한 UI, 위젯 대시보드
- Uptime Kuma: 모던 Vue.js SPA, 84K stars, 20+ 테마
- NetScopeNMS 강점: 유일한 React SPA NMS, AI 통합, 실시간 WebSocket

### Metis Review
**Identified Gaps** (addressed):
- 대시보드 저장에 백엔드 필요 → 최소 백엔드 추가를 스코프에 포함
- useSocket() 미연결 → Wave 1에서 활성화
- audit_logs 비어있음 → 기존 라우트에 logAudit() 와이어링 추가
- React Query 미사용 → Wave 1 인프라로 도입
- 공통 컴포넌트 없음 → Wave 1에서 추출
- react-grid-layout SSR 호환 → dynamic import with ssr: false
- Nivo 다크 테마 호환 → 스파이크 태스크로 검증

---

## Work Objectives

### Core Objective
NetScopeNMS의 프론트엔드를 오픈소스 NMS 업계 최고 수준으로 업그레이드. Zabbix급 대시보드 시스템, LibreNMS급 토폴로지 시각화, Uptime Kuma급 UI 폴리시를 하나의 모던 React SPA에서 구현.

### Concrete Deliverables
- `apps/web/src/components/dashboard/` - 대시보드 시스템 (위젯 프레임워크, 10개 위젯)
- `apps/web/src/components/charts/` - Nivo/Visx 차트 컴포넌트
- `apps/web/src/components/shared/` - 공통 컴포넌트 (DataTable, Pagination, FilterBar 등)
- `apps/web/src/hooks/queries/` - React Query 훅
- `apps/web/src/app/(authenticated)/alert-rules/page.tsx` - Alert Rules 페이지
- `apps/web/src/app/(authenticated)/audit-logs/page.tsx` - Audit Logs 페이지
- `apps/web/src/app/(authenticated)/config-snapshots/page.tsx` - Config Snapshots 페이지
- `apps/web/src/app/(authenticated)/maintenance/page.tsx` - Maintenance Windows 페이지
- `apps/web/src/app/(authenticated)/api-keys/page.tsx` - API Keys 페이지
- 토폴로지 페이지 웨더맵 업그레이드
- 대시보드 페이지 완전 재구축
- 모든 기존 페이지 반응형 + 데이터 밀도 개선
- `packages/shared/src/schema/` - dashboards, dashboard_widgets, topology_positions 테이블
- `apps/api/src/routes/dashboards.ts` - 대시보드 CRUD API

### Definition of Done
- [ ] 커스텀 대시보드에서 10개 위젯 타입 모두 추가/제거/리사이즈/드래그 가능
- [ ] 위젯 간 통신 동작 (호스트 선택 → 연관 위젯 업데이트)
- [ ] 대시보드 저장/로드/공유/템플릿 동작
- [ ] 토폴로지 맵에 실시간 트래픽 색상 표시, 노드 위치 저장
- [ ] 5개 미구현 페이지 모두 CRUD 동작
- [ ] 모든 차트가 Nivo/Visx로 교체, 줌/팬/CSV 내보내기 지원
- [ ] 모바일(375px)에서 모든 페이지 가로 스크롤 없이 사용 가능
- [ ] Vitest + Playwright 테스트 통과

### Must Have
- react-grid-layout 기반 드래그앤드롭 대시보드
- 10개 위젯 타입 (통계 카드, 시계열, 파이/도넛, Top N, 알림 피드, 허니콤, 지도, 토폴로지, 시스템 정보, AI 요약)
- 위젯 간 통신 (호스트/시간 범위 선택 → 연관 위젯 업데이트)
- 대시보드 저장/로드 (백엔드 persist)
- Recharts → Nivo 마이그레이션 (모든 차트)
- 토폴로지 웨더맵 (링크 트래픽 색상, 노드 위치 저장)
- 5개 미구현 페이지 완성
- React Query 데이터 페칭 레이어
- 공통 컴포넌트 (DataTable, Pagination, FilterBar, EmptyState, ErrorBoundary)
- 프론트엔드 테스트 인프라 (Vitest + Playwright)

### Must NOT Have (Guardrails)
- 위젯 10개 초과 (v1 하드캡)
- 위젯당 설정 옵션 5개 초과
- React Query optimistic updates, prefetching, infinite scroll
- 모바일 전용 컴포넌트 트리 (Tailwind 반응형만)
- 대시보드 모바일 편집 (view-only)
- i18n/다국어 지원
- 커스텀 테마 시스템
- 퍼블릭 상태 페이지
- 사용자 생성 대시보드 템플릿 (빌트인 3개만: Overview, Network, Alerts)
- 수정 중인 페이지 외 다른 페이지 리팩토링
- 3회 미만 사용 시 조기 추상화
- react-hook-form 도입 (기존 패턴 유지, Zod 클라이언트 검증만 추가)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.
> Acceptance criteria requiring "user manually tests/confirms" are FORBIDDEN.

### Test Decision
- **Infrastructure exists**: NO (프론트엔드 테스트 없음, 백엔드 Vitest 있음)
- **Automated tests**: Tests-after (구현 후 테스트)
- **Framework**: Vitest (유닛/통합) + Playwright (E2E)
- **Setup**: Wave 1에서 테스트 인프라 구축, 이후 각 기능 태스크에 테스트 포함

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Playwright - Navigate, interact, assert DOM, screenshot
- **API/Backend**: Bash (curl) - Send requests, assert status + response fields
- **Component**: Vitest - Import, render, assert output

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - 인프라 + 공통 컴포넌트):
├── T1: 프론트엔드 테스트 인프라 (Vitest + Playwright 설정) [quick]
├── T2: React Query 도입 + QueryClientProvider [quick]
├── T3: useSocket() 활성화 + React Query 캐시 무효화 연동 [quick]
├── T4: 공통 컴포넌트 추출 (DataTable, Pagination, FilterBar, EmptyState, ErrorBoundary) [unspecified-high]
├── T5: 위젯 인터페이스 계약 + WidgetErrorBoundary + 위젯 레지스트리 [deep]
├── T6: Nivo 테마 스파이크 + 차트 래퍼 컴포넌트 (NivoLineChart, NivoPieChart, NivoBarChart) [visual-engineering]
├── T7: 백엔드 - dashboards/dashboard_widgets/topology_positions 스키마 + CRUD API [unspecified-high]
└── T8: 백엔드 - 기존 라우트에 logAudit() 와이어링 + config snapshot diff 엔드포인트 [quick]

Wave 2 (Core Features - 대시보드 프레임워크 + 미구현 페이지):
├── T9: 대시보드 프레임워크 (react-grid-layout, 위젯 추가/제거/리사이즈, 저장/로드) [deep]
├── T10: 위젯 - 통계 카드 (StatCardWidget) [visual-engineering]
├── T11: 위젯 - 시계열 그래프 (TimeSeriesWidget, Nivo Line) [visual-engineering]
├── T12: 위젯 - 파이/도넛 차트 (PieChartWidget, Nivo Pie) [visual-engineering]
├── T13: Alert Rules CRUD 페이지 [unspecified-high]
├── T14: Audit Logs 뷰어 페이지 [quick]
├── T15: Config Snapshots 뷰어 + diff 페이지 [unspecified-high]
├── T16: Maintenance Windows CRUD 페이지 [unspecified-high]
└── T17: API Keys 관리 페이지 [quick]

Wave 3 (Widgets + Topology - 나머지 위젯 + 토폴로지 웨더맵):
├── T18: 위젯 - Top N 바 차트 (TopNBarWidget, Nivo Bar) [visual-engineering]
├── T19: 위젯 - 알림 피드 (AlertFeedWidget) [quick]
├── T20: 위젯 - 상태 그리드/허니콤 (HoneycombWidget, Visx) [visual-engineering]
├── T21: 위젯 - 지도 미니맵 (MapWidget, Leaflet) [visual-engineering]
├── T22: 위젯 - 토폴로지 미니맵 (TopologyWidget, ReactFlow) [visual-engineering]
├── T23: 위젯 - 시스템 정보 (SystemInfoWidget) [quick]
├── T24: 위젯 - AI 요약 (AISummaryWidget) [quick]
└── T25: 토폴로지 웨더맵 업그레이드 (트래픽 색상, 대역폭 라벨, 노드 위치 저장, 배경 이미지) [deep]

Wave 4 (Advanced Dashboard + Chart Migration):
├── T26: 위젯 간 통신 시스템 (Zustand 호스트/시간범위 스토어, 위젯 구독) [deep]
├── T27: 대시보드 공유 + 빌트인 템플릿 3개 (Overview, Network, Alerts) [unspecified-high]
├── T28: 기존 페이지 차트 Nivo 마이그레이션 - Dashboard 페이지 [visual-engineering]
├── T29: 기존 페이지 차트 Nivo 마이그레이션 - Device Detail 페이지 [visual-engineering]
├── T30: 차트 고급 기능 (줌/팬, 다중 메트릭 오버레이, CSV 내보내기, 95th percentile) [deep]
└── T31: Recharts 의존성 제거 + 번들 정리 [quick]

Wave 5 (Polish + Mobile + Tests):
├── T32: 전체 UI 데이터 밀도 개선 - Dashboard, Devices, Incidents 페이지 [visual-engineering]
├── T33: 전체 UI 데이터 밀도 개선 - 나머지 페이지 (Reports, Users, Settings, AI, 신규 5개) [visual-engineering]
├── T34: 모바일 반응형 개선 - 사이드바 드로어, 테이블→카드, 대시보드 view-only [visual-engineering]
├── T35: 앱 셸 개선 - 브레드크럼, 사이드바 Alert Rules/Audit Logs/Maintenance/API Keys 메뉴 추가 [quick]
├── T36: 프론트엔드 유닛 테스트 - 공통 컴포넌트 + 위젯 + 훅 [unspecified-high]
└── T37: E2E 테스트 - Playwright 주요 플로우 (대시보드 CRUD, 위젯 드래그, 페이지 네비게이션) [unspecified-high]

Wave FINAL (4 parallel reviews, then user okay):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA (unspecified-high)
└── F4: Scope fidelity check (deep)
→ Present results → Get explicit user okay

Critical Path: T1 → T2 → T5 → T9 → T11 → T26 → T27 → T28 → T30 → F1-F4
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 8 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| T1 | - | T36, T37 | 1 |
| T2 | - | T3, T9-T37 | 1 |
| T3 | T2 | T9 | 1 |
| T4 | - | T9, T13-T17 | 1 |
| T5 | - | T9, T10-T24 | 1 |
| T6 | - | T11, T12, T18, T28, T29 | 1 |
| T7 | - | T9, T25 | 1 |
| T8 | - | T14, T15 | 1 |
| T9 | T2, T3, T4, T5, T7 | T10-T24, T26, T27 | 2 |
| T10 | T5, T9 | T26 | 2 |
| T11 | T5, T6, T9 | T26, T30 | 2 |
| T12 | T5, T6, T9 | T26 | 2 |
| T13 | T2, T4 | T35 | 2 |
| T14 | T2, T4, T8 | T35 | 2 |
| T15 | T2, T4, T8 | T35 | 2 |
| T16 | T2, T4 | T35 | 2 |
| T17 | T2, T4 | T35 | 2 |
| T18 | T5, T6, T9 | - | 3 |
| T19 | T5, T9 | - | 3 |
| T20 | T5, T9 | - | 3 |
| T21 | T5, T9 | - | 3 |
| T22 | T5, T9 | - | 3 |
| T23 | T5, T9 | - | 3 |
| T24 | T5, T9 | - | 3 |
| T25 | T7 | - | 3 |
| T26 | T9, T10, T11, T12 | T27 | 4 |
| T27 | T9, T26 | - | 4 |
| T28 | T6, T11 | T31 | 4 |
| T29 | T6, T11 | T31 | 4 |
| T30 | T11 | - | 4 |
| T31 | T28, T29 | - | 4 |
| T32 | T9, T28 | - | 5 |
| T33 | T13-T17 | - | 5 |
| T34 | T9, T32 | - | 5 |
| T35 | T13-T17 | - | 5 |
| T36 | T1, T4, T5, T10-T24 | - | 5 |
| T37 | T1, T9, T13-T17 | - | 5 |

### Agent Dispatch Summary

- **Wave 1**: 8 tasks - T1→`quick`, T2→`quick`, T3→`quick`, T4→`unspecified-high`, T5→`deep`, T6→`visual-engineering`, T7→`unspecified-high`, T8→`quick`
- **Wave 2**: 9 tasks - T9→`deep`, T10→`visual-engineering`, T11→`visual-engineering`, T12→`visual-engineering`, T13→`unspecified-high`, T14→`quick`, T15→`unspecified-high`, T16→`unspecified-high`, T17→`quick`
- **Wave 3**: 8 tasks - T18→`visual-engineering`, T19→`quick`, T20→`visual-engineering`, T21→`visual-engineering`, T22→`visual-engineering`, T23→`quick`, T24→`quick`, T25→`deep`
- **Wave 4**: 6 tasks - T26→`deep`, T27→`unspecified-high`, T28→`visual-engineering`, T29→`visual-engineering`, T30→`deep`, T31→`quick`
- **Wave 5**: 6 tasks - T32→`visual-engineering`, T33→`visual-engineering`, T34→`visual-engineering`, T35→`quick`, T36→`unspecified-high`, T37→`unspecified-high`
- **FINAL**: 4 tasks - F1→`oracle`, F2→`unspecified-high`, F3→`unspecified-high`, F4→`deep`

---

## TODOs

- [ ] 1. 프론트엔드 테스트 인프라 설정 (Vitest + Playwright)

  **What to do**:
  - `apps/web`에 Vitest 설정: `vitest.config.ts` 생성, jsdom 환경, `@testing-library/react` + `@testing-library/jest-dom` 설치
  - Playwright 설정: `playwright.config.ts` 생성, baseURL `http://localhost:3000`, chromium only
  - `apps/web/package.json`에 `test`, `test:e2e` 스크립트 추가
  - 샘플 테스트 1개씩 작성하여 인프라 검증: `src/__tests__/sample.test.tsx` (Vitest), `e2e/sample.spec.ts` (Playwright)

  **Must NOT do**:
  - 실제 컴포넌트 테스트 작성 (인프라 검증용 샘플만)
  - Jest 사용 (Vitest 통일)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T2, T3, T4, T5, T6, T7, T8)
  - **Blocks**: T36, T37
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `apps/api/vitest.config.ts` - 백엔드 Vitest 설정 패턴 참고 (이미 존재)
  - `apps/api/src/__tests__/routes.test.ts` - 백엔드 테스트 구조 참고

  **API/Type References**:
  - `apps/web/package.json` - 현재 의존성 확인, 테스트 관련 스크립트 추가 위치
  - `apps/web/tsconfig.json` - TypeScript 설정, 테스트 파일 포함 여부

  **External References**:
  - Vitest docs: https://vitest.dev/guide/ - React + jsdom 설정
  - Playwright docs: https://playwright.dev/docs/intro - Next.js 통합

  **WHY Each Reference Matters**:
  - 백엔드 Vitest 설정을 참고하면 모노레포 내 일관된 테스트 설정 가능
  - package.json에 이미 있는 의존성과 충돌하지 않도록 확인 필요

  **Acceptance Criteria**:
  - [ ] `cd apps/web && npx vitest run` → 샘플 테스트 1개 PASS
  - [ ] `npx playwright test` → 샘플 E2E 테스트 1개 PASS
  - [ ] `vitest.config.ts`, `playwright.config.ts` 파일 존재

  **QA Scenarios**:

  ```
  Scenario: Vitest 샘플 테스트 실행
    Tool: Bash
    Preconditions: apps/web 디렉토리에 vitest.config.ts 존재
    Steps:
      1. cd apps/web && npx vitest run --reporter=verbose
      2. 출력에서 "1 passed" 확인
    Expected Result: exit code 0, "1 passed" 포함
    Failure Indicators: exit code non-zero, "FAIL" 포함
    Evidence: .sisyphus/evidence/task-1-vitest-run.txt

  Scenario: Playwright 샘플 테스트 실행
    Tool: Bash
    Preconditions: playwright.config.ts 존재, 개발 서버 실행 가능
    Steps:
      1. npx playwright test --reporter=list
      2. 출력에서 "1 passed" 확인
    Expected Result: exit code 0, "1 passed" 포함
    Failure Indicators: exit code non-zero, "FAIL" 포함
    Evidence: .sisyphus/evidence/task-1-playwright-run.txt
  ```

  **Commit**: YES
  - Message: `feat(web): add Vitest and Playwright test infrastructure`
  - Files: `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts`, `apps/web/src/__tests__/sample.test.tsx`, `apps/web/e2e/sample.spec.ts`, `apps/web/package.json`
  - Pre-commit: `cd apps/web && npx vitest run`

- [ ] 2. React Query 도입 + QueryClientProvider

  **What to do**:
  - `@tanstack/react-query` + `@tanstack/react-query-devtools` 설치
  - `apps/web/src/lib/query-client.ts` 생성: QueryClient 인스턴스 (staleTime: 30s, gcTime: 5min)
  - `apps/web/src/components/providers/query-provider.tsx` 생성: QueryClientProvider 래퍼 (client component)
  - `apps/web/src/app/layout.tsx`에 QueryClientProvider 추가 (ThemeProvider 안에)
  - `apps/web/src/hooks/queries/use-dashboard.ts` 생성: 대시보드 API 훅 예시 (useQuery로 `/api/dashboard/summary` 호출)
  - 기존 `apiFetch` 유틸리티를 React Query의 queryFn으로 활용하는 패턴 확립

  **Must NOT do**:
  - 기존 페이지의 useState/useEffect 데이터 페칭을 이 태스크에서 마이그레이션하지 않음
  - optimistic updates, prefetching, infinite scroll 도입 금지
  - Suspense 모드 사용 금지 (기존 로딩 패턴 유지)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T3, T4, T5, T6, T7, T8)
  - **Blocks**: T3, T9-T37 (모든 후속 태스크가 React Query 사용)
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `apps/web/src/lib/utils.ts:apiFetch` - 기존 데이터 페칭 유틸리티. React Query queryFn에서 이것을 래핑
  - `apps/web/src/app/layout.tsx` - 루트 레이아웃. QueryClientProvider 추가 위치
  - `apps/web/src/components/layout/theme-provider.tsx` - 기존 Provider 래퍼 패턴 참고

  **API/Type References**:
  - `apps/api/src/routes/dashboard.ts` - `/api/dashboard/summary` 응답 타입 확인

  **External References**:
  - TanStack Query docs: https://tanstack.com/query/latest/docs/react/overview

  **WHY Each Reference Matters**:
  - apiFetch를 queryFn으로 래핑하면 기존 JWT 인증/에러 처리 로직 재사용 가능
  - layout.tsx의 Provider 중첩 순서가 중요 (ThemeProvider > QueryProvider > children)

  **Acceptance Criteria**:
  - [ ] `apps/web/src/lib/query-client.ts` 존재, QueryClient export
  - [ ] `apps/web/src/app/layout.tsx`에 QueryClientProvider 포함
  - [ ] `apps/web/src/hooks/queries/use-dashboard.ts` 존재, useQuery 훅 export
  - [ ] `cd apps/web && npx tsc --noEmit` → 타입 에러 없음

  **QA Scenarios**:

  ```
  Scenario: React Query Provider 정상 마운트
    Tool: Bash
    Preconditions: apps/web 빌드 가능
    Steps:
      1. cd apps/web && npx tsc --noEmit
      2. grep -r "QueryClientProvider" src/app/layout.tsx
    Expected Result: tsc exit 0, QueryClientProvider import 및 사용 확인
    Failure Indicators: tsc 에러, QueryClientProvider 미발견
    Evidence: .sisyphus/evidence/task-2-tsc-check.txt

  Scenario: use-dashboard 훅 타입 검증
    Tool: Bash
    Preconditions: use-dashboard.ts 존재
    Steps:
      1. cd apps/web && npx tsc --noEmit src/hooks/queries/use-dashboard.ts
      2. grep "useQuery" src/hooks/queries/use-dashboard.ts
    Expected Result: 타입 에러 없음, useQuery 사용 확인
    Failure Indicators: 타입 에러 발생
    Evidence: .sisyphus/evidence/task-2-hook-check.txt
  ```

  **Commit**: YES
  - Message: `feat(web): add React Query provider and data fetching hooks`
  - Files: `apps/web/src/lib/query-client.ts`, `apps/web/src/components/providers/query-provider.tsx`, `apps/web/src/app/layout.tsx`, `apps/web/src/hooks/queries/use-dashboard.ts`, `apps/web/package.json`
  - Pre-commit: `cd apps/web && npx tsc --noEmit`

- [ ] 3. useSocket() 활성화 + React Query 캐시 무효화 연동

  **What to do**:
  - `apps/web/src/app/(authenticated)/layout.tsx`에서 `useSocket()` 훅 import 및 호출
  - `useSocket` 훅 수정: Socket.IO 이벤트 수신 시 React Query 캐시 무효화
    - `incident:created` → `queryClient.invalidateQueries({ queryKey: ['incidents'] })` + `queryClient.invalidateQueries({ queryKey: ['dashboard'] })`
    - `incident:updated` → 동일
    - `device:status` → `queryClient.invalidateQueries({ queryKey: ['devices'] })`
  - 기존 `useNotificationStore` 연동 유지 (알림 토스트)

  **Must NOT do**:
  - 새로운 Socket.IO 이벤트 타입 추가 (백엔드 변경 없음)
  - WebSocket 재연결 로직 변경

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (T2 완료 후)
  - **Parallel Group**: Wave 1 (T2 이후 시작)
  - **Blocks**: T9
  - **Blocked By**: T2

  **References**:
  **Pattern References**:
  - `apps/web/src/hooks/use-socket.ts` - 현재 Socket.IO 훅. 이벤트 리스너 구조 확인
  - `apps/web/src/app/(authenticated)/layout.tsx` - 인증 레이아웃. useSocket 호출 추가 위치
  - `apps/web/src/stores/index.ts:useNotificationStore` - 기존 알림 스토어 연동 패턴

  **API/Type References**:
  - `apps/api/src/index.ts` - Socket.IO 서버 설정, 이벤트 타입 확인
  - `apps/api/src/routes/incidents.ts` - `incident:created`, `incident:updated` 이벤트 emit 위치

  **WHY Each Reference Matters**:
  - useSocket 훅이 이미 이벤트 리스너를 등록하지만 어디서도 호출되지 않음. 활성화만 하면 됨
  - React Query invalidation과 연동하면 실시간 데이터 갱신 가능

  **Acceptance Criteria**:
  - [ ] `apps/web/src/app/(authenticated)/layout.tsx`에서 `useSocket()` 호출
  - [ ] Socket.IO 이벤트 수신 시 React Query 캐시 무효화 로직 존재
  - [ ] `cd apps/web && npx tsc --noEmit` → 타입 에러 없음

  **QA Scenarios**:

  ```
  Scenario: useSocket 훅 활성화 확인
    Tool: Bash
    Preconditions: authenticated layout 파일 존재
    Steps:
      1. grep -n "useSocket" apps/web/src/app/\(authenticated\)/layout.tsx
      2. grep -n "invalidateQueries" apps/web/src/hooks/use-socket.ts
    Expected Result: useSocket import+호출 확인, invalidateQueries 호출 확인
    Failure Indicators: grep 결과 없음
    Evidence: .sisyphus/evidence/task-3-socket-activation.txt

  Scenario: 타입 안전성 검증
    Tool: Bash
    Preconditions: T2 완료 (React Query 설치됨)
    Steps:
      1. cd apps/web && npx tsc --noEmit
    Expected Result: exit code 0
    Failure Indicators: 타입 에러
    Evidence: .sisyphus/evidence/task-3-tsc-check.txt
  ```

  **Commit**: YES (groups with T2)
  - Message: `feat(web): activate Socket.IO with React Query cache invalidation`
  - Files: `apps/web/src/hooks/use-socket.ts`, `apps/web/src/app/(authenticated)/layout.tsx`
  - Pre-commit: `cd apps/web && npx tsc --noEmit`

- [ ] 4. 공통 컴포넌트 추출 (DataTable, Pagination, FilterBar, EmptyState, ErrorBoundary)

  **What to do**:
  - `apps/web/src/components/shared/` 디렉토리 생성
  - 기존 페이지에서 반복되는 패턴을 추출하여 공통 컴포넌트 생성:
    - `DataTable` - 정렬 가능한 테이블 (devices, users, incidents 페이지에서 추출). props: columns, data, onSort, loading
    - `Pagination` - 페이지네이션 컨트롤 (devices, incidents 페이지에서 추출). props: page, totalPages, onPageChange
    - `FilterBar` - 검색 + 필터 드롭다운 조합 (devices, incidents 페이지에서 추출). props: filters[], onFilterChange, searchPlaceholder
    - `EmptyState` - 빈 상태 표시 (아이콘 + 메시지 + 액션 버튼). props: icon, title, description, action?
    - `ErrorBoundary` - React Error Boundary (에러 시 fallback UI). props: fallback?
    - `WidgetErrorBoundary` - 위젯 전용 에러 바운더리 (개별 위젯 크래시 격리). props: widgetId, onError?
    - `SkeletonLoader` - 공통 스켈레톤 (카드, 테이블, 차트 변형). props: variant
  - 기존 페이지는 이 태스크에서 수정하지 않음 (새 페이지에서 사용)
  - `apps/web/src/components/shared/index.ts` 배럴 export

  **Must NOT do**:
  - 기존 페이지 코드를 이 태스크에서 리팩토링하지 않음 (새 페이지에서만 사용)
  - 3회 미만 사용될 컴포넌트 추출 금지
  - shadcn/ui 컴포넌트 수정 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T2, T3, T5, T6, T7, T8)
  - **Blocks**: T9, T13-T17
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `apps/web/src/app/(authenticated)/devices/page.tsx` - 테이블, 페이지네이션, 필터, 빈 상태 패턴 (360줄, 추출 대상)
  - `apps/web/src/app/(authenticated)/incidents/page.tsx` - 유사한 테이블/필터/페이지네이션 패턴
  - `apps/web/src/app/(authenticated)/users/page.tsx` - 테이블 + 탭 패턴
  - `apps/web/src/components/ui/table.tsx` - shadcn Table 프리미티브 (DataTable이 이것을 래핑)
  - `apps/web/src/components/ui/button.tsx` - shadcn Button (Pagination에서 사용)

  **WHY Each Reference Matters**:
  - devices, incidents, users 페이지에서 동일한 테이블/필터/페이지네이션 패턴이 반복됨
  - 새로 만들 5개 CRUD 페이지에서 이 공통 컴포넌트를 재사용

  **Acceptance Criteria**:
  - [ ] `apps/web/src/components/shared/` 디렉토리에 7개 컴포넌트 파일 존재
  - [ ] `apps/web/src/components/shared/index.ts` 배럴 export 존재
  - [ ] `cd apps/web && npx tsc --noEmit` → 타입 에러 없음
  - [ ] 각 컴포넌트가 props 타입 정의 포함

  **QA Scenarios**:

  ```
  Scenario: 공통 컴포넌트 파일 존재 확인
    Tool: Bash
    Preconditions: Wave 1 시작
    Steps:
      1. ls apps/web/src/components/shared/
      2. 파일 목록에 data-table.tsx, pagination.tsx, filter-bar.tsx, empty-state.tsx, error-boundary.tsx, widget-error-boundary.tsx, skeleton-loader.tsx, index.ts 확인
    Expected Result: 8개 파일 존재
    Failure Indicators: 파일 누락
    Evidence: .sisyphus/evidence/task-4-file-list.txt

  Scenario: 타입 안전성 검증
    Tool: Bash
    Preconditions: 컴포넌트 파일 생성 완료
    Steps:
      1. cd apps/web && npx tsc --noEmit
    Expected Result: exit code 0
    Failure Indicators: 타입 에러
    Evidence: .sisyphus/evidence/task-4-tsc-check.txt
  ```

  **Commit**: YES
  - Message: `feat(web): extract shared components (DataTable, Pagination, FilterBar, EmptyState, ErrorBoundary)`
  - Files: `apps/web/src/components/shared/*.tsx`, `apps/web/src/components/shared/index.ts`
  - Pre-commit: `cd apps/web && npx tsc --noEmit`

- [ ] 5. 위젯 인터페이스 계약 + WidgetRegistry + 위젯 타입 정의

  **What to do**:
  - `apps/web/src/components/dashboard/types.ts` 생성:
    - `WidgetType` enum: `stat-card | time-series | pie-chart | top-n-bar | alert-feed | honeycomb | map | topology | system-info | ai-summary`
    - `WidgetConfig` 유니온 타입 (각 위젯별 설정 인터페이스)
    - `WidgetProps` 인터페이스: `{ id: string, type: WidgetType, config: WidgetConfig, timeRange?: TimeRange, selectedHost?: string }`
    - `DashboardLayout` 타입: react-grid-layout의 Layout[] + 위젯 메타데이터
    - `Dashboard` 타입: `{ id, name, description, layouts, widgets, isDefault, isShared, templateId? }`
  - `apps/web/src/components/dashboard/widget-registry.ts` 생성:
    - 위젯 타입 → React 컴포넌트 매핑 레지스트리
    - `registerWidget(type, component, defaultConfig)` 함수
    - `getWidget(type)` 함수
    - `getWidgetDefaultSize(type)` → `{ w, h, minW, minH }` 기본 그리드 사이즈
  - `apps/web/src/components/dashboard/widget-wrapper.tsx` 생성:
    - WidgetErrorBoundary로 감싸는 공통 래퍼
    - 위젯 헤더 (타이틀, 설정 버튼, 삭제 버튼)
    - 로딩/에러 상태 처리

  **Must NOT do**:
  - 실제 위젯 컴포넌트 구현 (인터페이스와 레지스트리만)
  - 위젯당 설정 옵션 5개 초과 정의

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T2, T3, T4, T6, T7, T8)
  - **Blocks**: T9, T10-T24
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `apps/web/src/app/(authenticated)/dashboard/page.tsx` - 현재 대시보드 구조 (543줄). 어떤 데이터를 위젯으로 분리할지 참고
  - `apps/web/src/stores/index.ts` - Zustand 스토어 패턴. 위젯 통신용 스토어 인터페이스 설계 참고

  **API/Type References**:
  - `apps/api/src/routes/dashboard.ts` - `/api/dashboard/summary`, `/api/dashboard/top-devices`, `/api/dashboard/throughput` 응답 타입
  - `apps/api/src/routes/metrics.ts` - 메트릭 쿼리 API 응답 타입 (시계열 위젯용)
  - `apps/api/src/routes/incidents.ts` - 인시던트 리스트 응답 타입 (알림 피드 위젯용)

  **External References**:
  - react-grid-layout types: Layout 인터페이스 참고 (이미 설치됨 v1.5.0)

  **WHY Each Reference Matters**:
  - 현재 대시보드의 데이터 구조를 이해해야 위젯 Config 타입을 올바르게 설계 가능
  - API 응답 타입과 위젯 Config가 일치해야 데이터 바인딩이 자연스러움

  **Acceptance Criteria**:
  - [ ] `apps/web/src/components/dashboard/types.ts` - WidgetType, WidgetConfig, WidgetProps, Dashboard 타입 export
  - [ ] `apps/web/src/components/dashboard/widget-registry.ts` - registerWidget, getWidget, getWidgetDefaultSize export
  - [ ] `apps/web/src/components/dashboard/widget-wrapper.tsx` - WidgetWrapper 컴포넌트 export
  - [ ] 각 위젯 타입별 config 인터페이스에 설정 옵션 5개 이하
  - [ ] `cd apps/web && npx tsc --noEmit` → 타입 에러 없음

  **QA Scenarios**:

  ```
  Scenario: 위젯 타입 시스템 완전성 검증
    Tool: Bash
    Preconditions: types.ts 생성 완료
    Steps:
      1. grep -c "WidgetType" apps/web/src/components/dashboard/types.ts
      2. 10개 위젯 타입이 모두 정의되었는지 확인: stat-card, time-series, pie-chart, top-n-bar, alert-feed, honeycomb, map, topology, system-info, ai-summary
    Expected Result: 10개 위젯 타입 모두 존재
    Failure Indicators: 위젯 타입 누락
    Evidence: .sisyphus/evidence/task-5-widget-types.txt

  Scenario: 위젯 레지스트리 API 검증
    Tool: Bash
    Preconditions: widget-registry.ts 생성 완료
    Steps:
      1. grep "export" apps/web/src/components/dashboard/widget-registry.ts
      2. registerWidget, getWidget, getWidgetDefaultSize 함수 export 확인
    Expected Result: 3개 함수 export 확인
    Failure Indicators: 함수 누락
    Evidence: .sisyphus/evidence/task-5-registry-api.txt
  ```

  **Commit**: YES
  - Message: `feat(web): define widget interface contract and registry`
  - Files: `apps/web/src/components/dashboard/types.ts`, `apps/web/src/components/dashboard/widget-registry.ts`, `apps/web/src/components/dashboard/widget-wrapper.tsx`
  - Pre-commit: `cd apps/web && npx tsc --noEmit`

- [ ] 6. Nivo 테마 스파이크 + 차트 래퍼 컴포넌트

  **What to do**:
  - `@nivo/core`, `@nivo/line`, `@nivo/pie`, `@nivo/bar` 설치
  - `@visx/group`, `@visx/shape`, `@visx/scale`, `@visx/tooltip` 설치 (보조용)
  - `apps/web/src/components/charts/nivo-theme.ts` 생성:
    - 현재 CSS 변수 기반 다크/라이트 테마와 호환되는 Nivo 테마 객체
    - `globals.css`의 `--chart-1` ~ `--chart-5` 색상 활용
    - 배경 투명, 그리드 라인 subtle, 텍스트 `--foreground` 색상
  - `apps/web/src/components/charts/line-chart.tsx` 생성:
    - Nivo ResponsiveLine 래퍼. props: data, xLabel, yLabel, enableArea?, curve?, enableZoom?
    - 줌/팬 기본 지원 (nivo의 built-in 또는 커스텀 구현)
    - CSV 내보내기 버튼 (데이터를 CSV 문자열로 변환, 다운로드)
  - `apps/web/src/components/charts/pie-chart.tsx` 생성:
    - Nivo ResponsivePie 래퍼. props: data, innerRadius?, enableArcLabels?
  - `apps/web/src/components/charts/bar-chart.tsx` 생성:
    - Nivo ResponsiveBar 래퍼. props: data, keys, indexBy, layout?
  - `apps/web/src/components/charts/index.ts` 배럴 export

  **Must NOT do**:
  - 기존 Recharts 컴포넌트 수정/제거 (이 태스크에서는 새 컴포넌트만 생성)
  - Visx로 복잡한 시각화 구현 (설치만, 실제 사용은 T20 허니콤에서)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T2, T3, T4, T5, T7, T8)
  - **Blocks**: T11, T12, T18, T28, T29
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `apps/web/src/app/globals.css` - CSS 변수 디자인 시스템. `--chart-1` ~ `--chart-5`, `--foreground`, `--background`, `--muted` 등 색상 변수
  - `apps/web/tailwind.config.js` - Tailwind 테마 설정. 차트 색상이 여기서도 정의됨
  - `apps/web/src/app/(authenticated)/dashboard/page.tsx:AreaChart, PieChart` - 현재 Recharts 사용 패턴. 동일한 데이터 구조를 Nivo로 변환해야 함

  **External References**:
  - Nivo theming: https://nivo.rocks/guides/theming/
  - Nivo Line: https://nivo.rocks/line/
  - Nivo Pie: https://nivo.rocks/pie/
  - Nivo Bar: https://nivo.rocks/bar/

  **WHY Each Reference Matters**:
  - globals.css의 CSS 변수를 Nivo 테마에 매핑해야 다크/라이트 모드 전환 시 차트도 자동 전환
  - 현재 Recharts 데이터 구조를 파악해야 Nivo 데이터 포맷으로의 변환 유틸리티 설계 가능

  **Acceptance Criteria**:
  - [ ] Nivo 패키지 설치 확인: `grep "@nivo" apps/web/package.json`
  - [ ] `apps/web/src/components/charts/nivo-theme.ts` - 다크/라이트 테마 객체 export
  - [ ] `apps/web/src/components/charts/line-chart.tsx` - ResponsiveLine 래퍼 export
  - [ ] `apps/web/src/components/charts/pie-chart.tsx` - ResponsivePie 래퍼 export
  - [ ] `apps/web/src/components/charts/bar-chart.tsx` - ResponsiveBar 래퍼 export
  - [ ] `cd apps/web && npx tsc --noEmit` → 타입 에러 없음

  **QA Scenarios**:

  ```
  Scenario: Nivo 테마가 CSS 변수 참조 확인
    Tool: Bash
    Preconditions: nivo-theme.ts 생성 완료
    Steps:
      1. grep "chart-1\|chart-2\|foreground\|background" apps/web/src/components/charts/nivo-theme.ts
    Expected Result: CSS 변수 참조 존재 (hsl(var(--chart-1)) 등)
    Failure Indicators: 하드코딩된 색상값만 존재
    Evidence: .sisyphus/evidence/task-6-theme-vars.txt

  Scenario: 차트 래퍼 컴포넌트 export 검증
    Tool: Bash
    Preconditions: 차트 컴포넌트 생성 완료
    Steps:
      1. grep "export" apps/web/src/components/charts/index.ts
      2. LineChart, PieChart, BarChart export 확인
    Expected Result: 3개 컴포넌트 export
    Failure Indicators: export 누락
    Evidence: .sisyphus/evidence/task-6-chart-exports.txt
  ```

  **Commit**: YES
  - Message: `feat(web): add Nivo chart wrappers with dark theme integration`
  - Files: `apps/web/src/components/charts/*.tsx`, `apps/web/src/components/charts/nivo-theme.ts`, `apps/web/src/components/charts/index.ts`, `apps/web/package.json`
  - Pre-commit: `cd apps/web && npx tsc --noEmit`

- [ ] 7. 백엔드 - dashboards/dashboard_widgets/topology_positions 스키마 + CRUD API

  **What to do**:
  - `packages/shared/src/schema/index.ts`에 3개 테이블 추가:
    - `dashboards`: id, userId, name, description, isDefault, isShared, templateId, layoutConfig (jsonb), createdAt, updatedAt
    - `dashboard_widgets`: id, dashboardId, widgetType, config (jsonb), gridPosition (jsonb: {x,y,w,h}), createdAt
    - `topology_positions`: id, userId, deviceId, x, y, updatedAt (unique: userId+deviceId)
  - Drizzle relations 정의 (dashboards → dashboard_widgets, dashboards → users)
  - `apps/api/src/routes/dashboards.ts` 생성:
    - `GET /api/dashboards` - 사용자 대시보드 목록 (본인 + shared)
    - `POST /api/dashboards` - 대시보드 생성
    - `GET /api/dashboards/:id` - 대시보드 상세 (위젯 포함)
    - `PUT /api/dashboards/:id` - 대시보드 업데이트 (레이아웃, 위젯 설정)
    - `DELETE /api/dashboards/:id` - 대시보드 삭제
    - `POST /api/dashboards/:id/duplicate` - 대시보드 복제
  - `apps/api/src/routes/topology.ts` 수정 또는 생성:
    - `GET /api/topology/positions` - 사용자별 노드 위치 조회
    - `PUT /api/topology/positions` - 노드 위치 일괄 저장 (배열)
  - `apps/api/src/index.ts`에 새 라우트 등록
  - Drizzle migration 생성: `npx drizzle-kit generate`

  **Must NOT do**:
  - 기존 API 엔드포인트 수정
  - 대시보드 RBAC (v1은 본인 대시보드 + shared 플래그만)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T2, T3, T4, T5, T6, T8)
  - **Blocks**: T9, T25
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `packages/shared/src/schema/index.ts` - 기존 Drizzle 스키마 패턴. pgTable, relations, enum 사용법
  - `apps/api/src/routes/devices.ts` - CRUD 라우트 패턴 (Fastify route handler, 페이지네이션, 에러 처리)
  - `apps/api/src/routes/setup.ts` - system_settings 테이블 사용 패턴 (jsonb 컬럼 참고)
  - `apps/api/src/index.ts` - 라우트 등록 패턴 (`app.register(routes, { prefix })`)
  - `apps/api/src/middleware/auth.ts` - 인증 미들웨어 적용 패턴

  **API/Type References**:
  - `packages/shared/src/schema/index.ts:users` - userId FK 참조
  - `packages/shared/src/schema/index.ts:devices` - deviceId FK 참조 (topology_positions)

  **WHY Each Reference Matters**:
  - 기존 스키마 패턴을 정확히 따라야 Drizzle migration이 깨끗하게 생성됨
  - devices.ts의 CRUD 패턴을 복제하면 일관된 API 구조 유지

  **Acceptance Criteria**:
  - [ ] `packages/shared/src/schema/index.ts`에 dashboards, dashboard_widgets, topology_positions 테이블 정의
  - [ ] `apps/api/src/routes/dashboards.ts` - 6개 엔드포인트 (GET list, POST, GET detail, PUT, DELETE, POST duplicate)
  - [ ] `apps/api/src/routes/topology.ts` 또는 기존 파일에 positions GET/PUT 추가
  - [ ] `curl -X POST http://localhost:4000/api/dashboards` → 201 응답
  - [ ] `curl http://localhost:4000/api/dashboards` → 200 + 배열 응답
  - [ ] Drizzle migration 파일 생성됨

  **QA Scenarios**:

  ```
  Scenario: 대시보드 CRUD API 동작 확인
    Tool: Bash (curl)
    Preconditions: API 서버 실행 중, 인증 토큰 확보
    Steps:
      1. curl -X POST http://localhost:4000/api/dashboards -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Test Dashboard","description":"test"}'
      2. 응답에서 id 추출
      3. curl http://localhost:4000/api/dashboards/$ID -H "Authorization: Bearer $TOKEN"
      4. curl -X DELETE http://localhost:4000/api/dashboards/$ID -H "Authorization: Bearer $TOKEN"
    Expected Result: POST→201, GET→200 with dashboard data, DELETE→200
    Failure Indicators: 4xx/5xx 응답
    Evidence: .sisyphus/evidence/task-7-dashboard-crud.txt

  Scenario: 토폴로지 위치 저장/조회
    Tool: Bash (curl)
    Preconditions: API 서버 실행 중
    Steps:
      1. curl -X PUT http://localhost:4000/api/topology/positions -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '[{"deviceId":"dev1","x":100,"y":200}]'
      2. curl http://localhost:4000/api/topology/positions -H "Authorization: Bearer $TOKEN"
    Expected Result: PUT→200, GET→200 with positions array
    Failure Indicators: 4xx/5xx 응답
    Evidence: .sisyphus/evidence/task-7-topology-positions.txt
  ```

  **Commit**: YES
  - Message: `feat(api): add dashboard and topology position schemas and CRUD API`
  - Files: `packages/shared/src/schema/index.ts`, `apps/api/src/routes/dashboards.ts`, `apps/api/src/index.ts`, `packages/shared/drizzle/migrations/*`
  - Pre-commit: `cd apps/api && npx vitest run`

- [ ] 8. 백엔드 - 기존 라우트에 logAudit() 와이어링 + config snapshot diff 엔드포인트

  **What to do**:
  - 기존 CRUD 라우트에 `logAudit()` 호출 추가:
    - `routes/devices.ts` - POST (create), PUT (update), DELETE (delete)
    - `routes/incidents.ts` - PUT (acknowledge, resolve)
    - `routes/alert-rules.ts` - POST, PUT, DELETE
    - `routes/notifications.ts` - POST, PUT, DELETE (채널 관리)
    - `routes/maintenance-windows.ts` - POST, PUT, DELETE
    - `routes/setup.ts` - PUT (site settings 변경)
  - `routes/config-snapshots.ts`에 diff 엔드포인트 추가:
    - `GET /api/config-snapshots/:id1/diff/:id2` - 두 스냅샷 간 텍스트 diff 반환
    - diff 라이브러리 사용 (`diff` npm 패키지) 또는 간단한 line-by-line 비교

  **Must NOT do**:
  - 기존 API 응답 형식 변경
  - 새로운 라우트 모듈 추가 (기존 파일에 추가만)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T2, T3, T4, T5, T6, T7)
  - **Blocks**: T14, T15
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `apps/api/src/routes/audit-logs.ts` - audit_logs 테이블 쿼리 패턴
  - `packages/shared/src/schema/index.ts:auditLogs` - audit_logs 스키마 (action, userId, targetType, targetId, details, ipAddress)
  - `apps/api/src/routes/devices.ts` - CRUD 핸들러 구조. logAudit 호출 삽입 위치
  - `apps/api/src/routes/config-snapshots.ts` - 기존 스냅샷 CRUD. diff 엔드포인트 추가 위치

  **WHY Each Reference Matters**:
  - audit_logs 스키마를 보면 어떤 필드를 채워야 하는지 알 수 있음
  - 기존 라우트 핸들러의 request.user 접근 패턴을 따라야 userId 추출 가능

  **Acceptance Criteria**:
  - [ ] devices, incidents, alert-rules, notifications, maintenance-windows, setup 라우트에 logAudit 호출 추가
  - [ ] `GET /api/config-snapshots/:id1/diff/:id2` → 200 + diff 결과
  - [ ] `cd apps/api && npx vitest run` → 기존 테스트 통과
  - [ ] `curl http://localhost:4000/api/audit-logs` → 200 + 비어있지 않은 배열 (CRUD 작업 후)

  **QA Scenarios**:

  ```
  Scenario: audit log 와이어링 확인
    Tool: Bash (curl)
    Preconditions: API 서버 실행 중, 디바이스 1개 이상 존재
    Steps:
      1. curl -X POST http://localhost:4000/api/devices -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"AuditTest","hostname":"audit.test","type":"server","status":"active"}'
      2. curl http://localhost:4000/api/audit-logs -H "Authorization: Bearer $TOKEN"
      3. 응답에서 "device.create" 또는 유사한 action 확인
    Expected Result: audit-logs에 새 항목 존재
    Failure Indicators: audit-logs 비어있음
    Evidence: .sisyphus/evidence/task-8-audit-wiring.txt

  Scenario: config snapshot diff 엔드포인트
    Tool: Bash (curl)
    Preconditions: config snapshots 2개 이상 존재
    Steps:
      1. curl http://localhost:4000/api/config-snapshots/:id1/diff/:id2 -H "Authorization: Bearer $TOKEN"
      2. 응답에 diff 결과 포함 확인
    Expected Result: 200 + diff 데이터 (added/removed lines)
    Failure Indicators: 404 또는 500
    Evidence: .sisyphus/evidence/task-8-config-diff.txt
  ```

  **Commit**: YES
  - Message: `feat(api): wire audit logging to CRUD routes and add config snapshot diff`
  - Files: `apps/api/src/routes/devices.ts`, `apps/api/src/routes/incidents.ts`, `apps/api/src/routes/alert-rules.ts`, `apps/api/src/routes/notifications.ts`, `apps/api/src/routes/maintenance-windows.ts`, `apps/api/src/routes/setup.ts`, `apps/api/src/routes/config-snapshots.ts`
  - Pre-commit: `cd apps/api && npx vitest run`

- [ ] 9. 대시보드 프레임워크 (react-grid-layout, 위젯 추가/제거/리사이즈, 저장/로드)

  **What to do**:
  - apps/web/src/app/(authenticated)/dashboard/page.tsx 완전 재구축
  - react-grid-layout을 dynamic import (ssr: false)로 로드
  - 대시보드 상단 툴바: 대시보드 선택 드롭다운, 추가 버튼, 편집/뷰 모드 토글, 저장 버튼
  - 위젯 추가 패널: 10개 위젯 타입 목록, 클릭 시 그리드에 추가
  - 위젯 제거: 위젯 헤더의 X 버튼
  - 위젯 리사이즈: react-grid-layout 기본 리사이즈 핸들
  - 레이아웃 변경 시 자동 저장 (debounce 1초) via PUT /api/dashboards/:id
  - 대시보드 CRUD: 새 대시보드 생성 모달, 삭제 확인 다이얼로그
  - React Query로 대시보드 데이터 페칭 (useQuery/useMutation)
  - 편집 모드에서만 드래그/리사이즈 가능, 뷰 모드에서는 잠금

  **Must NOT do**:
  - 위젯 내부 구현 (이 태스크는 프레임워크만, 위젯은 T10-T24)
  - 위젯 간 통신 (T26에서 구현)
  - 대시보드 공유/템플릿 (T27에서 구현)
  - 모바일 편집 모드 (view-only)

  **Recommended Agent Profile**:
  - **Category**: deep
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (Wave 2 시작점)
  - **Parallel Group**: Wave 2
  - **Blocks**: T10-T24, T26, T27
  - **Blocked By**: T2, T3, T4, T5, T7

  **References**:
  **Pattern References**:
  - apps/web/src/app/(authenticated)/dashboard/page.tsx - 현재 대시보드 (543줄). 재구축 대상
  - apps/web/src/components/dashboard/types.ts - T5에서 정의한 위젯 타입/인터페이스
  - apps/web/src/components/dashboard/widget-registry.ts - T5에서 정의한 위젯 레지스트리
  - apps/web/src/components/dashboard/widget-wrapper.tsx - T5에서 정의한 위젯 래퍼

  **API/Type References**:
  - apps/api/src/routes/dashboards.ts - T7에서 생성한 대시보드 CRUD API

  **External References**:
  - react-grid-layout: https://github.com/react-grid-layout/react-grid-layout (이미 설치됨 v1.5.0)

  **WHY Each Reference Matters**:
  - 현재 대시보드의 데이터 구조를 이해해야 위젯 기본 설정을 올바르게 구성
  - T5의 위젯 인터페이스가 이 프레임워크의 핵심 계약

  **Acceptance Criteria**:
  - [ ] react-grid-layout이 SSR 없이 dynamic import로 로드됨
  - [ ] 대시보드 선택/생성/삭제 동작
  - [ ] 위젯 추가 패널에서 10개 타입 표시 (placeholder 위젯으로)
  - [ ] 위젯 드래그/리사이즈 동작 (편집 모드)
  - [ ] 레이아웃 변경 시 백엔드 저장 동작
  - [ ] cd apps/web && npx tsc --noEmit -> 타입 에러 없음

  **QA Scenarios**:

  Scenario: 대시보드 생성 및 위젯 추가
    Tool: Playwright
    Preconditions: 로그인 상태, 대시보드 페이지
    Steps:
      1. page.goto('/dashboard')
      2. page.click('[data-testid="create-dashboard-btn"]')
      3. page.fill('[data-testid="dashboard-name-input"]', 'Test Dashboard')
      4. page.click('[data-testid="dashboard-save-btn"]')
      5. page.click('[data-testid="add-widget-btn"]')
      6. page.click('[data-testid="widget-type-stat-card"]')
      7. page.locator('.react-grid-item').count() 확인
    Expected Result: 위젯 1개가 그리드에 추가됨
    Failure Indicators: react-grid-item 없음, 에러 발생
    Evidence: .sisyphus/evidence/task-9-dashboard-create.png

  Scenario: 편집 모드 잠금 확인
    Tool: Playwright
    Preconditions: 대시보드에 위젯 존재
    Steps:
      1. 뷰 모드에서 위젯 드래그 시도
      2. 위젯 위치 변경 안됨 확인
      3. 편집 모드 토글
      4. 위젯 드래그 시도
      5. 위젯 위치 변경됨 확인
    Expected Result: 뷰 모드에서 잠금, 편집 모드에서 드래그 가능
    Evidence: .sisyphus/evidence/task-9-edit-mode.png

  **Commit**: YES
  - Message: feat(web): add custom dashboard framework with react-grid-layout
  - Files: apps/web/src/app/(authenticated)/dashboard/page.tsx, apps/web/src/components/dashboard/*
  - Pre-commit: cd apps/web && npx tsc --noEmit

- [ ] 10. 위젯 - 통계 카드 (StatCardWidget)

  **What to do**:
  - apps/web/src/components/dashboard/widgets/stat-card-widget.tsx 생성
  - 설정 옵션 (max 5): metric (device_count/incident_count/uptime/custom), title, icon, thresholdWarning, thresholdCritical
  - React Query로 /api/dashboard/summary에서 데이터 페칭
  - 애니메이션 카운터 (현재 대시보드의 패턴 재사용)
  - 임계값 초과 시 색상 변경 (warning: amber, critical: red)
  - 위젯 레지스트리에 등록

  **Must NOT do**:
  - 위젯 설정 옵션 5개 초과

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T11, T12, T13-T17)
  - **Blocks**: T26
  - **Blocked By**: T5, T9

  **References**:
  - apps/web/src/app/(authenticated)/dashboard/page.tsx - 현재 stat card 구현 (애니메이션 카운터 패턴)
  - apps/web/src/components/dashboard/types.ts - StatCardConfig 인터페이스
  - apps/api/src/routes/dashboard.ts - /api/dashboard/summary 응답 구조

  **Acceptance Criteria**:
  - [ ] stat-card-widget.tsx 존재, 위젯 레지스트리에 등록
  - [ ] 대시보드에서 통계 카드 위젯 추가 시 데이터 표시
  - [ ] 임계값 색상 변경 동작

  **QA Scenarios**:

  Scenario: 통계 카드 데이터 표시
    Tool: Playwright
    Steps:
      1. 대시보드에 stat-card 위젯 추가
      2. page.locator('[data-testid="widget-stat-card"] .stat-value').textContent() 확인
    Expected Result: 숫자 값 표시 (0 이상)
    Evidence: .sisyphus/evidence/task-10-stat-card.png

  **Commit**: YES (groups with T11, T12)
  - Message: feat(web): add stat card widget
  - Files: apps/web/src/components/dashboard/widgets/stat-card-widget.tsx

- [ ] 11. 위젯 - 시계열 그래프 (TimeSeriesWidget, Nivo Line)

  **What to do**:
  - apps/web/src/components/dashboard/widgets/time-series-widget.tsx 생성
  - T6의 Nivo LineChart 래퍼 사용
  - 설정 옵션 (max 5): deviceId, metricName, timeRange, aggregation, showArea
  - React Query로 /api/metrics에서 시계열 데이터 페칭
  - 시간 범위 선택기 (1h/6h/24h/7d/30d)
  - 위젯 레지스트리에 등록

  **Must NOT do**:
  - 줌/팬 기능 (T30에서 구현)
  - 다중 메트릭 오버레이 (T30에서 구현)

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T10, T12, T13-T17)
  - **Blocks**: T26, T30
  - **Blocked By**: T5, T6, T9

  **References**:
  - apps/web/src/components/charts/line-chart.tsx - T6에서 생성한 Nivo Line 래퍼
  - apps/web/src/app/(authenticated)/devices/[id]/page.tsx - 현재 시계열 차트 구현 (Recharts AreaChart)
  - apps/api/src/routes/metrics.ts - /api/metrics 쿼리 파라미터 및 응답 구조

  **Acceptance Criteria**:
  - [ ] time-series-widget.tsx 존재, Nivo Line 사용
  - [ ] 대시보드에서 시계열 위젯 추가 시 차트 렌더링
  - [ ] 시간 범위 변경 시 데이터 갱신

  **QA Scenarios**:

  Scenario: 시계열 차트 렌더링
    Tool: Playwright
    Steps:
      1. 대시보드에 time-series 위젯 추가
      2. page.locator('[data-testid="widget-time-series"] svg').isVisible() 확인
    Expected Result: SVG 차트 렌더링됨
    Evidence: .sisyphus/evidence/task-11-time-series.png

  **Commit**: YES (groups with T10, T12)
  - Message: feat(web): add time-series widget with Nivo Line
  - Files: apps/web/src/components/dashboard/widgets/time-series-widget.tsx

- [ ] 12. 위젯 - 파이/도넛 차트 (PieChartWidget, Nivo Pie)

  **What to do**:
  - apps/web/src/components/dashboard/widgets/pie-chart-widget.tsx 생성
  - T6의 Nivo PieChart 래퍼 사용
  - 설정 옵션 (max 5): dataSource (device_status/incident_severity/device_type), innerRadius, enableArcLabels, title, colorScheme
  - React Query로 /api/dashboard/summary 또는 /api/devices에서 데이터 페칭
  - 위젯 레지스트리에 등록

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T10, T11, T13-T17)
  - **Blocks**: T26
  - **Blocked By**: T5, T6, T9

  **References**:
  - apps/web/src/components/charts/pie-chart.tsx - T6에서 생성한 Nivo Pie 래퍼
  - apps/web/src/app/(authenticated)/dashboard/page.tsx - 현재 Recharts PieChart 구현

  **Acceptance Criteria**:
  - [ ] pie-chart-widget.tsx 존재, Nivo Pie 사용
  - [ ] 대시보드에서 파이 차트 위젯 추가 시 도넛 차트 렌더링

  **QA Scenarios**:

  Scenario: 파이 차트 렌더링
    Tool: Playwright
    Steps:
      1. 대시보드에 pie-chart 위젯 추가
      2. page.locator('[data-testid="widget-pie-chart"] svg').isVisible() 확인
    Expected Result: SVG 도넛 차트 렌더링됨
    Evidence: .sisyphus/evidence/task-12-pie-chart.png

  **Commit**: YES (groups with T10, T11)
  - Message: feat(web): add pie/donut chart widget with Nivo Pie
  - Files: apps/web/src/components/dashboard/widgets/pie-chart-widget.tsx

- [ ] 13. Alert Rules CRUD 페이지

  **What to do**:
  - apps/web/src/app/(authenticated)/alert-rules/page.tsx 생성
  - T4의 공통 컴포넌트 사용 (DataTable, Pagination, FilterBar, EmptyState)
  - React Query로 /api/alert-rules CRUD
  - 테이블 컬럼: name, metric, operator, threshold, severity, device/group, enabled, actions
  - 생성/편집 모달: metric 선택, operator 선택, threshold 입력, severity 선택, device/group 선택, flap detection 설정, escalation 설정
  - 삭제 확인 다이얼로그
  - enabled/disabled 토글 (인라인)
  - Zod 클라이언트 검증

  **Must NOT do**:
  - Alert rule dry-run/테스트 기능
  - 새로운 백엔드 API 추가

  **Recommended Agent Profile**:
  - **Category**: unspecified-high
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T10-T12, T14-T17)
  - **Blocks**: T35
  - **Blocked By**: T2, T4

  **References**:
  - apps/web/src/app/(authenticated)/devices/page.tsx - CRUD 페이지 패턴 (테이블, 모달, 필터)
  - apps/web/src/components/shared/ - T4에서 추출한 공통 컴포넌트
  - apps/api/src/routes/alert-rules.ts - Alert Rules API (GET, POST, PUT, DELETE)
  - packages/shared/src/schema/index.ts:alertRules - 스키마 구조 (metric, operator, threshold, severity, flapThreshold, flapWindow, escalationMinutes)

  **Acceptance Criteria**:
  - [ ] alert-rules/page.tsx 존재
  - [ ] Alert Rule 생성/편집/삭제 동작
  - [ ] 테이블에 데이터 표시, 페이지네이션 동작
  - [ ] enabled 토글 동작

  **QA Scenarios**:

  Scenario: Alert Rule CRUD
    Tool: Bash (curl)
    Steps:
      1. curl POST /api/alert-rules -> 201
      2. curl GET /api/alert-rules -> 200, 생성된 rule 포함
      3. curl PUT /api/alert-rules/:id -> 200
      4. curl DELETE /api/alert-rules/:id -> 200
    Expected Result: 전체 CRUD 사이클 성공
    Evidence: .sisyphus/evidence/task-13-alert-rules-crud.txt

  Scenario: Alert Rules 페이지 렌더링
    Tool: Playwright
    Steps:
      1. page.goto('/alert-rules')
      2. page.locator('[data-testid="alert-rules-table"]').isVisible()
    Expected Result: 테이블 렌더링됨
    Evidence: .sisyphus/evidence/task-13-alert-rules-page.png

  **Commit**: YES
  - Message: feat(web): add alert rules management page
  - Files: apps/web/src/app/(authenticated)/alert-rules/page.tsx, apps/web/src/hooks/queries/use-alert-rules.ts

- [ ] 14. Audit Logs 뷰어 페이지

  **What to do**:
  - apps/web/src/app/(authenticated)/audit-logs/page.tsx 생성
  - T4의 공통 컴포넌트 사용 (DataTable, Pagination, FilterBar)
  - React Query로 /api/audit-logs 조회 (읽기 전용)
  - 테이블 컬럼: timestamp, user, action, targetType, targetId, ipAddress, details (expandable)
  - 필터: user, action type, date range
  - details 컬럼은 JSON을 접을 수 있는 형태로 표시

  **Must NOT do**:
  - Audit log 삭제/수정 기능 (읽기 전용)

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T10-T13, T15-T17)
  - **Blocks**: T35
  - **Blocked By**: T2, T4, T8

  **References**:
  - apps/api/src/routes/audit-logs.ts - Audit Logs API (GET, 필터 파라미터)
  - packages/shared/src/schema/index.ts:auditLogs - 스키마 구조

  **Acceptance Criteria**:
  - [ ] audit-logs/page.tsx 존재
  - [ ] 테이블에 audit log 데이터 표시
  - [ ] 필터 동작 (user, action, date range)
  - [ ] details JSON 접기/펼치기 동작

  **QA Scenarios**:

  Scenario: Audit Logs 페이지 렌더링
    Tool: Playwright
    Steps:
      1. page.goto('/audit-logs')
      2. page.locator('[data-testid="audit-logs-table"]').isVisible()
    Expected Result: 테이블 렌더링됨 (T8에서 와이어링한 데이터 존재)
    Evidence: .sisyphus/evidence/task-14-audit-logs.png

  **Commit**: YES
  - Message: feat(web): add audit logs viewer page
  - Files: apps/web/src/app/(authenticated)/audit-logs/page.tsx, apps/web/src/hooks/queries/use-audit-logs.ts

- [ ] 15. Config Snapshots 뷰어 + diff 페이지

  **What to do**:
  - apps/web/src/app/(authenticated)/config-snapshots/page.tsx 생성
  - T4의 공통 컴포넌트 사용
  - React Query로 /api/config-snapshots 조회
  - 테이블 컬럼: device, createdAt, hash, size, actions (view/diff)
  - 스냅샷 상세 보기: config 텍스트를 코드 블록으로 표시
  - Diff 뷰: 두 스냅샷 선택 -> /api/config-snapshots/:id1/diff/:id2 호출 -> side-by-side diff 표시
  - diff 표시는 간단한 added(green)/removed(red) 라인 하이라이팅

  **Must NOT do**:
  - 스냅샷 생성 UI (API는 있지만 보통 자동 수집)
  - 복잡한 diff 라이브러리 도입 (서버에서 diff 계산)

  **Recommended Agent Profile**:
  - **Category**: unspecified-high
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T10-T14, T16-T17)
  - **Blocks**: T35
  - **Blocked By**: T2, T4, T8

  **References**:
  - apps/api/src/routes/config-snapshots.ts - Config Snapshots API + T8에서 추가한 diff 엔드포인트
  - packages/shared/src/schema/index.ts:configSnapshots - 스키마 구조 (deviceId, config, hash)

  **Acceptance Criteria**:
  - [ ] config-snapshots/page.tsx 존재
  - [ ] 스냅샷 목록 테이블 표시
  - [ ] 스냅샷 상세 보기 (config 텍스트)
  - [ ] 두 스냅샷 diff 비교 동작

  **QA Scenarios**:

  Scenario: Config Snapshot diff 표시
    Tool: Playwright
    Steps:
      1. page.goto('/config-snapshots')
      2. 두 스냅샷 선택하여 diff 실행
      3. page.locator('[data-testid="diff-view"]').isVisible()
    Expected Result: added/removed 라인이 색상으로 구분됨
    Evidence: .sisyphus/evidence/task-15-config-diff.png

  **Commit**: YES
  - Message: feat(web): add config snapshots viewer with diff
  - Files: apps/web/src/app/(authenticated)/config-snapshots/page.tsx, apps/web/src/hooks/queries/use-config-snapshots.ts

- [ ] 16. Maintenance Windows CRUD 페이지

  **What to do**:
  - apps/web/src/app/(authenticated)/maintenance/page.tsx 생성
  - T4의 공통 컴포넌트 사용
  - React Query로 /api/maintenance-windows CRUD
  - 테이블 컬럼: name, devices/groups, startAt, endAt, recurring (cron), status (active/upcoming/past), actions
  - 생성/편집 모달: name, description, device/group 선택, 시작/종료 datetime picker, recurring cron 입력 (선택)
  - 상태 배지: active(green), upcoming(blue), past(gray)
  - datetime picker는 로컬 타임존 표시 + UTC 저장

  **Must NOT do**:
  - Maintenance window 중 알림 억제 로직 (백엔드 변경 필요)

  **Recommended Agent Profile**:
  - **Category**: unspecified-high
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T10-T15, T17)
  - **Blocks**: T35
  - **Blocked By**: T2, T4

  **References**:
  - apps/api/src/routes/maintenance-windows.ts - Maintenance Windows API (CRUD + /active)
  - packages/shared/src/schema/index.ts:maintenanceWindows - 스키마 구조 (name, description, startAt, endAt, cronExpression, deviceIds, groupIds)

  **Acceptance Criteria**:
  - [ ] maintenance/page.tsx 존재
  - [ ] Maintenance Window 생성/편집/삭제 동작
  - [ ] 상태 배지 (active/upcoming/past) 표시
  - [ ] datetime picker 동작

  **QA Scenarios**:

  Scenario: Maintenance Window CRUD
    Tool: Bash (curl)
    Steps:
      1. curl POST /api/maintenance-windows -> 201
      2. curl GET /api/maintenance-windows -> 200
      3. curl DELETE /api/maintenance-windows/:id -> 200
    Expected Result: CRUD 사이클 성공
    Evidence: .sisyphus/evidence/task-16-maintenance-crud.txt

  **Commit**: YES
  - Message: feat(web): add maintenance windows management page
  - Files: apps/web/src/app/(authenticated)/maintenance/page.tsx, apps/web/src/hooks/queries/use-maintenance-windows.ts

- [ ] 17. API Keys 관리 페이지

  **What to do**:
  - apps/web/src/app/(authenticated)/api-keys/page.tsx 생성
  - T4의 공통 컴포넌트 사용
  - React Query로 /api/api-keys CRD (update 없음)
  - 테이블 컬럼: name, prefix (마스킹된 키), createdAt, expiresAt, actions (revoke)
  - 생성 모달: name, expiresAt (선택)
  - 생성 후 raw key를 모달에 표시 (복사 버튼 포함, 닫기 전 확인 경고)
  - 삭제(revoke) 확인 다이얼로그

  **Must NOT do**:
  - API key 수정 기능 (CRD만, Update 없음)

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T10-T16)
  - **Blocks**: T35
  - **Blocked By**: T2, T4

  **References**:
  - apps/api/src/routes/api-keys.ts - API Keys API (GET, POST, DELETE)
  - packages/shared/src/schema/index.ts:apiKeys - 스키마 구조 (name, keyHash, keyPrefix, expiresAt)

  **Acceptance Criteria**:
  - [ ] api-keys/page.tsx 존재
  - [ ] API Key 생성 시 raw key 모달 표시
  - [ ] 복사 버튼 동작
  - [ ] Revoke(삭제) 동작

  **QA Scenarios**:

  Scenario: API Key 생성 및 표시
    Tool: Playwright
    Steps:
      1. page.goto('/api-keys')
      2. page.click('[data-testid="create-api-key-btn"]')
      3. page.fill('[data-testid="api-key-name"]', 'Test Key')
      4. page.click('[data-testid="api-key-submit"]')
      5. page.locator('[data-testid="api-key-raw"]').isVisible()
    Expected Result: raw key가 모달에 표시됨
    Evidence: .sisyphus/evidence/task-17-api-key-create.png

  **Commit**: YES
  - Message: feat(web): add API keys management page
  - Files: apps/web/src/app/(authenticated)/api-keys/page.tsx, apps/web/src/hooks/queries/use-api-keys.ts


- [ ] 18. 위젯 - Top N 바 차트 (TopNBarWidget, Nivo Bar)

  **What to do**:
  - apps/web/src/components/dashboard/widgets/top-n-bar-widget.tsx 생성
  - T6의 Nivo BarChart 래퍼 사용
  - 설정 옵션 (max 5): metric (cpu/memory/bandwidth/disk), count (5/10/15), sortOrder (desc/asc), title, layout (horizontal/vertical)
  - React Query로 /api/dashboard/top-devices에서 데이터 페칭
  - 바에 디바이스 이름 라벨, 값 표시
  - 위젯 레지스트리에 등록

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T19-T25)
  - **Blocked By**: T5, T6, T9

  **References**:
  - apps/web/src/components/charts/bar-chart.tsx - T6에서 생성한 Nivo Bar 래퍼
  - apps/api/src/routes/dashboard.ts - /api/dashboard/top-devices 응답 구조

  **Acceptance Criteria**:
  - [ ] top-n-bar-widget.tsx 존재, Nivo Bar 사용
  - [ ] 대시보드에서 Top N 위젯 추가 시 바 차트 렌더링

  **QA Scenarios**:

  Scenario: Top N 바 차트 렌더링
    Tool: Playwright
    Steps:
      1. 대시보드에 top-n-bar 위젯 추가
      2. page.locator('[data-testid="widget-top-n-bar"] svg').isVisible()
    Expected Result: 바 차트 렌더링됨
    Evidence: .sisyphus/evidence/task-18-top-n-bar.png

  **Commit**: YES (groups with T19-T24)
  - Message: feat(web): add Top N bar chart widget
  - Files: apps/web/src/components/dashboard/widgets/top-n-bar-widget.tsx

- [ ] 19. 위젯 - 알림 피드 (AlertFeedWidget)

  **What to do**:
  - apps/web/src/components/dashboard/widgets/alert-feed-widget.tsx 생성
  - 설정 옵션 (max 5): maxItems (5/10/20), severityFilter (all/critical/warning), showAcknowledged, title, autoScroll
  - React Query로 /api/dashboard/recent-alerts에서 데이터 페칭
  - 심각도별 색상 코딩 (critical: red, warning: amber, info: blue)
  - 각 알림 클릭 시 /incidents/:id로 네비게이션
  - Socket.IO 실시간 업데이트 (React Query 캐시 무효화 via T3)
  - 위젯 레지스트리에 등록

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T18, T20-T25)
  - **Blocked By**: T5, T9

  **References**:
  - apps/web/src/app/(authenticated)/dashboard/page.tsx - 현재 recent alerts 구현
  - apps/api/src/routes/dashboard.ts - /api/dashboard/recent-alerts 응답 구조
  - apps/web/src/lib/utils.ts - severity 색상 매핑 (severityColor, statusColor)

  **Acceptance Criteria**:
  - [ ] alert-feed-widget.tsx 존재
  - [ ] 알림 목록 표시, 심각도 색상 코딩
  - [ ] 알림 클릭 시 인시던트 상세 페이지로 이동

  **QA Scenarios**:

  Scenario: 알림 피드 렌더링 및 네비게이션
    Tool: Playwright
    Steps:
      1. 대시보드에 alert-feed 위젯 추가
      2. page.locator('[data-testid="widget-alert-feed"] .alert-item').first().click()
      3. page.url()이 /incidents/ 포함 확인
    Expected Result: 인시던트 상세 페이지로 이동
    Evidence: .sisyphus/evidence/task-19-alert-feed.png

  **Commit**: YES (groups with T18, T20-T24)
  - Message: feat(web): add alert feed widget
  - Files: apps/web/src/components/dashboard/widgets/alert-feed-widget.tsx

- [ ] 20. 위젯 - 상태 그리드/허니콤 (HoneycombWidget, Visx)

  **What to do**:
  - apps/web/src/components/dashboard/widgets/honeycomb-widget.tsx 생성
  - Visx를 사용하여 육각형 허니콤 그리드 구현 (Zabbix 허니콤 위젯 참고)
  - 각 셀 = 1 디바이스, 색상 = 상태 (up: green, warning: amber, down: red, unknown: gray)
  - 설정 옵션 (max 5): groupFilter, sortBy (status/name), cellSize, showLabels, title
  - React Query로 /api/devices에서 디바이스 목록 + 상태 페칭
  - 셀 호버 시 툴팁 (디바이스 이름, IP, 상태, 마지막 폴링)
  - 셀 클릭 시 /devices/:id로 네비게이션
  - 위젯 레지스트리에 등록

  **Must NOT do**:
  - 복잡한 물리 시뮬레이션 (정적 그리드 레이아웃)

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T18-T19, T21-T25)
  - **Blocked By**: T5, T9

  **References**:
  - Visx hexbin example: https://airbnb.io/visx/docs/hexbin
  - apps/api/src/routes/devices.ts - /api/devices 응답 구조 (status, hostname, type)
  - apps/web/src/lib/utils.ts - statusColor 매핑

  **Acceptance Criteria**:
  - [ ] honeycomb-widget.tsx 존재, Visx 사용
  - [ ] 육각형 셀이 디바이스 상태별 색상으로 렌더링
  - [ ] 호버 툴팁, 클릭 네비게이션 동작

  **QA Scenarios**:

  Scenario: 허니콤 렌더링 및 인터랙션
    Tool: Playwright
    Steps:
      1. 대시보드에 honeycomb 위젯 추가
      2. page.locator('[data-testid="widget-honeycomb"] svg').isVisible()
      3. 셀 호버 시 툴팁 표시 확인
    Expected Result: 육각형 그리드 렌더링, 툴팁 동작
    Evidence: .sisyphus/evidence/task-20-honeycomb.png

  **Commit**: YES (groups with T18-T19, T21-T24)
  - Message: feat(web): add honeycomb status grid widget with Visx
  - Files: apps/web/src/components/dashboard/widgets/honeycomb-widget.tsx

- [ ] 21. 위젯 - 지도 미니맵 (MapWidget, Leaflet)

  **What to do**:
  - apps/web/src/components/dashboard/widgets/map-widget.tsx 생성
  - Leaflet을 dynamic import (ssr: false)로 로드 (기존 maps 페이지 패턴 참고)
  - 설정 옵션 (max 5): centerLat, centerLng, zoom, groupFilter, title
  - React Query로 /api/devices에서 geo 좌표가 있는 디바이스 페칭
  - CircleMarker로 디바이스 표시, 상태별 색상
  - 마커 클릭 시 팝업 (디바이스 이름, IP, 상태)
  - 위젯 레지스트리에 등록

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T18-T20, T22-T25)
  - **Blocked By**: T5, T9

  **References**:
  - apps/web/src/app/(authenticated)/maps/page.tsx - 현재 Leaflet 지도 구현 (dynamic import, CircleMarker, 팝업 패턴)

  **Acceptance Criteria**:
  - [ ] map-widget.tsx 존재, Leaflet dynamic import
  - [ ] 지도에 디바이스 마커 표시
  - [ ] 마커 클릭 시 팝업

  **QA Scenarios**:

  Scenario: 지도 위젯 렌더링
    Tool: Playwright
    Steps:
      1. 대시보드에 map 위젯 추가
      2. page.locator('[data-testid="widget-map"] .leaflet-container').isVisible()
    Expected Result: Leaflet 지도 렌더링됨
    Evidence: .sisyphus/evidence/task-21-map-widget.png

  **Commit**: YES (groups with T18-T20, T22-T24)
  - Message: feat(web): add map minimap widget with Leaflet
  - Files: apps/web/src/components/dashboard/widgets/map-widget.tsx

- [ ] 22. 위젯 - 토폴로지 미니맵 (TopologyWidget, ReactFlow)

  **What to do**:
  - apps/web/src/components/dashboard/widgets/topology-widget.tsx 생성
  - ReactFlow를 dynamic import로 로드 (기존 topology 페이지 패턴 참고)
  - 설정 옵션 (max 5): groupFilter, showMinimap, fitView, title, interactable
  - React Query로 디바이스 + 인터페이스 데이터 페칭
  - 축소된 토폴로지 뷰 (읽기 전용, 드래그/줌만)
  - 노드 상태별 색상
  - 위젯 레지스트리에 등록

  **Must NOT do**:
  - 웨더맵 기능 (T25에서 구현)
  - 노드 편집/위치 저장 (메인 토폴로지 페이지에서만)

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T18-T21, T23-T25)
  - **Blocked By**: T5, T9

  **References**:
  - apps/web/src/app/(authenticated)/topology/page.tsx - 현재 ReactFlow 토폴로지 구현 (DeviceNode, 엣지, 미니맵)

  **Acceptance Criteria**:
  - [ ] topology-widget.tsx 존재, ReactFlow 사용
  - [ ] 축소된 토폴로지 뷰 렌더링
  - [ ] 노드 상태별 색상

  **QA Scenarios**:

  Scenario: 토폴로지 위젯 렌더링
    Tool: Playwright
    Steps:
      1. 대시보드에 topology 위젯 추가
      2. page.locator('[data-testid="widget-topology"] .react-flow').isVisible()
    Expected Result: ReactFlow 토폴로지 렌더링됨
    Evidence: .sisyphus/evidence/task-22-topology-widget.png

  **Commit**: YES (groups with T18-T21, T23-T24)
  - Message: feat(web): add topology minimap widget
  - Files: apps/web/src/components/dashboard/widgets/topology-widget.tsx

- [ ] 23. 위젯 - 시스템 정보 (SystemInfoWidget)

  **What to do**:
  - apps/web/src/components/dashboard/widgets/system-info-widget.tsx 생성
  - 설정 옵션 (max 5): showUptime, showVersion, showDeviceCount, showPollingStatus, title
  - 표시 항목: 시스템 업타임, 버전, 총 디바이스 수, 활성 인시던트 수, 마지막 폴링 시간
  - React Query로 /api/dashboard/summary + /api/health에서 데이터 페칭
  - 키-값 쌍 리스트 형태
  - 위젯 레지스트리에 등록

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T18-T22, T24-T25)
  - **Blocked By**: T5, T9

  **References**:
  - apps/api/src/routes/dashboard.ts - /api/dashboard/summary 응답
  - apps/api/src/index.ts - /api/health 엔드포인트

  **Acceptance Criteria**:
  - [ ] system-info-widget.tsx 존재
  - [ ] 시스템 정보 키-값 쌍 표시

  **QA Scenarios**:

  Scenario: 시스템 정보 표시
    Tool: Playwright
    Steps:
      1. 대시보드에 system-info 위젯 추가
      2. page.locator('[data-testid="widget-system-info"]').textContent()에 숫자 포함 확인
    Expected Result: 시스템 정보 표시됨
    Evidence: .sisyphus/evidence/task-23-system-info.png

  **Commit**: YES (groups with T18-T22, T24)
  - Message: feat(web): add system info widget
  - Files: apps/web/src/components/dashboard/widgets/system-info-widget.tsx

- [ ] 24. 위젯 - AI 요약 (AISummaryWidget)

  **What to do**:
  - apps/web/src/components/dashboard/widgets/ai-summary-widget.tsx 생성
  - 설정 옵션 (max 5): summaryType (latest_rca/network_health), maxLength, title, refreshInterval, showTimestamp
  - v1: 가장 최근 인시던트의 AI RCA 요약 표시
  - React Query로 /api/incidents (최근 1개, AI RCA 포함) 페칭
  - RCA가 없으면 "AI 분석 대기 중" 메시지
  - 마크다운 렌더링 (간단한 bold/italic/list만)
  - 위젯 레지스트리에 등록

  **Must NOT do**:
  - 새로운 AI 기능 추가
  - 대화형 AI 인터페이스 (인시던트 상세 페이지에 이미 있음)

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T18-T23, T25)
  - **Blocked By**: T5, T9

  **References**:
  - apps/web/src/app/(authenticated)/incidents/[id]/page.tsx - AI RCA 표시 패턴 (JSON 파싱, 구조화된 표시)
  - apps/api/src/routes/incidents.ts - /api/incidents 응답 (aiRca, aiSummary 필드)

  **Acceptance Criteria**:
  - [ ] ai-summary-widget.tsx 존재
  - [ ] 최근 인시던트 AI RCA 표시 또는 대기 메시지

  **QA Scenarios**:

  Scenario: AI 요약 위젯 렌더링
    Tool: Playwright
    Steps:
      1. 대시보드에 ai-summary 위젯 추가
      2. page.locator('[data-testid="widget-ai-summary"]').isVisible()
    Expected Result: AI 요약 텍스트 또는 대기 메시지 표시
    Evidence: .sisyphus/evidence/task-24-ai-summary.png

  **Commit**: YES (groups with T18-T23)
  - Message: feat(web): add AI summary widget
  - Files: apps/web/src/components/dashboard/widgets/ai-summary-widget.tsx

- [ ] 25. 토폴로지 웨더맵 업그레이드 (트래픽 색상, 대역폭 라벨, 노드 위치 저장, 배경 이미지)

  **What to do**:
  - apps/web/src/app/(authenticated)/topology/page.tsx 대폭 업그레이드
  - 링크(엣지)에 실시간 트래픽 데이터 오버레이:
    - 인터페이스 bandwidth_in/out 데이터를 /api/devices/:id/interfaces에서 페칭
    - 포트 사용률 계산: (current_bps / interface_speed) * 100
    - 색상 그라데이션: 0-50% green, 50-75% yellow, 75-90% orange, 90-100% red
    - 엣지 위에 대역폭 라벨 표시 (formatBps 유틸리티 사용)
  - 노드 위치 드래그 저장:
    - 노드 드래그 종료 시 PUT /api/topology/positions (T7에서 생성한 API)
    - 페이지 로드 시 GET /api/topology/positions로 저장된 위치 복원
    - 저장된 위치가 없으면 기존 자동 레이아웃 사용
  - 커스텀 배경 이미지:
    - 배경 이미지 URL 설정 (네트워크 다이어그램, 건물 평면도 등)
    - ReactFlow의 Background 컴포넌트 대신 CSS background-image 사용
  - 노드 상태 배지 개선: 상태 아이콘 + 색상 + 펄스 애니메이션 (critical)
  - React Query로 데이터 페칭, 30초 자동 갱신

  **Must NOT do**:
  - 새로운 폴링 로직 추가 (기존 메트릭 데이터 사용)
  - 히스토리 재생 기능
  - 500+ 노드 최적화 (v1은 100노드 이하 타겟)

  **Recommended Agent Profile**:
  - **Category**: deep
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T18-T24)
  - **Blocked By**: T7

  **References**:
  - apps/web/src/app/(authenticated)/topology/page.tsx - 현재 ReactFlow 토폴로지 (DeviceNode, smoothStepEdge, minimap)
  - apps/api/src/routes/devices.ts - /api/devices/:id/interfaces 응답 (bandwidth_in, bandwidth_out, speed)
  - apps/web/src/lib/utils.ts - formatBps, formatBytes 유틸리티
  - apps/api/src/routes/topology.ts - T7에서 생성한 positions API

  **Acceptance Criteria**:
  - [ ] 엣지에 트래픽 색상 그라데이션 표시
  - [ ] 엣지 위에 대역폭 라벨 (bps 단위)
  - [ ] 노드 드래그 후 위치 저장, 새로고침 시 복원
  - [ ] 배경 이미지 설정 가능
  - [ ] 노드 상태 배지 + critical 펄스 애니메이션

  **QA Scenarios**:

  Scenario: 웨더맵 트래픽 색상 표시
    Tool: Playwright
    Preconditions: 디바이스 + 인터페이스 데이터 존재
    Steps:
      1. page.goto('/topology')
      2. page.locator('.react-flow__edge').first().getAttribute('style') 또는 stroke 색상 확인
      3. 엣지 라벨에 bps 단위 텍스트 확인
    Expected Result: 엣지에 색상 + 대역폭 라벨 표시
    Failure Indicators: 기본 회색 엣지만 표시
    Evidence: .sisyphus/evidence/task-25-weathermap.png

  Scenario: 노드 위치 저장 및 복원
    Tool: Playwright
    Steps:
      1. page.goto('/topology')
      2. 노드를 새 위치로 드래그
      3. page.reload()
      4. 노드가 드래그한 위치에 있는지 확인
    Expected Result: 새로고침 후 노드 위치 유지
    Evidence: .sisyphus/evidence/task-25-position-save.png

  **Commit**: YES
  - Message: feat(web): upgrade topology to weathermap with traffic colors and position saving
  - Files: apps/web/src/app/(authenticated)/topology/page.tsx, apps/web/src/hooks/queries/use-topology.ts


- [ ] 26. 위젯 간 통신 시스템 (Zustand 호스트/시간범위 스토어, 위젯 구독)

  **What to do**:
  - apps/web/src/stores/dashboard-context.ts 생성:
    - useDashboardContextStore (Zustand): selectedHostId, selectedTimeRange, selectedSeverity
    - setSelectedHost(hostId), setTimeRange(range), setSeverity(severity) 액션
  - 위젯 래퍼(widget-wrapper.tsx) 수정:
    - 위젯이 context를 "broadcast" 또는 "listen" 할 수 있는 설정 추가
    - broadcast 위젯: 사용자 인터랙션 시 스토어 업데이트 (예: 허니콤에서 디바이스 클릭)
    - listen 위젯: 스토어 변경 시 자동 데이터 갱신 (예: 시계열 그래프가 선택된 호스트로 필터)
  - 위젯 설정 패널에 "연동" 토글 추가 (위젯별로 context 구독 on/off)
  - Zabbix 스타일: Host Navigator에서 호스트 선택 -> 연관 그래프/통계 자동 업데이트

  **Must NOT do**:
  - 복잡한 이벤트 버스 시스템 (Zustand 단일 스토어로 충분)
  - 위젯 간 직접 통신 (항상 스토어를 통해)

  **Recommended Agent Profile**:
  - **Category**: deep
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (T10-T12 완료 필요)
  - **Parallel Group**: Wave 4
  - **Blocks**: T27
  - **Blocked By**: T9, T10, T11, T12

  **References**:
  - apps/web/src/stores/index.ts - 기존 Zustand 스토어 패턴 (flat create())
  - apps/web/src/components/dashboard/widget-wrapper.tsx - T5에서 생성한 위젯 래퍼
  - apps/web/src/components/dashboard/types.ts - WidgetConfig에 broadcast/listen 설정 추가

  **Acceptance Criteria**:
  - [ ] dashboard-context.ts 존재, selectedHostId/selectedTimeRange 스토어
  - [ ] 허니콤 위젯에서 디바이스 클릭 시 시계열 위젯이 해당 디바이스 데이터로 갱신
  - [ ] 위젯 설정에서 연동 토글 on/off 동작

  **QA Scenarios**:

  Scenario: 위젯 간 통신 동작
    Tool: Playwright
    Preconditions: 대시보드에 허니콤 + 시계열 위젯 존재
    Steps:
      1. 허니콤 위젯에서 디바이스 셀 클릭
      2. 시계열 위젯의 데이터가 해당 디바이스로 변경되는지 확인
    Expected Result: 시계열 위젯이 선택된 디바이스의 메트릭 표시
    Evidence: .sisyphus/evidence/task-26-widget-communication.png

  **Commit**: YES
  - Message: feat(web): add widget-to-widget communication via Zustand context store
  - Files: apps/web/src/stores/dashboard-context.ts, apps/web/src/components/dashboard/widget-wrapper.tsx, apps/web/src/components/dashboard/types.ts

- [ ] 27. 대시보드 공유 + 빌트인 템플릿 3개 (Overview, Network, Alerts)

  **What to do**:
  - 대시보드 공유:
    - 대시보드 설정에 "공유" 토글 추가
    - isShared=true인 대시보드는 모든 사용자의 대시보드 목록에 표시 (읽기 전용)
    - 공유 대시보드 복제 기능 (POST /api/dashboards/:id/duplicate)
  - 빌트인 템플릿 3개:
    - apps/web/src/components/dashboard/templates/ 디렉토리
    - overview-template.ts: 통계 카드 4개 + 시계열 1개 + 파이 1개 + 알림 피드 1개
    - network-template.ts: 토폴로지 미니맵 + 지도 + Top N 대역폭 + 허니콤
    - alerts-template.ts: 알림 피드 (전체) + 통계 카드 (인시던트 수) + 파이 (심각도 분포)
  - 대시보드 생성 시 "템플릿에서 시작" 옵션
  - 템플릿 선택 UI (카드 형태, 미리보기 설명)

  **Must NOT do**:
  - 사용자 생성 템플릿 (빌트인 3개만)
  - 대시보드 RBAC (공유는 단순 플래그)

  **Recommended Agent Profile**:
  - **Category**: unspecified-high
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (T26 이후)
  - **Parallel Group**: Wave 4 (with T28-T31)
  - **Blocked By**: T9, T26

  **References**:
  - apps/api/src/routes/dashboards.ts - POST /api/dashboards/:id/duplicate 엔드포인트
  - apps/web/src/components/dashboard/types.ts - Dashboard, DashboardLayout 타입

  **Acceptance Criteria**:
  - [ ] 대시보드 공유 토글 동작
  - [ ] 공유 대시보드가 다른 사용자에게 표시
  - [ ] 3개 빌트인 템플릿 존재
  - [ ] 템플릿에서 대시보드 생성 동작

  **QA Scenarios**:

  Scenario: 템플릿에서 대시보드 생성
    Tool: Playwright
    Steps:
      1. page.click('[data-testid="create-dashboard-btn"]')
      2. page.click('[data-testid="template-overview"]')
      3. 대시보드에 7개 위젯이 자동 배치되는지 확인
    Expected Result: Overview 템플릿의 위젯들이 자동 생성됨
    Evidence: .sisyphus/evidence/task-27-template-create.png

  **Commit**: YES
  - Message: feat(web): add dashboard sharing and built-in templates
  - Files: apps/web/src/components/dashboard/templates/*.ts, apps/web/src/app/(authenticated)/dashboard/page.tsx

- [ ] 28. 기존 페이지 차트 Nivo 마이그레이션 - Dashboard 페이지

  **What to do**:
  - apps/web/src/app/(authenticated)/dashboard/page.tsx에서 Recharts 제거
  - 대시보드가 T9에서 재구축되었으므로, 남아있는 Recharts 참조가 있다면 Nivo로 교체
  - 기본 대시보드(위젯 시스템 외부)에 Recharts가 남아있지 않도록 확인
  - Recharts import 제거

  **Must NOT do**:
  - 다른 페이지의 Recharts 수정 (T29에서)

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with T27, T29-T31)
  - **Blocks**: T31
  - **Blocked By**: T6, T11

  **References**:
  - apps/web/src/app/(authenticated)/dashboard/page.tsx - Recharts import 위치
  - apps/web/src/components/charts/ - T6에서 생성한 Nivo 래퍼

  **Acceptance Criteria**:
  - [ ] dashboard/page.tsx에 Recharts import 없음
  - [ ] 모든 차트가 Nivo 컴포넌트 사용

  **QA Scenarios**:

  Scenario: Recharts 제거 확인
    Tool: Bash
    Steps:
      1. grep -r "recharts" apps/web/src/app/(authenticated)/dashboard/
    Expected Result: 결과 없음 (Recharts 참조 제거됨)
    Evidence: .sisyphus/evidence/task-28-no-recharts-dashboard.txt

  **Commit**: YES (groups with T29)
  - Message: refactor(web): migrate dashboard charts from Recharts to Nivo
  - Files: apps/web/src/app/(authenticated)/dashboard/page.tsx

- [ ] 29. 기존 페이지 차트 Nivo 마이그레이션 - Device Detail 페이지

  **What to do**:
  - apps/web/src/app/(authenticated)/devices/[id]/page.tsx에서 Recharts 제거
  - CPU, 메모리, 대역폭 in/out 4개 차트를 Nivo LineChart 래퍼로 교체
  - 기존 시간 범위 선택기 (1h/6h/24h/7d/30d) 유지
  - 데이터 변환: Recharts 데이터 포맷 -> Nivo Serie[] 포맷

  **Must NOT do**:
  - 페이지 레이아웃 변경 (차트 컴포넌트만 교체)

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with T27, T28, T30-T31)
  - **Blocks**: T31
  - **Blocked By**: T6, T11

  **References**:
  - apps/web/src/app/(authenticated)/devices/[id]/page.tsx - 현재 Recharts AreaChart 4개
  - apps/web/src/components/charts/line-chart.tsx - T6 Nivo Line 래퍼

  **Acceptance Criteria**:
  - [ ] devices/[id]/page.tsx에 Recharts import 없음
  - [ ] 4개 차트 모두 Nivo LineChart 사용
  - [ ] 시간 범위 변경 시 차트 갱신

  **QA Scenarios**:

  Scenario: Device Detail 차트 Nivo 마이그레이션
    Tool: Playwright
    Steps:
      1. page.goto('/devices/[id]')
      2. page.locator('svg').count() >= 4 확인
      3. grep -r "recharts" apps/web/src/app/(authenticated)/devices/
    Expected Result: 4개 SVG 차트 렌더링, Recharts 참조 없음
    Evidence: .sisyphus/evidence/task-29-device-nivo.png

  **Commit**: YES (groups with T28)
  - Message: refactor(web): migrate device detail charts from Recharts to Nivo
  - Files: apps/web/src/app/(authenticated)/devices/[id]/page.tsx

- [ ] 30. 차트 고급 기능 (줌/팬, 다중 메트릭 오버레이, CSV 내보내기, 95th percentile)

  **What to do**:
  - apps/web/src/components/charts/line-chart.tsx 확장:
    - 줌/팬: 마우스 휠 줌, 드래그 팬 (Nivo의 built-in 또는 커스텀 SVG transform)
    - 줌 리셋 버튼
  - 다중 메트릭 오버레이:
    - LineChart에 여러 Serie를 전달하여 한 차트에 여러 메트릭 표시
    - 범례(legend)로 각 메트릭 구분
    - 디바이스 상세 페이지에서 CPU + 메모리를 한 차트에 오버레이 옵션
  - CSV 내보내기:
    - 차트 헤더에 다운로드 버튼
    - 현재 표시 중인 데이터를 CSV 문자열로 변환
    - Blob + URL.createObjectURL로 다운로드 트리거
  - 95th percentile:
    - /api/metrics에 percentile 파라미터 추가 요청 (또는 클라이언트 계산)
    - 차트에 95th percentile 수평선 표시 (Nivo markers 활용)

  **Must NOT do**:
  - 백엔드 API 변경 (클라이언트에서 percentile 계산)

  **Recommended Agent Profile**:
  - **Category**: deep
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with T27-T29, T31)
  - **Blocked By**: T11

  **References**:
  - apps/web/src/components/charts/line-chart.tsx - T6에서 생성한 Nivo Line 래퍼 (확장 대상)
  - Nivo markers: https://nivo.rocks/line/ (markers prop으로 수평선 추가)

  **Acceptance Criteria**:
  - [ ] 차트 줌/팬 동작 (마우스 휠 + 드래그)
  - [ ] 줌 리셋 버튼 동작
  - [ ] 다중 메트릭 오버레이 (2+ 라인 한 차트)
  - [ ] CSV 다운로드 버튼 동작
  - [ ] 95th percentile 수평선 표시

  **QA Scenarios**:

  Scenario: CSV 내보내기
    Tool: Playwright
    Steps:
      1. 시계열 차트가 있는 페이지로 이동
      2. page.click('[data-testid="chart-export-csv"]')
      3. 다운로드 이벤트 확인
    Expected Result: CSV 파일 다운로드됨
    Evidence: .sisyphus/evidence/task-30-csv-export.txt

  Scenario: 줌/팬 동작
    Tool: Playwright
    Steps:
      1. 차트 영역에서 마우스 휠 이벤트 발생
      2. 차트 뷰포트 변경 확인
      3. 리셋 버튼 클릭
      4. 원래 뷰포트로 복원 확인
    Expected Result: 줌/팬/리셋 동작
    Evidence: .sisyphus/evidence/task-30-zoom-pan.png

  **Commit**: YES
  - Message: feat(web): add chart zoom, pan, multi-metric overlay, CSV export, 95th percentile
  - Files: apps/web/src/components/charts/line-chart.tsx, apps/web/src/components/charts/chart-utils.ts

- [ ] 31. Recharts 의존성 제거 + 번들 정리

  **What to do**:
  - ast_grep_search로 전체 코드베이스에서 recharts import 검색
  - 남아있는 Recharts 참조가 있다면 Nivo로 교체
  - package.json에서 recharts 의존성 제거
  - yarn install로 lockfile 업데이트
  - 빌드 확인: npx tsc --noEmit + next build

  **Must NOT do**:
  - Nivo 외 다른 차트 라이브러리 추가

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (T28, T29 완료 후)
  - **Parallel Group**: Wave 4 (마지막)
  - **Blocked By**: T28, T29

  **References**:
  - apps/web/package.json - recharts 의존성 위치

  **Acceptance Criteria**:
  - [ ] grep -r "recharts" apps/web/src/ -> 결과 없음
  - [ ] apps/web/package.json에 recharts 없음
  - [ ] cd apps/web && npx tsc --noEmit -> 에러 없음

  **QA Scenarios**:

  Scenario: Recharts 완전 제거 확인
    Tool: Bash
    Steps:
      1. grep -r "recharts" apps/web/src/
      2. grep "recharts" apps/web/package.json
      3. cd apps/web && npx tsc --noEmit
    Expected Result: 모든 grep 결과 없음, tsc 성공
    Evidence: .sisyphus/evidence/task-31-recharts-removed.txt

  **Commit**: YES
  - Message: chore(web): remove Recharts dependency after full Nivo migration
  - Files: apps/web/package.json, yarn.lock


- [ ] 32. 전체 UI 데이터 밀도 개선 - Dashboard, Devices, Incidents 페이지

  **What to do**:
  - 데이터 밀도 높이기 (Zabbix 스타일):
    - 패딩/마진 축소 (카드 p-6 -> p-4, gap-6 -> gap-3)
    - 폰트 사이즈 조정 (테이블 text-sm, 헤더 text-base)
    - 테이블 행 높이 축소 (py-4 -> py-2)
    - 더 많은 데이터를 한 화면에 표시
  - Dashboard 페이지:
    - 위젯 간 간격 축소
    - 통계 카드 컴팩트 모드
  - Devices 페이지:
    - 테이블에 더 많은 컬럼 표시 (기본 뷰에서 IP, 타입, 상태, CPU, 메모리, 업타임)
    - 컴팩트 카드 뷰
  - Incidents 페이지:
    - 인시던트 카드 컴팩트화
    - 인라인 상세 정보 (펼치기/접기)
  - 글로우 이펙트 유지하되 subtle하게 조정

  **Must NOT do**:
  - 기능 변경 (스타일링만)
  - 다크 테마 색상 변경

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with T33-T37)
  - **Blocked By**: T9, T28

  **References**:
  - apps/web/src/app/globals.css - CSS 변수, 글로우 유틸리티
  - apps/web/src/app/(authenticated)/dashboard/page.tsx - 현재 패딩/마진
  - apps/web/src/app/(authenticated)/devices/page.tsx - 현재 테이블 스타일
  - apps/web/src/app/(authenticated)/incidents/page.tsx - 현재 카드 스타일

  **Acceptance Criteria**:
  - [ ] 한 화면에 표시되는 데이터 양이 이전보다 30%+ 증가
  - [ ] 테이블 행 높이 축소됨
  - [ ] 글로우 이펙트 유지됨
  - [ ] 가독성 유지됨 (너무 빽빽하지 않게)

  **QA Scenarios**:

  Scenario: 데이터 밀도 비교
    Tool: Playwright
    Steps:
      1. page.goto('/devices')
      2. page.setViewportSize({ width: 1920, height: 1080 })
      3. page.locator('table tbody tr').count() 확인
    Expected Result: 이전보다 더 많은 행이 한 화면에 표시됨
    Evidence: .sisyphus/evidence/task-32-data-density.png

  **Commit**: YES (groups with T33)
  - Message: style(web): improve data density on dashboard, devices, incidents pages
  - Files: apps/web/src/app/(authenticated)/dashboard/page.tsx, devices/page.tsx, incidents/page.tsx, globals.css

- [ ] 33. 전체 UI 데이터 밀도 개선 - 나머지 페이지

  **What to do**:
  - T32와 동일한 데이터 밀도 개선을 나머지 페이지에 적용:
    - Reports 페이지
    - Users 페이지
    - Settings 페이지
    - AI 페이지
    - Alert Rules 페이지 (T13)
    - Audit Logs 페이지 (T14)
    - Config Snapshots 페이지 (T15)
    - Maintenance Windows 페이지 (T16)
    - API Keys 페이지 (T17)
  - 일관된 패딩/마진/폰트 사이즈 적용
  - 공통 컴포넌트(DataTable, FilterBar)의 기본 스타일이 컴팩트하도록 조정

  **Must NOT do**:
  - 기능 변경
  - 페이지별 다른 밀도 적용 (일관성 유지)

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with T32, T34-T37)
  - **Blocked By**: T13-T17

  **References**:
  - T32에서 적용한 스타일 패턴을 동일하게 적용

  **Acceptance Criteria**:
  - [ ] 모든 페이지에 일관된 데이터 밀도 적용
  - [ ] 공통 컴포넌트 기본 스타일 컴팩트화

  **QA Scenarios**:

  Scenario: 전체 페이지 일관성 확인
    Tool: Playwright
    Steps:
      1. 각 페이지 순회하며 스크린샷 캡처
      2. 패딩/마진 일관성 시각적 확인
    Expected Result: 모든 페이지에서 일관된 컴팩트 스타일
    Evidence: .sisyphus/evidence/task-33-consistency-*.png

  **Commit**: YES (groups with T32)
  - Message: style(web): improve data density on remaining pages
  - Files: apps/web/src/app/(authenticated)/*/page.tsx, apps/web/src/components/shared/*.tsx

- [ ] 34. 모바일 반응형 개선 - 사이드바 드로어, 테이블 카드 전환, 대시보드 view-only

  **What to do**:
  - 사이드바 모바일 드로어 개선:
    - 현재 Sheet 기반 드로어 개선 (더 넓은 터치 영역, 스와이프 닫기)
    - 모바일에서 사이드바 아이콘 크기 증가
  - 테이블 -> 카드 전환:
    - DataTable 컴포넌트에 모바일 카드 뷰 추가
    - md: 이하에서 자동으로 카드 레이아웃 전환
    - 카드에 주요 정보만 표시 (컬럼 우선순위)
  - 대시보드 모바일:
    - 편집 모드 비활성화 (view-only)
    - 위젯을 단일 컬럼으로 스택
    - react-grid-layout의 breakpoint 설정 활용
  - 차트 모바일:
    - 차트 높이 자동 조정
    - 범례 위치 조정 (하단으로)
  - 전체 페이지:
    - 375px 뷰포트에서 가로 스크롤 없음 확인
    - 터치 타겟 최소 44px

  **Must NOT do**:
  - 모바일 전용 컴포넌트 트리 생성
  - 모바일 전용 라우트/페이지

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with T32-T33, T35-T37)
  - **Blocked By**: T9, T32

  **References**:
  - apps/web/src/components/layout/app-shell.tsx - 현재 모바일 드로어 구현
  - apps/web/src/components/shared/data-table.tsx - T4에서 생성한 DataTable
  - apps/web/tailwind.config.js - Tailwind 브레이크포인트

  **Acceptance Criteria**:
  - [ ] 375px 뷰포트에서 모든 페이지 가로 스크롤 없음
  - [ ] 모바일에서 테이블이 카드 뷰로 전환
  - [ ] 모바일에서 대시보드 편집 버튼 비활성화
  - [ ] 터치 타겟 최소 44px

  **QA Scenarios**:

  Scenario: 모바일 가로 스크롤 없음 확인
    Tool: Playwright
    Steps:
      1. page.setViewportSize({ width: 375, height: 812 })
      2. 각 페이지 순회
      3. page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth) === false 확인
    Expected Result: 모든 페이지에서 가로 스크롤 없음
    Evidence: .sisyphus/evidence/task-34-mobile-*.png

  Scenario: 대시보드 모바일 view-only
    Tool: Playwright
    Steps:
      1. page.setViewportSize({ width: 375, height: 812 })
      2. page.goto('/dashboard')
      3. page.locator('[data-testid="edit-dashboard-btn"]').isDisabled() 또는 isHidden()
    Expected Result: 편집 버튼 비활성화/숨김
    Evidence: .sisyphus/evidence/task-34-mobile-dashboard.png

  **Commit**: YES
  - Message: style(web): improve mobile responsiveness across all pages
  - Files: apps/web/src/components/layout/app-shell.tsx, apps/web/src/components/shared/data-table.tsx, apps/web/src/app/(authenticated)/dashboard/page.tsx, globals.css

- [ ] 35. 앱 셸 개선 - 브레드크럼, 사이드바 메뉴 추가

  **What to do**:
  - 사이드바에 새 페이지 메뉴 항목 추가:
    - System 섹션: Alert Rules, Maintenance Windows, API Keys
    - Monitor 섹션: Audit Logs 추가
    - Network 섹션: Config Snapshots 추가
  - 브레드크럼 네비게이션:
    - apps/web/src/components/layout/breadcrumb.tsx 생성
    - Next.js usePathname() 기반 자동 생성
    - 헤더 아래 또는 콘텐츠 영역 상단에 배치
    - 예: Dashboard > Devices > Router-01
  - 사이드바 활성 상태 업데이트 (새 메뉴 항목에 대해)

  **Must NOT do**:
  - 사이드바 레이아웃 대폭 변경
  - 새로운 섹션 추가 (기존 3개 섹션에 배치)

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with T32-T34, T36-T37)
  - **Blocked By**: T13-T17

  **References**:
  - apps/web/src/components/layout/app-shell.tsx - 현재 사이드바 메뉴 구조 (Monitor, Network, System 섹션)

  **Acceptance Criteria**:
  - [ ] 사이드바에 Alert Rules, Audit Logs, Config Snapshots, Maintenance, API Keys 메뉴 존재
  - [ ] 각 메뉴 클릭 시 해당 페이지로 이동
  - [ ] 브레드크럼 표시 (현재 경로 기반)

  **QA Scenarios**:

  Scenario: 새 메뉴 항목 네비게이션
    Tool: Playwright
    Steps:
      1. page.click('[data-testid="nav-alert-rules"]')
      2. page.url()이 /alert-rules 포함 확인
      3. page.locator('[data-testid="breadcrumb"]').textContent()에 'Alert Rules' 포함 확인
    Expected Result: 메뉴 클릭 -> 페이지 이동 -> 브레드크럼 표시
    Evidence: .sisyphus/evidence/task-35-navigation.png

  **Commit**: YES
  - Message: feat(web): update app shell with new menu items and breadcrumb navigation
  - Files: apps/web/src/components/layout/app-shell.tsx, apps/web/src/components/layout/breadcrumb.tsx

- [ ] 36. 프론트엔드 유닛 테스트 - 공통 컴포넌트 + 위젯 + 훅

  **What to do**:
  - T1에서 설정한 Vitest 인프라 사용
  - 공통 컴포넌트 테스트:
    - DataTable: 렌더링, 정렬, 빈 상태
    - Pagination: 페이지 변경, 경계값
    - FilterBar: 필터 변경 콜백
    - EmptyState: 렌더링, 액션 버튼
    - ErrorBoundary: 에러 캐치, fallback 렌더링
  - 위젯 테스트 (주요 3개):
    - StatCardWidget: 데이터 렌더링, 임계값 색상
    - TimeSeriesWidget: Nivo 차트 렌더링 (mock 데이터)
    - AlertFeedWidget: 알림 목록 렌더링, 클릭 이벤트
  - 훅 테스트:
    - useSocket: 이벤트 리스너 등록/해제
    - React Query 훅: 데이터 페칭 (MSW 또는 mock)
  - 최소 30개 테스트 케이스

  **Must NOT do**:
  - E2E 테스트 (T37에서)
  - 모든 위젯 테스트 (주요 3개만)

  **Recommended Agent Profile**:
  - **Category**: unspecified-high
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with T32-T35, T37)
  - **Blocked By**: T1, T4, T5, T10-T24

  **References**:
  - apps/web/vitest.config.ts - T1에서 생성한 Vitest 설정
  - apps/web/src/components/shared/ - T4 공통 컴포넌트
  - apps/web/src/components/dashboard/widgets/ - T10-T24 위젯

  **Acceptance Criteria**:
  - [ ] 30+ 테스트 케이스 존재
  - [ ] cd apps/web && npx vitest run -> 모든 테스트 PASS
  - [ ] 공통 컴포넌트 5개 + 위젯 3개 + 훅 2개 테스트 커버

  **QA Scenarios**:

  Scenario: 유닛 테스트 실행
    Tool: Bash
    Steps:
      1. cd apps/web && npx vitest run --reporter=verbose
      2. 출력에서 테스트 수 확인
    Expected Result: 30+ tests passed, 0 failed
    Evidence: .sisyphus/evidence/task-36-unit-tests.txt

  **Commit**: YES (groups with T37)
  - Message: test(web): add unit tests for shared components, widgets, and hooks
  - Files: apps/web/src/__tests__/*.test.tsx, apps/web/src/components/**/__tests__/*.test.tsx

- [ ] 37. E2E 테스트 - Playwright 주요 플로우

  **What to do**:
  - T1에서 설정한 Playwright 인프라 사용
  - 주요 E2E 플로우 테스트:
    - 로그인 -> 대시보드 표시
    - 대시보드 생성 -> 위젯 추가 -> 드래그 -> 저장 -> 새로고침 -> 레이아웃 유지
    - 위젯 간 통신 (허니콤 클릭 -> 시계열 업데이트)
    - Alert Rules CRUD (생성 -> 목록 확인 -> 삭제)
    - 토폴로지 페이지 로드 -> 노드 드래그 -> 위치 저장
    - 모바일 뷰포트 (375px) -> 가로 스크롤 없음
    - 차트 CSV 내보내기
  - 최소 10개 E2E 테스트

  **Must NOT do**:
  - 모든 페이지의 모든 기능 테스트 (주요 플로우만)
  - 느린 테스트 (각 테스트 30초 이내)

  **Recommended Agent Profile**:
  - **Category**: unspecified-high
  - **Skills**: ["playwright"]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with T32-T36)
  - **Blocked By**: T1, T9, T13-T17

  **References**:
  - apps/web/playwright.config.ts - T1에서 생성한 Playwright 설정
  - apps/web/e2e/ - E2E 테스트 디렉토리

  **Acceptance Criteria**:
  - [ ] 10+ E2E 테스트 존재
  - [ ] npx playwright test -> 모든 테스트 PASS
  - [ ] 대시보드 CRUD + 위젯 드래그 + 위젯 통신 플로우 커버

  **QA Scenarios**:

  Scenario: E2E 테스트 실행
    Tool: Bash
    Steps:
      1. npx playwright test --reporter=list
      2. 출력에서 테스트 수 확인
    Expected Result: 10+ tests passed, 0 failed
    Evidence: .sisyphus/evidence/task-37-e2e-tests.txt

  **Commit**: YES (groups with T36)
  - Message: test(web): add E2E tests for major user flows
  - Files: apps/web/e2e/*.spec.ts


---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + linter + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp). Verify Recharts fully removed from package.json and no imports remain.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (dashboard with all 10 widgets, widget communication, topology weathermap). Test edge cases: empty state, invalid input, rapid actions, mobile viewport. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination. Verify no i18n, no custom themes, no public status page, no mobile-specific components, no more than 10 widget types.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `feat(web): add test infrastructure` → T1 | `feat(web): add React Query provider and hooks` → T2 | `feat(web): activate Socket.IO integration` → T3 | `feat(web): extract shared components` → T4 | `feat(web): add widget interface and registry` → T5 | `feat(web): add Nivo chart wrappers with dark theme` → T6 | `feat(api): add dashboard and topology position schemas` → T7 | `feat(api): wire audit logging and add config diff endpoint` → T8
- **Wave 2**: `feat(web): add dashboard framework with react-grid-layout` → T9 | `feat(web): add stat card, time-series, pie chart widgets` → T10-T12 | `feat(web): add alert rules page` → T13 | `feat(web): add audit logs page` → T14 | `feat(web): add config snapshots page` → T15 | `feat(web): add maintenance windows page` → T16 | `feat(web): add API keys page` → T17
- **Wave 3**: `feat(web): add remaining dashboard widgets` → T18-T24 | `feat(web): upgrade topology to weathermap style` → T25
- **Wave 4**: `feat(web): add widget communication system` → T26 | `feat(web): add dashboard sharing and templates` → T27 | `refactor(web): migrate charts to Nivo` → T28-T29 | `feat(web): add chart zoom, pan, export, percentile` → T30 | `chore(web): remove Recharts dependency` → T31
- **Wave 5**: `style(web): improve data density across all pages` → T32-T33 | `style(web): improve mobile responsiveness` → T34 | `feat(web): update app shell navigation` → T35 | `test(web): add unit and E2E tests` → T36-T37

---

## Success Criteria

### Verification Commands
```bash
cd apps/web && npx tsc --noEmit  # Expected: no errors
cd apps/web && npx vitest run    # Expected: all tests pass
cd apps/api && npx vitest run    # Expected: all tests pass (140+ existing + new)
npx playwright test              # Expected: all E2E tests pass
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] 10 widget types functional in custom dashboard
- [ ] Widget-to-widget communication working
- [ ] Dashboard save/load/share/template working
- [ ] Topology weathermap with traffic colors
- [ ] 5 new pages fully functional
- [ ] All charts migrated to Nivo/Visx
- [ ] Mobile responsive (375px, no horizontal scroll)
- [ ] Recharts removed from dependencies
- [ ] No console.log in production code
