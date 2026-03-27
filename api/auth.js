export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { action, email, password, name, token, adminSecret } = req.body;
  
  const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const clean = (s) => s ? s.trim() : s;

  async function redisGet(key) {
    const r = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const data = await r.json();
    if (!data.result) return null;
    try { return JSON.parse(data.result); } catch { return data.result; }
  }

  async function redisSet(key, value) {
    await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(value) })
    });
  }

  async function redisSetEx(key, value, seconds) {
    await fetch(`${REDIS_URL}/setex/${encodeURIComponent(key)}/${seconds}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(value) })
    });
  }

  async function redisDel(key) {
    await fetch(`${REDIS_URL}/del/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
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
    // ADMIN OVERRIDE - force delete and recreate admin account
    if (action === 'adminOverride') {
      if (adminSecret !== 'SpectraGuide2026!') return res.status(403).json({ error: 'Unauthorized' });
      await redisDel('user:spectraguide@gmail.com');
      const user = {
        email: 'spectraguide@gmail.com',
        name: 'Tatyana Warren',
        password: clean(password),
        plan: 'admin',
        created: new Date().toISOString(),
        isAdmin: true
      };
      await redisSet('user:spectraguide@gmail.com', user);
      return res.status(200).json({ success: true, user: { email: user.email, name: user.name, plan: user.plan, isAdmin: true } });
    }

    if (action === 'signup') {
      if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });
      const existing = await redisGet(`user:${clean(email.toLowerCase())}`);
      if (existing) return res.status(400).json({ error: 'An account with this email already exists. Please sign in.' });
      const user = {
        email: clean(email.toLowerCase()),
        name: clean(name),
        password: clean(password),
        plan: 'free',
        created: new Date().toISOString(),
        isAdmin: clean(email.toLowerCase()) === 'spectraguide@gmail.com'
      };
      await redisSet(`user:${user.email}`, user);
      fetch('/api/notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'signup', name, email, plan: 'free' })
      }).catch(() => {});
      return res.status(200).json({ success: true, user: { email: user.email, name: user.name, plan: user.plan, isAdmin: user.isAdmin } });

    } else if (action === 'login') {
      if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
      const user = await redisGet(`user:${clean(email.toLowerCase())}`);
      if (!user) return res.status(400).json({ error: 'No account found with this email. Please sign up.' });
      if (clean(user.password) !== clean(password)) return res.status(400).json({ error: 'Incorrect password. Please try again.' });
      return res.status(200).json({ success: true, user: { email: user.email, name: user.name, plan: user.plan, isAdmin: user.isAdmin } });

    } else if (action === 'forgotPassword') {
      if (!email) return res.status(400).json({ error: 'Missing email' });
      const user = await redisGet(`user:${clean(email.toLowerCase())}`);
      if (!user) return res.status(400).json({ error: 'No account found with this email.' });
      const resetToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
      await redisSetEx(`reset:${resetToken}`, { email: clean(email.toLowerCase()) }, 3600);
      const resetUrl = `https://spectraguide.org?reset=${resetToken}`;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'SpectraGuide <hello@spectraguide.org>',
          to: [clean(email)],
          subject: '🧩 Reset your SpectraGuide password',
          text: `Hi ${user.name},\n\nClick below to reset your password (expires in 1 hour):\n\n${resetUrl}\n\n— SpectraGuide Team`
        })
      });
      return res.status(200).json({ success: true });

    } else if (action === 'resetPassword') {
      if (!token || !password) return res.status(400).json({ error: 'Missing fields' });
      const resetData = await redisGet(`reset:${token}`);
      if (!resetData) return res.status(400).json({ error: 'Reset link expired. Please request a new one.' });
      const user = await redisGet(`user:${resetData.email}`);
      if (!user) return res.status(400).json({ error: 'User not found' });
      user.password = clean(password);
      await redisSet(`user:${resetData.email}`, user);
      await redisDel(`reset:${token}`);
      return res.status(200).json({ success: true, user: { email: user.email, name: user.name, plan: user.plan, isAdmin: user.isAdmin } });

    } else if (action === 'updatePlan') {
      if (!email) return res.status(400).json({ error: 'Missing email' });
      const user = await redisGet(`user:${clean(email.toLowerCase())}`);
      if (!user) return res.status(400).json({ error: 'User not found' });
      user.plan = req.body.plan;
      await redisSet(`user:${clean(email.toLowerCase())}`, user);
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
