export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { action, email, password, name } = req.body;
  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  async function redisGet(key) {
    const r = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const data = await r.json();
    return data.result ? JSON.parse(data.result) : null;
  }

  async function redisSet(key, value) {
    await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(value) })
    });
  }

  async function redisKeys(pattern) {
    const r = await fetch(`${REDIS_URL}/keys/${encodeURIComponent(pattern)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const data = await r.json();
    return data.result || [];
  }

  try {
    if (action === 'signup') {
      if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });
      const existing = await redisGet(`user:${email.toLowerCase()}`);
      if (existing) return res.status(400).json({ error: 'An account with this email already exists. Please sign in.' });
      const user = {
        email: email.toLowerCase(), name, password,
        plan: 'free', created: new Date().toISOString(),
        isAdmin: email.toLowerCase() === 'spectraguide@gmail.com'
      };
      await redisSet(`user:${email.toLowerCase()}`, user);
      fetch('/api/notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'signup', name, email, plan: 'free' })
      }).catch(() => {});
      return res.status(200).json({ success: true, user: { email: user.email, name: user.name, plan: user.plan, isAdmin: user.isAdmin } });

    } else if (action === 'login') {
      if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
      const user = await redisGet(`user:${email.toLowerCase()}`);
      if (!user) return res.status(400).json({ error: 'No account found with this email. Please sign up.' });
      if (user.password !== password) return res.status(400).json({ error: 'Incorrect password. Please try again.' });
      return res.status(200).json({ success: true, user: { email: user.email, name: user.name, plan: user.plan, isAdmin: user.isAdmin } });

    } else if (action === 'updatePlan') {
      if (!email) return res.status(400).json({ error: 'Missing email' });
      const user = await redisGet(`user:${email.toLowerCase()}`);
      if (!user) return res.status(400).json({ error: 'User not found' });
      user.plan = req.body.plan;
      await redisSet(`user:${email.toLowerCase()}`, user);
      return res.status(200).json({ success: true });

    } else if (action === 'listUsers') {
      const keys = await redisKeys('user:*');
      const users = {};
      await Promise.all(keys.map(async (key) => {
        const user = await redisGet(key);
        if (user) users[user.email] = { name: user.name, plan: user.plan, created: user.created };
      }));
      return res.status(200).json({ success: true, users });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (e) {
    console.error('Auth error:', e);
    return res.status(500).json({ error: e.message });
  }
}
