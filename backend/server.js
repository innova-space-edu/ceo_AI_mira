// Backend MIRA (Render y OpenRouter)
// Chat IA + Correos (Resend) + endpoint TTS (ElevenLabs)

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

// Polyfill de fetch para Node (usando node-fetch v3 con import dinámico)
const fetchFn = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// -------------------------------------------------------------
// VARIABLES DE ENTORNO
// -------------------------------------------------------------
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY; // API para envío por HTTP
const EMAIL_SEND_TO =
  process.env.EMAIL_SEND_TO || "contacto@innova-space-edu.cl";

// Remitente por defecto usando tu propio dominio
const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  "Innova Space Education <contacto@innova-space-edu.cl>";

// 🔊 ElevenLabs TTS
const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY || "";
// En Render la variable se llama ELEVENLABS_VOICE_ID
const ELEVEN_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "";

console.log("🔧 VARIABLES DE ENTORNO:");
console.log("OPENROUTER_API_KEY:", OPENROUTER_API_KEY ? "OK" : "❌ FALTA");
console.log("RESEND_API_KEY:", RESEND_API_KEY ? "OK" : "❌ FALTA");
console.log("EMAIL_SEND_TO:", EMAIL_SEND_TO);
console.log("EMAIL_FROM:", EMAIL_FROM);
console.log(
  "ELEVEN_TTS:",
  ELEVEN_API_KEY && ELEVEN_VOICE_ID
    ? "OK (clave y voz configuradas)"
    : "❌ FALTA ELEVEN_API_KEY o ELEVENLABS_VOICE_ID"
);

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
                `.trim(),
      },
    ];

    // Historial opcional
    if (Array.isArray(history)) {
      history.forEach((h) => {
        if (h?.role && h?.content) messages.push(h);
      });
    }

    messages.push({ role: "user", content: message });

    const response = await fetchFn(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://innova-space-edu.cl",
          "X-Title": "Innova Space Education - MIRA",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.1-70b-instruct",
          messages,
          temperature: 0.6,
          max_tokens: 500,
        }),
      }
    );

    if (!response.ok) {
      const txt = await response.text();
      console.error("❌ OpenRouter Error:", txt);
      return res.status(500).json({ error: "Error OpenRouter", detail: txt });
    }

    const data = await response.json();
    const reply =
      data?.choices?.[0]?.message?.content ?? "No pude generar respuesta.";

    res.json({ reply });
  } catch (error) {
    console.error("❌ /api/mira ERROR:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// -------------------------------------------------------------
// 2) SMTP (Zoho) – LEGADO / OPCIONAL
// -------------------------------------------------------------

const smtpHost = process.env.SMTP_HOST || "smtppro.zoho.com";
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpSecure = process.env.SMTP_SECURE
  ? process.env.SMTP_SECURE === "true"
  : false;

const smtpUser = process.env.SMTP_USER || "contacto@innova-space-edu.cl";
const smtpPass = process.env.SMTP_PASS; // contraseña de aplicación Zoho

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 10000,
  greetingTimeout: 8000,
  socketTimeout: 10000,
});

// Verificación SMTP opcional (sabemos que Render suele bloquear SMTP)
if (smtpHost && smtpUser && smtpPass) {
  transporter.verify((err, success) => {
    if (err) {
      console.error(
        "❌ Error verificando conexión SMTP (Render suele bloquear SMTP; el backend SIGUE funcionando):",
        err.message || err
      );
    } else {
      console.log("✅ Servidor SMTP listo para enviar correos.");
    }
  });
} else {
  console.warn(
    "⚠️ SMTP no configurado completamente. Revisa SMTP_HOST, SMTP_USER y SMTP_PASS si vas a usar SMTP en otro hosting."
  );
}

// -------------------------------------------------------------
// FUNCIÓN: envío de correo vía API HTTP (Resend)
// -------------------------------------------------------------
async function enviarCorreoPorAPI({
  nombre,
  correo,
  institucion,
  ciudad,
  mensaje,
}) {
  if (!RESEND_API_KEY) {
    throw new Error("Falta RESEND_API_KEY en variables de entorno");
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

  const cuerpoHtml = `
    <h2>Nuevo mensaje desde la web de Innova Space Education</h2>
    <p><strong>Nombre:</strong> ${nombre}</p>
    <p><strong>Correo:</strong> ${correo}</p>
    <p><strong>Institución / Empresa:</strong> ${institucion || "-"}</p>
    <p><strong>Ciudad:</strong> ${ciudad || "-"}</p>
    <p><strong>Mensaje:</strong></p>
    <p>${(mensaje || "").replace(/\n/g, "<br>")}</p>
  `;

  const respuesta = await fetchFn("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [EMAIL_SEND_TO],
      reply_to: correo,
      subject: asunto,
      text: cuerpoTexto,
      html: cuerpoHtml,
    }),
  });

  if (!respuesta.ok) {
    const txt = await respuesta.text();
    console.error("❌ Error Resend API:", txt);
    throw new Error("Fallo en API de correo");
  }

  const data = await respuesta.json();
  console.log("📧 Correo enviado por API, id:", data.id || data);
  return data;
}

// -------------------------------------------------------------
// 2a) Ruta /api/send-email
// -------------------------------------------------------------
app.post("/api/send-email", async (req, res) => {
  try {
    const { nombre, correo, institucion, ciudad, mensaje } = req.body || {};

    if (!nombre || !correo || !mensaje) {
      return res.status(400).json({
        error: "Faltan datos obligatorios (nombre, correo, mensaje).",
      });
    }

    const data = await enviarCorreoPorAPI({
      nombre,
      correo,
      institucion,
      ciudad,
      mensaje,
    });

    res.json({
      success: true,
      message: "Correo enviado correctamente",
      id: data.id || null,
    });
  } catch (error) {
    console.error("❌ Error al enviar correo:", error.message || error);
    res.status(500).json({ error: "No se pudo enviar el correo" });
  }
});

// -------------------------------------------------------------
// 2b) Ruta /api/contact
// -------------------------------------------------------------
app.post("/api/contact", async (req, res) => {
  try {
    const { nombre, correo, institucion, ciudad, mensaje } = req.body || {};

    if (!nombre || !correo || !mensaje) {
      return res.status(400).json({
        error: "Faltan datos obligatorios (nombre, correo, mensaje).",
      });
    }

    const data = await enviarCorreoPorAPI({
      nombre,
      correo,
      institucion,
      ciudad,
      mensaje,
    });

    res.json({
      success: true,
      message: "Correo enviado correctamente",
      id: data.id || null,
    });
  } catch (error) {
    console.error(
      "❌ Error al enviar correo (ruta /api/contact):",
      error.message || error
    );
    res.status(500).json({ error: "No se pudo enviar el correo" });
  }
});

// -------------------------------------------------------------
// 3) TTS – /api/tts (ElevenLabs)
// -------------------------------------------------------------
app.post("/api/tts", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) {
      return res.status(400).json({ error: "Falta 'text' en el cuerpo." });
    }

    if (!ELEVEN_API_KEY || !ELEVEN_VOICE_ID) {
      return res.status(500).json({
        error:
          "Servicio de voz no configurado. Falta ELEVEN_API_KEY o ELEVENLABS_VOICE_ID.",
      });
    }

    // Llamada a ElevenLabs TTS (sin model_id viejo: que use el modelo por defecto)
    const elevenRes = await fetchFn(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVEN_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          // Sin model_id → usa el modelo actualizado por defecto de esa voz
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      console.error("❌ ElevenLabs TTS error:", errText);
      return res.status(500).json({ error: "Fallo en ElevenLabs TTS" });
    }

    const audioBuffer = await elevenRes.arrayBuffer();
    const buf = Buffer.from(audioBuffer);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", buf.length);
    res.send(buf);
  } catch (err) {
    console.error("❌ /api/tts ERROR:", err);
    res.status(500).json({ error: "Error interno en TTS" });
  }
});

// -------------------------------------------------------------
// 4) HOME TEST
// -------------------------------------------------------------
app.get("/", (req, res) => {
  res.send(
    "🚀 MIRA backend funcionando correctamente (chat con OpenRouter + correos por Resend + /api/tts para voz ElevenLabs)."
  );
});

// -------------------------------------------------------------
// INICIO DEL SERVIDOR
// -------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Backend MIRA escuchando en puerto ${PORT}`);
});
