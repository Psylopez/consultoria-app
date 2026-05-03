export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { system, messages } = req.body;
    const userMessage = messages?.[0]?.content || '';
    const prompt = system + '\n\nUSUARIO:\n' + userMessage;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
        }),
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    // Return in Anthropic-compatible format so App.jsx works without changes
    res.status(200).json({
      content: [{ type: 'text', text }]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
