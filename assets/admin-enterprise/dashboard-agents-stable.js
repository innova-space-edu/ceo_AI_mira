(() => {
  "use strict";
  if (new URLSearchParams(location.search).get("safe") === "1") return;

  const MIRA_V7_SRC = "assets/admin-enterprise/mira-orchestrator-v7.js?v=20260818-v7-1";
  const AUTOSAVE_SRC = "assets/admin-enterprise/admin-autosave-v1.js?v=20260818-autosave-1";
  let miraV7Promise = null;
  const main = () => document.getElementById("main-content");
  const title = () => document.getElementById("view-title")?.textContent?.trim() || "";

  function loadOnce(src, marker) {
    if (document.querySelector(`script[data-${marker}="true"]`)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.setAttribute(`data-${marker}`, "true");
      s.onload = resolve;
      s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.head.appendChild(s);
    });
  }

  function ensureMiraV7() {
    if (document.querySelector('script[data-mira-v7-loader="true"]')) return miraV7Promise || Promise.resolve();
    miraV7Promise = loadOnce(MIRA_V7_SRC, "mira-v7-loader");
    return miraV7Promise;
  }

  loadOnce(AUTOSAVE_SRC, "admin-autosave").catch(console.error);

  function styles() {
    if (document.getElementById("dashboard-agents-stable-style")) return;
    const s = document.createElement("style");
    s.id = "dashboard-agents-stable-style";
    s.textContent = `
      .das-wrap{margin:0 0 18px;padding:18px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(135deg,#f8fbff,#faf7ff)}
      .das-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:14px}.das-head h3{margin:0 0 5px}.das-head p{margin:0;color:var(--muted);max-width:780px}
      .das-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.das-card{background:#fff;border:1px solid #e0e6f2;border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:9px;min-height:150px}.das-card.primary{border-color:#bfc9ff;box-shadow:0 12px 28px rgba(49,94,251,.08)}
      .das-icon{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:#eef3ff;color:#315efb;font-size:1.15rem}.das-card strong{font-size:.95rem}.das-card p{margin:0;color:var(--muted);font-size:.78rem;line-height:1.45}.das-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:auto}.das-tools{display:flex;gap:5px;flex-wrap:wrap}.das-chip{font-size:.65rem;font-weight:800;padding:4px 7px;border-radius:999px;background:#f0f4fb;color:#4c628b}
      @media(max-width:900px){.das-grid{grid-template-columns:1fr}.das-head{flex-direction:column}}
    `;
    document.head.appendChild(s);
  }

  function clickView(view) {
    if (view === "mira") ensureMiraV7().catch(console.error);
    const btn = document.querySelector(`#side-nav [data-view="${view}"]`) || (view === "finance" ? document.getElementById("finance-agent-nav") : null);
    if (btn) btn.click();
  }

  function enhance() {
    const m = main();
    if (!m || title() !== "Centro de operaciones" || m.querySelector("#dashboard-agents-stable")) return;
    if (m.querySelector(".loading-orb")) return;
    styles();
    const box = document.createElement("section");
    box.id = "dashboard-agents-stable";
    box.className = "das-wrap";
    box.innerHTML = `
      <div class="das-head">
        <div><h3>Centro de agentes IA</h3><p>MIRA Business coordina la operación. Auditor revisa riesgos y cumplimiento; Financiero consolida facturas, tesorería, IVA/F29 y recordatorios.</p></div>
        <button id="dash-open-mira" class="btn primary"><i class="ri-sparkling-2-line"></i> Abrir MIRA Business</button>
      </div>
      <div class="das-grid">
        <article class="das-card primary">
          <div class="das-icon"><i class="ri-sparkling-2-line"></i></div><strong>MIRA Business</strong>
          <p>Orquestador central alineado con el esquema real de Supabase, sincronización eficiente cada 5 segundos, caché documental y ejecución verificada.</p>
          <div class="das-tools"><span class="das-chip">Toda la empresa</span><span class="das-chip">Supabase real</span><span class="das-chip">Sync 5 s</span><span class="das-chip">Ejecución</span></div>
          <div class="das-actions"><button class="btn primary" data-das-view="mira">Gestionar con MIRA</button></div>
        </article>
        <article class="das-card">
          <div class="das-icon"><i class="ri-shield-check-line"></i></div><strong>Agente Auditor 360°</strong>
          <p>Revisa alertas, facturas vencidas, proyectos, obligaciones tributarias, vencimientos y hallazgos prioritarios.</p>
          <div class="das-tools"><span class="das-chip">Riesgos</span><span class="das-chip">Vencimientos</span><span class="das-chip">Control</span></div>
          <div class="das-actions"><button class="btn ghost" data-das-view="auditor">Abrir Auditor</button></div>
        </article>
        <article class="das-card">
          <div class="das-icon"><i class="ri-money-dollar-circle-line"></i></div><strong>Agente Financiero</strong>
          <p>Consolida DTE, IVA débito/crédito y F29, y utiliza el backend de notificaciones configurado para recordatorios.</p>
          <div class="das-tools"><span class="das-chip">IVA/F29</span><span class="das-chip">Facturas</span><span class="das-chip">Resend</span></div>
          <div class="das-actions"><button class="btn ghost" data-das-view="finance">Abrir Financiero</button></div>
        </article>
      </div>`;
    const first = m.querySelector(".page-head");
    if (first) first.insertAdjacentElement("afterend", box); else m.prepend(box);
    box.querySelector("#dash-open-mira").onclick = () => clickView("mira");
    box.querySelectorAll("[data-das-view]").forEach((b) => b.onclick = () => clickView(b.dataset.dasView));
  }

  let timer = null;
  function schedule(){ clearTimeout(timer); timer = setTimeout(enhance, 120); }
  const m = main(); if (m) new MutationObserver(() => {
    schedule();
    if (title() === "MIRA Business") ensureMiraV7().catch(console.error);
  }).observe(m,{childList:true,subtree:false});
  document.addEventListener("click", e => {
    if (e.target.closest?.('[data-view="dashboard"]')) setTimeout(schedule,180);
    if (e.target.closest?.('[data-view="mira"]')) ensureMiraV7().catch(console.error);
  }, true);
  window.addEventListener("innova-enterprise-ready", schedule);
  window.addEventListener("innova-agent-command-center-ready", schedule);
  schedule();
})();