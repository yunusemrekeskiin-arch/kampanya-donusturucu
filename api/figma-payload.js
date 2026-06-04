// api/figma-payload.js — Vercel Edge Function
// Kampix plugin payload geçici olarak saklar (5 dakika)

export const config = { runtime: 'edge' };

const store = new Map();

export default async function handler(req) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors });

  // POST: payload kaydet, kod döndür
  if (req.method === 'POST') {
    const body = await req.json();
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    store.set(code, { payload: body, ts: Date.now() });
    // 5 dakika sonra sil
    setTimeout(() => store.delete(code), 5 * 60 * 1000);
    return new Response(
      JSON.stringify({ code }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  // GET: kod ile payload al
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    if (!code || !store.has(code)) {
      return new Response(
        JSON.stringify({ error: 'Kod bulunamadı veya süresi doldu.' }),
        { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }
    const data = store.get(code);
    return new Response(
      JSON.stringify(data.payload),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  return new Response('Method not allowed', { status: 405, headers: cors });
}
