// POST /api/reading — 카드로 AI 풀이를 만든다. 키는 Vercel 환경변수 GEMINI_API_KEY에서만 읽는다.
import { validate, buildPrompt } from "./_lib.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const RETRIES = 1;              // 503(과부하)일 때 추가로 시도하는 횟수
const DEADLINE_MS = 20000;      // 재시도 포함 전체 제한 시간
const sleep = ms => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: "no_key" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const bad = validate(body);
  if (bad) return res.status(400).json({ error: bad });

  const rec = { topic: body.topic, type: body.type, question: body.question.trim(), date: body.date,
    cards: body.cards.map(d => ({ c: d.c, rev: d.rev })) };
  const { system, user } = buildPrompt(rec);

  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } }
  });
  const start = Date.now();

  try {
    let r, j;
    for (let attempt = 0; ; attempt++) {
      const left = DEADLINE_MS - (Date.now() - start);
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: payload,
        signal: AbortSignal.timeout(Math.max(left, 1000))
      });
      j = await r.json().catch(() => ({}));
      if (r.status !== 503 || attempt >= RETRIES) break;
      const wait = 1000 + Math.floor(Math.random() * 500);         // 약 1초 (+지터)
      if (DEADLINE_MS - (Date.now() - start) < wait + 5000) break; // 남은 시간이 부족하면 중단
      console.warn("gemini 503, retry", attempt + 1, "in", wait, "ms");
      await sleep(wait);
    }
    if (!r.ok) {
      console.error("gemini error", r.status, j?.error?.message);
      if (r.status === 503) return res.status(503).json({ error: "busy" });          // 과부하: 잠시 후 다시
      if (r.status === 429) return res.status(429).json({ error: "rate_limited" });  // 한도 초과
      return res.status(502).json({ error: "ai_error" });
    }
    const text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
    if (!text) return res.status(502).json({ error: "empty" });
    return res.status(200).json({ text: text.slice(0, 4000) });
  } catch (e) {
    console.error("gemini fetch failed", e?.name, e?.message);
    return res.status(504).json({ error: "timeout" });
  }
}
