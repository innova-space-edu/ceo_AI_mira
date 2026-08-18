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
    company_documents: ["project_id","document_type","title","status","content","metadata"],
    company_document_versions: ["document_id","version_number","content","change_note"],
    company_contracts: ["contract_number","title","contract_type","party_id","project_id","status","start_date","end_date","renewal_date","amount","notes"],
    company_files: ["title","category","project_id","party_id","document_number","occurred_at","expires_at","archived","storage_path","path","file_path","mime_type","file_name","notes"],
    company_invoices: ["project_id","invoice_type","dte_type","folio","issuer_rut","issuer_name","recipient_rut","issue_date","due_date","net_amount","exempt_amount","vat_amount","total_amount","payment_status","notes"],
    company_transactions: ["direction","project_id","party_id","invoice_id","purchase_order_id","transaction_date","due_date","paid_at","amount","status","payment_method","bank_reference","description","reconciled"],
    company_bank_movements: ["account_label","movement_date","description","amount","reference","balance","transaction_id","reconciled"],
    company_tax_records: ["period","record_type","status","due_date","net_amount","debit_vat","credit_vat","ppm_amount","tax_amount","total_amount","notes"],
    company_employees: ["full_name","rut","position","contract_type","start_date","end_date","status","email","phone","leave_balance","notes"],
    company_assets: ["asset_code","name","category","serial_number","project_id","employee_id","supplier_party_id","purchase_invoice_id","purchase_date","cost","warranty_until","location","status","notes"],
    company_service_cases: ["case_number","case_type","title","party_id","project_id","asset_id","invoice_id","status","priority","opened_at","due_at","resolved_at","assigned_to","description","resolution"],
    company_approvals: ["entity_type","entity_id","step","status","approver_id","decided_at","note"],
    company_deadlines: ["entity_type","entity_id","title","due_date","priority","status","owner_id","remind_days","notes"],
    company_entity_links: ["source_type","source_id","target_type","target_id","relationship","notes"],
    company_templates: ["name","category","document_type","content","active","notes"],
    company_meetings: ["project_id","title","meeting_date","location","participants","notes","status"],
    company_alerts: ["title","message","severity","status","entity_type","entity_id"],
    company_users: ["full_name","email","rut","role","status","must_change_password"],
    company_settings: ["key","value","category"],
    company_activity: ["user_id","action","entity_type","entity_id","details"],
    company_project_events: ["project_id","event_type","title","description","event_date","amount","direction","status"],
  };

  const MODULES = [
    "Proyectos","Clientes y proveedores","Cotizaciones","Órdenes de compra","Facturas/DTE",
    "Documentos","Contratos","Archivo empresarial","Activos e inventario","Garantías y postventa",
    "Operación y gastos","Tesorería y conciliación","Tributario/F29/IVA","RR.HH.",
    "Aprobaciones y vencimientos","Usuarios","Actividad","Configuración","Alertas","Plantillas"
  ];

  const S = {
    session: null,
    profile: null,
    data: {},
    selectedProjectId: "",
    selectedInvoiceId: "",
    history: [],
    syncedAt: null,
    syncing: false,
    rendering: false,
    docsText: new Map(),
  };

  const esc = (v = "") => String(v ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const norm = (v = "") => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const money = (v) => new Intl.NumberFormat("es-CL", { style:"currency", currency:"CLP", maximumFractionDigits:0 }).format(Number(v || 0));
  const main = () => document.getElementById("main-content");

  function toast(message, type = "success") {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => el.remove(), 5200);
  }

  async function auth() {
    if (!S.session) S.session = (await db.auth.getSession()).data?.session || null;
    if (!S.session?.user) return false;
    if (!S.profile) {
      const { data } = await db.from("company_users").select("user_id,email,full_name,role,status,rut").eq("user_id", S.session.user.id).maybeSingle();
      S.profile = data || null;
    }
    return !!S.profile && S.profile.status === "active";
  }

  async function aal2() {
    return (await db.auth.mfa.getAuthenticatorAssuranceLevel()).data?.currentLevel === "aal2";
  }

  async function rows(table, limit = 350) {
    try {
      const { data, error } = await db.from(table).select("*").limit(limit);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn(`MIRA v5: no se pudo leer ${table}:`, error.message || error);
      return [];
    }
  }

  async function syncAll({ silent = true } = {}) {
    if (S.syncing || !(await auth())) return S.data;
    S.syncing = true;
    updateSyncUi(true);
    try {
      const names = Object.keys(TABLES);
      const results = await Promise.all(names.map((t) => rows(t)));
      names.forEach((t, i) => { S.data[t] = results[i]; });
      S.syncedAt = new Date();
      window.dispatchEvent(new CustomEvent("innova-business-sync", { detail:{ at:S.syncedAt, source:"mira-v5" } }));
      if (!silent) toast("MIRA actualizó el contexto empresarial.");
      return S.data;
    } finally {
      S.syncing = false;
      updateSyncUi(false);
    }
  }

  function updateSyncUi(busy) {
    const dot = document.querySelector("[data-mv5-dot]");
    if (dot) dot.classList.toggle("busy", !!busy);
    const label = document.querySelector("[data-mv5-sync]");
    if (label) label.textContent = busy ? "Sincronizando…" : (S.syncedAt ? `Actualizado ${S.syncedAt.toLocaleTimeString("es-CL", {hour:"2-digit",minute:"2-digit"})}` : "Bajo demanda");
  }

  function styles() {
    if (document.getElementById("mira-v5-style")) return;
    const s = document.createElement("style");
    s.id = "mira-v5-style";
    s.textContent = `
      .mv5-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:14px}.mv5-head h2{margin:0 0 5px}.mv5-head p{margin:0;color:var(--muted);max-width:900px}.mv5-state{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.mv5-live{display:inline-flex;gap:7px;align-items:center;padding:6px 9px;border-radius:999px;background:#eef8f3;color:#167447;font-size:.7rem;font-weight:800}.mv5-dot{width:7px;height:7px;border-radius:50%;background:#18a765}.mv5-dot.busy{background:#e5a31a;animation:mv5pulse 1s infinite}@keyframes mv5pulse{50%{opacity:.4}}
      .mv5-grid{display:grid;grid-template-columns:330px 1fr;gap:16px}.mv5-side,.mv5-chat{background:#fff;border:1px solid var(--line);border-radius:20px}.mv5-side{padding:17px}.mv5-side h3{margin:0 0 12px}.mv5-side label{display:flex;flex-direction:column;gap:5px;font-size:.78rem;font-weight:800;margin-bottom:10px}.mv5-side select{padding:10px;border:1px solid var(--line);border-radius:11px;background:#fff}.mv5-tools{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:10px}.mv5-tool{border:1px solid #e0e7f4;background:#f8fbff;border-radius:11px;padding:8px;text-align:left;font-size:.68rem;font-weight:800;color:#315b9d;cursor:pointer}.mv5-tool:hover{background:#eef4ff}.mv5-docs{margin-top:12px;padding:10px;border:1px dashed #ccd6e8;border-radius:12px;font-size:.7rem;color:var(--muted)}
      .mv5-chat{overflow:hidden}.mv5-msgs{height:500px;overflow:auto;padding:18px;background:#fbfcff}.mv5-msg{max-width:86%;padding:11px 13px;border-radius:14px;margin-bottom:9px;white-space:pre-wrap;line-height:1.5}.mv5-msg.user{margin-left:auto;background:#315efb;color:#fff}.mv5-msg.mira{background:#eef2f8}.mv5-msg.ok{background:#e9f8ef;color:#17633d}.mv5-msg.warn{background:#fff4dc;color:#765500}.mv5-msg.plan{background:#f2efff;color:#46339a;border:1px solid #ddd5ff}.mv5-input{display:grid;grid-template-columns:1fr auto;gap:8px;padding:13px;border-top:1px solid var(--line)}.mv5-input textarea{min-height:64px;border:1px solid #bac7ef;border-radius:12px;padding:11px;font:inherit;resize:vertical}.mv5-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:10px 0}.mv5-kpi{padding:9px;border-radius:11px;background:#f7f9fd;border:1px solid #e7ebf4}.mv5-kpi small{display:block;color:var(--muted);font-size:.62rem}.mv5-kpi strong{display:block;margin-top:2px;font-size:.78rem}
      .mv5-modal{position:fixed;inset:0;background:#08101f99;z-index:10020;display:grid;place-items:center;padding:18px}.mv5-modal>div{width:min(820px,96vw);max-height:88vh;overflow:auto;background:#fff;border-radius:20px;padding:20px}.mv5-action{padding:11px;border:1px solid var(--line);border-radius:12px;margin:8px 0}.mv5-action small{color:var(--muted)}.mv5-sensitive{padding:11px;border:1px solid #ffd895;background:#fff6e4;border-radius:12px;margin:10px 0}.mv5-row{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:14px}.mv5-badge{display:inline-flex;padding:4px 7px;border-radius:999px;background:#eef4ff;color:#3858b8;font-size:.63rem;font-weight:800;margin:2px}.mv5-capabilities{display:flex;gap:4px;flex-wrap:wrap;margin-top:9px}
      @media(max-width:900px){.mv5-grid{grid-template-columns:1fr}.mv5-msgs{height:390px}.mv5-tools{grid-template-columns:1fr}.mv5-kpis{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(s);
  }

  function selectedProject() {
    return (S.data.company_projects || []).find((x) => x.id === S.selectedProjectId) || null;
  }
  function selectedInvoice() {
    return (S.data.company_invoices || []).find((x) => x.id === S.selectedInvoiceId) || null;
  }

  function summarize() {
    const d = S.data;
    const projects = d.company_projects || [];
    const invoices = d.company_invoices || [];
    const tx = d.company_transactions || [];
    const tax = d.company_tax_records || [];
    const service = d.company_service_cases || [];
    const deadlines = d.company_deadlines || [];
    const assets = d.company_assets || [];
    const files = d.company_files || [];
    const pendingSales = invoices.filter((x) => x.invoice_type === "sale" && ["pending","partial"].includes(x.payment_status)).reduce((a,b)=>a+Number(b.total_amount||0),0);
    const pendingPurchases = invoices.filter((x) => x.invoice_type === "purchase" && ["pending","partial"].includes(x.payment_status)).reduce((a,b)=>a+Number(b.total_amount||0),0);
    return {
      projects: projects.length,
      invoices: invoices.length,
      receivable: pendingSales,
      payable: pendingPurchases,
      unreconciled: tx.filter((x)=>x.status === "paid" && !x.reconciled).length,
      taxPending: tax.filter((x)=>!["paid","filed"].includes(x.status)).length,
      postSaleOpen: service.filter((x)=>!["resolved","closed","cancelled"].includes(x.status)).length,
      deadlinesOpen: deadlines.filter((x)=>x.status === "open").length,
      assets: assets.length,
      files: files.length,
    };
  }

  function compactRow(row, fields) {
    if (!row) return null;
    const out = { id:row.id };
    for (const key of fields || []) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== "") out[key] = row[key];
    }
    return out;
  }

  function contextPayload() {
    const out = {};
    for (const [table, fields] of Object.entries(TABLES)) {
      const values = S.data[table] || [];
      let selected = values;
      if (S.selectedProjectId && ["company_files","company_documents","company_quotations","company_purchase_orders","company_contracts","company_invoices","company_transactions","company_assets","company_service_cases","company_project_events"].includes(table)) {
        const related = values.filter((x) => x.project_id === S.selectedProjectId || x.id === S.selectedProjectId);
        const rest = values.filter((x) => !related.includes(x)).slice(0, 20);
        selected = [...related.slice(0, 80), ...rest];
      } else selected = values.slice(0, 80);
      out[table] = selected.map((x) => compactRow(x, fields));
    }
    if (S.docsText.size) out.document_text_index = [...S.docsText.entries()].slice(0, 12).map(([id, text]) => ({ id, text:text.slice(0,12000) }));
    return JSON.stringify(out).slice(0, 42000);
  }

  function toolProtocol(userText) {
    const schema = Object.entries(TABLES).map(([table, fields]) => `${table}: ${fields.join(", ")}`).join("\n");
    return `
PROTOCOLO INTERNO MIRA ORQUESTADOR v5.
Analiza la solicitud del usuario y el contexto. Devuelve EXCLUSIVAMENTE JSON válido, sin markdown.

FORMATO:
{
  "mode": "chat|answer|plan",
  "reply": "respuesta breve para el usuario",
  "actions": [
    {
      "op": "insert|update|delete|rpc|function|notify",
      "table": "nombre_tabla",
      "id": "uuid opcional",
      "values": {},
      "rpc": "company_run_audit",
      "function": "company-user-admin",
      "body": {},
      "subject": "",
      "message": "",
      "summary": "qué hará"
    }
  ]
}

REGLAS:
- mode=chat para saludo/conversación y actions=[]; responde normalmente.
- mode=answer para preguntas que solo requieren leer/analizar; actions=[].
- mode=plan cuando el usuario pide cambiar, crear, registrar, cerrar, aprobar, conciliar, pagar, actualizar, eliminar, notificar o ejecutar algo.
- No inventes ids. Usa únicamente ids presentes en CONTEXTO.
- Para update/delete usa id cuando exista.
- Si faltan datos obligatorios, no fabriques valores: responde qué dato falta y actions=[].
- Puedes encadenar varias acciones en un solo plan si una gestión afecta varios módulos.
- Para auditoría usa op=rpc rpc=company_run_audit.
- Para crear/administrar usuarios usa op=function function=company-user-admin y body con action compatible: provision, change_role, set_status, reset_password cuando sea apropiado.
- Para correo administrativo usa op=notify.
- Un proyecto con ejecución terminada pero facturación pendiente debe quedar administrativamente en rectificación, no reactivar la ejecución física.
- Al cierre total, si corresponde, puedes crear un vencimiento company_deadlines de garantía base 3 meses; extensión solicitada = 6 meses.
- Inventario maestro usa company_assets; si tiene project_id también es inventario interno de ese proyecto.
- Nunca propongas service_role, credenciales ni operaciones fuera de este catálogo.

CATÁLOGO DE CAMPOS EDITABLES:
${schema}

MÓDULOS DISPONIBLES: ${MODULES.join(", ")}

SOLICITUD DEL USUARIO: ${userText}
    `.trim();
  }

  async function callMira(userText) {
    if (!(await auth())) throw new Error("Sesión administrativa no disponible");
    const response = await fetch(`${cfg.backendUrl}/api/admin/mira`, {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        Authorization:`Bearer ${S.session.access_token}`,
      },
      body:JSON.stringify({
        message:toolProtocol(userText),
        context:contextPayload(),
        history:S.history.slice(-8),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "No fue posible consultar MIRA Business");
    const raw = String(data.reply || "").trim();
    let parsed = null;
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (_) {
      return { mode:"chat", reply:raw || "No pude generar respuesta.", actions:[] };
    }
    return {
      mode:["chat","answer","plan"].includes(parsed.mode) ? parsed.mode : "answer",
      reply:String(parsed.reply || "").trim(),
      actions:Array.isArray(parsed.actions) ? parsed.actions : [],
    };
  }

  function validAction(action) {
    if (!action || !["insert","update","delete","rpc","function","notify"].includes(action.op)) return null;
    if (["insert","update","delete"].includes(action.op)) {
      const allowed = TABLES[action.table];
      if (!allowed) return null;
      const values = {};
      for (const [k,v] of Object.entries(action.values || {})) if (allowed.includes(k)) values[k] = v;
      if (action.op === "insert" && !Object.keys(values).length) return null;
      if (action.op === "update" && (!action.id || !Object.keys(values).length)) return null;
      if (action.op === "delete" && !action.id) return null;
      return { ...action, values, summary:String(action.summary || `${action.op} ${action.table}`) };
    }
    if (action.op === "rpc") return action.rpc === "company_run_audit" ? { ...action, summary:String(action.summary || "Ejecutar auditoría") } : null;
    if (action.op === "function") return action.function === "company-user-admin" ? { ...action, summary:String(action.summary || "Administrar usuario") } : null;
    if (action.op === "notify") return action.message ? { ...action, subject:String(action.subject || "Notificación Innova Admin"), message:String(action.message), summary:String(action.summary || "Enviar notificación") } : null;
    return null;
  }

  function isSensitive(action) {
    if (!action) return false;
    if (action.op === "delete" || action.op === "function") return true;
    if (["company_users","company_settings","company_tax_records"].includes(action.table)) return true;
    if (action.op === "update" && action.table === "company_invoices" && action.values?.payment_status === "void") return true;
    return false;
  }

  function showPlan(reply, rawActions) {
    const actions = rawActions.map(validAction).filter(Boolean);
    if (!actions.length) {
      addMsg(reply || "No hay una acción ejecutable válida en este plan.", "warn");
      return;
    }
    const root = document.createElement("div");
    root.id = "mv5-permission";
    root.className = "mv5-modal";
    const sensitive = actions.some(isSensitive);
    root.innerHTML = `<div><h3>Autorizar a MIRA</h3><p>${esc(reply || "MIRA preparó estas gestiones.")}</p>${actions.map((a,i)=>`<div class="mv5-action"><strong>${i+1}. ${esc(a.summary)}</strong><br><small>${esc(a.table || a.rpc || a.function || "notificación")}</small></div>`).join("")}${sensitive?'<div class="mv5-sensitive"><strong>Acción sensible:</strong> se exigirá MFA antes de ejecutar.</div>':""}<div class="mv5-row"><button id="mv5-cancel" class="btn ghost">Cancelar</button><button id="mv5-authorize" class="btn primary">Autorizar y ejecutar</button></div></div>`;
    document.body.appendChild(root);
    root.querySelector("#mv5-cancel").onclick = () => root.remove();
    root.querySelector("#mv5-authorize").onclick = () => executePlan(actions, sensitive);
  }

  async function executePlan(actions, sensitive) {
    if (sensitive && !(await aal2())) {
      toast("Esta gestión requiere MFA. Verifica MFA desde tu menú de usuario y vuelve a autorizar.", "warning");
      return;
    }
    const btn = document.getElementById("mv5-authorize");
    if (btn) { btn.disabled = true; btn.textContent = "Ejecutando…"; }
    const results = [];
    try {
      for (const action of actions) {
        if (action.op === "insert") {
          const { data, error } = await db.from(action.table).insert(action.values).select("*").limit(1);
          if (error) throw error;
          results.push({ action:action.summary, ok:true, id:data?.[0]?.id || null });
        } else if (action.op === "update") {
          const { data, error } = await db.from(action.table).update(action.values).eq("id", action.id).select("*").limit(1);
          if (error) throw error;
          if (!data?.length) throw new Error(`No se confirmó la actualización en ${action.table}`);
          results.push({ action:action.summary, ok:true, id:action.id });
        } else if (action.op === "delete") {
          const { error } = await db.from(action.table).delete().eq("id", action.id);
          if (error) throw error;
          results.push({ action:action.summary, ok:true, id:action.id });
        } else if (action.op === "rpc") {
          const { error } = await db.rpc(action.rpc);
          if (error) throw error;
          results.push({ action:action.summary, ok:true });
        } else if (action.op === "function") {
          const { data, error } = await db.functions.invoke(action.function, { body:action.body || {} });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          results.push({ action:action.summary, ok:true });
        } else if (action.op === "notify") {
          const r = await fetch(`${cfg.backendUrl}/api/admin/notify`, {
            method:"POST",
            headers:{ "Content-Type":"application/json", Authorization:`Bearer ${S.session.access_token}` },
            body:JSON.stringify({ subject:action.subject, message:action.message }),
          });
          const data = await r.json().catch(()=>({}));
          if (!r.ok) throw new Error(data.error || "No se pudo enviar la notificación");
          results.push({ action:action.summary, ok:true });
        }
      }
      document.getElementById("mv5-permission")?.remove();
      await syncAll({ silent:true });
      addMsg(`Gestión completada. ${results.length} acción(es) ejecutada(s) y verificadas.`, "ok");
      toast("MIRA ejecutó y verificó la gestión autorizada.");
    } catch (error) {
      document.getElementById("mv5-permission")?.remove();
      addMsg(`La ejecución se detuvo: ${error.message || error}. Las acciones posteriores no se ejecutaron.`, "warn");
      toast(error.message || "Error ejecutando la gestión", "error");
      await syncAll({ silent:true });
    }
  }

  function addMsg(text, kind = "mira") {
    const box = document.getElementById("mv5-msgs");
    if (!box) return;
    const el = document.createElement("div");
    el.className = `mv5-msg ${kind}`;
    el.textContent = text;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  }

  async function send() {
    const input = document.getElementById("mv5-input");
    const text = input?.value.trim();
    if (!text) return;
    input.value = "";
    addMsg(text, "user");
    const sendBtn = document.getElementById("mv5-send");
    if (sendBtn) sendBtn.disabled = true;
    try {
      if (!S.syncedAt) await syncAll({ silent:true });
      addMsg("Analizando la empresa y seleccionando herramientas…", "plan");
      const pending = document.querySelector("#mv5-msgs .mv5-msg.plan:last-child");
      const result = await callMira(text);
      pending?.remove();
      if (result.mode === "plan" && result.actions.length) showPlan(result.reply, result.actions);
      else addMsg(result.reply || "Listo.", "mira");
      S.history.push({ role:"user", content:text }, { role:"assistant", content:result.reply || "" });
      S.history = S.history.slice(-12);
    } catch (error) {
      document.querySelector("#mv5-msgs .mv5-msg.plan:last-child")?.remove();
      addMsg(`No pude completar la consulta: ${error.message || error}`, "warn");
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      input?.focus();
    }
  }

  async function extractPdf(file) {
    if (!window.pdfjsLib) return "";
    const pdf = await window.pdfjsLib.getDocument({ data:new Uint8Array(await file.arrayBuffer()) }).promise;
    let text = "";
    for (let n=1; n<=Math.min(pdf.numPages,50); n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      text += content.items.map((x)=>x.str).join(" ") + "\n";
      if (text.length > 100000) break;
    }
    return text.slice(0,100000);
  }

  async function extractDocx(file) {
    if (!window.JSZip) return "";
    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    const xml = await zip.file("word/document.xml")?.async("text");
    if (!xml) return "";
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    return [...doc.getElementsByTagName("w:t")].map((n)=>n.textContent).join(" ").slice(0,100000);
  }

  async function indexDocuments() {
    if (!(await auth())) return;
    if (!S.syncedAt) await syncAll({ silent:true });
    const files = (S.data.company_files || []).filter((x)=>!x.archived);
    const selected = S.selectedProjectId ? files.filter((x)=>x.project_id === S.selectedProjectId) : files.slice(0,12);
    let count = 0;
    for (const row of selected.slice(0,12)) {
      if (S.docsText.has(row.id)) { count += 1; continue; }
      const path = row.storage_path || row.file_path || row.path;
      if (!path) continue;
      try {
        const { data, error } = await db.storage.from(cfg.storageBucket || "company-files").download(path);
        if (error || !data) continue;
        const name = String(row.file_name || row.title || path).toLowerCase();
        let text = "";
        if (name.endsWith(".pdf") || data.type === "application/pdf") text = await extractPdf(data);
        else if (name.endsWith(".docx")) text = await extractDocx(data);
        else if (/\.(txt|csv|json|xml|html?|md)$/i.test(name) || /^text\//.test(data.type)) text = (await data.text()).slice(0,100000);
        if (text.trim()) { S.docsText.set(row.id, text.trim()); count += 1; }
      } catch (_) {}
    }
    const node = document.getElementById("mv5-doc-status");
    if (node) node.textContent = `${count} documento(s) con texto disponibles para MIRA en esta sesión.`;
    toast(`Índice documental actualizado: ${count} documento(s).`);
  }

  function toolPrompt(text) {
    const input = document.getElementById("mv5-input");
    if (!input) return;
    input.value = text;
    input.focus();
  }

  function render() {
    if (S.rendering) return;
    const m = main();
    const pageTitle = document.getElementById("view-title")?.textContent?.trim();
    if (!m || pageTitle !== "MIRA Business") return;
    if (m.dataset.miraV5 === "ready") return;
    S.rendering = true;
    try {
      styles();
      m.dataset.miraV5 = "ready";
      const projects = S.data.company_projects || [];
      const invoices = S.data.company_invoices || [];
      const k = summarize();
      m.innerHTML = `
        <div class="mv5-head"><div><h2>MIRA Business · Orquestador total</h2><p>Conversa, consulta, organiza y ejecuta gestiones en toda Innova Admin. MIRA lee el contexto necesario, prepara un plan, pide autorización y verifica el resultado.</p></div><div class="mv5-state"><span class="mv5-live"><span class="mv5-dot" data-mv5-dot></span><span data-mv5-sync>${S.syncedAt ? "Contexto listo" : "Bajo demanda"}</span></span><span class="mv5-badge">RLS</span><span class="mv5-badge">MFA sensible</span></div></div>
        <div class="mv5-grid">
          <aside class="mv5-side">
            <h3>Contexto y herramientas</h3>
            <label>Proyecto<select id="mv5-project"><option value="">Toda la empresa</option>${projects.map((p)=>`<option value="${esc(p.id)}">${esc(p.title || p.code || p.id)}</option>`).join("")}</select></label>
            <label>Factura<select id="mv5-invoice"><option value="">Detectar automáticamente</option>${invoices.slice(0,200).map((i)=>`<option value="${esc(i.id)}">${esc(i.folio || "sin folio")} · ${esc(i.issuer_name || i.recipient_rut || "")}</option>`).join("")}</select></label>
            <div class="mv5-kpis"><div class="mv5-kpi"><small>Proyectos</small><strong>${k.projects}</strong></div><div class="mv5-kpi"><small>Facturas</small><strong>${k.invoices}</strong></div><div class="mv5-kpi"><small>Archivos</small><strong>${k.files}</strong></div><div class="mv5-kpi"><small>Por cobrar</small><strong>${esc(money(k.receivable))}</strong></div><div class="mv5-kpi"><small>Por pagar</small><strong>${esc(money(k.payable))}</strong></div><div class="mv5-kpi"><small>Postventa</small><strong>${k.postSaleOpen}</strong></div></div>
            <div class="mv5-tools">
              <button class="mv5-tool" data-prompt="Revisa todos los proyectos y dime qué requiere gestión.">Proyectos 360°</button>
              <button class="mv5-tool" data-prompt="Revisa facturas, tesorería, banco e IVA/F29 y dime pendientes e inconsistencias.">Finanzas</button>
              <button class="mv5-tool" data-prompt="Revisa órdenes de compra, cotizaciones y contratos relacionados y dime qué falta.">Compras/contratos</button>
              <button class="mv5-tool" data-prompt="Revisa activos, inventario corporativo e inventario por proyecto; detecta faltantes y garantías.">Inventario</button>
              <button class="mv5-tool" data-prompt="Revisa garantías y postventa: casos abiertos, vencimientos y cobertura de proyectos.">Postventa</button>
              <button class="mv5-tool" data-prompt="Revisa RR.HH., usuarios, aprobaciones y vencimientos que requieran atención.">RR.HH./usuarios</button>
              <button class="mv5-tool" data-prompt="Ejecuta una auditoría empresarial completa y luego explícame los hallazgos.">Auditoría</button>
              <button class="mv5-tool" id="mv5-refresh">Actualizar contexto</button>
            </div>
            <div class="mv5-docs"><strong>Documentos</strong><br><span id="mv5-doc-status">MIRA usa metadatos de archivo. Puedes indexar el texto de PDF/DOCX/TXT compatibles cuando lo necesites.</span><br><button id="mv5-index-docs" class="btn ghost" style="margin-top:8px">Leer documentos</button></div>
            <div class="mv5-capabilities">${MODULES.map((x)=>`<span class="mv5-badge">${esc(x)}</span>`).join("")}</div>
          </aside>
          <section class="mv5-chat">
            <div id="mv5-msgs" class="mv5-msgs"><div class="mv5-msg mira">Soy MIRA Business. Puedo conversar contigo, investigar toda la operación y preparar gestiones sobre cualquier módulo de Innova Admin. Si una solicitud modifica datos, te mostraré exactamente el plan antes de ejecutarlo.</div></div>
            <div class="mv5-input"><textarea id="mv5-input" placeholder="Ej.: Revisa completamente el proyecto Tablets, dime qué falta y realiza las gestiones necesarias para dejarlo correctamente en rectificación si corresponde."></textarea><button id="mv5-send" class="btn primary"><i class="ri-send-plane-2-line"></i></button></div>
          </section>
        </div>`;
      const ps = document.getElementById("mv5-project");
      const is = document.getElementById("mv5-invoice");
      ps.value = S.selectedProjectId; is.value = S.selectedInvoiceId;
      ps.onchange = () => { S.selectedProjectId = ps.value; S.docsText.clear(); };
      is.onchange = () => { S.selectedInvoiceId = is.value; };
      document.getElementById("mv5-send").onclick = send;
      document.getElementById("mv5-input").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
      document.getElementById("mv5-refresh").onclick = async () => { await syncAll({ silent:false }); m.dataset.miraV5 = ""; render(); };
      document.getElementById("mv5-index-docs").onclick = () => indexDocuments().catch((e)=>toast(e.message || "No se pudieron leer documentos", "error"));
      m.querySelectorAll("[data-prompt]").forEach((b)=>b.onclick=()=>toolPrompt(b.dataset.prompt));
    } finally { S.rendering = false; }
  }

  async function enterMira() {
    if (!(await auth())) return;
    await syncAll({ silent:true });
    const m = main();
    if (m) m.dataset.miraV5 = "";
    render();
  }

  let timer = null;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (document.getElementById("view-title")?.textContent?.trim() === "MIRA Business") enterMira().catch((e)=>console.error("MIRA v5", e));
    }, 160);
  }

  const m = main();
  if (m) new MutationObserver(schedule).observe(m, { childList:true, subtree:false });
  document.addEventListener("click", (e) => {
    if (e.target.closest?.('[data-view="mira"]') || e.target.closest?.("#dash-open-mira") || e.target.closest?.('[data-das-view="mira"]')) setTimeout(schedule, 220);
  }, true);
  window.addEventListener("innova-agent-command-center-ready", schedule);
  window.addEventListener("innova-enterprise-ready", schedule);
  db.auth.onAuthStateChange((_event, session) => { S.session = session; S.profile = null; if (!session) { S.data = {}; S.syncedAt = null; } });
  schedule();
})();
