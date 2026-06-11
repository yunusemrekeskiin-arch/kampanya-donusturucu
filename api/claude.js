import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, model, max_tokens, system } = req.body;

    // Kullanıcının JWT token'ı ile kim olduğunu anlıyoruz
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Giriş yapman gerekiyor.' });

    // Supabase'e bağlan (güvenli sunucu bağlantısı)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Kullanıcıyı doğrula
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return res.status(401).json({ error: 'Geçersiz oturum.' });

    // Kullanıcının API key'ini veritabanından çek
    const { data: settings } = await supabase
      .from('user_settings')
      .select('claude_api_key')
      .eq('user_id', user.id)
      .single();

    const apiKey = settings?.claude_api_key;
    if (!apiKey) return res.status(400).json({ error: 'Claude API anahtarı bulunamadı. Ayarlar\'dan ekle.' });

    // Claude'a istek at (key tarayıcıya dönmez)
    const claudeBody = { model: model || 'claude-haiku-4-5-20251001', max_tokens: max_tokens || 1024, messages };
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
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Claude API hatası' });
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
