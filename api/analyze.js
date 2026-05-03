export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { system, messages } = req.body;
    const userMessage = messages?.[0]?.content || '';
    
    // Build prompt — tell Gemini explicitly to return only JSON
    const prompt = system + '\n\nDATO DEL USUARIO:\n' + userMessage + '\n\nIMPORTANTE: Responde ÚNICAMENTE con el objeto JSON. Sin texto adicional, sin explicaciones, sin bloques de código markdown. Solo el JSON puro comenzando con { y terminando con }.';

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { 
            temperature: 0.4, 
            maxOutputTokens: 2048,
            responseMimeType: 'application/json'
          },
        }),
      }
    );

    const geminiData = await geminiRes.json();
    
    // Handle Gemini errors
    if (!geminiRes.ok || geminiData.error) {
      return res.status(500).json({ 
        error: geminiData.error?.message || 'Gemini API error',
        content: [{ type: 'text', text: '{}' }]
      });
    }

    let text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!text) {
      // Try alternate response structure
      text = geminiData.candidates?.[0]?.output || 
             JSON.stringify(geminiData.candidates?.[0]?.content) || '{}';
    }
    
    // Clean any markdown wrappers
    text = text.replace(/^```json\s*/gi, '').replace(/^```\s*/gi, '').replace(/```\s*$/gi, '').trim();
    
    // Extract JSON object
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      text = text.substring(start, end + 1);
    }

    res.status(200).json({
      content: [{ type: 'text', text: text || '{}' }]
    });

  } catch (err) {
    res.status(500).json({ 
      error: err.message,
      content: [{ type: 'text', text: '{}' }]
    });
  }
}
