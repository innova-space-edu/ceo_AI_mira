// Backend MIRA (Render y OpenRouter)
// Versión SIN TTS local: la voz se genera en el servicio mira-tts.onrender.com

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// -------------------------------------------------------------
// VARIABLES DE ENTORNO
// -------------------------------------------------------------
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

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
// 2) ENVÍO DE CORREO (Zoho Mail) DESDE EL FORMULARIO DE LA WEB
// -------------------------------------------------------------

// Configuración del transporter para Zoho
// Para dominios propios Zoho recomienda smtppro.zoho.com con puerto 587 (StartTLS)
const smtpHost = process.env.SMTP_HOST || "smtppro.zoho.com";
const smtpPort = Number(process.env.SMTP_PORT) || 587;

// Si defines SMTP_SECURE=true en Render usará SSL (465), por defecto usamos StartTLS (false)
const smtpSecure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : false;

const smtpUser = process.env.SMTP_USER || "contacto@innova-space-edu.cl";
const smtpPass = process.env.SMTP_PASS; // contraseña de aplicación Zoho
const emailSendTo = process.env.EMAIL_SEND_TO || "contacto@innova-space-edu.cl";

const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
        user: smtpUser,
        pass: smtpPass
    },
    tls: {
        // Evita problemas de certificado en algunos hosts
        rejectUnauthorized: false
    },
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    socketTimeout: 10000
});

// Opcional: verificar conexión SMTP al iniciar (sin tumbar el backend)
if (smtpHost && smtpUser && smtpPass) {
    transporter.verify((err, success) => {
        if (err) {
            console.error(
                "❌ Error verificando conexión SMTP (el backend sigue funcionando):",
                err.message || err
            );
        } else {
            console.log("✅ Servidor SMTP listo para enviar correos.");
        }
    });
} else {
    console.warn(
        "⚠️ SMTP no configurado completamente. Revisa SMTP_HOST, SMTP_USER y SMTP_PASS."
    );
}

// Ruta original /api/send-email (la dejamos tal cual)
app.post("/api/send-email", async (req, res) => {
    try {
        const { nombre, correo, institucion, ciudad, mensaje } = req.body || {};

        if (!nombre || !correo || !mensaje) {
            return res.status(400).json({ error: "Faltan datos obligatorios (nombre, correo, mensaje)." });
        }

        const asunto = `Nuevo mensaje desde la web - Innova Space Education`;
        const cuerpoTexto = `
Nuevo mensaje desde el formulario de contacto:

Nombre: ${nombre}
Correo: ${correo}
Institución/Empresa: ${institucion || "-"}
Ciudad: ${ciudad || "-"}

Mensaje:
${mensaje}
        `.trim();

        await transporter.sendMail({
            from: `"Innova Space Education" <${smtpUser}>`,
            replyTo: correo,
            to: emailSendTo,
            subject: asunto,
            text: cuerpoTexto
        });

        res.json({ success: true, message: "Correo enviado correctamente" });

    } catch (error) {
        console.error("❌ Error al enviar correo:", error.message || error);
        res.status(500).json({ error: "No se pudo enviar el correo" });
    }
});

// ⚠️ NUEVO: ruta /api/contact que usa la misma lógica (para que main.js funcione)
app.post("/api/contact", async (req, res) => {
    try {
        const { nombre, correo, institucion, ciudad, mensaje } = req.body || {};

        if (!nombre || !correo || !mensaje) {
            return res.status(400).json({ error: "Faltan datos obligatorios (nombre, correo, mensaje)." });
        }

        const asunto = `Nuevo mensaje desde la web - Innova Space Education`;
        const cuerpoTexto = `
Nuevo mensaje desde el formulario de contacto:

Nombre: ${nombre}
Correo: ${correo}
Institución/Empresa: ${institucion || "-"}
Ciudad: ${ciudad || "-"}

Mensaje:
${mensaje}
        `.trim();

        await transporter.sendMail({
            from: `"Innova Space Education" <${smtpUser}>`,
            replyTo: correo,
            to: emailSendTo,
            subject: asunto,
            text: cuerpoTexto
        });

        res.json({ success: true, message: "Correo enviado correctamente" });

    } catch (error) {
        console.error("❌ Error al enviar correo (ruta /api/contact):", error.message || error);
        res.status(500).json({ error: "No se pudo enviar el correo" });
    }
});

// -------------------------------------------------------------
// 3) HOME TEST
// -------------------------------------------------------------
app.get("/", (req, res) => {
    res.send("🚀 MIRA backend funcionando correctamente (chat con OpenRouter + envío de correos por Zoho). La voz se maneja desde el servicio mira-tts.");
});

// -------------------------------------------------------------
// INICIO DEL SERVIDOR
// -------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`🚀 Backend MIRA escuchando en puerto ${PORT}`);
});
