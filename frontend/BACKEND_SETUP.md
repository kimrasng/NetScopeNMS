# 백엔드 서버 실행 가이드

## 문제: `ERR_FAILED` 오류

이 오류는 **백엔드 서버가 실행되지 않아서** 발생합니다.

## 해결 방법

### 방법 1: 직접 실행 (개발 모드)

```bash
cd /Users/kimdohyun/dev/NetScopeNMS/backend
npm install  # 처음 실행 시
npm run dev  # 또는 npm start
```

서버가 성공적으로 시작되면 다음과 같은 메시지가 표시됩니다:

```
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🌐 NetScopeNMS Backend Server                       ║
║                                                       ║
║   Environment: development                           ║
║   Port: 3000                                          ║
║   API: http://localhost:3000/api/v1                   ║
║   Docs: http://localhost:3000/api-docs                ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
```

### 방법 2: Docker로 실행

```bash
cd /Users/kimdohyun/dev/NetScopeNMS/backend
docker compose up -d
```

### 방법 3: 환경 변수 설정

백엔드 디렉토리에 `.env` 파일이 필요할 수 있습니다:

```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=netscopenms
DB_USER=root
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
CORS_ORIGIN=http://localhost:5173
```

## 확인 방법

1. **서버 상태 확인**:
   ```bash
   curl http://localhost:3000/api/v1/health
   ```
   정상이면 JSON 응답이 반환됩니다.

2. **브라우저에서 확인**:
   - `http://localhost:3000/api/v1/health` 접속
   - 또는 `http://localhost:3000/api-docs` (Swagger 문서)

3. **포트 사용 확인**:
   ```bash
   lsof -i :3000
   ```

## 데이터베이스 설정

백엔드가 MySQL 데이터베이스에 연결되어야 합니다:

1. MySQL이 실행 중인지 확인
2. 데이터베이스가 생성되어 있는지 확인
3. `.env` 파일에 올바른 DB 정보가 있는지 확인

## 일반적인 문제

### "Cannot connect to database"
→ MySQL 서버가 실행 중인지 확인하세요

### "Port 3000 is already in use"
→ 다른 프로세스가 포트 3000을 사용 중입니다. 프로세스를 종료하거나 다른 포트를 사용하세요.

### CORS 오류
→ 백엔드의 `CORS_ORIGIN` 환경 변수에 프론트엔드 URL(`http://localhost:5173`)이 포함되어 있는지 확인하세요.

