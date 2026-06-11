import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function send(res, status, payload) {
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }
  return res.status(status).json(payload);
}

export default async function handler(req, res) {
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return send(res, 401, { error: 'Giris yapman gerekiyor.' });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return send(res, 401, { error: 'Gecersiz oturum.' });

    const { type, key } = req.body || {};
    const apiKey = String(key || '').trim();
    if (!apiKey) return send(res, 400, { error: 'API anahtari bos.' });

    if (type === 'claude') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return send(res, response.status, { error: data.error?.message || `Claude HTTP ${response.status}` });
      }
      return send(res, 200, { ok: true });
    }

    if (type === 'openai') {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return send(res, response.status, { error: data.error?.message || `OpenAI HTTP ${response.status}` });
      }
      return send(res, 200, { ok: true });
    }

    return send(res, 400, { error: 'type claude veya openai olmali.' });
  } catch (error) {
    return send(res, 500, { error: error.message });
  }
}
