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

// 4. Chatbot MIRA (lógica básica con voz femenina)

// Estado de MIRA
let miraVoiceEnabled = true;
let miraVoice = null;

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
    miraForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = miraInput.value.trim();
        if (!text) return;
        addUserMessage(text);
        miraInput.value = "";
        handleMiraResponse(text);
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

// "Pensar" y responder (simulación IA simple)
function handleMiraResponse(userText) {
    if (!miraLoading) return;
    miraLoading.classList.add("active");

    setTimeout(() => {
        miraLoading.classList.remove("active");
        const response = generateMiraResponse(userText);
        addMiraMessage(response);
    }, 800 + Math.random() * 600);
}

// Respuestas básicas según texto del usuario
function generateMiraResponse(text) {
    const t = text.toLowerCase();

    if (t.includes("hola") || t.includes("buenas") || t.includes("hi")) {
        return "¡Hola! ✨ Soy *MIRA*, la asistente de Innova Space Education SPA. ¿Te cuento qué hacemos o quieres saber sobre algún servicio en específico?";
    }

    if (t.includes("empresa") || t.includes("innova")) {
        return "Innova Space Education SPA integra educación, inteligencia artificial y desarrollo web para crear proyectos futuristas. Trabajamos con colegios, instituciones y emprendimientos en Chile.";
    }

    if (t.includes("ia") || t.includes("inteligencia artificial")) {
        return "Nuestro trabajo con IA incluye asistentes virtuales, análisis de datos, apoyo a clases y automatización de procesos educativos y administrativos. También podemos adaptar la IA a tus proyectos específicos.";
    }

    if (t.includes("web") || t.includes("página") || t.includes("sitio")) {
        return "Desarrollamos páginas web futuristas, responsivas y conectadas a bases de datos o APIs. Podemos crear un sitio para tu colegio, emprendimiento o empresa, con panel de administración y herramientas personalizadas.";
    }

    if (t.includes("redes") || t.includes("instagram") || t.includes("facebook") || t.includes("youtube") || t.includes("x ")) {
        return "Gestionamos redes sociales como Instagram, Facebook, X y YouTube: desde la identidad visual hasta la creación de contenido (posts, reels, videos) y planificación de publicaciones.";
    }

    if (t.includes("contacto") || t.includes("reunión") || t.includes("cotización")) {
        return "Puedes escribir directamente a <b>contacto@innova-space-edu.cl</b> o usar el formulario de contacto de esta web. Coordinamos reuniones para revisar tu proyecto y armar una propuesta a medida.";
    }

    if (t.includes("ubicación") || t.includes("dónde están") || t.includes("donde están")) {
        return "Innova Space Education SPA se proyecta desde la zona norte de Chile, con base en Vallenar – Antofagasta, y trabajo remoto con instituciones de todo el país.";
    }

    // Respuesta genérica
    return "Me encanta tu pregunta 💫. Soy una versión de MIRA integrada solo en esta web, pero puedo orientarte sobre los servicios de Innova Space Education SPA, nuestros proyectos con IA, desarrollo web y soluciones educativas. ¿Sobre qué quieres profundizar?";
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
        /female|mujer/i.test(v.name)
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
