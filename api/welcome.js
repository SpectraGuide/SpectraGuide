export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });

  try {
    // Send welcome email to the new subscriber
    const welcomeRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Tatyana at SpectraGuide <hello@spectraguide.org>',
        to: [email],
        subject: '🧩 Welcome to SpectraGuide!',
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: #FDF8F2; padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="background: linear-gradient(135deg, #4BBFAD, #B8A9E3); width: 64px; height: 64px; border-radius: 18px; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px;">🧩</div>
              <h1 style="color: #2D2A3E; font-size: 28px; margin: 0;">Welcome to SpectraGuide!</h1>
            </div>
            
            <p style="color: #5C5880; font-size: 16px; line-height: 1.8;">Hi there,</p>
            
            <p style="color: #5C5880; font-size: 16px; line-height: 1.8;">
              Thank you for joining SpectraGuide! I'm Tatyana — a mom of a 10-year-old son with autism and the founder of this platform.
            </p>
            
            <p style="color: #5C5880; font-size: 16px; line-height: 1.8;">
              I built SpectraGuide because I spent years sitting in IEP meetings feeling lost. No parent should feel that way. You deserve expert-level guidance — free, in plain language, available 24/7.
            </p>

            <div style="background: white; border-radius: 16px; padding: 24px; margin: 24px 0;">
              <p style="color: #2D2A3E; font-weight: bold; font-size: 16px; margin: 0 0 16px;">Here's what you can do right now:</p>
              <p style="color: #5C5880; font-size: 15px; margin: 8px 0;">💬 <strong>AI Advocate Chat</strong> — Ask anything about IEPs, rights, therapies, and resources</p>
              <p style="color: #5C5880; font-size: 15px; margin: 8px 0;">📋 <strong>IEP Analyzer</strong> — Paste your child's IEP and get a plain-language breakdown</p>
              <p style="color: #5C5880; font-size: 15px; margin: 8px 0;">🌍 <strong>Resource Finder</strong> — Find verified providers in all 50 states</p>
            </div>

            <div style="text-align: center; margin: 32px 0;">
              <a href="https://spectraguide.org" style="background: linear-gradient(135deg, #4BBFAD, #B8A9E3); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: bold; font-size: 16px;">
                Visit SpectraGuide →
              </a>
            </div>

            <p style="color: #5C5880; font-size: 15px; line-height: 1.8;">
              If you ever have questions, just reply to this email. I read every message personally.
            </p>

            <p style="color: #5C5880; font-size: 15px; line-height: 1.8;">
              With love,<br/>
              <strong style="color: #2D2A3E;">Tatyana Warren</strong><br/>
              Founder & CEO, SpectraGuide 🧩
            </p>

            <hr style="border: none; border-top: 1px solid #EDE8E0; margin: 32px 0;"/>
            <p style="color: #A09DC0; font-size: 12px; text-align: center;">
              SpectraGuide · spectraguide.org · Kokomo, Indiana<br/>
              Not a substitute for legal or medical advice.
            </p>
          </div>
        `
      }),
    });

    // Also notify Tatyana
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SpectraGuide <hello@spectraguide.org>',
        to: ['spectraguide@gmail.com'],
        subject: `🧩 New Waitlist Signup — ${email}`,
        text: `New waitlist signup!\n\nEmail: ${email}\nTime: ${new Date().toLocaleString()}`
      }),
    });

    return res.status(200).json({ success: true });
  } catch(e) {
    console.error('Welcome email error:', e);
    return res.status(500).json({ error: e.message });
  }
}
