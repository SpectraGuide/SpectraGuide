export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body;
  const action = body.action;
  const email = (body.email || '').toLowerCase().trim();
  const password = (body.password || '').trim();
  const name = (body.name || '').trim();
  const token = (body.token || '').trim();
  const adminSecret = body.adminSecret;

  const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  // Fully unwrap nested JSON - keeps parsing until we get a plain object
  function deepParse(val) {
    if (!val) return null;
    if (typeof val === 'object' && val !== null) {
      // If it has a nested 'value' key, unwrap it
      if (val.value !== undefined) return deepParse(val.value);
      return val;
    }
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return deepParse(parsed);
      } catch {
        return val;
      }
    }
    return val;
  }

  async function redisGet(key) {
    const r = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const data = await r.json();
    if (!data.result) return null;
    return deepParse(data.result);
  }

  async function redisSet(key, value) {
    // Store as clean JSON string - no nesting!
    const r = await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(value) })
    });
    return r.ok;
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
    if (action === 'adminOverride') {
      if (adminSecret !== 'SpectraGuide2026!') return res.status(403).json({ error: 'Unauthorized' });
      await redisDel(`user:${email}`);
      const user = { email, name: name || 'Tatyana Warren', password, plan: 'admin', created: new Date().toISOString(), isAdmin: true };
      await redisSet(`user:${email}`, user);
      return res.status(200).json({ success: true, user: { email, name: user.name, plan: 'admin', isAdmin: true } });
    }

    if (action === 'signup') {
      if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });
      const existing = await redisGet(`user:${email}`);
      if (existing && existing.email) return res.status(400).json({ error: 'An account with this email already exists. Please sign in.' });
      const user = { email, name, password, plan: 'free', created: new Date().toISOString(), isAdmin: email === 'spectraguide@gmail.com' };
      await redisSet(`user:${email}`, user);
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'SpectraGuide <hello@spectraguide.org>', to: ['spectraguide@gmail.com'], subject: `🧩 New Signup — ${name}`, text: `New signup!\n\nName: ${name}\nEmail: ${email}\nTime: ${new Date().toLocaleString()}` })
      }).catch(() => {});
      return res.status(200).json({ success: true, user: { email, name, plan: 'free', isAdmin: user.isAdmin } });
    }

    if (action === 'login') {
      if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
      const user = await redisGet(`user:${email}`);
      if (!user || !user.email) return res.status(400).json({ error: 'No account found with this email. Please sign up.' });
      const storedPw = (user.password || '').trim();
      if (storedPw !== password) return res.status(400).json({ error: 'Incorrect password. Please try again.' });
      return res.status(200).json({ success: true, user: { email: user.email, name: user.name, plan: user.plan, isAdmin: user.isAdmin } });
    }

    if (action === 'changePassword') {
      if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
      const user = await redisGet(`user:${email}`);
      if (!user || !user.email) return res.status(400).json({ error: 'User not found' });
      user.password = password;
      await redisSet(`user:${email}`, user);
      return res.status(200).json({ success: true });
    }

    if (action === 'forgotPassword') {
      if (!email) return res.status(400).json({ error: 'Missing email' });
      const user = await redisGet(`user:${email}`);
      if (!user || !user.email) return res.status(400).json({ error: 'No account found with this email.' });
      const resetToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
      await redisSet(`reset:${resetToken}`, { email });
      const resetUrl = `https://spectraguide.org?reset=${resetToken}`;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'SpectraGuide <hello@spectraguide.org>', to: [email], subject: '🧩 Reset your SpectraGuide password', text: `Hi ${user.name},\n\nClick to reset your password:\n\n${resetUrl}\n\nExpires in 1 hour.\n\n— SpectraGuide Team` })
      });
      return res.status(200).json({ success: true });
    }

    if (action === 'resetPassword') {
      if (!token || !password) return res.status(400).json({ error: 'Missing fields' });
      const resetData = await redisGet(`reset:${token}`);
      if (!resetData) return res.status(400).json({ error: 'Reset link expired. Please request a new one.' });
      const resetEmail = typeof resetData === 'string' ? resetData : resetData.email;
      const user = await redisGet(`user:${resetEmail}`);
      if (!user || !user.email) {
        const newUser = { email: resetEmail, name: resetEmail.split('@')[0], password, plan: 'free', created: new Date().toISOString(), isAdmin: resetEmail === 'spectraguide@gmail.com' };
        await redisSet(`user:${resetEmail}`, newUser);
        await redisDel(`reset:${token}`);
        return res.status(200).json({ success: true, user: { email: newUser.email, name: newUser.name, plan: newUser.plan, isAdmin: newUser.isAdmin } });
      }
      user.password = password;
      await redisSet(`user:${resetEmail}`, user);
      await redisDel(`reset:${token}`);
      return res.status(200).json({ success: true, user: { email: user.email, name: user.name, plan: user.plan, isAdmin: user.isAdmin } });
    }

    if (action === 'updatePlan') {
      if (!email) return res.status(400).json({ error: 'Missing email' });
      const user = await redisGet(`user:${email}`);
      if (!user || !user.email) return res.status(400).json({ error: 'User not found' });
      user.plan = body.plan;
      await redisSet(`user:${email}`, user);
      return res.status(200).json({ success: true });
    }

    if (action === 'listUsers') {
      const keys = await redisKeys('user:*');
      const users = {};
      await Promise.all(keys.map(async (key) => {
        const user = await redisGet(key);
        if (user && user.email) users[user.email] = { name: user.name, plan: user.plan, created: user.created };
      }));
      return res.status(200).json({ success: true, users });
    }

    if (action === 'deleteUser') {
      if (adminSecret !== 'sg_admin_2026') return res.status(403).json({ error: 'Unauthorized' });
      await redisDel(`user:${email}`);
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (e) {
    console.error('Auth error:', e);
    return res.status(500).json({ error: e.message });
  }
}
