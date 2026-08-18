(() => {
  "use strict";

  const VERSION = "20260818-agents-v3";
  const AUTH_POLICY = `assets/admin-enterprise/auth-policy.js?v=${VERSION}`;
  const PROJECT_REALITY = `assets/admin-enterprise/project-reality.js?v=${VERSION}`;
  const RECORD_MANAGER = `assets/admin-enterprise/record-manager.js?v=${VERSION}`;
  const COMMERCIAL_DOCUMENTS = `assets/admin-enterprise/commercial-documents.js?v=${VERSION}`;
  const AGENT_COMMAND_CENTER = `assets/admin-enterprise/agent-command-center.js?v=${VERSION}`;
  const PARTS = [
    "assets/admin-enterprise/enterprise-1.b64",
    "assets/admin-enterprise/enterprise-2.b64",
    "assets/admin-enterprise/enterprise-3.b64",
    "assets/admin-enterprise/enterprise-4a.b64",
    "assets/admin-enterprise/enterprise-4b.b64",
    "assets/admin-enterprise/enterprise-4c.b64"
  ];

  const qs = new URLSearchParams(window.location.search);
  const SAFE_MODE = qs.get("safe") === "1";
  const isVisible = (element) => !!element && !element.classList.contains("hidden");

  function coreUiReady() {
    const app = document.getElementById("admin-app");
    const main = document.getElementById("main-content");
    if (!isVisible(app) || !main || !main.childElementCount) return false;
    if (main.querySelector(".loading-orb")) return false;
    const text = String(main.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) return false;
    if (/^Cargando\b/i.test(text) || /Cargando\s+Centro\s+de\s+operaciones/i.test(text)) return false;
    return true;
  }

  function waitForCoreUi(timeoutMs = 20000) {
    if (coreUiReady()) return Promise.resolve(true);
    return new Promise((resolve) => {
      const main = document.getElementById("main-content");
      const startedAt = Date.now();
      let observer = null;
      let timer = null;
      const finish = (value) => {
        if (observer) observer.disconnect();
        if (timer) clearInterval(timer);
        resolve(value);
      };
      const check = () => {
        if (coreUiReady()) return finish(true);
        if (Date.now() - startedAt >= timeoutMs) return finish(false);
        return false;
      };
      if (main) {
        observer = new MutationObserver(check);
        observer.observe(main, { childList: true, subtree: true, characterData: true });
      }
      timer = setInterval(check, 150);
      check();
    });
  }

  function waitForUiQuiet(quietMs = 700, maxMs = 3000) {
    const main = document.getElementById("main-content");
    if (!main) return Promise.resolve();
    return new Promise((resolve) => {
      let quietTimer = null;
      let maxTimer = null;
      const observer = new MutationObserver(schedule);
      function done() {
        observer.disconnect();
        clearTimeout(quietTimer);
        clearTimeout(maxTimer);
        resolve();
      }
      function schedule() {
        clearTimeout(quietTimer);
        quietTimer = setTimeout(done, quietMs);
      }
      observer.observe(main, { childList: true, subtree: true, characterData: true });
      maxTimer = setTimeout(done, maxMs);
      schedule();
    });
  }

  function waitForIdle() {
    return new Promise((resolve) => {
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => resolve(), { timeout: 1800 });
      else setTimeout(resolve, 450);
    });
  }

  function keepPersonalSettingsVisible() {
    const settings = document.querySelector('[data-view="settings"]');
    if (!settings || settings.dataset.personalSettingsVisible === "true") return;
    settings.classList.remove("role-admin", "hidden");
    settings.dataset.personalSettingsVisible = "true";
  }

  function loadScriptOnce(src, datasetKey) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-${datasetKey}]`)) return resolve();
      const script = document.createElement("script");
      script.src = src;
      script.setAttribute(`data-${datasetKey}`, "true");
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.head.appendChild(script);
    });
  }

  function loadAuthPolicy() {
    return loadScriptOnce(AUTH_POLICY, "innova-auth-policy");
  }

  async function loadProjectReality() {
    try {
      await loadScriptOnce(PROJECT_REALITY, "innova-project-reality");
      document.documentElement.dataset.innovaProjectReality = "ready";
      window.dispatchEvent(new CustomEvent("innova-project-reality-ready"));
    } catch (error) {
      document.documentElement.dataset.innovaProjectReality = "error";
      showEnterpriseError(error);
    }
  }

  async function loadRecordManager() {
    try {
      await loadScriptOnce(RECORD_MANAGER, "innova-record-manager");
      document.documentElement.dataset.innovaRecordManager = "ready";
      window.dispatchEvent(new CustomEvent("innova-record-manager-ready"));
    } catch (error) {
      document.documentElement.dataset.innovaRecordManager = "error";
      showEnterpriseError(error);
    }
  }

  async function loadCommercialDocuments() {
    try {
      await loadScriptOnce(COMMERCIAL_DOCUMENTS, "innova-commercial-documents");
      document.documentElement.dataset.innovaCommercialDocuments = "ready";
      window.dispatchEvent(new CustomEvent("innova-commercial-documents-ready"));
    } catch (error) {
      document.documentElement.dataset.innovaCommercialDocuments = "error";
      showEnterpriseError(error);
    }
  }

  async function loadAgentCommandCenter() {
    try {
      await loadScriptOnce(AGENT_COMMAND_CENTER, "innova-agent-command-center");
      document.documentElement.dataset.innovaAgentCommandCenter = "ready";
      window.dispatchEvent(new CustomEvent("innova-agent-command-center-ready"));
    } catch (error) {
      document.documentElement.dataset.innovaAgentCommandCenter = "error";
      showEnterpriseError(error);
    }
  }

  async function loadEnterpriseExtensions() {
    if (SAFE_MODE) {
      console.info("Innova Admin: modo seguro activo; Enterprise v2 no se cargará en esta sesión.");
      document.documentElement.dataset.innovaEnterprise = "safe";
      return;
    }
    if (window.__INNOVA_ENTERPRISE_LOADING__ || document.documentElement.dataset.innovaEnterprise === "ready") return;
    window.__INNOVA_ENTERPRISE_LOADING__ = true;
    document.documentElement.dataset.innovaEnterprise = "loading";

    try {
      keepPersonalSettingsVisible();
      await loadAuthPolicy();
      keepPersonalSettingsVisible();
      await waitForIdle();

      if (typeof DecompressionStream !== "function") throw new Error("Este navegador no soporta DecompressionStream. Actualiza Chrome, Edge o Firefox.");

      const pieces = await Promise.all(PARTS.map(async (url) => {
        const response = await fetch(`${url}?v=${VERSION}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`No se pudo cargar ${url} (${response.status})`);
        return (await response.text()).trim();
      }));

      await waitForIdle();
      const b64 = pieces.join("");
      const raw = atob(b64);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      const source = await new Response(stream).text();

      await waitForIdle();
      const blobUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      const script = document.createElement("script");
      script.src = blobUrl;
      script.dataset.innovaEnterprise = "v2-complete";
      script.async = true;
      script.onload = async () => {
        URL.revokeObjectURL(blobUrl);
        document.documentElement.dataset.innovaEnterprise = "ready";
        window.__INNOVA_ENTERPRISE_LOADING__ = false;
        window.dispatchEvent(new CustomEvent("innova-enterprise-ready"));
        await waitForIdle();
        await loadProjectReality();
        await waitForIdle();
        await loadRecordManager();
        await waitForIdle();
        await loadCommercialDocuments();
        await waitForIdle();
        await loadAgentCommandCenter();
      };
      script.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        window.__INNOVA_ENTERPRISE_LOADING__ = false;
        document.documentElement.dataset.innovaEnterprise = "error";
        showEnterpriseError(new Error("El bundle empresarial no pudo ejecutarse."));
      };
      document.head.appendChild(script);
    } catch (error) {
      window.__INNOVA_ENTERPRISE_LOADING__ = false;
      document.documentElement.dataset.innovaEnterprise = "error";
      throw error;
    }
  }

  function showEnterpriseError(error) {
    console.error("Innova Admin Enterprise:", error);
    const root = document.getElementById("toast-root");
    if (!root) return;
    const item = document.createElement("div");
    item.className = "toast error";
    item.textContent = `La ampliación empresarial no pudo iniciar, pero el panel principal sigue disponible: ${error.message}`;
    root.appendChild(item);
    setTimeout(() => item.remove(), 8000);
  }

  function showDeferredNotice() {
    console.warn("Innova Admin: el núcleo no terminó su primera vista a tiempo. Enterprise v2 se dejó sin cargar para no bloquear la interfaz.");
    document.documentElement.dataset.innovaEnterprise = "deferred";
  }

  (async () => {
    if (SAFE_MODE) {
      document.documentElement.dataset.innovaEnterprise = "safe";
      return;
    }
    const ready = await waitForCoreUi();
    if (!ready) {
      showDeferredNotice();
      return;
    }
    document.documentElement.dataset.innovaCore = "ready";
    window.dispatchEvent(new CustomEvent("innova-core-ready"));
    await waitForUiQuiet();
    await waitForIdle();
    await loadEnterpriseExtensions();
  })().catch(showEnterpriseError);
})();
