export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { system, messages } = req.body;
    const userMessage = messages?.[0]?.content || '';
    const prompt = system + '\n\nDATO DEL USUARIO:\n' + userMessage + '\n\nIMPORTANTE: Responde ÚNICAMENTE con el objeto JSON puro. Sin markdown, sin backticks, sin texto adicional. Solo { ... }.';

    let text = '';
    let lastError = '';

    // ── 1. Gemini 1.5 Flash (free, 1500 req/day) ──────────────────────────
    if (process.env.GEMINI_API_KEY) {
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
            }),
          }
        );
        const d = await r.json();
        if (!d.error) text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
        else lastError = 'Gemini: ' + d.error.message;
      } catch (e) { lastError = 'Gemini error: ' + e.message; }
    }

    // ── 2. Groq Llama 3.3 (free fallback) ─────────────────────────────────
    if (!text && process.env.GROQ_API_KEY) {
      try {
        const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: userMessage + '\n\nIMPORTANTE: Responde ÚNICAMENTE con JSON puro. Sin markdown ni backticks.' }
            ],
            temperature: 0.4,
            max_tokens: 2048,
          }),
        });
        const d = await r.json();
        if (!d.error) text = d.choices?.[0]?.message?.content || '';
        else lastError = 'Groq: ' + (d.error?.message || JSON.stringify(d.error));
      } catch (e) { lastError = 'Groq error: ' + e.message; }
    }

    if (!text) {
      return res.status(500).json({
        error: lastError || 'All AI providers failed',
        content: [{ type: 'text', text: '{}' }]
      });
    }

    // ── Clean JSON ─────────────────────────────────────────────────────────
    text = text.replace(/^```json\s*/gi, '').replace(/^```\s*/gi, '').replace(/```\s*$/gi, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) text = text.substring(start, end + 1);

    res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (err) {
    res.status(500).json({ error: err.message, content: [{ type: 'text', text: '{}' }] });
  }
}
