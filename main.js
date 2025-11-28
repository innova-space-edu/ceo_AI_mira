// MAIN JS PARA INNOVA SPACE EDUCATION SPA

// 1. Loader global (se oculta después de unos segundos)
window.addEventListener("load", () => {
    const loader = document.getElementById("global-loader");
    setTimeout(() => {
        loader.classList.add("hidden");
    }, 1500);
});

// 2. Año en footer
document.addEventListener("DOMContentLoaded", () => {
    const yearSpan = document.getElementById("year");
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
});

// 3. Navbar mobile
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");

if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
        navLinks.classList.toggle("nav-open");
    });

    navLinks.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            navLinks.classList.remove("nav-open");
        });
    });
}

// 4. Chatbot MIRA (lógica con voz femenina + backend OpenRouter vía Render)

// Estado de MIRA
let miraVoiceEnabled = true;
let miraVoice = null;

// Historial de conversación para contexto
const miraHistory = [];

// URL del backend (Render)
// Cambia ESTA línea cuando tengas la URL real de tu servicio en Render.
const MIRA_API_URL = "https://TU-SERVICIO-MIRA.onrender.com/api/mira";

// Elementos
const miraToggleBtn = document.getElementById("mira-toggle");
const miraChat = document.getElementById("mira-chat");
const miraCloseBtn = document.getElementById("mira-close");
const miraMessages = document.getElementById("miraMessages");
const miraForm = document.getElementById("miraForm");
const miraInput = document.getElementById("miraInput");
const miraLoading = document.getElementById("miraLoading");
const miraVoiceToggle = document.getElementById("mira-voice-toggle");

// Inicializar mensaje de bienvenida
function initMiraWelcome() {
    if (!miraMessages) return;
    miraMessages.innerHTML = "";
    addMiraMessage("Hola, soy MIRA 🤖✨<br>Tu asistente de Innova Space Education SPA. Puedo contarte qué hacemos, nuestros servicios y cómo podemos ayudarte.");
}

document.addEventListener("DOMContentLoaded", initMiraWelcome);

// Abrir / cerrar chat
if (miraToggleBtn && miraChat && miraCloseBtn) {
    miraToggleBtn.addEventListener("click", () => {
        miraChat.classList.toggle("mira-chat-open");
        if (miraChat.classList.contains("mira-chat-open")) {
            initMiraWelcome();
            setTimeout(() => miraInput && miraInput.focus(), 200);
        }
    });

    miraCloseBtn.addEventListener("click", () => {
        miraChat.classList.remove("mira-chat-open");
    });
}

// Enviar mensaje
if (miraForm && miraInput) {
    miraForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = miraInput.value.trim();
        if (!text) return;
        addUserMessage(text);
        miraInput.value = "";
        await handleMiraResponse(text);
    });
}

// Agregar mensajes

function addUserMessage(text) {
    if (!miraMessages) return;
    const div = document.createElement("div");
    div.className = "mira-msg user";
    div.innerText = text;
    miraMessages.appendChild(div);
    scrollMiraToBottom();
}

function addMiraMessage(htmlText) {
    if (!miraMessages) return;
    const div = document.createElement("div");
    div.className = "mira-msg bot";
    div.innerHTML = htmlText;
    miraMessages.appendChild(div);
    scrollMiraToBottom();
    speakWithMiraVoice(stripHtml(htmlText));
}

function scrollMiraToBottom() {
    if (!miraMessages) return;
    miraMessages.scrollTop = miraMessages.scrollHeight;
}

// Manejar respuesta llamando al backend
async function handleMiraResponse(userText) {
    if (!miraLoading) return;
    miraLoading.classList.add("active");

    try {
        const responseText = await callMiraAPI(userText);
        addMiraMessage(responseText);
    } catch (err) {
        console.error("Error al llamar a MIRA backend:", err);
        addMiraMessage(
            "Hubo un problema al conectar con el modelo IA 🔧. " +
            "Aun así, recuerda que Innova Space Education SPA integra educación, IA y desarrollo web futurista. " +
            "Intenta de nuevo en unos minutos."
        );
    } finally {
        miraLoading.classList.remove("active");
    }
}

// Llamada al backend (Render) que a su vez llama a OpenRouter
async function callMiraAPI(userText) {
    if (!MIRA_API_URL || MIRA_API_URL.includes("TU-SERVICIO-MIRA")) {
        console.warn("MIRA_API_URL no está configurada con la URL real de Render.");
        throw new Error("MIRA_API_URL no configurada");
    }

    const payload = {
        message: userText,
        history: miraHistory
    };

    const res = await fetch(MIRA_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const text = await res.text();
        console.error("Respuesta no OK del backend:", res.status, text);
        throw new Error("Backend error " + res.status);
    }

    const data = await res.json();
    const reply = (data.reply || "").trim() || "No pude generar una respuesta en este momento.";

    // Actualizar historial local
    miraHistory.push({ role: "user", content: userText });
    miraHistory.push({ role: "assistant", content: reply });

    return reply;
}

// Utilidad para quitar etiquetas HTML antes de hablar
function stripHtml(html) {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || "";
}

// 5. Voz femenina con SpeechSynthesis

function initMiraVoice() {
    if (!("speechSynthesis" in window)) {
        console.warn("SpeechSynthesis no disponible en este navegador.");
        miraVoiceEnabled = false;
        if (miraVoiceToggle) {
            miraVoiceToggle.classList.add("voice-off");
        }
        return;
    }

    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return;

    // Buscar voz femenina en español primero, luego en otros idiomas
    let femaleSpanish = voices.find(v =>
        v.lang.toLowerCase().startsWith("es") &&
        /female|mujer|helen|lucia|soledad|paula|camila/i.test(v.name)
    );

    let anySpanish = voices.find(v => v.lang.toLowerCase().startsWith("es"));
    let anyFemale = voices.find(v => /female|mujer/i.test(v.name));

    miraVoice = femaleSpanish || anySpanish || anyFemale || voices[0];
}

if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = initMiraVoice;
    initMiraVoice();
}

function speakWithMiraVoice(text) {
    if (!miraVoiceEnabled) return;
    if (!("speechSynthesis" in window)) return;
    if (!text) return;

    const utter = new SpeechSynthesisUtterance(text);
    if (miraVoice) utter.voice = miraVoice;
    utter.rate = 1.0;
    utter.pitch = 1.1;
    utter.volume = 1.0;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
}

// Botón para activar/desactivar voz
if (miraVoiceToggle) {
    miraVoiceToggle.addEventListener("click", () => {
        miraVoiceEnabled = !miraVoiceEnabled;
        miraVoiceToggle.classList.toggle("voice-off", !miraVoiceEnabled);
        miraVoiceToggle.innerHTML = miraVoiceEnabled
            ? '<i class="ri-volume-up-fill"></i>'
            : '<i class="ri-volume-mute-fill"></i>';
    });
}
