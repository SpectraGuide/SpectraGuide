export default async function handler(req, res) {
  const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  const email = 'spectraguide@gmail.com';
  const key = `user:${email}`;

  try {
    // First check what's stored
    const getRes = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const getData = await getRes.json();
    console.log('Current stored data:', getData);

    // Delete it
    const delRes = await fetch(`${REDIS_URL}/del/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const delData = await delRes.json();
    console.log('Delete result:', delData);

    // Verify deletion
    const verifyRes = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const verifyData = await verifyRes.json();

    return res.status(200).json({ 
      success: true, 
      deleted: delData,
      wasStored: getData.result ? 'yes' : 'no',
      nowExists: verifyData.result ? 'yes - delete failed!' : 'no - success!'
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
