import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, n, size, quality, model } = req.body || {};

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Giris yapman gerekiyor.' });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return res.status(401).json({ error: 'Gecersiz oturum.' });

    const { data: settings } = await supabase
      .from('user_settings')
      .select('openai_api_key')
      .eq('user_id', user.id)
      .single();

    const apiKey = settings?.openai_api_key;
    if (!apiKey) return res.status(400).json({ error: 'OpenAI API anahtari bulunamadi. Ayarlar ekranindan ekle.' });

    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ error: 'Prompt bos. Rozet promptu olmadan gorsel uretilemez.' });
    }

    const requestBody = {
      model: model || 'gpt-image-1',
      prompt,
      n: Math.max(1, Math.min(parseInt(n || 1, 10), 4)),
      size: size || '1024x1024',
      quality: quality || 'high'
    };

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error?.message || data.message || 'OpenAI API hatasi';
      return res.status(response.status).json({
        error: message,
        code: data.error?.code || null,
        type: data.error?.type || null,
        param: data.error?.param || null
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
