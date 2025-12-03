// Backend MIRA (Render + OpenRouter + Zoho Mail)
// Versión SIN TTS local: el TTS se gestiona desde mira-tts.onrender.com

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// -------------------------------------------------------------
// VARIABLES DE ENTORNO
// -------------------------------------------------------------
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// SMTP / Zoho Mail
const smtpHost = process.env.SMTP_HOST || "smtp.zoho.com";
const smtpPort = Number(process.env.SMTP_PORT) || 465; // SSL Zoho
const smtpSecure = process.env.SMTP_SECURE === "false" ? false : true;

const smtpUser = process.env.SMTP_USER || "contacto@innova-space-edu.cl";
const smtpPass = process.env.SMTP_PASS; // viene desde Render
const emailSendTo = process.env.EMAIL_SEND_TO || "contacto@innova-space-edu.cl";

console.log("🔧 VARIABLES DE ENTORNO:");
console.log("OPENROUTER_API_KEY:", OPENROUTER_API_KEY ? "OK" : "❌ FALTA");
console.log("SMTP_USER:", smtpUser);
console.log("SMTP_PASS:", smtpPass ? "OK" : "❌ FALTA");
console.log("-------------------------------------------");

// -------------------------------------------------------------
// 1) CHAT MIRA → OpenRouter
// -------------------------------------------------------------
app.post("/api/mira", async (req, res) => {
    try {
        if (!OPENROUTER_API_KEY) {
            return res.status(500).json({ error: "Falta OPENROUTER_API_KEY" });
        }

        const { message, history } = req.body || {};

        if (!message || typeof message !== "string") {
            return res.status(400).json({ error: "message es obligatorio" });
        }

        const messages = [
            {
                role: "system",
                content: `
Eres MIRA, la asistente virtual futurista de Innova Space Education SPA.
Hablas español, tono femenino amable, profesional y futurista.
NO uses emojis. NO seas demasiado larga.
Puedes responder sobre:
- inteligencia artificial educativa
- desarrollo web futurista
- remodelación de ambientes escolares
- asistentes virtuales
- plataformas con IA
Si es una cotización o proyecto, invita a enviar correo a contacto@innova-space-edu.cl.
                `.trim()
            }
        ];

        // Historial (opcional)
        if (Array.isArray(history)) {
            history.forEach(h => {
                if (h?.role && h?.content) messages.push(h);
            });
        }

        messages.push({ role: "user", content: message });

        // Llamado a OpenRouter
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
            console.error("❌ Error OpenRouter:", txt);
            return res.status(500).json({ error: "Error desde OpenRouter", detail: txt });
        }

        const data = await response.json();
        const reply = data?.choices?.[0]?.message?.content || "No pude generar una respuesta.";

        res.json({ reply });

    } catch (error) {
        console.error("❌ /api/mira ERROR:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// -------------------------------------------------------------
// 2) ENVÍO DE CORREO (Zoho Mail) DESDE EL FORMULARIO DE LA WEB
// -------------------------------------------------------------

// Transporter Zoho Mail
const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
        user: smtpUser,
        pass: smtpPass
    }
});

// Verificación inicial del SMTP
transporter.verify((err) => {
    if (err) {
        console.error("❌ Error al conectar con SMTP Zoho:", err);
    } else {
        console.log("✅ SMTP Zoho conectado correctamente.");
    }
});

// Endpoint para enviar correos desde el formulario
app.post("/api/send-email", async (req, res) => {
    try {
        const { nombre, correo, institucion, ciudad, mensaje } = req.body || {};

        if (!nombre || !correo || !mensaje) {
            return res.status(400).json({
                error: "Faltan datos obligatorios: nombre, correo y mensaje."
            });
        }

        const asunto = `Nuevo mensaje desde la web - Innova Space Education`;
        const cuerpoTexto = `
Nuevo mensaje recibido desde el sitio web:

━━━━━━━━━━━━━━━━━━━━━━
👤 Nombre: ${nombre}
📧 Correo: ${correo}
🏫 Institución/Empresa: ${institucion || "-"}
📍 Ciudad: ${ciudad || "-"}
━━━━━━━━━━━━━━━━━━━━━━

📝 Mensaje:
${mensaje}
        `.trim();

        await transporter.sendMail({
            from: `"Innova Space Education" <${smtpUser}>`,
            replyTo: correo,
            to: emailSendTo,
            subject: asunto,
            text: cuerpoTexto
        });

        res.json({
            success: true,
            message: "Correo enviado correctamente."
        });

    } catch (error) {
        console.error("❌ Error enviando correo:", error);
        res.status(500).json({ error: "No se pudo enviar el correo." });
    }
});

// -------------------------------------------------------------
// 3) HOME TEST
// -------------------------------------------------------------
app.get("/", (req, res) => {
    res.send("🚀 Backend MIRA funcionando (OpenRouter + Zoho Mail). El TTS se gestiona desde mira-tts.");
});

// -------------------------------------------------------------
// INICIO DEL SERVIDOR
// -------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`🚀 Backend MIRA escuchando en puerto ${PORT}`);
});
