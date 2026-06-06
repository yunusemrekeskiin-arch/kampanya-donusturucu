// api/claude.js — Vercel Edge Function
// Claude API proxy — key tarayıcıda görünmez

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

  try {
    const body = await req.json();
    const { messages, model, max_tokens, system } = body;

    // Key: önce request header'dan al, yoksa env'den
    const apiKey = req.headers.get('x-api-key') || process.env.CLAUDE_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Claude API anahtarı bulunamadı. Lütfen Ayarlar > Entegrasyonlar kısmından API anahtarınızı girin.' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const claudeBody = { model: model || 'claude-haiku-4-5-20251001', max_tokens: max_tokens || 1024, messages };
    if (system) claudeBody.system = system;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(claudeBody)
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: data.error?.message || 'Claude API hatası: ' + res.status }),
        { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
}
