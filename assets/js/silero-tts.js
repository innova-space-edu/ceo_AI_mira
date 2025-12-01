// --------------------------------------------------------
// SILERO TTS - Control de voces, emociones y playback
// --------------------------------------------------------

let silero = null;

// Puedes alojar el modelo en GitHub Pages
// EJEMPLO (ajusta al link real de tu repo):
const SILERO_MODEL_URL =
    "https://innova-space-edu.github.io/ceo_AI_mira/assets/models/silero_onnx.onnx";

async function initSilero() {
    if (silero) return;
    silero = new SileroEngine(SILERO_MODEL_URL);
    await silero.loadModel();
}

// Voces disponibles
const SILERO_VOICES = {
    latina_neutra: 0,
    juvenil_dulce: 1
};

// Emociones (multiplican signos en el texto)
const EMOTION_STYLES = {
    neutral: "",
    dulce: " ❤️",
    firme: " ⚡",
    calida: " 🌟"
};

async function sileroSpeak(text, voice = "latina_neutra", emotion = "neutral") {
    try {
        await initSilero();

        let finalText = text + (EMOTION_STYLES[emotion] || "");

        const wavBuffer = await silero.synthesize(
            finalText,
            SILERO_VOICES[voice]
        );

        const blob = new Blob([wavBuffer], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);

        const audio = new Audio(url);
        audio.play();

    } catch (e) {
        console.error("❌ Error reproduciendo Silero TTS:", e);
    }
}

window.sileroSpeak = sileroSpeak;
