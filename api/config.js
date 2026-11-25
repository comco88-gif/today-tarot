// GET /api/config — 브라우저가 로그인(Supabase)에 쓸 공개 설정을 준다.
// SUPABASE_URL과 SUPABASE_ANON_KEY(또는 publishable key)는 공개용 값이라 페이지에 나가도 된다.
// service_role(secret) 키는 절대 여기에 넣지 말 것.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_ANON_KEY || "";
  res.status(200).json(url && key ? { url, key } : {});
}
