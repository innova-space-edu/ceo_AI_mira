// MAIN JS PARA INNOVA SPACE EDUCATION SPA

// URL del backend de MIRA en Render (NO expone la API key de OpenRouter)
const MIRA_API_URL = "https://ceo-ai-mira.onrender.com/api/mira";
const MIRA_TTS_URL = "https://ceo-ai-mira.onrender.com/api/tts";

/* ------------------------------------------------------------------
   ✅ NUEVO: ELEVENLABS CONVAI WIDGET (MODO VOZ)
------------------------------------------------------------------ */
const ELEVENLABS_WIDGET_SCRIPT = "https://unpkg.com/@elevenlabs/convai-widget-embed";
const ELEVENLABS_AGENT_ID = "agent_4401kcvfm17nedzbz44xtt1fdtxp";

let miraMode = "chat";
let elevenWidgetLoaded = false;
let miraTTSMutedByMode = false;

/* ------------------------------------------------------------------
   1. LOADER GLOBAL
------------------------------------------------------------------ */
window.addEventListener("load", () => {
  const loader = document.getElementById("global-loader");
  const introOverlay = document.getElementById("intro-video-overlay");
  const introVideo = document.getElementById("intro-video");

  const hasSeenIntro = sessionStorage.getItem("introVideoShown") === "true";

  const showLoader = () => loader?.classList.remove("hidden");
  const hideLoader = () => loader?.classList.add("hidden");

  if (!hasSeenIntro && introOverlay && introVideo) {
    sessionStorage.setItem("introVideoShown", "true");
    hideLoader();

    const endIntro = () => {
      introOverlay.classList.add("hidden");
      hideLoader();
    };

    introOverlay.classList.remove("hidden");
    introVideo.currentTime = 0;
    introVideo.play().catch(endIntro);
    introVideo.addEventListener("ended", endIntro, { once: true });
    introVideo.addEventListener("error", endIntro, { once: true });
  } else {
    if (introOverlay) introOverlay.classList.add("hidden");
    showLoader();
    setTimeout(hideLoader, 1500);
  }

  initStarfield();
});

