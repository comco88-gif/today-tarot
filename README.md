# 오늘의 타로

하루 한 번, 직접 섞고 고르는 타로 웹앱. 78장 라이더-웨이트 카드(1909년 원판, 퍼블릭 도메인), AI 풀이(Claude), 기록 일기, 궁합 링크, 홈 화면 설치(PWA)를 지원한다.

## 구조
| 경로 | 내용 |
|---|---|
| `index.html` | 앱 전체(화면·스타일·스크립트). 카드 데이터와 프롬프트도 들어 있다. |
| `api/_lib.js` | 서버용 카드 데이터·유형·위치 설명·카드 조합·입력 검증·프롬프트 (index.html과 같은 내용) |
| `api/reading.js` | `POST /api/reading` → Claude API로 풀이 생성(글이 만들어지는 대로 NDJSON 스트림). 키는 환경변수 `ANTHROPIC_API_KEY` |
| `cards/00.jpg`~`77.jpg` | 카드 이미지 (0~21 메이저, 22~ 완드·컵·소드·펜타클 순) |
| `fonts/Pretendard.woff2` | 본문 폰트 |
| `sw.js` | 오프라인 캐시 (버전 `tarot-v5`) |
| `manifest.webmanifest`, `icons/` | 홈 화면 앱 설정 |

## 배포 (Vercel)
1. 이 저장소를 Vercel에서 Import (프레임워크: Other, 빌드 명령 없음).
2. 환경변수 `ANTHROPIC_API_KEY`(Production, Sensitive) 추가 → 재배포. 키는 platform.claude.com에서 만들고, 선불 크레딧과 월 사용 한도를 설정해 둔다.
3. 선택: `CLAUDE_MODEL`로 모델 변경 (기본 `claude-sonnet-5-5`).

풀이는 생각(thinking) 없이 바로 쓰고(`thinking: between_tools`), 안전 분류기가 거절하면 서버 쪽 대체 모델로 한 번 더 시도한다(`fallbacks: "default"`). 과부하(529·503)는 SDK가 1번 자동 재시도하고, 20초 안에 첫 글자가 안 오면 화면에 "AI가 바빠요" 안내와 다시 시도 버튼을 보여준다. 크레딧 부족·한도 초과(402·429)는 기본 풀이로 보여준다.

AI 호출이 실패하면 앱은 자동으로 "기본 풀이"(템플릿)를 보여준다.

## 로컬 실행
```bash
npm install
npx vercel dev
```
