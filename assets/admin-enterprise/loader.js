(() => {
  "use strict";
  const VERSION = "20260808-enterprise-v2-complete";
  const PARTS = [
    "assets/admin-enterprise/enterprise-1.b64",
    "assets/admin-enterprise/enterprise-2.b64",
    "assets/admin-enterprise/enterprise-3.b64",
    "assets/admin-enterprise/enterprise-4a.b64",
    "assets/admin-enterprise/enterprise-4b.b64",
    "assets/admin-enterprise/enterprise-4c.b64"
  ];

  async function loadEnterprise() {
    if (window.__INNOVA_ENTERPRISE_LOADING__) return;
    window.__INNOVA_ENTERPRISE_LOADING__ = true;
    if (typeof DecompressionStream !== "function") {
      throw new Error("Este navegador no soporta DecompressionStream. Actualiza Chrome, Edge o Firefox.");
    }
    const pieces = await Promise.all(PARTS.map(async (url) => {
      const response = await fetch(`${url}?v=${VERSION}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`No se pudo cargar ${url} (${response.status})`);
      return (await response.text()).trim();
    }));
    const b64 = pieces.join("");
    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const source = await new Response(stream).text();
    const blobUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    const script = document.createElement("script");
    script.src = blobUrl;
    script.dataset.innovaEnterprise = "v2-complete";
    script.onload = () => {
      URL.revokeObjectURL(blobUrl);
      document.documentElement.dataset.innovaEnterprise = "ready";
      window.dispatchEvent(new CustomEvent("innova-enterprise-ready"));
    };
    script.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      console.error("No fue posible iniciar Innova Admin Enterprise v2.");
    };
    document.head.appendChild(script);
  }

  loadEnterprise().catch((error) => {
    console.error("Innova Admin Enterprise:", error);
    const root = document.getElementById("toast-root");
    if (root) {
      const item = document.createElement("div");
      item.className = "toast error";
      item.textContent = `No se pudo cargar la ampliación empresarial: ${error.message}`;
      root.appendChild(item);
      setTimeout(() => item.remove(), 7000);
    }
  });
})();