/* ------------------------------------------------------------------
   2. AÑO EN FOOTER
------------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  const yearSpan = document.getElementById("year");
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();
});

/* ------------------------------------------------------------------
   3. NAVBAR MOBILE (CORREGIDO – SOLO TELÉFONOS)
------------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  if (!navToggle || !navLinks) return;

  const isPhone = () => window.matchMedia("(max-width: 480px)").matches;

  const openMenu = () => {
    navLinks.classList.add("nav-open");
    navToggle.setAttribute("aria-expanded", "true");
    if (isPhone()) {
      document.body.style.overflow = "hidden";
      document.body.classList.add("menu-open");
    }
  };

  const closeMenu = () => {
    navLinks.classList.remove("nav-open");
    navToggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    document.body.classList.remove("menu-open");
  };

  navToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    navLinks.classList.contains("nav-open") ? closeMenu() : openMenu();
  });

  navLinks.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      if (isPhone()) closeMenu();
    });
  });

  document.addEventListener("click", (e) => {
    if (!isPhone()) return;
    if (!navLinks.classList.contains("nav-open")) return;
    if (!navLinks.contains(e.target) && !navToggle.contains(e.target)) {
      closeMenu();
    }
  });

  window.addEventListener("resize", () => {
    if (!isPhone()) closeMenu();
  });
});

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
    "assets/media/video1.mp4",
    "assets/media/video2.mp4",
    "assets/media/video3.mp4",
    "assets/media/video4.mp4",
    "assets/media/video6.mp4"
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
   4.8 ✅ BARRA DE NAVEGACIÓN POR SECCIONES (SIN DEPENDER DEL SCROLL)
   - Funciona en index.html e innova-space-track.html
------------------------------------------------------------------ */
function setupSectionNavigator() {
    const nav = document.getElementById("section-nav");
    const btnPrev = document.getElementById("navPrev");
    const btnNext = document.getElementById("navNext");
    const dotsWrap = document.getElementById("navDots");

    if (!nav || !btnPrev || !btnNext || !dotsWrap) return;

    const ordered = [];

    const hero = document.getElementById("hero");
    if (hero) ordered.push({ el: hero, id: "hero", label: "Inicio" });

    document.querySelectorAll("main .section").forEach(sec => {
        const id = sec.id || sec.getAttribute("data-mira-section") || "section";
        const h2 = sec.querySelector(".section-header h2");
        const label = (h2?.textContent || id).trim();
        ordered.push({ el: sec, id, label });
    });

    const footer = document.querySelector("footer.footer");
    if (footer) ordered.push({ el: footer, id: "footer", label: "Final" });

    if (ordered.length <= 1) return;

    let currentIndex = 0;
    let isProgrammatic = false;

    dotsWrap.innerHTML = "";
    ordered.forEach((item, idx) => {
        const dot = document.createElement("button");
        dot.className = "section-dot" + (idx === 0 ? " active" : "");
        dot.type = "button";
        dot.setAttribute("aria-label", item.label);
        dot.title = item.label;
        dot.dataset.index = String(idx);
        dot.addEventListener("click", () => goTo(idx, true));
        dotsWrap.appendChild(dot);
    });

    const dots = Array.from(dotsWrap.querySelectorAll(".section-dot"));

    function setActive(idx) {
        currentIndex = Math.max(0, Math.min(idx, ordered.length - 1));
        dots.forEach((d, i) => d.classList.toggle("active", i === currentIndex));
        btnPrev.disabled = currentIndex === 0;
        btnNext.disabled = currentIndex === ordered.length - 1;
    }

    function goTo(idx, fromUser = false) {
        const target = ordered[idx]?.el;
        if (!target) return;

        isProgrammatic = true;
        setActive(idx);

        target.scrollIntoView({ behavior: "smooth", block: "start" });

        setTimeout(() => {
            isProgrammatic = false;
        }, fromUser ? 700 : 550);
    }

    btnPrev.addEventListener("click", () => goTo(currentIndex - 1, true));
    btnNext.addEventListener("click", () => goTo(currentIndex + 1, true));

    window.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "PageDown") goTo(currentIndex + 1, true);
        if (e.key === "ArrowUp" || e.key === "PageUp") goTo(currentIndex - 1, true);
        if (e.key === "Home") goTo(0, true);
        if (e.key === "End") goTo(ordered.length - 1, true);
    });

    if ("IntersectionObserver" in window) {
        const obs = new IntersectionObserver((entries) => {
            if (isProgrammatic) return;

            let bestIdx = currentIndex;
            let bestRatio = 0;

            entries.forEach(en => {
                if (!en.isIntersecting) return;
                const idx = ordered.findIndex(x => x.el === en.target);
                if (idx >= 0 && en.intersectionRatio > bestRatio) {
                    bestRatio = en.intersectionRatio;
                    bestIdx = idx;
                }
            });

            if (bestIdx !== currentIndex) setActive(bestIdx);
        }, { threshold: [0.25, 0.4, 0.55, 0.7] });

        ordered.forEach(item => obs.observe(item.el));
    }

    setActive(0);
}

/* ------------------------------------------------------------------
   5. CHATBOT MIRA
------------------------------------------------------------------ */

let miraVoiceEnabled = true;
let miraAudioUnlocked = false;
let miraHasWelcomed = false;

const miraToggleBtn = document.getElementById("mira-toggle");
const miraChat = document.getElementById("mira-chat");
const miraCloseBtn = document.getElementById("mira-close");
const miraMessages = document.getElementById("miraMessages");
const miraForm = document.getElementById("miraForm");
const miraInput = document.getElementById("miraInput");
const miraLoading = document.getElementById("miraLoading");
const miraVoiceToggle = document.getElementById("mira-voice-toggle");

function getMiraGreetingText() {
    return "Bienvenido a Innova Space Education. Soy MIRA, su asistente virtual. " +
           "Estoy lista para acompañarle y responder sus consultas.";
}

/**
 * Inicializa el mensaje de bienvenida en el chat,
 * SIN hablar por voz (el saludo hablado se maneja aparte).
 */
