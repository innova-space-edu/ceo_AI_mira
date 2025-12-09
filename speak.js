// speak.js — Voz de MIRA para la página CEO

let MIRA_VOICE_ENABLED = true;
let miraVoice = null;

// Limpia texto para que suene bien en voz (sin LaTeX ni Markdown raro)
function miraPlainTextForVoice(markdown) {
  if (!markdown) return "";

  let text = markdown
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (t.startsWith("```")) return false;      // bloques de código
      if (t.startsWith("$$") || t.endsWith("$$")) return false; // fórmulas largas
      if (t.includes("$")) return false;          // LaTeX en línea
      return true;
    })
    .join(". ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/([.,;:!?\)])([^\s.])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  text = text.replace(/\.{2,}/g, ".").replace(/\. \./g, ". ");
  return text;
}

// Selecciona una voz femenina en español si es posible
function initMiraVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices || !voices.length) return;

  // intenta es-CL, es-ES femenino, luego cualquier español
  miraVoice =
    voices.find(v => /es-CL/i.test(v.lang)) ||
    voices.find(v => /es-ES/i.test(v.lang) && /female|woman|mujer/i.test(v.name)) ||
    voices.find(v => /^es-/i.test(v.lang)) ||
    null;
}

// Función principal para hablar
function speakMira(text) {
  if (!MIRA_VOICE_ENABLED) return;
  if (!("speechSynthesis" in window)) return;

  const plain = miraPlainTextForVoice(text);
  if (!plain) return;

  try {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(plain);
    msg.lang = miraVoice?.lang || "es-ES";
    if (miraVoice) msg.voice = miraVoice;
    msg.rate = 1.0;
    msg.pitch = 1.05;

    // opcional: animar algo del widget cuando habla
    const widget = document.getElementById("mira-widget");
    if (widget) widget.classList.add("mira-speaking");

    msg.onend = () => {
      if (widget) widget.classList.remove("mira-speaking");
    };
    msg.onerror = () => {
      if (widget) widget.classList.remove("mira-speaking");
    };

    window.speechSynthesis.speak(msg);
  } catch (e) {
    console.error("Error en speakMira:", e);
  }
}

// Toggle del botón de volumen del widget
function setupMiraVoiceToggle() {
  const btn = document.getElementById("mira-voice-toggle");
  if (!btn) return;

  btn.addEventListener("click", () => {
    MIRA_VOICE_ENABLED = !MIRA_VOICE_ENABLED;
    const icon = btn.querySelector("i");
    if (MIRA_VOICE_ENABLED) {
      if (icon) icon.className = "ri-volume-up-fill";
      btn.title = "Desactivar voz";
    } else {
      window.speechSynthesis.cancel();
      if (icon) icon.className = "ri-volume-mute-line";
      btn.title = "Activar voz";
    }
  });

  // Estado inicial
  const icon = btn.querySelector("i");
  if (icon) icon.className = "ri-volume-up-fill";
  btn.title = "Desactivar voz";
}

// Inicializa voces cuando se cargan
window.addEventListener("load", () => {
  initMiraVoice();
  setupMiraVoiceToggle();
});
window.speechSynthesis?.addEventListener("voiceschanged", initMiraVoice);
