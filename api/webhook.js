export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  let event;
  try {
    event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch(e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  console.log('Webhook event:', event.type);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details?.email || session.customer_email;
    const planName = getPlanFromPrice(session);

    console.log('Payment completed:', customerEmail, planName);

    if (customerEmail && planName) {
      try {
        // Get existing user
        const getRes = await fetch(`${REDIS_URL}/get/${encodeURIComponent(`user:${customerEmail.toLowerCase()}`)}`, {
          headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
        });
        const getData = await getRes.json();
        let user = getData.result ? JSON.parse(getData.result) : null;

        if (user) {
          // Update existing user plan
          user.plan = planName;
          user.stripeSessionId = session.id;
          user.planUpdated = new Date().toISOString();
        } else {
          // Create new user record
          user = {
            email: customerEmail.toLowerCase(),
            name: session.customer_details?.name || customerEmail.split('@')[0],
            plan: planName,
            password: null, // They need to set password
            created: new Date().toISOString(),
            stripeSessionId: session.id,
            isAdmin: false
          };
        }

        await fetch(`${REDIS_URL}/set/${encodeURIComponent(`user:${customerEmail.toLowerCase()}`)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: JSON.stringify(user) })
        });

        // Notify Tatyana
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'SpectraGuide <hello@spectraguide.org>',
            to: ['spectraguide@gmail.com'],
            subject: `💳 New Paid Subscriber — ${customerEmail} (${planName})`,
            text: `New paying customer!\n\nEmail: ${customerEmail}\nPlan: ${planName}\nAmount: $${session.amount_total/100}\nTime: ${new Date().toLocaleString()}`
          })
        });

        // Send confirmation to customer
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Tatyana at SpectraGuide <hello@spectraguide.org>',
            to: [customerEmail],
            subject: `🧩 Your ${planName} plan is active!`,
            text: `Hi,\n\nThank you for subscribing to SpectraGuide ${planName}!\n\nYour account has been upgraded. Visit spectraguide.org to access all your premium features.\n\nIf you haven't created an account yet, go to spectraguide.org and sign up with this email address to access your plan.\n\nQuestions? Reply to this email — I read every message personally.\n\nWith love,\nTatyana Warren\nFounder, SpectraGuide`
          })
        });

        console.log('Plan updated successfully for:', customerEmail);
      } catch(e) {
        console.error('Redis update error:', e);
      }
    }
  }

  return res.status(200).json({ received: true });
}

function getPlanFromPrice(session) {
  const priceId = session.line_items?.data?.[0]?.price?.id || '';
  const planMap = {
    'price_1TCPTO8iP7CLHxH9huST68Ho': 'Family',
    'price_1TFQ5t8iP7CLHxH9E7dzPVWl': 'Family',
    'price_1TCPU88iP7CLHxH95DOnytak': 'Professional',
    'price_1TFQ8C8iP7CLHxH9epZLRSv5': 'Professional',
    'price_1TCPUT8iP7CLHxH9plA1BZWE': 'District',
    'price_1TFQ8d8iP7CLHxH9aUJvpUF3': 'District',
  };
  // If price not in line_items, check amount
  const amount = session.amount_total;
  if (!planMap[priceId]) {
    if (amount <= 1900) return 'Family';
    if (amount <= 4900) return 'Professional';
    return 'District';
  }
  return planMap[priceId] || 'Family';
}
