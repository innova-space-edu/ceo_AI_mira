"use strict";
(() => {
  const prefix = "/api/innova-server/v1";
  const $ = s => document.querySelector(s);
  const status = (message, error = false) => {
    const e = $("#status"); e.textContent = message; e.className = error ? "error" : "success";
  };
  const text = (parent, name, value, css) => {
    const el = document.createElement(name); el.textContent = value;
    if (css) el.className = css;
    parent.append(el); return el;
  };
  async function api(path, method = "GET", payload) {
    const res = await fetch(prefix + path, {
      method, cache: "no-store", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...(payload ? { body: JSON.stringify(payload) } : {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Error(data.error || "Error " + res.status);
    return data;
  }
  function render(requests) {
    const root = $("#requests"); root.replaceChildren();
    if (!requests.length) { text(root, "p", "Sin solicitudes registradas."); return; }
    for (const r of requests) {
      const card = document.createElement("article");
      text(card, "strong", r.action + " · " + r.target);
      text(card, "p", r.summary);
      text(card, "div", "Estado: " + r.status + " · Caduca: " +
        new Date(r.expires_at).toLocaleString("es-CL"), "details");
      text(card, "div", "ID: " + r.id, "details");
      text(card, "div", "SHA-256: " + r.payload_sha256, "details");
      if (r.status === "pending" && Date.parse(r.expires_at) > Date.now()) {
        const actions = document.createElement("div"); actions.className = "actions";
        for (const [decision, label] of [["approve", "Aprobar operación"], ["reject", "Rechazar"]]) {
          const btn = text(actions, "button", label, decision === "reject" ? "deny" : "");
          btn.type = "button";
          btn.addEventListener("click", async () => {
            if (!confirm((decision === "approve" ? "APROBAR" : "RECHAZAR") + " esta operación?\n" +
              "Acción: " + r.action + "\nDestino: " + r.target + "\nID: " + r.id)) return;
            btn.disabled = true;
            try {
              await api("/requests/" + encodeURIComponent(r.id) + "/decision", "POST", {
                decision, payload_sha256: r.payload_sha256
              });
              status("Decisión registrada correctamente.");
              await refresh();
            } catch (e) { status(e.message, true); btn.disabled = false; }
          });
        }
        card.append(actions);
      }
      root.append(card);
    }
  }
  async function refresh() {
    try {
      const response = await api("/requests");
      render(response.requests || []);
      status("Acceso autorizado por Cloudflare. Puedes revisar las solicitudes.");
    } catch (err) { status(err.message, true); $("#requests").replaceChildren(); }
  }
  $("#refresh").addEventListener("click", refresh);
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 15000);
})();