// api/inpaint.js — Vercel Serverless Function
// Replicate CORS proxy — tarayici direkt Replicate'e erisemiyor

export const config = { runtime: 'edge' };

export default async function handler(req) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { image, mask, token } = body;

    if (!image || !mask || !token) {
      return new Response(
        JSON.stringify({ error: 'image, mask ve token zorunlu' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1) Replicate prediction başlat
    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'cdac78a1bec5b23c07fd29692fb70baa513ea403a39e643c48ec5edadb15fe72',
        input: { image, mask }
      })
    });

    if (!startRes.ok) {
      const err = await startRes.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ error: err.detail || 'Replicate baslatma hatasi: ' + startRes.status }),
        { status: startRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prediction = await startRes.json();
    const id = prediction.id;

    // 2) Sonucu bekle (max 60sn, 2sn aralıklarla)
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));

      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });

      const data = await pollRes.json();

      if (data.status === 'succeeded' && data.output) {
        // Output URL'den base64'e çevir
        const outputUrl = Array.isArray(data.output) ? data.output[0] : data.output;
        const imgRes = await fetch(outputUrl);
        const imgBlob = await imgRes.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(imgBlob)));
        const mime = imgRes.headers.get('content-type') || 'image/png';

        return new Response(
          JSON.stringify({ result: `data:${mime};base64,${b64}` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (data.status === 'failed') {
        return new Response(
          JSON.stringify({ error: 'Replicate islemi basarisiz: ' + (data.error || 'bilinmeyen') }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Zaman asimi (60sn). Tekrar dene.' }),
      { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
