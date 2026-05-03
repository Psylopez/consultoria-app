export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { system, messages } = req.body;
    const userMessage = messages?.[0]?.content || '';
    const prompt = system + '\n\nDATO DEL USUARIO:\n' + userMessage + '\n\nIMPORTANTE: Responde ÚNICAMENTE con el objeto JSON puro. Sin markdown, sin backticks, sin texto adicional. Solo { ... }.';

    // Try models in order of availability
    const models = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-pro'];
    let text = '';
    let lastError = '';

    for (const model of models) {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
          }),
        }
      );

      const data = await geminiRes.json();
      
      if (data.error) {
        lastError = data.error.message || 'API error';
        continue; // try next model
      }

      text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text) break; // got a response, stop
    }

    if (!text) {
      return res.status(500).json({
        error: lastError || 'No response from Gemini',
        content: [{ type: 'text', text: '{"diagnostico":"Error al conectar con IA","prioridad_detectada":"Error","paquetes":[],"siguiente_paso":"Reintentar"}' }]
      });
    }

    // Clean markdown
    text = text.replace(/^```json\s*/gi, '').replace(/^```\s*/gi, '').replace(/```\s*$/gi, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) text = text.substring(start, end + 1);

    res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (err) {
    res.status(500).json({ error: err.message, content: [{ type: 'text', text: '{}' }] });
  }
}
