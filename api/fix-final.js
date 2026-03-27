export default async function handler(req, res) {
  const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  async function redisDel(key) {
    await fetch(`${REDIS_URL}/del/${encodeURIComponent(key)}`, {
      method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
  }

  // Store using URL path - no body wrapper!
  async function redisSet(key, value) {
    await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
  }

  async function redisGet(key) {
    const r = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const data = await r.json();
    return data.result;
  }

  // Delete both accounts
  await redisDel('user:spectraguide@gmail.com');
  await redisDel('user:patricia.godina@gmail.com');

  // Recreate cleanly
  await redisSet('user:spectraguide@gmail.com', {
    email: 'spectraguide@gmail.com', name: 'Tatyana Warren',
    password: 'SpectraAdmin2026', plan: 'admin',
    created: new Date().toISOString(), isAdmin: true
  });

  await redisSet('user:patricia.godina@gmail.com', {
    email: 'patricia.godina@gmail.com', name: 'Patricia',
    password: 'SpectraGuide2026', plan: 'Family',
    created: new Date().toISOString(), isAdmin: false
  });

  // Verify
  const tatyana = await redisGet('user:spectraguide@gmail.com');
  const patricia = await redisGet('user:patricia.godina@gmail.com');

  return res.status(200).json({ 
    success: true,
    tatyana: tatyana,
    patricia: patricia
  });
}
