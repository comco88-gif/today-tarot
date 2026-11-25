# 오늘의 타로

하루 한 번 카드를 직접 섞고 골라 보는 타로 웹앱. Vercel에 배포하고 GitHub `today-tarot` 저장소에 push하면 자동 배포된다. 대화는 한국어로 한다. 구조는 README.md 참고.

## 수정할 때 지킬 규칙
1. **카드 데이터·유형·위치 설명·카드 조합은 두 곳에 있다**: `index.html`의 `<script>` 앞부분(`CARDS`, `TOPICS`, `POS`, `COMBOS`, `NO_CARDS`, `validate`, `buildPrompt` 등)과 `api/_lib.js`. 하나를 고치면 반드시 다른 쪽도 똑같이 고친다.
2. **화면을 바꾸면 `sw.js`의 캐시 버전(현재 `tarot-v6`)을 올린다** (tarot-v5, v6 …). index.html·카드 이미지·폰트·아이콘 변경 모두 해당.
3. **API 키는 절대 코드나 저장소에 넣지 않는다.** `ANTHROPIC_API_KEY`는 Vercel 환경변수로만 쓴다. Supabase는 공개용 anon(publishable) 키만 쓰고 service_role(secret) 키는 절대 쓰지 않는다. `.env` 파일은 커밋하지 않는다(.gitignore에 있음).
4. **카드 이미지는 1909년 라이더-웨이트 원판(퍼블릭 도메인)만 쓴다.** 이후 재채색판·현대 복각판은 저작권이 있을 수 있으니 쓰지 않는다.

## 확인 방법
- `node -e "import('./api/_lib.js').then(m=>console.log(m.CARDS.length))"` → 78
- 배포 후: `/`, `/cards/00.jpg`, `/manifest.webmanifest`가 200, `/api/reading`에 POST하면 NDJSON 줄(`{"t":…}` … `{"done":true}`)이 온다.

## AI 연결
- `api/reading.js`가 공식 SDK `@anthropic-ai/sdk`로 Claude를 부른다. 모델은 환경변수 `CLAUDE_MODEL`(기본 `claude-sonnet-5-5`).
- 실제 API 테스트는 크레딧이 나가니 한 번만 한다.

## 로그인·기록 저장
- Supabase + Google 로그인. `SUPABASE_URL`·`SUPABASE_ANON_KEY`가 있으면 앱 전체에 로그인이 필요하다(`#gate` 화면). 없으면 로그인 없이 기기에만 저장.
- 기록은 `readings` 표(user_id, key, data)에 계정별로 저장, RLS로 본인만 접근. 브라우저는 `localStorage`의 `tarot2-readings:<사용자ID>`에도 사본을 둔다.
- `/api/reading`은 Supabase 함수 `use_ai_quota`로 로그인 확인과 하루 횟수(`AI_DAILY_LIMIT`, 기본 20)를 한 번에 확인한다.
- 표나 함수를 바꾸면 `supabase/schema.sql`도 같이 고친다(여러 번 실행해도 안전하게).
