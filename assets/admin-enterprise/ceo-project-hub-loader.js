(() => {
  "use strict";
  const VERSION = "20260915-ceo-project-hub-1";
  const PARTS = [1, 2, 3, 4].map((n) => `assets/admin-enterprise/ceo-project-hub-${n}.b64?v=${VERSION}`);

  async function boot() {
    if (window.__INNOVA_CEO_PROJECT_HUB_LOADING__) return;
    window.__INNOVA_CEO_PROJECT_HUB_LOADING__ = true;
    try {
      if (typeof DecompressionStream !== "function") throw new Error("El navegador no soporta la carga del módulo CEO. Actualiza Chrome, Edge o Firefox.");
      const pieces = await Promise.all(PARTS.map(async (url) => {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(`No se pudo cargar ${url}`);
        return (await response.text()).trim();
      }));
      const raw = atob(pieces.join(""));
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      const source = await new Response(stream).text();
      const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      const script = document.createElement("script");
      script.src = url;
      script.dataset.innovaCeoProjectHub = "ready";
      script.onload = () => {
        URL.revokeObjectURL(url);
        document.documentElement.dataset.innovaCeoProjectHub = "ready";
        window.__INNOVA_CEO_PROJECT_HUB_LOADING__ = false;
      };
      script.onerror = () => {
        URL.revokeObjectURL(url);
        window.__INNOVA_CEO_PROJECT_HUB_LOADING__ = false;
        throw new Error("El módulo CEO no pudo ejecutarse.");
      };
      document.head.appendChild(script);
    } catch (error) {
      window.__INNOVA_CEO_PROJECT_HUB_LOADING__ = false;
      console.error("CEO Project Hub:", error);
      const root = document.getElementById("toast-root");
      if (root) {
        const item = document.createElement("div");
        item.className = "toast error";
        item.textContent = error.message || "No se pudo iniciar el centro de proyectos.";
        root.appendChild(item);
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
