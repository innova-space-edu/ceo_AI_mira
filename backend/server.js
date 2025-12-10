// Backend MIRA (Render y OpenRouter + Resend + Azure TTS Aria)

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

/* -------------------------------------------------------------
   VARIABLES DE ENTORNO
------------------------------------------------------------- */
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY; // API para envío por HTTP
const EMAIL_SEND_TO =
  process.env.EMAIL_SEND_TO || "contacto@innova-space-edu.cl";

// Remitente por defecto usando tu propio dominio en Resend
const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  "Innova Space Education <contacto@innova-space-edu.cl>";

// Azure Speech (TTS Aria)
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION;

console.log("🔧 VARIABLES DE ENTORNO:");
console.log("OPENROUTER_API_KEY:", OPENROUTER_API_KEY ? "OK" : "❌ FALTA");
console.log("RESEND_API_KEY:", RESEND_API_KEY ? "OK" : "❌ FALTA");
console.log("EMAIL_SEND_TO:", EMAIL_SEND_TO);
console.log("EMAIL_FROM:", EMAIL_FROM);
console.log("AZURE_SPEECH_KEY:", AZURE_SPEECH_KEY ? "OK" : "❌ FALTA");
console.log("AZURE_SPEECH_REGION:", AZURE_SPEECH_REGION || "❌ FALTA");

/* -------------------------------------------------------------
   1) CHAT MIRA → OpenRouter
------------------------------------------------------------- */
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
Si el usuario habla en inglés, responde en inglés.
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

/* -------------------------------------------------------------
   2) SMTP (Zoho) – LEGADO / OPCIONAL
   Render bloquea SMTP, pero mantenemos la configuración
   por si en el futuro migras a otro hosting que sí lo permita
------------------------------------------------------------- */

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

// Verificación SMTP opcional (sabemos que en Render normalmente fallará)
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

/* -------------------------------------------------------------
   FUNCIÓN: envío de correo vía API HTTP (Resend)
------------------------------------------------------------- */
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

/* -------------------------------------------------------------
   2a) Ruta /api/send-email (usa API HTTP de correo)
------------------------------------------------------------- */
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

/* -------------------------------------------------------------
   2b) Ruta /api/contact (misma lógica para el formulario principal)
------------------------------------------------------------- */
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

/* -------------------------------------------------------------
   3) AZURE TTS – VOZ ARIA (bilingüe ES/EN)
------------------------------------------------------------- */

// Pequeño helper para escapar texto en SSML
function escapeXml(unsafe) {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Detección muy simple de idioma para elegir ES o EN
function detectarIdioma(texto) {
  if (!texto) return "es";

  const hasTildes = /[áéíóúñ¿¡]/i.test(texto);
  const hasOnlyBasicAscii = /^[\x00-\x7F]*$/.test(texto);
  const containsCommonEnglishWords = /\b(the|and|you|for|with|this|that|is|are|can)\b/i.test(
    texto
  );

  // Si tiene tildes o signos de interrogación/exclamación invertidos → español
  if (hasTildes) return "es";

  // Si son caracteres básicos y muchas palabras típicas de inglés → inglés
  if (hasOnlyBasicAscii && containsCommonEnglishWords) return "en";

  // Por defecto, asumimos español
  return "es";
}

app.post("/api/tts", async (req, res) => {
  try {
    const { text } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "text es obligatorio" });
    }

    if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
      return res.status(500).json({
        error:
          "Faltan AZURE_SPEECH_KEY o AZURE_SPEECH_REGION en las variables de entorno",
      });
    }

    // Limitamos un poco el largo por seguridad
    const rawText = text.trim();
    const truncatedText =
      rawText.length > 800 ? rawText.slice(0, 800) + "..." : rawText;

    const idioma = detectarIdioma(truncatedText);

    // Voz Aria en español latino (bilingüe, pronuncia bien inglés dentro)
    let locale = "es-MX";
    let voiceName = "es-MX-AriaNeural";

    // Si detecta inglés fuertemente, usamos la Aria de EE.UU.
    if (idioma === "en") {
      locale = "en-US";
      voiceName = "en-US-AriaNeural";
    }

    const ssml = `
<speak version="1.0" xml:lang="${locale}">
  <voice name="${voiceName}">
    ${escapeXml(truncatedText)}
  </voice>
</speak>
    `.trim();

    const ttsEndpoint = `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

    const azureResp = await fetchFn(ttsEndpoint, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "mira-backend",
      },
      body: ssml,
    });

    if (!azureResp.ok) {
      const errText = await azureResp.text();
      console.error("❌ Azure TTS error:", errText);
      return res
        .status(500)
        .json({ error: "Error al generar audio con Azure TTS" });
    }

    const arrayBuffer = await azureResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.set("Content-Type", "audio/mpeg");
    res.set("Content-Length", buffer.length.toString());
    res.send(buffer);
  } catch (error) {
    console.error("❌ /api/tts ERROR:", error);
    res.status(500).json({ error: "Error interno generando TTS" });
  }
});

/* -------------------------------------------------------------
   4) HOME TEST
------------------------------------------------------------- */
app.get("/", (req, res) => {
  res.send(
    "🚀 MIRA backend funcionando correctamente (chat con OpenRouter + correos con Resend + TTS Azure Aria en /api/tts)."
  );
});

/* -------------------------------------------------------------
   INICIO DEL SERVIDOR
------------------------------------------------------------- */
app.listen(PORT, () => {
  console.log(`🚀 Backend MIRA escuchando en puerto ${PORT}`);
});
