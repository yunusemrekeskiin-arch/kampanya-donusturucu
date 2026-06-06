// api/openai-image.js — Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, n, size, quality } = req.body;
    const apiKey = req.headers['x-api-key'] || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(401).json({ error: 'OpenAI API anahtarı bulunamadı. Ayarlar → Entegrasyonlar kısmından girin.' });
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        n: n || 1,
        size: size || '1024x1024',
        quality: quality || 'high'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'OpenAI API hatası: ' + response.status });
    }

    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
