export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { type, name, email, plan } = req.body;
  
  console.log('Notify called:', { type, name, email });
  console.log('RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);

  const subjects = {
    signup: `🧩 New SpectraGuide Signup — ${name}`,
    upgrade: `💳 New Paid Subscriber — ${name} (${plan})`,
    referral: `🎁 New Referral Used — ${email}`,
  };

  const bodies = {
    signup: `New free signup on SpectraGuide!\n\nName: ${name}\nEmail: ${email}\nTime: ${new Date().toLocaleString()}`,
    upgrade: `New paying customer!\n\nName: ${name}\nEmail: ${email}\nPlan: ${plan}\nTime: ${new Date().toLocaleString()}`,
    referral: `Referral code used!\n\nNew user: ${email}\nReferred by: ${name}\nTime: ${new Date().toLocaleString()}`,
  };

  try {
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
    console.log('Resend response:', JSON.stringify(data));
    
    if (data.error) {
      return res.status(400).json({ error: data.error, message: data.message });
    }
    return res.status(200).json({ success: true, id: data.id });
  } catch (e) {
    console.error('Notify error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
