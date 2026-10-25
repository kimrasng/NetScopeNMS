<div align="center">

[English](README.md) · **한국어**

# NetPulse

**모니터링, 장애 대응, AI 기반 분석을 하나로 연결하는 셀프 호스팅 네트워크 관리 시스템입니다.**

SNMP / ICMP 모니터링 · 실시간 토폴로지 · 시계열 지표 · 장애 대응 · 다중 채널 알림 · 접근 범위 제어

![Node.js](https://img.shields.io/badge/Node.js-22-5FA04E?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![License](https://img.shields.io/badge/license-ISC-blue)

[프로젝트 소개](#프로젝트-소개) · [아키텍처](#아키텍처) · [인프라](#인프라) · [주요 기능](#주요-기능) · [빠른 시작](#빠른-시작) · [개발](#개발)

</div>

## 프로젝트 소개

NetPulse는 네트워크 운영자가 **지금 무슨 일이 일어나는지, 무엇에 대응해야 하는지, 무엇이 바뀌었는지** 한곳에서 확인할 수 있도록 만든 시스템입니다. 관리 장비의 연결 상태와 성능 지표를 수집해 TimescaleDB에 이력을 저장하고, 알림 조건을 충족하면 장애를 생성하며, 같은 웹 콘솔에서 원인 분석과 대응을 이어갈 수 있습니다.

장비와 그룹 관리에 대시보드, 인터페이스 트래픽, 네트워크 토폴로지, 지리 지도, 유지보수 일정, 설정 스냅샷을 결합했습니다. 전체 네트워크 현황에서 문제가 발생한 장비로 이동해 지표와 장애 타임라인을 살펴보고, 수집한 설정을 비교하며, 장애를 확인하거나 해결 처리할 수 있습니다.

AI는 운영 데이터를 분석하는 선택 기능입니다. 설정한 공급자를 통해 장애 분석을 돕고, 자연어 질문을 제한된 읽기 전용 쿼리로 변환하거나 서술형 보고서를 작성할 수 있습니다. 폴링, 임계값 평가, 장애 처리는 AI 공급자를 설정하지 않아도 동작합니다.

### 이런 팀에 적합합니다

- **네트워크 운영자:** 라우터, 스위치, 서버 등 접근 가능한 SNMP 지원 장비를 중앙에서 모니터링하려는 경우.
- **운영 팀:** 임계값 알림, 장애 확인, 에스컬레이션, 유지보수 중 알림 억제와 감사 가능한 장애 이력이 필요한 경우.
- **관리자:** 사용자마다 서로 다른 장비나 그룹에 접근하도록 권한을 나누려는 경우.
- **개발자와 연동 담당자:** TypeScript 코드베이스, 문서화된 REST API, 폐기 가능한 API 키를 이용해 시스템을 확장하려는 경우.

NetPulse는 ICMP와 SNMP로 장비를 모니터링하며 실제 서비스의 네트워크 트래픽을 중계하지 않습니다. SSH를 통한 설정 수집은 운영자가 명시적으로 요청할 때 실행하는 별도 기능입니다. 수집할 수 있는 지표는 장비가 지원하는 MIB, 인증 정보와 네트워크 접근 가능 여부에 따라 달라집니다.

## 핵심 특징

| 영역 | 제공 기능 |
|---|---|
| **지속적인 모니터링** | 장비별 폴링 일정, 연결 상태, 지연 시간, CPU, 메모리, 인터페이스 처리량과 지표 이력. |
| **장애 대응** | 장비·그룹별 규칙, 반복 변동 억제, 복구, 장애 확인, 에스컬레이션 채널과 런북 링크. |
| **네트워크 구조 파악** | LLDP/ARP 탐색, 편집 가능한 토폴로지 그래프와 장비 위치 지도. |
| **AI 지원** | OpenAI, Gemini, Claude 또는 사용자 지정 공급자를 이용한 RCA, 채팅, 읽기 전용 데이터 질의와 서술형 보고서. |
| **알림** | SMTP, Telegram, Discord, Slack, Twilio SMS, PagerDuty, 웹훅, 앱 내 채널과 전송 이력. |
| **운영 콘솔** | Next.js와 AWS Cloudscape 기반 화면, 시스템·사용자 지정 대시보드, 접근 범위가 적용되는 보고서와 설정 비교. |
| **접근 제어** | 네 가지 역할, 장비·그룹별 조회 범위, 폐기 가능한 API 키, 세션 무효화와 감사 로그. |

## 아키텍처

NetPulse는 **배포 가능한 애플리케이션 두 개와 공용 패키지 네 개로 구성된 TypeScript 모노레포**입니다. Next.js 애플리케이션은 웹 콘솔을 제공하고, Fastify 애플리케이션은 REST API, 인증된 실시간 연결과 모니터링 서비스를 담당합니다. PostgreSQL/TimescaleDB는 애플리케이션 상태와 측정값을 영속적으로 저장하고, Redis는 BullMQ 작업 큐와 실행 일정을 지원합니다.

각 패키지는 코드의 책임을 나누는 경계이며 기본 배포에서 별도 서비스로 실행되는 것은 아닙니다. API를 시작하면 폴링, 임계값 평가, 알림 전송, 트랩 처리 워커가 함께 시작되고, 활성화된 경우 주기적 탐색도 실행됩니다. 제공되는 Compose 구성에서는 별도의 워커 컨테이너를 실행할 필요가 없습니다.

### 전체 시스템 구조

```mermaid
flowchart TB
    OP["운영자 / 관리자"]
    WEB["웹 콘솔 :3000<br/>Next.js · React · Cloudscape"]

    subgraph APIHOST["API 애플리케이션 :4000"]
        REST["REST /api<br/>인증 · 검증 · 접근 범위"]
        LIVE["Socket.IO /ws<br/>접근 범위에 따른 장비·장애 이벤트"]
        POLL["폴링 워커<br/>ICMP · SNMP"]
        RULES["임계값 엔진<br/>유지보수 · 장애"]
        TRAPS["UDP 트랩 수신기<br/>트랩 소비자"]
        DISC["탐색 엔진<br/>LLDP · ARP"]
        DELIVERY["전송 엔진<br/>아웃박스 · 에스컬레이션"]
        AI["AI 서비스<br/>RCA · 채팅 · 읽기 전용 질의"]
    end

    DB[("PostgreSQL 16 + TimescaleDB<br/>장비 · 지표 · 장애 · 아웃박스")]
    REDIS[("Redis 7 / BullMQ<br/>작업 · 실행 일정")]
    DEV["관리 장비<br/>라우터 · 스위치 · 서버"]
    PROVIDER["설정된 AI 공급자"]
    CHANNEL["설정된 알림 채널"]

    OP --> WEB
    WEB -->|"HTTP 요청"| REST
    WEB <-->|"인증된 실시간 이벤트"| LIVE
    REST --> DB
    REST -->|"실행 일정 변경"| REDIS
    REDIS --> POLL
    POLL <-->|"ICMP / SNMP"| DEV
    POLL -->|"측정값과 인터페이스 저장"| DB
    POLL -->|"metric-events"| REDIS
    REDIS --> RULES
    RULES -->|"장애와 전송 기록"| DB
    DEV -->|"SNMP 트랩"| TRAPS
    TRAPS --> REDIS
    TRAPS --> DB
    DISC <-->|"SNMP를 통한 LLDP / ARP"| DEV
    DISC --> DB
    DISC <--> REDIS
    DELIVERY <--> DB
    DELIVERY <--> REDIS
    DELIVERY --> CHANNEL
    REST --> AI
    AI <--> PROVIDER
    AI -->|"접근 범위가 적용된 데이터 조회"| DB
    POLL --> LIVE
    RULES --> LIVE
```

### 컴포넌트와 책임

| 컴포넌트 | 책임 | 주요 기술 |
|---|---|---|
| **`apps/web`** | 인증된 콘솔, 초기 설정 마법사, 장비·장애 화면, 대시보드, 지도, 토폴로지와 관리 기능. API를 호출하고 실시간 이벤트로 표시 데이터를 갱신합니다. | Next.js 14, React 18, Cloudscape, Recharts, ReactFlow, Leaflet, React Context |
| **`apps/api`** | 애플리케이션 시작, REST 라우트, 인증·인가, 감사 정책, Socket.IO, 임계값 평가, 장애 처리, 알림 조정과 SSH 수집. | Fastify 5, Socket.IO 4, Zod, Drizzle, BullMQ |
| **`packages/shared`** | DB 스키마·연결 도구, 마이그레이션, 샘플 데이터, 공용 타입, SNMP 검증과 API·웹에서 사용하는 응답 계약. | PostgreSQL, TimescaleDB, Drizzle, Zod |
| **`packages/polling-engine`** | 장비 폴링, 지표 저장, 인터페이스 갱신, 폴링 일정, SNMP 트랩 수신과 LLDP/ARP 탐색. | BullMQ, Redis, net-snmp, ICMP |
| **`packages/ai-engine`** | API의 접근 범위가 적용된 서비스에서 사용하는 공급자 어댑터와 AI 작업. | OpenAI, Gemini, Claude와 사용자 지정 공급자 연동 |
| **`packages/notification`** | 타입이 정의된 알림 데이터를 선택한 채널로 전송하는 어댑터. 일정 관리, 영속 전송 기록과 에스컬레이션은 API가 담당합니다. | 이메일, 메시징, SMS, PagerDuty와 웹훅 |
| **PostgreSQL / TimescaleDB** | 장비, 계정, 접근 설정, 장애, 알림 기록, 보고서, 스냅샷과 시계열 측정값의 영속 저장소. | PostgreSQL 16과 TimescaleDB |
| **Redis** | 큐 조정과 반복 작업 일정 관리. 장비 정보와 장애 이력의 기준 저장소는 아닙니다. | Redis 7, BullMQ |

### 모니터링 흐름: 장비에서 대시보드까지

```mermaid
sequenceDiagram
    autonumber
    participant Browser as 웹 콘솔
    participant API as Fastify API
    participant Queue as Redis / BullMQ
    participant Poll as 폴링 워커
    participant Device as 관리 장비
    participant DB as TimescaleDB
    participant Rules as 임계값 워커

    Browser->>API: 장비 생성 또는 수정
    API->>DB: 장비 정보와 폴링 설정 저장
    API->>Queue: 장비 폴링 일정 동기화
    loop 장비에 설정한 폴링 주기
        Queue->>Poll: 활성 장비 폴링
        Poll->>Device: ICMP 확인과 SNMP 요청
        Device-->>Poll: 연결 상태, 측정값과 인터페이스
        Poll->>DB: 측정값, 상태와 인터페이스 카운터 저장
        Poll->>Queue: metric-events 발행
        Poll->>API: 결과 콜백 호출
        API-->>Browser: 접근 범위에 맞는 device:updated / metric:updated
        Queue->>Rules: 지표 이벤트 평가
        Rules->>DB: 일치하는 규칙과 유지보수 상태 조회
        opt 장애 생성 또는 복구
            Rules->>DB: 장애, 타임라인과 알림 아웃박스 저장
            Rules->>API: 장애 콜백 호출
            API-->>Browser: 접근 범위에 맞는 incident:updated
        end
    end
    Browser->>API: 현재 조회 가능한 데이터 요청
    API-->>Browser: 권한이 적용된 장비 / 지표 / 장애 응답
```

폴링 일정은 장비 변경을 반영합니다. 폴링을 비활성화하거나 장비를 삭제하면 해당 일정을 제거하고, 주기를 바꾸면 일정을 갱신합니다. ICMP는 연결 상태와 지연 시간을, SNMP v1/v2c/v3는 장비가 지원하는 시스템·인터페이스 데이터를 제공합니다. CPU 사용률은 호스트 CPU 테이블에서 가져오고, 인터페이스는 장비의 실제 `ifIndex`를 유지합니다.

처리량은 누적 카운터 자체를 속도로 취급하지 않고 시간에 따른 인터페이스 옥텟 카운터의 변화량으로 계산합니다. 첫 측정에는 이전 카운터가 없어 처리량이 0으로 표시됩니다. 장비가 ping에 응답하더라도 필요한 MIB를 지원하지 않으면 일부 지표는 수집되지 않을 수 있습니다.

### 장애 수명주기와 알림 전송

임계값 평가는 활성 규칙의 지표 이름, 연산자, 임계값, 장비·그룹 범위를 사용합니다. 규칙에 장비와 그룹을 모두 지정하면 두 조건이 모두 일치해야 합니다. 반복 변동 억제 설정은 반복 실패가 장애로 전환되는 조건을 제어하며, 활성 유지보수 시간에는 알림을 억제합니다.

장비·규칙별 평가는 DB 트랜잭션 잠금으로 직렬화하고 오래된 지표 이벤트는 무시합니다. 장애 변경, 타임라인과 알림 아웃박스 기록을 같은 트랜잭션에 저장하므로, 외부 채널로 즉시 전송하는 데만 의존하지 않고 장애 이력과 통지 요청을 함께 보존합니다.

```mermaid
flowchart LR
    METRIC["지표 이벤트"] --> CHECK{"규칙 일치<br/>유지보수 중이 아님?"}
    CHECK -->|"실패 횟수 조건 충족"| PROBLEM["문제 발생"]
    PROBLEM -->|"운영자 확인"| ACK["확인됨"]
    PROBLEM -->|"정상 측정값"| RESOLVED["해결됨"]
    ACK -->|"복구 또는 해결 처리"| RESOLVED
    PROBLEM -->|"지연 시간 후에도 미확인"| ESC["에스컬레이션 채널"]
    PROBLEM --> OUTBOX[("알림 아웃박스")]
    RESOLVED --> OUTBOX
    ESC --> OUTBOX
    OUTBOX --> WORKER["전송 워커"]
    WORKER --> SENT["전송 완료"]
    WORKER -->|"전송 실패"| RETRY["백오프 / 재시도"]
    RETRY --> WORKER
    RETRY -->|"총 4회 시도 소진"| FAILED["실패와 오류 이력"]
```

전송 엔진은 처리 시점이 된 아웃박스 기록을 확인해 전송 작업을 큐에 넣습니다. 장애 알림은 지수 백오프로 총 4회까지 시도하며, HTTP 요청이 거부되면 성공으로 처리하지 않고 오류를 기록합니다. 장애가 더 이상 문제 상태가 아니면 에스컬레이션을 취소하고, 활성 유지보수 중에는 전송을 억제합니다. 채널 테스트는 즉시 전송 결과를 별도로 기록합니다.

트랩은 폴링과 별개의 입력 경로입니다. UDP 수신기는 설정된 커뮤니티 또는 SNMPv3 사용자를 허용하고, Redis를 거쳐 API의 트랩 소비자에 작업을 전달합니다. 링크 다운 트랩은 장애를 생성할 수 있고, 일치하는 링크 업 트랩은 해당 장애를 해결합니다. 트랩은 출발지 IP로 장비를 식별하므로 관리 주소는 고유해야 합니다.

### 탐색, 토폴로지와 설정 이력

- **탐색:** 주기적 또는 운영자 요청으로 실행하는 LLDP/ARP 작업이 이웃 관계를 저장하고 발견한 장비를 폴링과 동기화합니다.
- **토폴로지:** ReactFlow가 접근 범위에 맞는 네트워크 그래프를 표시합니다. 수동 연결, 자동 배치와 개인별 위치 저장을 지원합니다.
- **지리 지도:** Leaflet이 좌표가 있는 장비를 OpenStreetMap 타일에 표시하며, 타일을 사용할 수 없으면 경고합니다.
- **설정 스냅샷:** 운영자가 내용을 가져오거나 SSH 명령 수집을 요청합니다. SHA-256 해시로 변경을 식별하고 저장된 버전의 이력과 줄 단위 차이를 제공합니다. SSH 수집은 설정된 호스트 키 지문을 확인하고 연결 시간과 출력 크기를 제한합니다. 예약된 자동 SSH 백업은 구현되지 않았습니다.

### 데이터 저장 구조

스키마는 장비, 장애 대응과 관리 데이터를 중심으로 구성됩니다. 아래 그림은 주요 운영 데이터의 관계이며 모든 테이블이나 컬럼을 나타내지는 않습니다.

```mermaid
erDiagram
    DEVICE_GROUPS o|--o{ DEVICES : groups
    DEVICES ||--o{ INTERFACES : exposes
    DEVICES ||--o{ METRICS : measures
    DEVICES ||--o{ INCIDENTS : experiences
    ALERT_RULES o|--o{ INCIDENTS : triggers
    INCIDENTS ||--o{ INCIDENT_EVENTS : records
    INCIDENTS o|--o{ NOTIFICATIONS : produces
    NOTIFICATION_CHANNELS o|--o{ NOTIFICATIONS : delivers
    DEVICES ||--o{ CONFIG_SNAPSHOTS : captures
```

`metrics`는 과거 측정값을 저장하는 TimescaleDB 하이퍼테이블입니다. 장비와 인터페이스 정보는 현재 관리 대상을 표현하고, 장애와 이벤트는 대응 타임라인을 보존합니다. 알림 행은 영속 전송 아웃박스 역할도 합니다. 계정, 초대, API 키, 대시보드, 보고서, 유지보수 일정, AI 공급자와 감사 로그도 같은 DB에 저장합니다.

마이그레이션은 하이퍼테이블, 인덱스와 Timescale 정책을 초기화합니다. 업그레이드 시 과거 지표를 유지하며, 충돌하는 기존 인터페이스·장애 행은 `migration_archives`에 보존합니다.

### AI와 접근 제어의 경계

AI 공급자는 웹 UI에서 저장한 활성 설정 중에서 선택합니다. 장애 RCA는 해당 장비, 최근 지표와 관련 장애 정보를 사용합니다. 보고서는 수동으로 생성하는 가용성, 성능, 알림 요약 보고서와 함께 AI가 작성한 서술형 결과를 저장할 수 있습니다.

자연어 데이터 질문에서는 API가 생성된 SQL을 허용된 테이블·함수만 사용하는 단일 `SELECT`로 검증합니다. `devices`, `metrics`, `incidents`, `interfaces`에서 접근 범위가 적용된 공개 컬럼만 노출하고, 문장 실행 제한 시간이 5초인 읽기 전용 트랜잭션에서 실행해 최대 1,000행을 반환합니다. 결과 행은 콘솔에 표시됩니다. 공급자가 없거나 호출에 실패하면 임시 분석 결과 대신 오류를 반환합니다.

권한 검사는 콘솔뿐 아니라 API에서 수행합니다. 현재 계정의 활성 상태, 역할, 장비·그룹 범위를 리소스 조회, 대시보드, 보고서, AI 데이터 접근과 설정 스냅샷에 적용합니다. Socket.IO는 `/ws`에서 인증하고 장비 이벤트를 전송하기 전에 계정·세션 유효성과 장비 조회 권한을 다시 확인합니다. 비밀번호나 계정이 변경되면 이전 세션을 무효화합니다.

## 인프라

### 기본 배포 구성

제공되는 Compose 스택은 **웹, API, TimescaleDB와 Redis**를 실행합니다. API 컨테이너는 모니터링 워커를 포함하며 시작 전에 DB 마이그레이션을 수행합니다. SNMP 시뮬레이터 서비스 8개도 정의되어 있지만 명시적으로 선택해 사용하는 구성으로, 애플리케이션 실행에 필수는 아닙니다.

| 서비스 | 이미지 / 빌드 대상 | 호스트 공개 포트 | 영속 저장소 |
|---|---|---|---|
| `postgres` | `timescale/timescaledb:latest-pg16` | `5432/TCP` | `pgdata` |
| `redis` | `redis:7-alpine` | `6379/TCP` | `redisdata` |
| `api` | 루트 `Dockerfile`의 `api` 대상 | `4000/TCP`, `162/UDP` | 애플리케이션 상태는 PostgreSQL에 저장 |
| `web` | 루트 `Dockerfile`의 `web` 대상 | `3000/TCP` | 별도 애플리케이션 데이터 볼륨 없음 |

브라우저는 `NEXT_PUBLIC_API_URL`로 지정한 API 주소에 연결합니다. 웹 컨테이너가 자동으로 API 리버스 프록시 역할을 하지는 않습니다. REST 요청은 API 호스트의 `/api`, Socket.IO는 `/ws`를 사용합니다. TLS 리버스 프록시를 배치한다면 API 요청과 Socket.IO 연결 모두 Fastify로 전달해야 합니다.

### 네트워크 통신 경로

| 방향 | 프로토콜 / 포트 | 목적 |
|---|---|---|
| 브라우저 → 웹 | 기본 TCP 3000 | 콘솔 페이지와 정적 자원 |
| 브라우저 → API | 기본 TCP 4000 | REST API와 Socket.IO |
| API → PostgreSQL | TCP 5432 | 장비, 지표와 애플리케이션 상태 |
| API → Redis | TCP 6379 | 백그라운드 작업과 실행 일정 |
| API → 관리 장비 | ICMP와 설정된 SNMP 포트, 일반적으로 UDP 161 | 연결 확인, 지표 수집과 탐색 |
| 관리 장비 → API | Docker 호스트의 UDP 162 | 컨테이너 UDP 1162로 전달되는 트랩 |
| API → 관리 장비 | 설정된 SSH 포트 | 명시적으로 요청한 설정 수집 |
| API → 외부 공급자 | 공급자별 외부 연결 | AI 요청과 설정된 알림 전송 |

개발 서버를 직접 실행할 때 트랩 수신 포트의 기본값은 UDP 1162입니다. Docker에서는 컨테이너 UDP 1162로 고정하고 호스트 UDP 162를 공개합니다. 폴링 인증 정보를 설정해도 트랩 사용자는 자동 등록되지 않습니다.

### 백그라운드 서비스

| 서비스 | 실행 조건 / 주기 | 책임 |
|---|---|---|
| 폴링 | 장비별 설정 주기 | 장비 확인, 측정값·인터페이스 저장, 지표 이벤트 발행과 장비 상태 갱신 |
| 임계값 평가 | 큐에 들어온 지표 이벤트 | 규칙·유지보수·반복 변동 상태 평가, 장애 생성과 복구 |
| 트랩 처리 | UDP 트랩 수신 | 링크 이벤트 해석과 일치하는 장애 갱신 |
| 탐색 | `DISCOVERY_INTERVAL`초마다, 기본 3600초; 수동 실행도 지원 | LLDP/ARP 관계 수집과 장비 동기화 |
| 전송 / 에스컬레이션 | 매초 스케줄러 확인, 큐 기반 전송 | 처리 시점이 된 아웃박스 기록과 에스컬레이션 지연 처리 |

`/api/health`는 폴링, 임계값 평가, 전송, 트랩과 탐색의 준비 상태를 반환합니다. 비활성화된 선택 서비스는 준비된 것으로 처리합니다. 워커 준비 상태를 나타내는 것으로, 모든 관리 장비나 외부 공급자까지 정상 통신하는지 보장하는 검사는 아닙니다.

## 주요 기능

### 현황 파악과 보고서

- **장비 관리:** 장비·그룹 생성, 수정, 삭제, 필터, 페이지 구분, 좌표, SNMP 설정과 장비별 SSH 인증 정보. 비밀값을 빈칸으로 수정하면 기존에 설정된 값을 유지합니다.
- **대시보드:** 시스템 요약, 처리량, 상위 장비와 장애 현황. 요약·지표·장애·처리량·상위 장비·텍스트 위젯의 순서, 너비와 대상 장비를 지정할 수 있습니다. 개인 기본 대시보드를 저장할 수 있으며 공유 대시보드에도 조회자의 접근 범위가 적용됩니다.
- **지표와 보고서:** 과거 지표 차트와 수동 생성하는 가용성·성능·알림 요약·AI 서술형 보고서를 목록·상세 화면에서 확인합니다. 가용성은 과거 ping 측정값으로 계산합니다.
- **실시간 콘솔:** 모니터링 이벤트가 화면 데이터를 갱신하고, 필터·조회 기간을 변경하면 다시 조회합니다. 사이트 이름과 로고 설정을 헤더에 반영합니다.

### 운영과 관리

- **장애:** 확인, 복구, 타임라인, RCA, 런북 링크와 지연 에스컬레이션.
- **유지보수:** 장비·그룹별 일회성 일정과 명시적 IANA 시간대를 사용하는 반복 cron 일정. 반복 발생에도 최초 일정의 지속 시간을 유지합니다.
- **알림 이력:** SMTP, Telegram, Discord, Slack, Twilio SMS, PagerDuty, 웹훅과 앱 내 채널의 상태·오류. Telegram 링크는 장애 화면을 열며, 장애 확인은 NetPulse에서 수행합니다.
- **관리:** 7일 유효 JWT, 만료·폐기 가능한 API 키, 이메일에 연결된 초대, 역할·범위 제어와 인증 정보를 가린 변경 감사 로그.

## 빠른 시작

### 방법 A: Docker에서 애플리케이션 실행

저장소를 내려받은 뒤 루트 디렉터리에서 실행합니다.

```bash
cp .env.example .env
# Set NEXTAUTH_SECRET to a private random value before starting.
docker compose up -d --build api web
docker compose ps
```

이 명령은 API·웹과 의존 서비스인 PostgreSQL·Redis를 시작합니다. API 이미지는 시작 전에 마이그레이션을 적용합니다. `openssl rand -hex 32`로 서명 비밀키를 생성해 `.env`에 입력하세요. 저장된 SSH 키 암호화에도 사용하므로 값을 유지해야 합니다.

`http://localhost:3000`을 열어 첫 관리자 설정 마법사를 완료합니다. 미리 생성된 관리자 비밀번호는 없습니다.

### 방법 B: 로컬 개발 서버 실행

Node.js 22, Yarn 1.22.22, Docker와 Docker Compose가 필요합니다. 저장소 루트에서 실행합니다.

```bash
cp .env.example .env
# Edit .env; replace NEXTAUTH_SECRET with a private random value.
yarn install --frozen-lockfile
docker compose up -d postgres redis
yarn db:migrate
# Optional sample data; does not create an administrator.
yarn db:seed
yarn dev
```

`http://localhost:3000`에서 첫 관리자 설정을 완료합니다. API는 `http://localhost:4000`, Swagger는 `/docs`, 워커 상태 확인은 `/api/health`에서 제공합니다. `yarn dev:api`와 `yarn dev:web`으로 각 애플리케이션을 따로 실행할 수 있습니다.

API, 마이그레이션·시드 도구와 웹 설정은 루트 `.env`의 기본값을 읽습니다. 외부에서 주입한 환경 변수와 애플리케이션별 재정의가 우선합니다. 루트 환경 파일이 바뀌면 Turbo 빌드 캐시를 무효화합니다. 샘플 시드는 반복 실행할 수 있고, 폴링을 비활성화한 TEST-NET 주소를 사용하며, 운영 환경에서는 실행을 거부합니다.

`yarn db:migrate`는 저장소의 마이그레이션을 적용하고 지표 하이퍼테이블, 인덱스와 Timescale 정책을 초기화합니다. 업그레이드는 과거 지표를 보존하며 충돌하는 기존 인터페이스·장애 행은 `migration_archives`에 남깁니다. 실제 설치를 업그레이드하기 전에는 DB를 백업하세요.

### 설치 후 사용 순서

1. 웹 콘솔에서 설정 마법사로 첫 관리자 계정을 만듭니다.
2. 장비 그룹을 만들고 접근 가능한 주소, SNMP 인증 정보와 폴링 주기를 지정해 장비를 등록합니다.
3. 장비를 더 추가하기 전에 연결 상태, 인터페이스 데이터와 지표 이력을 확인합니다.
4. UI에서 알림 채널을 설정하고 전송 테스트를 실행합니다.
5. 알림 규칙을 만들고 장비·그룹 범위, 임계값, 반복 변동 억제 설정과 알림 채널을 선택합니다.
6. 예정된 작업에는 유지보수 일정을 등록하고 실제 장애는 장애 화면에서 확인·추적합니다.
7. 탐색을 실행해 토폴로지를 확인하고, 필요에 따라 대시보드, 보고서와 AI 공급자를 추가합니다.
8. 사용자를 초대하고 업무에 필요한 최소 장비·그룹 조회 범위와 역할을 부여합니다.

| 주소 | 목적 |
|---|---|
| `http://localhost:3000` | 웹 콘솔과 초기 설정 |
| `http://localhost:4000/docs` | 실행 중인 Swagger / OpenAPI 문서 |
| `http://localhost:4000/api/health` | 모니터링 워커 준비 상태 |

<details>
<summary><b>Docker 로그 확인, 중지와 재시작</b></summary>

```bash
docker compose logs -f api web
docker compose down
docker compose up -d api web
```

`docker compose down`은 이름 있는 볼륨을 유지합니다. `-v`를 추가하면 저장된 DB 데이터를 포함해 해당 볼륨을 삭제합니다.

</details>

## 배포와 설정

`NEXT_PUBLIC_API_URL`은 **사용자의 브라우저에서 접근 가능한 API 주소**로 지정하고, `CORS_ORIGIN`과 `WEB_ORIGIN`은 웹 주소에 맞춥니다. 브라우저 API 주소는 Docker 웹 빌드 인자로 컴파일되므로 변경 후 웹 이미지를 다시 빌드해야 합니다. Compose 실행에는 `NEXTAUTH_SECRET`이 필요합니다.

저장소의 Compose 파일은 시작용 구성으로 별도의 보안 강화 운영 오버레이가 아닙니다. DB·Redis 포트를 공개하고 PostgreSQL 기본 인증 정보를 사용하며 Redis 비밀번호는 설정하지 않습니다. 외부에 설치할 때는 Compose 서비스와 연결 URL을 함께 조정하고, 인프라 포트 접근 제한, HTTPS 처리와 업그레이드 전 DB 백업을 구성하세요. 환경 변수만 바꿔도 Compose 파일에 직접 지정한 DB 인증 정보가 교체되지는 않습니다.

### 환경 변수

| 변수 | 목적 | 기본값 |
|---|---|---|
| `DATABASE_URL` | Timescale/PostgreSQL 연결 | 로컬 `netpulse` DB |
| `REDIS_URL` | BullMQ Redis 연결 | `redis://localhost:6379` |
| `NEXTAUTH_SECRET` | JWT 서명과 SSH 키 암호화 | 개발용 대체값만 제공 |
| `NEXT_PUBLIC_API_URL` | 빌드 전에 설정하는 브라우저 API 주소 | `http://localhost:4000` |
| `WEB_ORIGIN` | 초대·알림 링크 | `http://localhost:3000` |
| `NEXTAUTH_URL` | 초대 링크의 대체 주소 | `http://localhost:3000` |
| `CORS_ORIGIN` | 허용할 브라우저·소켓 출처 | `http://localhost:3000` |
| `API_PORT` | API 직접 수신 포트 | `4000` |
| `LOG_LEVEL` | API 로그 수준 | `info` |
| `SNMP_TRAP_ENABLED` | UDP 트랩 수신기 실행 | `true` |
| `SNMP_TRAP_PORT` | 직접 실행 시 수신 포트 | `1162` |
| `SNMP_TRAP_COMMUNITY` | 허용할 v1/v2c 커뮤니티 | `public` |
| `SNMP_TRAP_USERS` | SNMPv3 USM 사용자 JSON 배열 | `[]` |
| `DISCOVERY_ENABLED` | 주기적 탐색 활성화 | `true` |
| `DISCOVERY_INTERVAL` | 탐색 주기, 초 단위 | `3600` |
| `NODE_ENV` | 실행 모드 | `development` |

**AI 공급자와 알림 채널은 웹 UI에서 설정합니다.** 기존 `ANTHROPIC_API_KEY`, `SMTP_*`, Telegram 등의 환경 변수만으로 사용 가능한 공급자·채널이 생성되지는 않습니다. Jira와 Kakao 어댑터는 제공하지 않습니다.

SNMPv3 장비·트랩 설정에는 `username`, `securityLevel`(`noAuthNoPriv`, `authNoPriv`, `authPriv`)과 선택한 보안 수준에 필요한 `authProtocol`(`MD5`/`SHA`), `authKey`, `privProtocol`(`DES`/`AES`), `privKey`가 포함됩니다. 트랩 사용자는 명시적으로 설정해야 하며 장비 폴링 인증 정보로 자동 등록되지 않습니다. 트랩은 출발지 IP로 장비를 식별하므로 관리 주소를 고유하게 지정하세요. Docker에서는 항상 컨테이너 UDP 1162에 바인딩하고 호스트 UDP 162를 공개합니다.

SSH 수집은 신뢰할 수 있는 `SHA256:...` Base64 또는 16진수 호스트 키 지문을 허용합니다. 지문은 별도의 신뢰할 수 있는 경로로 확인하세요. 저장된 개인키는 서명 비밀키로 암호화하므로 `NEXTAUTH_SECRET`을 변경하면 SSH 키를 다시 입력해야 합니다. 수집 명령은 장비·제조사에 따라 다르며 요청할 때만 실행됩니다.

## 개발

### 저장소 구조

```text
netscopeNMS/
|-- apps/
|   |-- api/
|   |   `-- src/
|   |       |-- index.ts             API bootstrap and worker lifecycle
|   |       |-- routes/              REST resource handlers
|   |       |-- middleware/          Authentication middleware
|   |       `-- services/            Access, incidents, delivery, AI and SSH
|   `-- web/
|       `-- src/
|           |-- app/                Setup, login and authenticated pages
|           |-- components/         Cloudscape console components
|           `-- lib/                API, auth, sockets and shared UI utilities
|-- packages/
|   |-- shared/src/                 Schema, DB tools, contracts and types
|   |-- polling-engine/src/         Polling, trap receiver and discovery
|   |-- ai-engine/src/              AI provider adapters
|   `-- notification/src/           Notification transport adapters
|-- scripts/                        Startup and regression harnesses
|-- snmpsim/                        SNMP simulator fixtures
`-- docs/                           Design notes and QA reports
```

Yarn 1.22 워크스페이스가 애플리케이션과 공용 패키지를 연결합니다. Turborepo는 개발·빌드·린트 작업을 조정하고, Vitest는 단위 테스트를, Playwright는 브라우저 흐름 검증을 담당합니다.

| 명령 | 목적 |
|---|---|
| `yarn dev` | API·웹 개발 작업 시작 |
| `yarn dev:api` / `yarn dev:web` | 애플리케이션 하나만 실행 |
| `yarn build` | 워크스페이스 패키지와 애플리케이션 빌드 |
| `yarn lint` | 워크스페이스 린트 실행 |
| `yarn test` / `yarn test:watch` | 단위 테스트 일회 실행 / 감시 모드 |
| `yarn db:migrate` | 저장소의 DB 마이그레이션 적용 |
| `yarn db:seed` | 선택적인 비운영 샘플 데이터 추가 |

### API 규칙

모든 리소스 엔드포인트는 `/api`를 사용합니다. 인증은 Bearer 자격 증명으로 JWT 또는 API 키를 받습니다. 목록 응답은 `{ data, pagination: { page, limit, total, totalPages } }`, 오류 응답은 `{ error, message? }` 형식입니다. 잘못된 본문, 식별자, 날짜, 좌표와 페이지 요청은 클라이언트 오류를 반환합니다. 일반 응답에서는 비밀값을 제외하며, 설정 여부 플래그로 폼에서 기존 인증 정보를 유지할 수 있습니다.

역할은 `super_admin`, `admin`, `operator`, `viewer`입니다. 장비 작업과 장애 조작에는 Operator 이상, 전역 설정에는 접근 범위 제한이 없는 관리자 권한이 필요합니다. 사용자 역할·활성 상태 변경과 삭제는 Super Admin만 수행할 수 있습니다. 제한된 사용자가 숨겨진 장비를 직접 요청하면 404를 반환합니다. 리소스 범위는 장비 목록뿐 아니라 보고서, 대시보드, AI 질의, 스냅샷과 실시간 이벤트에도 적용됩니다.

| 라우트 그룹 | 주요 작업 |
|---|---|
| `/auth`, `/setup` | 로그인·프로필·비밀번호, 초기 설정, 사이트 설정, 이메일 연결 초대와 계정 관리 |
| `/devices`, `/device-groups` | 장비, 인터페이스·이력 데이터와 그룹 |
| `/incidents`, `/alert-rules`, `/maintenance-windows` | 장애 수명주기, RCA, 댓글, 알림·유지보수 설정 |
| `/dashboard`, `/dashboards` | 시스템 집계와 사용자 지정 레이아웃·위젯 |
| `/topology`, `/discovery` | 접근 범위가 적용된 그래프, 위치, 연결과 탐색 작업 |
| `/metrics` | 시계열, 이상 징후와 추세 예측 |
| `/ai`, `/reports` | 공급자 관리, 질의·채팅·RCA와 보고서 생성 |
| `/notifications` | 전송 설정, 테스트와 페이지 단위 이력 |
| `/config-snapshots` | 가져오기, SSH 수집, 목록·상세·비교 |
| `/api-keys`, `/audit-logs`, `/health` | 연동 자격 증명, 감사와 워커 준비 상태 |

정확한 메서드와 스키마는 실행 중인 Swagger를 참고하세요. 공용 Zod 응답 계약은 보고서, 알림 이력, 초대, 지표와 AI 질의 결과를 정의하며 웹 클라이언트에서도 검증합니다.

### 검증

```bash
yarn install --frozen-lockfile
yarn test
yarn lint
yarn build
```

단위 테스트에는 API 접근, 폴링, 알림 어댑터, 반복 일정과 웹 요청·재조회 계약이 포함됩니다. DB·네트워크 회귀 검증 도구는 테스트 데이터를 생성·변경하므로 **폐기 가능한 로컬 서비스**가 필요합니다.

```bash
export TEST_API_URL=http://127.0.0.1:4000
export TEST_DATABASE_URL=postgresql://netpulse:password@127.0.0.1:5432/netpulse_qa
export TEST_REDIS_URL=redis://127.0.0.1:6379/1
export TEST_OUTPUT_DIR=/tmp/netpulse-qa
# Start the API using the same database and Redis, after yarn db:migrate.
# The integration harness requires an empty users table and reserves local port 14567.
yarn test:integration
yarn test:monitoring
yarn test:ssh
yarn test:features
# Uses the integration fixtures above, plus a running web and mock-services.mjs.
yarn playwright install chromium
yarn test:e2e
# Override TEST_DATABASE_URL with a separate completely empty database first.
yarn test:upgrade
```

모니터링 검증은 UDP 10161과 로컬 웹훅 포트 14568을, SSH 검증은 TCP 12122를 사용합니다. API 트랩 수신 포트가 1162가 아니면 `TEST_TRAP_PORT`를 설정하세요. `state.json`에는 비공개 테스트 인증 정보가 들어 있으므로 공개하면 안 됩니다. `*-results.json`은 민감 정보를 제거한 검증 자료입니다. [재검증 보고서](docs/qa/2026-10-02/RETEST_REPORT.md)는 실제 실행한 검사와 CI 설정상의 검증 범위를 구분하고 외부 검증의 한계를 기록합니다.

GitHub Actions는 Node.js 22에서 고정 잠금 파일 설치, 빌드, 린트, 단위 테스트, 로컬 API·UDP-SNMP·SSH 회귀 검증, Chromium E2E와 기존 DB 업그레이드 검사를 실행합니다. 업로드는 민감 정보를 제거한 결과 파일로 제한합니다.

## 문제 해결

<details>
<summary><b>콘솔은 열리지만 API 요청이 실패합니다</b></summary>

`docker compose ps`와 `docker compose logs api web`을 확인하세요. `NEXT_PUBLIC_API_URL`은 Docker 내부에서만이 아니라 브라우저에서 접근할 수 있어야 합니다. `CORS_ORIGIN`이 스킴과 포트를 포함해 실제 웹 출처와 일치하는지 확인하세요. 컴파일되는 API 주소를 변경했다면 웹 이미지를 다시 빌드해야 합니다.

</details>

<details>
<summary><b>장비가 ping에는 응답하지만 SNMP 지표가 없습니다</b></summary>

API 호스트에서 장비의 SNMP 포트에 접근 가능한지, 장비가 API 호스트의 출발지 주소를 허용하는지, 버전·커뮤니티 또는 SNMPv3 설정이 일치하는지 확인하세요. 장비에 따라 CPU·메모리·인터페이스 지표에 필요한 MIB를 제공하지 않을 수 있습니다. 인터페이스 처리량은 카운터 변화량 계산을 위해 두 번째 측정도 필요합니다.

</details>

<details>
<summary><b>트랩이 표시되지 않습니다</b></summary>

`SNMP_TRAP_ENABLED`, 허용 커뮤니티와 명시적으로 설정한 `SNMP_TRAP_USERS`를 확인하세요. 제공되는 Docker 배포에서는 호스트 UDP 162로, 직접 실행할 때는 설정한 수신 포트(기본 1162)로 보내야 합니다. 방화벽과 트랩 출발지 IP가 고유한 등록 장비에 일치하는지도 확인하세요.

</details>

<details>
<summary><b>AI 분석 또는 알림 전송이 실패합니다</b></summary>

웹 UI에서 공급자·채널을 생성하고 활성화하세요. 기존 환경 변수만으로 생성되지는 않습니다. 알림은 전송 이력의 상태·오류를 확인하고 채널 테스트를 실행하세요. AI는 활성 공급자의 인증 정보와 엔드포인트 접근 가능 여부를 확인하세요.

</details>

## 관련 문서

| 자료 | 내용 |
|---|---|
| [환경 변수 템플릿](.env.example) | 지원하는 애플리케이션 환경 설정 |
| [Compose 구성](docker-compose.yml) | 서비스, 의존 관계, 공개 포트와 시뮬레이터 |
| [DB 스키마](packages/shared/src/schema/index.ts) | 테이블, 필드와 관계 |
| [공용 응답 계약](packages/shared/src/contracts.ts) | 코드에서 검증하는 API 응답 형식 |
| [재검증 보고서](docs/qa/2026-10-02/RETEST_REPORT.md) | 실행한 QA, 근거와 외부 검증 한계 |
| [디자인 문서](docs/design/) | 콘솔 디자인 점검과 재설계 기록 |

## 라이선스

ISC
