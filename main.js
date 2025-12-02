// MAIN JS PARA INNOVA SPACE EDUCATION SPA

// URL del backend de MIRA en Render (NO expone la API key de OpenRouter)
const MIRA_API_URL = "https://ceo-ai-mira.onrender.com/api/mira";
// Nuevo backend TTS con Piper (voz mexicana es_MX-claude-high)
const MIRA_TTS_URL = "https://mira-tts.onrender.com/tts";

/* ------------------------------------------------------------------
   1. LOADER GLOBAL
------------------------------------------------------------------ */
window.addEventListener("load", () => {
    const loader = document.getElementById("global-loader");
    setTimeout(() => loader?.classList.add("hidden"), 1500);
    initStarfield();
});

/* ------------------------------------------------------------------
   2. AÑO EN EL FOOTER
------------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
    const yearSpan = document.getElementById("year");
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
});

/* ------------------------------------------------------------------
   3. NAVBAR MOBILE
------------------------------------------------------------------ */
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");

if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
        navLinks.classList.toggle("nav-open");
    });

    navLinks.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => navLinks.classList.remove("nav-open"));
    });
}

/* ------------------------------------------------------------------
   4. FONDO ANIMADO: ESTRELLAS + NEBULOSA + FUGACES
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
        const startX = Math.random() < 0.5 ? Math.random() * width : -50;
        const startY = Math.random() < 0.5 ? -40 : Math.random() * height;
        const angle = Math.random() * 0.4 + 0.2;

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
        const delay = 3000 + Math.random() * 3000;
        setTimeout(() => {
            addShootingStar();
            scheduleShootingStar();
        }, delay);
    }

    function drawNebula() {
        const g1 = ctx.createRadialGradient(
            width * 0.3, height * 0.25, 0,
            width * 0.3, height * 0.25, width * 0.7
        );
        g1.addColorStop(0, "rgba(120,180,255,0.95)");
        g1.addColorStop(0.4, "rgba(80,130,255,0.6)");
        g1.addColorStop(1, "rgba(10,15,30,0)");

        const g2 = ctx.createRadialGradient(
            width * 0.85, height * 0.85, 0,
            width * 0.85, height * 0.85, width * 0.5
        );
        g2.addColorStop(0, "rgba(200,90,255,0.9)");
        g2.addColorStop(0.4, "rgba(150,50,230,0.6)");
        g2.addColorStop(1, "rgba(10,5,30,0)");

        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, width, height);
    }

    function update() {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#02030a";
        ctx.fillRect(0, 0, width, height);

        drawNebula();

        const time = Date.now() * 0.0015;
        for (const star of stars) {
            star.x += star.speed;
            if (star.x > width) {
                star.x = -2;
                star.y = Math.random() * height;
            }

            const tw = (Math.sin(time + star.twinkleOffset) + 1) / 2;
            const alpha = star.alpha * (0.4 + 0.6 * tw);

            ctx.beginPath();
            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        }

        for (let i = shootingStars.length - 1; i >= 0; i--) {
            const s = shootingStars[i];
            s.x += s.vx;
            s.y += s.vy;
            s.life++;

            const ratio = 1 - s.life / s.maxLife;
            const len = 120 * ratio;

            ctx.strokeStyle = `rgba(255,255,255,${ratio})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(
                s.x - s.vx * 0.8 - len * 0.4,
                s.y - s.vy * 0.8 - len * 0.4
            );
            ctx.stroke();

            if (s.life > s.maxLife) shootingStars.splice(i, 1);
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
   4.5 CARRUSEL DE VIDEOS — VERSIÓN COMPLETA
------------------------------------------------------------------ */
const videoList = [
    "assets/videos/video1.mp4",
    "assets/videos/video2.mp4",
    "assets/videos/video3.mp4",
    "assets/videos/video4.mp4",
    "assets/videos/video5.mp4",
    "assets/videos/video6.mp4"
];

let currentVideoIndex = 0;
let videoCarouselInitialized = false;
let videoErrorCount = 0;