function initMiraWelcome() {
    if (!miraMessages) return;
    miraMessages.innerHTML = "";

    const html = `
        Bienvenido a Innova Space Education.<br>
        Soy <strong>MIRA</strong>, una asistente virtual diseñada para acompañarte.<br>
        Estoy lista para ayudarte en lo que necesites.
    `;

    const div = document.createElement("div");
    div.className = "mira-msg bot";
    div.innerHTML = html;
    miraMessages.appendChild(div);
    scrollMiraToBottom();
}

/* ------------------------------------------------------------------
   5.1 DESBLOQUEO DE AUDIO (POLÍTICAS DEL NAVEGADOR)
------------------------------------------------------------------ */
function unlockMiraAudio() {
    if (miraAudioUnlocked) return;
    miraAudioUnlocked = true;

    const a = new Audio();
    a.muted = true;
    a.play().catch(() => {});

    if (miraVoiceEnabled && !miraHasWelcomed) {
        setTimeout(() => {
            speakWithMiraVoice(getMiraGreetingText());
            miraHasWelcomed = true;
        }, 300);
    }

    window.removeEventListener("click", unlockMiraAudio);
    window.removeEventListener("keydown", unlockMiraAudio);
    window.removeEventListener("touchstart", unlockMiraAudio);
}

window.addEventListener("click", unlockMiraAudio);
window.addEventListener("keydown", unlockMiraAudio);
window.addEventListener("touchstart", unlockMiraAudio);

/* ------------------------------------------------------------------
   5.5 FORMULARIO DE CONTACTO → BACKEND (Render)
------------------------------------------------------------------ */
function setupContactForm() {
    const form = document.getElementById("contactForm");
    const statusEl = document.getElementById("formStatus");

    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nombre = document.getElementById("nombre")?.value.trim() || "";
        const correo = document.getElementById("correo")?.value.trim() || "";
        const institucion = document.getElementById("institucion")?.value.trim() || "";
        const ciudad = document.getElementById("ciudad")?.value.trim() || "";
        const mensaje = document.getElementById("mensaje")?.value.trim() || "";

        if (!nombre || !correo || !mensaje) {
            if (statusEl) {
                statusEl.textContent = "Por favor, completa nombre, correo y mensaje antes de enviar.";
            }
            return;
        }

        if (statusEl) {
            statusEl.textContent = "Enviando mensaje...";
        }

        try {
            const res = await fetch("https://ceo-ai-mira.onrender.com/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre,
                    correo,
                    institucion,
                    ciudad,
                    mensaje
                })
            });

            if (!res.ok) {
                throw new Error("Error al enviar");
            }

            if (statusEl) {
                statusEl.textContent = "Mensaje enviado correctamente. Te contactaremos por correo electrónico.";
            }
            form.reset();
        } catch (err) {
            console.error("Error al enviar formulario:", err);
            if (statusEl) {
                statusEl.textContent = "Ocurrió un error al enviar el mensaje. Intenta nuevamente más tarde.";
            }
        }
    });
}

