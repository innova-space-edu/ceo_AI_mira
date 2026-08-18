(() => {
  "use strict";
  const cfg = window.INNOVA_ADMIN_CONFIG;
  if (!cfg || !window.supabase || new URLSearchParams(location.search).get("safe") === "1") return;

  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  let timer = null;
  let lastSync = null;
  const esc = (v = "") => String(v ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
  const money = (v) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(v || 0));
  const norm = (v = "") => String(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  function styles() {
    if (document.getElementById("section-sync-bridge-v4-style")) return;
    const s = document.createElement("style");
    s.id = "section-sync-bridge-v4-style";
    s.textContent = `
      .ss4-wrap{margin:0 0 16px}.ss4-bar{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:11px 13px;border:1px solid #dfe6f4;border-radius:15px;background:linear-gradient(90deg,#f8fbff,#fbf9ff)}.ss4-left,.ss4-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.ss4-dot{width:8px;height:8px;border-radius:50%;background:#16a267;box-shadow:0 0 0 4px rgba(22,162,103,.1)}.ss4-bar strong{color:#173a71}.ss4-bar small{color:var(--muted)}.ss4-btn{border:0;background:transparent;color:#315efb;font-weight:800;cursor:pointer;padding:5px 7px}.ss4-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;margin-top:9px}.ss4-kpi{padding:10px 12px;border:1px solid #e4e9f3;border-radius:13px;background:#fff}.ss4-kpi small{display:block;color:var(--muted);font-size:.69rem}.ss4-kpi strong{display:block;margin-top:3px;font-size:.9rem}.ss4-warn strong{color:#9a6500}.ss4-good strong{color:#087443}@media(max-width:760px){.ss4-bar{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(s);
  }

  async function rows(table, select = "*", limit = 500) {
    try { const { data, error } = await db.from(table).select(select).limit(limit); if (error) throw error; return data || []; }
    catch (_) { return []; }
  }

  function askMira(prompt) {
    sessionStorage.setItem("innova-mira-seed", prompt);
    const button = document.getElementById("s4-top-mira") || document.querySelector('[data-view="mira"]');
    button?.click();
  }

  async function projectMetrics() {
    const [projects, invoices, assets, cases] = await Promise.all([
      rows("company_projects"), rows("company_invoices"), rows("company_assets"), rows("company_service_cases"),
    ]);
    let rect = 0, pendingInvoices = 0;
    for (const p of projects) {
      const issued = invoices.filter((i) => i.project_id === p.id && i.invoice_type === "sale" && i.payment_status !== "void").length;
      const remaining = Math.max(0, Number(p.expected_invoice_count || 0) - issued);
      if (p.execution_status === "completed" && p.commercial_status === "closed" && remaining > 0) { rect += 1; pendingInvoices += remaining; }
    }
    return [
      ["Proyectos", projects.length, ""], ["En rectificación", rect, rect ? "warn" : "good"], ["Facturas por emitir", pendingInvoices, pendingInvoices ? "warn" : "good"], ["Activos ligados", assets.filter((x) => x.project_id).length, ""], ["Postventa abierta", cases.filter((x) => !["resolved","closed","cancelled"].includes(x.status)).length, ""],
    ];
  }

  async function inventoryMetrics() {
    const [assets, projects] = await Promise.all([rows("company_assets"), rows("company_projects", "id,title")]);
    const linked = assets.filter((x) => x.project_id);
    const companyOnly = assets.filter((x) => !x.project_id);
    const expiring = assets.filter((x) => x.warranty_until && new Date(x.warranty_until) <= new Date(Date.now() + 30 * 86400000) && new Date(x.warranty_until) >= new Date());
    return [
      ["Inventario empresa", assets.length, ""], ["Interno en proyectos", linked.length, ""], ["Activos corporativos", companyOnly.length, ""], ["Proyectos con activos", new Set(linked.map((x) => x.project_id)).size, ""], ["Garantías ≤30 días", expiring.length, expiring.length ? "warn" : "good"], ["Proyectos registrados", projects.length, ""],
    ];
  }

  async function postSaleMetrics() {
    const [cases, deadlines, projects] = await Promise.all([rows("company_service_cases"), rows("company_deadlines"), rows("company_projects", "id,title,status")]);
    const warranties = deadlines.filter((x) => x.entity_type === "project_warranty" && x.status === "open");
    const extended = warranties.filter((x) => /6 meses|extendida/i.test(`${x.title || ""} ${x.notes || ""}`));
    const expiring = warranties.filter((x) => x.due_date && new Date(x.due_date) <= new Date(Date.now() + 30 * 86400000));
    const open = cases.filter((x) => !["resolved","closed","cancelled"].includes(x.status));
    return [
      ["Casos abiertos", open.length, open.length ? "warn" : "good"], ["Garantías activas", warranties.length, ""], ["Base 3 meses", warranties.length - extended.length, ""], ["Extendidas 6 meses", extended.length, ""], ["Vencen ≤30 días", expiring.length, expiring.length ? "warn" : "good"], ["Proyectos", projects.length, ""],
    ];
  }

  async function fileMetrics() {
    const files = await rows("company_files");
    const active = files.filter((x) => !x.archived);
    const uncategorized = active.filter((x) => !x.category || x.category === "other");
    const expiring = active.filter((x) => x.expires_at && new Date(x.expires_at) <= new Date(Date.now() + 30 * 86400000));
    const linked = active.filter((x) => x.project_id || x.party_id);
    return [["Archivos activos", active.length, ""], ["Clasificados", active.length - uncategorized.length, "good"], ["Por clasificar", uncategorized.length, uncategorized.length ? "warn" : "good"], ["Vinculados", linked.length, ""], ["Vencen ≤30 días", expiring.length, expiring.length ? "warn" : "good"]];
  }

  async function financeMetrics() {
    const [invoices, tx, bank, tax] = await Promise.all([rows("company_invoices"), rows("company_transactions"), rows("company_bank_movements"), rows("company_tax_records")]);
    const receivable = invoices.filter((x) => x.invoice_type === "sale" && ["pending","partial"].includes(x.payment_status)).reduce((a, b) => a + Number(b.total_amount || 0), 0);
    const payable = invoices.filter((x) => x.invoice_type === "purchase" && ["pending","partial"].includes(x.payment_status)).reduce((a, b) => a + Number(b.total_amount || 0), 0);
    const unreconciled = tx.filter((x) => x.status === "paid" && !x.reconciled).length + bank.filter((x) => !x.reconciled).length;
    const taxSoon = tax.filter((x) => !["paid","filed"].includes(x.status) && x.due_date && new Date(x.due_date) <= new Date(Date.now() + 7 * 86400000)).length;
    return [["Por cobrar", money(receivable), receivable ? "warn" : "good"], ["Por pagar", money(payable), payable ? "warn" : "good"], ["Sin conciliar", unreconciled, unreconciled ? "warn" : "good"], ["Tributos ≤7 días", taxSoon, taxSoon ? "warn" : "good"], ["Facturas", invoices.length, ""]];
  }

  async function contractMetrics() {
    const [contracts, po, quotes, deadlines] = await Promise.all([rows("company_contracts"), rows("company_purchase_orders"), rows("company_quotations"), rows("company_deadlines")]);
    const in30 = new Date(Date.now() + 30 * 86400000);
    const expiring = contracts.filter((x) => x.end_date && new Date(x.end_date) <= in30 && ["active","signed"].includes(x.status));
    const poLate = po.filter((x) => x.expected_date && new Date(x.expected_date) < new Date() && !["completed","cancelled"].includes(x.status));
    return [["Contratos", contracts.length, ""], ["Vencen ≤30 días", expiring.length, expiring.length ? "warn" : "good"], ["OC", po.length, ""], ["OC atrasadas", poLate.length, poLate.length ? "warn" : "good"], ["Cotizaciones", quotes.length, ""], ["Vencimientos", deadlines.filter((x) => x.status === "open").length, ""]];
  }

  async function peopleMetrics() {
    const [parties, employees] = await Promise.all([rows("company_parties"), rows("company_employees")]);
    const clients = parties.filter((x) => (x.roles || []).includes("client"));
    const suppliers = parties.filter((x) => (x.roles || []).includes("supplier"));
    const ending = employees.filter((x) => x.status === "active" && x.end_date && new Date(x.end_date) <= new Date(Date.now() + 30 * 86400000));
    return [["Clientes", clients.length, ""], ["Proveedores", suppliers.length, ""], ["RR.HH. activo", employees.filter((x) => x.status === "active").length, ""], ["Contratos RR.HH. ≤30 días", ending.length, ending.length ? "warn" : "good"]];
  }

  async function metricsFor(title) {
    const t = norm(title);
    if (t.includes("proyecto")) return projectMetrics();
    if (t.includes("activo") || t.includes("inventario")) return inventoryMetrics();
    if (t.includes("postventa") || t.includes("garantia") || t.includes("servicio")) return postSaleMetrics();
    if (t.includes("archivo") || t.includes("documento")) return fileMetrics();
    if (t.includes("tesorer") || t.includes("tribut") || t.includes("factura") || t.includes("banc")) return financeMetrics();
    if (t.includes("contrato") || t.includes("orden") || t.includes("cotizacion") || t.includes("vencimiento")) return contractMetrics();
    if (t.includes("cliente") || t.includes("proveedor") || t.includes("rr.hh") || t.includes("personal")) return peopleMetrics();
    return [];
  }

  function promptFor(title) {
    const t = norm(title);
    if (t.includes("proyecto")) return "Analiza la sección Proyectos sincronizada. Detecta rectificación, facturación pendiente, inventario interno, postventa y condiciones de cierre total.";
    if (t.includes("inventario") || t.includes("activo")) return "Analiza el inventario empresarial y separa el inventario interno de cada proyecto. Detecta faltantes, asignaciones, garantías y movimientos que requieran gestión.";
    if (t.includes("postventa") || t.includes("garantia")) return "Analiza Postventa y Garantías. Revisa cobertura base de 3 meses, extensiones a 6 meses, casos, activos, facturas, clientes y vencimientos.";
    if (t.includes("archivo") || t.includes("documento")) return "Analiza Archivo empresarial. Usa los documentos leídos por MIRA, revisa categorías, vínculos con proyectos/clientes, vencimientos y documentación faltante.";
    if (t.includes("tesorer") || t.includes("tribut") || t.includes("factura")) return "Analiza esta sección financiera con facturas, tesorería, conciliación, IVA/F29, proyectos y vencimientos sincronizados.";
    return `Analiza la sección ${title} con toda la información empresarial sincronizada y dime qué gestiones puedes ejecutar.`;
  }

  async function enhance() {
    const main = document.getElementById("main-content");
    const title = document.getElementById("view-title")?.textContent?.trim() || "";
    if (!main || !title || main.querySelector(".loading-orb")) return;
    if (["MIRA Business","Agente Auditor","Agente Financiero"].includes(title)) return;
    if (main.querySelector("#ss4-section-sync")) return;
    const metrics = await metricsFor(title);
    const wrap = document.createElement("div");
    wrap.id = "ss4-section-sync";
    wrap.className = "ss4-wrap";
    wrap.innerHTML = `<div class="ss4-bar"><div class="ss4-left"><span class="ss4-dot"></span><strong>Sincronizado con MIRA</strong><small>${lastSync ? `Último cambio ${lastSync.toLocaleTimeString("es-CL", {hour:"2-digit",minute:"2-digit"})}` : "Contexto empresarial conectado"}</small></div><div class="ss4-actions"><button class="ss4-btn" data-ss4-refresh>Actualizar</button><button class="ss4-btn" data-ss4-mira><i class="ri-sparkling-2-line"></i> Gestionar con MIRA</button></div></div>${metrics.length ? `<div class="ss4-kpis">${metrics.map(([label,value,kind]) => `<div class="ss4-kpi ${kind ? `ss4-${kind}` : ""}"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join("")}</div>` : ""}`;
    main.prepend(wrap);
    wrap.querySelector("[data-ss4-refresh]").onclick = () => { wrap.remove(); enhance(); };
    wrap.querySelector("[data-ss4-mira]").onclick = () => askMira(promptFor(title));
  }

  function schedule() { clearTimeout(timer); timer = setTimeout(() => enhance().catch(() => {}), 180); }
  styles();
  const main = document.getElementById("main-content"); if (main) new MutationObserver(schedule).observe(main, { childList: true, subtree: false });
  window.addEventListener("innova-business-sync", (event) => { lastSync = event.detail?.at ? new Date(event.detail.at) : new Date(); const existing = document.getElementById("ss4-section-sync"); if (existing) existing.remove(); schedule(); });
  window.addEventListener("innova-enterprise-ready", schedule);
  document.addEventListener("click", (event) => { const nav = event.target.closest?.("#side-nav .nav-item"); if (nav) setTimeout(schedule, 260); });
  schedule();
})();
