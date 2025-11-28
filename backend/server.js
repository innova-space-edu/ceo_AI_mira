// Backend simple para MIRA (Render + OpenRouter)
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors()); // si luego quieres restringir, acá se puede ajustar
app.use(express.json());

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
    console.warn("⚠️ No se encontró OPENROUTER_API_KEY en las variables de entorno.");
}

// Endpoint principal: /api/mira
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

app.get("/", (req, res) => {
    res.send("MIRA backend funcionando 🚀");
});

app.listen(PORT, () => {
    console.log(`MIRA backend escuchando en puerto ${PORT}`);
});
