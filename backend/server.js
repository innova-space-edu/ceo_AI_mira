// Backend MIRA (Render y OpenRouter)
// Versión SIN TTS local: la voz se genera en el servicio mira-tts.onrender.com

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// -------------------------------------------------------------
// VARIABLES DE ENTORNO
// -------------------------------------------------------------
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// LOGS INFORMATIVOS
console.log("🔧 VARIABLES DE ENTORNO:");
console.log("OPENROUTER_API_KEY:", OPENROUTER_API_KEY ? "OK" : "❌ FALTA");

// -------------------------------------------------------------
// 1) CHAT MIRA → OpenRouter
// -------------------------------------------------------------
app.post("/api/mira", async (req, res) => {
    try {
        if (!OPENROUTER_API_KEY) {
            return res.status(500).json({ error: "Falta OPENROUTER_API_KEY" });
        }

        const { message, history } = req.body || {};

        if (!message) {
            return res.status(400).json({ error: "message es obligatorio" });
        }

        const messages = [
            {
                role: "system",
                content: `
Eres MIRA, la asistente virtual futurista de Innova Space Education SPA.
Hablas español, tono femenino amable, profesional, futurista.
No uses emojis.
Tu enfoque:
- IA educativa e innovación
- Desarrollo web futurista
- Asistentes virtuales
- Remodelación de salas temáticas
- Integración de tecnología en colegios
En cotizaciones, invita a escribir a contacto@innova-space-edu.cl.
                `.trim()
            }
        ];

        // Historial opcional
        if (Array.isArray(history)) {
            history.forEach(h => {
                if (h?.role && h?.content) messages.push(h);
            });
        }

        messages.push({ role: "user", content: message });

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://innova-space-edu.cl",
                "X-Title": "Innova Space Education - MIRA"
            },
            body: JSON.stringify({
                model: "meta-llama/llama-3.1-70b-instruct",
                messages,
                temperature: 0.6,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const txt = await response.text();
            console.error("❌ OpenRouter Error:", txt);
            return res.status(500).json({ error: "Error OpenRouter", detail: txt });
        }

        const data = await response.json();
        const reply = data?.choices?.[0]?.message?.content ?? "No pude generar respuesta.";

        res.json({ reply });

    } catch (error) {
        console.error("❌ /api/mira ERROR:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// -------------------------------------------------------------
// 2) HOME TEST
// -------------------------------------------------------------
app.get("/", (req, res) => {
    res.send("🚀 MIRA backend funcionando correctamente (chat con OpenRouter). La voz se maneja desde el servicio mira-tts.");
});

// -------------------------------------------------------------
// INICIO DEL SERVIDOR
// -------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`🚀 Backend MIRA escuchando en puerto ${PORT}`);
});
