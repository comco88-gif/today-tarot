// 캐릭터 덱 일괄 생성 (Gemini 이미지 API)
// 사용법:
//   node tools/gen-cards.mjs --list-models          이미지 생성 가능한 모델 목록
//   node tools/gen-cards.mjs 1,2,13                 지정한 카드만
//   node tools/gen-cards.mjs 22-35 --force          범위, 이미 있는 파일도 다시 생성
//   node tools/gen-cards.mjs all                    00(기준 카드)을 뺀 77장
// 키: 환경변수 GEMINI_API_KEY, 또는 클라우드 환경의 네트워크 시크릿(x-goog-api-key)이 자동으로 붙는다.
// 키를 코드나 저장소에 넣지 말 것.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com";
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
const KEY = process.env.GEMINI_API_KEY || ""; // 비어 있으면 헤더를 보내지 않는다: 클라우드 네트워크 시크릿이 x-goog-api-key를 붙여 준다
const CONCURRENCY = Number(process.env.CONCURRENCY) || 2;
const OUT = path.join(ROOT, "cards-char");
const ANCHOR = path.join(ROOT, "tools", "char-anchor-00.png");
const PROMPTS = JSON.parse(fs.readFileSync(path.join(ROOT, "tools", "char-prompts.json"), "utf8"));

const args = process.argv.slice(2);
const force = args.includes("--force");
const headers = { "Content-Type": "application/json", ...(KEY ? { "x-goog-api-key": KEY } : {}) };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b64 = f => fs.readFileSync(f).toString("base64");
const mime = f => (f.endsWith(".png") ? "image/png" : f.endsWith(".webp") ? "image/webp" : "image/jpeg");

if (args.includes("--list-models")) {
  const r = await fetch(`${BASE}/v1beta/models?pageSize=200`, { headers });
  const j = await r.json();
  if (!r.ok) { console.error(r.status, JSON.stringify(j).slice(0, 400)); process.exit(1); }
  for (const m of j.models || []) if (/image/i.test(m.name)) console.log(m.name.replace("models/", ""), "-", m.displayName || "");
  process.exit(0);
}

function pickIds(spec) {
  if (!spec || spec === "all") return PROMPTS.map(p => p.i).filter(i => i !== 0);
  const ids = new Set();
  for (const part of spec.split(",")) {
    const m = part.match(/^(\d+)-(\d+)$/);
    if (m) for (let i = +m[1]; i <= +m[2]; i++) ids.add(i); else if (/^\d+$/.test(part)) ids.add(+part);
  }
  return [...ids].filter(i => i >= 0 && i < 78).sort((a, b) => a - b);
}

async function generate(i) {
  const p = PROMPTS.find(x => x.i === i);
  const nn = String(i).padStart(2, "0");
  const out = path.join(OUT, `${nn}.png`);
  if (!force && fs.existsSync(out)) { console.log(`${nn} 이미 있음 (건너뜀)`); return true; }
  const orig = path.join(ROOT, "cards", `${nn}.jpg`);
  const body = {
    contents: [{ role: "user", parts: [
      { inline_data: { mime_type: mime(ANCHOR), data: b64(ANCHOR) } },
      { inline_data: { mime_type: mime(orig), data: b64(orig) } },
      { text: p.prompt },
    ] }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "9:16" } },
  };
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(`${BASE}/v1beta/models/${MODEL}:generateContent`, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 429 || r.status >= 500) { const w = 5000 * attempt; console.warn(`${nn} ${r.status} 재시도 ${attempt} (${w / 1000}s)`); await sleep(w); continue; }
      if (!r.ok) { console.error(`${nn} 실패 ${r.status}: ${j?.error?.message || ""}`.slice(0, 300)); return false; }
      const parts = j.candidates?.[0]?.content?.parts || [];
      const img = parts.find(x => x.inlineData || x.inline_data);
      if (!img) { console.error(`${nn} 이미지 없음: ${j.candidates?.[0]?.finishReason || ""} ${parts.map(x => x.text || "").join(" ").slice(0, 200)}`); if (attempt < 4) { await sleep(3000); continue; } return false; }
      const d = img.inlineData || img.inline_data;
      fs.writeFileSync(out, Buffer.from(d.data, "base64"));
      console.log(`${nn} 완료 · ${p.name}`);
      return true;
    } catch (e) { console.warn(`${nn} 오류 ${e.name} 재시도 ${attempt}`); await sleep(4000 * attempt); }
  }
  return false;
}

fs.mkdirSync(OUT, { recursive: true });
const ids = pickIds(args.find(a => !a.startsWith("--")));
console.log(`모델 ${MODEL} · ${ids.length}장 · 동시 ${CONCURRENCY}`);
const queue = [...ids], failed = [];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (queue.length) { const i = queue.shift(); if (!(await generate(i))) failed.push(i); } }));
console.log(failed.length ? `실패: ${failed.sort((a, b) => a - b).join(",")}` : "모두 완료");
