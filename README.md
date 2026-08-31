# 쇼트트랙 주니어 블랙&골드 챔피언 에디션

초등학교 5학년 쇼트트랙 선수준비반 훈련 관리 웹앱

## 실행 방법
```
npm install
npm run dev
```

## Firebase 설정 (필수)
데이터는 Firebase(Auth + Firestore)로 저장됩니다. 실행 전에:

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 생성
2. 프로젝트 설정 > 일반 > 내 앱 > 웹 앱 추가 → `firebaseConfig` 값 확인
3. Authentication > Sign-in method에서 **이메일/비밀번호** 로그인 활성화
4. Firestore Database 생성 (프로덕션 모드)
5. `firestore.rules` 파일 내용을 Firestore 콘솔의 규칙 탭에 붙여넣고 게시 (사용자 본인 데이터만 읽고 쓸 수 있게 제한)
6. `.env.example`을 `.env`로 복사하고 `firebaseConfig` 값을 채우기

`.env` 값이 비어있으면 앱이 "Firebase 연결이 안 되어 있어요" 안내 화면을 보여줍니다.

## 주요 기능
- 가입 → 로그인 → 관리 흐름 (Firebase Authentication, 이메일/비밀번호)
- 훈련 기록은 로그인한 사용자별로 Firestore(`users/{uid}/logs/{date}`)에 저장·동기화
- 대시보드 / 훈련일지(블로그형) / 기록분석 / 성장리포트 4탭
- 블랙 & 골드 테마 (#060608 + #D4AF37), 로그인/가입 화면도 동일한 톤
- 훈련일지: 달력 작게, 본문 블로그형 크게
- 유튜브/인스타그램 링크 임베드 + 미리보기

## 구조
- `src/firebase.ts` — Firebase 초기화
- `src/AuthContext.tsx` — 로그인/가입/로그아웃 상태 관리
- `src/AuthForm.tsx` — 로그인/가입 화면
- `src/useTrainingLogs.ts` — Firestore 훈련 기록 읽기/쓰기 훅
- `src/Root.tsx` — 로그인 여부에 따라 인증 화면 또는 대시보드 표시
- `src/App.tsx` — 대시보드 본체

성장리포트 탭의 신체기록/멘탈/목표 데이터는 아직 샘플(고정) 값이며 Firestore로 연동되어 있지 않습니다.

제작: Meta AI - 2026.08.31
