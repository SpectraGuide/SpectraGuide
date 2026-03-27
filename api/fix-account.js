export default async function handler(req, res) {
  const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  const email = 'patricia.godina@gmail.com';
  const key = `user:${email}`;

  try {
    // Get existing user
    const getRes = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const getData = await getRes.json();
    let user = getData.result ? JSON.parse(getData.result) : null;

    if (user) {
      // Update plan
      user.plan = 'Family';
      user.planUpdated = new Date().toISOString();
    } else {
      // Create account for her
      user = {
        email: email,
        name: 'Patricia',
        password: 'SpectraGuide2026',
        plan: 'Family',
        created: new Date().toISOString(),
        isAdmin: false
      };
    }

    // Save
    await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(user) })
    });

    // Send her an email
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Tatyana at SpectraGuide <hello@spectraguide.org>',
        to: [email],
        subject: '🧩 Your SpectraGuide Family Plan is now active!',
        text: `Hi Patricia,\n\nGreat news — your Family plan is now active!\n\nTo access your account:\n1. Go to spectraguide.org\n2. Click "Sign In"\n3. Enter your email: patricia.godina@gmail.com\n4. Your temporary password is: SpectraGuide2026\n5. Once logged in, please change your password\n\nYou now have unlimited AI Advocate Chat, unlimited IEP analysis, and priority support.\n\nAgain, I sincerely apologize for the inconvenience. Thank you for your patience and for being one of our first subscribers — it means the world to me.\n\nWith love,\nTatyana Warren\nFounder & CEO, SpectraGuide 🧩\nhello@spectraguide.org`
      })
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Patricia upgraded to Family plan and email sent!',
      user: { email: user.email, plan: user.plan }
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
