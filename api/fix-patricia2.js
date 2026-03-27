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

  async function redisGet(key) {
    const r = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const data = await r.json();
    return data;
  }

  // Check what's currently stored
  const current = await redisGet('user:patricia.godina@gmail.com');
  
  // Delete and recreate completely clean
  await redisDel('user:patricia.godina@gmail.com');
  
  const user = {
    email: 'patricia.godina@gmail.com',
    name: 'Patricia',
    password: 'SpectraGuide2026',
    plan: 'Family',
    created: new Date().toISOString(),
    isAdmin: false
  };
  
  await redisSet('user:patricia.godina@gmail.com', user);

  // Verify it was saved correctly
  const verify = await redisGet('user:patricia.godina@gmail.com');

  return res.status(200).json({ 
    success: true,
    whatWasStored: current.result,
    nowStored: verify.result,
    password: user.password
  });
}
