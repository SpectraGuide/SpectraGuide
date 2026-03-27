export default async function handler(req, res) {
  // One-time admin reset tool - delete this file after use!
  const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    const response = await fetch(`${REDIS_URL}/del/user:spectraguide@gmail.com`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const data = await response.json();
    return res.status(200).json({ success: true, result: data });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
