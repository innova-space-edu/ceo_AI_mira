// Backend simple para MIRA (Render + OpenRouter + ElevenLabs TTS)
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors()); // si luego quieres restringir, acá se puede ajustar
app.use(express.json());

// --- CLAVES DESDE VARIABLES DE ENTORNO ---
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
// VOZ FEMENINA, SUAVE, DULCE, TONO FIRME -> CONFIGURA UN VOICE_ID DE TU CUENTA
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "ELEVEN_VOICE_ID_AQUI";

if (!OPENROUTER_API_KEY) {
    console.warn("⚠️ No se encontró OPENROUTER_API_KEY en las variables de entorno.");
}
if (!ELEVENLABS_API_KEY) {
    console.warn("⚠️ No se encontró ELEVENLABS_API_KEY en las variables de entorno.");
}
if (!ELEVENLABS_VOICE_ID || ELEVENLABS_VOICE_ID === "ELEVEN_VOICE_ID_AQUI") {
    console.warn("⚠️ Recuerda configurar ELEVENLABS_VOICE_ID en Render con el ID de voz femenina que quieras usar.");
}

// ---------------------------------------------------------------------
// 1) Endpoint principal de chat: /api/mira  (OpenRouter)
// ---------------------------------------------------------------------
app.post("/api/mira", async (req, res) => {
    try {
        if (!OPENROUTER_API_KEY) {
            return res.status(500).json({
                error: "Server misconfigured: missing OpenRouter API key."
            });
        }

        const { message, history } = req.body || {};
        if (!message || typeof message !== "string") {
            return res.status(400).json({ error: "message es obligatorio" });
        }

        const messages = [];

        // Mensaje de sistema para el modelo
        messages.push({
            role: "system",
            content: `
Eres MIRA, la asistente virtual futurista de Innova Space Education SPA.
Hablas en español, con tono cercano, profesional y optimista.
Tu foco es explicar los servicios de la empresa:
- Proyectos educativos con IA.
- Asistentes virtuales como MIRA.
- Desarrollo de páginas web futuristas e interactivas.
- Gestión de redes sociales (Instagram, Facebook, X, YouTube).
No inventes precios. Cuando preguntan por valores o propuestas concretas,
invita a escribir a contacto@innova-space-edu.cl.
Si el usuario saluda, responde de forma cálida.
Si el usuario hace preguntas técnicas de IA o web, puedes explicar conceptos generales.
            `.trim()
        });

        // Historial previo (si existe)
        if (Array.isArray(history)) {
            for (const msg of history) {
                if (!msg || !msg.role || !msg.content) continue;
                messages.push({
                    role: msg.role,
                    content: String(msg.content)
                });
            }
        }

        // Mensaje actual del usuario
        messages.push({
            role: "user",
            content: message
        });

        // Llamada a OpenRouter
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://innova-space-edu.cl",
                "X-Title": "Innova Space Education SPA"
            },
            body: JSON.stringify({
                model: "meta-llama/llama-3.1-70b-instruct",
                messages,
                temperature: 0.6,
                max_tokens: 600
            })
        });

        if (!response.ok) {
            const text = await response.text();
            console.error("Error de OpenRouter:", response.status, text);
            return res.status(500).json({
                error: "Error al llamar a OpenRouter",
                status: response.status
            });
        }

        const data = await response.json();
        const reply = data?.choices?.[0]?.message?.content || "No pude generar una respuesta en este momento.";

        return res.json({ reply });
    } catch (err) {
        console.error("Error en /api/mira:", err);
        return res.status(500).json({
            error: "Error interno del servidor"
        });
    }
});

// ---------------------------------------------------------------------
// 2) Endpoint de TTS: /api/tts  (ElevenLabs - voz femenina, suave, dulce)
// ---------------------------------------------------------------------
app.post("/api/tts", async (req, res) => {
    try {
        if (!ELEVENLABS_API_KEY) {
            return res.status(500).json({
                error: "Server misconfigured: missing ElevenLabs API key."
            });
        }
        if (!ELEVENLABS_VOICE_ID || ELEVENLABS_VOICE_ID === "ELEVEN_VOICE_ID_AQUI") {
            return res.status(500).json({
                error: "Server misconfigured: missing ElevenLabs voice ID."
            });
        }

        const { text } = req.body || {};
        if (!text || typeof text !== "string") {
            return res.status(400).json({ error: "text es obligatorio" });
        }

        const ttsResponse = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
            {
                method: "POST",
                headers: {
                    "xi-api-key": ELEVENLABS_API_KEY,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    text,
                    model_id: "eleven_multilingual_v2",
                    voice_settings: {
                        stability: 0.4,
                        similarity_boost: 0.8,
                        style: 0.5,
                        use_speaker_boost: true
                    }
                })
            }
        );

        if (!ttsResponse.ok) {
            const txt = await ttsResponse.text();
            console.error("Error ElevenLabs TTS:", ttsResponse.status, txt);
            return res.status(500).json({
                error: "Error al llamar a ElevenLabs TTS",
                status: ttsResponse.status
            });
        }

        const audioBuffer = await ttsResponse.arrayBuffer();
        const audioData = Buffer.from(audioBuffer);

        res.set("Content-Type", "audio/mpeg");
        res.send(audioData);
    } catch (err) {
        console.error("Error en /api/tts:", err);
        return res.status(500).json({
            error: "Error interno del servidor en TTS"
        });
    }
});

// ---------------------------------------------------------------------
// 3) Raíz de prueba
// ---------------------------------------------------------------------
app.get("/", (req, res) => {
    res.send("MIRA backend funcionando 🚀");
});

app.listen(PORT, () => {
    console.log(`MIRA backend escuchando en puerto ${PORT}`);
});
