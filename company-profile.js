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
    "PostgreSQL", "PostGIS", "Gemini", "Groq", "OpenRouter",
    "Hugging Face", "Cerebras", "ElevenLabs", "Resend"
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

    if (t.includes("tecnolog") || t.includes("supabase") || t.includes("vercel") || t.includes("github") || t.includes("ia")) {
      return "Trabajamos con tecnologías como Supabase, Vercel, GitHub, Cloudflare, Netlify, Next.js, React, TypeScript, Node.js, Python, PostgreSQL y PostGIS; además de proveedores y modelos de IA mediante Gemini, Groq, OpenRouter, Hugging Face, Cerebras y otras integraciones especializadas.";
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
})();
