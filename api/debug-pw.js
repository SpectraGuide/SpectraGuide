export default async function handler(req, res) {
  const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  // Check what's actually stored for admin
  const r = await fetch(`${REDIS_URL}/get/${encodeURIComponent('user:spectraguide@gmail.com')}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const data = await r.json();
  
  let stored = null;
  try { stored = JSON.parse(data.result); } catch { stored = data.result; }

  return res.status(200).json({
    raw: data.result,
    parsed: stored,
    passwordStored: stored?.password,
    passwordLength: stored?.password?.length,
    passwordType: typeof stored?.password
  });
}
