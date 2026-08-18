(() => {
  "use strict";

  const cfg = window.INNOVA_ADMIN_CONFIG;
  if (!cfg || !window.supabase || new URLSearchParams(location.search).get("safe") === "1") return;

  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  const TABLES = {
    company_projects: ["code","title","client_name","client_rut","client_party_id","description","status","start_date","due_date","budget","contracted_amount","expected_invoice_count","commercial_status","execution_status","financial_status","delivery_status","operational_notes"],
    company_parties: ["name","rut","roles","email","phone","address","city","contact_name","active","notes"],
    company_quotations: ["direction","quote_number","project_id","party_id","client_name","client_rut","issue_date","valid_until","status","items","subtotal","discount","net_amount","vat_rate","vat_amount","total_amount","notes"],
    company_purchase_orders: ["direction","order_number","party_id","project_id","quotation_id","issue_date","expected_date","status","items","net_amount","vat_amount","total_amount","notes"],
    company_documents: ["project_id","document_type","title","status"],
    company_contracts: ["contract_number","title","contract_type","party_id","project_id","status","start_date","end_date","renewal_date","amount","notes"],
    company_files: ["title","category","project_id","party_id","document_number","occurred_at","expires_at","archived"],
    company_invoices: ["project_id","invoice_type","dte_type","folio","issuer_rut","issuer_name","recipient_rut","issue_date","due_date","net_amount","exempt_amount","vat_amount","total_amount","payment_status","notes"],
    company_transactions: ["direction","project_id","party_id","invoice_id","purchase_order_id","transaction_date","due_date","paid_at","amount","status","payment_method","bank_reference","description","reconciled"],
    company_bank_movements: ["account_label","movement_date","description","amount","reference","balance","transaction_id","reconciled"],
    company_tax_records: ["period","record_type","status","due_date","net_amount","debit_vat","credit_vat","ppm_amount","tax_amount","total_amount","notes"],
    company_assets: ["asset_code","name","category","serial_number","project_id","employee_id","supplier_party_id","purchase_invoice_id","purchase_date","cost","warranty_until","location","status","notes"],
    company_service_cases: ["case_number","case_type","title","party_id","project_id","asset_id","invoice_id","status","priority","opened_at","due_at","resolved_at","assigned_to","description","resolution"],
    company_employees: ["full_name","rut","position","contract_type","start_date","end_date","status","email","phone","leave_balance","notes"],
    company_approvals: ["entity_type","entity_id","step","status","approver_id","decided_at","note"],
    company_deadlines: ["entity_type","entity_id","title","due_date","priority","status","owner_id","remind_days","notes"],
    company_project_events: ["project_id","event_type","title","description","event_date","amount","direction","status"],
    company_alerts: ["title","message","severity","status","entity_type","entity_id"],
  };

  const SNAPSHOT_TABLES = Object.keys(TABLES);
  const STATE = {
    session: null,
    profile: null,
    data: {},
    syncedAt: null,
    syncing: false,
    selectedProjectId: "",
    selectedInvoiceId: "",
    docs: new Map(),
    docIndexing: false,
    realtime: null,
    history: [],
  };

  const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[c]));
  const norm = (value = "") => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const money = (value) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(value || 0));
  const main = () => document.getElementById("main-content");
  const today = () => new Date();
  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  const addMonths = (date, months) => { const d = new Date(date); d.setMonth(d.getMonth() + months); return d; };

  function toast(message, type = "success") {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const item = document.createElement("div");
    item.className = `toast ${type}`;
    item.textContent = message;
    root.appendChild(item);
    setTimeout(() => item.remove(), 5200);
  }

  function injectStyles() {
    if (document.getElementById("enterprise-sync-v4-style")) return;
    const style = document.createElement("style");
    style.id = "enterprise-sync-v4-style";
    style.textContent = `
      .s4-syncbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 13px;margin:0 0 14px;border:1px solid #dfe6f4;border-radius:14px;background:linear-gradient(90deg,#f8fbff,#fbf9ff);font-size:.78rem}.s4-syncbar strong{color:#18386b}.s4-syncbar .left,.s4-syncbar .right{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.s4-dot{width:8px;height:8px;border-radius:50%;background:#18a765;box-shadow:0 0 0 4px rgba(24,167,101,.1)}.s4-dot.busy{background:#e3a21a}.s4-link{border:0;background:transparent;color:#315efb;font-weight:700;cursor:pointer;padding:4px 6px}.s4-agent-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:16px}.s4-agent-head h2{margin:0 0 5px}.s4-agent-head p{margin:0;color:var(--muted);max-width:850px}.s4-grid{display:grid;grid-template-columns:330px 1fr;gap:16px}.s4-panel,.s4-chat,.s4-card{background:#fff;border:1px solid var(--line);border-radius:20px}.s4-panel{padding:17px}.s4-panel h3{margin:0 0 12px}.s4-panel label{display:flex;flex-direction:column;gap:5px;font-size:.78rem;font-weight:700;margin-bottom:10px}.s4-panel select,.s4-panel input{padding:10px;border:1px solid var(--line);border-radius:11px;background:#fff}.s4-chat{overflow:hidden}.s4-messages{height:480px;overflow:auto;padding:18px;background:#fbfcff}.s4-msg{max-width:84%;padding:11px 13px;border-radius:14px;margin-bottom:9px;white-space:pre-wrap;line-height:1.45}.s4-msg.user{margin-left:auto;background:#315efb;color:white}.s4-msg.mira{background:#eef2f8}.s4-msg.ok{background:#e8f8ef;color:#14603a}.s4-msg.warn{background:#fff4dc;color:#775500}.s4-input{display:grid;grid-template-columns:1fr auto;gap:8px;padding:13px;border-top:1px solid var(--line)}.s4-input textarea{min-height:62px;border:1px solid #bdc8ef;border-radius:12px;padding:11px;font:inherit;resize:vertical}.s4-tools{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.s4-tool{border:1px solid #e1e7f5;background:#f9fbff;border-radius:12px;padding:9px 10px;text-align:left;cursor:pointer;font-size:.74rem;font-weight:700;color:#284a86}.s4-tool:hover{border-color:#9db0ef;background:#f1f5ff}.s4-chip{display:inline-flex;padding:5px 8px;border-radius:999px;background:#eef4ff;color:#3858b8;font-size:.68rem;font-weight:800;margin:2px}.s4-lifecycle{margin:12px 0;padding:11px;border-radius:13px;background:#f7f9fd;border:1px solid #e9edf6}.s4-lifecycle.rect{background:#fff8e7;border-color:#ffe2a4}.s4-lifecycle.ok{background:#ecf9f1;border-color:#ccebd8}.s4-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:11px;margin-bottom:14px}.s4-kpi{background:#fff;border:1px solid var(--line);border-radius:16px;padding:13px}.s4-kpi small{display:block;color:var(--muted)}.s4-kpi strong{display:block;margin-top:4px}.s4-section{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px;margin-top:14px}.s4-section h3{margin:0 0 11px}.s4-finding{padding:10px 11px;border:1px solid #e4e9f3;border-radius:12px;margin:7px 0}.s4-finding small{color:var(--muted)}.s4-modal{position:fixed;inset:0;background:#08101f99;z-index:10000;display:grid;place-items:center;padding:18px}.s4-modal>div{width:min(760px,96vw);background:#fff;border-radius:19px;padding:20px;max-height:86vh;overflow:auto}.s4-action{padding:11px;border:1px solid var(--line);border-radius:12px;margin:8px 0}.s4-warn{padding:11px;background:#fff4dc;border:1px solid #ffdfa0;border-radius:11px;margin:10px 0}.s4-row{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:14px}.s4-table{width:100%;border-collapse:collapse}.s4-table th,.s4-table td{padding:9px;border-bottom:1px solid var(--line);text-align:left;font-size:.78rem}.s4-top-mira{display:inline-flex;align-items:center;gap:6px}.s4-live{font-size:.68rem;color:#168654;font-weight:800}.s4-docstat{margin-top:8px;font-size:.72rem;color:var(--muted)}
      @media(max-width:900px){.s4-grid{grid-template-columns:1fr}.s4-messages{height:380px}.s4-tools{grid-template-columns:1fr}.s4-syncbar{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  async function ensureAuth() {
    if (!STATE.session) STATE.session = (await db.auth.getSession()).data?.session || null;
    if (!STATE.session?.user) return false;
    if (!STATE.profile) {
      STATE.profile = (await db.from("company_users").select("user_id,email,full_name,role,status").eq("user_id", STATE.session.user.id).maybeSingle()).data || null;
    }
    return !!STATE.profile && STATE.profile.status === "active";
  }

  async function aal2() {
    return (await db.auth.mfa.getAuthenticatorAssuranceLevel()).data?.currentLevel === "aal2";
  }

  function setTitle(text) { const node = document.getElementById("view-title"); if (node) node.textContent = text; }
  function setActive(node) { document.querySelectorAll("#side-nav .nav-item").forEach((x) => x.classList.remove("active")); node?.classList.add("active"); }

  function reorderAgents() {
    const nav = document.getElementById("side-nav");
    const start = nav?.querySelector('[data-view="dashboard"]');
    const mira = nav?.querySelector('[data-view="mira"]');
    const auditor = nav?.querySelector('[data-view="auditor"]');
    const finance = document.getElementById("finance-agent-nav");
    if (!nav || !start || !mira || !auditor) return;
    let label = document.getElementById("s4-agent-label");
    if (!label) { label = document.createElement("div"); label.id = "s4-agent-label"; label.className = "nav-label"; label.textContent = "Agentes IA"; }
    start.insertAdjacentElement("afterend", label);
    label.insertAdjacentElement("afterend", mira);
    mira.insertAdjacentElement("afterend", auditor);
    if (finance) auditor.insertAdjacentElement("afterend", finance);
  }

  function installTopMira() {
    const actions = document.querySelector(".topbar-actions");
    if (!actions || document.getElementById("s4-top-mira")) return;
    const button = document.createElement("button");
    button.id = "s4-top-mira";
    button.className = "btn ghost s4-top-mira";
    button.type = "button";
    button.innerHTML = '<i class="ri-sparkling-2-line"></i><span>MIRA</span>';
    button.addEventListener("click", () => renderMira().catch((e) => toast(e.message, "error")));
    actions.insertBefore(button, actions.firstChild);
  }

  async function loadTable(table, limit = 350) {
    try {
      const { data, error } = await db.from(table).select("*").limit(limit);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn(`Sync ${table}:`, error.message || error);
      return [];
    }
  }

  async function syncAll({ indexDocs = true, silent = false } = {}) {
    if (STATE.syncing || !(await ensureAuth())) return STATE.data;
    STATE.syncing = true;
    updateSyncIndicators(true);
    try {
      const rows = await Promise.all(SNAPSHOT_TABLES.map((table) => loadTable(table)));
      SNAPSHOT_TABLES.forEach((table, index) => { STATE.data[table] = rows[index]; });
      STATE.syncedAt = new Date();
      window.dispatchEvent(new CustomEvent("innova-business-sync", { detail: { at: STATE.syncedAt } }));
      if (indexDocs) indexDocuments().catch(() => {});
      if (!silent) toast("Información empresarial sincronizada.");
      return STATE.data;
    } finally {
      STATE.syncing = false;
      updateSyncIndicators(false);
      enhanceEverySection();
    }
  }

  function updateSyncIndicators(busy = false) {
    document.querySelectorAll("[data-s4-sync-dot]").forEach((node) => node.classList.toggle("busy", busy));
    document.querySelectorAll("[data-s4-sync-time]").forEach((node) => {
      node.textContent = busy ? "Sincronizando…" : (STATE.syncedAt ? `Actualizado ${STATE.syncedAt.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}` : "Pendiente");
    });
  }

  function syncBar() {
    return `<div class="s4-syncbar"><div class="left"><span class="s4-dot ${STATE.syncing ? "busy" : ""}" data-s4-sync-dot></span><strong>Sincronización empresarial</strong><span data-s4-sync-time>${STATE.syncedAt ? `Actualizado ${STATE.syncedAt.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}` : "Preparando…"}</span><span class="s4-live">MIRA 360°</span></div><div class="right"><button class="s4-link" data-s4-sync-now>Sincronizar ahora</button><button class="s4-link" data-s4-ask-mira>Preguntar a MIRA</button></div></div>`;
  }

  function issuedSales(projectId) {
    return (STATE.data.company_invoices || []).filter((x) => x.project_id === projectId && x.invoice_type === "sale" && x.payment_status !== "void");
  }

  function lifecycle(project) {
    if (!project) return null;
    const invoices = issuedSales(project.id);
    const expected = Number(project.expected_invoice_count || 0);
    const remaining = Math.max(0, expected - invoices.length);
    const closedOps = project.execution_status === "completed" && project.commercial_status === "closed";
    const rectification = closedOps && remaining > 0;
    const allPaid = invoices.length > 0 && invoices.every((x) => x.payment_status === "paid");
    const totalClosed = closedOps && remaining === 0 && project.status === "completed";
    return { expected, issued: invoices.length, remaining, rectification, allPaid, totalClosed, invoices };
  }

  function projectWarranty(projectId) {
    return (STATE.data.company_deadlines || []).filter((x) => x.entity_type === "project_warranty" && x.entity_id === projectId && x.status !== "cancelled").sort((a, b) => new Date(b.due_date) - new Date(a.due_date))[0] || null;
  }

  function projectRelations(projectId) {
    const linked = {};
    for (const [table, rows] of Object.entries(STATE.data)) {
      linked[table] = (rows || []).filter((row) => row.project_id === projectId || (table === "company_deadlines" && row.entity_id === projectId));
    }
    return linked;
  }

  async function extractDocument(row) {
    if (!row?.id || !row.storage_path || STATE.docs.has(row.id)) return;
    const name = String(row.original_name || row.title || "").toLowerCase();
    const mime = String(row.mime_type || "").toLowerCase();
    const supported = mime.includes("pdf") || mime.startsWith("text/") || /\.(txt|csv|json|xml|html?|md|docx)$/i.test(name);
    if (!supported) { STATE.docs.set(row.id, { status: "metadata", text: "" }); return; }
    try {
      const { data: blob, error } = await db.storage.from(cfg.storageBucket).download(row.storage_path);
      if (error) throw error;
      let text = "";
      if (mime.includes("pdf") || name.endsWith(".pdf")) {
        if (!window.pdfjsLib) throw new Error("PDF.js no disponible");
        const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        for (let n = 1; n <= Math.min(pdf.numPages, 90); n += 1) {
          const page = await pdf.getPage(n);
          const content = await page.getTextContent();
          text += content.items.map((item) => item.str).join(" ") + "\n";
          if (text.length > 180000) break;
        }
      } else if (name.endsWith(".docx") && window.JSZip) {
        const zip = await window.JSZip.loadAsync(await blob.arrayBuffer());
        const xml = await zip.file("word/document.xml")?.async("text");
        text = xml ? new DOMParser().parseFromString(xml, "application/xml").textContent || "" : "";
      } else {
        text = await blob.text();
      }
      STATE.docs.set(row.id, { status: text.trim() ? "indexed" : "empty", text: text.replace(/\s+/g, " ").trim().slice(0, 180000) });
    } catch (error) {
      STATE.docs.set(row.id, { status: "error", text: "", error: error.message || String(error) });
    }
  }

  async function indexDocuments(force = false) {
    if (STATE.docIndexing) return;
    STATE.docIndexing = true;
    try {
      const files = [...(STATE.data.company_files || [])]
        .filter((x) => !x.archived && x.storage_path)
        .sort((a, b) => new Date(b.created_at || b.occurred_at || 0) - new Date(a.created_at || a.occurred_at || 0));
      if (force) STATE.docs.clear();
      const priority = STATE.selectedProjectId ? files.filter((x) => x.project_id === STATE.selectedProjectId) : [];
      const queue = [...priority, ...files.filter((x) => !priority.includes(x))].slice(0, 40);
      for (const file of queue) await extractDocument(file);
      window.dispatchEvent(new CustomEvent("innova-document-index", { detail: { indexed: [...STATE.docs.values()].filter((x) => x.status === "indexed").length, total: files.length } }));
    } finally {
      STATE.docIndexing = false;
      updateDocumentStats();
    }
  }

  function updateDocumentStats() {
    const indexed = [...STATE.docs.values()].filter((x) => x.status === "indexed").length;
    const total = (STATE.data.company_files || []).filter((x) => !x.archived && x.storage_path).length;
    document.querySelectorAll("[data-s4-docstat]").forEach((x) => { x.textContent = `Documentos leídos: ${indexed}/${total} compatibles indexados en esta sesión`; });
  }

  function trimRecord(row) {
    const out = {};
    for (const [key, value] of Object.entries(row || {})) {
      if (["storage_path","sha256","created_by"].includes(key)) continue;
      if (typeof value === "string" && value.length > 1800) out[key] = value.slice(0, 1800);
      else out[key] = value;
    }
    return out;
  }

  function businessSummary() {
    const invoices = STATE.data.company_invoices || [];
    const tx = STATE.data.company_transactions || [];
    const sales = invoices.filter((x) => x.invoice_type === "sale" && x.payment_status !== "void");
    const purchases = invoices.filter((x) => x.invoice_type === "purchase" && x.payment_status !== "void");
    return {
      projects: (STATE.data.company_projects || []).length,
      clients_suppliers: (STATE.data.company_parties || []).length,
      invoices: invoices.length,
      sales_total: sales.reduce((a, b) => a + Number(b.total_amount || 0), 0),
      purchases_total: purchases.reduce((a, b) => a + Number(b.total_amount || 0), 0),
      treasury_income: tx.filter((x) => x.direction === "income" && x.status === "paid").reduce((a, b) => a + Number(b.amount || 0), 0),
      treasury_expense: tx.filter((x) => x.direction === "expense" && x.status === "paid").reduce((a, b) => a + Number(b.amount || 0), 0),
      assets: (STATE.data.company_assets || []).length,
      post_sale_open: (STATE.data.company_service_cases || []).filter((x) => !["resolved","closed","cancelled"].includes(x.status)).length,
      deadlines_open: (STATE.data.company_deadlines || []).filter((x) => x.status === "open").length,
    };
  }

  function aiContext() {
    const project = (STATE.data.company_projects || []).find((x) => x.id === STATE.selectedProjectId) || null;
    const invoice = (STATE.data.company_invoices || []).find((x) => x.id === STATE.selectedInvoiceId) || null;
    const context = {
      synchronized_at: STATE.syncedAt?.toISOString() || null,
      summary: businessSummary(),
      selected_project: project ? { ...trimRecord(project), lifecycle: lifecycle(project), relations: Object.fromEntries(Object.entries(projectRelations(project.id)).map(([k, v]) => [k, v.slice(0, 35).map(trimRecord)])) } : null,
      selected_invoice: invoice ? trimRecord(invoice) : null,
      recent: {},
      document_text: [],
    };
    for (const table of SNAPSHOT_TABLES) context.recent[table] = (STATE.data[table] || []).slice(0, 12).map(trimRecord);
    const files = STATE.data.company_files || [];
    for (const file of files) {
      const indexed = STATE.docs.get(file.id);
      if (!indexed?.text) continue;
      if (project && file.project_id && file.project_id !== project.id) continue;
      context.document_text.push({ id: file.id, title: file.title || file.original_name, category: file.category, project_id: file.project_id, excerpt: indexed.text.slice(0, 3000) });
      if (context.document_text.length >= 10) break;
    }
    return JSON.stringify(context).slice(0, 44000);
  }

  function toolGuide() {
    return `Eres el planificador operativo de MIRA Business. Tienes datos sincronizados de Innova Admin. Si la orden requiere cambios, responde SOLO JSON válido con {"message":"resumen para el usuario","actions":[...]}. Si solo pide información, actions debe ser []. Operaciones permitidas: update, insert, delete y rpc. Para update/delete usa table e id. Para insert usa table y changes. Para update usa changes. RPC permitida: company_run_audit. Tablas permitidas y campos: ${JSON.stringify(TABLES)}. Nunca inventes IDs: usa únicamente IDs presentes en el contexto. Nunca modifiques credenciales. Si faltan datos para ejecutar, responde actions:[] y pide el dato concreto. Para proyectos: ejecución terminada + comercial cerrado + facturas esperadas aún no emitidas significa EN RECTIFICACIÓN; en ese caso el proyecto puede permanecer status=active, execution_status=completed, commercial_status=closed y financial_status=partially_invoiced/not_invoiced hasta completar facturación. Cuando ya no quedan facturas esperadas, puede cerrarse totalmente con status=completed. Garantía de proyecto: cobertura base 3 meses y extensión máxima total a 6 meses, registrada como company_deadlines con entity_type=project_warranty. Inventario empresarial usa company_assets; el inventario interno de un proyecto son los activos con project_id de ese proyecto. Todo cambio debe conservar relaciones entre módulos.`;
  }

  function parsePlan(text) {
    const clean = String(text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start < 0 || end < start) return { message: clean, actions: [] };
    try {
      const parsed = JSON.parse(clean.slice(start, end + 1));
      return { message: String(parsed.message || ""), actions: Array.isArray(parsed.actions) ? parsed.actions : [] };
    } catch (_) { return { message: clean, actions: [] }; }
  }

  function validateAction(action) {
    if (!action || typeof action !== "object") throw new Error("Acción inválida");
    if (action.op === "rpc") {
      if (action.rpc !== "company_run_audit") throw new Error("RPC no autorizada");
      return { op: "rpc", rpc: action.rpc, summary: action.summary || "Ejecutar auditoría empresarial" };
    }
    if (!["update","insert","delete"].includes(action.op)) throw new Error("Operación no autorizada");
    if (!TABLES[action.table]) throw new Error(`Tabla no autorizada: ${action.table || ""}`);
    if (["update","delete"].includes(action.op) && !action.id) throw new Error("Falta ID de registro");
    const safe = { op: action.op, table: action.table, id: action.id || null, changes: {}, summary: action.summary || `${action.op} ${action.table}` };
    if (action.op !== "delete") {
      for (const [key, value] of Object.entries(action.changes || {})) if (TABLES[action.table].includes(key)) safe.changes[key] = value;
      if (!Object.keys(safe.changes).length) throw new Error("La acción no contiene campos permitidos");
    }
    return safe;
  }

  function actionIsHigh(action) {
    return action.op === "delete" || ["company_tax_records","company_employees"].includes(action.table);
  }

  async function executePlan(plan) {
    const actions = plan.actions.map(validateAction);
    if (!actions.length) return;
    const high = actions.some(actionIsHigh);
    const modal = document.createElement("div");
    modal.id = "s4-permission";
    modal.className = "s4-modal";
    modal.innerHTML = `<div><h3>Autorizar a MIRA Business</h3><p>${esc(plan.message || "MIRA preparó estas acciones:")}</p>${actions.map((a, i) => `<div class="s4-action"><strong>${i + 1}. ${esc(a.summary)}</strong><br><small>${esc(a.table || a.rpc || "")}${a.id ? ` · ${esc(a.id)}` : ""}</small></div>`).join("")}${high ? '<div class="s4-warn"><strong>Acción sensible:</strong> requiere MFA y confirmación reforzada.</div>' : ""}<div class="s4-row"><button id="s4-cancel" class="btn ghost">Cancelar</button><button id="s4-execute" class="btn primary">Autorizar y ejecutar</button></div></div>`;
    document.body.appendChild(modal);
    document.getElementById("s4-cancel").onclick = () => modal.remove();
    document.getElementById("s4-execute").onclick = async () => {
      if (high && !(await aal2())) return toast("Verifica MFA desde el menú de usuario y vuelve a autorizar.", "warning");
      if (high && !window.confirm("Confirmación reforzada: ¿autorizas definitivamente esta gestión?")) return;
      const button = document.getElementById("s4-execute");
      button.disabled = true;
      button.textContent = "Ejecutando…";
      try {
        for (const action of actions) {
          if (action.op === "rpc") {
            const { error } = await db.rpc(action.rpc); if (error) throw error;
          } else if (action.op === "update") {
            const { error } = await db.from(action.table).update(action.changes).eq("id", action.id); if (error) throw error;
          } else if (action.op === "insert") {
            const { error } = await db.from(action.table).insert(action.changes); if (error) throw error;
          } else if (action.op === "delete") {
            const { error } = await db.from(action.table).delete().eq("id", action.id); if (error) throw error;
          }
        }
        modal.remove();
        toast("MIRA ejecutó la gestión autorizada.");
        await syncAll({ silent: true });
        addMessage("Gestión ejecutada y sincronizada con el resto de Innova Admin.", "ok");
      } catch (error) {
        modal.remove();
        toast(error.message || "No se pudo completar la gestión.", "error");
        addMessage(`La ejecución se detuvo: ${error.message || error}`, "warn");
      }
    };
  }

  function addMessage(text, kind = "mira") {
    const root = document.getElementById("s4-messages");
    if (!root) return;
    const item = document.createElement("div");
    item.className = `s4-msg ${kind}`;
    item.textContent = text;
    root.appendChild(item);
    root.scrollTop = root.scrollHeight;
  }

  async function askMira(text) {
    if (!text.trim()) return;
    addMessage(text, "user");
    STATE.history.push({ role: "user", content: text });
    const local = localOperationalPlan(text);
    if (local) return executePlan(local);
    try {
      const response = await fetch(`${cfg.backendUrl}/api/admin/mira`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${STATE.session.access_token}` },
        body: JSON.stringify({
          message: `${toolGuide()}\n\nORDEN DEL USUARIO:\n${text}`,
          context: aiContext(),
          history: STATE.history.slice(-8),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
      const plan = parsePlan(data.reply || "");
      if (plan.message) addMessage(plan.message, "mira");
      STATE.history.push({ role: "assistant", content: plan.message || data.reply || "" });
      if (plan.actions.length) await executePlan(plan);
    } catch (error) {
      addMessage(`No pude consultar el planificador inteligente: ${error.message}. Las herramientas directas siguen disponibles.`, "warn");
    }
  }

  function projectByText(text) {
    if (STATE.selectedProjectId) return (STATE.data.company_projects || []).find((x) => x.id === STATE.selectedProjectId) || null;
    const n = norm(text);
    const matches = (STATE.data.company_projects || []).filter((p) => n.includes(norm(p.title)));
    return matches.length === 1 ? matches[0] : null;
  }

  function invoiceByText(text) {
    if (STATE.selectedInvoiceId) return (STATE.data.company_invoices || []).find((x) => x.id === STATE.selectedInvoiceId) || null;
    const folio = String(text).match(/(?:factura|folio)\s*(?:n[°º]?\s*)?([0-9]+)/i)?.[1];
    return folio ? (STATE.data.company_invoices || []).find((x) => String(x.folio || "") === folio) || null : null;
  }

  function financialStatusFor(project) {
    const lc = lifecycle(project);
    if (!lc) return "not_invoiced";
    if (!lc.issued) return "not_invoiced";
    if (lc.remaining > 0) return "partially_invoiced";
    return lc.allPaid ? "collected" : "invoiced";
  }

  function localOperationalPlan(text) {
    const n = norm(text);
    const project = projectByText(text);
    const invoice = invoiceByText(text);
    if (/auditar|auditoria completa|revisar todo/.test(n)) return { message: "Preparé la auditoría transversal de toda la empresa.", actions: [{ op: "rpc", rpc: "company_run_audit", summary: "Ejecutar auditoría empresarial completa" }] };
    if (project && /rectific/.test(n)) {
      const lc = lifecycle(project);
      if (!lc?.remaining) return { message: "No quedan facturas esperadas pendientes; el proyecto puede pasar a cierre total.", actions: [] };
      return { message: `El proyecto tiene ${lc.remaining} factura(s) esperada(s) pendiente(s). Lo abriré administrativamente en rectificación sin reabrir la ejecución.`, actions: [
        { op: "update", table: "company_projects", id: project.id, changes: { status: "active", execution_status: "completed", commercial_status: "closed", financial_status: financialStatusFor(project) }, summary: `Abrir ${project.title} en período de rectificación` },
        { op: "insert", table: "company_project_events", changes: { project_id: project.id, event_type: "invoice_planned", title: "Proyecto en rectificación", description: `Ejecución terminada y cierre comercial realizado. Quedan ${lc.remaining} factura(s) esperada(s) por emitir antes del cierre total.`, event_date: new Date().toISOString(), status: "confirmed" }, summary: "Registrar rectificación en bitácora" },
      ] };
    }
    if (project && /(cierre total|cerrar todo|cerrarlo definitivamente|cerrar definitivamente)/.test(n)) {
      const lc = lifecycle(project);
      if (lc?.remaining > 0) return { message: `No propongo cierre total todavía: quedan ${lc.remaining} factura(s) esperada(s). Primero corresponde rectificación.`, actions: [] };
      const actions = [
        { op: "update", table: "company_projects", id: project.id, changes: { status: "completed", commercial_status: "closed", execution_status: "completed", financial_status: financialStatusFor(project) }, summary: `Cerrar totalmente ${project.title}` },
        { op: "insert", table: "company_project_events", changes: { project_id: project.id, event_type: "service_completed", title: "Cierre total del proyecto", description: "Ejecución y facturación revisadas por MIRA Business. Proyecto listo para postventa y garantía.", event_date: new Date().toISOString(), status: "confirmed" }, summary: "Registrar cierre total en bitácora" },
      ];
      if (!projectWarranty(project.id)) actions.push({ op: "insert", table: "company_deadlines", changes: { entity_type: "project_warranty", entity_id: project.id, title: `Garantía 3 meses · ${project.title}`, due_date: addMonths(new Date(), 3).toISOString(), priority: "medium", status: "open", remind_days: 15, notes: "Cobertura base de postventa de 3 meses desde el cierre total. Puede extenderse hasta 6 meses." }, summary: "Activar garantía base de 3 meses" });
      return { message: "El cierre total dejará activada la postventa y la garantía base de 3 meses.", actions };
    }
    if (project && /extender.*garantia|garantia.*6 meses/.test(n)) {
      const warranty = projectWarranty(project.id);
      if (!warranty) return { message: "El proyecto aún no tiene una garantía base registrada. Primero debe activarse la cobertura de 3 meses.", actions: [] };
      return { message: "Extenderé la cobertura del proyecto a 6 meses totales.", actions: [{ op: "update", table: "company_deadlines", id: warranty.id, changes: { title: `Garantía extendida 6 meses · ${project.title}`, due_date: addMonths(new Date(warranty.due_date), 3).toISOString(), notes: "Garantía extendida desde cobertura base de 3 meses a cobertura total de 6 meses." }, summary: `Extender garantía de ${project.title} a 6 meses` }] };
    }
    if (invoice && /factura/.test(n) && /(pagad|cobrad)/.test(n)) return { message: "Preparé la actualización de pago de la factura seleccionada.", actions: [{ op: "update", table: "company_invoices", id: invoice.id, changes: { payment_status: "paid" }, summary: `Marcar factura ${invoice.folio || ""} como pagada` }] };
    return null;
  }

  function toolButtons() {
    const tools = [
      ["Proyectos", "Analiza el proyecto seleccionado, sus estados, pendientes y proponme la gestión necesaria."],
      ["Rectificación", "Este proyecto terminó pero tiene facturación pendiente. Ábrelo en rectificación."],
      ["Cierre total", "Revisa si el proyecto seleccionado puede tener cierre total y ejecútalo si corresponde."],
      ["Facturas", "Revisa facturas del proyecto, pendientes, vencidas y pagos."],
      ["Finanzas / IVA", "Analiza IVA, tesorería, cobros, pagos y F29 del período actual."],
      ["Clientes / proveedores", "Revisa los clientes y proveedores relacionados y detecta datos faltantes."],
      ["Cotizaciones", "Revisa cotizaciones vigentes, aprobadas y vencidas relacionadas."],
      ["Órdenes de compra", "Revisa órdenes de compra, entregas y fechas esperadas."],
      ["Contratos", "Revisa contratos, vencimientos, renovaciones y montos."],
      ["Documentos", "Lee y analiza los documentos indexados del contexto seleccionado."],
      ["Inventario", "Muéstrame el inventario del proyecto seleccionado y el inventario empresarial relacionado."],
      ["Postventa", "Revisa garantía, postventa, casos abiertos y vencimientos del proyecto."],
      ["Extender garantía", "Extender la garantía del proyecto seleccionado a 6 meses."],
      ["RR.HH.", "Revisa RR.HH., contratos, vencimientos y pendientes administrativos."],
      ["Vencimientos", "Muéstrame todos los vencimientos críticos y qué debo hacer primero."],
      ["Auditoría 360°", "Ejecuta una auditoría completa y cruza todos los módulos."],
    ];
    return tools.map(([label, prompt]) => `<button class="s4-tool" data-s4-tool="${esc(prompt)}">${esc(label)}</button>`).join("");
  }

  function selectedProjectCard() {
    const project = (STATE.data.company_projects || []).find((x) => x.id === STATE.selectedProjectId);
    if (!project) return '<div class="s4-lifecycle">Selecciona un proyecto para ver su ciclo completo.</div>';
    const lc = lifecycle(project);
    const warranty = projectWarranty(project.id);
    const assets = (STATE.data.company_assets || []).filter((x) => x.project_id === project.id);
    const cases = (STATE.data.company_service_cases || []).filter((x) => x.project_id === project.id && !["closed","cancelled"].includes(x.status));
    const kind = lc.rectification ? "rect" : lc.totalClosed ? "ok" : "";
    const state = lc.rectification ? "EN RECTIFICACIÓN" : lc.totalClosed ? "CIERRE TOTAL" : "EN CURSO / REVISIÓN";
    return `<div class="s4-lifecycle ${kind}"><strong>${esc(state)}</strong><br><small>${esc(project.title)} · facturas ${lc.issued}/${lc.expected || "—"} · pendientes ${lc.remaining} · inventario interno ${assets.length} activo(s) · postventa abierta ${cases.length}${warranty ? ` · garantía hasta ${new Date(warranty.due_date).toLocaleDateString("es-CL")}` : " · garantía sin activar"}</small></div>`;
  }

  async function renderMira() {
    if (!(await ensureAuth())) return;
    if (!STATE.syncedAt) await syncAll({ silent: true });
    injectStyles(); reorderAgents(); installTopMira();
    setTitle("MIRA Business"); setActive(document.querySelector('[data-view="mira"]'));
    const root = main(); if (!root) return;
    root.dataset.syncV4 = "mira";
    const projects = STATE.data.company_projects || [];
    const invoices = STATE.data.company_invoices || [];
    root.innerHTML = `${syncBar()}<div class="s4-agent-head"><div><h2>MIRA Business · Centro de mando 360°</h2><p>Lee el estado sincronizado de toda la empresa, cruza documentos y relaciones, prepara gestiones y solo las ejecuta después de tu autorización.</p></div><div><span class="s4-chip">RLS</span><span class="s4-chip">MFA crítico</span><span class="s4-chip">Sincronización global</span></div></div><div class="s4-grid"><aside class="s4-panel"><h3>Contexto</h3><label>Proyecto<select id="s4-project"><option value="">Toda la empresa</option>${projects.map((p) => `<option value="${p.id}">${esc(lifecycle(p)?.rectification ? "[RECTIFICACIÓN] " : "")}${esc(p.title)}</option>`).join("")}</select></label><label>Factura<select id="s4-invoice"><option value="">Sin factura específica</option>${invoices.slice(0, 250).map((i) => `<option value="${i.id}">Folio ${esc(i.folio || "—")} · ${esc(i.issuer_name || "")}</option>`).join("")}</select></label><div id="s4-project-card">${selectedProjectCard()}</div><h3 style="margin-top:14px">Herramientas</h3><div class="s4-tools">${toolButtons()}</div><div class="s4-docstat" data-s4-docstat></div><button id="s4-reindex" class="s4-link" style="margin-top:7px">Releer documentos</button></aside><section class="s4-chat"><div id="s4-messages" class="s4-messages"><div class="s4-msg mira">Estoy conectada al contexto empresarial sincronizado. Puedo analizar y gestionar proyectos, facturas, finanzas, clientes, proveedores, documentos, contratos, OC, inventario, postventa, garantías, RR.HH., vencimientos y auditoría.</div></div><div class="s4-input"><textarea id="s4-input" placeholder="Ej.: El proyecto está terminado pero falta una factura; ábrelo en rectificación y dime qué queda pendiente."></textarea><button id="s4-send" class="btn primary"><i class="ri-send-plane-2-line"></i></button></div></section></div>`;
    const pSel = document.getElementById("s4-project"), iSel = document.getElementById("s4-invoice");
    pSel.value = STATE.selectedProjectId; iSel.value = STATE.selectedInvoiceId;
    pSel.onchange = () => { STATE.selectedProjectId = pSel.value; document.getElementById("s4-project-card").innerHTML = selectedProjectCard(); indexDocuments().catch(() => {}); };
    iSel.onchange = () => { STATE.selectedInvoiceId = iSel.value; };
    document.getElementById("s4-send").onclick = () => { const input = document.getElementById("s4-input"); const text = input.value.trim(); input.value = ""; askMira(text); };
    document.getElementById("s4-input").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); document.getElementById("s4-send").click(); } };
    document.querySelectorAll("[data-s4-tool]").forEach((button) => button.onclick = () => { const input = document.getElementById("s4-input"); input.value = button.dataset.s4Tool; input.focus(); });
    document.getElementById("s4-reindex").onclick = () => indexDocuments(true);
    const seed = sessionStorage.getItem("innova-mira-seed"); if (seed) { sessionStorage.removeItem("innova-mira-seed"); document.getElementById("s4-input").value = seed; }
    updateDocumentStats(); bindCommonButtons();
  }

  function auditFindings() {
    const now = today(), in7 = new Date(Date.now() + 7 * 86400000), in30 = new Date(Date.now() + 30 * 86400000);
    const invoices = STATE.data.company_invoices || [];
    const projects = STATE.data.company_projects || [];
    const tax = STATE.data.company_tax_records || [];
    const deadlines = STATE.data.company_deadlines || [];
    const contracts = STATE.data.company_contracts || [];
    const po = STATE.data.company_purchase_orders || [];
    const cases = STATE.data.company_service_cases || [];
    const tx = STATE.data.company_transactions || [];
    const bank = STATE.data.company_bank_movements || [];
    const files = STATE.data.company_files || [];
    const employees = STATE.data.company_employees || [];
    return {
      overdueInvoices: invoices.filter((x) => ["pending","partial"].includes(x.payment_status) && x.due_date && new Date(x.due_date) < now),
      rectification: projects.filter((x) => lifecycle(x)?.rectification),
      taxSoon: tax.filter((x) => !["paid","filed"].includes(x.status) && x.due_date && new Date(x.due_date) <= in7),
      warrantiesSoon: deadlines.filter((x) => x.entity_type === "project_warranty" && x.status === "open" && x.due_date && new Date(x.due_date) <= in30),
      contractsSoon: contracts.filter((x) => ["active","signed"].includes(x.status) && x.end_date && new Date(x.end_date) <= in30),
      poLate: po.filter((x) => !["completed","cancelled"].includes(x.status) && x.expected_date && new Date(x.expected_date) < now),
      postSale: cases.filter((x) => !["resolved","closed","cancelled"].includes(x.status)),
      unreconciled: tx.filter((x) => !x.reconciled && x.status === "paid").length + bank.filter((x) => !x.reconciled).length,
      filesExpiring: files.filter((x) => !x.archived && x.expires_at && new Date(x.expires_at) <= in30),
      employeesEnding: employees.filter((x) => x.status === "active" && x.end_date && new Date(x.end_date) <= in30),
      deadlines: deadlines.filter((x) => x.status === "open" && x.due_date && new Date(x.due_date) <= in30),
    };
  }

  async function renderAuditor() {
    if (!(await ensureAuth())) return;
    await syncAll({ silent: true });
    setTitle("Agente Auditor"); setActive(document.querySelector('[data-view="auditor"]'));
    const f = auditFindings(); const root = main(); root.dataset.syncV4 = "auditor";
    const cards = [
      ["Rectificación", f.rectification.length], ["Facturas vencidas", f.overdueInvoices.length], ["Tributos ≤7 días", f.taxSoon.length], ["Garantías ≤30 días", f.warrantiesSoon.length], ["Postventa abierta", f.postSale.length], ["Sin conciliar", f.unreconciled], ["OC atrasadas", f.poLate.length], ["Contratos ≤30 días", f.contractsSoon.length], ["Vencimientos", f.deadlines.length],
    ];
    const findings = [
      ...f.rectification.map((p) => [`Proyecto en rectificación: ${p.title}`, `Quedan ${lifecycle(p).remaining} factura(s) esperada(s).`]),
      ...f.overdueInvoices.map((i) => [`Factura vencida ${i.folio || "—"}`, `${i.issuer_name || ""} · ${money(i.total_amount)} · ${i.due_date}`]),
      ...f.taxSoon.map((x) => [`Tributo próximo ${String(x.record_type || "").toUpperCase()}`, `${x.period || ""} · vence ${x.due_date || "—"}`]),
      ...f.warrantiesSoon.map((x) => [`Garantía próxima a vencer`, `${x.title} · ${new Date(x.due_date).toLocaleDateString("es-CL")}`]),
      ...f.poLate.map((x) => [`OC atrasada ${x.order_number || "—"}`, `${x.expected_date || ""} · estado ${x.status}`]),
      ...f.contractsSoon.map((x) => [`Contrato próximo a vencer`, `${x.title} · ${x.end_date}`]),
      ...f.postSale.slice(0, 10).map((x) => [`Postventa ${x.case_number || "—"}`, `${x.title} · ${x.status} · ${x.priority}`]),
    ].slice(0, 35);
    root.innerHTML = `${syncBar()}<div class="s4-agent-head"><div><h2>Agente Auditor · Control 360° sincronizado</h2><p>Cruza proyectos, facturas, tributos, contratos, OC, documentos, inventario, postventa, garantías, tesorería, RR.HH. y vencimientos.</p></div><div class="button-row"><button id="s4-audit-run" class="btn primary">Ejecutar auditoría completa</button><button id="s4-audit-mira" class="btn ghost">Analizar con MIRA</button></div></div><div class="s4-kpis">${cards.map(([a, b]) => `<div class="s4-kpi"><small>${esc(a)}</small><strong>${b}</strong></div>`).join("")}</div><section class="s4-section"><h3>Hallazgos prioritarios</h3>${findings.length ? findings.map(([a, b]) => `<div class="s4-finding"><strong>${esc(a)}</strong><br><small>${esc(b)}</small></div>`).join("") : '<p class="muted small">No hay hallazgos prioritarios en las reglas automáticas actuales.</p>'}</section><section class="s4-section"><h3>Herramientas del Auditor</h3><div class="s4-tools">${[["Rectificación","Analiza todos los proyectos en rectificación y qué falta para cierre total."],["Garantías","Audita garantías base/extendidas y postventa asociada."],["Conciliación","Audita tesorería y movimientos bancarios sin conciliar."],["Documentos","Revisa documentos sin clasificación, vencimientos y lectura disponible."],["Contratos y OC","Revisa contratos y órdenes de compra con riesgo de atraso."],["RR.HH.","Revisa contratos y vencimientos de RR.HH."],["Fiscal","Audita IVA/F29, facturas y vencimientos tributarios."],["Inventario","Cruza inventario empresarial con inventarios internos por proyecto."]].map(([a,b])=>`<button class="s4-tool" data-s4-audit-tool="${esc(b)}">${esc(a)}</button>`).join("")}</div></section>`;
    document.getElementById("s4-audit-run").onclick = () => executePlan({ message: "Auditoría empresarial completa", actions: [{ op: "rpc", rpc: "company_run_audit", summary: "Ejecutar auditoría empresarial completa" }] });
    document.getElementById("s4-audit-mira").onclick = () => { sessionStorage.setItem("innova-mira-seed", "Analiza los hallazgos actuales del Agente Auditor y dime las acciones prioritarias que debo autorizar."); renderMira(); };
    document.querySelectorAll("[data-s4-audit-tool]").forEach((b) => b.onclick = () => { sessionStorage.setItem("innova-mira-seed", b.dataset.s4AuditTool); renderMira(); });
    bindCommonButtons();
  }

  function monthBounds(value) {
    const [y, m] = value.split("-").map(Number); const start = `${y}-${String(m).padStart(2, "0")}-01`; const next = new Date(Date.UTC(y, m, 1));
    return { start, next: `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01` };
  }

  async function renderFinance(month = new Date().toISOString().slice(0, 7)) {
    if (!(await ensureAuth())) return;
    await syncAll({ silent: true });
    setTitle("Agente Financiero"); setActive(document.getElementById("finance-agent-nav"));
    const { start, next } = monthBounds(month), root = main(); root.dataset.syncV4 = "finance";
    const invoices = (STATE.data.company_invoices || []).filter((x) => x.issue_date >= start && x.issue_date < next && x.payment_status !== "void");
    const sales = invoices.filter((x) => x.invoice_type === "sale"), purchases = invoices.filter((x) => x.invoice_type === "purchase");
    const debit = sales.reduce((a, b) => a + Number(b.vat_amount || 0), 0), credit = purchases.reduce((a, b) => a + Number(b.vat_amount || 0), 0), balance = debit - credit;
    const record = (STATE.data.company_tax_records || []).filter((x) => x.record_type === "f29" && String(x.period || "").slice(0, 7) === month).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))[0] || null;
    const tx = STATE.data.company_transactions || [], pendingReceivable = (STATE.data.company_invoices || []).filter((x) => x.invoice_type === "sale" && ["pending","partial"].includes(x.payment_status)).reduce((a,b)=>a+Number(b.total_amount||0),0), pendingPayable = (STATE.data.company_invoices || []).filter((x) => x.invoice_type === "purchase" && ["pending","partial"].includes(x.payment_status)).reduce((a,b)=>a+Number(b.total_amount||0),0), cashIn = tx.filter((x)=>x.direction==="income"&&x.status==="paid").reduce((a,b)=>a+Number(b.amount||0),0), cashOut = tx.filter((x)=>x.direction==="expense"&&x.status==="paid").reduce((a,b)=>a+Number(b.amount||0),0);
    root.innerHTML = `${syncBar()}<div class="s4-agent-head"><div><h2>Agente Financiero · Finanzas sincronizadas</h2><p>Consolida facturas, tesorería, movimientos bancarios, IVA/F29, cuentas por cobrar/pagar, conciliación y proyectos en rectificación.</p></div><div class="button-row"><button id="s4-fin-mira" class="btn primary">Gestionar con MIRA</button><button id="s4-fin-mail" class="btn ghost">Enviar recordatorio</button></div></div><section class="s4-section" style="margin-top:0"><label style="font-size:.78rem;font-weight:700">Período <input id="s4-fin-month" type="month" value="${month}" style="margin-left:8px;padding:8px;border:1px solid var(--line);border-radius:10px"></label></section><div class="s4-kpis"><div class="s4-kpi"><small>IVA débito</small><strong>${money(debit)}</strong></div><div class="s4-kpi"><small>IVA crédito</small><strong>${money(credit)}</strong></div><div class="s4-kpi"><small>IVA estimado</small><strong>${money(balance)}</strong></div><div class="s4-kpi"><small>Cuentas por cobrar</small><strong>${money(pendingReceivable)}</strong></div><div class="s4-kpi"><small>Cuentas por pagar</small><strong>${money(pendingPayable)}</strong></div><div class="s4-kpi"><small>Flujo registrado</small><strong>${money(cashIn - cashOut)}</strong></div><div class="s4-kpi"><small>F29</small><strong>${esc(record?.status || "sin registro")}</strong></div><div class="s4-kpi"><small>Sin conciliar</small><strong>${tx.filter((x)=>x.status==="paid"&&!x.reconciled).length + (STATE.data.company_bank_movements||[]).filter((x)=>!x.reconciled).length}</strong></div></div><section class="s4-section"><h3>Herramientas financieras</h3><div class="s4-tools">${[["Actualizar F29","Revisa el período seleccionado y prepara la actualización del control F29 con los DTE sincronizados."],["Cobranza","Analiza facturas por cobrar y prepara las gestiones prioritarias."],["Pagos","Analiza facturas de compra y pagos pendientes."],["Conciliación bancaria","Cruza tesorería y movimientos bancarios y detecta diferencias."],["Rectificación","Revisa proyectos cerrados con facturación pendiente."],["Flujo de caja","Analiza ingresos, egresos y compromisos."],["IVA","Explícame el cálculo de IVA del período usando las facturas sincronizadas."],["Recordatorios","Revisa vencimientos tributarios y prepara recordatorios por correo."]].map(([a,b])=>`<button class="s4-tool" data-s4-fin-tool="${esc(b)}">${esc(a)}</button>`).join("")}</div></section><section class="s4-section"><h3>DTE del período</h3><div style="overflow:auto">${invoices.length ? `<table class="s4-table"><thead><tr><th>Folio</th><th>Tipo</th><th>Fecha</th><th>Emisor</th><th>IVA</th><th>Total</th><th>Estado</th></tr></thead><tbody>${invoices.map((i)=>`<tr><td>${esc(i.folio||"—")}</td><td>${i.invoice_type==="purchase"?"Compra":"Venta"}</td><td>${esc(i.issue_date||"—")}</td><td>${esc(i.issuer_name||"—")}</td><td>${money(i.vat_amount)}</td><td>${money(i.total_amount)}</td><td>${esc(i.payment_status||"—")}</td></tr>`).join("")}</tbody></table>` : '<p class="muted small">Sin DTE en este período.</p>'}</div></section>`;
    document.getElementById("s4-fin-month").onchange = (e) => renderFinance(e.target.value);
    document.getElementById("s4-fin-mira").onclick = () => { sessionStorage.setItem("innova-mira-seed", `Analiza y gestiona las finanzas del período ${month}: IVA, cobranza, pagos, conciliación y rectificación.`); renderMira(); };
    document.querySelectorAll("[data-s4-fin-tool]").forEach((b) => b.onclick = () => { sessionStorage.setItem("innova-mira-seed", `${b.dataset.s4FinTool} Período: ${month}.`); renderMira(); });
    document.getElementById("s4-fin-mail").onclick = async () => {
      const due = record?.due_date; if (!due) return toast("Primero registra el vencimiento real del F29 para este período.", "warning");
      if (!window.confirm(`¿Enviar recordatorio F29 ${month} usando el Resend ya configurado?`)) return;
      try {
        const response = await fetch(`${cfg.backendUrl}/api/admin/notify`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${STATE.session.access_token}` }, body: JSON.stringify({ subject: `Recordatorio IVA / F29 ${month} · vence ${due}`, message: `Control preventivo Innova Admin.\nPeríodo: ${month}\nIVA débito: ${money(debit)}\nIVA crédito: ${money(credit)}\nIVA estimado: ${money(balance)}\nVencimiento registrado: ${due}\n\nRevisar SII antes de declarar o pagar.` }) });
        const data = await response.json().catch(()=>({})); if (!response.ok) throw new Error(data.error || `Error ${response.status}`); toast("Recordatorio enviado usando Resend.");
      } catch (error) { toast(error.message || "No se pudo enviar el recordatorio.", "error"); }
    };
    bindCommonButtons();
  }

  function bindCommonButtons() {
    document.querySelectorAll("[data-s4-sync-now]").forEach((b) => b.onclick = () => syncAll());
    document.querySelectorAll("[data-s4-ask-mira]").forEach((b) => b.onclick = () => { const section = document.getElementById("view-title")?.textContent || "esta sección"; sessionStorage.setItem("innova-mira-seed", `Analiza ${section} con toda la información sincronizada y dime qué debo gestionar.`); renderMira(); });
  }

  function enhanceEverySection() {
    reorderAgents(); installTopMira();
    const root = main();
    if (!root || root.dataset.syncV4 || root.querySelector(".loading-orb")) return;
    if (root.querySelector("#s4-global-ribbon")) return;
    const bar = document.createElement("div");
    bar.id = "s4-global-ribbon";
    bar.innerHTML = syncBar();
    root.prepend(bar.firstElementChild);
    bindCommonButtons();
  }

  function subscribeRealtime() {
    if (STATE.realtime) return;
    try {
      STATE.realtime = db.channel("innova-enterprise-sync-v4")
        .on("postgres_changes", { event: "*", schema: "public" }, () => {
          clearTimeout(window.__INNOVA_SYNC_V4_DEBOUNCE__);
          window.__INNOVA_SYNC_V4_DEBOUNCE__ = setTimeout(() => syncAll({ silent: true, indexDocs: true }), 900);
        })
        .subscribe();
    } catch (error) { console.warn("Realtime sync no disponible; se mantiene refresco periódico.", error); }
  }

  function interceptAgents(event) {
    const mira = event.target.closest?.('[data-view="mira"]');
    const auditor = event.target.closest?.('[data-view="auditor"]');
    const finance = event.target.closest?.("#finance-agent-nav");
    if (!mira && !auditor && !finance) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (mira) renderMira().catch((e)=>toast(e.message,"error"));
    if (auditor) renderAuditor().catch((e)=>toast(e.message,"error"));
    if (finance) renderFinance().catch((e)=>toast(e.message,"error"));
  }

  async function init() {
    injectStyles(); reorderAgents(); installTopMira();
    if (await ensureAuth()) {
      await syncAll({ silent: true });
      subscribeRealtime();
      enhanceEverySection();
    }
  }

  document.addEventListener("click", interceptAgents, true);
  const observer = new MutationObserver(() => { reorderAgents(); installTopMira(); enhanceEverySection(); });
  if (main()) observer.observe(main(), { childList: true, subtree: false });
  const nav = document.getElementById("side-nav"); if (nav) observer.observe(nav, { childList: true, subtree: false });
  window.addEventListener("innova-enterprise-ready", init);
  window.addEventListener("innova-agent-command-center-ready", init);
  window.addEventListener("focus", () => syncAll({ silent: true }));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) syncAll({ silent: true }); });
  setInterval(() => { if (!document.hidden) syncAll({ silent: true }); }, 60000);
  db.auth.onAuthStateChange((_event, session) => { STATE.session = session; STATE.profile = null; if (session) setTimeout(init, 300); });
  setTimeout(init, 700);
})();
