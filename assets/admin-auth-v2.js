(() => {
  "use strict";

  const cfg = window.INNOVA_ADMIN_CONFIG;
  if (!cfg || !window.supabase) return;

  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
  const dateCL = (v) => v ? new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(new Date(v)) : "—";
  const roleLabel = (r) => ({ superadmin: "Superadministrador", admin: "Administrador", finance: "Finanzas", project_manager: "Gestor de proyectos", viewer: "Solo lectura" }[r] || r || "Usuario");

  let profile = null;
  let session = null;
  let forcedPasswordOpen = false;
  let initialized = false;

  function toast(message, type = "success") {
    const root = $("#toast-root");
    if (!root) return;
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => el.remove(), 4600);
  }

  function modal(title, body, foot = "", { wide = false, closable = true } = {}) {
    const root = $("#modal-root");
    if (!root) return;
    root.innerHTML = `<div class="modal-backdrop"><div class="modal ${wide ? "wide" : ""}"><div class="modal-head"><h2>${esc(title)}</h2>${closable ? '<button class="mini-btn authv2-close"><i class="ri-close-line"></i></button>' : ''}</div><div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ""}</div></div>`;
    $(".authv2-close")?.addEventListener("click", closeModal);
    if (closable) $(".modal-backdrop")?.addEventListener("click", (e) => { if (e.target.classList.contains("modal-backdrop")) closeModal(); });
  }

  function closeModal() {
    const root = $("#modal-root");
    if (root) root.innerHTML = "";
    forcedPasswordOpen = false;
  }

  function normalizeRut(input) {
    return String(input || "").toUpperCase().replace(/[^0-9K]/g, "");
  }

  function formatRut(input) {
    const rut = normalizeRut(input);
    if (rut.length < 2) return input || "—";
    const body = rut.slice(0, -1);
    const dv = rut.slice(-1);
    const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${formatted}-${dv}`;
  }

  function validRut(input) {
    const rut = normalizeRut(input);
    if (rut.length < 8 || rut.length > 9) return false;
    const body = rut.slice(0, -1);
    const dv = rut.slice(-1);
    if (!/^\d+$/.test(body)) return false;
    let sum = 0, multiplier = 2;
    for (let i = body.length - 1; i >= 0; i -= 1) {
      sum += Number(body[i]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }
    const result = 11 - (sum % 11);
    const expected = result === 11 ? "0" : result === 10 ? "K" : String(result);
    return expected === dv;
  }

  function disablePublicSignup() {
    const button = $("#bootstrap-signup");
    if (!button || button.dataset.authv2Disabled === "1") return;
    const clone = button.cloneNode(true);
    clone.dataset.authv2Disabled = "1";
    clone.classList.add("hidden");
    clone.hidden = true;
    clone.tabIndex = -1;
    clone.setAttribute("aria-hidden", "true");
    button.replaceWith(clone);
  }

  function ensureSettingsVisible() {
    const button = $('#side-nav [data-view="settings"]');
    if (!button) return;
    button.classList.remove("role-admin", "hidden");
    button.removeAttribute("hidden");
  }

  async function refreshIdentity() {
    const { data } = await client.auth.getSession();
    session = data.session || null;
    if (!session?.user) {
      profile = null;
      return null;
    }
    const { data: row } = await client.from("company_users").select("*").eq("user_id", session.user.id).maybeSingle();
    profile = row || null;
    return profile;
  }

  async function requireMfa() {
    const { data } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel === "aal2") return true;
    $("#mfa-menu-action")?.click();
    toast("Verifica MFA y vuelve a ejecutar la acción.", "warning");
    return false;
  }

  async function callUserAdmin(body) {
    if (!(await requireMfa())) throw new Error("MFA requerido");
    const { data, error } = await client.functions.invoke("company-user-admin", { body });
    if (error) throw new Error(error.message || "No se pudo administrar el usuario.");
    if (data?.error) throw new Error(data.error);
    return data;
  }

  function activateView(view, title) {
    $$("#side-nav .nav-item[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    const h = $("#view-title");
    if (h) h.textContent = title;
  }

  async function renderUsersV2() {
    await refreshIdentity();
    if (profile?.role !== "superadmin") return toast("Solo el superadministrador puede administrar usuarios.", "warning");
    activateView("users", "Usuarios y seguridad");
    const main = $("#main-content");
    if (!main) return;
    main.innerHTML = '<div class="empty-state"><div class="loading-orb" style="margin:auto;width:38px;height:38px"></div><p>Cargando usuarios…</p></div>';
    const { data, error } = await client.from("company_users").select("*").order("created_at", { ascending: true });
    if (error) {
      main.innerHTML = `<div class="panel"><div class="empty-state"><i class="ri-error-warning-line"></i><strong>No se pudieron cargar los usuarios</strong><p>${esc(error.message)}</p></div></div>`;
      return;
    }
    main.innerHTML = `<div class="page-head"><div><h2>Usuarios y seguridad</h2><p>Solo el superadministrador puede crear y modificar accesos. Cada usuario se registra con correo y RUT.</p></div><button id="authv2-add-user" class="btn primary"><i class="ri-user-add-line"></i> Agregar usuario</button></div>
      <div class="panel"><div class="panel-body"><div class="security-note"><i class="ri-key-2-line"></i><span>Clave inicial: los primeros 6 dígitos del RUT. El usuario deberá cambiarla al ingresar por primera vez.</span></div></div></div>
      <div class="data-table-wrap"><table class="data-table"><thead><tr><th>Usuario</th><th>RUT</th><th>Rol</th><th>Estado</th><th>Clave</th><th>Creado</th><th></th></tr></thead><tbody>${(data || []).map((u) => `<tr><td><strong>${esc(u.full_name || u.email)}</strong><br><small>${esc(u.email)}</small></td><td>${esc(u.rut ? formatRut(u.rut) : "—")}</td><td>${esc(roleLabel(u.role))}</td><td><span class="status ${u.status === "active" ? "active" : "critical"}">${esc(u.status)}</span></td><td>${u.must_change_password ? '<span class="status warning">Debe cambiar</span>' : '<span class="status active">Actualizada</span>'}</td><td>${esc(dateCL(u.created_at))}</td><td><button class="mini-btn authv2-edit-user" data-id="${esc(u.user_id)}" title="Editar"><i class="ri-shield-user-line"></i></button></td></tr>`).join("")}</tbody></table></div>`;
    $("#authv2-add-user")?.addEventListener("click", openCreateUser);
    $$(".authv2-edit-user").forEach((b) => b.addEventListener("click", () => openEditUser(b.dataset.id, data || [])));
  }

  function openCreateUser() {
    modal("Agregar usuario", `<form id="authv2-user-form" class="form-grid">
      <label class="form-field full"><span>Nombre completo</span><input name="fullName" required autocomplete="off"></label>
      <label class="form-field full"><span>Correo electrónico</span><input name="email" type="email" required autocomplete="off"></label>
      <label class="form-field full"><span>RUT</span><input name="rut" required placeholder="12.345.678-9" autocomplete="off"><small>La clave inicial será automáticamente los primeros 6 dígitos del RUT.</small></label>
      <label class="form-field full"><span>Rol</span><select name="role"><option value="viewer">Solo lectura</option><option value="project_manager">Gestor de proyectos</option><option value="finance">Finanzas</option><option value="admin">Administrador</option><option value="superadmin">Superadministrador</option></select></label>
    </form>`, '<button class="btn ghost authv2-cancel">Cancelar</button><button id="authv2-create-user" class="btn primary">Crear usuario</button>', { wide: false });
    $(".authv2-cancel")?.addEventListener("click", closeModal);
    $("#authv2-create-user")?.addEventListener("click", async () => {
      const form = $("#authv2-user-form");
      const fd = new FormData(form);
      const fullName = String(fd.get("fullName") || "").trim();
      const email = String(fd.get("email") || "").trim().toLowerCase();
      const rut = String(fd.get("rut") || "").trim();
      const role = String(fd.get("role") || "viewer");
      if (!fullName || !email || !rut) return toast("Completa nombre, correo y RUT.", "warning");
      if (!validRut(rut)) return toast("El RUT ingresado no es válido.", "warning");
      const button = $("#authv2-create-user");
      button.disabled = true;
      button.textContent = "Creando…";
      try {
        await callUserAdmin({ action: "create", fullName, email, rut, role });
        closeModal();
        toast("Usuario creado. Puede ingresar con su correo y los primeros 6 dígitos de su RUT.");
        await renderUsersV2();
      } catch (error) {
        if (error.message !== "MFA requerido") toast(error.message, "error");
        button.disabled = false;
        button.textContent = "Crear usuario";
      }
    });
  }

  function openEditUser(id, users) {
    const u = users.find((x) => x.user_id === id);
    if (!u) return;
    modal("Editar acceso", `<form id="authv2-edit-form" class="form-grid">
      <label class="form-field full"><span>Correo</span><input value="${esc(u.email)}" disabled></label>
      <label class="form-field full"><span>Nombre</span><input name="fullName" value="${esc(u.full_name || "")}" required></label>
      <label class="form-field full"><span>RUT</span><input name="rut" value="${esc(u.rut ? formatRut(u.rut) : "")}" placeholder="12.345.678-9"><small>Modificar el RUT no restablece la contraseña actual.</small></label>
      <label class="form-field"><span>Rol</span><select name="role"><option value="viewer">Solo lectura</option><option value="project_manager">Gestor</option><option value="finance">Finanzas</option><option value="admin">Administrador</option><option value="superadmin">Superadministrador</option></select></label>
      <label class="form-field"><span>Estado</span><select name="status"><option value="active">Activo</option><option value="disabled">Deshabilitado</option></select></label>
    </form>`, '<button class="btn ghost authv2-cancel">Cancelar</button><button id="authv2-save-user" class="btn primary">Guardar cambios</button>');
    $('#authv2-edit-form [name="role"]').value = u.role;
    $('#authv2-edit-form [name="status"]').value = u.status;
    $(".authv2-cancel")?.addEventListener("click", closeModal);
    $("#authv2-save-user")?.addEventListener("click", async () => {
      const fd = new FormData($("#authv2-edit-form"));
      const rut = String(fd.get("rut") || "").trim();
      if (rut && !validRut(rut)) return toast("El RUT ingresado no es válido.", "warning");
      try {
        await callUserAdmin({ action: "update", userId: id, fullName: String(fd.get("fullName") || "").trim(), rut, role: String(fd.get("role")), status: String(fd.get("status")) });
        closeModal();
        toast("Acceso actualizado.");
        await renderUsersV2();
      } catch (error) {
        if (error.message !== "MFA requerido") toast(error.message, "error");
      }
    });
  }

  async function changePassword({ forced = false } = {}) {
    await refreshIdentity();
    if (!session?.user?.email) return toast("No hay una sesión válida.", "error");
    const form = forced ? $("#authv2-force-password-form") : $("#authv2-password-form");
    if (!form) return;
    const fd = new FormData(form);
    const currentPassword = String(fd.get("currentPassword") || "");
    const newPassword = String(fd.get("newPassword") || "");
    const confirmPassword = String(fd.get("confirmPassword") || "");
    if (!currentPassword) return toast("Ingresa tu contraseña actual.", "warning");
    if (newPassword.length < 8) return toast("La nueva contraseña debe tener al menos 8 caracteres.", "warning");
    if (newPassword !== confirmPassword) return toast("Las contraseñas nuevas no coinciden.", "warning");
    if (currentPassword === newPassword) return toast("La nueva contraseña debe ser diferente a la actual.", "warning");

    const { error: verifyError } = await client.auth.signInWithPassword({ email: session.user.email, password: currentPassword });
    if (verifyError) return toast("La contraseña actual no es correcta.", "error");
    const { error: updateError } = await client.auth.updateUser({ password: newPassword });
    if (updateError) return toast(updateError.message, "error");
    const { error: markError } = await client.rpc("company_mark_password_changed");
    if (markError) return toast(`La contraseña cambió, pero no se pudo actualizar el estado interno: ${markError.message}`, "warning");
    await refreshIdentity();
    if (forced) closeModal();
    else {
      form.reset();
      const badge = $("#authv2-password-state");
      if (badge) badge.innerHTML = '<span class="status active">Contraseña actualizada</span>';
    }
    toast("Contraseña actualizada correctamente.");
  }

  async function renderSettingsV2() {
    await refreshIdentity();
    if (!profile) return;
    activateView("settings", "Configuración");
    const main = $("#main-content");
    if (!main) return;
    const { data: aal } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    let auditEnabled = true;
    if (["superadmin", "admin"].includes(profile.role)) {
      const { data } = await client.from("company_settings").select("*").eq("key", "auditor_email_enabled").maybeSingle();
      auditEnabled = data?.value?.enabled !== false;
    }
    main.innerHTML = `<div class="page-head"><div><h2>Configuración</h2><p>Cuenta personal, contraseña y preferencias de la plataforma.</p></div></div>
      <div class="grid-2">
        <section class="panel"><div class="panel-head"><h3>Mi cuenta</h3></div><div class="panel-body">
          <div class="list"><div class="list-row"><div class="list-icon"><i class="ri-mail-line"></i></div><div class="list-copy"><strong>${esc(profile.full_name || session?.user?.email || "Usuario")}</strong><span>${esc(session?.user?.email || profile.email || "")}</span></div></div><div class="list-row"><div class="list-icon"><i class="ri-id-card-line"></i></div><div class="list-copy"><strong>RUT</strong><span>${esc(profile.rut ? formatRut(profile.rut) : "No registrado")}</span></div></div><div class="list-row"><div class="list-icon"><i class="ri-shield-user-line"></i></div><div class="list-copy"><strong>Rol</strong><span>${esc(roleLabel(profile.role))}</span></div></div></div>
        </div></section>
        <section class="panel"><div class="panel-head"><h3>Cambiar contraseña</h3></div><div class="panel-body">
          <div id="authv2-password-state">${profile.must_change_password ? '<span class="status warning">Cambio obligatorio pendiente</span>' : '<span class="status active">Contraseña actualizada</span>'}</div>
          <form id="authv2-password-form" class="form-grid" style="margin-top:14px"><label class="form-field full"><span>Contraseña actual</span><input name="currentPassword" type="password" autocomplete="current-password" required></label><label class="form-field full"><span>Nueva contraseña</span><input name="newPassword" type="password" minlength="8" autocomplete="new-password" required></label><label class="form-field full"><span>Repetir nueva contraseña</span><input name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required></label></form>
          <button id="authv2-change-password" class="btn primary"><i class="ri-key-2-line"></i> Cambiar contraseña</button>
        </div></section>
        <section class="panel"><div class="panel-head"><h3>Seguridad MFA</h3></div><div class="panel-body"><p><strong>Nivel actual:</strong> ${aal?.currentLevel === "aal2" ? "MFA verificado (AAL2)" : "Contraseña (AAL1)"}</p><p class="muted small">El superadministrador necesita MFA para crear o modificar usuarios.</p><button id="authv2-mfa" class="btn outline"><i class="ri-shield-keyhole-line"></i> Configurar / verificar MFA</button></div></section>
        ${["superadmin", "admin"].includes(profile.role) ? `<section class="panel"><div class="panel-head"><h3>Agente Auditor</h3></div><div class="panel-body"><label class="form-field"><span>Correos automáticos</span><select id="authv2-audit-email"><option value="true">Activados</option><option value="false">Desactivados</option></select></label><p class="muted small">La revisión automática mantiene las alertas empresariales y los vencimientos.</p>${profile.role === "superadmin" ? '<button id="authv2-save-audit" class="btn primary">Guardar configuración</button>' : ""}</div></section>` : ""}
      </div>`;
    $("#authv2-change-password")?.addEventListener("click", () => changePassword());
    $("#authv2-mfa")?.addEventListener("click", () => $("#mfa-menu-action")?.click());
    if ($("#authv2-audit-email")) $("#authv2-audit-email").value = String(auditEnabled);
    $("#authv2-save-audit")?.addEventListener("click", async () => {
      const enabled = $("#authv2-audit-email").value === "true";
      const { error } = await client.from("company_settings").update({ value: { enabled }, updated_by: session.user.id }).eq("key", "auditor_email_enabled");
      if (error) return toast(error.message, "error");
      toast("Configuración guardada.");
    });
  }

  async function enforcePasswordChange() {
    if (forcedPasswordOpen) return;
    await refreshIdentity();
    if (!profile?.must_change_password || !session?.user) return;
    const app = $("#admin-app");
    if (!app || app.classList.contains("hidden")) return;
    forcedPasswordOpen = true;
    modal("Cambia tu contraseña", `<div class="security-note"><i class="ri-lock-password-line"></i><span>Estás usando la clave inicial creada a partir de tu RUT. Antes de continuar, define una contraseña personal.</span></div><form id="authv2-force-password-form" class="form-grid" style="margin-top:16px"><label class="form-field full"><span>Clave inicial / contraseña actual</span><input name="currentPassword" type="password" autocomplete="current-password" required></label><label class="form-field full"><span>Nueva contraseña</span><input name="newPassword" type="password" minlength="8" autocomplete="new-password" required></label><label class="form-field full"><span>Repetir nueva contraseña</span><input name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required></label></form>`, '<button id="authv2-force-change" class="btn primary wide">Guardar nueva contraseña</button>', { closable: false });
    $("#authv2-force-change")?.addEventListener("click", () => changePassword({ forced: true }));
  }

  function interceptNavigation() {
    document.addEventListener("click", async (e) => {
      const nav = e.target.closest('#side-nav [data-view="settings"], #side-nav [data-view="users"]');
      if (!nav) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (nav.dataset.view === "settings") await renderSettingsV2();
      else await renderUsersV2();
    }, true);
  }

  function observeUi() {
    const observer = new MutationObserver(() => {
      disablePublicSignup();
      ensureSettingsVisible();
      if (!forcedPasswordOpen) enforcePasswordChange().catch(() => undefined);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    disablePublicSignup();
    ensureSettingsVisible();
    interceptNavigation();
    observeUi();
    client.auth.onAuthStateChange(() => setTimeout(() => { refreshIdentity().then(() => { ensureSettingsVisible(); enforcePasswordChange(); }); }, 100));
    await refreshIdentity();
    setTimeout(() => { ensureSettingsVisible(); enforcePasswordChange(); }, 600);
  }

  init().catch((error) => console.error("Innova Auth v2:", error));
})();
