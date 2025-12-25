# 프론트엔드 설정 가이드

## 문제 해결: 아무것도 보이지 않을 때

### 1. 패키지 설치 확인

먼저 필요한 패키지가 설치되어 있는지 확인하세요:

```bash
cd frontend
npm install
```

필요한 패키지:
- react
- react-dom
- react-router-dom
- axios
- recharts
- date-fns

### 2. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속하세요.

### 3. 브라우저 콘솔 확인

브라우저 개발자 도구(F12)를 열고 Console 탭에서 오류 메시지를 확인하세요.

### 4. 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

### 5. 백엔드 서버 확인

백엔드 서버가 실행 중인지 확인하세요:

```bash
cd backend
npm start
```

### 6. 일반적인 문제

#### 빈 화면이 보이는 경우:
1. 브라우저 콘솔에서 JavaScript 오류 확인
2. 네트워크 탭에서 파일 로딩 실패 확인
3. 패키지가 제대로 설치되었는지 확인

#### 로그인 페이지가 보이지 않는 경우:
- `/login` 경로로 직접 접속해보세요
- 인증되지 않은 상태에서는 자동으로 `/login`으로 리다이렉트됩니다

#### 스타일이 적용되지 않는 경우:
- `index.css` 파일이 제대로 로드되는지 확인
- 브라우저 캐시를 지워보세요 (Ctrl+Shift+R 또는 Cmd+Shift+R)

