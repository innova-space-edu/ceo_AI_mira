(() => {
  "use strict";

  const VERSION = "20260808-enterprise-v2-startup-fix";
  const AUTH_POLICY = `assets/admin-enterprise/auth-policy.js?v=${VERSION}`;
  const PARTS = [
    "assets/admin-enterprise/enterprise-1.b64",
    "assets/admin-enterprise/enterprise-2.b64",
    "assets/admin-enterprise/enterprise-3.b64",
    "assets/admin-enterprise/enterprise-4a.b64",
    "assets/admin-enterprise/enterprise-4b.b64",
    "assets/admin-enterprise/enterprise-4c.b64"
  ];

  const isVisible = (element) => !!element && !element.classList.contains("hidden");

  function coreHasSettled() {
    const loading = document.getElementById("app-loading");
    const auth = document.getElementById("auth-screen");
    const app = document.getElementById("admin-app");
    return loading?.classList.contains("hidden") || isVisible(auth) || isVisible(app);
  }

  function waitForCore(timeoutMs = 8000) {
    if (coreHasSettled()) return Promise.resolve(true);

    return new Promise((resolve) => {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        if (coreHasSettled()) {
          clearInterval(timer);
          resolve(true);
          return;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          clearInterval(timer);
          resolve(false);
        }
      }, 100);
    });
  }

  function recoverCoreUi() {
    const loading = document.getElementById("app-loading");
    const auth = document.getElementById("auth-screen");
    const app = document.getElementById("admin-app");

    if (!loading || !auth || !app || loading.classList.contains("hidden")) return;

    loading.classList.add("hidden");
    app.classList.add("hidden");
    auth.classList.remove("hidden");

    const message = document.getElementById("auth-message");
    if (message && !message.textContent.trim()) {
      message.style.color = "var(--warning, #f5b942)";
      message.textContent = "La sesión anterior tardó demasiado en iniciar. Puedes ingresar nuevamente.";
    }

    console.warn("Innova Admin: se liberó la pantalla de carga tras superar el tiempo máximo de inicio.");
  }

  function keepPersonalSettingsVisible() {
    const settings = document.querySelector('[data-view="settings"]');
    if (!settings || settings.dataset.personalSettingsVisible === "true") return;
    const expose = () => settings.classList.remove("role-admin", "hidden");
    expose();
    settings.dataset.personalSettingsVisible = "true";
    new MutationObserver(expose).observe(settings, { attributes: true, attributeFilter: ["class"] });
  }

  function loadAuthPolicy() {
    return new Promise((resolve, reject) => {
      if (document.querySelector("script[data-innova-auth-policy]")) return resolve();
      const script = document.createElement("script");
      script.src = AUTH_POLICY;
      script.dataset.innovaAuthPolicy = "true";
      script.onload = resolve;
      script.onerror = () => reject(new Error(`No se pudo cargar ${AUTH_POLICY}`));
      document.head.appendChild(script);
    });
  }

  async function loadEnterpriseExtensions() {
    if (window.__INNOVA_ENTERPRISE_LOADING__ || document.documentElement.dataset.innovaEnterprise === "ready") return;
    window.__INNOVA_ENTERPRISE_LOADING__ = true;

    try {
      keepPersonalSettingsVisible();
      await loadAuthPolicy();
      keepPersonalSettingsVisible();

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
        window.__INNOVA_ENTERPRISE_LOADING__ = false;
        window.dispatchEvent(new CustomEvent("innova-enterprise-ready"));
      };
      script.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        window.__INNOVA_ENTERPRISE_LOADING__ = false;
        console.error("No fue posible iniciar Innova Admin Enterprise v2.");
      };
      document.head.appendChild(script);
    } catch (error) {
      window.__INNOVA_ENTERPRISE_LOADING__ = false;
      throw error;
    }
  }

  function startEnterpriseWhenAppIsVisible() {
    const app = document.getElementById("admin-app");
    if (!app) return;

    const start = () => {
      if (!isVisible(app)) return false;
      loadEnterpriseExtensions().catch(showEnterpriseError);
      return true;
    };

    if (start()) return;

    const observer = new MutationObserver(() => {
      if (!start()) return;
      observer.disconnect();
    });
    observer.observe(app, { attributes: true, attributeFilter: ["class"] });
  }

  function showEnterpriseError(error) {
    console.error("Innova Admin Enterprise:", error);
    const root = document.getElementById("toast-root");
    if (!root) return;
    const item = document.createElement("div");
    item.className = "toast error";
    item.textContent = `No se pudo cargar la ampliación empresarial: ${error.message}`;
    root.appendChild(item);
    setTimeout(() => item.remove(), 7000);
  }

  (async () => {
    const coreReady = await waitForCore();
    if (!coreReady) recoverCoreUi();
    startEnterpriseWhenAppIsVisible();
  })().catch(showEnterpriseError);
})();
