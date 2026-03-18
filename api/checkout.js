export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { priceId } = req.body;
  if (!priceId) return res.status(400).json({ error: 'Missing priceId' });

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'mode': 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'success_url': 'https://spectraguide.org/success',
        'cancel_url': 'https://spectraguide.org/pricing',
      }).toString(),
    });
    const session = await response.json();
    if (session.error) return res.status(400).json({ error: session.error.message });
    return res.status(200).json({ url: session.url });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