/* ------------------------------------------------------------------
   ✅ NUEVO: MODO SWITCH (CHAT / VOZ) SIN ROMPER TU CHAT
------------------------------------------------------------------ */
function setupMiraModeSwitch() {
    if (!miraChat) return;

    const header = miraChat.querySelector(".mira-header");
    if (!header) return;

    if (!miraMessages || !miraForm || !miraLoading) return;

    let switchBar = document.getElementById("mira-mode-switch");
    let btnChat = document.getElementById("mira-mode-chat");
    let btnVoice = document.getElementById("mira-mode-voice");
    let voiceModeWrap = document.getElementById("mira-voice-mode");
    let chatModeWrap = document.getElementById("mira-chat-mode");
    let elevenContainer = document.getElementById("elevenlabs-container");

    if (!chatModeWrap) {
        chatModeWrap = document.createElement("div");
        chatModeWrap.id = "mira-chat-mode";
    }

    if (!voiceModeWrap) {
        voiceModeWrap = document.createElement("div");
        voiceModeWrap.id = "mira-voice-mode";
        voiceModeWrap.style.display = "none";
    }

    if (!switchBar) {
        switchBar = document.createElement("div");
        switchBar.id = "mira-mode-switch";

        btnChat = document.createElement("button");
        btnChat.id = "mira-mode-chat";
        btnChat.type = "button";
        btnChat.textContent = "💬 Chat";
        btnChat.setAttribute("aria-pressed", "true");

        btnVoice = document.createElement("button");
        btnVoice.id = "mira-mode-voice";
        btnVoice.type = "button";
        btnVoice.textContent = "🎙️ Voz";
        btnVoice.setAttribute("aria-pressed", "false");

        switchBar.appendChild(btnChat);
        switchBar.appendChild(btnVoice);

        header.insertAdjacentElement("afterend", switchBar);
    }

    if (!miraMessages.parentElement || miraMessages.parentElement.id !== "mira-chat-mode") {
        if (!chatModeWrap.isConnected) {
            switchBar.insertAdjacentElement("afterend", chatModeWrap);
        }

        chatModeWrap.appendChild(miraMessages);
        chatModeWrap.appendChild(miraLoading);
        chatModeWrap.appendChild(miraForm);
    }

    if (!voiceModeWrap.isConnected) {
        chatModeWrap.insertAdjacentElement("afterend", voiceModeWrap);
    }

    if (!elevenContainer) {
        elevenContainer = document.createElement("div");
        elevenContainer.id = "elevenlabs-container";
        voiceModeWrap.appendChild(elevenContainer);
    }

    if (ELEVENLABS_AGENT_ID && ELEVENLABS_AGENT_ID !== "YOUR_ELEVENLABS_AGENT_ID") {
        if (!elevenContainer.querySelector("elevenlabs-convai")) {
            const widgetEl = document.createElement("elevenlabs-convai");
            widgetEl.setAttribute("agent-id", ELEVENLABS_AGENT_ID);
            elevenContainer.appendChild(widgetEl);
        }
        loadElevenWidgetScriptOnce();
    } else {
        if (!elevenContainer.querySelector(".mira-eleven-note")) {
            const note = document.createElement("div");
            note.className = "mira-msg bot mira-eleven-note";
            note.style.maxWidth = "100%";
            note.style.margin = "6px";
            note.innerHTML = "⚠️ Para activar el modo <strong>Voz</strong>, debes colocar tu <strong>ELEVENLABS_AGENT_ID</strong> en <code>main.js</code>.";
            elevenContainer.appendChild(note);
        }
    }

    function setMode(mode) {
        miraMode = mode;
        unlockMiraAudio();

        const isChat = mode === "chat";

        chatModeWrap.style.display = isChat ? "" : "none";
        voiceModeWrap.style.display = isChat ? "none" : "";

        btnChat?.setAttribute("aria-pressed", isChat ? "true" : "false");
        btnVoice?.setAttribute("aria-pressed", isChat ? "false" : "true");

        miraTTSMutedByMode = !isChat;

        if (isChat) {
            setTimeout(() => miraInput?.focus(), 150);
        }
    }

    btnChat?.addEventListener("click", () => setMode("chat"));
    btnVoice?.addEventListener("click", () => setMode("voice"));

    setMode("chat");
}

function loadElevenWidgetScriptOnce() {
    if (elevenWidgetLoaded) return;
    elevenWidgetLoaded = true;

    if (document.querySelector(`script[src="${ELEVENLABS_WIDGET_SCRIPT}"]`)) return;

    const s = document.createElement("script");
    s.src = ELEVENLABS_WIDGET_SCRIPT;
    s.async = true;
    s.type = "text/javascript";
    document.head.appendChild(s);
}

