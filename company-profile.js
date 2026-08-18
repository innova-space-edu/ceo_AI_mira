// Perfil corporativo público 2026 para la web de Innova Space Education SpA.
// Mantiene el contenido de MIRA alineado con las capacidades y proyectos visibles.

// Compatibilidad con el identificador esperado por main.js para el video de introducción.
const introVideoCompat = document.getElementById("intro-video-overlay-video");
if (introVideoCompat && !document.getElementById("intro-video")) {
  introVideoCompat.id = "intro-video";
}

window.INNOVA_COMPANY_PROFILE = {
  company: "Innova Space Education SpA",
  summary:
    "Empresa chilena de soluciones integrales que combina tecnología, inteligencia artificial, desarrollo de software, seguridad, plataformas de gestión y trabajos de remodelación, reparación y mejoramiento de espacios para instituciones públicas y privadas.",
  services: [
    "Desarrollo de páginas web, plataformas y sistemas de gestión",
    "Inteligencia artificial, automatización y asistentes virtuales",
    "Sistemas de seguridad, control de acceso, monitoreo y auditoría",
    "Remodelación, reparación, habilitación y mejoramiento de espacios institucionales",
    "Plataformas de inventario, recursos, reservas y operación institucional",
    "Soluciones educativas, científicas, STEAM y transformación digital"
  ],
  projects: [
    "EduAI Platform",
    "Sello Tecnológico",
    "Control de Acceso Escolar",
    "Innova Emergency",
    "MIRA",
    "Innova Space Track / Inventario"
  ],
  technologies: [
    "Supabase", "Vercel", "GitHub", "Cloudflare", "Netlify",
    "Next.js", "React", "TypeScript", "Node.js", "Python",
    "PostgreSQL", "PostGIS", "Gemini", "Gemini Interactions API",
    "Gemini Live", "Groq", "OpenRouter", "Hugging Face", "Cerebras",
    "Llama", "Qwen", "Kimi", "DeepSeek", "ElevenLabs", "Resend"
  ],
  googleRoadmap: [
    {
      title: "Interactions API",
      text: "Nueva base recomendada para agentes, conversaciones multimodales, herramientas, estado y flujos de trabajo complejos."
    },
    {
      title: "Gemini Live",
      text: "Experiencias en tiempo real con conversación bidireccional, audio, video y entradas multimodales."
    },
    {
      title: "Study Notebooks",
      text: "Referencia para aprendizaje adaptativo con diagnóstico, lecciones personalizadas, seguimiento y práctica guiada."
    },
    {
      title: "Gemini Notebook",
      text: "Investigación basada en fuentes, cuadernos sincronizados, análisis avanzado y creación de artefactos derivados."
    },
    {
      title: "Gemini multimodal",
      text: "Texto, documentos, imágenes, audio y razonamiento como capacidades reutilizables por agentes y módulos de EduAI."
    },
    {
      title: "Gen Media",
      text: "Línea de integración progresiva para imagen, edición visual, voz, música y video mediante servicios generativos de Google."
    }
  ],
  contact: "contacto@innova-space-edu.cl"
};

