import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, n, size, quality } = req.body;

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Giriş yapman gerekiyor.' });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return res.status(401).json({ error: 'Geçersiz oturum.' });

    const { data: settings } = await supabase
      .from('user_settings')
      .select('openai_api_key')
      .eq('user_id', user.id)
      .single();

    const apiKey = settings?.openai_api_key;
    if (!apiKey) return res.status(400).json({ error: 'OpenAI API anahtarı bulunamadı. Ayarlar\'dan ekle.' });

    // Prompt zorunlu
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt boş gönderilemez.' });
    }

    const requestBody = {
      model: 'gpt-image-1',
      prompt: prompt.trim(),
      n: Math.min(Math.max(parseInt(n) || 1, 1), 4), // 1-4 arası sınırla
      size: size || '1024x1024',
      quality: quality || 'high'
    };

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      // Tam OpenAI hata detayını aktar — debug için kritik
      const openaiErr = data?.error || {};
      const detail = [
        openaiErr.message,
        openaiErr.code ? `(kod: ${openaiErr.code})` : '',
        openaiErr.type ? `[${openaiErr.type}]` : ''
      ].filter(Boolean).join(' ') || `HTTP ${response.status}`;

      return res.status(response.status).json({
        error: detail,
        openai_error: openaiErr  // ham obje de gönder
      });
    }

    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