function initVideoCarousel() {
    if (videoCarouselInitialized) return;
    videoCarouselInitialized = true;

    const video = document.getElementById("carouselVideo");
    if (!video || videoList.length === 0) return;

    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.loop = false;

    function playVideo(index) {
        currentVideoIndex = index % videoList.length;
        video.src = videoList[currentVideoIndex];
        video.load();

        video.play().catch(err => {
            console.warn("Error al reproducir video:", err);
        });
    }

    video.addEventListener("error", () => {
        videoErrorCount++;
        if (videoErrorCount < 3) {
            playVideo((currentVideoIndex + 1) % videoList.length);
        }
    });

    video.addEventListener("ended", () => {
        videoErrorCount = 0;
        playVideo(currentVideoIndex + 1);
    });

    playVideo(0);
}

/* ------------------------------------------------------------------
   5. CHATBOT MIRA
------------------------------------------------------------------ */

let miraVoiceEnabled = true;
let miraAudioUnlocked = false;

const miraToggleBtn = document.getElementById("mira-toggle");
const miraChat = document.getElementById("mira-chat");
const miraCloseBtn = document.getElementById("mira-close");
const miraMessages = document.getElementById("miraMessages");
const miraForm = document.getElementById("miraForm");
const miraInput = document.getElementById("miraInput");
const miraLoading = document.getElementById("miraLoading");
const miraVoiceToggle = document.getElementById("mira-voice-toggle");

function initMiraWelcome() {
    miraMessages.innerHTML = "";
    addMiraMessage(
        "Bienvenido a Innova Space Education.<br>" +
        "Soy <strong>MIRA</strong>, una inteligencia asistencial diseñada para acompañarle.<br>" +
        "Estoy lista para ayudarle en lo que necesite."
    );
}

document.addEventListener("DOMContentLoaded", () => {
    initMiraWelcome();
    setupMiraHints();
    setupMiraSectionObserver();
    initVideoCarousel();
});

/* ------------------------------------------------------------------
   DESBLOQUEO DE AUDIO
------------------------------------------------------------------ */
function unlockMiraAudio() {
    if (miraAudioUnlocked) return;
    miraAudioUnlocked = true;

    const a = new Audio();
    a.muted = true;
    a.play().catch(() => {});
    window.removeEventListener("click", unlockMiraAudio);
    window.removeEventListener("keydown", unlockMiraAudio);
    window.removeEventListener("touchstart", unlockMiraAudio);
}

window.addEventListener("click", unlockMiraAudio);
window.addEventListener("keydown", unlockMiraAudio);
window.addEventListener("touchstart", unlockMiraAudio);

/* ------------------------------------------------------------------
   CHATBOT – APERTURA / CIERRE
------------------------------------------------------------------ */
if (miraToggleBtn && miraChat && miraCloseBtn) {
    miraToggleBtn.addEventListener("click", () => {
        miraChat.classList.toggle("mira-chat-open");
        if (miraChat.classList.contains("mira-chat-open")) {
            initMiraWelcome();
            setTimeout(() => miraInput?.focus(), 200);

            if (miraAudioUnlocked) {
                speakWithMiraVoice("Estoy a su disposición. ¿Cómo puedo ayudarle?");
            }
        }
    });

    miraCloseBtn.addEventListener("click", () => {
        miraChat.classList.remove("mira-chat-open");
    });
}

/* ------------------------------------------------------------------
   CHATBOT – ENVÍO
------------------------------------------------------------------ */
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

function addUserMessage(text) {
    const div = document.createElement("div");
    div.className = "mira-msg user";
    div.innerText = text;
    miraMessages.appendChild(div);
    scrollMiraToBottom();
}

function addMiraMessage(htmlText) {
    const div = document.createElement("div");
    div.className = "mira-msg bot";
    div.innerHTML = htmlText;
    miraMessages.appendChild(div);
    scrollMiraToBottom();

    const spoken = sanitizeForSpeech(stripHtml(htmlText));
    if (miraAudioUnlocked) speakWithMiraVoice(spoken);
}

