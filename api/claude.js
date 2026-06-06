// api/claude.js — Vercel Serverless Function
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, model, max_tokens, system } = req.body;
    const apiKey = req.headers['x-api-key'] || process.env.CLAUDE_API_KEY;

    if (!apiKey) {
      return res.status(401).json({ error: 'Claude API anahtarı bulunamadı. Ayarlar → Entegrasyonlar kısmından girin.' });
    }

    const claudeBody = {
      model: model || 'claude-haiku-4-5-20251001',
      max_tokens: max_tokens || 1024,
      messages
    };
    if (system) claudeBody.system = system;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(claudeBody)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Claude API hatası: ' + response.status });
    }

    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
