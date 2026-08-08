(() => {
  "use strict";

  const cfg = window.INNOVA_ADMIN_CONFIG;
  if (!cfg || !window.supabase) {
    document.body.innerHTML = "<p style='padding:40px;font-family:sans-serif'>No fue posible iniciar Innova Admin.</p>";
    return;
  }

  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  const state = {
    session: null,
    user: null,
    profile: null,
    view: "dashboard",
    projects: [],
    documents: [],
    quotations: [],
    invoices: [],
    alerts: [],
    mfaFactorId: null,
    mfaForced: false,
    selectedChatContext: [],
    chatHistory: [],
    invoiceDraft: null,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
  const sanitize = (html = "") => window.DOMPurify ? window.DOMPurify.sanitize(html, { ADD_ATTR: ["target"] }) : html;
  const money = (n) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(n || 0));
  const dateCL = (v, withTime = false) => {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return new Intl.DateTimeFormat("es-CL", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(d);
  };
  const safeName = (name = "archivo") => String(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120);
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const initials = (name = "Innova Admin") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
  const roleLabel = (r) => ({ superadmin: "Superadministrador", admin: "Administrador", finance: "Finanzas", project_manager: "Gestor de proyectos", viewer: "Solo lectura" }[r] || r || "Usuario");
  const statusLabel = (s) => ({ planning: "Planificación", active: "Activo", paused: "Pausado", completed: "Completado", cancelled: "Cancelado", draft: "Borrador", sent: "Enviada", approved: "Aprobada", rejected: "Rechazada", expired: "Vencida", invoiced: "Facturada", pending: "Pendiente", partial: "Parcial", paid: "Pagada", void: "Anulada", open: "Abierta", acknowledged: "Revisada", dismissed: "Descartada", resolved: "Resuelta" }[s] || s || "—");
  const main = () => $("#main-content");

  function toast(message, type = "success") {
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    $("#toast-root").appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function setAuthMessage(message, ok = false) {
    const el = $("#auth-message");
    el.style.color = ok ? "var(--success)" : "var(--danger)";
    el.textContent = message || "";
  }

  function can(...roles) {
    return !!state.profile && state.profile.status === "active" && roles.includes(state.profile.role);
  }

  function writable(...roles) {
    if (!can(...roles)) {
      toast("Tu cuenta tiene acceso de lectura para esta acción.", "warning");
      return false;
    }
    return true;
  }

  async function currentAal() {
    const { data } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    return data?.currentLevel || "aal1";
  }

  async function requireAal2() {
    if ((await currentAal()) === "aal2") return true;
    await openMfa(true);
    return false;
  }

  function showAuth() {
    $("#app-loading").classList.add("hidden");
    $("#admin-app").classList.add("hidden");
    $("#auth-screen").classList.remove("hidden");
    $("#mfa-screen").classList.add("hidden");
  }

  async function loadProfile() {
    const { data, error } = await client.from("company_users").select("*").eq("user_id", state.user.id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function handleSession(session) {
    state.session = session;
    state.user = session?.user || null;
    if (!state.user) return showAuth();

    try {
      state.profile = await loadProfile();
      if (!state.profile || state.profile.status !== "active") {
        await client.auth.signOut();
        showAuth();
        setAuthMessage("La cuenta inició sesión, pero no está autorizada para la plataforma empresarial.");
        return;
      }

      $("#auth-screen").classList.add("hidden");
      $("#app-loading").classList.add("hidden");
      $("#admin-app").classList.remove("hidden");
      applyProfileUi();
      bindShell();
      await showView("dashboard");

      const aal = await currentAal();
      $("#security-level").textContent = aal === "aal2" ? "MFA verificado" : "Sesión nivel 1";
      if (state.profile.role === "superadmin" && aal !== "aal2" && !sessionStorage.getItem("innova-mfa-skipped")) {
        setTimeout(() => openMfa(false), 450);
      }
    } catch (error) {
      console.error(error);
      showAuth();
      setAuthMessage("No se pudo validar tu acceso administrativo.");
    }
  }

  function applyProfileUi() {
    const name = state.profile.full_name || state.user.user_metadata?.full_name || state.user.email || "Administrador";
    $("#user-name").textContent = name;
    $("#user-role").textContent = roleLabel(state.profile.role);
    $("#user-avatar").textContent = initials(name);
    $$(".role-superadmin").forEach((el) => el.classList.toggle("hidden", state.profile.role !== "superadmin"));
    $$(".role-admin").forEach((el) => el.classList.toggle("hidden", !["superadmin", "admin"].includes(state.profile.role)));
  }

  let shellBound = false;
  function bindShell() {
    if (shellBound) return;
    shellBound = true;

    $("#side-nav").addEventListener("click", (e) => {
      const button = e.target.closest("[data-view]");
      if (!button) return;
      showView(button.dataset.view);
      closeSidebar();
    });
    $("#sidebar-toggle").addEventListener("click", openSidebar);
    $("#sidebar-backdrop").addEventListener("click", closeSidebar);
    $("#notification-button").addEventListener("click", () => showView("auditor"));
    $("#user-menu-button").addEventListener("click", () => $("#user-dropdown").classList.toggle("hidden"));
    $("#logout-button").addEventListener("click", () => client.auth.signOut());
    $("#mfa-menu-action").addEventListener("click", () => openMfa(false));
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".user-menu")) $("#user-dropdown").classList.add("hidden");
    });

    let searchTimer;
    $("#global-search").addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => globalSearch(e.target.value), 260);
    });
  }

  function openSidebar() { $("#sidebar").classList.add("open"); $("#sidebar-backdrop").classList.add("show"); }
  function closeSidebar() { $("#sidebar").classList.remove("open"); $("#sidebar-backdrop").classList.remove("show"); }

  async function showView(view) {
    if (view === "users" && state.profile.role !== "superadmin") return toast("Solo el superadministrador puede administrar usuarios.", "warning");
    if (["activity", "settings"].includes(view) && !can("superadmin", "admin")) return toast("No tienes acceso a esta sección.", "warning");
    state.view = view;
    $$(".nav-item[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    const titles = { dashboard: "Centro de operaciones", projects: "Gestor de proyectos", documents: "Centro de documentos", quotations: "Cotizaciones", invoices: "Facturas y finanzas", mira: "MIRA Business", auditor: "Agente Auditor", users: "Usuarios y seguridad", activity: "Registro de actividad", settings: "Configuración" };
    $("#view-title").textContent = titles[view] || "Innova Admin";
    main().innerHTML = `<div class="empty-state"><div class="loading-orb" style="margin:auto;width:38px;height:38px"></div><p>Cargando ${esc(titles[view] || view)}…</p></div>`;
    try {
      if (view === "dashboard") await renderDashboard();
      if (view === "projects") await renderProjects();
      if (view === "documents") await renderDocuments();
      if (view === "quotations") await renderQuotations();
      if (view === "invoices") await renderInvoices();
      if (view === "mira") await renderMira();
      if (view === "auditor") await renderAuditor();
      if (view === "users") await renderUsers();
      if (view === "activity") await renderActivity();
      if (view === "settings") await renderSettings();
    } catch (error) {
      console.error(error);
      main().innerHTML = `<div class="panel"><div class="empty-state"><i class="ri-error-warning-line"></i><strong>No se pudo cargar esta sección</strong><p>${esc(error.message || "Error inesperado")}</p></div></div>`;
    }
  }

  async function globalSearch(query) {
    const box = $("#search-results");
    const q = String(query || "").trim();
    if (q.length < 2) return box.classList.add("hidden");
    const { data, error } = await client.rpc("company_search", { search_text: q });
    if (error) return box.classList.add("hidden");
    box.innerHTML = data?.length ? data.map((x) => `<div class="search-item" data-entity="${esc(x.entity_type)}" data-id="${esc(x.entity_id)}"><i class="ri-search-eye-line"></i><div><strong>${esc(x.title)}</strong><span>${esc(x.entity_type)} · ${esc(x.subtitle || "")}</span></div></div>`).join("") : `<div class="empty-state" style="padding:18px">Sin resultados</div>`;
    box.classList.remove("hidden");
    $$(".search-item", box).forEach((item) => item.addEventListener("click", async () => {
      box.classList.add("hidden");
      $("#global-search").value = "";
      const t = item.dataset.entity;
      if (t === "project") { await showView("projects"); openProjectDetail(item.dataset.id); }
      else if (t === "document") { await showView("documents"); openDocumentEditor(item.dataset.id); }
      else if (t === "quotation") { await showView("quotations"); openQuotation(item.dataset.id); }
      else if (t === "invoice") { await showView("invoices"); openInvoiceDetail(item.dataset.id); }
    }));
  }

  async function renderDashboard() {
    const [projectsR, quotesR, invoicesR, alertsR, activityR] = await Promise.all([
      client.from("company_projects").select("*").order("updated_at", { ascending: false }),
      client.from("company_quotations").select("*").order("created_at", { ascending: false }),
      client.from("company_invoices").select("*").order("created_at", { ascending: false }),
      client.from("company_alerts").select("*").neq("status", "resolved").order("created_at", { ascending: false }),
      can("superadmin", "admin") ? client.from("company_activity").select("*").order("created_at", { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
    ]);
    state.projects = projectsR.data || [];
    state.quotations = quotesR.data || [];
    state.invoices = invoicesR.data || [];
    state.alerts = alertsR.data || [];
    updateAlertBadge();

    const activeProjects = state.projects.filter((p) => ["planning", "active", "paused"].includes(p.status));
    const pendingInvoices = state.invoices.filter((i) => ["pending", "partial"].includes(i.payment_status));
    const pendingTotal = pendingInvoices.reduce((a, b) => a + Number(b.total_amount || 0), 0);
    const openAlerts = state.alerts.filter((a) => a.status === "open");
    const recent = [...state.projects.slice(0, 4).map((x) => ({ icon: "ri-folder-line", title: x.title, meta: `Proyecto · ${statusLabel(x.status)}`, date: x.updated_at })), ...state.invoices.slice(0, 4).map((x) => ({ icon: "ri-bill-line", title: `Factura ${x.folio || "sin folio"}`, meta: `${x.issuer_name || "Documento tributario"} · ${money(x.total_amount)}`, date: x.updated_at }))].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 7);

    main().innerHTML = `
      <div class="page-head"><div><h2>Bienvenido a Innova Admin</h2><p>Una vista central de la operación empresarial, los documentos y los asuntos que requieren atención.</p></div><div class="button-row">${can("superadmin","admin","project_manager") ? `<button id="dash-new-project" class="btn primary"><i class="ri-add-line"></i> Nuevo proyecto</button>` : ""}<button id="dash-audit" class="btn ghost"><i class="ri-shield-check-line"></i> Revisar ahora</button></div></div>
      <div class="stats-grid">
        ${statCard("ri-folder-chart-line", activeProjects.length, "Proyectos abiertos")}
        ${statCard("ri-file-list-3-line", state.quotations.filter((q)=>["draft","sent","approved"].includes(q.status)).length, "Cotizaciones en curso")}
        ${statCard("ri-bill-line", money(pendingTotal), "Facturas pendientes")}
        ${statCard("ri-alarm-warning-line", openAlerts.length, "Alertas activas")}
      </div>
      <div class="grid-2">
        <section class="panel"><div class="panel-head"><h3>Actividad reciente</h3><button class="mini-btn" id="go-activity"><i class="ri-arrow-right-line"></i></button></div><div class="panel-body">${recent.length ? `<div class="list">${recent.map((x)=>listRow(x.icon,x.title,x.meta,dateCL(x.date,true))).join("")}</div>` : empty("ri-history-line","Todavía no hay actividad","Los nuevos proyectos, documentos y facturas aparecerán aquí.")}</div></section>
        <section class="panel"><div class="panel-head"><h3>Atención del auditor</h3><button class="mini-btn" id="go-auditor"><i class="ri-arrow-right-line"></i></button></div><div class="panel-body">${openAlerts.length ? `<div class="list">${openAlerts.slice(0,6).map(alertRow).join("")}</div>` : empty("ri-shield-check-line","Todo al día","El auditor no registra alertas abiertas.")}</div></section>
      </div>`;

    $("#dash-new-project")?.addEventListener("click", () => openProjectForm());
    $("#dash-audit")?.addEventListener("click", runAudit);
    $("#go-auditor")?.addEventListener("click", () => showView("auditor"));
    $("#go-activity")?.addEventListener("click", () => can("superadmin","admin") ? showView("activity") : null);
  }

  function statCard(icon, value, label) { return `<div class="stat-card"><div class="stat-top"><div class="stat-icon"><i class="${icon}"></i></div></div><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`; }
  function listRow(icon, title, meta, right = "") { return `<div class="list-row"><div class="list-icon"><i class="${icon}"></i></div><div class="list-copy"><strong>${esc(title)}</strong><span>${esc(meta)}</span></div><div class="list-meta">${esc(right)}</div></div>`; }
  function empty(icon, title, text) { return `<div class="empty-state"><i class="${icon}"></i><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`; }
  function alertRow(a) { return `<div class="list-row"><div class="severity-line ${esc(a.severity)}"></div><div class="list-copy"><strong>${esc(a.title)}</strong><span>${esc(a.message)}</span></div><div class="list-meta"><span class="status ${esc(a.severity)}">${esc(a.severity)}</span></div></div>`; }
  function updateAlertBadge() {
    const n = state.alerts.filter((a) => a.status === "open").length;
    $("#alert-badge").textContent = n;
    $("#alert-badge").classList.toggle("hidden", !n);
    $("#notification-dot").classList.toggle("hidden", !n);
  }

  async function renderProjects() {
    const { data, error } = await client.from("company_projects").select("*").order("updated_at", { ascending: false });
    if (error) throw error;
    state.projects = data || [];
    main().innerHTML = `
      <div class="page-head"><div><h2>Gestor de proyectos</h2><p>Organiza cada proyecto junto a informes, imágenes, reuniones, cotizaciones, facturas y documentos.</p></div>${can("superadmin","admin","project_manager") ? `<button id="new-project" class="btn primary"><i class="ri-add-line"></i> Crear proyecto</button>` : ""}</div>
      <div class="filter-bar"><input id="project-filter" type="search" placeholder="Buscar proyecto o cliente" /><select id="project-status"><option value="">Todos los estados</option><option value="planning">Planificación</option><option value="active">Activo</option><option value="paused">Pausado</option><option value="completed">Completado</option></select></div>
      <div id="project-grid" class="card-grid"></div>`;
    $("#new-project")?.addEventListener("click", () => openProjectForm());
    $("#project-filter").addEventListener("input", paintProjects);
    $("#project-status").addEventListener("change", paintProjects);
    paintProjects();
  }

  function paintProjects() {
    const q = ($("#project-filter")?.value || "").toLowerCase();
    const s = $("#project-status")?.value || "";
    const rows = state.projects.filter((p) => (!q || `${p.title} ${p.client_name || ""} ${p.code || ""}`.toLowerCase().includes(q)) && (!s || p.status === s));
    const grid = $("#project-grid");
    grid.innerHTML = rows.length ? rows.map((p) => `<article class="entity-card"><div class="card-top"><span class="status ${esc(p.status)}">${esc(statusLabel(p.status))}</span><div class="entity-actions">${can("superadmin","admin","project_manager") ? `<button class="mini-btn edit-project" data-id="${p.id}" title="Editar"><i class="ri-edit-line"></i></button>` : ""}<button class="mini-btn open-project" data-id="${p.id}" title="Abrir"><i class="ri-arrow-right-up-line"></i></button></div></div><h3>${esc(p.title)}</h3><p>${esc(p.client_name || "Sin cliente asignado")}${p.code ? ` · ${esc(p.code)}` : ""}</p><div class="card-footer"><span>${p.due_date ? `Objetivo ${esc(dateCL(p.due_date))}` : "Sin fecha objetivo"}</span><strong>${money(p.budget)}</strong></div></article>`).join("") : `<div style="grid-column:1/-1" class="panel">${empty("ri-folder-open-line","No hay proyectos","Crea el primer proyecto para comenzar a organizar la empresa.")}</div>`;
    $$(".open-project", grid).forEach((b) => b.addEventListener("click", () => openProjectDetail(b.dataset.id)));
    $$(".edit-project", grid).forEach((b) => b.addEventListener("click", () => openProjectForm(b.dataset.id)));
  }

  function modal(title, body, foot = "", wide = false) {
    $("#modal-root").innerHTML = `<div class="modal-backdrop"><div class="modal ${wide ? "wide" : ""}"><div class="modal-head"><h2>${esc(title)}</h2><button class="mini-btn modal-close"><i class="ri-close-line"></i></button></div><div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ""}</div></div>`;
    $(".modal-close")?.addEventListener("click", closeModal);
    $(".modal-backdrop")?.addEventListener("click", (e) => { if (e.target.classList.contains("modal-backdrop")) closeModal(); });
  }
  function closeModal() { $("#modal-root").innerHTML = ""; }

  function openProjectForm(id = null) {
    if (!writable("superadmin","admin","project_manager")) return;
    const p = id ? state.projects.find((x) => x.id === id) : null;
    modal(p ? "Editar proyecto" : "Crear proyecto", `<form id="project-form" class="form-grid">
      <label class="form-field"><span>Código</span><input name="code" value="${esc(p?.code || "")}" placeholder="PROY-2026-001" /></label>
      <label class="form-field"><span>Estado</span><select name="status"><option value="planning">Planificación</option><option value="active">Activo</option><option value="paused">Pausado</option><option value="completed">Completado</option><option value="cancelled">Cancelado</option></select></label>
      <label class="form-field full"><span>Nombre del proyecto</span><input name="title" required value="${esc(p?.title || "")}" /></label>
      <label class="form-field"><span>Cliente / institución</span><input name="client_name" value="${esc(p?.client_name || "")}" /></label>
      <label class="form-field"><span>RUT cliente</span><input name="client_rut" value="${esc(p?.client_rut || "")}" /></label>
      <label class="form-field"><span>Fecha inicio</span><input type="date" name="start_date" value="${esc(p?.start_date || "")}" /></label>
      <label class="form-field"><span>Fecha objetivo</span><input type="date" name="due_date" value="${esc(p?.due_date || "")}" /></label>
      <label class="form-field"><span>Presupuesto</span><input type="number" min="0" name="budget" value="${Number(p?.budget || 0)}" /></label>
      <label class="form-field full"><span>Descripción</span><textarea name="description">${esc(p?.description || "")}</textarea></label>
    </form>`, `<button class="btn ghost modal-close-2">Cancelar</button><button id="save-project" class="btn primary">Guardar proyecto</button>`);
    $("#project-form [name=status]").value = p?.status || "planning";
    $(".modal-close-2").addEventListener("click", closeModal);
    $("#save-project").addEventListener("click", async () => {
      const fd = new FormData($("#project-form"));
      const payload = Object.fromEntries(fd.entries());
      if (!payload.title.trim()) return toast("Ingresa el nombre del proyecto.", "warning");
      payload.budget = Number(payload.budget || 0);
      payload.code = payload.code.trim() || null;
      payload.client_name = payload.client_name.trim() || null;
      payload.client_rut = payload.client_rut.trim() || null;
      payload.start_date = payload.start_date || null;
      payload.due_date = payload.due_date || null;
      payload.description = payload.description.trim() || null;
      payload.created_by = p?.created_by || state.user.id;
      let result;
      if (p) result = await client.from("company_projects").update(payload).eq("id", p.id);
      else result = await client.from("company_projects").insert(payload);
      if (result.error) return toast(result.error.message, "error");
      closeModal(); toast("Proyecto guardado."); await renderProjects();
    });
  }

  async function openProjectDetail(id) {
    const project = state.projects.find((x) => x.id === id) || (await client.from("company_projects").select("*").eq("id", id).single()).data;
    if (!project) return;
    const [filesR, docsR, meetingsR, quotesR, invoicesR] = await Promise.all([
      client.from("company_files").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      client.from("company_documents").select("id,title,document_type,status,updated_at").eq("project_id", id).order("updated_at", { ascending: false }),
      client.from("company_meetings").select("*").eq("project_id", id).order("meeting_date", { ascending: false }),
      client.from("company_quotations").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      client.from("company_invoices").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    ]);
    const timeline = [
      ...(filesR.data || []).map((x) => ({ type:"file", date:x.occurred_at || x.created_at, icon:"ri-attachment-line", title:x.title, meta:`Archivo · ${x.category}`, ref:x })),
      ...(docsR.data || []).map((x) => ({ type:"document", date:x.updated_at, icon:"ri-file-edit-line", title:x.title, meta:`Documento · ${x.document_type}`, ref:x })),
      ...(meetingsR.data || []).map((x) => ({ type:"meeting", date:x.meeting_date, icon:"ri-calendar-event-line", title:x.title, meta:"Reunión", ref:x })),
      ...(quotesR.data || []).map((x) => ({ type:"quotation", date:x.created_at, icon:"ri-file-list-3-line", title:x.quote_number, meta:`Cotización · ${money(x.total_amount)}`, ref:x })),
      ...(invoicesR.data || []).map((x) => ({ type:"invoice", date:x.created_at, icon:"ri-bill-line", title:`Factura ${x.folio || "sin folio"}`, meta:`${x.issuer_name || "DTE"} · ${money(x.total_amount)}`, ref:x })),
    ].sort((a,b)=>new Date(b.date)-new Date(a.date));
    modal(project.title, `<div class="grid-2"><section><div class="panel" style="box-shadow:none"><div class="panel-body"><span class="status ${esc(project.status)}">${esc(statusLabel(project.status))}</span><h3>${esc(project.client_name || "Proyecto interno")}</h3><p class="muted small">${esc(project.description || "Sin descripción")}</p><div class="grid-3" style="margin-top:16px"><div><small class="muted">Código</small><strong style="display:block">${esc(project.code || "—")}</strong></div><div><small class="muted">Objetivo</small><strong style="display:block">${esc(dateCL(project.due_date))}</strong></div><div><small class="muted">Presupuesto</small><strong style="display:block">${money(project.budget)}</strong></div></div></div></div><h3 style="font-size:.85rem;margin-top:20px">Línea de tiempo</h3><div class="timeline">${timeline.length ? timeline.map((x)=>`<div class="timeline-item"><div class="timeline-dot"><i class="${x.icon}"></i></div><div class="timeline-copy"><strong>${esc(x.title)}</strong><p>${esc(x.meta)}</p><small>${esc(dateCL(x.date,true))}</small>${x.type === "file" ? `<button class="mini-btn project-open-file" data-path="${esc(x.ref.storage_path)}" title="Abrir archivo" style="margin-top:6px"><i class="ri-external-link-line"></i></button>` : ""}</div></div>`).join("") : empty("ri-time-line","Sin actividad","Los archivos y movimientos del proyecto aparecerán aquí.")}</div></section><aside><div class="panel" style="box-shadow:none"><div class="panel-head"><h3>Acciones</h3></div><div class="panel-body"><div class="toolbar">${can("superadmin","admin","finance","project_manager") ? `<button id="project-upload" class="btn outline"><i class="ri-upload-cloud-line"></i> Subir archivo</button>` : ""}${can("superadmin","admin","project_manager") ? `<button id="project-meeting" class="btn ghost"><i class="ri-calendar-event-line"></i> Reunión</button><button id="project-document" class="btn ghost"><i class="ri-file-edit-line"></i> Documento</button>` : ""}${can("superadmin","admin","finance") ? `<button id="project-quote" class="btn ghost"><i class="ri-file-list-3-line"></i> Cotización</button><button id="project-invoice" class="btn ghost"><i class="ri-bill-line"></i> Factura</button>` : ""}</div></div></div></aside></div>`, "", true);
    $$(".project-open-file").forEach((b)=>b.addEventListener("click",()=>openStoragePath(b.dataset.path)));
    $("#project-upload")?.addEventListener("click",()=>openUploadFile(project.id));
    $("#project-meeting")?.addEventListener("click",()=>openMeetingForm(project.id));
    $("#project-document")?.addEventListener("click",()=>openDocumentEditor(null, project.id));
    $("#project-quote")?.addEventListener("click",()=>openQuotation(null, project.id));
    $("#project-invoice")?.addEventListener("click",()=>openInvoiceImport(project.id));
  }

  function openUploadFile(projectId = null, categoryDefault = "project") {
    if (!writable("superadmin","admin","finance","project_manager")) return;
    modal("Subir archivo", `<form id="upload-form" class="form-grid"><label class="form-field"><span>Proyecto</span><select name="project_id"><option value="">Sin proyecto</option>${state.projects.map((p)=>`<option value="${p.id}">${esc(p.title)}</option>`).join("")}</select></label><label class="form-field"><span>Categoría</span><select name="category"><option value="project">Proyecto</option><option value="report">Informe</option><option value="meeting">Reunión</option><option value="image">Imagen</option><option value="quotation">Cotización</option><option value="invoice">Factura</option><option value="contract">Contrato</option><option value="purchase_order">Orden de compra</option><option value="other">Otro</option></select></label><label class="form-field full"><span>Título</span><input name="title" required /></label><label class="form-field full"><span>Fecha del documento / evidencia</span><input name="occurred_at" type="datetime-local" /></label><label class="dropzone full" id="upload-drop"><i class="ri-upload-cloud-2-line"></i><strong>Selecciona o arrastra un archivo</strong><span>PDF, Word, Excel, imágenes, PPT y otros formatos de trabajo.</span><input id="upload-file" type="file" required /></label><div id="upload-file-info" class="file-preview full hidden"></div></form>`, `<button class="btn ghost modal-close-2">Cancelar</button><button id="save-upload" class="btn primary">Subir archivo</button>`);
    $("#upload-form [name=project_id]").value = projectId || "";
    $("#upload-form [name=category]").value = categoryDefault;
    $(".modal-close-2").addEventListener("click",closeModal);
    const drop=$("#upload-drop"), input=$("#upload-file");
    drop.addEventListener("click",()=>input.click());
    ["dragenter","dragover"].forEach((ev)=>drop.addEventListener(ev,(e)=>{e.preventDefault();drop.classList.add("drag")}));
    ["dragleave","drop"].forEach((ev)=>drop.addEventListener(ev,(e)=>{e.preventDefault();drop.classList.remove("drag")}));
    drop.addEventListener("drop",(e)=>{if(e.dataTransfer.files[0]){input.files=e.dataTransfer.files;showUploadInfo(input.files[0]);}});
    input.addEventListener("change",()=>showUploadInfo(input.files[0]));
    $("#save-upload").addEventListener("click",async()=>{
      const file=input.files[0]; if(!file)return toast("Selecciona un archivo.","warning");
      const fd=new FormData($("#upload-form")); const title=String(fd.get("title")||file.name).trim(); if(!title)return toast("Agrega un título.","warning");
      const pid=String(fd.get("project_id")||"")||null; const category=String(fd.get("category")||"other");
      const now=new Date(); const path=`${state.user.id}/${pid||"general"}/${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,"0")}/${uuid()}-${safeName(file.name)}`;
      toast("Subiendo archivo…","warning");
      const up=await client.storage.from(cfg.storageBucket).upload(path,file,{contentType:file.type||"application/octet-stream",upsert:false});
      if(up.error)return toast(up.error.message,"error");
      const ins=await client.from("company_files").insert({project_id:pid,category,title,original_name:file.name,storage_path:path,mime_type:file.type||null,file_size:file.size,occurred_at:String(fd.get("occurred_at")||"")||null,created_by:state.user.id});
      if(ins.error){await client.storage.from(cfg.storageBucket).remove([path]);return toast(ins.error.message,"error");}
      closeModal();toast("Archivo guardado."); if(state.view==="projects")await renderProjects();
    });
  }
  function showUploadInfo(file){const info=$("#upload-file-info");if(!file)return;info.innerHTML=`<strong>${esc(file.name)}</strong><br>${(file.size/1024/1024).toFixed(2)} MB · ${esc(file.type||"archivo")}`;info.classList.remove("hidden");}
  async function openStoragePath(path){const {data,error}=await client.storage.from(cfg.storageBucket).createSignedUrl(path,3600);if(error)return toast(error.message,"error");window.open(data.signedUrl,"_blank","noopener");}

  function openMeetingForm(projectId) {
    if(!writable("superadmin","admin","project_manager"))return;
    modal("Registrar reunión",`<form id="meeting-form" class="form-grid"><label class="form-field full"><span>Título</span><input name="title" required /></label><label class="form-field"><span>Fecha y hora</span><input type="datetime-local" name="meeting_date" required value="${new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)}" /></label><label class="form-field"><span>Asistentes (separados por coma)</span><input name="attendees" /></label><label class="form-field full"><span>Notas / acuerdos</span><textarea name="notes"></textarea></label></form>`,`<button class="btn ghost modal-close-2">Cancelar</button><button id="save-meeting" class="btn primary">Guardar reunión</button>`);
    $(".modal-close-2").addEventListener("click",closeModal);
    $("#save-meeting").addEventListener("click",async()=>{const fd=new FormData($("#meeting-form"));const payload={project_id:projectId,title:String(fd.get("title")||"").trim(),meeting_date:String(fd.get("meeting_date")||""),attendees:String(fd.get("attendees")||"").split(",").map(x=>x.trim()).filter(Boolean),notes_html:`<p>${esc(String(fd.get("notes")||"")).replace(/\n/g,"<br>")}</p>`,created_by:state.user.id};if(!payload.title)return toast("Agrega un título.","warning");const {error}=await client.from("company_meetings").insert(payload);if(error)return toast(error.message,"error");closeModal();toast("Reunión registrada.");});
  }

  async function renderDocuments() {
    const {data,error}=await client.from("company_documents").select("id,title,document_type,status,version,project_id,created_at,updated_at").order("updated_at",{ascending:false});if(error)throw error;state.documents=data||[];
    main().innerHTML=`<div class="page-head"><div><h2>Centro de documentos</h2><p>Crea informes, actas, contratos y documentos editables con versiones y exportación PDF.</p></div>${can("superadmin","admin","finance","project_manager")?`<button id="new-document" class="btn primary"><i class="ri-file-add-line"></i> Nuevo documento</button>`:""}</div><div class="filter-bar"><input id="document-filter" type="search" placeholder="Buscar documento" /><select id="document-type"><option value="">Todos los tipos</option><option value="general">General</option><option value="report">Informe</option><option value="meeting_minutes">Acta</option><option value="contract">Contrato</option><option value="letter">Carta</option><option value="financial_report">Informe financiero</option></select></div><div id="document-grid" class="card-grid"></div>`;
    $("#new-document")?.addEventListener("click",()=>openDocumentEditor());$("#document-filter").addEventListener("input",paintDocuments);$("#document-type").addEventListener("change",paintDocuments);paintDocuments();
  }
  function paintDocuments(){const q=($("#document-filter")?.value||"").toLowerCase(),t=$("#document-type")?.value||"";const rows=state.documents.filter(d=>(!q||d.title.toLowerCase().includes(q))&&(!t||d.document_type===t));$("#document-grid").innerHTML=rows.length?rows.map(d=>`<article class="entity-card"><div class="card-top"><span class="status ${esc(d.status)}">${esc(statusLabel(d.status))}</span><div class="entity-actions"><button class="mini-btn open-doc" data-id="${d.id}"><i class="ri-edit-box-line"></i></button></div></div><h3>${esc(d.title)}</h3><p>${esc(d.document_type)} · versión ${d.version}</p><div class="card-footer"><span>${esc(dateCL(d.updated_at,true))}</span><span>v${d.version}</span></div></article>`).join(""):`<div class="panel" style="grid-column:1/-1">${empty("ri-file-edit-line","Sin documentos","Crea el primer documento editable de la empresa.")}</div>`;$$('.open-doc').forEach(b=>b.addEventListener('click',()=>openDocumentEditor(b.dataset.id)));}

  async function openDocumentEditor(id=null,projectId=null){
    if(id&&!state.documents.find(d=>d.id===id)){const {data}=await client.from("company_documents").select("*").eq("id",id).single();if(data)state.documents.push(data);}
    let doc=id?(await client.from("company_documents").select("*").eq("id",id).single()).data:null;
    const projectOptions=state.projects.length?state.projects:((await client.from("company_projects").select("id,title").order("title")).data||[]);
    const body=`<div class="editor-shell"><div class="editor-main"><div class="editor-toolbar"><button class="editor-tool" data-cmd="bold"><i class="ri-bold"></i></button><button class="editor-tool" data-cmd="italic"><i class="ri-italic"></i></button><button class="editor-tool" data-cmd="underline"><i class="ri-underline"></i></button><button class="editor-tool" data-cmd="insertUnorderedList"><i class="ri-list-unordered"></i></button><button class="editor-tool" data-cmd="insertOrderedList"><i class="ri-list-ordered-2"></i></button><button class="editor-tool" data-cmd="justifyLeft"><i class="ri-align-left"></i></button><button class="editor-tool" data-cmd="justifyCenter"><i class="ri-align-center"></i></button><button class="editor-tool" data-cmd="justifyRight"><i class="ri-align-right"></i></button><button id="editor-link" class="editor-tool"><i class="ri-link"></i></button><button id="editor-image" class="editor-tool"><i class="ri-image-add-line"></i></button><select id="editor-format" class="table-input" style="width:auto;height:34px;padding:0 8px"><option value="p">Párrafo</option><option value="h1">Título 1</option><option value="h2">Título 2</option><option value="h3">Título 3</option></select></div><article id="editor-page" class="editor-page" contenteditable="true">${sanitize(doc?.content_html||`<h1>${esc(doc?.title||"Nuevo documento")}</h1><p>Comienza a redactar aquí.</p>`)}</article><input id="editor-image-input" type="file" accept="image/*" hidden /></div><aside class="editor-side"><h4>Documento</h4><label class="form-field"><span>Título</span><input id="doc-title" value="${esc(doc?.title||"Nuevo documento")}" /></label><label class="form-field"><span>Tipo</span><select id="doc-type"><option value="general">General</option><option value="report">Informe</option><option value="meeting_minutes">Acta de reunión</option><option value="quotation">Cotización</option><option value="contract">Contrato</option><option value="letter">Carta</option><option value="memo">Memorándum</option><option value="financial_report">Informe financiero</option></select></label><label class="form-field"><span>Proyecto</span><select id="doc-project"><option value="">Sin proyecto</option>${projectOptions.map(p=>`<option value="${p.id}">${esc(p.title)}</option>`).join("")}</select></label><label class="form-field"><span>Estado</span><select id="doc-status"><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></select></label><div class="preview-frame">${doc?`Versión actual: <strong>${doc.version}</strong><br>Última edición: ${esc(dateCL(doc.updated_at,true))}`:"El documento se guardará con historial automático de versiones."}</div></aside></div>`;
    modal(doc?`Editar: ${doc.title}`:"Nuevo documento",body,`<button class="btn ghost modal-close-2">Cerrar</button><button id="export-doc" class="btn outline"><i class="ri-file-pdf-2-line"></i> Descargar PDF</button>${can("superadmin","admin","finance","project_manager")?`<button id="save-doc" class="btn primary"><i class="ri-save-line"></i> Guardar</button>`:""}`,true);
    $("#doc-type").value=doc?.document_type||"general";$("#doc-project").value=doc?.project_id||projectId||"";$("#doc-status").value=doc?.status||"draft";
    $$(".editor-tool[data-cmd]").forEach(b=>b.addEventListener("click",()=>{document.execCommand(b.dataset.cmd,false,null);$("#editor-page").focus();}));
    $("#editor-format").addEventListener("change",e=>document.execCommand("formatBlock",false,e.target.value));
    $("#editor-link").addEventListener("click",()=>{const url=prompt("Dirección del enlace:");if(url)document.execCommand("createLink",false,url);});
    $("#editor-image").addEventListener("click",()=>$("#editor-image-input").click());
    $("#editor-image-input").addEventListener("change",async(e)=>{const file=e.target.files[0];if(!file)return;if(file.size>2*1024*1024)return toast("Para el editor, usa imágenes de máximo 2 MB.","warning");const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});document.execCommand("insertImage",false,dataUrl);});
    $(".modal-close-2").addEventListener("click",closeModal);
    $("#export-doc").addEventListener("click",()=>exportElementPdf($("#editor-page"),`${$("#doc-title").value||"documento"}.pdf`));
    $("#save-doc")?.addEventListener("click",async()=>{const payload={title:$("#doc-title").value.trim(),document_type:$("#doc-type").value,project_id:$("#doc-project").value||null,status:$("#doc-status").value,content_html:sanitize($("#editor-page").innerHTML),content_json:{editor:"contenteditable-v1"},updated_by:state.user.id};if(!payload.title)return toast("El documento necesita un título.","warning");let res;if(doc)res=await client.from("company_documents").update(payload).eq("id",doc.id).select().single();else res=await client.from("company_documents").insert({...payload,created_by:state.user.id}).select().single();if(res.error)return toast(res.error.message,"error");doc=res.data;toast("Documento guardado.");});
  }

  function exportElementPdf(element,filename){if(!window.html2pdf)return window.print();window.html2pdf().set({margin:10,filename:safeName(filename),image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"}}).from(element).save();}

  async function renderQuotations(){const {data,error}=await client.from("company_quotations").select("*").order("created_at",{ascending:false});if(error)throw error;state.quotations=data||[];main().innerHTML=`<div class="page-head"><div><h2>Cotizaciones</h2><p>Crea cotizaciones estructuradas, calcula IVA automáticamente y genera el documento PDF.</p></div>${can("superadmin","admin","finance")?`<button id="new-quote" class="btn primary"><i class="ri-add-line"></i> Nueva cotización</button>`:""}</div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Número</th><th>Cliente</th><th>Fecha</th><th>Validez</th><th>Estado</th><th>Total</th><th></th></tr></thead><tbody>${state.quotations.length?state.quotations.map(q=>`<tr><td><strong>${esc(q.quote_number)}</strong></td><td>${esc(q.client_name)}</td><td>${esc(dateCL(q.issue_date))}</td><td>${esc(dateCL(q.valid_until))}</td><td><span class="status ${esc(q.status)}">${esc(statusLabel(q.status))}</span></td><td><strong>${money(q.total_amount)}</strong></td><td><button class="mini-btn open-quote" data-id="${q.id}"><i class="ri-edit-box-line"></i></button></td></tr>`).join(""):`<tr><td colspan="7">${empty("ri-file-list-3-line","Sin cotizaciones","Crea la primera cotización.")}</td></tr>`}</tbody></table></div>`;$("#new-quote")?.addEventListener("click",()=>openQuotation());$$('.open-quote').forEach(b=>b.addEventListener('click',()=>openQuotation(b.dataset.id)));}

  async function nextQuoteNumber(){const year=new Date().getFullYear();const {data}=await client.from("company_quotations").select("quote_number").like("quote_number",`COT-${year}-%`).order("created_at",{ascending:false}).limit(50);let max=0;(data||[]).forEach(x=>{const n=Number(String(x.quote_number).split("-").pop());if(Number.isFinite(n))max=Math.max(max,n)});return `COT-${year}-${String(max+1).padStart(3,"0")}`;}

  async function openQuotation(id=null,projectId=null){if(id&&!state.quotations.find(q=>q.id===id)){const {data}=await client.from("company_quotations").select("*").eq("id",id).single();if(data)state.quotations.push(data)}const q=id?state.quotations.find(x=>x.id===id):null;if(!q&&!can("superadmin","admin","finance"))return;const projects=state.projects.length?state.projects:((await client.from("company_projects").select("id,title,client_name,client_rut").order("title")).data||[]);const number=q?.quote_number||await nextQuoteNumber();const items=Array.isArray(q?.items)&&q.items.length?q.items:[{description:"",quantity:1,unit_price:0}];modal(q?`Cotización ${q.quote_number}`:"Nueva cotización",`<form id="quote-form" class="form-grid"><label class="form-field"><span>Número</span><input name="quote_number" value="${esc(number)}" required /></label><label class="form-field"><span>Estado</span><select name="status"><option value="draft">Borrador</option><option value="sent">Enviada</option><option value="approved">Aprobada</option><option value="rejected">Rechazada</option><option value="expired">Vencida</option><option value="invoiced">Facturada</option></select></label><label class="form-field"><span>Proyecto</span><select name="project_id"><option value="">Sin proyecto</option>${projects.map(p=>`<option value="${p.id}">${esc(p.title)}</option>`).join("")}</select></label><label class="form-field"><span>Fecha emisión</span><input type="date" name="issue_date" value="${esc(q?.issue_date||new Date().toISOString().slice(0,10))}" /></label><label class="form-field"><span>Cliente</span><input name="client_name" value="${esc(q?.client_name||"")}" required /></label><label class="form-field"><span>RUT</span><input name="client_rut" value="${esc(q?.client_rut||"")}" /></label><label class="form-field"><span>Válida hasta</span><input type="date" name="valid_until" value="${esc(q?.valid_until||"")}" /></label><label class="form-field"><span>IVA %</span><input type="number" name="vat_rate" value="${Number(q?.vat_rate||19)}" step="0.01" /></label><div class="full"><strong style="font-size:.8rem">Ítems</strong><div id="quote-items" class="quote-items"></div><button id="add-quote-item" type="button" class="btn ghost"><i class="ri-add-line"></i> Agregar ítem</button></div><label class="form-field full"><span>Notas</span><textarea name="notes">${esc(q?.notes||"")}</textarea></label><div class="full quote-summary"><strong>Subtotal</strong><span id="q-subtotal">$0</span><strong>Descuento</strong><span><input id="q-discount" class="table-input" type="number" min="0" value="${Number(q?.discount||0)}" style="width:130px"></span><strong>Neto</strong><span id="q-net">$0</span><strong>IVA</strong><span id="q-vat">$0</span><strong class="total">TOTAL</strong><span id="q-total" class="total">$0</span></div></form>`,`<button class="btn ghost modal-close-2">Cerrar</button>${q?`<button id="pdf-quote" class="btn outline"><i class="ri-file-pdf-2-line"></i> PDF</button>`:""}${can("superadmin","admin","finance")?`<button id="save-quote" class="btn primary">Guardar cotización</button>`:""}`,true);$("#quote-form [name=status]").value=q?.status||"draft";$("#quote-form [name=project_id]").value=q?.project_id||projectId||"";if(projectId&&!q){const p=projects.find(x=>x.id===projectId);if(p){$("#quote-form [name=client_name]").value=p.client_name||"";$("#quote-form [name=client_rut]").value=p.client_rut||"";}}const itemBox=$("#quote-items");function paintItems(){itemBox.innerHTML=items.map((it,i)=>`<div class="quote-row" data-index="${i}"><input class="table-input qi-desc" value="${esc(it.description||"")}" placeholder="Descripción"><input class="table-input qi-qty" type="number" min="0" step="1" value="${Number(it.quantity||0)}"><input class="table-input qi-price" type="number" min="0" value="${Number(it.unit_price||0)}"><strong class="qi-total">${money(Number(it.quantity||0)*Number(it.unit_price||0))}</strong><button type="button" class="mini-btn qi-remove"><i class="ri-delete-bin-line"></i></button></div>`).join("");$$('.quote-row',itemBox).forEach(row=>{const i=Number(row.dataset.index);row.querySelector('.qi-desc').addEventListener('input',e=>{items[i].description=e.target.value});row.querySelector('.qi-qty').addEventListener('input',e=>{items[i].quantity=Number(e.target.value||0);calcQuote()});row.querySelector('.qi-price').addEventListener('input',e=>{items[i].unit_price=Number(e.target.value||0);calcQuote()});row.querySelector('.qi-remove').addEventListener('click',()=>{items.splice(i,1);if(!items.length)items.push({description:"",quantity:1,unit_price:0});paintItems();calcQuote()});});calcQuote();}function calcQuote(){const sub=items.reduce((a,x)=>a+Number(x.quantity||0)*Number(x.unit_price||0),0);const dis=Number($('#q-discount').value||0);const net=Math.max(0,sub-dis);const rate=Number($('#quote-form [name=vat_rate]').value||19);const vat=Math.round(net*rate/100);const total=net+vat;$('#q-subtotal').textContent=money(sub);$('#q-net').textContent=money(net);$('#q-vat').textContent=money(vat);$('#q-total').textContent=money(total);$$('.quote-row',itemBox).forEach((row,i)=>row.querySelector('.qi-total').textContent=money(Number(items[i].quantity||0)*Number(items[i].unit_price||0)));return{sub,dis,net,rate,vat,total}}paintItems();$('#add-quote-item').addEventListener('click',()=>{items.push({description:"",quantity:1,unit_price:0});paintItems()});$('#q-discount').addEventListener('input',calcQuote);$('#quote-form [name=vat_rate]').addEventListener('input',calcQuote);$('.modal-close-2').addEventListener('click',closeModal);$('#save-quote')?.addEventListener('click',async()=>{const f=new FormData($('#quote-form'));const c=calcQuote();const payload={quote_number:String(f.get('quote_number')||'').trim(),status:String(f.get('status')),project_id:String(f.get('project_id')||'')||null,issue_date:String(f.get('issue_date')||'')||null,client_name:String(f.get('client_name')||'').trim(),client_rut:String(f.get('client_rut')||'').trim()||null,valid_until:String(f.get('valid_until')||'')||null,vat_rate:c.rate,items,subtotal:c.sub,discount:c.dis,net_amount:c.net,vat_amount:c.vat,total_amount:c.total,notes:String(f.get('notes')||'').trim()||null,created_by:q?.created_by||state.user.id};if(!payload.quote_number||!payload.client_name)return toast('Completa número y cliente.','warning');let res=q?await client.from('company_quotations').update(payload).eq('id',q.id).select().single():await client.from('company_quotations').insert(payload).select().single();if(res.error)return toast(res.error.message,'error');q?Object.assign(q,res.data):state.quotations.unshift(res.data);toast('Cotización guardada.');if(!res.data.document_id){const html=quoteHtml(res.data);const dr=await client.from('company_documents').insert({project_id:res.data.project_id,document_type:'quotation',title:`Cotización ${res.data.quote_number}`,content_html:html,status:'published',created_by:state.user.id,updated_by:state.user.id}).select().single();if(dr.data)await client.from('company_quotations').update({document_id:dr.data.id}).eq('id',res.data.id);}closeModal();await renderQuotations();});$('#pdf-quote')?.addEventListener('click',()=>{const c=calcQuote();const temp=document.createElement('div');temp.className='editor-page';temp.innerHTML=quoteHtml({...q,items,subtotal:c.sub,discount:c.dis,net_amount:c.net,vat_rate:c.rate,vat_amount:c.vat,total_amount:c.total});document.body.appendChild(temp);exportElementPdf(temp,`${q.quote_number}.pdf`);setTimeout(()=>temp.remove(),1000);});}

  function quoteHtml(q){return `<div style="font-family:Arial,sans-serif;color:#1d2941"><div style="display:flex;justify-content:space-between;border-bottom:2px solid #315efb;padding-bottom:18px"><div><h1 style="margin:0">INNOVA SPACE EDUCATION SPA</h1><p>contacto@innova-space-edu.cl</p></div><div style="text-align:right"><h2 style="margin:0">COTIZACIÓN</h2><strong>${esc(q.quote_number)}</strong></div></div><div style="margin:22px 0"><strong>Cliente:</strong> ${esc(q.client_name||"")}<br><strong>RUT:</strong> ${esc(q.client_rut||"—")}<br><strong>Fecha:</strong> ${esc(dateCL(q.issue_date))}</div><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;border-bottom:1px solid #ccc;padding:8px">Descripción</th><th style="border-bottom:1px solid #ccc">Cant.</th><th style="border-bottom:1px solid #ccc">Unitario</th><th style="border-bottom:1px solid #ccc">Total</th></tr></thead><tbody>${(q.items||[]).map(i=>`<tr><td style="padding:8px;border-bottom:1px solid #eee">${esc(i.description)}</td><td style="text-align:center">${Number(i.quantity||0)}</td><td style="text-align:right">${money(i.unit_price)}</td><td style="text-align:right">${money(Number(i.quantity||0)*Number(i.unit_price||0))}</td></tr>`).join("")}</tbody></table><div style="width:320px;margin:24px 0 0 auto"><p><strong>Neto:</strong> <span style="float:right">${money(q.net_amount)}</span></p><p><strong>IVA ${Number(q.vat_rate||19)}%:</strong> <span style="float:right">${money(q.vat_amount)}</span></p><p style="font-size:1.2em;border-top:2px solid #315efb;padding-top:10px"><strong>Total:</strong> <strong style="float:right">${money(q.total_amount)}</strong></p></div>${q.notes?`<p><strong>Notas:</strong><br>${esc(q.notes).replace(/\n/g,"<br>")}</p>`:""}</div>`;}

  async function renderInvoices(){const {data,error}=await client.from("company_invoices").select("*").order("created_at",{ascending:false});if(error)throw error;state.invoices=data||[];const total=state.invoices.reduce((a,b)=>a+Number(b.total_amount||0),0),vat=state.invoices.reduce((a,b)=>a+Number(b.vat_amount||0),0),pending=state.invoices.filter(i=>['pending','partial'].includes(i.payment_status)).reduce((a,b)=>a+Number(b.total_amount||0),0);main().innerHTML=`<div class="page-head"><div><h2>Facturas y finanzas</h2><p>Guarda PDF/XML DTE, extrae datos tributarios y relaciona cada factura con sus proyectos.</p></div>${can("superadmin","admin","finance")?`<button id="import-invoice" class="btn primary"><i class="ri-upload-cloud-line"></i> Importar factura</button>`:""}</div><div class="stats-grid">${statCard('ri-money-dollar-circle-line',money(total),'Total registrado')}${statCard('ri-percent-line',money(vat),'IVA registrado')}${statCard('ri-time-line',money(pending),'Pendiente de pago')}${statCard('ri-file-copy-2-line',state.invoices.length,'Documentos')}</div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Folio</th><th>Emisor</th><th>Fecha</th><th>Neto</th><th>IVA</th><th>Total</th><th>Pago</th><th></th></tr></thead><tbody>${state.invoices.length?state.invoices.map(i=>`<tr><td><strong>${esc(i.folio||'—')}</strong><br><small>${esc(i.dte_type||'DTE')}</small></td><td>${esc(i.issuer_name||'—')}<br><small>${esc(i.issuer_rut||'')}</small></td><td>${esc(dateCL(i.issue_date))}</td><td>${money(i.net_amount)}</td><td>${money(i.vat_amount)}</td><td><strong>${money(i.total_amount)}</strong></td><td><span class="status ${esc(i.payment_status)}">${esc(statusLabel(i.payment_status))}</span></td><td><button class="mini-btn invoice-open" data-id="${i.id}"><i class="ri-eye-line"></i></button></td></tr>`).join(""):`<tr><td colspan="8">${empty('ri-bill-line','Sin facturas','Importa PDF o XML para comenzar el registro financiero.')}</td></tr>`}</tbody></table></div>`;$('#import-invoice')?.addEventListener('click',()=>openInvoiceImport());$$('.invoice-open').forEach(b=>b.addEventListener('click',()=>openInvoiceDetail(b.dataset.id)));}

  function openInvoiceImport(projectId=null){if(!writable("superadmin","admin","finance"))return;state.invoiceDraft={file:null,xmlData:{},extractedText:""};modal("Importar factura",`<form id="invoice-form" class="form-grid"><label class="form-field"><span>Proyecto</span><select name="project_id"><option value="">Sin proyecto</option>${state.projects.map(p=>`<option value="${p.id}">${esc(p.title)}</option>`).join("")}</select></label><label class="form-field"><span>Tipo interno</span><select name="invoice_type"><option value="purchase">Compra / gasto</option><option value="sale">Venta / ingreso</option></select></label><label class="dropzone full" id="invoice-drop"><i class="ri-file-search-line"></i><strong>Selecciona PDF o XML DTE</strong><span>El XML permite leer los montos sin OCR.</span><input id="invoice-file" type="file" accept=".pdf,.xml,application/pdf,text/xml,application/xml" /></label><div id="invoice-processing" class="file-preview full hidden"></div><label class="form-field"><span>Tipo DTE</span><input name="dte_type" /></label><label class="form-field"><span>Folio</span><input name="folio" /></label><label class="form-field"><span>RUT emisor</span><input name="issuer_rut" /></label><label class="form-field"><span>Razón social</span><input name="issuer_name" /></label><label class="form-field"><span>RUT receptor</span><input name="recipient_rut" /></label><label class="form-field"><span>Fecha emisión</span><input type="date" name="issue_date" /></label><label class="form-field"><span>Fecha vencimiento</span><input type="date" name="due_date" /></label><label class="form-field"><span>Neto</span><input type="number" name="net_amount" value="0" /></label><label class="form-field"><span>Exento</span><input type="number" name="exempt_amount" value="0" /></label><label class="form-field"><span>IVA</span><input type="number" name="vat_amount" value="0" /></label><label class="form-field"><span>Total</span><input type="number" name="total_amount" value="0" /></label><label class="form-field"><span>Estado de pago</span><select name="payment_status"><option value="pending">Pendiente</option><option value="partial">Parcial</option><option value="paid">Pagada</option><option value="void">Anulada</option></select></label><label class="form-field full"><span>Notas</span><textarea name="notes"></textarea></label></form>`,`<button class="btn ghost modal-close-2">Cancelar</button><button id="save-invoice" class="btn primary">Guardar factura</button>`,true);$('#invoice-form [name=project_id]').value=projectId||'';$('.modal-close-2').addEventListener('click',closeModal);const drop=$('#invoice-drop'),input=$('#invoice-file');drop.addEventListener('click',()=>input.click());input.addEventListener('change',()=>processInvoiceFile(input.files[0]));['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag')}));['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('drag')}));drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f){const dt=new DataTransfer();dt.items.add(f);input.files=dt.files;processInvoiceFile(f)}});$('#save-invoice').addEventListener('click',saveInvoiceDraft);}

  async function processInvoiceFile(file){if(!file)return;state.invoiceDraft.file=file;const info=$('#invoice-processing');info.classList.remove('hidden');info.textContent=`Procesando ${file.name}…`;try{if(file.name.toLowerCase().endsWith('.xml')||file.type.includes('xml')){const text=await file.text();const parsed=parseDteXml(text);state.invoiceDraft.xmlData=parsed.raw;fillInvoiceForm(parsed);info.textContent=`XML leído: folio ${parsed.folio||'—'}, total ${money(parsed.total_amount)}.`;}else if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){const text=await extractPdfText(file);state.invoiceDraft.extractedText=text;fillInvoiceForm(guessInvoiceFromText(text));info.textContent=`PDF leído: ${text.length.toLocaleString('es-CL')} caracteres extraídos. Revisa los datos antes de guardar.`;}else info.textContent='Archivo adjunto. Completa los datos manualmente.';}catch(error){console.error(error);info.textContent='No fue posible extraer automáticamente todos los datos. Puedes completarlos manualmente.';}}

  function xmlText(doc,name){const el=[...doc.getElementsByTagName('*')].find(n=>n.localName===name);return el?.textContent?.trim()||'';}
  function parseDteXml(text){const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw new Error('XML inválido');const raw={dte_type:xmlText(doc,'TipoDTE'),folio:xmlText(doc,'Folio'),issue_date:xmlText(doc,'FchEmis'),due_date:xmlText(doc,'FchVenc'),issuer_rut:xmlText(doc,'RUTEmisor'),issuer_name:xmlText(doc,'RznSoc'),recipient_rut:xmlText(doc,'RUTRecep'),net_amount:Number(xmlText(doc,'MntNeto')||0),exempt_amount:Number(xmlText(doc,'MntExe')||0),vat_amount:Number(xmlText(doc,'IVA')||0),total_amount:Number(xmlText(doc,'MntTotal')||0)};return {...raw,raw};}
  function fillInvoiceForm(data){const form=$('#invoice-form');if(!form)return;['dte_type','folio','issuer_rut','issuer_name','recipient_rut','issue_date','due_date','net_amount','exempt_amount','vat_amount','total_amount'].forEach(k=>{if(data?.[k]!==undefined&&data?.[k]!==null&&String(data[k])!=='')form.elements[k].value=data[k]});}
  function guessInvoiceFromText(text){const t=text.replace(/\s+/g,' ');const total=(t.match(/TOTAL\s*[:$]?\s*\$?\s*([\d.]+)/i)||[])[1];const iva=(t.match(/IVA[^\d]{0,20}([\d.]+)/i)||[])[1];const net=(t.match(/NETO[^\d]{0,20}([\d.]+)/i)||[])[1];const folio=(t.match(/(?:FOLIO|N[°º]\.?)[^\d]{0,15}(\d{1,12})/i)||[])[1];const rut=(t.match(/\b\d{1,2}\.\d{3}\.\d{3}-[0-9Kk]\b/)||[])[0];const num=x=>Number(String(x||'0').replace(/\./g,''));return{folio:folio||'',issuer_rut:rut||'',net_amount:num(net),vat_amount:num(iva),total_amount:num(total)};}
  async function extractPdfText(file){if(!window.pdfjsLib)return'';const bytes=new Uint8Array(await file.arrayBuffer());const pdf=await window.pdfjsLib.getDocument({data:bytes}).promise;let out='';const max=Math.min(pdf.numPages,80);for(let p=1;p<=max;p++){const page=await pdf.getPage(p);const content=await page.getTextContent();out+=content.items.map(i=>i.str).join(' ')+'\n';if(out.length>140000)break;}return out.slice(0,140000);}

  async function saveInvoiceDraft(){const form=$('#invoice-form'),fd=new FormData(form),file=state.invoiceDraft?.file;if(!file)return toast('Adjunta el PDF o XML de la factura.','warning');let sourceFileId=null;const pid=String(fd.get('project_id')||'')||null;const path=`${state.user.id}/${pid||'general'}/${new Date().getFullYear()}/facturas/${uuid()}-${safeName(file.name)}`;const up=await client.storage.from(cfg.storageBucket).upload(path,file,{contentType:file.type||'application/octet-stream'});if(up.error)return toast(up.error.message,'error');const fr=await client.from('company_files').insert({project_id:pid,category:'invoice',title:`Factura ${String(fd.get('folio')||file.name)}`,original_name:file.name,storage_path:path,mime_type:file.type||null,file_size:file.size,created_by:state.user.id}).select().single();if(fr.error){await client.storage.from(cfg.storageBucket).remove([path]);return toast(fr.error.message,'error');}sourceFileId=fr.data.id;const payload={project_id:pid,invoice_type:String(fd.get('invoice_type')),dte_type:String(fd.get('dte_type')||'').trim()||null,folio:String(fd.get('folio')||'').trim()||null,issuer_rut:String(fd.get('issuer_rut')||'').trim()||null,issuer_name:String(fd.get('issuer_name')||'').trim()||null,recipient_rut:String(fd.get('recipient_rut')||'').trim()||null,issue_date:String(fd.get('issue_date')||'')||null,due_date:String(fd.get('due_date')||'')||null,net_amount:Number(fd.get('net_amount')||0),exempt_amount:Number(fd.get('exempt_amount')||0),vat_amount:Number(fd.get('vat_amount')||0),total_amount:Number(fd.get('total_amount')||0),payment_status:String(fd.get('payment_status')),source_file_id:sourceFileId,xml_data:state.invoiceDraft.xmlData||{},extracted_text:state.invoiceDraft.extractedText||null,notes:String(fd.get('notes')||'').trim()||null,created_by:state.user.id};const ins=await client.from('company_invoices').insert(payload);if(ins.error)return toast(ins.error.message,'error');closeModal();toast('Factura registrada.');await renderInvoices();}

  async function openInvoiceDetail(id){const invoice=state.invoices.find(i=>i.id===id)||(await client.from('company_invoices').select('*').eq('id',id).single()).data;if(!invoice)return;const project=state.projects.find(p=>p.id===invoice.project_id);modal(`Factura ${invoice.folio||'sin folio'}`,`<div class="grid-2"><section class="panel" style="box-shadow:none"><div class="panel-body"><div class="grid-3"><div><small class="muted">Emisor</small><strong style="display:block">${esc(invoice.issuer_name||'—')}</strong><span class="small muted">${esc(invoice.issuer_rut||'')}</span></div><div><small class="muted">Emisión</small><strong style="display:block">${esc(dateCL(invoice.issue_date))}</strong></div><div><small class="muted">Proyecto</small><strong style="display:block">${esc(project?.title||'Sin proyecto')}</strong></div></div><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><div class="quote-summary" style="width:100%"><strong>Neto</strong><span>${money(invoice.net_amount)}</span><strong>Exento</strong><span>${money(invoice.exempt_amount)}</span><strong>IVA</strong><span>${money(invoice.vat_amount)}</span><strong class="total">Total</strong><span class="total">${money(invoice.total_amount)}</span></div></div></section><aside class="panel" style="box-shadow:none"><div class="panel-head"><h3>Acciones</h3></div><div class="panel-body"><div class="toolbar">${invoice.source_file_id?`<button id="invoice-source" class="btn outline"><i class="ri-file-line"></i> Ver archivo</button>`:''}<button id="invoice-ai" class="btn primary"><i class="ri-sparkling-2-line"></i> Analizar con MIRA</button>${can('superadmin','admin','finance')?`<select id="invoice-pay-status" class="table-input"><option value="pending">Pendiente</option><option value="partial">Parcial</option><option value="paid">Pagada</option><option value="void">Anulada</option></select>`:''}</div></div></aside></div>`,"",true);if(invoice.source_file_id)$('#invoice-source')?.addEventListener('click',async()=>{const {data}=await client.from('company_files').select('storage_path').eq('id',invoice.source_file_id).single();if(data)openStoragePath(data.storage_path)});$('#invoice-pay-status')&&( $('#invoice-pay-status').value=invoice.payment_status,$('#invoice-pay-status').addEventListener('change',async e=>{const {error}=await client.from('company_invoices').update({payment_status:e.target.value}).eq('id',invoice.id);if(error)return toast(error.message,'error');invoice.payment_status=e.target.value;toast('Estado de pago actualizado.')}));$('#invoice-ai').addEventListener('click',async()=>{state.selectedChatContext=[{type:'invoice',id:invoice.id,title:`Factura ${invoice.folio||''}`,text:invoiceContext(invoice)}];closeModal();await showView('mira');});}
  function invoiceContext(i){return `Factura/DTE\nFolio: ${i.folio||''}\nTipo DTE: ${i.dte_type||''}\nEmisor: ${i.issuer_name||''} ${i.issuer_rut||''}\nFecha: ${i.issue_date||''}\nVencimiento: ${i.due_date||''}\nNeto: ${i.net_amount||0}\nIVA: ${i.vat_amount||0}\nTotal: ${i.total_amount||0}\nEstado pago: ${i.payment_status||''}\nTexto extraído:\n${String(i.extracted_text||'').slice(0,18000)}`;}

  async function renderMira(){if(!state.projects.length)state.projects=(await client.from('company_projects').select('id,title,client_name,status,budget,due_date').order('updated_at',{ascending:false}).limit(100)).data||[];if(!state.invoices.length)state.invoices=(await client.from('company_invoices').select('*').order('created_at',{ascending:false}).limit(100)).data||[];main().innerHTML=`<div class="page-head"><div><h2>MIRA Business</h2><p>Consulta información de proyectos, facturas y documentos con contexto empresarial seleccionado por ti.</p></div></div><div class="chat-layout"><aside class="chat-context"><h3>Contexto de trabajo</h3><label class="form-field"><span>Agregar proyecto</span><select id="chat-project"><option value="">Seleccionar…</option>${state.projects.map(p=>`<option value="${p.id}">${esc(p.title)}</option>`).join('')}</select></label><label class="form-field"><span>Agregar factura</span><select id="chat-invoice"><option value="">Seleccionar…</option>${state.invoices.map(i=>`<option value="${i.id}">Folio ${esc(i.folio||'—')} · ${esc(i.issuer_name||'')}</option>`).join('')}</select></label><div id="context-list">${paintChatContext()}</div><button id="clear-context" class="btn ghost wide">Limpiar contexto</button></aside><section class="chat-main"><div id="chat-messages" class="chat-messages">${state.chatHistory.length?state.chatHistory.map(m=>`<div class="chat-msg ${m.role==='user'?'user':'bot'}">${esc(m.content)}</div>`).join(''):`<div class="chat-msg bot">Soy MIRA Business. Puedo ayudarte a revisar proyectos, facturas, cotizaciones, pendientes y documentos. Selecciona contexto a la izquierda o haz una consulta general.</div>`}</div><div class="chat-input"><textarea id="chat-input" placeholder="Ej.: ¿Qué riesgos ves en este proyecto?"></textarea><button id="chat-send" class="btn primary"><i class="ri-send-plane-2-line"></i></button></div></section></div>`;$('#chat-project').addEventListener('change',e=>addProjectContext(e.target.value));$('#chat-invoice').addEventListener('change',e=>addInvoiceContext(e.target.value));$('#clear-context').addEventListener('click',()=>{state.selectedChatContext=[];$('#context-list').innerHTML=paintChatContext()});$('#chat-send').addEventListener('click',sendMiraMessage);$('#chat-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMiraMessage()}});setTimeout(()=>{const box=$('#chat-messages');box.scrollTop=box.scrollHeight},0);}
  function paintChatContext(){return state.selectedChatContext.length?state.selectedChatContext.map((c,i)=>`<div class="context-chip"><i class="ri-attachment-2"></i><span>${esc(c.title)}</span><button class="mini-btn context-remove" data-i="${i}" style="margin-left:auto"><i class="ri-close-line"></i></button></div>`).join(''):`<p class="muted small">Sin contexto específico.</p>`;}
  async function addProjectContext(id){if(!id)return;const p=state.projects.find(x=>x.id===id);if(!p)return;const [quotes,invoices,docs]=await Promise.all([client.from('company_quotations').select('quote_number,status,total_amount').eq('project_id',id),client.from('company_invoices').select('folio,payment_status,total_amount,due_date').eq('project_id',id),client.from('company_documents').select('title,document_type,status').eq('project_id',id).limit(20)]);state.selectedChatContext.push({type:'project',id,title:p.title,text:`Proyecto: ${p.title}\nCliente: ${p.client_name||''}\nEstado: ${p.status}\nPresupuesto: ${p.budget||0}\nFecha objetivo: ${p.due_date||''}\nCotizaciones: ${JSON.stringify(quotes.data||[])}\nFacturas: ${JSON.stringify(invoices.data||[])}\nDocumentos: ${JSON.stringify(docs.data||[])}`});$('#context-list').innerHTML=paintChatContext();bindContextRemove();$('#chat-project').value='';}
  function addInvoiceContext(id){if(!id)return;const i=state.invoices.find(x=>x.id===id);if(!i)return;state.selectedChatContext.push({type:'invoice',id,title:`Factura ${i.folio||'—'}`,text:invoiceContext(i)});$('#context-list').innerHTML=paintChatContext();bindContextRemove();$('#chat-invoice').value='';}
  function bindContextRemove(){$$('.context-remove').forEach(b=>b.addEventListener('click',()=>{state.selectedChatContext.splice(Number(b.dataset.i),1);$('#context-list').innerHTML=paintChatContext();bindContextRemove()}));}
  async function sendMiraMessage(){const input=$('#chat-input'),message=input.value.trim();if(!message)return;input.value='';state.chatHistory.push({role:'user',content:message});const box=$('#chat-messages');box.insertAdjacentHTML('beforeend',`<div class="chat-msg user">${esc(message)}</div><div id="mira-thinking" class="chat-msg bot">Analizando…</div>`);box.scrollTop=box.scrollHeight;const context=state.selectedChatContext.map(c=>`### ${c.title}\n${c.text}`).join('\n\n').slice(0,45000);try{let res=await fetch(`${cfg.backendUrl}/api/admin/mira`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${state.session.access_token}`},body:JSON.stringify({message,context,history:state.chatHistory.slice(-12)})});if(res.status===404){res=await fetch(`${cfg.backendUrl}/api/mira`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`Contexto empresarial:\n${context}\n\nConsulta: ${message}`,history:state.chatHistory.slice(-8)})});}const data=await res.json();if(!res.ok)throw new Error(data.error||'No se pudo consultar MIRA');const reply=data.reply||'No pude generar una respuesta.';state.chatHistory.push({role:'assistant',content:reply});$('#mira-thinking').outerHTML=`<div class="chat-msg bot">${esc(reply)}</div>`;}catch(error){$('#mira-thinking').outerHTML=`<div class="chat-msg bot">${esc(error.message)}</div>`;}box.scrollTop=box.scrollHeight;}

  async function runAudit(){if(!can('superadmin','admin','finance'))return toast('Solo administración o finanzas puede ejecutar la auditoría manual.','warning');toast('Ejecutando auditoría…','warning');const {data,error}=await client.rpc('company_run_audit');if(error)return toast(error.message,'error');toast(`Auditoría lista: ${data.open_alerts||0} alertas abiertas.`);if(state.view==='auditor')await renderAuditor();else await renderDashboard();}
  async function renderAuditor(){const {data,error}=await client.from('company_alerts').select('*').order('created_at',{ascending:false}).limit(300);if(error)throw error;state.alerts=data||[];updateAlertBadge();const open=state.alerts.filter(a=>a.status==='open'),critical=open.filter(a=>a.severity==='critical'),high=open.filter(a=>a.severity==='high');main().innerHTML=`<div class="auditor-hero"><section class="auditor-summary"><span class="eyebrow" style="color:#6ee9ff">AGENTE AUTÓNOMO</span><h2>Auditor Innova</h2><p>Revisa vencimientos, facturas pendientes, cotizaciones aprobadas sin facturar y proyectos sin actividad. El proceso automático se ejecuta cada mañana y envía correo cuando aparecen alertas importantes nuevas.</p><div class="auditor-metrics"><div class="auditor-metric"><strong>${open.length}</strong><span>Abiertas</span></div><div class="auditor-metric"><strong>${critical.length}</strong><span>Críticas</span></div><div class="auditor-metric"><strong>${high.length}</strong><span>Altas</span></div></div></section><section class="panel"><div class="panel-head"><h3>Control</h3></div><div class="panel-body"><div class="toolbar"><button id="run-audit" class="btn primary"><i class="ri-scan-2-line"></i> Ejecutar ahora</button>${can('superadmin','admin')?`<button id="email-audit" class="btn outline"><i class="ri-mail-send-line"></i> Enviar resumen</button>`:''}</div><p class="muted small">Correo automático programado: 08:00 hora de Chile, una vez al día.</p></div></section></div><section class="panel"><div class="panel-head"><h3>Alertas</h3><select id="alert-filter" class="table-input" style="width:auto"><option value="open">Abiertas</option><option value="all">Todas</option><option value="resolved">Resueltas</option></select></div><div id="alerts-list" class="panel-body"></div></section>`;$('#run-audit').addEventListener('click',runAudit);$('#email-audit')?.addEventListener('click',sendAuditEmail);$('#alert-filter').addEventListener('change',paintAlerts);paintAlerts();}
  function paintAlerts(){const mode=$('#alert-filter')?.value||'open';const rows=state.alerts.filter(a=>mode==='all'||a.status===mode||mode==='open'&&a.status==='open');$('#alerts-list').innerHTML=rows.length?`<div class="list">${rows.map(a=>`<div class="list-row"><div class="severity-line ${esc(a.severity)}"></div><div class="list-copy"><strong>${esc(a.title)}</strong><span>${esc(a.message)}</span><span>${esc(dateCL(a.created_at,true))}</span></div><div class="entity-actions"><span class="status ${esc(a.severity)}">${esc(a.severity)}</span>${a.status==='open'&&can('superadmin','admin','finance')?`<button class="mini-btn resolve-alert" data-id="${a.id}" title="Resolver"><i class="ri-check-line"></i></button>`:''}</div></div>`).join('')}</div>`:empty('ri-shield-check-line','Sin alertas','No hay alertas en este filtro.');$$('.resolve-alert').forEach(b=>b.addEventListener('click',async()=>{const {error}=await client.from('company_alerts').update({status:'resolved'}).eq('id',b.dataset.id);if(error)return toast(error.message,'error');const a=state.alerts.find(x=>x.id===b.dataset.id);if(a)a.status='resolved';paintAlerts();updateAlertBadge();}));}
  async function sendAuditEmail(){if(!can('superadmin','admin'))return;const important=state.alerts.filter(a=>a.status==='open'&&['critical','high'].includes(a.severity));if(!important.length)return toast('No hay alertas altas o críticas para enviar.','warning');const message=important.slice(0,20).map((a,i)=>`${i+1}. [${a.severity.toUpperCase()}] ${a.title}: ${a.message}`).join('\n');const res=await fetch(`${cfg.backendUrl}/api/admin/notify`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${state.session.access_token}`},body:JSON.stringify({subject:`Innova Admin: ${important.length} alertas requieren atención`,message})});const data=await res.json().catch(()=>({}));if(!res.ok)return toast(data.error||'No se pudo enviar el correo.','error');toast('Resumen enviado por correo.');}

  async function renderUsers(){const {data,error}=await client.from('company_users').select('*').order('created_at',{ascending:true});if(error)throw error;main().innerHTML=`<div class="page-head"><div><h2>Usuarios y seguridad</h2><p>Solo el superadministrador puede modificar accesos. Las modificaciones requieren MFA.</p></div><button id="invite-user" class="btn primary"><i class="ri-user-add-line"></i> Invitar usuario</button></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Creado</th><th></th></tr></thead><tbody>${(data||[]).map(u=>`<tr><td><strong>${esc(u.full_name||u.email)}</strong><br><small>${esc(u.email)}</small></td><td>${esc(roleLabel(u.role))}</td><td><span class="status ${u.status==='active'?'active':'critical'}">${esc(u.status)}</span></td><td>${esc(dateCL(u.created_at))}</td><td><button class="mini-btn edit-user" data-id="${u.user_id}" data-email="${esc(u.email)}" data-name="${esc(u.full_name||'')}" data-role="${esc(u.role)}" data-status="${esc(u.status)}"><i class="ri-shield-user-line"></i></button></td></tr>`).join('')}</tbody></table></div>`;$('#invite-user').addEventListener('click',openInviteUser);$$('.edit-user').forEach(b=>b.addEventListener('click',()=>openEditUser(b.dataset)));}
  async function callUserAdmin(body){if((await currentAal())!=='aal2'){await openMfa(true);throw new Error('Verifica MFA y vuelve a ejecutar la acción.');}const {data,error}=await client.functions.invoke('company-user-admin',{body});if(error)throw error;if(data?.error)throw new Error(data.error);return data;}
  function openInviteUser(){modal('Invitar usuario',`<form id="invite-form" class="form-grid"><label class="form-field full"><span>Nombre</span><input name="fullName" /></label><label class="form-field full"><span>Correo</span><input name="email" type="email" required /></label><label class="form-field full"><span>Rol</span><select name="role"><option value="viewer">Solo lectura</option><option value="project_manager">Gestor de proyectos</option><option value="finance">Finanzas</option><option value="admin">Administrador</option><option value="superadmin">Superadministrador</option></select></label></form>`,`<button class="btn ghost modal-close-2">Cancelar</button><button id="send-invite" class="btn primary">Enviar invitación</button>`);$('.modal-close-2').addEventListener('click',closeModal);$('#send-invite').addEventListener('click',async()=>{const fd=new FormData($('#invite-form'));try{await callUserAdmin({action:'invite',fullName:String(fd.get('fullName')||''),email:String(fd.get('email')||''),role:String(fd.get('role'))});closeModal();toast('Usuario autorizado e invitación procesada.');await renderUsers();}catch(e){toast(e.message,'error')}});}
  function openEditUser(d){modal('Editar acceso',`<form id="edit-user-form" class="form-grid"><label class="form-field full"><span>Correo</span><input value="${esc(d.email)}" disabled /></label><label class="form-field full"><span>Nombre</span><input name="fullName" value="${esc(d.name||'')}" /></label><label class="form-field"><span>Rol</span><select name="role"><option value="viewer">Solo lectura</option><option value="project_manager">Gestor</option><option value="finance">Finanzas</option><option value="admin">Administrador</option><option value="superadmin">Superadministrador</option></select></label><label class="form-field"><span>Estado</span><select name="status"><option value="active">Activo</option><option value="disabled">Deshabilitado</option></select></label></form>`,`<button class="btn ghost modal-close-2">Cancelar</button><button id="save-user" class="btn primary">Guardar cambios</button>`);$('#edit-user-form [name=role]').value=d.role;$('#edit-user-form [name=status]').value=d.status;$('.modal-close-2').addEventListener('click',closeModal);$('#save-user').addEventListener('click',async()=>{const fd=new FormData($('#edit-user-form'));try{await callUserAdmin({action:'update',userId:d.id,fullName:String(fd.get('fullName')||''),role:String(fd.get('role')),status:String(fd.get('status'))});closeModal();toast('Acceso actualizado.');await renderUsers();}catch(e){toast(e.message,'error')}});}

  async function renderActivity(){const {data,error}=await client.from('company_activity').select('*').order('created_at',{ascending:false}).limit(300);if(error)throw error;main().innerHTML=`<div class="page-head"><div><h2>Registro de actividad</h2><p>Trazabilidad de cambios realizados sobre proyectos, documentos, facturas y alertas.</p></div></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Fecha</th><th>Acción</th><th>Entidad</th><th>ID</th></tr></thead><tbody>${(data||[]).map(a=>`<tr><td>${esc(dateCL(a.created_at,true))}</td><td><strong>${esc(a.action)}</strong></td><td>${esc(a.entity_type)}</td><td><code>${esc(a.entity_id||'—')}</code></td></tr>`).join('')}</tbody></table></div>`;}

  async function renderSettings(){const {data}=await client.from('company_settings').select('*').order('key');const emailSetting=(data||[]).find(x=>x.key==='auditor_email_enabled');const aal=await currentAal();main().innerHTML=`<div class="page-head"><div><h2>Configuración</h2><p>Preferencias del sistema interno y estado de seguridad.</p></div></div><div class="grid-2"><section class="panel"><div class="panel-head"><h3>Agente Auditor</h3></div><div class="panel-body"><label class="form-field"><span>Correos automáticos</span><select id="audit-email-enabled"><option value="true">Activados</option><option value="false">Desactivados</option></select></label><p class="muted small">La revisión automática se ejecuta diariamente a las 08:00 hora de Chile y solo envía alertas altas o críticas nuevas.</p>${state.profile.role==='superadmin'?`<button id="save-settings" class="btn primary">Guardar configuración</button>`:''}</div></section><section class="panel"><div class="panel-head"><h3>Seguridad</h3></div><div class="panel-body"><p><strong>Nivel actual:</strong> ${aal==='aal2'?'MFA verificado (AAL2)':'Contraseña (AAL1)'}</p><p class="muted small">Los cambios de usuarios exigen MFA AAL2 aunque la sesión normal continúe disponible para lectura.</p><button id="settings-mfa" class="btn outline"><i class="ri-shield-keyhole-line"></i> Configurar / verificar MFA</button></div></section></div>`;$('#audit-email-enabled').value=String(emailSetting?.value?.enabled!==false);$('#settings-mfa').addEventListener('click',()=>openMfa(false));$('#save-settings')?.addEventListener('click',async()=>{const enabled=$('#audit-email-enabled').value==='true';const {error}=await client.from('company_settings').update({value:{enabled},updated_by:state.user.id}).eq('key','auditor_email_enabled');if(error)return toast(error.message,'error');toast('Configuración guardada.');});}

  async function openMfa(force=false){state.mfaForced=force;$('#mfa-screen').classList.remove('hidden');$('#mfa-message').textContent='';$('#mfa-code').value='';$('#mfa-skip').classList.toggle('hidden',force);const {data:aal}=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(aal?.currentLevel==='aal2'){ $('#mfa-copy').textContent='Tu sesión ya tiene verificación MFA activa.';$('#mfa-enroll').classList.add('hidden');$('#mfa-verify').textContent='Listo';state.mfaFactorId=null;return;}const {data:factors,error}=await client.auth.mfa.listFactors();if(error){$('#mfa-message').textContent=error.message;return;}const verified=factors?.totp?.find(f=>f.status==='verified');if(verified){state.mfaFactorId=verified.id;$('#mfa-copy').textContent='Ingresa el código actual de tu aplicación de autenticación.';$('#mfa-enroll').classList.add('hidden');$('#mfa-verify').textContent='Verificar';return;}const {data:enroll,error:enrollError}=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'Innova Admin'});if(enrollError){$('#mfa-message').textContent=enrollError.message;return;}state.mfaFactorId=enroll.id;$('#mfa-copy').textContent='Activa el segundo factor escaneando este código y luego escribe el código de 6 dígitos.';$('#mfa-enroll').classList.remove('hidden');const qr=enroll.totp?.qr_code||'';$('#mfa-qr').innerHTML=qr.startsWith('<svg')?sanitize(qr):qr?`<img alt="QR MFA" src="${esc(qr)}" style="max-width:210px">`:'';$('#mfa-verify').textContent='Activar y verificar';}

  async function verifyMfa(){if(!state.mfaFactorId){$('#mfa-screen').classList.add('hidden');return;}const code=$('#mfa-code').value.replace(/\D/g,'').slice(0,6);if(code.length!==6){$('#mfa-message').textContent='Ingresa los 6 dígitos.';return;}const {error}=await client.auth.mfa.challengeAndVerify({factorId:state.mfaFactorId,code});if(error){$('#mfa-message').textContent=error.message;return;}const {data}=await client.auth.getSession();state.session=data.session;$('#mfa-screen').classList.add('hidden');$('#security-level').textContent='MFA verificado';toast('Segundo factor verificado.');}

  async function init(){
    $('#login-form').addEventListener('submit',async(e)=>{e.preventDefault();setAuthMessage('Verificando…',true);const email=$('#login-email').value.trim().toLowerCase(),password=$('#login-password').value;const {data,error}=await client.auth.signInWithPassword({email,password});if(error)return setAuthMessage(error.message);if(data.session)handleSession(data.session);});
    $('#bootstrap-signup').addEventListener('click',async()=>{const email=$('#login-email').value.trim().toLowerCase(),password=$('#login-password').value;if(email!==cfg.initialAdminEmail)return setAuthMessage(`La cuenta administrativa inicial debe usar ${cfg.initialAdminEmail}.`);if(password.length<8)return setAuthMessage('Usa una contraseña de al menos 8 caracteres.');setAuthMessage('Creando cuenta…',true);const {data,error}=await client.auth.signUp({email,password,options:{data:{full_name:'Administrador Innova'}}});if(error)return setAuthMessage(error.message);if(data.session){await handleSession(data.session)}else setAuthMessage('Cuenta creada. Revisa el correo de confirmación y luego inicia sesión.',true);});
    $('#mfa-verify').addEventListener('click',verifyMfa);$('#mfa-skip').addEventListener('click',()=>{sessionStorage.setItem('innova-mfa-skipped','1');$('#mfa-screen').classList.add('hidden')});
    client.auth.onAuthStateChange((event,session)=>{if(['SIGNED_OUT'].includes(event))showAuth();if(['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)&&session){state.session=session;state.user=session.user;}});
    const {data}=await client.auth.getSession();await handleSession(data.session);
  }

  init().catch((error)=>{console.error(error);showAuth();setAuthMessage('No fue posible iniciar la plataforma.')});
})();
