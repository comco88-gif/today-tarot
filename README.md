# 오늘의 타로

하루 한 번, 직접 섞고 고르는 타로 웹앱. 78장 라이더-웨이트 카드(1909년 원판, 퍼블릭 도메인), Google·카카오 로그인(Supabase)과 계정별 기록 저장, 회원 탈퇴, AI 풀이(Claude), 기록 일기, 궁합 링크, 홈 화면 설치(PWA)를 지원한다.

## 구조
| 경로 | 내용 |
|---|---|
| `index.html` | 앱 전체(단일 화면 3D UI·스타일·스크립트). 카드 데이터와 프롬프트도 들어 있다. |
| `api/_lib.js` | 서버용 카드 데이터·유형·위치 설명·카드 조합·입력 검증·프롬프트 (index.html과 같은 내용) |
| `api/config.js` | `GET /api/config` → 브라우저용 Supabase 공개 설정(`SUPABASE_URL`, `SUPABASE_ANON_KEY`) |
| `api/reading.js` | `POST /api/reading` → Claude API로 풀이 생성(글이 만들어지는 대로 NDJSON 스트림). 키는 환경변수 `ANTHROPIC_API_KEY` |
| `cards/00.jpg`~`77.jpg` | 카드 이미지 (0~21 메이저, 22~ 완드·컵·소드·펜타클 순) |
| `fonts/Pretendard.woff2` | 본문 폰트 |
| `privacy.html`, `terms.html`, `legal.css` | 개인정보처리방침·이용약관 (`[운영자 이름]`·`[문의 이메일]` 채우기) |
| `sw.js` | 오프라인 캐시 (버전 `tarot-v10`) |
| `vendor/supabase-js-2.118.0.js` | Supabase 브라우저 라이브러리(직접 호스팅) |
| `supabase/schema.sql` | Supabase에 한 번 실행할 표·보안 규칙·AI 횟수 함수 |
| `manifest.webmanifest`, `icons/` | 홈 화면 앱 설정 |

## 배포 (Vercel)
1. 이 저장소를 Vercel에서 Import (프레임워크: Other, 빌드 명령 없음).
2. 환경변수 `ANTHROPIC_API_KEY`(Production, Sensitive) 추가 → 재배포. 키는 platform.claude.com에서 만들고, 선불 크레딧과 월 사용 한도를 설정해 둔다.
3. 선택: `CLAUDE_MODEL`로 모델 변경 (기본 `claude-sonnet-5-5`).

풀이는 생각(thinking) 없이 바로 쓰고(`thinking: between_tools`), 안전 분류기가 거절하면 서버 쪽 대체 모델로 한 번 더 시도한다(`fallbacks: "default"`). 과부하(529·503)는 SDK가 1번 자동 재시도하고, 20초 안에 첫 글자가 안 오면 화면에 "AI가 바빠요" 안내와 다시 시도 버튼을 보여준다. 크레딧 부족·한도 초과(402·429)는 기본 풀이로 보여준다.

## 로그인 (Supabase + Google)
1. supabase.com에서 프로젝트를 만들고 SQL Editor에서 `supabase/schema.sql`을 실행한다.
2. Google Cloud Console에서 OAuth 클라이언트(웹)를 만들고, 승인된 리디렉션 URI에 `https://<프로젝트>.supabase.co/auth/v1/callback`을 넣는다.
3. Supabase → Authentication → Sign In / Providers → Google에 클라이언트 ID·보안 비밀을 넣고 켠다. URL Configuration의 Site URL과 Redirect URLs에 사이트 주소(`https://…vercel.app/**`)를 넣는다.
4. Vercel 환경변수 `SUPABASE_URL`, `SUPABASE_ANON_KEY`(anon 또는 publishable 키, 공개용) 추가 → 재배포. 선택: `AI_DAILY_LIMIT`(1인 하루 AI 풀이 횟수, 기본 20), `LOGIN_PROVIDERS`(로그인 버튼, 기본 `google`, 카카오까지 쓰면 `google,kakao`).
5. 카카오(선택): Kakao Developers에서 앱을 만들고 REST API 키·Client Secret을 Supabase → Providers → Kakao에 넣는다. 카카오 로그인 Redirect URI는 Supabase의 Callback URL. 그다음 `LOGIN_PROVIDERS=google,kakao`.

회원 탈퇴는 Supabase 함수 `delete_my_account`가 본인 계정과 기록을 바로 지운다. Google OAuth 동의 화면에는 `/privacy.html`, `/terms.html` 주소를 넣는다.

두 값이 없으면 로그인 없이 예전처럼 이 기기에만 저장한다. 있으면 앱 전체에 로그인이 필요하고, 기록은 `readings` 표에 계정별로 저장(본인만 읽기·쓰기, RLS), AI 풀이는 로그인한 사람만 하루 `AI_DAILY_LIMIT`번까지 받는다. 로그인 전 이 기기에 있던 기록은 처음 로그인한 계정으로 옮겨진다. **service_role(secret) 키는 어디에도 넣지 않는다.**

AI 호출이 실패하면 앱은 자동으로 "기본 풀이"(템플릿)를 보여준다.

## 로컬 실행
```bash
npm install
npx vercel dev
```
