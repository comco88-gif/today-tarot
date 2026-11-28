# 오늘의 타로

하루 한 번 카드를 직접 섞고 골라 보는 타로 웹앱. Vercel에 배포하고 GitHub `today-tarot` 저장소에 push하면 자동 배포된다. 대화는 한국어로 한다. 구조는 README.md 참고.

## 수정할 때 지킬 규칙
1. **카드 데이터·유형·위치 설명·카드 조합은 두 곳에 있다**: `index.html`의 `<script>` 앞부분(`CARDS`, `TOPICS`, `POS`, `COMBOS`, `NO_CARDS`, `validate`, `buildPrompt` 등)과 `api/_lib.js`. 하나를 고치면 반드시 다른 쪽도 똑같이 고친다.
2. **화면을 바꾸면 `sw.js`의 캐시 버전(현재 `tarot-v11`)을 올린다** (tarot-v5, v6 …). index.html·카드 이미지·폰트·아이콘 변경 모두 해당.
3. **API 키는 절대 코드나 저장소에 넣지 않는다.** `ANTHROPIC_API_KEY`는 Vercel 환경변수로만 쓴다. Supabase는 공개용 anon(publishable) 키만 쓰고 service_role(secret) 키는 절대 쓰지 않는다. `.env` 파일은 커밋하지 않는다(.gitignore에 있음).
4. **카드 그림은 두 덱만 쓴다.** `cards/`는 1909년 라이더-웨이트 원판(퍼블릭 도메인), `cards-char/`는 그 원판을 바탕으로 Gemini로 새로 그린 캐릭터 덱(기본). 이후 재채색판·현대 복각판 등 저작권이 있을 수 있는 그림은 쓰지 않는다.

## 확인 방법
- `node -e "import('./api/_lib.js').then(m=>console.log(m.CARDS.length))"` → 78
- 배포 후: `/`, `/cards/00.jpg`, `/manifest.webmanifest`가 200, `/api/reading`에 POST하면 NDJSON 줄(`{"t":…}` … `{"done":true}`)이 온다.

## 화면 구조 (Astral Sanctuary, 단일 화면)
- 탭·페이지 없이 한 화면(100dvh, 페이지 스크롤 없음). 단계: 질문(하단 독) → 길게 눌러 섞기 → 3D 아치에서 카드 고르기 → 뒤집기 → 슬라이드업 풀이 시트.
- 3D는 CSS 3D(카드: 앞·뒤 면 + 금박 두께, 틸트·글레어)와 캔버스 별빛 파티클. Three.js는 쓰지 않는다.
- 계정(로그아웃·회원 탈퇴), 나의 기록(지난 풀이·메모), 기록 내보내기, 약관 링크는 오른쪽 위 ☰ 메뉴 시트에 있다. 공개에 필요하니 없애지 말 것.
- `index.html` 스크립트 구성: 카드 데이터·프롬프트(api/_lib.js와 같은 부분) → 저장·링크 → 풀이 엔진(aiReading·template) → 공유 이미지(makeImage) → UI(`// Astral Sanctuary` 이후) → 로그인·동기화.

## 캐릭터 덱 (cards-char)
- 앱은 `cards-char/NN.webp`(560×960, 7:12)를 쓴다. 기본은 캐릭터 덱, ☰ 메뉴 → 카드 덱에서 1909 원판으로 바꿀 수 있다(`tarot2-deck`).
- 다시 만들기: `NODE_USE_ENV_PROXY=1 node tools/gen-cards.mjs 5,17 --force` → `python3 tools/build-char-webp.py`. 키는 클라우드 환경 네트워크 시크릿(x-goog-api-key, generativelanguage.googleapis.com) 또는 `GEMINI_API_KEY`. 생성 PNG 원본은 저장소에 넣지 않는다(.gitignore).
- 화풍 기준은 `tools/char-anchor-00.png`, 프롬프트는 `tools/char-prompts.json`(아래 제목 띠 문구 포함).

## AI 연결
- `api/reading.js`가 공식 SDK `@anthropic-ai/sdk`로 Claude를 부른다. 모델은 환경변수 `CLAUDE_MODEL`(기본 `claude-sonnet-5-5`).
- 실제 API 테스트는 크레딧이 나가니 한 번만 한다.

## 로그인·기록 저장
- Supabase + Google·카카오 로그인(버튼은 `LOGIN_PROVIDERS`, 기본 google). `SUPABASE_URL`·`SUPABASE_ANON_KEY`가 있으면 앱 전체에 로그인이 필요하다(`#gate` 화면). 없으면 로그인 없이 기기에만 저장.
- 기록은 `readings` 표(user_id, key, data)에 계정별로 저장, RLS로 본인만 접근. 브라우저는 `localStorage`의 `tarot2-readings:<사용자ID>`에도 사본을 둔다.
- `/api/reading`은 Supabase 함수 `use_ai_quota`로 로그인 확인과 하루 횟수(`AI_DAILY_LIMIT`, 기본 20)를 한 번에 확인한다.
- 회원 탈퇴: 설정 → 회원 탈퇴 → Supabase 함수 `delete_my_account`.
- 표나 함수를 바꾸면 `supabase/schema.sql`도 같이 고친다(여러 번 실행해도 안전하게).
- 수집 항목·위탁 업체(Supabase·Vercel·Anthropic·Google)가 바뀌면 `privacy.html`도 같이 고친다. 카카오 로그인을 켤 때(`LOGIN_PROVIDERS=google,kakao`)는 privacy.html·terms.html·설정의 개인정보 안내에 카카오를 다시 넣는다.
- 운영자: 개발자 혁구, 문의 comco88@gmail.com (privacy.html·terms.html에 표기).
