// MAIN JS PARA INNOVA SPACE EDUCATION SPA

// URL del backend de MIRA en Render (NO expone la API key de OpenRouter)
const MIRA_API_URL = "https://ceo-ai-mira.onrender.com/api/mira";
// Ya no usamos backend TTS, pero dejamos la constante para no romper nada previo
const MIRA_TTS_URL = "https://ceo-ai-mira.onrender.com/api/tts";

// 1. Loader global (se oculta después de unos segundos)
window.addEventListener("load", () => {
    const loader = document.getElementById("global-loader");
    setTimeout(() => {
        if (loader) loader.classList.add("hidden");
    }, 1500);

    initStarfield();
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

/* ------------------------------------------------------------------
   4. FONDO ANIMADO: ESTRELLAS + NEBULOSA AZUL-VIOLETA + ESTRELLAS FUGACES
------------------------------------------------------------------ */

function initStarfield() {
    const canvas = document.getElementById("starsCanvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let width, height;
    let stars = [];
    let shootingStars = [];

    const STAR_COUNT = 200;
    const STAR_SPEED_MIN = 0.02;
    const STAR_SPEED_MAX = 0.18;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }

    function createStars() {
        stars = [];
        for (let i = 0; i < STAR_COUNT; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 1.6 + 0.3,
                speed: STAR_SPEED_MIN + Math.random() * (STAR_SPEED_MAX - STAR_SPEED_MIN),
                alpha: 0.3 + Math.random() * 0.7,
                twinkleOffset: Math.random() * Math.PI * 2
            });
        }
    }

    function addShootingStar() {
        const fromTop = Math.random() < 0.5;
        const startX = fromTop ? Math.random() * width * 0.6 + width * 0.2 : -50;
        const startY = fromTop ? -40 : Math.random() * height * 0.4 + height * 0.2;
        const angle = fromTop ? Math.random() * 0.5 + 0.4 : Math.random() * 0.4 + 0.2;

        shootingStars.push({
            x: startX,
            y: startY,
            vx: Math.cos(angle) * 15,
            vy: Math.sin(angle) * 10,
            life: 0,
            maxLife: 40 + Math.random() * 20
        });
    }

    function scheduleShootingStar() {
        // Frecuentes: entre 3 y 6 segundos
        const delay = 3000 + Math.random() * 3000;
        setTimeout(() => {
            addShootingStar();
            scheduleShootingStar();
        }, delay);
    }

    function drawNebula() {
        const gradient1 = ctx.createRadialGradient(
            width * 0.3, height * 0.25, 0,
            width * 0.3, height * 0.25, width * 0.7
        );
        gradient1.addColorStop(0, "rgba(120, 180, 255, 0.95)");
        gradient1.addColorStop(0.3, "rgba(80, 130, 255, 0.7)");
        gradient1.addColorStop(0.7, "rgba(15, 20, 50, 0.0)");

        const gradient2 = ctx.createRadialGradient(
            width * 0.85, height * 0.8, 0,
            width * 0.85, height * 0.8, width * 0.6
        );
        gradient2.addColorStop(0, "rgba(210, 110, 255, 0.9)");
        gradient2.addColorStop(0.3, "rgba(140, 70, 230, 0.6)");
        gradient2.addColorStop(0.8, "rgba(10, 5, 30, 0.0)");

        ctx.fillStyle = gradient1;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = gradient2;
        ctx.fillRect(0, 0, width, height);
    }

    function update() {
        ctx.clearRect(0, 0, width, height);

        // Fondo base
        ctx.fillStyle = "#02030a";
        ctx.fillRect(0, 0, width, height);

        // Nebulosa azul-violeta
        drawNebula();

        // Estrellas
        const time = Date.now() * 0.0015;
        for (const star of stars) {
            star.x += star.speed;
            if (star.x > width + 5) {
                star.x = -5;
                star.y = Math.random() * height;
            }

            const twinkle = (Math.sin(time + star.twinkleOffset) + 1) / 2; // 0..1
            const alpha = star.alpha * (0.4 + 0.6 * twinkle);

            ctx.beginPath();
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Estrellas fugaces
        for (let i = shootingStars.length - 1; i >= 0; i--) {
            const s = shootingStars[i];
            s.x += s.vx;
            s.y += s.vy;
            s.life++;

            const lifeRatio = 1 - s.life / s.maxLife;
            const length = 120 * lifeRatio;

            ctx.strokeStyle = `rgba(255, 255, 255, ${lifeRatio})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(
                s.x - s.vx * 0.8 - length * 0.4,
                s.y - s.vy * 0.8 - length * 0.4
            );
            ctx.stroke();

            if (s.life > s.maxLife) {
                shootingStars.splice(i, 1);
            }
        }

        requestAnimationFrame(update);
    }

    window.addEventListener("resize", () => {
        resize();
        createStars();
    });

    resize();
    createStars();
    scheduleShootingStar();
    update();
}

/* ------------------------------------------------------------------
   5. Chatbot MIRA (con voz femenina vía Silero TTS local)
------------------------------------------------------------------ */

// Estado de MIRA
let miraVoiceEnabled = true;

// Elementos
const miraToggleBtn = document.getElementById("mira-toggle");
const miraChat = document.getElementById("mira-chat");
const miraCloseBtn = document.getElementById("mira-close");
const miraMessages = document.getElementById("miraMessages");
const miraForm = document.getElementById("miraForm");
const miraInput = document.getElementById("miraInput");
const miraLoading = document.getElementById("miraLoading");
const miraVoiceToggle = document.getElementById("mira-voice-toggle");

// Mensaje de bienvenida estándar de MIRA
const MIRA_WELCOME_TEXT =
    "Bienvenido a Innova Space Education. Soy MIRA, una inteligencia asistencial diseñada para acompañarle en este entorno futurista. Estoy lista para ayudarle en lo que necesite.";

// Inicializar mensaje de bienvenida del chat
function initMiraWelcome() {
    if (!miraMessages) return;
    miraMessages.innerHTML = "";
    addMiraMessage(
        "Bienvenido a Innova Space Education.<br>" +
        "Soy <strong>MIRA</strong>, una inteligencia asistencial diseñada para acompañarle en este entorno futurista.<br>" +
        "Puedo explicarle qué hace la empresa, nuestros servicios y cómo podemos apoyar su proyecto."
    );
}

document.addEventListener("DOMContentLoaded", () => {
    initMiraWelcome();
    setupMiraHints();
    setupMiraSectionObserver();

    // Intentamos saludo de voz general (algunos navegadores requieren interacción previa)
    setTimeout(() => {
        speakWithMiraVoice(MIRA_WELCOME_TEXT, "calida");
    }, 1600);
});

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

    const spoken = sanitizeForSpeech(stripHtml(htmlText));
    speakWithMiraVoice(spoken);
}

function scrollMiraToBottom() {
    if (!miraMessages) return;
    miraMessages.scrollTop = miraMessages.scrollHeight;
}

// 6. "Pensar" y responder usando backend + fallback local
async function handleMiraResponse(userText) {
    if (!miraLoading) return;
    miraLoading.classList.add("active");

    let reply = "";

    try {
        const res = await fetch(MIRA_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userText })
        });

        if (!res.ok) {
            throw new Error("Respuesta HTTP no OK");
        }

        const data = await res.json();
        reply = data.reply || generateMiraResponse(userText);
    } catch (error) {
        console.warn("Fallo llamada a backend de MIRA, usando respuesta local:", error);
        reply = generateMiraResponse(userText);
    } finally {
        miraLoading.classList.remove("active");
    }

    addMiraMessage(reply);
}

// 7. Respuestas básicas según texto del usuario (fallback local)
function generateMiraResponse(text) {
    const t = text.toLowerCase();

    if (t.includes("hola") || t.includes("buenas") || t.includes("hi")) {
        return "Hola, es un gusto saludarle. Soy MIRA, la asistente virtual de Innova Space Education. ¿Desea saber sobre la empresa, los servicios o algún proyecto en particular?";
    }

    if (t.includes("empresa") || t.includes("innova")) {
        return "Innova Space Education SPA integra educación, inteligencia artificial y desarrollo web para crear proyectos futuristas. Trabajamos con colegios, instituciones y emprendimientos en Chile, desarrollando plataformas, asistentes virtuales y soluciones a la medida.";
    }

    if (t.includes("mira") && (t.includes("quien") || t.includes("quién") || t.includes("creó") || t.includes("creo"))) {
        return "Fui diseñada dentro del ecosistema de Innova Space Education SPA como una inteligencia asistencial para acompañar procesos educativos y de gestión. Formo parte de una línea de proyectos que conectan IA, desarrollo web y espacios educativos innovadores.";
    }

    if (t.includes("ia") || t.includes("inteligencia artificial")) {
        return "Nuestro trabajo con IA incluye asistentes virtuales como MIRA, análisis de datos, apoyo a clases, automatización de procesos administrativos y diseño de soluciones que se conectan con plataformas web y sistemas existentes.";
    }

    if (t.includes("web") || t.includes("página") || t.includes("sitio")) {
        return "Desarrollamos páginas web futuristas, responsivas y conectadas a bases de datos o APIs. Podemos crear un sitio para su colegio, emprendimiento o empresa, incluyendo panel de administración y módulos personalizados.";
    }

    if (t.includes("redes") || t.includes("instagram") || t.includes("facebook") || t.includes("youtube") || t.includes("x ")) {
        return "Gestionamos redes sociales como Instagram, Facebook, X y YouTube: identidad visual, diseño de posts, reels y videos, además de planificación de contenidos para que su proyecto tenga una presencia digital coherente.";
    }

    if (t.includes("contacto") || t.includes("reunión") || t.includes("cotización")) {
        return "Puede escribir directamente a <b>contacto@innova-space-edu.cl</b> o usar el formulario de contacto de esta web. Coordinamos reuniones para revisar su proyecto y armar una propuesta a medida.";
    }

    if (t.includes("ubicación") || t.includes("dónde están") || t.includes("donde están") || t.includes("donde estan")) {
        return "Innova Space Education SPA proyecta su trabajo desde la zona norte de Chile, con base en Vallenar – Antofagasta, y atención remota a instituciones de todo el país.";
    }

    // Respuesta genérica
    return "He registrado su consulta. Soy una versión de MIRA integrada en esta página para explicar los servicios de Innova Space Education SPA, la forma en que trabajamos con IA, desarrollo web y proyectos educativos. ¿Sobre qué área le gustaría profundizar?";
}

// Utilidad para quitar etiquetas HTML antes de hablar
function stripHtml(html) {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || "";
}

// Eliminar emojis y caracteres que provocan que lea "cara de robot", "destellos", etc.
function sanitizeForSpeech(text) {
    if (!text) return "";

    let clean = text;

    // Eliminar emojis (rango Unicode general)
    try {
        clean = clean.replace(/[\u{1F300}-\u{1FAFF}]/gu, "");
        clean = clean.replace(/[\u2600-\u27BF]/g, ""); // símbolos varios
    } catch (e) {
        // Si el navegador no soporta unicode escapes, ignoramos este paso
    }

    // Eliminar algunos símbolos de marcado (*, _, ~, `) que no aportan al habla
    clean = clean.replace(/[*_`~]+/g, "");

    // Colapsar espacios
    clean = clean.replace(/\s{2,}/g, " ").trim();

    return clean;
}

/* ------------------------------------------------------------------
   8. Voz femenina con Silero TTS (vía modelo local en GitHub)
   Voz predeterminada: femenina latina neutra
------------------------------------------------------------------ */

function speakWithMiraVoice(text, emotion = "neutral") {
    if (!miraVoiceEnabled) return;
    if (!text) return;

    const clean = sanitizeForSpeech(text);

    if (typeof window.sileroSpeak === "function") {
        // Voz por defecto: latina_neutra
        window.sileroSpeak(clean, "latina_neutra", emotion);
    } else {
        console.warn("Silero TTS aún no está cargado (sileroSpeak no definido).");
    }
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

/* ------------------------------------------------------------------
   9. MIRA reacciona a elementos importantes (hover / secciones)
------------------------------------------------------------------ */

// Voz cuando el usuario pasa el mouse por elementos con data-mira-hint
function setupMiraHints() {
    const hintElements = document.querySelectorAll("[data-mira-hint]");
    hintElements.forEach(el => {
        el.addEventListener("mouseenter", () => {
            const hint = el.getAttribute("data-mira-hint");
            const spoken = sanitizeForSpeech(hint || "");
            speakWithMiraVoice(spoken, "dulce");
        });
    });
}

// Voz al entrar en secciones clave (se dice solo una vez por sección)
function setupMiraSectionObserver() {
    const sections = document.querySelectorAll(".section[data-mira-section]");
    if (!("IntersectionObserver" in window) || sections.length === 0) return;

    const spokenSections = new Set();

    const messages = {
        "sobre": "En la sección Sobre la empresa puede conocer el enfoque de Innova Space Education y las áreas en las que trabajamos.",
        "servicios": "En la sección de Servicios encontrará un resumen de las soluciones en inteligencia artificial, desarrollo web, redes sociales y proyectos educativos.",
        "portafolio": "En el Portafolio se muestran proyectos y plataformas que podemos adaptar a su institución o emprendimiento.",
        "redes": "En la sección de Redes sociales puede conectar con nuestro ecosistema digital para seguir novedades y contenidos.",
        "contacto": "En la sección de Contacto puede enviarnos sus datos para coordinar una reunión o solicitar una propuesta."
    };

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute("data-mira-section");
                if (!id || spokenSections.has(id)) return;
                spokenSections.add(id);

                const msg = messages[id];
                if (msg) {
                    speakWithMiraVoice(msg, "calida");
                }
            }
        });
    }, { threshold: 0.4 });

    sections.forEach(sec => observer.observe(sec));
}