/* ------------------------------------------------------------------
   INICIALIZACIÓN DOMContentLoaded
------------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
    initMiraWelcome();
    setupMiraHints();
    setupMiraSectionObserver();
    initVideoCarousel();
    setupContactForm();

    setupSectionNavigator();
    setupMiraModeSwitch();

    setTimeout(() => {
        if (miraVoiceEnabled && miraAudioUnlocked && !miraHasWelcomed) {
            speakWithMiraVoice(getMiraGreetingText());
            miraHasWelcomed = true;
        }
    }, 1200);
});

/* ------------------------------------------------------------------
   CHATBOT – APERTURA / CIERRE
------------------------------------------------------------------ */
if (miraToggleBtn && miraChat && miraCloseBtn) {
    miraToggleBtn.addEventListener("click", () => {
        unlockMiraAudio();

        miraChat.classList.toggle("mira-chat-open");
        if (miraChat.classList.contains("mira-chat-open")) {
            initMiraWelcome();
            setupMiraModeSwitch();
            setTimeout(() => miraInput?.focus(), 200);
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
  if (!miraMessages) return;

  const div = document.createElement("div");
  div.className = "mira-msg user";
  div.innerText = text;

  miraMessages.appendChild(div);
  scrollMiraToBottom();

  // ✅ evita que el foco "salte" y mantén visible el input
  setTimeout(() => miraInput?.focus({ preventScroll: true }), 0);
}

function addMiraMessage(htmlText) {
  if (!miraMessages) return;

  const div = document.createElement("div");
  div.className = "mira-msg bot";
  div.innerHTML = htmlText;

  miraMessages.appendChild(div);
  scrollMiraToBottom();

  // ✅ vuelve a enfocar input sin mover la pantalla
  setTimeout(() => {
    if (miraMode === "chat") miraInput?.focus({ preventScroll: true });
  }, 0);

  const spoken = sanitizeForSpeech(stripHtml(htmlText));
  if (miraVoiceEnabled && !miraTTSMutedByMode) speakWithMiraVoice(spoken);
}

function scrollMiraToBottom() {
  if (!miraMessages) return;

  // ✅ usa el contenedor scrolleable real (por si cambiaste el DOM con el switch chat/voz)
  const scroller = miraMessages.closest(".mira-messages") || miraMessages;

  // ✅ espera a que el navegador renderice el nuevo mensaje
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scroller.scrollTop = scroller.scrollHeight;
    });
  });
}
/* ------------------------------------------------------------------
   RESPUESTAS – BACKEND + FALLBACK
------------------------------------------------------------------ */
async function handleMiraResponse(userText) {
    if (miraLoading) miraLoading.classList.add("active");

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

    if (miraLoading) miraLoading.classList.remove("active");
    addMiraMessage(reply);
}

function generateMiraResponse(text) {
    const t = text.toLowerCase();

    if (t.includes("hola")) {
        return "Hola, es un gusto saludarle. Soy MIRA, la asistente virtual de Innova Space Education.";
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
   TTS MIRA – ElevenLabs via backend Render
------------------------------------------------------------------ */
async function speakWithMiraVoice(text) {
    if (!miraVoiceEnabled) return;
    if (!text) return;
    if (miraTTSMutedByMode) return;

    const safeText = sanitizeForSpeech(text);
    if (!safeText) return;

    try {
        const res = await fetch(MIRA_TTS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: safeText })
        });

        if (!res.ok) {
            console.warn("TTS backend no disponible:", await res.text());
            return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);

        await audio.play().catch(err => {
            console.warn("Error al reproducir audio TTS:", err);
        });
    } catch (err) {
        console.error("Error llamando a /api/tts:", err);
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
            if (!miraVoiceEnabled) return;
            if (miraTTSMutedByMode) return;

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
            if (messages[id] && miraVoiceEnabled) {
                if (!miraTTSMutedByMode) speakWithMiraVoice(messages[id]);
            }
        });
    }, { threshold: 0.4 });

    sections.forEach(sec => obs.observe(sec));
}

