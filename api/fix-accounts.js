export default async function handler(req, res) {
  const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  async function redisDel(key) {
    await fetch(`${REDIS_URL}/del/${encodeURIComponent(key)}`, {
      method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
  }

  async function redisSet(key, value) {
    await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(value) })
    });
  }

  // Delete and recreate both accounts cleanly
  await redisDel('user:spectraguide@gmail.com');
  await redisDel('user:patricia.godina@gmail.com');

  await redisSet('user:spectraguide@gmail.com', {
    email: 'spectraguide@gmail.com',
    name: 'Tatyana Warren',
    password: 'SpectraAdmin2026',
    plan: 'admin',
    created: new Date().toISOString(),
    isAdmin: true
  });

  await redisSet('user:patricia.godina@gmail.com', {
    email: 'patricia.godina@gmail.com',
    name: 'Patricia',
    password: 'SpectraGuide2026',
    plan: 'Family',
    created: new Date().toISOString(),
    isAdmin: false
  });

  return res.status(200).json({ 
    success: true, 
    message: 'Both accounts reset cleanly!',
    tatyana: { email: 'spectraguide@gmail.com', password: 'SpectraAdmin2026', plan: 'admin' },
    patricia: { email: 'patricia.godina@gmail.com', password: 'SpectraGuide2026', plan: 'Family' }
  });
}
