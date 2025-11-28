// MAIN JS PARA INNOVA SPACE EDUCATION SPA

// ----------------------------------------------
// 1. Loader global (se oculta después de unos segundos)
// ----------------------------------------------
window.addEventListener("load", () => {
    const loader = document.getElementById("global-loader");
    setTimeout(() => {
        if (loader) loader.classList.add("hidden");
    }, 1500);
});

// ----------------------------------------------
// 2. Año en footer
// ----------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    const yearSpan = document.getElementById("year");
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
});

// ----------------------------------------------
// 3. Navbar mobile
// ----------------------------------------------
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

// ----------------------------------------------
// 4. Fondo espacial: estrellas + nebulosas + estrellas fugaces
// ----------------------------------------------
(function initStarfield() {
    const canvas = document.getElementById("starfield");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let width = window.innerWidth;
    let height = window.innerHeight;
    let stars = [];
    let shootingStars = [];
    const STAR_COUNT = 220;

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    }
    resize();
    window.addEventListener("resize", resize);

    function createStars() {
        stars = [];
        for (let i = 0; i < STAR_COUNT; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 1.3 + 0.3,
                speed: Math.random() * 0.25 + 0.05,
                alpha: Math.random() * 0.8 + 0.2
            });
        }
    }
    createStars();

    function createShootingStar() {
        // Se crea de forma aleatoria en la parte superior o lateral
        const fromTop = Math.random() > 0.5;
        shootingStars.push({
            x: fromTop ? Math.random() * width : width + 50,
            y: fromTop ? -20 : Math.random() * (height * 0.5),
            vx: fromTop ? (Math.random() * -2 - 1) : (Math.random() * -4 - 2),
            vy: fromTop ? (Math.random() * 3 + 2) : (Math.random() * 1 + 0.5),
            length: Math.random() * 180 + 80,
            alpha: 1,
            life: 0
        });
    }

    let lastShootTime = 0;

    function drawNebulaBackground() {
        // Fondo suave de nebulosa (A + B)
        const gradient = ctx.createRadialGradient(
            width * 0.2, height * 0.1, 0,
            width * 0.4, height * 0.6, width * 0.9
        );
        gradient.addColorStop(0, "#151c3f");
        gradient.addColorStop(0.35, "#060716");
        gradient.addColorStop(0.7, "#120222");
        gradient.addColorStop(1, "#000000");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Nebulosas extra
        const nebula1 = ctx.createRadialGradient(
            width * 0.75, height * 0.2, 0,
            width * 0.75, height * 0.2, height * 0.6
        );
        nebula1.addColorStop(0, "rgba(255, 75, 255, 0.6)");
        nebula1.addColorStop(0.4, "rgba(255, 75, 255, 0.0)");
        ctx.fillStyle = nebula1;
        ctx.fillRect(0, 0, width, height);

        const nebula2 = ctx.createRadialGradient(
            width * 0.1, height * 0.8, 0,
            width * 0.1, height * 0.8, height * 0.7
        );
        nebula2.addColorStop(0, "rgba(53, 226, 255, 0.45)");
        nebula2.addColorStop(0.5, "rgba(53, 226, 255, 0.0)");
        ctx.fillStyle = nebula2;
        ctx.fillRect(0, 0, width, height);
    }

    function drawStars() {
        for (const star of stars) {
            ctx.beginPath();
            ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
            star.x -= star.speed;
            if (star.x < 0) {
                star.x = width;
                star.y = Math.random() * height;
            }
        }
    }

    function drawShootingStars(deltaTime) {
        if (performance.now() - lastShootTime > 2000 + Math.random() * 4000) {
            createShootingStar();
            lastShootTime = performance.now();
        }

        shootingStars = shootingStars.filter(s => s.alpha > 0 && s.life < 1.5);

        for (const s of shootingStars) {
            s.x += s.vx;
            s.y += s.vy;
            s.life += deltaTime * 0.001;
            s.alpha = Math.max(0, 1 - s.life);

            ctx.save();
            ctx.globalAlpha = s.alpha;
            ctx.beginPath();
            const trailX = s.x - s.vx * (s.length / 10);
            const trailY = s.y - s.vy * (s.length / 10);
            const grad = ctx.createLinearGradient(s.x, s.y, trailX, trailY);
            grad.addColorStop(0, "rgba(255,255,255,1)");
            grad.addColorStop(1, "rgba(255,255,255,0)");
            ctx.strokeStyle = grad;
            ctx.lineWidth = 2.2;
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(trailX, trailY);
            ctx.stroke();
            ctx.restore();
        }
    }

    let lastTime = performance.now();

    function animate(time) {
        const delta = time - lastTime;
        lastTime = time;

        drawNebulaBackground();
        drawStars();
        drawShootingStars(delta);

        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
})();

