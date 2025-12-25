# 패키지 설치 가이드

## 문제: 화면에 아무것도 보이지 않을 때

이 문제는 대부분 **필요한 패키지가 설치되지 않아서** 발생합니다.

## 해결 방법

### 1단계: 패키지 설치

터미널에서 다음 명령어를 실행하세요:

```bash
cd /Users/kimdohyun/dev/NetScopeNMS/frontend
npm install
```

이 명령어는 다음 패키지들을 설치합니다:
- react, react-dom
- react-router-dom (라우팅)
- axios (API 통신)
- recharts (차트)
- date-fns (날짜 처리)

### 2단계: 설치 확인

설치가 완료되면 `node_modules` 폴더가 생성됩니다. 확인:

```bash
ls -la node_modules | head -5
```

### 3단계: 개발 서버 재시작

패키지 설치 후 개발 서버를 재시작하세요:

```bash
npm run dev
```

### 4단계: 브라우저 확인

브라우저에서 `http://localhost:5173`으로 접속하세요.

## 여전히 문제가 있다면

### 브라우저 콘솔 확인
1. F12 키를 눌러 개발자 도구 열기
2. Console 탭에서 오류 메시지 확인
3. 오류 메시지를 복사해서 확인

### 일반적인 오류

#### "Cannot find module 'react-router-dom'"
→ 패키지가 설치되지 않았습니다. `npm install` 실행

#### "Failed to fetch dynamically imported module"
→ 개발 서버를 재시작하세요

#### "Network Error" 또는 CORS 오류
→ 백엔드 서버가 실행 중인지 확인하세요

## 빠른 테스트

패키지가 제대로 설치되었는지 확인:

```bash
cd frontend
npm list react react-router-dom axios
```

모든 패키지가 표시되면 정상입니다.