(function syncMiraPublicContext() {
  const originalFetch = window.fetch.bind(window);
  const profile = window.INNOVA_COMPANY_PROFILE;

  // Añade un contexto corporativo breve solo a las consultas del chat público MIRA.
  // No interviene el formulario de contacto ni las demás llamadas fetch del sitio.
  window.fetch = async function innovaFetch(input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    const isMiraPublic = url.includes("ceo-ai-mira.onrender.com/api/mira");

    if (isMiraPublic && init?.body && typeof init.body === "string") {
      try {
        const body = JSON.parse(init.body);
        if (body?.message && !body.__companyContextAttached) {
          const context = [
            `Contexto corporativo oficial actualizado de ${profile.company}:`,
            profile.summary,
            `Servicios: ${profile.services.join("; ")}.`,
            `Proyectos de referencia: ${profile.projects.join(", ")}.`,
            `Tecnologías y herramientas: ${profile.technologies.join(", ")}.`,
            `Contacto comercial: ${profile.contact}.`,
            "Responde la consulta usando este contexto cuando sea pertinente y no presentes a la empresa como dedicada únicamente a educación."
          ].join("\n");

          body.message = `${context}\n\nConsulta del visitante:\n${body.message}`;
          body.__companyContextAttached = true;

          init = {
            ...init,
            body: JSON.stringify(body)
          };
        }
      } catch (_) {
        // Si el cuerpo no es JSON válido, conserva el comportamiento original.
      }
    }

    return originalFetch(input, init);
  };

  // Sustituye el fallback local de main.js cuando el backend no responde.
  window.generateMiraResponse = function generateMiraResponseUpdated(text) {
    const t = String(text || "").toLowerCase();

    if (t.includes("hola")) {
      return "Hola. Soy MIRA, la asistente virtual de Innova Space Education SpA. Puedo orientarle sobre tecnología, IA, desarrollo de plataformas, seguridad, remodelación y proyectos institucionales.";
    }

    if (t.includes("empresa") || t.includes("qué hacen") || t.includes("que hacen")) {
      return "Innova Space Education SpA desarrolla soluciones integrales para instituciones públicas y privadas: software y páginas web, inteligencia artificial, plataformas de gestión, sistemas de seguridad y control de acceso, además de remodelación, reparación y mejoramiento de espacios.";
    }

    if (t.includes("proyecto") || t.includes("portafolio")) {
      return "Entre los proyectos de referencia se encuentran EduAI Platform, Sello Tecnológico, Control de Acceso Escolar, Innova Emergency, MIRA e Innova Space Track / Inventario.";
    }

    if (t.includes("google") || t.includes("gemini") || t.includes("notebook")) {
      return "En EduAI se mantiene una línea de integración progresiva con Google AI: Gemini multimodal, Interactions API para agentes y estado, Gemini Live para tiempo real, Study Notebooks como referencia de aprendizaje adaptativo, Gemini Notebook para investigación con fuentes y capacidades de generación multimedia.";
    }

    if (t.includes("tecnolog") || t.includes("supabase") || t.includes("vercel") || t.includes("github") || t.includes("ia")) {
      return "Trabajamos con tecnologías como Supabase, Vercel, GitHub, Cloudflare, Netlify, Next.js, React, TypeScript, Node.js, Python, PostgreSQL y PostGIS; además de proveedores y modelos de IA mediante Gemini, Groq, OpenRouter, Hugging Face, Cerebras, Llama, Qwen, Kimi y DeepSeek, entre otras integraciones especializadas.";
    }

    if (t.includes("seguridad") || t.includes("acceso")) {
      return "Desarrollamos sistemas de seguridad y control institucional, incluyendo control de acceso, monitoreo de equipos, auditoría de eventos, incidencias, reportes y administración con roles.";
    }

    if (t.includes("remodel") || t.includes("repar") || t.includes("obra")) {
      return "La empresa también ejecuta y coordina trabajos de remodelación, reparación, habilitación y mejoramiento de espacios institucionales, adaptados a las necesidades operativas de entidades públicas y privadas.";
    }

    if (t.includes("web") || t.includes("plataforma") || t.includes("sistema")) {
      return "Creamos páginas web, plataformas institucionales, sistemas administrativos, inventarios, reservas, paneles de control, soluciones con bases de datos e integraciones con APIs y servicios en la nube.";
    }

    if (t.includes("contacto") || t.includes("cotiza")) {
      return `Puede escribirnos a ${profile.contact} para conversar sobre su proyecto o solicitar una cotización.`;
    }

    return "Puedo ayudarle con información sobre nuestros servicios de tecnología, IA, desarrollo web y plataformas, seguridad y control de acceso, remodelación y proyectos institucionales.";
  };

  function enrichGoogleRoadmap() {
    const roadmap = document.querySelector(".google-roadmap");
    const grid = roadmap?.querySelector(".roadmap-grid");
    const intro = roadmap?.querySelector(".google-roadmap-header p");
    if (!roadmap || !grid) return;

    if (intro) {
      intro.textContent =
        "EduAI mantiene una arquitectura multi-proveedor y una línea de I+D para incorporar capacidades recientes de Google AI cuando aportan valor real, sin depender de un único modelo ni presentar como terminadas funciones que aún están en integración.";
    }

    grid.innerHTML = "";
    profile.googleRoadmap.forEach((item) => {
      const card = document.createElement("div");
      card.className = "roadmap-item";

      const title = document.createElement("strong");
      title.textContent = item.title;

      const text = document.createElement("span");
      text.textContent = item.text;

      card.appendChild(title);
      card.appendChild(text);
      grid.appendChild(card);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enrichGoogleRoadmap, { once: true });
  } else {
    enrichGoogleRoadmap();
  }
})();