// ----------------------------------------------
// 5. Chatbot MIRA (voz femenina + backend OpenRouter vía Render)
// ----------------------------------------------

let miraVoiceEnabled = true;
let miraVoice = null;

// Historial de conversación para contexto
const miraHistory = [];

// URL del backend (Render)
const MIRA_API_URL = "https://ceo-ai-mira.onrender.com/api/mira";

// Elementos del widget
const miraToggleBtn = document.getElementById("mira-toggle");
const miraChat = document.getElementById("mira-chat");
const miraCloseBtn = document.getElementById("mira-close");
const miraMessages = document.getElementById("miraMessages");
const miraForm = document.getElementById("miraForm");
const miraInput = document.getElementById("miraInput");
const miraLoading = document.getElementById("miraLoading");
const miraVoiceToggle = document.getElementById("mira-voice-toggle");

// Control para no repetir demasiados mensajes de ayuda
const miraHintsShown = new Set();
let miraIntroSpoken = false;

// Mensaje inicial en el chat
function initMiraWelcome() {
    if (!miraMessages) return;
    miraMessages.innerHTML = "";
    addMiraMessage(
        "Bienvenido a Innova Space Education. Soy MIRA, su asistente virtual 🤖✨<br>" +
        "Puedo explicarte qué hace la empresa, nuestros servicios de inteligencia artificial, desarrollo web, " +
        "innovación en espacios educativos y cómo podemos apoyar tu proyecto."
    );
}

document.addEventListener("DOMContentLoaded", () => {
    initMiraWelcome();
    setupMiraGuidedHints();
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
    miraForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = miraInput.value.trim();
        if (!text) return;
        addUserMessage(text);
        miraInput.value = "";
        await handleMiraResponse(text);
    });
}

// Agregar mensajes al panel
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

// Llamar al backend para obtener la respuesta de MIRA
async function handleMiraResponse(userText) {
    if (!miraLoading) return;
    miraLoading.classList.add("active");

    try {
        const responseText = await callMiraAPI(userText);
        addMiraMessage(responseText);
    } catch (err) {
        console.error("Error al llamar a MIRA backend:", err);
        addMiraMessage(
            "Hubo un problema al conectar con el modelo de inteligencia artificial 🔧.<br>" +
            "Aun así, recuerda que Innova Space Education integra educación, IA y desarrollo web futurista. " +
            "Puedes volver a intentar en unos minutos y seguiremos mejorando esta experiencia."
        );
    } finally {
        miraLoading.classList.remove("active");
    }
}

