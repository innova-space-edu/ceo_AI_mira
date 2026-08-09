(() => {
  "use strict";

  const cfg = window.INNOVA_ADMIN_CONFIG;
  if (!cfg?.supabaseUrl || !cfg?.supabasePublishableKey) return;

  const EDIT_ROLES = new Set(["superadmin", "admin", "finance"]);
  let editAllowed = false;
  let permissionsChecked = false;
  let enhanceTimer = null;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[c]));

  const qs = (value = "") => encodeURIComponent(String(value));

  function findStoredSession() {
    const preferred = "sb-alogqktilzgylzomzwem-auth-token";
    const keys = [preferred, ...Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))]
      .filter(Boolean)
      .filter((key, index, list) => list.indexOf(key) === index);

    for (const key of keys) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "null");
        const candidates = [parsed, parsed?.currentSession, parsed?.session, parsed?.data?.session];
        for (const candidate of candidates) {
          if (candidate?.access_token) return candidate;
        }
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
    } catch (_) {
      return "";
    }
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
    if (!response.ok) {
      const message = data?.message || data?.details || data?.hint || `Error ${response.status}`;
      throw new Error(message);
    }
    return data;
  }

  function toast(message, type = "success") {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const item = document.createElement("div");
    item.className = `toast ${type}`;
    item.textContent = message;
    root.appendChild(item);
    setTimeout(() => item.remove(), 4800);
  }

  async function checkPermissions() {
    if (permissionsChecked) return editAllowed;
    permissionsChecked = true;
    try {
      const session = findStoredSession();
      const userId = jwtSub(session?.access_token || "");
      if (!userId) return false;
      const rows = await rest(`company_users?select=role,status&user_id=eq.${qs(userId)}&limit=1`);
      const profile = Array.isArray(rows) ? rows[0] : null;
      editAllowed = profile?.status === "active" && EDIT_ROLES.has(profile?.role);
    } catch (error) {
      console.warn("Innova Admin invoice edit permissions:", error);
      editAllowed = false;
    }
    return editAllowed;
  }

  function closeEditor() {
    const root = document.getElementById("modal-root");
    if (root?.querySelector("[data-invoice-edit-modal]")) root.innerHTML = "";
  }

  function field(label, name, value = "", extra = "") {
    return `<label class="form-field"><span>${esc(label)}</span><input name="${esc(name)}" value="${esc(value ?? "")}" ${extra}></label>`;
  }

  function selectField(label, name, value, options) {
    return `<label class="form-field"><span>${esc(label)}</span><select name="${esc(name)}">${options.map(([v, text]) => `<option value="${esc(v)}"${String(value || "") === String(v) ? " selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
  }

  async function openInvoiceEditor(invoiceId) {
    if (!(await checkPermissions())) {
      toast("No tienes permisos para editar facturas.", "warning");
      return;
    }

    const root = document.getElementById("modal-root");
    if (!root) return;
    root.innerHTML = `<div class="modal-backdrop" data-invoice-edit-modal><div class="modal"><div class="modal-head"><h2>Editar datos de factura</h2><button class="mini-btn" data-invoice-edit-close><i class="ri-close-line"></i></button></div><div class="modal-body"><div class="empty-state"><div class="loading-orb" style="width:34px;height:34px;margin:auto"></div><p>Cargando datos…</p></div></div></div></div>`;
    root.querySelector("[data-invoice-edit-close]")?.addEventListener("click", closeEditor);

    try {
      const [invoiceRows, projects] = await Promise.all([
        rest(`company_invoices?select=*&id=eq.${qs(invoiceId)}&limit=1`),
        rest("company_projects?select=id,title&order=title.asc"),
      ]);
      const invoice = Array.isArray(invoiceRows) ? invoiceRows[0] : null;
      if (!invoice) throw new Error("No se encontró la factura.");

      const projectOptions = [["", "Sin proyecto"], ...(Array.isArray(projects) ? projects.map((p) => [p.id, p.title]) : [])];
      const modal = root.querySelector(".modal");
      modal.innerHTML = `
        <div class="modal-head"><div><h2>Editar datos de factura</h2><p class="muted small">Folio ${esc(invoice.folio || "sin folio")}. El PDF/XML original no se modifica.</p></div><button class="mini-btn" data-invoice-edit-close><i class="ri-close-line"></i></button></div>
        <div class="modal-body">
          <form id="invoice-edit-form" class="form-grid">
            ${selectField("Proyecto", "project_id", invoice.project_id || "", projectOptions)}
            ${selectField("Tipo interno", "invoice_type", invoice.invoice_type || "purchase", [["purchase", "Compra / gasto"], ["sale", "Venta / ingreso"]])}
            ${field("Tipo DTE", "dte_type", invoice.dte_type || "")}
            ${field("Folio", "folio", invoice.folio || "")}
            ${field("RUT emisor", "issuer_rut", invoice.issuer_rut || "")}
            ${field("Razón social", "issuer_name", invoice.issuer_name || "")}
            ${field("RUT receptor", "recipient_rut", invoice.recipient_rut || "")}
            ${field("Fecha emisión", "issue_date", invoice.issue_date || "", 'type="date"')}
            ${field("Fecha vencimiento", "due_date", invoice.due_date || "", 'type="date"')}
            ${field("Neto", "net_amount", Number(invoice.net_amount || 0), 'type="number" min="0" step="1"')}
            ${field("Exento", "exempt_amount", Number(invoice.exempt_amount || 0), 'type="number" min="0" step="1"')}
            ${field("IVA", "vat_amount", Number(invoice.vat_amount || 0), 'type="number" min="0" step="1"')}
            ${field("Total", "total_amount", Number(invoice.total_amount || 0), 'type="number" min="0" step="1"')}
            ${selectField("Estado de pago", "payment_status", invoice.payment_status || "pending", [["pending", "Pendiente"], ["partial", "Parcial"], ["paid", "Pagada"], ["void", "Anulada"]])}
            <label class="form-field full"><span>Notas</span><textarea name="notes">${esc(invoice.notes || "")}</textarea></label>
          </form>
          <div id="invoice-edit-message" class="form-message" aria-live="polite"></div>
        </div>
        <div class="modal-foot"><button class="btn ghost" data-invoice-edit-cancel>Cancelar</button><button id="invoice-edit-save" class="btn primary"><i class="ri-save-line"></i> Guardar cambios</button></div>`;

      modal.querySelector("[data-invoice-edit-close]")?.addEventListener("click", closeEditor);
      modal.querySelector("[data-invoice-edit-cancel]")?.addEventListener("click", closeEditor);
      root.querySelector("[data-invoice-edit-modal]")?.addEventListener("click", (event) => {
        if (event.target === event.currentTarget) closeEditor();
      });

      document.getElementById("invoice-edit-save")?.addEventListener("click", async () => {
        const form = document.getElementById("invoice-edit-form");
        const button = document.getElementById("invoice-edit-save");
        const message = document.getElementById("invoice-edit-message");
        if (!form || !button) return;
        const fd = new FormData(form);
        const payload = {
          project_id: String(fd.get("project_id") || "") || null,
          invoice_type: String(fd.get("invoice_type") || "purchase"),
          dte_type: String(fd.get("dte_type") || "").trim() || null,
          folio: String(fd.get("folio") || "").trim() || null,
          issuer_rut: String(fd.get("issuer_rut") || "").trim() || null,
          issuer_name: String(fd.get("issuer_name") || "").trim() || null,
          recipient_rut: String(fd.get("recipient_rut") || "").trim() || null,
          issue_date: String(fd.get("issue_date") || "") || null,
          due_date: String(fd.get("due_date") || "") || null,
          net_amount: Number(fd.get("net_amount") || 0),
          exempt_amount: Number(fd.get("exempt_amount") || 0),
          vat_amount: Number(fd.get("vat_amount") || 0),
          total_amount: Number(fd.get("total_amount") || 0),
          payment_status: String(fd.get("payment_status") || "pending"),
          notes: String(fd.get("notes") || "").trim() || null,
        };

        if (payload.total_amount < 0 || payload.net_amount < 0 || payload.vat_amount < 0 || payload.exempt_amount < 0) {
          if (message) message.textContent = "Los montos no pueden ser negativos.";
          return;
        }

        button.disabled = true;
        button.textContent = "Guardando…";
        if (message) message.textContent = "";
        try {
          await rest(`company_invoices?id=eq.${qs(invoiceId)}`, {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(payload),
          });
          closeEditor();
          toast("Datos de la factura actualizados.");
          document.querySelector('[data-view="invoices"]')?.click();
        } catch (error) {
          if (message) message.textContent = error.message || "No se pudo actualizar la factura.";
          button.disabled = false;
          button.innerHTML = '<i class="ri-save-line"></i> Guardar cambios';
        }
      });
    } catch (error) {
      const body = root.querySelector(".modal-body");
      if (body) body.innerHTML = `<div class="empty-state"><i class="ri-error-warning-line"></i><strong>No se pudo abrir la factura</strong><p>${esc(error.message || "Error inesperado")}</p></div>`;
    }
  }

  async function enhanceInvoiceRows() {
    const main = document.getElementById("main-content");
    if (!main || !main.querySelector(".invoice-open")) return;
    if (!(await checkPermissions())) return;

    main.querySelectorAll(".invoice-open").forEach((viewButton) => {
      if (viewButton.parentElement?.querySelector(".invoice-edit-meta")) return;
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "mini-btn invoice-edit-meta";
      edit.dataset.id = viewButton.dataset.id || "";
      edit.title = "Editar datos de la factura";
      edit.setAttribute("aria-label", "Editar datos de la factura");
      edit.style.marginLeft = "6px";
      edit.innerHTML = '<i class="ri-edit-line"></i>';
      viewButton.insertAdjacentElement("afterend", edit);
    });
  }

  function scheduleEnhance() {
    clearTimeout(enhanceTimer);
    enhanceTimer = setTimeout(() => enhanceInvoiceRows().catch((error) => console.warn("Invoice edit:", error)), 180);
  }

  document.addEventListener("click", (event) => {
    const edit = event.target.closest?.(".invoice-edit-meta");
    if (!edit) return;
    event.preventDefault();
    event.stopPropagation();
    openInvoiceEditor(edit.dataset.id);
  }, true);

  const main = document.getElementById("main-content");
  if (main) new MutationObserver(scheduleEnhance).observe(main, { childList: true, subtree: true });
  scheduleEnhance();
})();