function scrollMiraToBottom() {
    miraMessages.scrollTop = miraMessages.scrollHeight;
}

/* ------------------------------------------------------------------
   RESPUESTAS – BACKEND + FALLBACK
------------------------------------------------------------------ */
async function handleMiraResponse(userText) {
    miraLoading.classList.add("active");

    let reply = "";
    try {
        const res = await fetch(MIRA_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userText })
        });

        if (!res.ok) throw new Error("Error backend");

        const data = await res.json();
        reply = data.reply || generateMiraResponse(userText);
    } catch {
        reply = generateMiraResponse(userText);
    }

    miraLoading.classList.remove("active");
    addMiraMessage(reply);
}

function generateMiraResponse(text) {
    const t = text.toLowerCase();

    if (t.includes("hola")) {
        return "Hola, es un gusto saludarle. Soy MIRA, la asistente virtual futurista de Innova Space Education.";
    }

    if (t.includes("empresa")) {
        return "Innova Space Education SPA integra educación, inteligencia artificial y desarrollo web para crear soluciones futuristas.";
    }

    if (t.includes("web")) {
        return "Creamos páginas web futuristas, responsivas y conectadas a bases de datos.";
    }

    if (t.includes("contacto")) {
        return "Puede escribirnos a contacto@innova-space-edu.cl.";
    }

    return "He registrado su consulta. ¿Desea información sobre IA, desarrollo web o proyectos educativos?";
}

/* ------------------------------------------------------------------
   UTILIDADES
------------------------------------------------------------------ */
function stripHtml(html) {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    return temp.textContent || "";
}

function sanitizeForSpeech(text) {
    if (!text) return "";

    let clean = text;
    clean = clean.replace(/[\u{1F300}-\u{1FAFF}]/gu, "");
    clean = clean.replace(/[\u2600-\u27BF]/g, "");
    clean = clean.replace(/[*_`~]+/g, "");
    clean = clean.replace(/\s{2,}/g, " ");
    return clean.trim();
}

/* ------------------------------------------------------------------
   PIPER TTS – VOZ MEXICANA
------------------------------------------------------------------ */
async function speakWithMiraVoice(text) {
    if (!miraVoiceEnabled) return;
    if (!text || !miraAudioUnlocked) return;

    try {
        const res = await fetch(MIRA_TTS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
        });

        if (!res.ok) return;

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        await audio.play().catch(() => {});
    } catch (err) {
        console.error("Error TTS:", err);
    }
}

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
   HINTS Y TEXTO GUIADO
------------------------------------------------------------------ */
function setupMiraHints() {
    const hints = document.querySelectorAll("[data-mira-hint]");
    hints.forEach(el => {
        el.addEventListener("mouseenter", () => {
            if (!miraAudioUnlocked) return;
            const hint = sanitizeForSpeech(el.getAttribute("data-mira-hint"));
            speakWithMiraVoice(hint);
        });
    });
}

/* ------------------------------------------------------------------
   DETECCIÓN DE SECCIONES (MIRA HABLA SEGÚN SECCIÓN)
------------------------------------------------------------------ */
function setupMiraSectionObserver() {
    const sections = document.querySelectorAll(".section[data-mira-section]");
    if (!("IntersectionObserver" in window)) return;

    const spokenSections = new Set();
    const messages = {
        "sobre": "En esta sección podrá conocer el enfoque de Innova Space Education.",
        "servicios": "Aquí encontrará los servicios que ofrecemos.",
        "portafolio": "Aquí podrá ver algunos proyectos realizados.",
        "redes": "Puede visitar nuestras redes sociales para más información.",
        "contacto": "En la sección de contacto puede enviarnos un mensaje directo."
    };

    const obs = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            const id = entry.target.getAttribute("data-mira-section");
            if (!id || spokenSections.has(id)) return;

            spokenSections.add(id);
            if (messages[id] && miraAudioUnlocked) speakWithMiraVoice(messages[id]);
        });
    }, { threshold: 0.4 });

    sections.forEach(sec => obs.observe(sec));
}
