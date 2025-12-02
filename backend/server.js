// Backend MIRA (Render + OpenRouter) — AHORA con TTS Piper (voz mexicana)
// Mantiene TODAS tus funciones actuales sin borrar nada.

const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

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
// 1) CHAT MIRA → OpenRouter (SIN CAMBIOS)
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
// 2) NUEVO API TTS — Piper ONNX (voz femenina mexicana)
// -------------------------------------------------------------

// Ruta absoluta a los modelos
const MODEL_DIR = path.join(__dirname, "models");
const MODEL_PATH = path.join(MODEL_DIR, "es_MX-claude-high.onnx");
const CONFIG_PATH = path.join(MODEL_DIR, "es_MX-claude-high.onnx.json");

// Valida que existan los archivos
if (!fs.existsSync(MODEL_PATH) || !fs.existsSync(CONFIG_PATH)) {
    console.error("❌ ERROR: Los archivos del modelo Piper NO se encuentran en /backend/models/");
    console.error("Ruta esperada:", MODEL_PATH);
}

app.post("/api/tts", async (req, res) => {
    try {
        const { text } = req.body || {};

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: "Texto vacío" });
        }

        console.log("🔊 Generando voz con Piper:", text);

        // Comando Piper ONNX CLI
        const piper = spawn("piper", [
            "--model", MODEL_PATH,
            "--output_file", "output.wav",
            "--text", text
        ]);

        piper.stderr.on("data", (data) => {
            console.error("Piper STDERR:", data.toString());
        });

        piper.on("close", () => {
            console.log("✔ Piper generó output.wav");

            const audioPath = path.join(process.cwd(), "output.wav");
            if (!fs.existsSync(audioPath)) {
                return res.status(500).json({ error: "Piper no generó el audio" });
            }

            const audio = fs.readFileSync(audioPath);
            res.setHeader("Content-Type", "audio/wav");
            res.send(audio);

            // Limpia archivo temporal
            fs.unlinkSync(audioPath);
        });

    } catch (error) {
        console.error("❌ /api/tts ERROR:", error);
        res.status(500).json({ error: "Error generando TTS" });
    }
});

// -------------------------------------------------------------
// 3) HOME TEST
// -------------------------------------------------------------
app.get("/", (req, res) => {
    res.send("🚀 MIRA backend funcionando correctamente con Piper TTS (voz mexicana)");
});

// -------------------------------------------------------------
// INICIO DEL SERVIDOR
// -------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`🚀 Backend MIRA escuchando en puerto ${PORT}`);
});
