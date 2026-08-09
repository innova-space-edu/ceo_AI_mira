(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  if (params.get("safe") === "1") return;

  const cfg = window.INNOVA_ADMIN_CONFIG;
  if (!cfg?.supabaseUrl || !cfg?.supabasePublishableKey) return;

  const EDIT_ROLES = new Set(["superadmin", "admin", "finance", "project_manager"]);
  const DELETE_ROLES = new Set(["superadmin", "admin"]);
  const FINANCE_EDIT = new Set(["superadmin", "admin", "finance"]);
  const ADMIN_EDIT = new Set(["superadmin", "admin"]);

  let profile = null;
  let profilePromise = null;
  let enhanceTimer = null;
  let managerState = null;
  const lookupCache = new Map();

  const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[c]));
  const enc = (value = "") => encodeURIComponent(String(value));
  const money = (value) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(value || 0));

  function findStoredSession() {
    const preferred = "sb-alogqktilzgylzomzwem-auth-token";
    const keys = [preferred, ...Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))]
      .filter(Boolean)
      .filter((key, index, list) => list.indexOf(key) === index);
    for (const key of keys) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "null");
        const candidates = [parsed, parsed?.currentSession, parsed?.session, parsed?.data?.session];
        for (const candidate of candidates) if (candidate?.access_token) return candidate;
      } catch (_) {}
    }
    return null;
  }

  function jwtSub(token = "") {
    try {
      const payload = token.split(".")[1];
      if (!payload) return "";
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
      return JSON.parse(atob(padded))?.sub || "";
    } catch (_) { return ""; }
  }

  async function rest(path, options = {}) {
    const session = findStoredSession();
    if (!session?.access_token) throw new Error("La sesión administrativa no está disponible.");
    const response = await fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: cfg.supabasePublishableKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch (_) { data = text; }
    }
    if (!response.ok) throw new Error(data?.message || data?.details || data?.hint || `Error ${response.status}`);
    return data;
  }

  async function storageRequest(path, options = {}) {
    const session = findStoredSession();
    if (!session?.access_token) throw new Error("La sesión administrativa no está disponible.");
    const response = await fetch(`${cfg.supabaseUrl}/storage/v1/${path}`, {
      ...options,
      headers: {
        apikey: cfg.supabasePublishableKey,
        Authorization: `Bearer ${session.access_token}`,
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch (_) { data = text; }
    }
    if (!response.ok) throw new Error(data?.message || data?.error || `Storage ${response.status}`);
    return data;
  }

  function storagePath(path) {
    return String(path || "").split("/").map(enc).join("/");
  }

  async function loadProfile() {
    if (profile) return profile;
    if (profilePromise) return profilePromise;
    profilePromise = (async () => {
      const session = findStoredSession();
      const userId = jwtSub(session?.access_token || "");
      if (!userId) return null;
      const rows = await rest(`company_users?select=user_id,role,status&user_id=eq.${enc(userId)}&limit=1`);
      profile = Array.isArray(rows) ? rows[0] : null;
      return profile;
    })().finally(() => { profilePromise = null; });
    return profilePromise;
  }

  function hasRole(allowed) {
    return !!profile && profile.status === "active" && allowed.has(profile.role);
  }

  function toast(message, type = "success") {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const item = document.createElement("div");
    item.className = `toast ${type}`;
    item.textContent = message;
    root.appendChild(item);
    setTimeout(() => item.remove(), 5200);
  }

  const RELATIONS = {
    project: { table: "company_projects", select: "id,title", value: "id", label: (r) => r.title },
    party: { table: "company_parties", select: "id,name,rut", value: "id", label: (r) => `${r.name}${r.rut ? ` · ${r.rut}` : ""}` },
    employee: { table: "company_employees", select: "id,full_name,rut", value: "id", label: (r) => `${r.full_name}${r.rut ? ` · ${r.rut}` : ""}` },
    invoice: { table: "company_invoices", select: "id,folio,issuer_name,total_amount", value: "id", label: (r) => `Factura ${r.folio || "—"} · ${r.issuer_name || ""} · ${money(r.total_amount)}` },
    quotation: { table: "company_quotations", select: "id,quote_number,client_name,total_amount", value: "id", label: (r) => `${r.quote_number || "Cotización"} · ${r.client_name || ""} · ${money(r.total_amount)}` },
    document: { table: "company_documents", select: "id,title,document_type", value: "id", label: (r) => `${r.title} · ${r.document_type}` },
    transaction: { table: "company_transactions", select: "id,description,amount,transaction_date", value: "id", label: (r) => `${r.description || "Movimiento"} · ${money(r.amount)} · ${r.transaction_date || ""}` },
    purchase_order: { table: "company_purchase_orders", select: "id,order_number,total_amount", value: "id", label: (r) => `${r.order_number} · ${money(r.total_amount)}` },
    user: { table: "company_users", select: "user_id,full_name,email", value: "user_id", label: (r) => r.full_name || r.email },
  };

  async function lookupOptions(name) {
    if (!name || !RELATIONS[name]) return [];
    if (lookupCache.has(name)) return lookupCache.get(name);
    const rel = RELATIONS[name];
    let rows;
    try {
      rows = await rest(`${rel.table}?select=${enc(rel.select)}&order=created_at.desc&limit=500`);
    } catch (_) {
      rows = await rest(`${rel.table}?select=${enc(rel.select)}&limit=500`);
    }
    const options = (Array.isArray(rows) ? rows : []).map((r) => [String(r[rel.value]), rel.label(r)]);
    lookupCache.set(name, options);
    return options;
  }

  const SELECTS = {
    project_status: [["planning","Planificación"],["active","Activo"],["paused","Pausado"],["completed","Completado"],["cancelled","Cancelado"]],
    commercial_status: [["prospect","Prospecto"],["quoted","Cotizado"],["contracted","Contratado"],["closed","Cerrado"],["cancelled","Cancelado"]],
    execution_status: [["not_started","No iniciado"],["procurement","Compras / gestión"],["in_progress","En ejecución"],["service_completed","Servicio ejecutado"],["completed","Completado"],["paused","Pausado"]],
    financial_status: [["not_invoiced","No facturado"],["partially_invoiced","Facturación parcial"],["invoiced","Facturado"],["partially_collected","Cobro parcial"],["collected","Cobrado"]],
    delivery_status: [["not_applicable","No aplica"],["pending","Pendiente"],["partial","Parcial"],["delivered","Entregado"]],
    quotation_direction: [["sale","Venta a cliente"],["purchase","Compra / proveedor"]],
    quotation_status: [["draft","Borrador"],["sent","Enviada"],["received","Recibida"],["approved","Aprobada"],["rejected","Rechazada"],["expired","Vencida"],["invoiced","Facturada"]],
    po_direction: [["customer","OC de cliente"],["supplier","OC a proveedor"]],
    po_status: [["draft","Borrador"],["issued","Emitida"],["received","Recibida"],["approved","Aprobada"],["partial","Parcial"],["completed","Completada"],["cancelled","Cancelada"]],
    contract_type: [["client","Cliente"],["supplier","Proveedor"],["service","Prestación de servicios"],["employment","Laboral"],["nda","Confidencialidad"],["lease","Arriendo"],["partnership","Colaboración"],["other","Otro"]],
    contract_status: [["draft","Borrador"],["review","Revisión"],["approved","Aprobado"],["signed","Firmado"],["active","Activo"],["expired","Vencido"],["terminated","Terminado"],["archived","Archivado"]],
    file_category: [["project","Proyecto"],["report","Informe"],["meeting","Reunión"],["image","Imagen"],["quotation","Cotización"],["invoice","Factura"],["contract","Contrato"],["purchase_order","Orden de compra"],["corporate","Corporativo"],["legal","Legal"],["tax","Tributario"],["bank","Bancario"],["hr","RR.HH."],["asset","Activo"],["warranty","Garantía"],["certificate","Certificado"],["insurance","Seguro"],["other","Otro"]],
    document_type: [["general","General"],["report","Informe"],["meeting_minutes","Acta"],["quotation","Cotización"],["contract","Contrato"],["purchase_order","Orden de compra"],["letter","Carta"],["memo","Memo"],["financial_report","Informe financiero"],["corporate","Corporativo"],["legal","Legal"],["tax","Tributario"],["hr","RR.HH."],["policy","Política"],["certificate","Certificado"],["insurance","Seguro"],["bank","Bancario"]],
    document_status: [["draft","Borrador"],["published","Publicado"],["archived","Archivado"]],
    transaction_direction: [["income","Ingreso"],["expense","Gasto"]],
    transaction_status: [["pending","Pendiente"],["partial","Parcial"],["paid","Pagado"],["cancelled","Cancelado"]],
    tax_type: [["f29","F29"],["f50","F50"],["ppm","PPM"],["iva","IVA"],["renta","Renta"],["dj","Declaración jurada"],["patente","Patente"],["other","Otro"]],
    tax_status: [["pending","Pendiente"],["prepared","Preparado"],["filed","Declarado"],["paid","Pagado"],["not_applicable","No aplica"]],
    employee_status: [["active","Activo"],["leave","Licencia / ausencia"],["inactive","Inactivo"],["terminated","Terminado"]],
    asset_status: [["available","Disponible"],["assigned","Asignado"],["maintenance","Mantención"],["retired","Retirado"],["lost","Perdido"]],
    case_type: [["warranty","Garantía"],["support","Soporte"],["maintenance","Mantención"],["return","Devolución"],["replacement","Reemplazo"],["incident","Incidente"],["other","Otro"]],
    case_status: [["open","Abierto"],["diagnosis","Diagnóstico"],["waiting_customer","Esperando cliente"],["waiting_supplier","Esperando proveedor"],["in_progress","En proceso"],["resolved","Resuelto"],["closed","Cerrado"],["cancelled","Cancelado"]],
    priority: [["low","Baja"],["medium","Media"],["high","Alta"],["critical","Crítica"]],
    approval_status: [["pending","Pendiente"],["approved","Aprobada"],["rejected","Rechazada"],["cancelled","Cancelada"]],
    deadline_status: [["open","Abierto"],["done","Completado"],["cancelled","Cancelado"]],
    event_type: [["note","Nota"],["payment_received","Pago recibido"],["payment_made","Pago realizado"],["invoice_planned","Factura planificada"],["invoice_issued","Factura emitida"],["quote_received","Cotización recibida"],["quote_approved","Cotización aprobada"],["purchase_order","Orden de compra"],["service_started","Servicio iniciado"],["service_completed","Servicio completado"],["goods_ordered","Productos solicitados"],["goods_received","Productos recibidos"],["delivery_pending","Entrega pendiente"],["delivery_completed","Entrega completada"],["tax_obligation","Obligación tributaria"],["meeting","Reunión"],["incident","Incidente"],["scope_change","Cambio de alcance"],["other","Otro"]],
    event_status: [["draft","Borrador"],["suggested","Sugerido"],["confirmed","Confirmado"],["cancelled","Cancelado"]],
  };

  function f(name, label, type = "text", extra = {}) { return { name, label, type, ...extra }; }

  const TABLES = {
    projects: {
      table: "company_projects", title: "Proyectos", order: "updated_at.desc", editRoles: EDIT_ROLES, deleteRoles: DELETE_ROLES,
      label: (r) => r.title, sub: (r) => `${r.client_name || "Proyecto interno"} · ${r.status || ""}`,
      deleteWarning: "Al eliminar un proyecto se eliminará su bitácora y otros registros relacionados quedarán sin proyecto.",
      fields: [
        f("code","Código"), f("title","Nombre del proyecto","text",{required:true}), f("client_name","Cliente / institución"), f("client_rut","RUT cliente"),
        f("client_party_id","Cliente registrado","relation",{relation:"party"}), f("description","Descripción","textarea",{full:true}),
        f("status","Estado general","select",{options:SELECTS.project_status}), f("start_date","Fecha inicio","date"), f("due_date","Fecha objetivo","date"),
        f("budget","Presupuesto","number"), f("contracted_amount","Monto contratado","number"), f("expected_invoice_count","Facturas esperadas","integer"),
        f("commercial_status","Estado comercial","select",{options:SELECTS.commercial_status}), f("execution_status","Estado de ejecución","select",{options:SELECTS.execution_status}),
        f("financial_status","Estado financiero","select",{options:SELECTS.financial_status}), f("delivery_status","Estado de entrega","select",{options:SELECTS.delivery_status}),
        f("operational_notes","Notas operacionales","textarea",{full:true}),
      ],
    },
    parties: {
      table: "company_parties", title: "Clientes y proveedores", order: "updated_at.desc", editRoles: EDIT_ROLES, deleteRoles: DELETE_ROLES,
      label: (r) => r.name, sub: (r) => `${r.rut || "Sin RUT"} · ${(r.roles || []).join(", ")}`,
      fields: [
        f("name","Nombre / razón social","text",{required:true}), f("rut","RUT"), f("roles","Roles (client, supplier, other)","array"), f("email","Correo","email"), f("phone","Teléfono"),
        f("address","Dirección","textarea",{full:true}), f("city","Ciudad"), f("contact_name","Persona de contacto"), f("active","Activo","boolean"), f("notes","Notas","textarea",{full:true}),
      ],
    },
    quotations: {
      table: "company_quotations", title: "Cotizaciones", order: "updated_at.desc", editRoles: FINANCE_EDIT, deleteRoles: DELETE_ROLES,
      label: (r) => r.quote_number, sub: (r) => `${r.direction === "purchase" ? "Proveedor" : "Cliente"}: ${r.client_name || "—"} · ${money(r.total_amount)}`,
      fields: [
        f("direction","Tipo","select",{options:SELECTS.quotation_direction}), f("quote_number","Número","text",{required:true}), f("project_id","Proyecto","relation",{relation:"project"}),
        f("party_id","Contraparte registrada","relation",{relation:"party"}), f("client_name","Cliente / proveedor","text",{required:true}), f("client_rut","RUT contraparte"),
        f("issue_date","Fecha","date",{required:true}), f("valid_until","Válida hasta","date"), f("status","Estado","select",{options:SELECTS.quotation_status}),
        f("items","Ítems (JSON)","json",{full:true}), f("subtotal","Subtotal","number"), f("discount","Descuento","number"), f("net_amount","Neto","number"),
        f("vat_rate","IVA %","number"), f("vat_amount","IVA","number"), f("total_amount","Total","number"), f("notes","Notas","textarea",{full:true}),
      ],
    },
    purchase_orders: {
      table: "company_purchase_orders", title: "Órdenes de compra", order: "updated_at.desc", editRoles: EDIT_ROLES, deleteRoles: DELETE_ROLES,
      label: (r) => r.order_number, sub: (r) => `${r.direction === "supplier" ? "A proveedor" : "De cliente"} · ${money(r.total_amount)}`,
      fields: [
        f("direction","Dirección","select",{options:SELECTS.po_direction}), f("order_number","Número OC","text",{required:true}), f("party_id","Contraparte","relation",{relation:"party"}),
        f("project_id","Proyecto","relation",{relation:"project"}), f("quotation_id","Cotización relacionada","relation",{relation:"quotation"}), f("issue_date","Fecha emisión","date",{required:true}),
        f("expected_date","Fecha esperada","date"), f("status","Estado","select",{options:SELECTS.po_status}), f("items","Ítems (JSON)","json",{full:true}),
        f("net_amount","Neto","number"), f("vat_amount","IVA","number"), f("total_amount","Total","number"), f("notes","Notas","textarea",{full:true}),
      ],
    },
    documents: {
      table: "company_documents", title: "Documentos", order: "updated_at.desc", editRoles: EDIT_ROLES, deleteRoles: DELETE_ROLES,
      label: (r) => r.title, sub: (r) => `${r.document_type} · ${r.status} · v${r.version || 1}`,
      deleteWarning: "Al eliminar un documento también se eliminan sus versiones guardadas.",
      fields: [f("project_id","Proyecto","relation",{relation:"project"}), f("document_type","Tipo","select",{options:SELECTS.document_type}), f("title","Título","text",{required:true}), f("status","Estado","select",{options:SELECTS.document_status})],
    },
    contracts: {
      table: "company_contracts", title: "Contratos", order: "updated_at.desc", editRoles: EDIT_ROLES, deleteRoles: DELETE_ROLES,
      label: (r) => r.title, sub: (r) => `${r.contract_number || "Sin número"} · ${r.status} · ${money(r.amount)}`,
      fields: [
        f("contract_number","Número"), f("title","Título","text",{required:true}), f("contract_type","Tipo","select",{options:SELECTS.contract_type}),
        f("party_id","Contraparte","relation",{relation:"party"}), f("project_id","Proyecto","relation",{relation:"project"}), f("status","Estado","select",{options:SELECTS.contract_status}),
        f("start_date","Inicio","date"), f("end_date","Término","date"), f("renewal_date","Renovación","date"), f("amount","Monto","number"), f("notes","Notas","textarea",{full:true}),
      ],
    },
    files: {
      table: "company_files", title: "Archivos empresariales", order: "created_at.desc", editRoles: EDIT_ROLES, deleteRoles: DELETE_ROLES, file: true,
      label: (r) => r.title, sub: (r) => `${r.original_name || "Archivo"} · ${r.category}${r.archived ? " · Archivado" : ""}`,
      fields: [
        f("title","Título","text",{required:true}), f("category","Categoría","select",{options:SELECTS.file_category}), f("project_id","Proyecto","relation",{relation:"project"}),
        f("party_id","Cliente / proveedor","relation",{relation:"party"}), f("document_number","Número de documento"), f("occurred_at","Fecha del documento","datetime"),
        f("expires_at","Vencimiento","datetime"), f("archived","Archivado","boolean"), f("__replacement","Reemplazar archivo físico","file",{full:true}),
      ],
    },
    assets: {
      table: "company_assets", title: "Activos e inventario", order: "updated_at.desc", editRoles: EDIT_ROLES, deleteRoles: DELETE_ROLES,
      label: (r) => `${r.asset_code} · ${r.name}`, sub: (r) => `${r.category || "Activo"} · ${r.status} · ${money(r.cost)}`,
      fields: [
        f("asset_code","Código","text",{required:true}), f("name","Nombre","text",{required:true}), f("category","Categoría"), f("serial_number","Número de serie"),
        f("project_id","Proyecto","relation",{relation:"project"}), f("employee_id","Responsable","relation",{relation:"employee"}), f("supplier_party_id","Proveedor","relation",{relation:"party"}),
        f("purchase_invoice_id","Factura de compra","relation",{relation:"invoice"}), f("purchase_date","Fecha compra","date"), f("cost","Costo","number"), f("warranty_until","Garantía hasta","date"),
        f("location","Ubicación"), f("status","Estado","select",{options:SELECTS.asset_status}), f("notes","Notas","textarea",{full:true}),
      ],
    },
    service_cases: {
      table: "company_service_cases", title: "Garantías y postventa", order: "updated_at.desc", editRoles: EDIT_ROLES, deleteRoles: DELETE_ROLES,
      label: (r) => `${r.case_number} · ${r.title}`, sub: (r) => `${r.case_type} · ${r.status} · ${r.priority}`,
      fields: [
        f("case_number","Número","text",{required:true}), f("case_type","Tipo","select",{options:SELECTS.case_type}), f("title","Título","text",{required:true}),
        f("party_id","Cliente / proveedor","relation",{relation:"party"}), f("project_id","Proyecto","relation",{relation:"project"}), f("asset_id","Activo (UUID)"), f("invoice_id","Factura","relation",{relation:"invoice"}),
        f("status","Estado","select",{options:SELECTS.case_status}), f("priority","Prioridad","select",{options:SELECTS.priority}), f("opened_at","Apertura","datetime"), f("due_at","Vencimiento","datetime"),
        f("resolved_at","Resolución","datetime"), f("assigned_to","Asignado a","relation",{relation:"user"}), f("description","Descripción","textarea",{full:true}), f("resolution","Solución","textarea",{full:true}),
      ],
    },
    transactions: {
      table: "company_transactions", title: "Movimientos de tesorería", order: "transaction_date.desc", editRoles: FINANCE_EDIT, deleteRoles: DELETE_ROLES,
      label: (r) => `${r.direction === "income" ? "Ingreso" : "Gasto"} · ${money(r.amount)}`, sub: (r) => `${r.transaction_date || ""} · ${r.description || "Sin descripción"} · ${r.status}`,
      fields: [
        f("direction","Tipo","select",{options:SELECTS.transaction_direction}), f("project_id","Proyecto","relation",{relation:"project"}), f("party_id","Contraparte","relation",{relation:"party"}),
        f("invoice_id","Factura","relation",{relation:"invoice"}), f("purchase_order_id","Orden de compra","relation",{relation:"purchase_order"}), f("transaction_date","Fecha","date",{required:true}),
        f("due_date","Vencimiento","date"), f("paid_at","Fecha de pago","datetime"), f("amount","Monto","number"), f("status","Estado","select",{options:SELECTS.transaction_status}),
        f("payment_method","Medio de pago"), f("bank_reference","Referencia bancaria"), f("description","Descripción","textarea",{full:true}), f("reconciled","Conciliado","boolean"),
      ],
    },
    bank_movements: {
      table: "company_bank_movements", title: "Movimientos bancarios", order: "movement_date.desc", editRoles: FINANCE_EDIT, deleteRoles: DELETE_ROLES,
      label: (r) => `${r.movement_date} · ${money(r.amount)}`, sub: (r) => `${r.account_label} · ${r.description}`,
      fields: [
        f("account_label","Cuenta","text",{required:true}), f("movement_date","Fecha","date",{required:true}), f("description","Descripción","textarea",{full:true}),
        f("amount","Monto","number"), f("reference","Referencia"), f("balance","Saldo","number"), f("transaction_id","Movimiento relacionado","relation",{relation:"transaction"}), f("reconciled","Conciliado","boolean"),
      ],
    },
    tax_records: {
      table: "company_tax_records", title: "Registros tributarios", order: "period.desc", editRoles: FINANCE_EDIT, deleteRoles: DELETE_ROLES,
      label: (r) => `${String(r.record_type || "").toUpperCase()} · ${r.period}`, sub: (r) => `${r.status} · ${money(r.total_amount || r.tax_amount)}`,
      fields: [
        f("period","Período","date",{required:true}), f("record_type","Tipo","select",{options:SELECTS.tax_type}), f("status","Estado","select",{options:SELECTS.tax_status}), f("due_date","Vencimiento","date"),
        f("net_amount","Neto","number"), f("debit_vat","IVA débito","number"), f("credit_vat","IVA crédito","number"), f("ppm_amount","PPM","number"), f("tax_amount","Impuesto","number"),
        f("total_amount","Total","number"), f("notes","Notas","textarea",{full:true}),
      ],
    },
    employees: {
      table: "company_employees", title: "RR.HH.", order: "updated_at.desc", editRoles: ADMIN_EDIT, deleteRoles: DELETE_ROLES,
      label: (r) => r.full_name, sub: (r) => `${r.position || "Sin cargo"} · ${r.status}${r.rut ? ` · ${r.rut}` : ""}`,
      fields: [
        f("full_name","Nombre completo","text",{required:true}), f("rut","RUT"), f("position","Cargo"), f("contract_type","Tipo de contrato"), f("start_date","Inicio","date"), f("end_date","Término","date"),
        f("status","Estado","select",{options:SELECTS.employee_status}), f("email","Correo","email"), f("phone","Teléfono"), f("leave_balance","Saldo de vacaciones / días","number"), f("notes","Notas","textarea",{full:true}),
      ],
    },
    approvals: {
      table: "company_approvals", title: "Aprobaciones", order: "updated_at.desc", editRoles: EDIT_ROLES, deleteRoles: DELETE_ROLES,
      label: (r) => `${r.entity_type} · ${r.step}`, sub: (r) => `${r.status} · ${new Date(r.requested_at).toLocaleString("es-CL")}`,
      fields: [f("entity_type","Tipo de entidad","text",{required:true}), f("entity_id","ID de entidad","text",{required:true}), f("step","Paso","text",{required:true}), f("status","Estado","select",{options:SELECTS.approval_status}), f("approver_id","Aprobador","relation",{relation:"user"}), f("decided_at","Decisión","datetime"), f("note","Nota","textarea",{full:true})],
    },
    deadlines: {
      table: "company_deadlines", title: "Vencimientos", order: "due_date.asc", editRoles: EDIT_ROLES, deleteRoles: DELETE_ROLES,
      label: (r) => r.title, sub: (r) => `${r.status} · ${new Date(r.due_date).toLocaleString("es-CL")}`,
      fields: [f("entity_type","Tipo de entidad"), f("entity_id","ID de entidad"), f("title","Título","text",{required:true}), f("due_date","Vencimiento","datetime",{required:true}), f("priority","Prioridad","select",{options:SELECTS.priority}), f("status","Estado","select",{options:SELECTS.deadline_status}), f("owner_id","Responsable","relation",{relation:"user"}), f("remind_days","Avisar con días de anticipación","integer"), f("notes","Notas","textarea",{full:true})],
    },
    project_events: {
      table: "company_project_events", title: "Bitácora empresarial", order: "event_date.desc", editRoles: EDIT_ROLES, deleteRoles: DELETE_ROLES,
      label: (r) => r.title, sub: (r) => `${r.event_type} · ${r.status} · ${new Date(r.event_date).toLocaleString("es-CL")}`,
      fields: [
        f("project_id","Proyecto","relation",{relation:"project",required:true}), f("event_type","Tipo de evento","select",{options:SELECTS.event_type}), f("title","Título","text",{required:true}),
        f("description","Descripción","textarea",{full:true}), f("event_date","Fecha","datetime",{required:true}), f("amount","Monto","number"), f("direction","Dirección","select",{options:[["","Sin movimiento"],...SELECTS.transaction_direction]}),
        f("status","Estado","select",{options:SELECTS.event_status}),
      ],
    },
  };

  const PAGE_GROUPS = [
    { patterns: ["proyectos"], tables: ["projects"] },
    { patterns: ["clientes y proveedores", "clientes/proveedores"], tables: ["parties"] },
    { patterns: ["cotizaciones"], tables: ["quotations"] },
    { patterns: ["órdenes de compra", "ordenes de compra"], tables: ["purchase_orders"] },
    { patterns: ["documentos"], tables: ["documents"] },
    { patterns: ["contratos"], tables: ["contracts"] },
    { patterns: ["archivo empresarial"], tables: ["files"] },
    { patterns: ["activos e inventario"], tables: ["assets"] },
    { patterns: ["garantías y postventa", "garantias y postventa"], tables: ["service_cases"] },
    { patterns: ["tesorería", "tesoreria"], tables: ["transactions", "bank_movements"] },
    { patterns: ["tributario"], tables: ["tax_records"] },
    { patterns: ["rr.hh", "recursos humanos"], tables: ["employees"] },
    { patterns: ["aprobaciones y vencimientos"], tables: ["approvals", "deadlines"] },
    { patterns: ["operación y gastos", "operacion y gastos"], tables: ["project_events", "quotations", "transactions"] },
  ];

  function normalizeText(value = "") {
    return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  }

  function currentGroup() {
    const main = document.getElementById("main-content");
    const title = document.getElementById("view-title")?.textContent || "";
    const h = main?.querySelector("h2")?.textContent || "";
    const text = normalizeText(`${title} ${h}`);
    if (text.includes("facturas y finanzas")) return null;
    return PAGE_GROUPS.find((group) => group.patterns.some((p) => text.includes(normalizeText(p)))) || null;
  }

  function closeModal() {
    const root = document.getElementById("modal-root");
    if (root?.querySelector("[data-record-manager-modal]")) root.innerHTML = "";
  }

  function modalShell(title, body, footer = "") {
    const root = document.getElementById("modal-root");
    if (!root) return null;
    root.innerHTML = `<div class="modal-backdrop" data-record-manager-modal><div class="modal" style="max-width:1120px;width:min(1120px,95vw)"><div class="modal-head"><h2>${esc(title)}</h2><button type="button" class="mini-btn" data-record-manager-close><i class="ri-close-line"></i></button></div><div class="modal-body">${body}</div>${footer ? `<div class="modal-foot">${footer}</div>` : ""}</div></div>`;
    root.querySelector("[data-record-manager-close]")?.addEventListener("click", closeModal);
    root.querySelector("[data-record-manager-modal]")?.addEventListener("click", (event) => { if (event.target === event.currentTarget) closeModal(); });
    return root;
  }

  function recordLabel(def, row) {
    try { return def.label?.(row) || row.title || row.name || row.id; } catch (_) { return row.title || row.name || row.id; }
  }
  function recordSub(def, row) {
    try { return def.sub?.(row) || ""; } catch (_) { return ""; }
  }

  async function fetchRows(def) {
    const order = def.order || "updated_at.desc";
    return rest(`${def.table}?select=*&order=${enc(order)}&limit=400`);
  }

  function refreshCurrentView() {
    lookupCache.clear();
    const active = document.querySelector("#side-nav .nav-item.active");
    if (active) setTimeout(() => active.click(), 40);
  }

  async function openManager(keys, selectedKey = null) {
    await loadProfile();
    const available = keys.filter((key) => {
      const def = TABLES[key];
      return def && (hasRole(def.editRoles) || hasRole(def.deleteRoles));
    });
    if (!available.length) return toast("No tienes permisos para editar o eliminar registros en esta sección.", "warning");
    const key = selectedKey && available.includes(selectedKey) ? selectedKey : available[0];
    const def = TABLES[key];
    managerState = { keys: available, key, rows: [] };

    const tabs = available.length > 1 ? `<div class="toolbar" style="margin-bottom:14px">${available.map((k) => `<button type="button" class="btn ${k === key ? "primary" : "ghost"}" data-record-tab="${esc(k)}">${esc(TABLES[k].title)}</button>`).join("")}</div>` : "";
    const root = modalShell(`Editar / eliminar · ${def.title}`, `${tabs}<div class="filter-bar"><input id="record-manager-search" type="search" placeholder="Buscar registro…"><span class="muted small">Solo administradores pueden eliminar definitivamente.</span></div><div id="record-manager-list"><div class="empty-state"><div class="loading-orb" style="width:34px;height:34px;margin:auto"></div><p>Cargando registros…</p></div></div>`);
    if (!root) return;
    root.querySelectorAll("[data-record-tab]").forEach((button) => button.addEventListener("click", () => openManager(available, button.dataset.recordTab)));

    try {
      const rows = await fetchRows(def);
      managerState.rows = Array.isArray(rows) ? rows : [];
      paintManagerList(def, managerState.rows);
      root.querySelector("#record-manager-search")?.addEventListener("input", (event) => {
        const query = normalizeText(event.target.value);
        const filtered = !query ? managerState.rows : managerState.rows.filter((row) => normalizeText(`${recordLabel(def,row)} ${recordSub(def,row)} ${JSON.stringify(row)}`).includes(query));
        paintManagerList(def, filtered);
      });
    } catch (error) {
      const list = document.getElementById("record-manager-list");
      if (list) list.innerHTML = `<div class="empty-state"><i class="ri-error-warning-line"></i><strong>No se pudieron cargar los registros</strong><p>${esc(error.message)}</p></div>`;
    }
  }

  function paintManagerList(def, rows) {
    const list = document.getElementById("record-manager-list");
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = `<div class="empty-state"><i class="ri-inbox-2-line"></i><strong>Sin registros</strong><p>No hay registros para administrar.</p></div>`;
      return;
    }
    const canEdit = hasRole(def.editRoles);
    const canDelete = hasRole(def.deleteRoles);
    list.innerHTML = `<div class="list">${rows.map((row) => `<div class="list-row" data-record-id="${esc(row.id)}"><div class="list-copy"><strong>${esc(recordLabel(def,row))}</strong><span>${esc(recordSub(def,row))}</span>${def.file ? `<span class="muted small">${esc(row.storage_path || "")}</span>` : ""}</div><div class="entity-actions">${def.file ? `<button type="button" class="mini-btn" data-record-open="${esc(row.id)}" title="Abrir archivo"><i class="ri-external-link-line"></i></button>` : ""}${canEdit ? `<button type="button" class="mini-btn" data-record-edit="${esc(row.id)}" title="Editar"><i class="ri-edit-line"></i></button>` : ""}${canDelete ? `<button type="button" class="mini-btn danger-text" data-record-delete="${esc(row.id)}" title="Eliminar"><i class="ri-delete-bin-line"></i></button>` : ""}</div></div>`).join("")}</div>`;
    list.querySelectorAll("[data-record-edit]").forEach((button) => button.addEventListener("click", () => openEditor(managerState.key, button.dataset.recordEdit)));
    list.querySelectorAll("[data-record-delete]").forEach((button) => button.addEventListener("click", () => deleteRecord(managerState.key, button.dataset.recordDelete)));
    list.querySelectorAll("[data-record-open]").forEach((button) => button.addEventListener("click", () => openFile(button.dataset.recordOpen)));
  }

  async function buildField(field, row) {
    const value = row?.[field.name];
    const full = field.full ? " full" : "";
    const required = field.required ? " required" : "";
    if (field.type === "textarea") return `<label class="form-field${full}"><span>${esc(field.label)}</span><textarea name="${esc(field.name)}"${required}>${esc(value || "")}</textarea></label>`;
    if (field.type === "json") {
      let text = "";
      try { text = JSON.stringify(value ?? {}, null, 2); } catch (_) { text = String(value || ""); }
      return `<label class="form-field${full}"><span>${esc(field.label)}</span><textarea name="${esc(field.name)}" rows="7" spellcheck="false">${esc(text)}</textarea></label>`;
    }
    if (field.type === "array") return `<label class="form-field${full}"><span>${esc(field.label)}</span><input name="${esc(field.name)}" value="${esc(Array.isArray(value) ? value.join(", ") : (value || ""))}" placeholder="client, supplier"></label>`;
    if (field.type === "select") return `<label class="form-field${full}"><span>${esc(field.label)}</span><select name="${esc(field.name)}"${required}>${(field.options || []).map(([v,t]) => `<option value="${esc(v)}"${String(value ?? "") === String(v) ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
    if (field.type === "boolean") return `<label class="form-field${full}"><span>${esc(field.label)}</span><select name="${esc(field.name)}"><option value="true"${value === true ? " selected" : ""}>Sí</option><option value="false"${value === false ? " selected" : ""}>No</option></select></label>`;
    if (field.type === "relation") {
      const options = await lookupOptions(field.relation);
      return `<label class="form-field${full}"><span>${esc(field.label)}</span><select name="${esc(field.name)}"${required}><option value="">Sin asignar</option>${options.map(([v,t]) => `<option value="${esc(v)}"${String(value || "") === String(v) ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
    }
    if (field.type === "file") return `<label class="form-field${full}"><span>${esc(field.label)}</span><input name="${esc(field.name)}" type="file"><small class="muted">Opcional. Reemplaza el archivo físico manteniendo el mismo registro y sus relaciones.</small></label>`;
    if (field.type === "date") return `<label class="form-field${full}"><span>${esc(field.label)}</span><input name="${esc(field.name)}" type="date" value="${esc(String(value || "").slice(0,10))}"${required}></label>`;
    if (field.type === "datetime") {
      let local = "";
      if (value) {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) local = new Date(date.getTime() - date.getTimezoneOffset()*60000).toISOString().slice(0,16);
      }
      return `<label class="form-field${full}"><span>${esc(field.label)}</span><input name="${esc(field.name)}" type="datetime-local" value="${esc(local)}"${required}></label>`;
    }
    if (field.type === "number" || field.type === "integer") return `<label class="form-field${full}"><span>${esc(field.label)}</span><input name="${esc(field.name)}" type="number" step="${field.type === "integer" ? "1" : "0.01"}" value="${esc(value ?? 0)}"${required}></label>`;
    return `<label class="form-field${full}"><span>${esc(field.label)}</span><input name="${esc(field.name)}" type="${esc(field.type || "text")}" value="${esc(value || "")}"${required}></label>`;
  }

  async function openEditor(key, id) {
    const def = TABLES[key];
    if (!def || !hasRole(def.editRoles)) return toast("No tienes permisos para editar este registro.", "warning");
    const row = managerState?.rows?.find((item) => String(item.id) === String(id)) || (await rest(`${def.table}?select=*&id=eq.${enc(id)}&limit=1`))?.[0];
    if (!row) return toast("No se encontró el registro.", "error");
    const root = modalShell(`Editar · ${def.title}`, `<div class="empty-state"><div class="loading-orb" style="width:34px;height:34px;margin:auto"></div><p>Preparando editor…</p></div>`);
    if (!root) return;
    try {
      const fields = await Promise.all(def.fields.map((field) => buildField(field, row)));
      const modal = root.querySelector(".modal");
      modal.innerHTML = `<div class="modal-head"><div><h2>Editar · ${esc(recordLabel(def,row))}</h2><p class="muted small">Los cambios se guardan directamente en la plataforma y quedan sujetos a los permisos de tu rol.</p></div><button type="button" class="mini-btn" data-record-manager-close><i class="ri-close-line"></i></button></div><div class="modal-body"><form id="record-edit-form" class="form-grid">${fields.join("")}</form><div id="record-edit-message" class="form-message" aria-live="polite"></div></div><div class="modal-foot"><button type="button" class="btn ghost" data-record-edit-cancel>Cancelar</button><button type="button" class="btn primary" id="record-edit-save"><i class="ri-save-line"></i> Guardar cambios</button></div>`;
      modal.querySelector("[data-record-manager-close]")?.addEventListener("click", () => openManager(managerState.keys, key));
      modal.querySelector("[data-record-edit-cancel]")?.addEventListener("click", () => openManager(managerState.keys, key));
      modal.querySelector("#record-edit-save")?.addEventListener("click", () => saveRecord(key, id, row));
    } catch (error) {
      const body = root.querySelector(".modal-body");
      if (body) body.innerHTML = `<div class="empty-state"><i class="ri-error-warning-line"></i><strong>No se pudo preparar el editor</strong><p>${esc(error.message)}</p></div>`;
    }
  }

  function parseField(field, fd) {
    if (field.name.startsWith("__")) return undefined;
    const raw = fd.get(field.name);
    if (field.type === "boolean") return String(raw) === "true";
    if (field.type === "number") return Number(raw || 0);
    if (field.type === "integer") return Math.max(0, Math.trunc(Number(raw || 0)));
    if (field.type === "array") return String(raw || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (field.type === "json") {
      const text = String(raw || "").trim();
      if (!text) return {};
      return JSON.parse(text);
    }
    if (field.type === "datetime") {
      const text = String(raw || "").trim();
      return text ? new Date(text).toISOString() : null;
    }
    if (field.type === "date" || field.type === "relation") return String(raw || "").trim() || null;
    const text = String(raw || "").trim();
    return text || (field.required ? "" : null);
  }

  async function sha256(file) {
    try {
      if (!window.crypto?.subtle) return null;
      const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2,"0")).join("");
    } catch (_) { return null; }
  }

  async function replaceStoredFile(row, file) {
    if (!row.storage_path || !file) return {};
    await storageRequest(`object/${enc(cfg.storageBucket)}/${storagePath(row.storage_path)}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
      body: file,
    });
    return { original_name: file.name, mime_type: file.type || null, file_size: file.size, sha256: await sha256(file), archived: false };
  }

  async function saveRecord(key, id, originalRow) {
    const def = TABLES[key];
    const form = document.getElementById("record-edit-form");
    const message = document.getElementById("record-edit-message");
    const button = document.getElementById("record-edit-save");
    if (!def || !form || !button) return;
    const fd = new FormData(form);
    const payload = {};
    try {
      for (const field of def.fields) {
        if (field.type === "file") continue;
        payload[field.name] = parseField(field, fd);
      }
      if (def.file) {
        const replacement = fd.get("__replacement");
        if (replacement instanceof File && replacement.size > 0) Object.assign(payload, await replaceStoredFile(originalRow, replacement));
      }
      button.disabled = true;
      button.textContent = "Guardando…";
      await rest(`${def.table}?id=eq.${enc(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) });
      toast("Registro actualizado.");
      refreshCurrentView();
      await openManager(managerState.keys, key);
    } catch (error) {
      if (message) message.textContent = error.message || "No se pudo guardar.";
      button.disabled = false;
      button.innerHTML = '<i class="ri-save-line"></i> Guardar cambios';
    }
  }

  async function deleteRecord(key, id) {
    const def = TABLES[key];
    if (!def || !hasRole(def.deleteRoles)) return toast("Solo administración puede eliminar definitivamente.", "warning");
    const row = managerState?.rows?.find((item) => String(item.id) === String(id)) || null;
    const warning = def.deleteWarning ? `\n\n${def.deleteWarning}` : "";
    if (!window.confirm(`¿Eliminar definitivamente “${recordLabel(def,row || {id})}”?${warning}\n\nEsta acción no se puede deshacer.`)) return;
    try {
      await rest(`${def.table}?id=eq.${enc(id)}`, { method: "DELETE", headers: { Prefer: "return=representation" } });
      if (def.file && row?.storage_path) {
        try {
          await storageRequest(`object/${enc(cfg.storageBucket)}/${storagePath(row.storage_path)}`, { method: "DELETE" });
        } catch (storageError) {
          console.warn("El registro se eliminó, pero quedó un objeto de storage pendiente de limpieza:", storageError);
          toast("Registro eliminado. El archivo físico quedó pendiente de limpieza en Storage.", "warning");
        }
      }
      toast("Registro eliminado.");
      refreshCurrentView();
      await openManager(managerState.keys, key);
    } catch (error) {
      toast(error.message || "No fue posible eliminar el registro.", "error");
    }
  }

  async function openFile(id) {
    const row = managerState?.rows?.find((item) => String(item.id) === String(id));
    if (!row?.storage_path) return;
    try {
      const data = await storageRequest(`object/sign/${enc(cfg.storageBucket)}/${storagePath(row.storage_path)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: 3600 }),
      });
      const signed = data?.signedURL || data?.signedUrl;
      if (!signed) throw new Error("No se pudo generar el enlace temporal.");
      const url = signed.startsWith("http") ? signed : `${cfg.supabaseUrl}/storage/v1${signed.startsWith("/") ? "" : "/"}${signed}`;
      window.open(url, "_blank", "noopener");
    } catch (error) { toast(error.message, "error"); }
  }

  async function enhanceInvoiceDelete() {
    await loadProfile();
    if (!hasRole(DELETE_ROLES)) return;
    const main = document.getElementById("main-content");
    if (!main) return;
    main.querySelectorAll(".invoice-open").forEach((viewButton) => {
      if (viewButton.parentElement?.querySelector(".invoice-delete-record")) return;
      const del = document.createElement("button");
      del.type = "button";
      del.className = "mini-btn invoice-delete-record danger-text";
      del.dataset.id = viewButton.dataset.id || "";
      del.title = "Eliminar factura";
      del.setAttribute("aria-label", "Eliminar factura");
      del.style.marginLeft = "6px";
      del.innerHTML = '<i class="ri-delete-bin-line"></i>';
      const edit = viewButton.parentElement?.querySelector(".invoice-edit-meta");
      (edit || viewButton).insertAdjacentElement("afterend", del);
    });
  }

  async function deleteInvoice(id) {
    await loadProfile();
    if (!hasRole(DELETE_ROLES)) return toast("Solo administración puede eliminar facturas.", "warning");
    let invoice = null;
    try {
      const rows = await rest(`company_invoices?select=id,folio,source_file_id,total_amount&id=eq.${enc(id)}`);
      invoice = Array.isArray(rows) ? rows[0] : null;
    } catch (_) {}
    if (!window.confirm(`¿Eliminar definitivamente la factura ${invoice?.folio || "seleccionada"}?\n\nLos movimientos de tesorería creados desde esta factura también pueden eliminarse por relación. El archivo original NO se elimina automáticamente; seguirá disponible en Archivo empresarial hasta que lo elimines allí.`)) return;
    try {
      await rest(`company_invoices?id=eq.${enc(id)}`, { method: "DELETE", headers: { Prefer: "return=representation" } });
      toast("Factura eliminada.");
      refreshCurrentView();
    } catch (error) { toast(error.message || "No se pudo eliminar la factura.", "error"); }
  }

  async function enhanceCurrentPage() {
    const main = document.getElementById("main-content");
    if (!main || main.querySelector(".loading-orb")) return;
    await loadProfile();
    await enhanceInvoiceDelete();
    const group = currentGroup();
    if (!group) return;
    const usable = group.tables.filter((key) => {
      const def = TABLES[key];
      return def && (hasRole(def.editRoles) || hasRole(def.deleteRoles));
    });
    if (!usable.length) return;
    const pageHead = main.querySelector(".page-head");
    if (!pageHead || pageHead.querySelector("[data-record-manager-open]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn outline";
    button.dataset.recordManagerOpen = "1";
    button.innerHTML = '<i class="ri-edit-2-line"></i> Editar / eliminar';
    button.title = "Editar o eliminar registros de esta sección";
    pageHead.appendChild(button);
    button.addEventListener("click", () => openManager(usable));
  }

  function scheduleEnhance() {
    clearTimeout(enhanceTimer);
    enhanceTimer = setTimeout(() => enhanceCurrentPage().catch((error) => console.warn("Record manager:", error)), 220);
  }

  document.addEventListener("click", (event) => {
    const del = event.target.closest?.(".invoice-delete-record");
    if (!del) return;
    event.preventDefault();
    event.stopPropagation();
    deleteInvoice(del.dataset.id);
  }, true);

  const main = document.getElementById("main-content");
  if (main) new MutationObserver(scheduleEnhance).observe(main, { childList: true, subtree: true });
  window.addEventListener("innova-enterprise-ready", scheduleEnhance);
  window.addEventListener("innova-project-reality-ready", scheduleEnhance);
  scheduleEnhance();
})();
