export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { type, name, email, plan } = req.body;

  const subjects = {
    signup: `🧩 New SpectraGuide Signup — ${name}`,
    upgrade: `💳 New Paid Subscriber — ${name} (${plan})`,
    iep: `📋 IEP Analysis Completed — ${email}`,
  };

  const bodies = {
    signup: `New free signup on SpectraGuide!\n\nName: ${name}\nEmail: ${email}\nTime: ${new Date().toLocaleString()}\n\nLog in to your admin dashboard at spectraguide.org to see all signups.`,
    upgrade: `You have a new paying customer! 🎉\n\nName: ${name}\nEmail: ${email}\nPlan: ${plan}\nTime: ${new Date().toLocaleString()}\n\nMoney is on its way to your Stripe account!`,
    iep: `A user just analyzed an IEP on SpectraGuide.\n\nEmail: ${email}\nTime: ${new Date().toLocaleString()}`,
  };

  try {
    // Send via Resend API (free tier: 100 emails/day)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SpectraGuide <hello@spectraguide.org>',
        to: ['spectraguide@gmail.com'],
        subject: subjects[type] || 'SpectraGuide Notification',
        text: bodies[type] || JSON.stringify(req.body),
      }),
    });

    const data = await response.json();
    return res.status(200).json({ success: true, data });
  } catch (e) {
    console.error('Notify error:', e);
    return res.status(500).json({ error: e.message });
  }
}
