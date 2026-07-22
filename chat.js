// api/chat.js
// Proxy serverless para Vercel: recibe el historial del chat desde el HTML,
// le agrega el prompt de sistema, llama a Groq con la key guardada como
// variable de entorno (nunca queda expuesta en el frontend) y devuelve el texto.
//
// Configuración en Vercel:
//   1. En el dashboard del proyecto -> Settings -> Environment Variables
//   2. Agrega GROQ_API_KEY con tu clave de Groq (empieza con "gsk_...")
//   3. (Opcional) Agrega GROQ_MODEL si quieres usar otro modelo distinto al de por defecto

const SYSTEM_PROMPT = `Eres un asistente educativo dentro de una simulación 3D de un campo agrícola llamado AgroVerde S.A. (12 hectáreas divididas en 12 lotes de lechuga, tomate y pimiento, con sensores IoT y dispensadores de riego automatizados).
Responde en español, de forma clara, breve y didáctica, como si le explicaras a un estudiante. Puedes explicar temas de agricultura, riego, humedad del suelo, sensores IoT, energía solar, cultivos, sostenibilidad, o cualquier otra duda relacionada. Si te preguntan algo fuera de tema, igual intenta ayudar con amabilidad. Usa respuestas de máximo 5-6 líneas salvo que pidan más detalle.`;

export default async function handler(req, res) {
  // CORS básico por si sirves el HTML desde otro dominio (ej. GitHub Pages)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages)) {
    res.status(400).json({ error: '"messages" debe ser un array' });
    return;
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    res.status(500).json({ error: 'Falta configurar GROQ_API_KEY en las variables de entorno de Vercel' });
    return;
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      res.status(groqRes.status).json({ error: data?.error?.message || 'Error al consultar Groq' });
      return;
    }

    const text = data?.choices?.[0]?.message?.content?.trim()
      || 'No pude generar una respuesta, intenta de nuevo.';

    res.status(200).json({ text });
  } catch (err) {
    console.error('Groq proxy error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}
