(() => {
  "use strict";
  if (new URLSearchParams(location.search).get("safe") === "1") return;

  const PREFIX = "innova-admin-draft:v1:";
  const DEBOUNCE_MS = 700;
  const timers = new WeakMap();
  const restored = new WeakSet();

  const main = () => document.getElementById("main-content");
  const viewName = () => document.getElementById("view-title")?.textContent?.trim() || "general";
  const excluded = (el) => {
    if (!el || !el.name && !el.id) return true;
    const type = String(el.type || "").toLowerCase();
    const token = `${el.name || ""} ${el.id || ""}`.toLowerCase();
    return type === "password" || type === "file" || type === "hidden" || /password|pass|mfa|totp|token|secret|apikey|api_key|credential/.test(token);
  };

  function fieldKey(el) {
    const form = el.form;
    const formKey = form?.id || form?.getAttribute("name") || form?.dataset?.entity || form?.dataset?.table || "loose";
    const field = el.name || el.id;
    return `${PREFIX}${location.pathname}:${viewName()}:${formKey}:${field}`;
  }

  function valueOf(el) {
    if (el.type === "checkbox" || el.type === "radio") return { checked: !!el.checked };
    return { value: String(el.value ?? "") };
  }

  function save(el) {
    if (excluded(el)) return;
    try {
      const payload = { ...valueOf(el), at: Date.now() };
      sessionStorage.setItem(fieldKey(el), JSON.stringify(payload));
      setStatus("Borrador guardado");
    } catch (_) {}
  }

  function scheduleSave(el) {
    if (excluded(el)) return;
    clearTimeout(timers.get(el));
    timers.set(el, setTimeout(() => save(el), DEBOUNCE_MS));
    setStatus("Guardando…");
  }

  function restore(el) {
    if (excluded(el) || restored.has(el)) return;
    restored.add(el);
    try {
      const raw = sessionStorage.getItem(fieldKey(el));
      if (!raw) return;
      const payload = JSON.parse(raw);
      if (!payload || Date.now() - Number(payload.at || 0) > 12 * 60 * 60 * 1000) return;
      const empty = el.type === "checkbox" || el.type === "radio" ? !el.checked : !String(el.value || "").trim();
      if (!empty) return;
      if (Object.prototype.hasOwnProperty.call(payload, "checked")) el.checked = !!payload.checked;
      else if (Object.prototype.hasOwnProperty.call(payload, "value")) el.value = payload.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      setStatus("Borrador recuperado");
    } catch (_) {}
  }

  function clearForm(form) {
    if (!form) return;
    form.querySelectorAll("input,textarea,select").forEach((el) => {
      if (excluded(el)) return;
      try { sessionStorage.removeItem(fieldKey(el)); } catch (_) {}
    });
  }

  function ensureStatus() {
    let el = document.getElementById("admin-autosave-status");
    if (el) return el;
    el = document.createElement("div");
    el.id = "admin-autosave-status";
    el.setAttribute("aria-live", "polite");
    el.style.cssText = "position:fixed;right:18px;bottom:16px;z-index:8000;padding:6px 10px;border-radius:999px;background:rgba(20,33,68,.88);color:#fff;font:600 11px/1.2 system-ui;opacity:0;pointer-events:none;transition:opacity .18s ease";
    document.body.appendChild(el);
    return el;
  }

  let statusTimer = null;
  function setStatus(text) {
    const el = ensureStatus();
    el.textContent = text;
    el.style.opacity = "1";
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { el.style.opacity = "0"; }, 1100);
  }

  function scan(root = document) {
    root.querySelectorAll?.("input,textarea,select").forEach(restore);
  }

  document.addEventListener("input", (e) => {
    const el = e.target.closest?.("input,textarea,select");
    if (el) scheduleSave(el);
  }, true);
  document.addEventListener("change", (e) => {
    const el = e.target.closest?.("input,textarea,select");
    if (el) scheduleSave(el);
  }, true);
  document.addEventListener("submit", (e) => {
    const form = e.target.closest?.("form");
    if (form) setTimeout(() => clearForm(form), 1200);
  }, true);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches?.("input,textarea,select")) restore(node);
        scan(node);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  scan();
})();
