"use strict";
(async () => {
  const cfg = window.INNOVA_ADMIN_CONFIG;
  const $ = selector => document.querySelector(selector);
  function note(message, bad = false) {
    const n = $("#notice"); n.textContent = message; n.className = bad ? "error" : "ok";
  }
  if (!cfg || !window.supabase) { note("No se pudo cargar el cliente CEO", true); return; }
  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  let mfaFactor = null;
  let authenticated = false;
  async function headers() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) throw new Error("Inicia sesión desde Innova CEO");
    return { Authorization: "Bearer " + session.access_token, "Content-Type": "application/json" };
  }
  async function api(path, options = {}) {
    const response = await fetch(cfg.backendUrl + "/api/innova-server/v1" + path, {
      ...options, cache: "no-store", headers: await headers()
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Error " + response.status);
    return data;
  }
  async function sessionState() {
    authenticated = false;
    $("#mfa").classList.add("hide");
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      $("#auth-state").textContent = "Inicia sesión en Innova CEO y regresa a esta página.";
      return false;
    }
    const { data: aal } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") {
      $("#auth-state").textContent = "Autenticación adicional requerida (MFA AAL2).";
      const { data: factors } = await client.auth.mfa.listFactors();
      mfaFactor = factors?.totp?.find(f => f.status === "verified")?.id || null;
      if (mfaFactor) $("#mfa").classList.remove("hide");
      else $("#auth-state").textContent += " Configura TOTP primero en Seguridad MFA de CEO.";
      return false;
    }
    authenticated = true;
    $("#auth-state").textContent = "Sesión de CEO verificada con MFA AAL2.";
    return true;
  }
  function cell(tag, text, className) {
    const e = document.createElement(tag);
    e.textContent = String(text || "");
    if (className) e.className = className;
    return e;
  }
  function append(row, tag, content, cls) { const node = cell(tag, content, cls); row.append(node); return node; }
  function draw(requests) {
    const host = $("#items"); host.replaceChildren();
    if (!requests.length) { append(host, "p", "No hay solicitudes registradas."); return; }
    for (const r of requests) {
      const row = document.createElement("article"); row.className = "item";
      append(row, "div", r.action + " · " + r.target, "status");
      append(row, "p", r.summary, "summary");
      append(row, "div", "Estado: " + r.status + " · Vence: " + new Date(r.expires_at).toLocaleString("es-CL"), "meta");
      append(row, "div", "ID: " + r.id, "meta");
      append(row, "div", "Hash de operación: " + r.payload_sha256, "meta");
      if (r.status === "pending" && Date.parse(r.expires_at) > Date.now()) {
        const actions = document.createElement("div"); actions.className = "actions";
        for (const [decision, text, cls] of [["approve", "Aprobar esta operación", ""], ["reject", "Rechazar", "deny"]]) {
          const button = cell("button", text, cls); button.type = "button";
          button.addEventListener("click", async () => {
            const verb = decision === "approve" ? "APROBAR" : "RECHAZAR";
            if (!window.confirm(verb + " operación " + r.action + " en " + r.target +
                "\nIdentificador: " + r.id + "\nConfirma la decisión.")) return;
            button.disabled = true;
            try {
              await api("/requests/" + encodeURIComponent(r.id) + "/decision", {
                method: "POST", body: JSON.stringify({ decision, payload_sha256: r.payload_sha256 })
              });
              note("Operación " + (decision === "approve" ? "aprobada" : "rechazada") + "."); await refresh();
            } catch (e) { note(e.message, true); button.disabled = false; }
          });
          actions.append(button);
        }
        row.append(actions);
      }
      host.append(row);
    }
  }
  async function refresh() {
    if (!(await sessionState())) { $("#items").replaceChildren(); return; }
    try { const data = await api("/requests"); draw(data.requests || []); }
    catch (e) { note(e.message, true); $("#items").replaceChildren(); }
  }
  $("#mfa-submit").addEventListener("click", async () => {
    const code = $("#mfa-code").value.trim();
    if (!/^\d{6}$/.test(code) || !mfaFactor) { note("Código MFA inválido", true); return; }
    try {
      const { error } = await client.auth.mfa.challengeAndVerify({ factorId: mfaFactor, code });
      if (error) throw error;
      $("#mfa-code").value = "";
      await refresh();
    } catch (e) { note(e.message || "No se pudo verificar MFA", true); }
  });
  $("#refresh").addEventListener("click", refresh);
  await refresh();
  setInterval(() => { if (!document.hidden) refresh().catch(() => {}); }, 15000);
})();
