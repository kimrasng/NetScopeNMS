# NetScopeNMS Backend

AI 기반 네트워크 관리 시스템 (Network Management System)

## 주요 기능

- SNMP 모니터링 (SNMPv1/v2c/v3)
- 실시간 메트릭 수집 (CPU, 메모리, 트래픽)
- AI 기반 분석 (OpenAI GPT-4)
- 알람 시스템 및 규칙 관리
- 데이터 자동 집계 (Raw → 시간별 → 일별)

## 빠른 시작 (Docker)

### 1. 환경 설정

```bash
cp .env.example .env
```

`.env` 파일에서 OpenAI API 키 설정:
```
OPENAI_API_KEY=sk-your_api_key_here
```

### 2. 실행

```bash
docker compose up -d
```

### 3. 접속

- API: /api/v1
- Swagger 문서: /api-docs

## Docker 명령어

```bash
docker compose up -d          # 시작
docker compose down           # 중지
docker compose logs -f        # 로그 확인
docker compose down -v        # 중지 및 데이터 삭제
```

## API 엔드포인트

| 기능 | 메서드 | 경로 |
|-----|-------|------|
| 헬스체크 | GET | /api/v1/health |
| 회원가입 | POST | /api/v1/users/register |
| 로그인 | POST | /api/v1/users/login |
| 장비 목록 | GET | /api/v1/devices |
| 장비 등록 | POST | /api/v1/devices |
| 메트릭 조회 | GET | /api/v1/metrics/devices/:id |
| 알람 목록 | GET | /api/v1/alarms |
| AI 분석 | POST | /api/v1/ai/devices/:id/analyze |

## 기술 스택

- Node.js 18 + Express.js
- MySQL 8.0 + Sequelize ORM
- net-snmp, OpenAI API
- JWT 인증, Swagger UI