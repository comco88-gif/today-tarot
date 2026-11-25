// POST /api/reading — 카드로 AI 풀이를 만든다(Claude API).
// 키는 Vercel 환경변수 ANTHROPIC_API_KEY에서만 읽는다(SDK가 자동으로 읽음). 코드·저장소에 넣지 말 것.
// 응답은 NDJSON 스트림: 글이 만들어지는 대로 {"t":"조각"} 줄을 보내고, 끝나면 {"done":true},
// 도중에 실패하면 {"error":"코드"}. 시작 전에 실패하면 일반 JSON {"error":"코드"} + 상태 코드.
import Anthropic from "@anthropic-ai/sdk";
import { validate, buildPrompt } from "./_lib.js";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const FIRST_TEXT_MS = 20000;   // 이 시간 안에 첫 글자가 안 오면 "AI가 바빠요"
const TOTAL_MS = 55000;        // 전체 제한 (vercel.json maxDuration 60초 안쪽)

// 과부하·일시 오류는 SDK가 1번 자동 재시도한다.
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ maxRetries: 1 }) : null;

function errorCode(e) {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return "no_key";
  if (e instanceof Anthropic.RateLimitError) return "rate_limited";
  if (e instanceof Anthropic.InternalServerError) return "busy"; // 500·503·529(과부하)
  if (e instanceof Anthropic.APIUserAbortError || e instanceof Anthropic.APIConnectionTimeoutError) return "timeout";
  if (e instanceof Anthropic.APIError && e.status === 402) return "rate_limited"; // 크레딧 부족
  return "ai_error";
}
const STATUS = { no_key: 503, rate_limited: 429, busy: 503, timeout: 504, ai_error: 502, refused: 502, empty: 502 };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!client) return res.status(503).json({ error: "no_key" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const bad = validate(body);
  if (bad) return res.status(400).json({ error: bad });

  const rec = { topic: body.topic, type: body.type, question: body.question.trim(), date: body.date,
    cards: body.cards.map(d => ({ c: d.c, rev: d.rev })) };
  const { system, user } = buildPrompt(rec);

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    // 짧은 글쓰기라 생각(thinking)은 끄고 바로 쓴다: 빠르고 저렴하다.
    thinking: { type: "between_tools" },
    // 안전 분류기가 거절하면 서버에서 다른 모델로 한 번 더 시도한다.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    messages: [{ role: "user", content: user }],
  });

  let started = false, closed = false, text = "";
  const firstTimer = setTimeout(() => { if (!started) stream.abort(); }, FIRST_TEXT_MS);
  const totalTimer = setTimeout(() => stream.abort(), TOTAL_MS);
  res.on?.("close", () => { if (!res.writableEnded) { closed = true; stream.abort(); } });
  const send = obj => { if (!closed) res.write(JSON.stringify(obj) + "\n"); };

  try {
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta" && ev.delta.text) {
        if (!started) {
          started = true;
          res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
        }
        text += ev.delta.text;
        send({ t: ev.delta.text });
      }
    }
    const msg = await stream.finalMessage();
    let code = null;
    if (msg.stop_reason === "refusal") code = "refused";
    else if (!text.trim()) code = "empty";
    if (code) {
      console.error("claude", code, msg.stop_details?.category ?? "");
      if (!started) return res.status(STATUS[code]).json({ error: code });
      send({ error: code });
    } else {
      send({ done: true });
    }
    return res.end();
  } catch (e) {
    if (closed) return;
    const code = errorCode(e);
    console.error("claude error", code, e?.status ?? "", e?.message ?? e);
    if (!started) return res.status(STATUS[code]).json({ error: code });
    send({ error: code });
    return res.end();
  } finally {
    clearTimeout(firstTimer); clearTimeout(totalTimer);
  }
}
