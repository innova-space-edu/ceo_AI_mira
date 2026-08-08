(() => {
  "use strict";

  const cfg = window.INNOVA_ADMIN_CONFIG;
  if (!cfg || !window.supabase) return;

  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  let profileCache = null;
  let forcedPasswordOpen = false;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[c]));

  const normalizeRut = (value = "") => String(value).toUpperCase().replace(/[^0-9K]/g, "");

  function toast(message, type = "success") {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  function applyLoginPolicy() {
    const signup = document.getElementById("bootstrap-signup");
    if (signup) {
      signup.classList.add("hidden");
      signup.setAttribute("aria-hidden", "true");
      signup.tabIndex = -1;
    }
    const loginCard = document.getElementById("login-form");
    if (loginCard && !loginCard.querySelector("[data-admin-only-note]")) {
      const note = document.createElement("p");
      note.dataset.adminOnlyNote = "true";
      note.className = "muted small";
      note.style.marginTop = "10px";
      note.textContent = "Las cuentas son creadas únicamente por el administrador de Innova.";
      loginCard.appendChild(note);
    }
    const settingsButton = document.querySelector('[data-view="settings"]');
    settingsButton?.classList.remove("role-admin");
  }

  async function refreshProfile() {
    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) {
      profileCache = null;
      return null;
    }
    const { data } = await client
      .from("company_users")
      .select("user_id,email,full_name,rut,role,status,must_change_password,password_changed_at")
      .eq("user_id", user.id)
      .maybeSingle();
    profileCache = data || null;
    return profileCache;
  }

  async function invokeUserAdmin(body) {
    const { data, error } = await client.functions.invoke("company-user-admin", { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data || {};
  }

  function modalShell(title, content, footer = "", locked = false) {
    const root = document.getElementById("modal-root");
    if (!root) return;
    root.innerHTML = `<div class="modal-backdrop" data-auth-policy-backdrop><div class="modal"><div class="modal-head"><h2>${esc(title)}</h2>${locked ? "" : '<button class="mini-btn" data-auth-policy-close><i class="ri-close-line"></i></button>'}</div><div class="modal-body">${content}</div>${footer ? `<div class="modal-foot">${footer}</div>` : ""}</div></div>`;
    root.querySelector("[data-auth-policy-close]")?.addEventListener("click", () => { root.innerHTML = ""; });
    if (!locked) {
      root.querySelector("[data-auth-policy-backdrop]")?.addEventListener("click", (event) => {
        if (event.target === event.currentTarget) root.innerHTML = "";
      });
    }
  }

  async function openProvisionUser() {
    const profile = profileCache || await refreshProfile();
    if (!profile || profile.role !== "superadmin") {
      toast("Solo el superadministrador puede agregar usuarios.", "warning");
      return;
    }

    modalShell("Agregar usuario", `
      <form id="admin-provision-user" class="form-grid">
        <label class="form-field full"><span>Nombre completo</span><input name="fullName" required autocomplete="name" /></label>
        <label class="form-field full"><span>Correo electrónico</span><input name="email" type="email" required autocomplete="email" /></label>
        <label class="form-field full"><span>RUT</span><input name="rut" required placeholder="12.345.678-9" /></label>
        <label class="form-field full"><span>Rol</span><select name="role"><option value="viewer">Solo lectura</option><option value="project_manager">Gestor de proyectos</option><option value="finance">Finanzas</option><option value="admin">Administrador</option><option value="superadmin">Superadministrador</option></select></label>
        <div class="preview-frame full"><strong>Contraseña temporal</strong><br>Se generará automáticamente con los primeros 6 dígitos del RUT. En el primer ingreso el usuario deberá cambiarla antes de continuar.</div>
      </form>`,
      '<button class="btn ghost" data-auth-policy-close-2>Cancelar</button><button id="admin-provision-save" class="btn primary"><i class="ri-user-add-line"></i> Crear usuario</button>');

    document.querySelector("[data-auth-policy-close-2]")?.addEventListener("click", () => { document.getElementById("modal-root").innerHTML = ""; });
    document.getElementById("admin-provision-save")?.addEventListener("click", async () => {
      const form = document.getElementById("admin-provision-user");
      const fd = new FormData(form);
      const fullName = String(fd.get("fullName") || "").trim();
      const email = String(fd.get("email") || "").trim().toLowerCase();
      const rut = String(fd.get("rut") || "").trim();
      const role = String(fd.get("role") || "viewer");
      if (!fullName || !email || normalizeRut(rut).length < 8) {
        toast("Completa nombre, correo y RUT.", "warning");
        return;
      }
      const save = document.getElementById("admin-provision-save");
      save.disabled = true;
      save.textContent = "Creando usuario…";
      try {
        const result = await invokeUserAdmin({ action: "provision", fullName, email, rut, role });
        modalShell("Usuario creado", `
          <div class="preview-frame">
            <p><strong>${esc(fullName)}</strong></p>
            <p>Correo: <strong>${esc(email)}</strong></p>
            <p>RUT: <strong>${esc(rut)}</strong></p>
            <p>Contraseña temporal: <strong style="font-size:1.25rem;letter-spacing:.08em">${esc(result.temporaryPassword || "")}</strong></p>
            <p class="muted small">Entrega esta clave de forma segura. Al iniciar sesión se solicitará una contraseña nueva de al menos 8 caracteres.</p>
          </div>`,
          '<button class="btn primary" data-auth-policy-finish>Listo</button>');
        document.querySelector("[data-auth-policy-finish]")?.addEventListener("click", () => {
          document.getElementById("modal-root").innerHTML = "";
          document.querySelector('[data-view="users"]')?.click();
        });
      } catch (error) {
        toast(error.message || "No se pudo crear el usuario.", "error");
        save.disabled = false;
        save.innerHTML = '<i class="ri-user-add-line"></i> Crear usuario';
      }
    });
  }

  async function changePassword(newPassword, confirmPassword) {
    if (newPassword.length < 8) throw new Error("La nueva contraseña debe tener al menos 8 caracteres.");
    if (newPassword !== confirmPassword) throw new Error("Las contraseñas no coinciden.");
    await invokeUserAdmin({ action: "change_password", newPassword, confirmPassword });
    await refreshProfile();
  }

  function passwordFormHtml(prefix) {
    return `<form id="${prefix}-password-form" class="form-grid">
      <label class="form-field full"><span>Nueva contraseña</span><input name="newPassword" type="password" minlength="8" required autocomplete="new-password" /></label>
      <label class="form-field full"><span>Confirmar contraseña</span><input name="confirmPassword" type="password" minlength="8" required autocomplete="new-password" /></label>
    </form>`;
  }

  function bindPasswordForm(prefix, onSuccess) {
    document.getElementById(`${prefix}-password-save`)?.addEventListener("click", async () => {
      const form = document.getElementById(`${prefix}-password-form`);
      if (!form) return;
      const fd = new FormData(form);
      const button = document.getElementById(`${prefix}-password-save`);
      button.disabled = true;
      button.textContent = "Actualizando…";
      try {
        await changePassword(String(fd.get("newPassword") || ""), String(fd.get("confirmPassword") || ""));
        toast("Contraseña actualizada.");
        onSuccess?.();
      } catch (error) {
        toast(error.message || "No se pudo cambiar la contraseña.", "error");
        button.disabled = false;
        button.textContent = "Cambiar contraseña";
      }
    });
  }

  async function enforceFirstPasswordChange() {
    if (forcedPasswordOpen) return;
    const profile = profileCache || await refreshProfile();
    if (!profile?.must_change_password) return;
    forcedPasswordOpen = true;
    modalShell("Cambia tu contraseña temporal", `
      <p>Tu cuenta fue creada por el administrador con una contraseña temporal basada en tu RUT. Debes definir una contraseña personal antes de continuar.</p>
      ${passwordFormHtml("forced")}
      <p class="muted small">La nueva contraseña debe tener al menos 8 caracteres y no puede ser igual a la clave temporal.</p>`,
      '<button id="forced-password-logout" class="btn ghost">Cerrar sesión</button><button id="forced-password-save" class="btn primary">Cambiar contraseña</button>', true);
    document.getElementById("forced-password-logout")?.addEventListener("click", () => client.auth.signOut());
    bindPasswordForm("forced", () => {
      forcedPasswordOpen = false;
      document.getElementById("modal-root").innerHTML = "";
    });
  }

  function renderPersonalSettings(profile) {
    const main = document.getElementById("main-content");
    if (!main) return;
    const title = document.getElementById("view-title");
    if (title) title.textContent = "Configuración";
    main.innerHTML = `<div class="page-head"><div><h2>Configuración de mi cuenta</h2><p>Administra tus credenciales de acceso a Innova Admin.</p></div></div>
      <div class="grid-2">
        <section class="panel"><div class="panel-head"><h3>Mi cuenta</h3></div><div class="panel-body"><p><strong>${esc(profile.full_name || profile.email || "Usuario")}</strong></p><p class="muted small">${esc(profile.email || "")}</p>${profile.rut ? `<p class="muted small">RUT: ${esc(profile.rut)}</p>` : ""}</div></section>
        <section class="panel" id="personal-password-panel"><div class="panel-head"><h3>Contraseña</h3></div><div class="panel-body">${passwordFormHtml("personal")}<button id="personal-password-save" class="btn primary">Cambiar contraseña</button></div></section>
      </div>`;
    bindPasswordForm("personal", () => {
      const form = document.getElementById("personal-password-form");
      form?.reset();
    });
  }

  function injectPasswordIntoAdminSettings() {
    const main = document.getElementById("main-content");
    if (!main || !document.getElementById("settings-mfa") || document.getElementById("admin-password-panel")) return;
    const grid = main.querySelector(".grid-2") || main;
    const section = document.createElement("section");
    section.id = "admin-password-panel";
    section.className = "panel";
    section.innerHTML = `<div class="panel-head"><h3>Mi contraseña</h3></div><div class="panel-body">${passwordFormHtml("adminself")}<button id="adminself-password-save" class="btn primary">Cambiar contraseña</button></div>`;
    grid.appendChild(section);
    bindPasswordForm("adminself", () => document.getElementById("adminself-password-form")?.reset());
  }

  async function enhanceUsersTable() {
    const main = document.getElementById("main-content");
    const table = main?.querySelector("table.data-table");
    const invite = document.getElementById("invite-user");
    if (!table || !invite || table.dataset.rutEnhanced === "true") return;
    invite.innerHTML = '<i class="ri-user-add-line"></i> Agregar usuario';
    const { data } = await client.from("company_users").select("email,rut").order("created_at", { ascending: true });
    const byEmail = new Map((data || []).map((row) => [String(row.email || "").toLowerCase(), row.rut || "—"]));
    const head = table.querySelector("thead tr");
    const firstHead = head?.children?.[0];
    if (firstHead) firstHead.insertAdjacentHTML("afterend", "<th>RUT</th>");
    table.querySelectorAll("tbody tr").forEach((row) => {
      const first = row.children[0];
      if (!first) return;
      const email = [...first.querySelectorAll("small")].map((x) => x.textContent.trim().toLowerCase()).find((x) => x.includes("@")) || "";
      first.insertAdjacentHTML("afterend", `<td>${esc(byEmail.get(email) || "—")}</td>`);
    });
    table.dataset.rutEnhanced = "true";
  }

  document.addEventListener("click", (event) => {
    const invite = event.target.closest?.("#invite-user");
    if (invite) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openProvisionUser();
      return;
    }

    const settings = event.target.closest?.('[data-view="settings"]');
    if (settings && profileCache && !["superadmin", "admin"].includes(profileCache.role)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      renderPersonalSettings(profileCache);
    }
  }, true);

  const observer = new MutationObserver(() => {
    applyLoginPolicy();
    injectPasswordIntoAdminSettings();
    enhanceUsersTable().catch(() => {});
    if (!document.getElementById("auth-screen")?.classList.contains("hidden")) return;
    enforceFirstPasswordChange().catch(() => {});
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  client.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      profileCache = null;
      forcedPasswordOpen = false;
      return;
    }
    setTimeout(async () => {
      await refreshProfile();
      applyLoginPolicy();
      enforceFirstPasswordChange().catch(() => {});
    }, 250);
  });

  applyLoginPolicy();
  refreshProfile().then(() => enforceFirstPasswordChange()).catch(() => {});
})();
