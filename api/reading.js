// POST /api/reading — 카드로 AI 풀이를 만든다. 키는 Vercel 환경변수 GEMINI_API_KEY에서만 읽는다.
import { validate, buildPrompt } from "./_lib.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

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

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } }
      }),
      signal: AbortSignal.timeout(25000)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("gemini error", r.status, j?.error?.message);
      return res.status(502).json({ error: r.status === 429 ? "busy" : "ai_error" });
    }
    const text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
    if (!text) return res.status(502).json({ error: "empty" });
    return res.status(200).json({ text: text.slice(0, 4000) });
  } catch (e) {
    console.error("gemini fetch failed", e?.name, e?.message);
    return res.status(504).json({ error: "timeout" });
  }
}