/* ------------------------------------------------------------------
   ✅ NAVBAR: COMPACTA AL SCROLL
------------------------------------------------------------------ */
function setupNavbarScroll() {
    const navbar = document.querySelector(".navbar");
    if (!navbar) return;

    const THRESHOLD = 18;

    function update() {
       document.body.classList.toggle("has-scrolled", window.scrollY > THRESHOLD);
        if (window.scrollY > THRESHOLD) {
            navbar.classList.add("navbar--scrolled");
        } else {
            navbar.classList.remove("navbar--scrolled");
        }
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
}

/* ------------------------------------------------------------------
   ✅ NAVBAR: SECCIÓN ACTIVA AUTOMÁTICA
------------------------------------------------------------------ */
function setupNavbarActiveSections() {
    const navbar = document.querySelector(".navbar");
    const links = Array.from(document.querySelectorAll(".nav-links a[href^='#']"));
    if (!navbar || !links.length) return;

    const map = new Map();
    links.forEach(a => {
        const id = a.getAttribute("href").slice(1);
        if (id) map.set(id, a);
    });

    const sections = Array.from(map.keys())
        .map(id => document.getElementById(id))
        .filter(Boolean);

    function clear() {
        links.forEach(a => {
            a.classList.remove("active");
            a.removeAttribute("aria-current");
        });
    }

    function setActive(id) {
        clear();
        const link = map.get(id);
        if (link) {
            link.classList.add("active");
            link.setAttribute("aria-current", "page");
        }
    }

    const headerOffset = () => Math.max(70, navbar.offsetHeight || 80);

    const observer = new IntersectionObserver(entries => {
        let best = null;

        entries.forEach(e => {
            if (!e.isIntersecting) return;
            if (!best || e.intersectionRatio > best.intersectionRatio) {
                best = e;
            }
        });

        if (best?.target?.id) {
            setActive(best.target.id);
        }
    }, {
        threshold: [0.2, 0.35, 0.5, 0.65],
        rootMargin: `-${headerOffset()}px 0px -55% 0px`
    });

    sections.forEach(sec => observer.observe(sec));

    if (location.hash) {
        setActive(location.hash.replace("#", ""));
    } else if (sections[0]) {
        setActive(sections[0].id);
    }
}

/* ------------------------------------------------------------------
   ✅ NUEVO (NO BORRA NADA): ACTIVAR NAVBAR FUNCTIONS
   - No toca tu DOMContentLoaded existente
   - Solo asegura que navbar quede activa
------------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
    try { setupNavbarScroll(); } catch (e) {}
    try { setupNavbarActiveSections(); } catch (e) {}
});
/* =========================================================
   🧍 HUMANOIDE MINI (mascota flotante)
   - Movimiento suave aleatorio por pantalla
   - Curiosidad ocasional hacia cursor
   - Mantiene distancia del cursor (no se pone encima)
========================================================= */
(function miniHumanoidPet(){
  const el = document.getElementById("mini-humanoid");
  if(!el) return;

  let x = 20, y = 140;
  let vx = 0, vy = 0;

  let tx = window.innerWidth * 0.6;
  let ty = window.innerHeight * 0.5;

  let mouseX = tx, mouseY = ty;
  let lastMouseTs = Date.now();

  const cfg = {
    pull: 0.013,          // suavidad al target
    jitter: 0.28,         // vida leve
    damping: 0.90,
    maxSpeed: 10,
    edgePadding: 18,
    retargetMinMs: 700,
    retargetMaxMs: 2200,
    curiosityChance: 0.28,
    curiosityHoldMs: 1400,
    cursorAvoidRadius: 90,  // ✅ distancia mínima del cursor
    topExtra: 10
  };

  const isMobile = matchMedia("(max-width: 600px)").matches;
  if(isMobile){
    cfg.maxSpeed = 9;
    cfg.pull = 0.015;
    cfg.jitter = 0.32;
    cfg.cursorAvoidRadius = 70;
  }

  let nextRetargetTs = Date.now() + 800;
  let curiosityUntil = 0;

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  function getTopSafe(){
    const cs = getComputedStyle(document.documentElement);
    const navH = parseFloat(cs.getPropertyValue("--navbar-h")) || 86;
    const navHS = parseFloat(cs.getPropertyValue("--navbar-h-scrolled")) || 68;
    return Math.max(navH, navHS) + cfg.topExtra;
  }

  function setMouse(cx, cy){
    mouseX = cx; mouseY = cy;
    lastMouseTs = Date.now();
  }

  window.addEventListener("mousemove", (e)=> setMouse(e.clientX, e.clientY), {passive:true});
  window.addEventListener("touchstart", (e)=> {
    if(e.touches && e.touches[0]) setMouse(e.touches[0].clientX, e.touches[0].clientY);
  }, {passive:true});
  window.addEventListener("touchmove", (e)=> {
    if(e.touches && e.touches[0]) setMouse(e.touches[0].clientX, e.touches[0].clientY);
  }, {passive:true});

  function pickRandomTarget(){
    const w = window.innerWidth;
    const h = window.innerHeight;
    const topSafe = getTopSafe();

    tx = clamp(Math.random() * w, cfg.edgePadding, w - cfg.edgePadding);
    ty = clamp(Math.random() * h, topSafe, h - cfg.edgePadding);
  }

  function pickCuriousTarget(){
    const w = window.innerWidth;
    const h = window.innerHeight;
    const topSafe = getTopSafe();

    // apuntar “cerca” del cursor, pero manteniendo distancia
    const ang = Math.random() * Math.PI * 2;
    const r = cfg.cursorAvoidRadius + 40 + Math.random()*80;

    tx = clamp(mouseX + Math.cos(ang)*r, cfg.edgePadding, w - cfg.edgePadding);
    ty = clamp(mouseY + Math.sin(ang)*r, topSafe, h - cfg.edgePadding);
  }

  function retarget(){
    const recentlyMoved = (Date.now() - lastMouseTs) < 2000;
    const goCurious = recentlyMoved && (Math.random() < cfg.curiosityChance);

    if(goCurious){
      curiosityUntil = Date.now() + cfg.curiosityHoldMs;
      pickCuriousTarget();
    }else{
      pickRandomTarget();
    }

    nextRetargetTs = Date.now() + (cfg.retargetMinMs + Math.random()*(cfg.retargetMaxMs - cfg.retargetMinMs));
  }

  function avoidCursor(){
    const dx = x - mouseX;
    const dy = y - mouseY;
    const d = Math.hypot(dx, dy);

    if(d > 0 && d < cfg.cursorAvoidRadius){
      // empuje suave lejos del cursor
      const strength = (cfg.cursorAvoidRadius - d) / cfg.cursorAvoidRadius;
      vx += (dx / d) * (0.9 * strength);
      vy += (dy / d) * (0.9 * strength);

      // si está demasiado encima, re-target inmediato a un lugar cercano pero no encima
      if(d < cfg.cursorAvoidRadius * 0.55){
        pickCuriousTarget();
        nextRetargetTs = Date.now() + 400;
      }
    }
  }

  function step(){
    const w = window.innerWidth;
    const h = window.innerHeight;
    const topSafe = getTopSafe();

    if(Date.now() > nextRetargetTs) retarget();

    // atracción al target
    const dx = tx - x;
    const dy = ty - y;

    vx += dx * cfg.pull;
    vy += dy * cfg.pull;

    // vida
    vx += (Math.random() - 0.5) * cfg.jitter;
    vy += (Math.random() - 0.5) * cfg.jitter;

    // evita el cursor (para no “molestar”)
    avoidCursor();

    // clamp speed + damping
    vx = clamp(vx, -cfg.maxSpeed, cfg.maxSpeed);
    vy = clamp(vy, -cfg.maxSpeed, cfg.maxSpeed);

    vx *= cfg.damping;
    vy *= cfg.damping;

    x += vx;
    y += vy;

    // límites
    const minX = cfg.edgePadding;
    const maxX = w - cfg.edgePadding;
    const minY = topSafe;
    const maxY = h - cfg.edgePadding;

    if(x < minX){ x = minX; vx *= -0.65; }
    if(x > maxX){ x = maxX; vx *= -0.65; }
    if(y < minY){ y = minY; vy *= -0.65; }
    if(y > maxY){ y = maxY; vy *= -0.65; }

    // orientación suave
    const rot = clamp(vx * 1.6, -16, 16);
    const tilt = clamp(-vy * 0.22, -6, 6);

    const speed = Math.hypot(vx, vy);
    el.classList.toggle("is-active", speed > 2.8);

    el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg) translateY(${tilt}px)`;

    requestAnimationFrame(step);
  }

  // start
  retarget();
  requestAnimationFrame(step);
})();
