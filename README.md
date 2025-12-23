# NetScopeNMS Backend

AI 기반 네트워크 관리 시스템 (Network Management System)

## 개요

NetScopeNMS는 net-snmp를 통해 네트워크 장비를 모니터링하고, OpenAI API를 활용하여 문제를 예측하는 실용적인 NMS 솔루션입니다.

### 주요 기능

- **SNMP 모니터링**: SNMPv1/v2c/v3 지원, 10~50대 장비 동시 모니터링
- **실시간 메트릭 수집**: CPU, 메모리, 네트워크 트래픽, 업타임 등
- **AI 기반 분석**: OpenAI API를 통한 문제 예측 및 근본 원인 분석
- **알람 시스템**: 임계값 기반 알람 및 규칙 관리
- **데이터 집계**: Raw → 시간별 → 일별 자동 집계

## 기술 스택

- **Backend**: Node.js, Express.js
- **Database**: MySQL (Sequelize ORM)
- **SNMP**: net-snmp
- **AI**: OpenAI API (GPT-4)
- **Scheduler**: node-cron
- **Authentication**: JWT
- **Documentation**: Swagger/OpenAPI 3.0

## 설치 및 실행

### 사전 요구사항

- Node.js >= 18.0.0
- MySQL >= 8.0
- npm 또는 yarn

### 1. 의존성 설치

```bash
cd backend
npm install
```

### 2. 환경변수 설정

```bash
cp .env.example .env
# .env 파일을 열어 설정값 입력
```

### 3. 데이터베이스 초기화

```bash
# MySQL에서 데이터베이스 생성
mysql -u root -p -e "CREATE DATABASE netscopenms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 스키마 적용
mysql -u root -p netscopenms < database/schema.sql

# 또는 Node.js 스크립트 실행
npm run db:init
```

### 4. 서버 실행

```bash
# 개발 모드 (nodemon)
npm run dev

# 프로덕션 모드
npm start
```

### 5. API 문서 확인

브라우저에서 `/api-docs` 접속

## API 엔드포인트 개요

### 장비 관리 (Devices)
- `GET /api/devices` - 장비 목록 조회
- `POST /api/devices` - 장비 등록
- `GET /api/devices/:id` - 장비 상세 조회
- `PUT /api/devices/:id` - 장비 수정
- `DELETE /api/devices/:id` - 장비 삭제
- `POST /api/devices/:id/test` - SNMP 연결 테스트

### 메트릭 조회 (Metrics)
- `GET /api/metrics/:deviceId` - 장비 메트릭 조회
- `GET /api/metrics/:deviceId/current` - 실시간 메트릭
- `GET /api/metrics/compare` - 장비 비교

### 알람 (Alarms)
- `GET /api/alarms` - 알람 목록
- `PUT /api/alarms/:id/resolve` - 알람 해결
- `CRUD /api/alarm-rules` - 알람 규칙 관리

### AI 분석 (AI)
- `POST /api/ai/analyze/:deviceId` - AI 분석 실행
- `GET /api/ai/predictions` - 예측 목록
- `GET /api/ai/report/daily` - 일일 리포트

### 사용자 (Users)
- `POST /api/auth/login` - 로그인
- `POST /api/auth/register` - 회원가입
- `GET /api/users/me` - 내 정보

## 지원 SNMP OID

### 시스템 정보
| 항목 | OID |
|------|-----|
| sysDescr | 1.3.6.1.2.1.1.1.0 |
| sysUpTime | 1.3.6.1.2.1.1.3.0 |
| sysName | 1.3.6.1.2.1.1.5.0 |

### CPU 사용률
| 벤더 | OID |
|------|-----|
| Cisco | 1.3.6.1.4.1.9.9.109.1.1.1.1.7 |
| Linux | 1.3.6.1.4.1.2021.11.9.0 |
| Generic | 1.3.6.1.2.1.25.3.3.1.2 |

### 네트워크 인터페이스
| 항목 | OID |
|------|-----|
| ifDescr | 1.3.6.1.2.1.2.2.1.2 |
| ifInOctets | 1.3.6.1.2.1.2.2.1.10 |
| ifOutOctets | 1.3.6.1.2.1.2.2.1.16 |
| ifHCInOctets (64bit) | 1.3.6.1.2.1.31.1.1.1.6 |
| ifHCOutOctets (64bit) | 1.3.6.1.2.1.31.1.1.1.10 |

##  보안

- JWT 기반 인증
- SNMP 자격증명 암호화 저장
- API Rate Limiting
- Helmet 보안 헤더
- CORS 설정