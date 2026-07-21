// Control centralizado de voz para MIRA.
// Evita audios superpuestos, solicitudes TTS duplicadas y lecturas simultáneas.
(() => {
  "use strict";

  const state = {
    audio: null,
    audioUrl: null,
    request: null,
    requestId: 0,
    timer: null,
    lastText: "",
    lastStartedAt: 0,
    installed: false
  };

  function cleanupAudio() {
    if (state.audio) {
      try {
        state.audio.pause();
        state.audio.currentTime = 0;
        state.audio.src = "";
      } catch (_) {}
      state.audio = null;
    }

    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
      state.audioUrl = null;
    }

    document.getElementById("mira-widget")?.classList.remove("mira-speaking");
  }

  function stopMiraVoice() {
    state.requestId += 1;
    clearTimeout(state.timer);
    state.timer = null;

    if (state.request) {
      try { state.request.abort(); } catch (_) {}
      state.request = null;
    }

    cleanupAudio();

    if ("speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
  }

  function canSpeak() {
    try {
      if (typeof miraVoiceEnabled !== "undefined" && !miraVoiceEnabled) return false;
      if (typeof miraTTSMutedByMode !== "undefined" && miraTTSMutedByMode) return false;
    } catch (_) {}
    return true;
  }

  function cleanText(text) {
    const raw = String(text || "").trim();
    if (!raw) return "";

    if (typeof sanitizeForSpeech === "function") {
      return sanitizeForSpeech(raw).slice(0, 1500);
    }

    return raw
      .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
      .replace(/[\u2600-\u27BF]/g, "")
      .replace(/[*_`~]+/g, "")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 1500);
  }

  async function requestAndPlay(text, id) {
    if (!canSpeak() || id !== state.requestId) return;

    const controller = new AbortController();
    state.request = controller;

    try {
      const response = await fetch(
        typeof MIRA_TTS_URL !== "undefined"
          ? MIRA_TTS_URL
          : "https://ceo-ai-mira.onrender.com/api/tts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: controller.signal
        }
      );

      if (!response.ok) {
        console.warn("TTS de MIRA no disponible:", await response.text());
        return;
      }

      const blob = await response.blob();
      if (id !== state.requestId || !canSpeak()) return;

      cleanupAudio();
      state.audioUrl = URL.createObjectURL(blob);
      state.audio = new Audio(state.audioUrl);
      state.audio.preload = "auto";

      const widget = document.getElementById("mira-widget");
      widget?.classList.add("mira-speaking");

      const finish = () => {
        if (id === state.requestId) cleanupAudio();
      };

      state.audio.addEventListener("ended", finish, { once: true });
      state.audio.addEventListener("error", finish, { once: true });

      await state.audio.play();
      state.lastStartedAt = Date.now();
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Error de voz de MIRA:", error);
      }
    } finally {
      if (state.request === controller) state.request = null;
    }
  }

  function controlledSpeak(text) {
    const clean = cleanText(text);
    if (!clean || !canSpeak()) return;

    const now = Date.now();
    if (clean === state.lastText && now - state.lastStartedAt < 5000) return;

    stopMiraVoice();
    state.lastText = clean;
    const id = state.requestId;

    // Una breve espera evita disparar muchas voces al mover rápidamente el cursor.
    state.timer = window.setTimeout(() => {
      state.timer = null;
      requestAndPlay(clean, id);
    }, 280);
  }

  function install() {
    if (state.installed) return;
    state.installed = true;

    // Reemplaza la función global declarada en main.js.
    window.speakWithMiraVoice = controlledSpeak;
    window.stopMiraVoice = stopMiraVoice;

    document.getElementById("mira-voice-toggle")?.addEventListener("click", () => {
      window.setTimeout(() => {
        try {
          if (typeof miraVoiceEnabled !== "undefined" && !miraVoiceEnabled) stopMiraVoice();
        } catch (_) {}
      }, 0);
    });

    document.getElementById("mira-close")?.addEventListener("click", stopMiraVoice);
    document.getElementById("mira-mode-voice")?.addEventListener("click", stopMiraVoice);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopMiraVoice();
    });
    window.addEventListener("pagehide", stopMiraVoice);
    window.addEventListener("beforeunload", stopMiraVoice);
  }

  // El archivo puede cargarse antes o después de main.js. Instalamos al final
  // del ciclo de DOMContentLoaded para asegurar que la función original exista.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(install, 0), { once: true });
  } else {
    setTimeout(install, 0);
  }
})();