// Petición al backend (Render) que usa OpenRouter
async function callMiraAPI(userText) {
    if (!MIRA_API_URL) {
        console.warn("MIRA_API_URL no está configurada.");
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

// ----------------------------------------------
// 6. Voz femenina con SpeechSynthesis (toda la página)
// ----------------------------------------------
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

    // Buscar voz femenina en español primero, luego alternativas
    let femaleSpanish = voices.find(v =>
        v.lang.toLowerCase().startsWith("es") &&
        /female|mujer|helena|lucia|soledad|paula|camila|espanol/i.test(v.name)
    );

    let anySpanish = voices.find(v => v.lang.toLowerCase().startsWith("es"));
    let anyFemale = voices.find(v => /female|mujer/i.test(v.name));

    miraVoice = femaleSpanish || anySpanish || anyFemale || voices[0];

    // Mensaje de bienvenida global en toda la página
    if (!miraIntroSpoken) {
        miraIntroSpoken = true;
        speakWithMiraVoice(
            "Bienvenido a Innova Space Education. Soy MIRA, su asistente virtual. " +
            "Estoy aquí para guiarle por la página, explicar nuestros servicios y ayudarle con sus ideas o proyectos."
        );
    }
}

if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = initMiraVoice;
    // También intentamos inicializar por si las voces ya están cargadas
    setTimeout(initMiraVoice, 400);
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

// ----------------------------------------------
// 7. Guía hablada según interacción del usuario
// ----------------------------------------------
function setupMiraGuidedHints() {
    // Enlaces de navegación con data-mira-hint
    const hintElements = document.querySelectorAll("[data-mira-hint]");
    hintElements.forEach(el => {
        const hint = el.getAttribute("data-mira-hint");
        if (!hint) return;

        el.addEventListener("click", () => {
            const key = hint.slice(0, 60);
            if (!miraHintsShown.has(key)) {
                miraHintsShown.add(key);
                speakWithMiraVoice(hint);
            }
        });
    });

    // También pequeños hints al hacer scroll a secciones clave (solo la primera vez)
    const sections = document.querySelectorAll("section");
    const observer = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    if (!id || miraHintsShown.has("section-" + id)) return;

                    let msg = "";
                    if (id === "sobre") {
                        msg = "Estás viendo información sobre Innova Space Education: nuestra misión, visión y áreas de trabajo.";
                    } else if (id === "servicios") {
                        msg = "Aquí puedes revisar los servicios de inteligencia artificial, desarrollo web, redes sociales y proyectos educativos interactivos.";
                    } else if (id === "portafolio") {
                        msg = "En el portafolio verás algunos proyectos ya desarrollados que podemos adaptar o ampliar para tu institución o emprendimiento.";
                    } else if (id === "redes") {
                        msg = "Si deseas seguir nuestras novedades, puedes visitar nuestras redes sociales desde esta sección.";
                    } else if (id === "contacto") {
                        msg = "Si quieres un proyecto a medida, puedes utilizar el formulario de contacto o escribir directamente al correo institucional.";
                    }

                    if (msg) {
                        miraHintsShown.add("section-" + id);
                        speakWithMiraVoice(msg);
                    }
                }
            });
        },
        { threshold: 0.55 }
    );

    sections.forEach(sec => observer.observe(sec));
}

// ----------------------------------------------
// 8. Respuestas locales básicas (fallback por si se necesita)
//    *No se usa normalmente porque ahora se llama al backend*
// ----------------------------------------------
function generateMiraResponse(text) {
    const t = text.toLowerCase();

    if (t.includes("hola") || t.includes("buenas") || t.includes("hi")) {
        return "¡Hola! ✨ Soy MIRA, la asistente virtual de Innova Space Education SPA. ¿Te cuento qué hacemos o quieres saber sobre algún servicio en específico?";
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
        return "Gestionamos redes sociales como Instagram, Facebook, X y YouTube: desde la identidad visual hasta la creación de contenido y planificación de publicaciones.";
    }

    if (t.includes("contacto") || t.includes("reunión") || t.includes("cotización")) {
        return "Puedes escribir directamente a contacto@innova-space-edu.cl o usar el formulario de contacto de esta web. Coordinamos reuniones para revisar tu proyecto y armar una propuesta a medida.";
    }

    if (t.includes("ubicación") || t.includes("dónde están") || t.includes("donde están")) {
        return "Innova Space Education SPA se proyecta desde la zona norte de Chile, con base en Vallenar – Antofagasta, y trabajo remoto con instituciones de todo el país.";
    }

    // Respuesta genérica
    return "Me encanta tu pregunta 💫. Soy MIRA, una asistente creada dentro del ecosistema de Innova Space Education SPA para acompañarte en soluciones de IA, desarrollo web y proyectos educativos. ¿Sobre qué quieres profundizar?";
}
