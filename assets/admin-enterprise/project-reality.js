(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  if (params.get("safe") === "1") return;

  const cfg = window.INNOVA_ADMIN_CONFIG;
  if (!cfg || !window.supabase) return;

  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  let profile = null;
  let session = null;
  let currentProjectId = null;
  let aiSuggestions = [];

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[c]));
  const money = (value) => new Intl.NumberFormat("es-CL", {
    style: "currency", currency: "CLP", maximumFractionDigits: 0,
  }).format(Number(value || 0));
  const dateCL = (value, withTime = false) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat("es-CL", withTime
      ? { dateStyle: "medium", timeStyle: "short" }
      : { dateStyle: "medium" }).format(d);
  };
  const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const normalizeRut = (value = "") => String(value).toUpperCase().replace(/[^0-9K]/g, "");
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const safeName = (name = "archivo") => String(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120);

  const labels = {
    commercial_status: {
      prospect: "Prospecto", quoted: "Cotizado", contracted: "Contratado", closed: "Cerrado", cancelled: "Cancelado",
    },
    execution_status: {
      not_started: "No iniciado", procurement: "Compras / gestión", in_progress: "En ejecución", service_completed: "Servicio realizado", completed: "Terminado", paused: "Pausado",
    },
    financial_status: {
      not_invoiced: "No facturado", partially_invoiced: "Facturación parcial", invoiced: "Facturado", partially_collected: "Cobro parcial", collected: "Cobrado",
    },
    delivery_status: {
      not_applicable: "No aplica", pending: "Entrega pendiente", partial: "Entrega parcial", delivered: "Entregado",
    },
    quotation_status: {
      draft: "Borrador", sent: "Enviada", received: "Recibida", approved: "Aprobada / comprometida", rejected: "Rechazada", expired: "Vencida", invoiced: "Facturada",
    },
    transaction_status: {
      pending: "Pendiente", partial: "Parcial", paid: "Pagado", cancelled: "Cancelado",
    },
    event_type: {
      note: "Nota", payment_received: "Pago recibido", payment_made: "Pago realizado", invoice_planned: "Factura pendiente", invoice_issued: "Factura emitida",
      quote_received: "Cotización recibida", quote_approved: "Cotización aprobada", purchase_order: "Orden de compra", service_started: "Servicio iniciado",
      service_completed: "Servicio realizado", goods_ordered: "Productos solicitados", goods_received: "Productos recibidos", delivery_pending: "Entrega pendiente",
      delivery_completed: "Entrega realizada", tax_obligation: "Obligación tributaria", meeting: "Reunión", incident: "Incidencia", scope_change: "Cambio de alcance", other: "Otro",
    },
  };

  const canProjectWrite = () => ["superadmin", "admin", "project_manager"].includes(profile?.role);
  const canFinanceWrite = () => ["superadmin", "admin", "finance"].includes(profile?.role);
  const main = () => document.getElementById("main-content");

  function toast(message, type = "success") {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => el.remove(), 4800);
  }

  function injectStyles() {
    if (document.getElementById("project-reality-styles")) return;
    const style = document.createElement("style");
    style.id = "project-reality-styles";
    style.textContent = `
      .reality-hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:22px}.reality-hero h2{margin:0 0 6px;font-size:1.65rem}.reality-hero p{margin:0;color:var(--muted)}
      .reality-project-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:18px}.reality-card{background:#fff;border:1px solid var(--line);border-radius:22px;padding:20px;box-shadow:0 8px 28px rgba(33,48,90,.05)}
      .reality-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.reality-card h3{margin:0;font-size:1.1rem}.reality-status-row{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0}.reality-chip{font-size:.72rem;font-weight:700;padding:6px 9px;border-radius:999px;background:#f1f4ff;color:#3d55a4;border:1px solid #e0e6ff}.reality-chip.warn{background:#fff6de;color:#9a6400;border-color:#ffe6ad}.reality-chip.ok{background:#e9fbf1;color:#087443;border-color:#c9f1dc}
      .reality-money-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0}.reality-money{background:#f7f9fd;border:1px solid #edf0f7;border-radius:14px;padding:11px}.reality-money small{display:block;color:var(--muted);font-size:.73rem}.reality-money strong{display:block;margin-top:4px;font-size:1rem;color:#0d2149}.reality-money.emphasis{background:#eef4ff;border-color:#dce7ff}
      .reality-section{background:#fff;border:1px solid var(--line);border-radius:20px;margin-top:18px;overflow:hidden}.reality-section-head{padding:16px 18px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:12px}.reality-section-head h3{margin:0;font-size:1rem}.reality-section-body{padding:18px}.reality-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px}.reality-kpi{padding:14px;border:1px solid var(--line);border-radius:16px;background:#fff}.reality-kpi span{display:block;color:var(--muted);font-size:.75rem}.reality-kpi strong{display:block;margin-top:5px;font-size:1.05rem}.reality-kpi.positive strong{color:#087443}.reality-kpi.negative strong{color:#ad3030}
      .reality-status-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}.reality-status-form label{display:flex;flex-direction:column;gap:6px;font-size:.78rem;font-weight:600;color:#52627e}.reality-status-form select,.reality-status-form input,.reality-status-form textarea,.reality-input{border:1px solid var(--line);border-radius:12px;padding:10px 11px;background:#fff;color:var(--text);font:inherit}.reality-status-form textarea{min-height:90px;resize:vertical}.reality-full{grid-column:1/-1}
      .reality-ai-box{background:linear-gradient(135deg,#101c42,#241b55);color:#fff;border-radius:20px;padding:20px}.reality-ai-box h3{margin:0 0 5px}.reality-ai-box p{color:#c7d0ee;margin:0 0 14px}.reality-ai-box textarea{width:100%;min-height:120px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#fff;border-radius:14px;padding:13px;resize:vertical}.reality-ai-box textarea::placeholder{color:#aeb9da}.reality-ai-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:10px}.reality-ai-result{margin-top:14px;display:grid;gap:8px}.reality-suggestion{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.13);border-radius:12px;padding:10px 12px;display:flex;gap:10px;align-items:flex-start}.reality-suggestion input{margin-top:3px}.reality-suggestion strong{display:block;font-size:.86rem}.reality-suggestion small{color:#bdc7e7;display:block;margin-top:3px}
      .reality-list{display:grid;gap:8px}.reality-row{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(100px,.7fr) minmax(110px,.7fr) auto;gap:10px;align-items:center;padding:11px 12px;border:1px solid var(--line);border-radius:14px}.reality-row small{display:block;color:var(--muted)}.reality-actions{display:flex;gap:6px;justify-content:flex-end}.reality-empty{padding:28px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:14px}
      .reality-timeline{display:grid;gap:0}.reality-timeline-item{position:relative;padding:0 0 18px 28px}.reality-timeline-item:before{content:"";position:absolute;left:7px;top:16px;bottom:-3px;width:1px;background:#dfe5f2}.reality-timeline-item:last-child:before{display:none}.reality-timeline-dot{position:absolute;left:0;top:4px;width:15px;height:15px;border-radius:50%;background:#5367ff;border:3px solid #eaf0ff}.reality-timeline-item strong{display:block}.reality-timeline-item p{margin:4px 0;color:#4f5f78;font-size:.86rem}.reality-timeline-item small{color:var(--muted)}
      .reality-form-message{margin-top:8px;font-size:.8rem;color:var(--muted)}.reality-form-message.error{color:#b22b2b}.reality-form-message.ok{color:#087443}.reality-help{font-size:.78rem;color:var(--muted);line-height:1.45}.reality-table{width:100%;border-collapse:collapse}.reality-table th,.reality-table td{padding:10px 9px;border-bottom:1px solid var(--line);text-align:left;font-size:.82rem}.reality-table th{font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
      @media(max-width:760px){.reality-hero{flex-direction:column}.reality-row{grid-template-columns:1fr}.reality-actions{justify-content:flex-start}.reality-money-grid{grid-template-columns:1fr}.reality-ai-actions{justify-content:stretch;flex-direction:column}.reality-ai-actions .btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  async function ensureAuth() {
    if (!session) {
      const { data } = await client.auth.getSession();
      session = data?.session || null;
    }
    if (!session?.user) return false;
    if (!profile) {
      const { data } = await client.from("company_users")
        .select("user_id,email,full_name,role,status")
        .eq("user_id", session.user.id)
        .maybeSingle();
      profile = data || null;
    }
    return !!profile && profile.status === "active";
  }

  function setTitle(title) {
    const node = document.getElementById("view-title");
    if (node) node.textContent = title;
  }

  function clearActiveNav() {
    document.querySelectorAll("#side-nav .nav-item").forEach((el) => el.classList.remove("active"));
  }

  function ensureNavItem() {
    const nav = document.getElementById("side-nav");
    if (!nav || document.getElementById("project-reality-nav")) return;
    const button = document.createElement("button");
    button.id = "project-reality-nav";
    button.className = "nav-item";
    button.type = "button";
    button.innerHTML = '<i class="ri-pulse-line"></i><span>Operación y gastos</span>';

    const labelsInNav = [...nav.querySelectorAll(".nav-label")];
    const financeLabel = labelsInNav.find((el) => /FINANZAS/i.test(el.textContent || ""));
    if (financeLabel) financeLabel.insertAdjacentElement("afterend", button);
    else nav.appendChild(button);
  }

  function modal(title, body, footer = "") {
    const root = document.getElementById("modal-root");
    if (!root) return;
    root.innerHTML = `<div class="modal-backdrop" data-reality-backdrop><div class="modal"><div class="modal-head"><h2>${esc(title)}</h2><button class="mini-btn" data-reality-close><i class="ri-close-line"></i></button></div><div class="modal-body">${body}</div>${footer ? `<div class="modal-foot">${footer}</div>` : ""}</div></div>`;
    root.querySelector("[data-reality-close]")?.addEventListener("click", closeModal);
    root.querySelector("[data-reality-backdrop]")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeModal();
    });
  }

  function closeModal() {
    const root = document.getElementById("modal-root");
    if (root) root.innerHTML = "";
  }

  function statusChip(text, kind = "") {
    return `<span class="reality-chip ${kind}">${esc(text)}</span>`;
  }

  function statusSelect(name, map, value) {
    return `<select name="${esc(name)}">${Object.entries(map).map(([key, label]) => `<option value="${esc(key)}" ${key === value ? "selected" : ""}>${esc(label)}</option>`).join("")}</select>`;
  }

  async function renderOperations() {
    if (!(await ensureAuth())) return;
    currentProjectId = null;
    setTitle("Operación y gastos");
    clearActiveNav();
    document.getElementById("project-reality-nav")?.classList.add("active");
    const target = main();
    if (!target) return;
    target.innerHTML = '<div class="empty-state"><div class="loading-orb" style="margin:auto;width:38px;height:38px"></div><p>Conectando operación, proyectos y finanzas…</p></div>';

    const [{ data: summaries, error }, { data: projects }] = await Promise.all([
      client.from("company_project_financial_summary").select("*").order("title"),
      client.from("company_projects").select("id,title,client_name,commercial_status,execution_status,financial_status,delivery_status,contracted_amount,expected_invoice_count,operational_notes").order("updated_at", { ascending: false }),
    ]);
    if (error) {
      target.innerHTML = `<div class="panel"><div class="empty-state"><strong>No se pudo cargar la operación</strong><p>${esc(error.message)}</p></div></div>`;
      return;
    }
    const byId = new Map((projects || []).map((p) => [p.id, p]));
    const rows = summaries || [];
    const totalCollected = rows.reduce((sum, x) => sum + Number(x.collected || 0), 0);
    const totalCommitted = rows.reduce((sum, x) => sum + Number(x.committed_expense || 0), 0);
    const totalPaidExpense = rows.reduce((sum, x) => sum + Number(x.expense_paid || 0), 0);
    const vatBalance = rows.reduce((sum, x) => sum + Number(x.vat_balance || 0), 0);

    target.innerHTML = `
      <div class="reality-hero"><div><h2>Operación real de la empresa</h2><p>Separa lo contratado, ejecutado, facturado, cobrado, comprado, pagado y entregado. Las cotizaciones de proveedores no mueven caja hasta convertirse en gasto/pago.</p></div></div>
      <div class="reality-kpi-grid">
        <div class="reality-kpi positive"><span>Cobrado en proyectos</span><strong>${money(totalCollected)}</strong></div>
        <div class="reality-kpi"><span>Gasto comprometido</span><strong>${money(totalCommitted)}</strong></div>
        <div class="reality-kpi negative"><span>Gasto pagado</span><strong>${money(totalPaidExpense)}</strong></div>
        <div class="reality-kpi"><span>IVA estimado neto</span><strong>${money(vatBalance)}</strong></div>
      </div>
      <div class="reality-project-grid" style="margin-top:18px">
        ${rows.length ? rows.map((s) => {
          const p = byId.get(s.project_id) || {};
          const pendingDelivery = s.delivery_status === "pending" || s.delivery_status === "partial";
          const remainingInvoices = Number(s.remaining_invoice_count || 0);
          return `<article class="reality-card">
            <div class="reality-card-head"><div><h3>${esc(s.title)}</h3><small class="muted">${esc(p.client_name || "Proyecto interno")}</small></div><button class="btn outline reality-open-project" data-id="${esc(s.project_id)}">Abrir operación</button></div>
            <div class="reality-status-row">
              ${statusChip(labels.execution_status[s.execution_status] || s.execution_status)}
              ${statusChip(labels.financial_status[s.financial_status] || s.financial_status, s.financial_status === "collected" ? "ok" : "")}
              ${statusChip(labels.delivery_status[s.delivery_status] || s.delivery_status, pendingDelivery ? "warn" : s.delivery_status === "delivered" ? "ok" : "")}
              ${remainingInvoices ? statusChip(`${remainingInvoices} factura${remainingInvoices === 1 ? "" : "s"} por emitir`, "warn") : ""}
            </div>
            <div class="reality-money-grid">
              <div class="reality-money emphasis"><small>Contratado</small><strong>${money(Number(s.contracted_amount || 0) || Number(s.budget || 0))}</strong></div>
              <div class="reality-money"><small>Cobrado</small><strong>${money(s.collected)}</strong></div>
              <div class="reality-money"><small>Cotizado proveedor</small><strong>${money(s.supplier_quoted)}</strong></div>
              <div class="reality-money"><small>Gasto pagado</small><strong>${money(s.expense_paid)}</strong></div>
            </div>
            <small class="muted">Margen de caja actual: <strong>${money(s.cash_margin)}</strong> · IVA estimado: <strong>${money(s.vat_balance)}</strong></small>
          </article>`;
        }).join("") : '<div class="reality-empty">No hay proyectos registrados.</div>'}
      </div>`;

    target.querySelectorAll(".reality-open-project").forEach((button) => button.addEventListener("click", () => renderProjectReality(button.dataset.id)));
  }

  async function getProjectBundle(projectId) {
    const [projectR, summaryR, eventsR, quotesR, txR, invoicesR, poR] = await Promise.all([
      client.from("company_projects").select("*").eq("id", projectId).single(),
      client.from("company_project_financial_summary").select("*").eq("project_id", projectId).single(),
      client.from("company_project_events").select("*").eq("project_id", projectId).order("event_date", { ascending: false }).limit(100),
      client.from("company_quotations").select("*").eq("project_id", projectId).eq("direction", "purchase").order("created_at", { ascending: false }),
      client.from("company_transactions").select("*").eq("project_id", projectId).order("transaction_date", { ascending: false }).limit(100),
      client.from("company_invoices").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      client.from("company_purchase_orders").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    ]);
    if (projectR.error) throw projectR.error;
    return {
      project: projectR.data,
      summary: summaryR.data || {},
      events: eventsR.data || [],
      quotes: quotesR.data || [],
      transactions: txR.data || [],
      invoices: invoicesR.data || [],
      purchaseOrders: poR.data || [],
    };
  }

  async function renderProjectReality(projectId) {
    if (!(await ensureAuth())) return;
    currentProjectId = projectId;
    setTitle("Operación del proyecto");
    clearActiveNav();
    document.getElementById("project-reality-nav")?.classList.add("active");
    const target = main();
    if (!target) return;
    target.innerHTML = '<div class="empty-state"><div class="loading-orb" style="margin:auto;width:38px;height:38px"></div><p>Cargando realidad del proyecto…</p></div>';
    let bundle;
    try {
      bundle = await getProjectBundle(projectId);
    } catch (error) {
      target.innerHTML = `<div class="panel"><div class="empty-state"><strong>No se pudo cargar el proyecto</strong><p>${esc(error.message)}</p></div></div>`;
      return;
    }
    const { project, summary, events, quotes, transactions, invoices } = bundle;
    const expected = Number(project.expected_invoice_count || 0);
    const issued = invoices.filter((i) => i.invoice_type === "sale" && i.payment_status !== "void").length;
    const remaining = Math.max(0, expected - issued);
    const timeline = [
      ...events.map((e) => ({ date: e.event_date, title: e.title, text: e.description || labels.event_type[e.event_type] || e.event_type, type: labels.event_type[e.event_type] || e.event_type })),
      ...invoices.map((i) => ({ date: i.issue_date || i.created_at, title: `Factura ${i.folio || "sin folio"}`, text: `${i.invoice_type === "purchase" ? "Compra" : "Venta"} · ${money(i.total_amount)} · ${labels.transaction_status[i.payment_status] || i.payment_status}`, type: "Factura" })),
      ...quotes.map((q) => ({ date: q.issue_date || q.created_at, title: `Cotización proveedor ${q.quote_number}`, text: `${q.client_name} · ${money(q.total_amount)} · ${labels.quotation_status[q.status] || q.status}`, type: "Cotización proveedor" })),
      ...transactions.map((t) => ({ date: t.transaction_date || t.created_at, title: t.description || (t.direction === "expense" ? "Gasto" : "Ingreso"), text: `${t.direction === "expense" ? "Salida" : "Entrada"} · ${money(t.amount)} · ${labels.transaction_status[t.status] || t.status}`, type: "Tesorería" })),
    ].filter((x) => x.date).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 60);

    target.innerHTML = `
      <div class="reality-hero"><div><button id="reality-back" class="btn ghost" style="margin-bottom:10px"><i class="ri-arrow-left-line"></i> Todos los proyectos</button><h2>${esc(project.title)}</h2><p>${esc(project.client_name || "Proyecto interno")} · expediente financiero y operacional conectado.</p></div><div class="button-row">${canFinanceWrite() ? '<button id="reality-new-quote" class="btn outline"><i class="ri-file-add-line"></i> Cotización proveedor</button><button id="reality-new-transaction" class="btn primary"><i class="ri-money-dollar-circle-line"></i> Registrar movimiento</button>' : ""}</div></div>
      <div class="reality-kpi-grid">
        <div class="reality-kpi"><span>Contratado</span><strong>${money(Number(summary.contracted_amount || 0) || Number(summary.budget || 0))}</strong></div>
        <div class="reality-kpi"><span>Facturado al cliente</span><strong>${money(summary.sale_billed)}</strong></div>
        <div class="reality-kpi positive"><span>Cobrado</span><strong>${money(summary.collected)}</strong></div>
        <div class="reality-kpi"><span>Facturas emitidas / esperadas</span><strong>${issued} / ${expected || "—"}</strong></div>
        <div class="reality-kpi"><span>Cotizado proveedores</span><strong>${money(summary.supplier_quoted)}</strong></div>
        <div class="reality-kpi"><span>Comprometido</span><strong>${money(summary.committed_expense)}</strong></div>
        <div class="reality-kpi negative"><span>Gasto pagado</span><strong>${money(summary.expense_paid)}</strong></div>
        <div class="reality-kpi"><span>IVA débito - crédito</span><strong>${money(summary.vat_balance)}</strong></div>
        <div class="reality-kpi ${Number(summary.cash_margin || 0) >= 0 ? "positive" : "negative"}"><span>Margen de caja actual</span><strong>${money(summary.cash_margin)}</strong></div>
      </div>
      ${remaining ? `<div class="reality-section"><div class="reality-section-body"><div class="reality-chip warn"><i class="ri-alert-line"></i> Queda${remaining === 1 ? "" : "n"} ${remaining} factura${remaining === 1 ? "" : "s"} por emitir según la planificación del proyecto.</div></div></div>` : ""}

      <section class="reality-section"><div class="reality-section-head"><h3>Estado real del proyecto</h3>${canProjectWrite() ? '<button id="reality-save-status" class="btn primary">Guardar estado</button>' : ""}</div><div class="reality-section-body">
        <form id="reality-status-form" class="reality-status-form">
          <label>Estado comercial${statusSelect("commercial_status", labels.commercial_status, project.commercial_status)}</label>
          <label>Ejecución${statusSelect("execution_status", labels.execution_status, project.execution_status)}</label>
          <label>Financiero${statusSelect("financial_status", labels.financial_status, project.financial_status)}</label>
          <label>Entrega${statusSelect("delivery_status", labels.delivery_status, project.delivery_status)}</label>
          <label>Monto contratado<input name="contracted_amount" type="number" min="0" value="${Number(project.contracted_amount || 0)}"></label>
          <label>Facturas esperadas<input name="expected_invoice_count" type="number" min="0" step="1" value="${Number(project.expected_invoice_count || 0)}"></label>
          <label class="reality-full">Contexto operacional<textarea name="operational_notes" placeholder="Qué está pendiente, qué se compró, qué falta entregar…">${esc(project.operational_notes || "")}</textarea></label>
        </form>
      </div></section>

      <section class="reality-section"><div class="reality-section-body"><div class="reality-ai-box">
        <h3>Bitácora con MIRA Business</h3><p>Escribe lo que está pasando en lenguaje normal. MIRA propondrá cambios, eventos o movimientos; nada se guarda hasta que tú lo confirmes.</p>
        <textarea id="reality-ai-text" placeholder="Ej.: Ya recibimos el pago. Aún no entregamos las tablets porque estamos esperando la compra al proveedor. Se pagaron $1.200.000 de despacho…"></textarea>
        <div class="reality-ai-actions"><button id="reality-ai-note" class="btn ghost">Guardar solo como nota</button><button id="reality-ai-analyze" class="btn primary"><i class="ri-sparkling-2-line"></i> Analizar y proponer</button></div>
        <div id="reality-ai-result" class="reality-ai-result"></div>
      </div></div></section>

      <section class="reality-section"><div class="reality-section-head"><h3>Cotizaciones de proveedores</h3>${canFinanceWrite() ? '<button id="reality-new-quote-2" class="btn outline"><i class="ri-add-line"></i> Agregar</button>' : ""}</div><div class="reality-section-body">
        ${quotes.length ? `<div class="reality-list">${quotes.map((q) => `<div class="reality-row"><div><strong>${esc(q.client_name)}</strong><small>${esc(q.quote_number)} · ${esc(dateCL(q.issue_date))}</small></div><div><strong>${money(q.total_amount)}</strong><small>${esc(labels.quotation_status[q.status] || q.status)}</small></div><div><small>${q.status === "approved" ? "Cuenta como gasto comprometido" : "Aún no mueve caja"}</small></div><div class="reality-actions">${q.source_file_id ? `<button class="mini-btn reality-open-quote-file" data-file="${q.source_file_id}" title="Ver respaldo"><i class="ri-file-line"></i></button>` : ""}${canFinanceWrite() && q.status !== "approved" && !["rejected","expired"].includes(q.status) ? `<button class="mini-btn reality-quote-approve" data-id="${q.id}" title="Aprobar / comprometer"><i class="ri-check-line"></i></button>` : ""}${canFinanceWrite() && !["rejected","invoiced"].includes(q.status) ? `<button class="mini-btn reality-quote-reject" data-id="${q.id}" title="Rechazar"><i class="ri-close-line"></i></button>` : ""}</div></div>`).join("")}</div>` : '<div class="reality-empty">Todavía no hay cotizaciones de proveedores. Al agregarlas podrás comparar lo cotizado con lo realmente gastado.</div>'}
      </div></section>

      <section class="reality-section"><div class="reality-section-head"><h3>Tesorería del proyecto</h3>${canFinanceWrite() ? '<button id="reality-new-transaction-2" class="btn outline"><i class="ri-add-line"></i> Registrar</button>' : ""}</div><div class="reality-section-body">
        ${transactions.length ? `<div class="reality-list">${transactions.map((t) => `<div class="reality-row"><div><strong>${esc(t.description || (t.direction === "expense" ? "Gasto" : "Ingreso"))}</strong><small>${esc(dateCL(t.transaction_date))}</small></div><div><strong>${money(t.amount)}</strong><small>${t.direction === "expense" ? "Salida" : "Entrada"}</small></div><div><span class="reality-chip ${t.status === "paid" ? "ok" : "warn"}">${esc(labels.transaction_status[t.status] || t.status)}</span></div><div class="reality-actions">${t.source_file_id ? `<button class="mini-btn reality-open-tx-file" data-file="${t.source_file_id}" title="Ver respaldo"><i class="ri-file-line"></i></button>` : ""}</div></div>`).join("")}</div>` : '<div class="reality-empty">Sin movimientos. Las facturas pagadas aparecen automáticamente; también puedes registrar gastos o pagos sin factura.</div>'}
      </div></section>

      <section class="reality-section"><div class="reality-section-head"><h3>Línea de tiempo empresarial</h3>${canProjectWrite() || canFinanceWrite() ? '<button id="reality-new-event" class="btn outline"><i class="ri-add-line"></i> Agregar evento</button>' : ""}</div><div class="reality-section-body"><div class="reality-timeline">
        ${timeline.length ? timeline.map((item) => `<div class="reality-timeline-item"><span class="reality-timeline-dot"></span><strong>${esc(item.title)}</strong><p>${esc(item.text || "")}</p><small>${esc(item.type)} · ${esc(dateCL(item.date, true))}</small></div>`).join("") : '<div class="reality-empty">Todavía no hay actividad registrada.</div>'}
      </div></div></section>
    `;

    document.getElementById("reality-back")?.addEventListener("click", renderOperations);
    document.getElementById("reality-save-status")?.addEventListener("click", () => saveProjectStatus(projectId));
    document.getElementById("reality-new-quote")?.addEventListener("click", () => openSupplierQuote(projectId));
    document.getElementById("reality-new-quote-2")?.addEventListener("click", () => openSupplierQuote(projectId));
    document.getElementById("reality-new-transaction")?.addEventListener("click", () => openTransaction(projectId));
    document.getElementById("reality-new-transaction-2")?.addEventListener("click", () => openTransaction(projectId));
    document.getElementById("reality-new-event")?.addEventListener("click", () => openEvent(projectId));
    document.getElementById("reality-ai-analyze")?.addEventListener("click", () => analyzeNarrative(bundle));
    document.getElementById("reality-ai-note")?.addEventListener("click", () => saveNarrativeAsNote(projectId));
    target.querySelectorAll(".reality-quote-approve").forEach((button) => button.addEventListener("click", () => updateQuoteStatus(button.dataset.id, "approved", projectId)));
    target.querySelectorAll(".reality-quote-reject").forEach((button) => button.addEventListener("click", () => updateQuoteStatus(button.dataset.id, "rejected", projectId)));
    target.querySelectorAll(".reality-open-quote-file,.reality-open-tx-file").forEach((button) => button.addEventListener("click", () => openFileById(button.dataset.file)));
  }

  async function saveProjectStatus(projectId) {
    if (!canProjectWrite()) return toast("No tienes permisos para cambiar el estado del proyecto.", "warning");
    const form = document.getElementById("reality-status-form");
    if (!form) return;
    const fd = new FormData(form);
    const payload = {
      commercial_status: String(fd.get("commercial_status")),
      execution_status: String(fd.get("execution_status")),
      financial_status: String(fd.get("financial_status")),
      delivery_status: String(fd.get("delivery_status")),
      contracted_amount: Number(fd.get("contracted_amount") || 0),
      expected_invoice_count: Math.max(0, Number(fd.get("expected_invoice_count") || 0)),
      operational_notes: String(fd.get("operational_notes") || "").trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await client.from("company_projects").update(payload).eq("id", projectId);
    if (error) return toast(error.message, "error");
    toast("Estado real del proyecto actualizado.");
    await renderProjectReality(projectId);
  }

  async function hashFile(file) {
    if (!crypto?.subtle) return null;
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function saveFile(file, projectId, category, title) {
    if (!file) return null;
    const hash = await hashFile(file).catch(() => null);
    if (hash) {
      const { data: existing } = await client.from("company_files").select("id").eq("sha256", hash).limit(1).maybeSingle();
      if (existing?.id) return existing.id;
    }
    const { data: authData } = await client.auth.getSession();
    const userId = authData?.session?.user?.id;
    if (!userId) throw new Error("Sesión no disponible");
    const path = `${userId}/${projectId || "general"}/${new Date().getFullYear()}/${category}/${uuid()}-${safeName(file.name)}`;
    const upload = await client.storage.from(cfg.storageBucket).upload(path, file, {
      contentType: file.type || "application/octet-stream", upsert: false,
    });
    if (upload.error) throw upload.error;
    const inserted = await client.from("company_files").insert({
      project_id: projectId || null,
      category,
      title: title || file.name,
      original_name: file.name,
      storage_path: path,
      mime_type: file.type || null,
      file_size: file.size,
      sha256: hash,
      created_by: userId,
      metadata: { source: "project_reality" },
    }).select("id").single();
    if (inserted.error) {
      await client.storage.from(cfg.storageBucket).remove([path]);
      throw inserted.error;
    }
    return inserted.data.id;
  }

  async function openFileById(fileId) {
    if (!fileId) return;
    const { data: row, error } = await client.from("company_files").select("storage_path").eq("id", fileId).single();
    if (error || !row?.storage_path) return toast(error?.message || "Archivo no disponible", "error");
    const signed = await client.storage.from(cfg.storageBucket).createSignedUrl(row.storage_path, 3600);
    if (signed.error) return toast(signed.error.message, "error");
    window.open(signed.data.signedUrl, "_blank", "noopener");
  }

  async function getOrCreateSupplier(name, rut) {
    const normalized = normalizeRut(rut);
    if (normalized) {
      const { data: existing } = await client.from("company_parties").select("id,roles").eq("rut_normalized", normalized).maybeSingle();
      if (existing?.id) {
        const roles = Array.isArray(existing.roles) ? existing.roles : [];
        if (!roles.includes("supplier")) await client.from("company_parties").update({ roles: [...roles, "supplier"] }).eq("id", existing.id);
        return existing.id;
      }
    }
    const inserted = await client.from("company_parties").insert({
      name,
      rut: rut || null,
      roles: ["supplier"],
      active: true,
      metadata: { source: "project_reality" },
      created_by: session?.user?.id || null,
    }).select("id").single();
    if (inserted.error) throw inserted.error;
    return inserted.data.id;
  }

  function openSupplierQuote(projectId) {
    if (!canFinanceWrite()) return toast("Solo administración o finanzas puede registrar cotizaciones de proveedores.", "warning");
    modal("Cotización de proveedor", `
      <form id="supplier-quote-form" class="form-grid">
        <label class="form-field full"><span>Proveedor</span><input name="supplier_name" required placeholder="Empresa o persona que cotiza" /></label>
        <label class="form-field"><span>RUT proveedor</span><input name="supplier_rut" placeholder="12.345.678-9" /></label>
        <label class="form-field"><span>N° cotización</span><input name="quote_number" placeholder="Se genera si queda vacío" /></label>
        <label class="form-field"><span>Fecha</span><input name="issue_date" type="date" value="${todayISO()}" required /></label>
        <label class="form-field"><span>Válida hasta</span><input name="valid_until" type="date" /></label>
        <label class="form-field"><span>Estado</span><select name="status"><option value="received">Recibida / en evaluación</option><option value="approved">Aprobada / comprometida</option><option value="rejected">Rechazada</option></select></label>
        <label class="form-field"><span>Neto</span><input name="net_amount" type="number" min="0" value="0" /></label>
        <label class="form-field"><span>IVA</span><input name="vat_amount" type="number" min="0" value="0" /></label>
        <label class="form-field"><span>Total</span><input name="total_amount" type="number" min="0" value="0" /></label>
        <label class="form-field full"><span>Detalle / qué se compraría</span><textarea name="detail" placeholder="Tablets, despacho, materiales, mano de obra…"></textarea></label>
        <label class="dropzone full" id="supplier-quote-drop"><i class="ri-file-search-line"></i><strong>Adjuntar cotización del proveedor</strong><span>PDF recomendado. MIRA puede leer el texto y proponer los campos.</span><input id="supplier-quote-file" type="file" accept=".pdf,.xml,.txt,.csv,application/pdf,text/plain,text/xml,application/xml,text/csv" /></label>
        <div class="full button-row"><button type="button" id="analyze-supplier-quote" class="btn outline"><i class="ri-sparkling-2-line"></i> Leer archivo con MIRA</button><span id="supplier-quote-message" class="reality-form-message"></span></div>
      </form>`,
      '<button class="btn ghost" data-reality-close-2>Cancelar</button><button class="btn primary" id="save-supplier-quote">Guardar cotización</button>');
    document.querySelector("[data-reality-close-2]")?.addEventListener("click", closeModal);
    const drop = document.getElementById("supplier-quote-drop");
    const input = document.getElementById("supplier-quote-file");
    drop?.addEventListener("click", (event) => { if (event.target !== input) input?.click(); });
    document.getElementById("analyze-supplier-quote")?.addEventListener("click", analyzeSupplierQuoteFile);
    document.getElementById("save-supplier-quote")?.addEventListener("click", () => saveSupplierQuote(projectId));
  }

  async function extractFileText(file) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".pdf") || file.type === "application/pdf") {
      if (!window.pdfjsLib) throw new Error("PDF.js no está disponible");
      const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      let text = "";
      for (let page = 1; page <= Math.min(pdf.numPages, 30); page += 1) {
        const p = await pdf.getPage(page);
        const content = await p.getTextContent();
        text += content.items.map((item) => item.str).join(" ") + "\n";
        if (text.length > 45000) break;
      }
      return text.slice(0, 45000);
    }
    if (/\.(xml|txt|csv)$/i.test(lower) || /text\//i.test(file.type)) return (await file.text()).slice(0, 45000);
    throw new Error("Este formato todavía no permite lectura de texto automática.");
  }

  function parseJsonReply(reply) {
    const text = String(reply || "").replace(/```json/gi, "").replace(/```/g, "").trim();
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first < 0 || last <= first) throw new Error("MIRA no devolvió datos estructurados");
    return JSON.parse(text.slice(first, last + 1));
  }

  async function callMiraJson(message, context = "") {
    const { data: authData } = await client.auth.getSession();
    const token = authData?.session?.access_token;
    if (!token) throw new Error("La sesión expiró");
    const response = await fetch(`${cfg.backendUrl}/api/admin/mira`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message, context, history: [] }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "No fue posible consultar MIRA Business");
    return parseJsonReply(data.reply);
  }

  async function analyzeSupplierQuoteFile() {
    const input = document.getElementById("supplier-quote-file");
    const file = input?.files?.[0];
    const message = document.getElementById("supplier-quote-message");
    if (!file) return toast("Adjunta primero una cotización.", "warning");
    if (message) { message.className = "reality-form-message"; message.textContent = "Leyendo documento…"; }
    try {
      const text = await extractFileText(file);
      const parsed = await callMiraJson(`Analiza esta cotización de proveedor chilena. Devuelve SOLO un JSON válido y sin markdown con estas claves exactas: {"supplier_name":"","supplier_rut":"","quote_number":"","issue_date":"YYYY-MM-DD o vacío","valid_until":"YYYY-MM-DD o vacío","net_amount":0,"vat_amount":0,"total_amount":0,"detail":"resumen breve de productos/servicios"}. No inventes campos que no estén en el documento.`, text.slice(0, 35000));
      const form = document.getElementById("supplier-quote-form");
      if (!form) return;
      ["supplier_name", "supplier_rut", "quote_number", "issue_date", "valid_until", "net_amount", "vat_amount", "total_amount", "detail"].forEach((key) => {
        const field = form.elements[key];
        const value = parsed?.[key];
        if (field && value !== undefined && value !== null && String(value) !== "") field.value = value;
      });
      if (message) { message.className = "reality-form-message ok"; message.textContent = "Datos propuestos desde el archivo. Revísalos antes de guardar."; }
    } catch (error) {
      if (message) { message.className = "reality-form-message error"; message.textContent = error.message; }
    }
  }

  async function saveSupplierQuote(projectId) {
    const form = document.getElementById("supplier-quote-form");
    if (!form) return;
    const button = document.getElementById("save-supplier-quote");
    const fd = new FormData(form);
    const supplierName = String(fd.get("supplier_name") || "").trim();
    if (!supplierName) return toast("Indica el proveedor.", "warning");
    const issueDate = String(fd.get("issue_date") || "") || todayISO();
    const net = Number(fd.get("net_amount") || 0);
    const vat = Number(fd.get("vat_amount") || 0);
    let total = Number(fd.get("total_amount") || 0);
    if (!total && (net || vat)) total = net + vat;
    const quoteNumber = String(fd.get("quote_number") || "").trim() || `CP-${issueDate.replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    button.disabled = true;
    button.textContent = "Guardando…";
    try {
      const partyId = await getOrCreateSupplier(supplierName, String(fd.get("supplier_rut") || "").trim());
      const file = document.getElementById("supplier-quote-file")?.files?.[0] || null;
      const fileId = file ? await saveFile(file, projectId, "quotation", `Cotización proveedor ${quoteNumber}`) : null;
      const detail = String(fd.get("detail") || "").trim();
      const status = String(fd.get("status") || "received");
      const insert = await client.from("company_quotations").insert({
        project_id: projectId,
        quote_number: quoteNumber,
        client_name: supplierName,
        client_rut: String(fd.get("supplier_rut") || "").trim() || null,
        issue_date: issueDate,
        valid_until: String(fd.get("valid_until") || "") || null,
        status,
        items: [{ description: detail || "Cotización de proveedor", quantity: 1, unit_price: net || total }],
        subtotal: net,
        discount: 0,
        net_amount: net,
        vat_rate: vat > 0 ? 19 : 0,
        vat_amount: vat,
        total_amount: total,
        notes: detail || null,
        created_by: session?.user?.id || null,
        direction: "purchase",
        party_id: partyId,
        source_file_id: fileId,
        metadata: { source: "project_reality", lifecycle: status === "approved" ? "committed" : "quoted" },
      });
      if (insert.error) throw insert.error;
      await client.from("company_project_events").insert({
        project_id: projectId,
        event_type: status === "approved" ? "quote_approved" : "quote_received",
        title: `${status === "approved" ? "Cotización aprobada" : "Cotización recibida"}: ${supplierName}`,
        description: `${quoteNumber} · ${money(total)}${detail ? ` · ${detail}` : ""}`,
        amount: total || null,
        direction: "expense",
        status: "confirmed",
        source_file_id: fileId,
        created_by: session?.user?.id || null,
        metadata: { quotation_number: quoteNumber },
      });
      closeModal();
      toast("Cotización de proveedor guardada.");
      await renderProjectReality(projectId);
    } catch (error) {
      toast(error.message || "No se pudo guardar la cotización.", "error");
      button.disabled = false;
      button.textContent = "Guardar cotización";
    }
  }

  async function updateQuoteStatus(id, status, projectId) {
    if (!canFinanceWrite()) return;
    const { data: quote, error } = await client.from("company_quotations").update({ status, updated_at: new Date().toISOString() }).eq("id", id).select("quote_number,client_name,total_amount,source_file_id").single();
    if (error) return toast(error.message, "error");
    await client.from("company_project_events").insert({
      project_id: projectId,
      event_type: status === "approved" ? "quote_approved" : "note",
      title: status === "approved" ? `Cotización comprometida: ${quote.client_name}` : `Cotización rechazada: ${quote.client_name}`,
      description: `${quote.quote_number} · ${money(quote.total_amount)}`,
      amount: Number(quote.total_amount || 0) || null,
      direction: "expense",
      status: "confirmed",
      source_file_id: quote.source_file_id || null,
      created_by: session?.user?.id || null,
      metadata: { quotation_id: id, quotation_status: status },
    });
    toast(status === "approved" ? "Cotización aprobada y marcada como gasto comprometido." : "Cotización rechazada.");
    await renderProjectReality(projectId);
  }

  function openTransaction(projectId) {
    if (!canFinanceWrite()) return toast("Solo administración o finanzas puede registrar movimientos.", "warning");
    modal("Registrar movimiento de tesorería", `
      <form id="reality-transaction-form" class="form-grid">
        <label class="form-field"><span>Tipo</span><select name="direction"><option value="expense">Gasto / salida</option><option value="income">Ingreso / entrada</option></select></label>
        <label class="form-field"><span>Estado</span><select name="status"><option value="paid">Pagado / recibido</option><option value="pending">Pendiente</option><option value="partial">Parcial</option></select></label>
        <label class="form-field"><span>Monto</span><input name="amount" type="number" min="0" required /></label>
        <label class="form-field"><span>Fecha</span><input name="transaction_date" type="date" value="${todayISO()}" required /></label>
        <label class="form-field"><span>Vencimiento</span><input name="due_date" type="date" /></label>
        <label class="form-field"><span>Medio de pago</span><input name="payment_method" placeholder="Transferencia, efectivo…" /></label>
        <label class="form-field full"><span>Descripción</span><textarea name="description" required placeholder="Compra de tablets, despacho, materiales, pago recibido…"></textarea></label>
        <label class="dropzone full" id="reality-transaction-drop"><i class="ri-attachment-2"></i><strong>Adjuntar respaldo</strong><span>Comprobante, orden, recibo u otro documento.</span><input id="reality-transaction-file" type="file" /></label>
        <p class="reality-help full">No dupliques un pago de una factura que ya aparece automáticamente en tesorería. Usa este registro para gastos/pagos reales que todavía no estén representados por una factura sincronizada.</p>
      </form>`,
      '<button class="btn ghost" data-reality-close-2>Cancelar</button><button class="btn primary" id="save-reality-transaction">Guardar movimiento</button>');
    document.querySelector("[data-reality-close-2]")?.addEventListener("click", closeModal);
    const drop = document.getElementById("reality-transaction-drop");
    const input = document.getElementById("reality-transaction-file");
    drop?.addEventListener("click", (event) => { if (event.target !== input) input?.click(); });
    document.getElementById("save-reality-transaction")?.addEventListener("click", () => saveTransaction(projectId));
  }

  async function saveTransaction(projectId) {
    const form = document.getElementById("reality-transaction-form");
    if (!form) return;
    const fd = new FormData(form);
    const amount = Number(fd.get("amount") || 0);
    const description = String(fd.get("description") || "").trim();
    if (amount <= 0 || !description) return toast("Indica monto y descripción.", "warning");
    const button = document.getElementById("save-reality-transaction");
    button.disabled = true;
    button.textContent = "Guardando…";
    try {
      const file = document.getElementById("reality-transaction-file")?.files?.[0] || null;
      const fileId = file ? await saveFile(file, projectId, "payment", description) : null;
      const status = String(fd.get("status") || "paid");
      const direction = String(fd.get("direction") || "expense");
      const insert = await client.from("company_transactions").insert({
        direction,
        project_id: projectId,
        transaction_date: String(fd.get("transaction_date") || todayISO()),
        due_date: String(fd.get("due_date") || "") || null,
        paid_at: status === "paid" ? new Date().toISOString() : null,
        amount,
        status,
        payment_method: String(fd.get("payment_method") || "").trim() || null,
        description,
        source_file_id: fileId,
        reconciled: false,
        metadata: { source: "project_reality", manual: true },
        created_by: session?.user?.id || null,
      });
      if (insert.error) throw insert.error;
      await client.from("company_project_events").insert({
        project_id: projectId,
        event_type: direction === "expense" ? "payment_made" : "payment_received",
        title: description,
        description: `${direction === "expense" ? "Salida" : "Entrada"} ${status === "paid" ? "real" : "pendiente"} por ${money(amount)}.`,
        amount,
        direction,
        status: "confirmed",
        source_file_id: fileId,
        created_by: session?.user?.id || null,
        metadata: { manual_transaction: true },
      });
      closeModal();
      toast("Movimiento registrado.");
      await renderProjectReality(projectId);
    } catch (error) {
      toast(error.message || "No se pudo registrar el movimiento.", "error");
      button.disabled = false;
      button.textContent = "Guardar movimiento";
    }
  }

  function openEvent(projectId) {
    modal("Agregar evento al proyecto", `
      <form id="reality-event-form" class="form-grid">
        <label class="form-field"><span>Tipo</span><select name="event_type">${Object.entries(labels.event_type).map(([key, value]) => `<option value="${key}">${esc(value)}</option>`).join("")}</select></label>
        <label class="form-field"><span>Fecha</span><input name="event_date" type="datetime-local" value="${new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16)}" /></label>
        <label class="form-field full"><span>Título</span><input name="title" required /></label>
        <label class="form-field full"><span>Descripción</span><textarea name="description"></textarea></label>
        <label class="form-field"><span>Monto opcional</span><input name="amount" type="number" min="0" /></label>
        <label class="form-field"><span>Sentido del monto</span><select name="direction"><option value="">No aplica</option><option value="income">Ingreso</option><option value="expense">Gasto</option></select></label>
      </form>`,
      '<button class="btn ghost" data-reality-close-2>Cancelar</button><button class="btn primary" id="save-reality-event">Guardar evento</button>');
    document.querySelector("[data-reality-close-2]")?.addEventListener("click", closeModal);
    document.getElementById("save-reality-event")?.addEventListener("click", async () => {
      const form = document.getElementById("reality-event-form");
      const fd = new FormData(form);
      const title = String(fd.get("title") || "").trim();
      if (!title) return toast("Agrega un título.", "warning");
      const { error } = await client.from("company_project_events").insert({
        project_id: projectId,
        event_type: String(fd.get("event_type") || "note"),
        title,
        description: String(fd.get("description") || "").trim() || null,
        event_date: String(fd.get("event_date") || "") ? new Date(String(fd.get("event_date"))).toISOString() : new Date().toISOString(),
        amount: Number(fd.get("amount") || 0) || null,
        direction: String(fd.get("direction") || "") || null,
        status: "confirmed",
        created_by: session?.user?.id || null,
        metadata: { source: "manual" },
      });
      if (error) return toast(error.message, "error");
      closeModal(); toast("Evento agregado."); await renderProjectReality(projectId);
    });
  }

  async function saveNarrativeAsNote(projectId) {
    const textarea = document.getElementById("reality-ai-text");
    const text = String(textarea?.value || "").trim();
    if (!text) return toast("Escribe primero lo que está ocurriendo.", "warning");
    const { error } = await client.from("company_project_events").insert({
      project_id: projectId,
      event_type: "note",
      title: "Actualización de bitácora",
      description: text,
      event_date: new Date().toISOString(),
      status: "confirmed",
      ai_generated: false,
      created_by: session?.user?.id || null,
      metadata: { source: "business_narrative" },
    });
    if (error) return toast(error.message, "error");
    toast("Bitácora guardada sin modificar estados ni dinero.");
    await renderProjectReality(projectId);
  }

  function narrativeContext(bundle) {
    return JSON.stringify({
      project: {
        id: bundle.project.id,
        title: bundle.project.title,
        commercial_status: bundle.project.commercial_status,
        execution_status: bundle.project.execution_status,
        financial_status: bundle.project.financial_status,
        delivery_status: bundle.project.delivery_status,
        contracted_amount: bundle.project.contracted_amount,
        expected_invoice_count: bundle.project.expected_invoice_count,
        operational_notes: bundle.project.operational_notes,
      },
      summary: bundle.summary,
      invoices: bundle.invoices.map((i) => ({ type: i.invoice_type, folio: i.folio, total: i.total_amount, payment_status: i.payment_status, issue_date: i.issue_date })),
      supplier_quotes: bundle.quotes.map((q) => ({ number: q.quote_number, supplier: q.client_name, total: q.total_amount, status: q.status })),
      transactions: bundle.transactions.slice(0, 20).map((t) => ({ direction: t.direction, amount: t.amount, status: t.status, date: t.transaction_date, description: t.description })),
      recent_events: bundle.events.slice(0, 20).map((e) => ({ type: e.event_type, title: e.title, description: e.description, date: e.event_date })),
    }, null, 2);
  }

  function suggestionLabel(action) {
    if (action.type === "update_project") return `Actualizar proyecto: ${Object.entries(action.fields || {}).map(([k, v]) => `${labels[k]?.[v] || k}: ${labels[k]?.[v] || v}`).join(" · ")}`;
    if (action.type === "create_transaction") return `${action.direction === "expense" ? "Registrar gasto" : "Registrar ingreso"}: ${money(action.amount)} · ${action.description || "Movimiento"}`;
    if (action.type === "create_event") return `Agregar evento: ${action.title || labels.event_type[action.event_type] || action.event_type}`;
    return action.type || "Acción sugerida";
  }

  async function analyzeNarrative(bundle) {
    const textarea = document.getElementById("reality-ai-text");
    const result = document.getElementById("reality-ai-result");
    const text = String(textarea?.value || "").trim();
    if (!text) return toast("Escribe primero lo que está ocurriendo.", "warning");
    if (result) result.innerHTML = '<div class="reality-suggestion"><div><strong>MIRA está analizando el relato y los datos reales del proyecto…</strong></div></div>';
    try {
      const schemaPrompt = `Analiza el relato del usuario junto con el contexto del proyecto. Devuelve SOLO JSON válido, sin markdown, con esta estructura exacta: {"summary":"resumen breve","actions":[...]}. Las acciones permitidas son: 1) {"type":"update_project","fields":{}} donde fields solo puede usar commercial_status, execution_status, financial_status, delivery_status, contracted_amount, expected_invoice_count, operational_notes; usa únicamente valores válidos del contexto. 2) {"type":"create_event","event_type":"note|payment_received|payment_made|invoice_planned|invoice_issued|quote_received|quote_approved|purchase_order|service_started|service_completed|goods_ordered|goods_received|delivery_pending|delivery_completed|tax_obligation|meeting|incident|scope_change|other","title":"","description":"","amount":null,"direction":null}. 3) {"type":"create_transaction","direction":"income|expense","amount":0,"status":"paid|pending|partial","transaction_date":"YYYY-MM-DD","description":""}. REGLAS: no inventes montos ni fechas; crea transaction solo si el usuario afirma explícitamente un monto o pago/cobro concreto; una cotización no es un pago; si solo describe un estado, usa update_project/create_event. El usuario escribió: ${text}`;
      const parsed = await callMiraJson(schemaPrompt, narrativeContext(bundle));
      aiSuggestions = Array.isArray(parsed.actions) ? parsed.actions.slice(0, 12) : [];
      if (!aiSuggestions.length) {
        if (result) result.innerHTML = `<div class="reality-suggestion"><div><strong>${esc(parsed.summary || "No se detectaron cambios seguros.")}</strong><small>Puedes guardar el relato como nota sin cambiar datos financieros.</small></div></div>`;
        return;
      }
      if (result) result.innerHTML = `<div class="reality-suggestion"><div><strong>${esc(parsed.summary || "Propuesta de MIRA")}</strong><small>Selecciona solo lo que corresponda a la realidad.</small></div></div>${aiSuggestions.map((action, index) => `<label class="reality-suggestion"><input type="checkbox" class="reality-ai-check" data-index="${index}" checked><div><strong>${esc(suggestionLabel(action))}</strong><small>${esc(action.reason || action.description || "Se aplicará únicamente después de confirmar.")}</small></div></label>`).join("")}<div class="reality-ai-actions"><button id="reality-ai-apply" class="btn primary">Aplicar seleccionadas</button></div>`;
      document.getElementById("reality-ai-apply")?.addEventListener("click", () => applyAiSuggestions(bundle.project.id, text));
    } catch (error) {
      aiSuggestions = [];
      if (result) result.innerHTML = `<div class="reality-suggestion"><div><strong>No se pudo obtener una propuesta estructurada.</strong><small>${esc(error.message)}. Puedes guardar el relato como nota sin riesgo.</small></div></div>`;
    }
  }

  async function applyAiSuggestions(projectId, narrative) {
    const selected = [...document.querySelectorAll(".reality-ai-check:checked")].map((input) => aiSuggestions[Number(input.dataset.index)]).filter(Boolean);
    if (!selected.length) return toast("Selecciona al menos una acción.", "warning");
    const allowedProjectFields = new Set(["commercial_status","execution_status","financial_status","delivery_status","contracted_amount","expected_invoice_count","operational_notes"]);
    const allowedEventTypes = new Set(Object.keys(labels.event_type));
    try {
      for (const action of selected) {
        if (action.type === "update_project" && canProjectWrite()) {
          const fields = {};
          Object.entries(action.fields || {}).forEach(([key, value]) => { if (allowedProjectFields.has(key)) fields[key] = value; });
          if (Object.keys(fields).length) {
            fields.updated_at = new Date().toISOString();
            const { error } = await client.from("company_projects").update(fields).eq("id", projectId);
            if (error) throw error;
          }
        }
        if (action.type === "create_event") {
          const eventType = allowedEventTypes.has(action.event_type) ? action.event_type : "note";
          const { error } = await client.from("company_project_events").insert({
            project_id: projectId,
            event_type: eventType,
            title: String(action.title || labels.event_type[eventType] || "Actualización").slice(0, 200),
            description: String(action.description || narrative).slice(0, 5000),
            amount: Number(action.amount || 0) || null,
            direction: ["income","expense"].includes(action.direction) ? action.direction : null,
            status: "confirmed",
            ai_generated: true,
            created_by: session?.user?.id || null,
            metadata: { source: "mira_business", narrative },
          });
          if (error) throw error;
        }
        if (action.type === "create_transaction" && canFinanceWrite()) {
          const amount = Number(action.amount || 0);
          const direction = ["income","expense"].includes(action.direction) ? action.direction : null;
          const status = ["paid","pending","partial"].includes(action.status) ? action.status : "pending";
          if (amount > 0 && direction) {
            const tx = await client.from("company_transactions").insert({
              direction,
              project_id: projectId,
              transaction_date: /^20\d{2}-\d{2}-\d{2}$/.test(String(action.transaction_date || "")) ? action.transaction_date : todayISO(),
              paid_at: status === "paid" ? new Date().toISOString() : null,
              amount,
              status,
              description: String(action.description || "Movimiento detectado por MIRA").slice(0, 1000),
              reconciled: false,
              metadata: { source: "mira_business", requires_human_confirmation: false, narrative },
              created_by: session?.user?.id || null,
            });
            if (tx.error) throw tx.error;
          }
        }
      }
      await client.from("company_project_events").insert({
        project_id: projectId,
        event_type: "note",
        title: "Bitácora procesada con MIRA",
        description: narrative,
        status: "confirmed",
        ai_generated: true,
        created_by: session?.user?.id || null,
        metadata: { source: "mira_business", applied_actions: selected.map((a) => a.type) },
      });
      toast("Cambios confirmados y aplicados.");
      aiSuggestions = [];
      await renderProjectReality(projectId);
    } catch (error) {
      toast(error.message || "No se pudieron aplicar todas las acciones.", "error");
    }
  }

  async function renderTreasury() {
    if (!(await ensureAuth())) return;
    setTitle("Tesorería");
    clearActiveNav();
    const target = main();
    if (!target) return;
    target.innerHTML = '<div class="empty-state"><div class="loading-orb" style="margin:auto;width:38px;height:38px"></div><p>Calculando caja real…</p></div>';
    const [{ data: tx, error }, { data: projects }, { data: summaries }] = await Promise.all([
      client.from("company_transactions").select("*").order("transaction_date", { ascending: false }).limit(500),
      client.from("company_projects").select("id,title"),
      client.from("company_project_financial_summary").select("project_id,committed_expense"),
    ]);
    if (error) return target.innerHTML = `<div class="panel"><div class="empty-state"><p>${esc(error.message)}</p></div></div>`;
    const rows = tx || [];
    const names = new Map((projects || []).map((p) => [p.id, p.title]));
    const collected = rows.filter((t) => t.direction === "income" && t.status === "paid").reduce((a, b) => a + Number(b.amount || 0), 0);
    const paid = rows.filter((t) => t.direction === "expense" && t.status === "paid").reduce((a, b) => a + Number(b.amount || 0), 0);
    const receivable = rows.filter((t) => t.direction === "income" && ["pending","partial"].includes(t.status)).reduce((a, b) => a + Number(b.amount || 0), 0);
    const payable = rows.filter((t) => t.direction === "expense" && ["pending","partial"].includes(t.status)).reduce((a, b) => a + Number(b.amount || 0), 0);
    const committed = (summaries || []).reduce((a, b) => a + Number(b.committed_expense || 0), 0);
    target.innerHTML = `
      <div class="reality-hero"><div><h2>Tesorería basada en movimientos reales</h2><p>La caja se calcula con cobros y pagos registrados. Una cotización aprobada aparece como compromiso, pero no como salida de dinero hasta que exista un pago.</p></div></div>
      <div class="reality-kpi-grid">
        <div class="reality-kpi positive"><span>Cobrado / entradas pagadas</span><strong>${money(collected)}</strong></div>
        <div class="reality-kpi negative"><span>Pagos / salidas reales</span><strong>${money(paid)}</strong></div>
        <div class="reality-kpi ${collected - paid >= 0 ? "positive" : "negative"}"><span>Flujo neto registrado</span><strong>${money(collected - paid)}</strong></div>
        <div class="reality-kpi"><span>Por cobrar</span><strong>${money(receivable)}</strong></div>
        <div class="reality-kpi"><span>Por pagar</span><strong>${money(payable)}</strong></div>
        <div class="reality-kpi"><span>Compras comprometidas</span><strong>${money(committed)}</strong></div>
      </div>
      <section class="reality-section"><div class="reality-section-head"><h3>Movimientos</h3><button id="treasury-open-operations" class="btn outline">Ver por proyecto</button></div><div class="reality-section-body">
        ${rows.length ? `<div style="overflow:auto"><table class="reality-table"><thead><tr><th>Fecha</th><th>Proyecto</th><th>Descripción</th><th>Tipo</th><th>Estado</th><th>Monto</th></tr></thead><tbody>${rows.map((t) => `<tr><td>${esc(dateCL(t.transaction_date))}</td><td>${esc(names.get(t.project_id) || "General")}</td><td>${esc(t.description || "—")}</td><td>${t.direction === "expense" ? "Salida" : "Entrada"}</td><td>${esc(labels.transaction_status[t.status] || t.status)}</td><td><strong>${money(t.amount)}</strong></td></tr>`).join("")}</tbody></table></div>` : '<div class="reality-empty">No hay movimientos.</div>'}
      </div></section>`;
    document.getElementById("treasury-open-operations")?.addEventListener("click", renderOperations);
  }

  function monthBounds(monthValue) {
    const [year, month] = monthValue.split("-").map(Number);
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const next = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
    return { start, next };
  }

  async function renderTax(monthValue = new Date().toISOString().slice(0, 7)) {
    if (!(await ensureAuth())) return;
    setTitle("Tributario");
    clearActiveNav();
    const target = main();
    if (!target) return;
    const { start, next } = monthBounds(monthValue);
    target.innerHTML = '<div class="empty-state"><div class="loading-orb" style="margin:auto;width:38px;height:38px"></div><p>Calculando IVA estimado…</p></div>';
    const [{ data: invoices, error }, { count: undated }, { data: records }] = await Promise.all([
      client.from("company_invoices").select("invoice_type,net_amount,exempt_amount,vat_amount,total_amount,payment_status,folio,issue_date,issuer_name").gte("issue_date", start).lt("issue_date", next).neq("payment_status", "void"),
      client.from("company_invoices").select("id", { count: "exact", head: true }).is("issue_date", null),
      client.from("company_tax_records").select("*").eq("period", start).order("created_at", { ascending: false }),
    ]);
    if (error) return target.innerHTML = `<div class="panel"><div class="empty-state"><p>${esc(error.message)}</p></div></div>`;
    const rows = invoices || [];
    const sales = rows.filter((i) => i.invoice_type === "sale");
    const purchases = rows.filter((i) => i.invoice_type === "purchase");
    const netSales = sales.reduce((a, b) => a + Number(b.net_amount || 0), 0);
    const debit = sales.reduce((a, b) => a + Number(b.vat_amount || 0), 0);
    const netPurchases = purchases.reduce((a, b) => a + Number(b.net_amount || 0), 0);
    const credit = purchases.reduce((a, b) => a + Number(b.vat_amount || 0), 0);
    const balance = debit - credit;
    const existingF29 = (records || []).find((r) => r.record_type === "f29");
    target.innerHTML = `
      <div class="reality-hero"><div><h2>Control tributario estimado</h2><p>Se calcula desde DTE de venta y compra con fecha de emisión dentro del período. Es un control interno; la declaración definitiva debe contrastarse con los registros oficiales.</p></div><div><input id="reality-tax-month" class="reality-input" type="month" value="${esc(monthValue)}"></div></div>
      ${undated ? `<div class="reality-section"><div class="reality-section-body"><span class="reality-chip warn">${undated} factura${undated === 1 ? "" : "s"} sin fecha de emisión no se incluye${undated === 1 ? "" : "n"} en el cálculo mensual.</span></div></div>` : ""}
      <div class="reality-kpi-grid" style="margin-top:18px">
        <div class="reality-kpi"><span>Neto ventas</span><strong>${money(netSales)}</strong></div>
        <div class="reality-kpi"><span>IVA débito (ventas)</span><strong>${money(debit)}</strong></div>
        <div class="reality-kpi"><span>Neto compras</span><strong>${money(netPurchases)}</strong></div>
        <div class="reality-kpi"><span>IVA crédito (compras)</span><strong>${money(credit)}</strong></div>
        <div class="reality-kpi ${balance <= 0 ? "positive" : "negative"}"><span>IVA estimado débito - crédito</span><strong>${money(balance)}</strong></div>
      </div>
      <section class="reality-section"><div class="reality-section-head"><h3>Cómo se calcula</h3>${canFinanceWrite() ? '<button id="reality-tax-record" class="btn primary">Registrar control F29</button>' : ""}</div><div class="reality-section-body"><p class="reality-help"><strong>IVA débito</strong> = IVA de facturas de venta del período. <strong>IVA crédito</strong> = IVA de facturas de compra registradas en el período. <strong>Saldo estimado</strong> = débito - crédito. Las cotizaciones y órdenes de compra no generan IVA por sí solas.</p>${existingF29 ? `<p class="reality-help">Control F29 registrado: <strong>${esc(existingF29.status)}</strong> · total registrado ${money(existingF29.total_amount)}${existingF29.due_date ? ` · vencimiento ${esc(dateCL(existingF29.due_date))}` : ""}.</p>` : ""}</div></section>
      <section class="reality-section"><div class="reality-section-head"><h3>DTE incluidos en ${esc(monthValue)}</h3></div><div class="reality-section-body">${rows.length ? `<div style="overflow:auto"><table class="reality-table"><thead><tr><th>Folio</th><th>Tipo</th><th>Fecha</th><th>Emisor</th><th>Neto</th><th>IVA</th><th>Total</th></tr></thead><tbody>${rows.map((i) => `<tr><td>${esc(i.folio || "—")}</td><td>${i.invoice_type === "purchase" ? "Compra" : "Venta"}</td><td>${esc(dateCL(i.issue_date))}</td><td>${esc(i.issuer_name || "—")}</td><td>${money(i.net_amount)}</td><td>${money(i.vat_amount)}</td><td><strong>${money(i.total_amount)}</strong></td></tr>`).join("")}</tbody></table></div>` : '<div class="reality-empty">No hay DTE con fecha dentro de este período.</div>'}</div></section>`;
    document.getElementById("reality-tax-month")?.addEventListener("change", (event) => renderTax(event.target.value));
    document.getElementById("reality-tax-record")?.addEventListener("click", () => openTaxRecord({ period: start, debit, credit, balance, existing: existingF29 }));
  }

  function openTaxRecord({ period, debit, credit, balance, existing }) {
    modal("Registrar control F29", `
      <form id="reality-tax-form" class="form-grid">
        <label class="form-field"><span>Período</span><input value="${esc(period.slice(0, 7))}" disabled /></label>
        <label class="form-field"><span>Estado</span><select name="status"><option value="pending">Pendiente</option><option value="prepared">Preparado</option><option value="filed">Declarado</option><option value="paid">Pagado</option></select></label>
        <label class="form-field"><span>Vencimiento</span><input name="due_date" type="date" value="${esc(existing?.due_date || "")}" /></label>
        <label class="form-field"><span>PPM / otros a sumar</span><input name="ppm_amount" type="number" min="0" value="${Number(existing?.ppm_amount || 0)}" /></label>
        <label class="form-field"><span>IVA débito detectado</span><input value="${Number(debit)}" disabled /></label>
        <label class="form-field"><span>IVA crédito detectado</span><input value="${Number(credit)}" disabled /></label>
        <label class="form-field full"><span>Notas</span><textarea name="notes">${esc(existing?.notes || "")}</textarea></label>
      </form>`,
      '<button class="btn ghost" data-reality-close-2>Cancelar</button><button class="btn primary" id="save-reality-tax">Guardar control</button>');
    const status = document.querySelector("#reality-tax-form [name=status]");
    if (status) status.value = existing?.status || "pending";
    document.querySelector("[data-reality-close-2]")?.addEventListener("click", closeModal);
    document.getElementById("save-reality-tax")?.addEventListener("click", async () => {
      const form = document.getElementById("reality-tax-form");
      const fd = new FormData(form);
      const ppm = Number(fd.get("ppm_amount") || 0);
      const payload = {
        period,
        record_type: "f29",
        status: String(fd.get("status") || "pending"),
        due_date: String(fd.get("due_date") || "") || null,
        net_amount: 0,
        debit_vat: debit,
        credit_vat: credit,
        ppm_amount: ppm,
        tax_amount: balance,
        total_amount: balance + ppm,
        notes: String(fd.get("notes") || "").trim() || null,
        metadata: { source: "calculated_from_invoices", estimated: true },
        created_by: session?.user?.id || null,
        updated_at: new Date().toISOString(),
      };
      let response;
      if (existing?.id) response = await client.from("company_tax_records").update(payload).eq("id", existing.id);
      else response = await client.from("company_tax_records").upsert(payload, { onConflict: "period,record_type" });
      if (response.error) return toast(response.error.message, "error");
      closeModal(); toast("Control tributario guardado."); await renderTax(period.slice(0, 7));
    });
  }

  function navText(button) {
    return String(button?.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  document.addEventListener("click", (event) => {
    const custom = event.target.closest?.("#project-reality-nav");
    if (custom) {
      event.preventDefault(); event.stopImmediatePropagation(); renderOperations(); return;
    }
    const button = event.target.closest?.("#side-nav .nav-item");
    if (!button) return;
    const text = navText(button);
    if (text === "tesorería" || text === "tesoreria") {
      event.preventDefault(); event.stopImmediatePropagation(); renderTreasury(); return;
    }
    if (text === "tributario") {
      event.preventDefault(); event.stopImmediatePropagation(); renderTax();
    }
  }, true);

  const observer = new MutationObserver(() => ensureNavItem());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  injectStyles();
  ensureNavItem();
  ensureAuth().catch(() => {});
})();
