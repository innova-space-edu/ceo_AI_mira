(() => {
  "use strict";

  const cfg = window.INNOVA_ADMIN_CONFIG;
  const db = window.getInnovaAdminSupabaseClient?.() || window.INNOVA_ADMIN_SUPABASE_CLIENT;
  if (!cfg || !db) return;

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  const money = (v) => new Intl.NumberFormat("es-CL", {
    style: "currency", currency: "CLP", maximumFractionDigits: 0
  }).format(Number(v) || 0);
  const dateCL = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CL");
  };

  let cache = [];
  let lastHealth = null;

  function injectStyle() {
    if ($("#innova-pay-admin-style")) return;
    const style = document.createElement("style");
    style.id = "innova-pay-admin-style";
    style.textContent = `
      .ipay-shell{display:grid;gap:16px}.ipay-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}
      .ipay-head h2{margin:0;color:#172342;font-size:1.35rem}.ipay-head p{margin:5px 0 0;color:#6d7890;font-size:.82rem;max-width:720px}
      .ipay-actions{display:flex;gap:8px;flex-wrap:wrap}.ipay-btn{border:1px solid #dbe2ef;background:#fff;color:#253456;border-radius:10px;padding:9px 12px;font:700 .76rem Inter,sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:7px}
      .ipay-btn.primary{background:#5147ed;border-color:#5147ed;color:#fff}.ipay-btn.danger{color:#b52c4a;background:#fff4f6;border-color:#f3d3da}.ipay-btn:disabled{opacity:.5;cursor:not-allowed}
      .ipay-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.ipay-metric{background:#fff;border:1px solid #dfe5ef;border-radius:14px;padding:14px 15px;box-shadow:0 8px 22px rgba(27,39,72,.05)}
      .ipay-metric span{display:block;color:#7a869d;font-size:.66rem;text-transform:uppercase;letter-spacing:.055em;font-weight:800}.ipay-metric strong{display:block;margin-top:5px;color:#172342;font-size:1.05rem}
      .ipay-card{background:#fff;border:1px solid #dfe5ef;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(27,39,72,.045)}.ipay-card-head{padding:13px 15px;border-bottom:1px solid #e8ecf3;display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.ipay-card-body{padding:15px}
      .ipay-health{display:flex;gap:8px;flex-wrap:wrap}.ipay-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 8px;border-radius:999px;background:#eef2f8;color:#5e6b84;font-size:.68rem;font-weight:800}.ipay-pill.ok{background:#ebf9f1;color:#1f7748}.ipay-pill.warn{background:#fff7df;color:#8b640d}
      .ipay-table-wrap{overflow:auto}.ipay-table{width:100%;border-collapse:collapse;min-width:980px}.ipay-table th,.ipay-table td{padding:10px 9px;border-bottom:1px solid #edf0f5;text-align:left;font-size:.74rem;vertical-align:middle}.ipay-table th{font-size:.62rem;text-transform:uppercase;letter-spacing:.05em;color:#79859b;background:#f8f9fc}.ipay-table strong{color:#1a2948}.ipay-row-actions{display:flex;gap:5px;white-space:nowrap}
      .ipay-status{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:.64rem;font-weight:900;text-transform:uppercase;letter-spacing:.035em}.ipay-status.paid{background:#e9f8ef;color:#177544}.ipay-status.active,.ipay-status.opened{background:#eef1ff;color:#5147ed}.ipay-status.processing{background:#fff5da;color:#8e6510}.ipay-status.failed,.ipay-status.cancelled,.ipay-status.expired{background:#fff0f3;color:#a72c48}
      .ipay-empty{padding:36px 20px;text-align:center;color:#758198}.ipay-warning{padding:12px 14px;border-radius:11px;background:#fff8e6;border:1px solid #eedca6;color:#76570b;font-size:.76rem;line-height:1.5}
      .ipay-modal{position:fixed;inset:0;z-index:10020;background:rgba(11,18,38,.58);display:flex;align-items:center;justify-content:center;padding:18px}.ipay-modal-card{width:min(760px,96vw);max-height:94vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 28px 90px rgba(0,0,0,.28)}.ipay-modal-head{padding:15px 17px;border-bottom:1px solid #e7ebf2;display:flex;align-items:center;justify-content:space-between;gap:12px}.ipay-modal-body{padding:17px}.ipay-form{display:grid;grid-template-columns:1fr 1fr;gap:11px}.ipay-field{display:grid;gap:5px}.ipay-field.full{grid-column:1/-1}.ipay-field span{font-size:.64rem;text-transform:uppercase;letter-spacing:.05em;color:#77839b;font-weight:800}.ipay-field input,.ipay-field textarea{border:1px solid #dce3ee;border-radius:10px;padding:10px 11px;font:500 .8rem Inter,sans-serif;color:#253453;outline:none}.ipay-field textarea{min-height:78px;resize:vertical}.ipay-field input:focus,.ipay-field textarea:focus{border-color:#8179ff;box-shadow:0 0 0 3px rgba(81,71,237,.1)}.ipay-modal-foot{padding:13px 17px;border-top:1px solid #e7ebf2;display:flex;justify-content:flex-end;gap:8px}
      .ipay-created{display:grid;gap:12px}.ipay-linkbox{padding:12px;border:1px solid #dce3ee;border-radius:11px;background:#f8f9fc;word-break:break-all;font-size:.78rem}.ipay-created-actions{display:flex;gap:8px;flex-wrap:wrap}
      @media(max-width:850px){.ipay-metrics{grid-template-columns:1fr 1fr}}@media(max-width:620px){.ipay-form{grid-template-columns:1fr}.ipay-field.full{grid-column:auto}.ipay-metrics{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  async function api(path, options = {}) {
    const { data } = await db.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error("Sesión administrativa no disponible");
    const response = await fetch(cfg.backendUrl.replace(/\/$/, "") + path, {
      method: options.method || "GET",
      headers: {
        Authorization: "Bearer " + token,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body?.error || "No fue posible completar la operación");
      error.code = body?.code || null;
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function statusLabel(status) {
    return ({
      active:"Activo", opened:"Abierto", processing:"Pago iniciado", paid:"Pagado",
      failed:"Fallido", expired:"Vencido", cancelled:"Cancelado", refunded:"Reembolsado"
    })[status] || String(status || "—");
  }

  function ensureNav() {
    injectStyle();
    const nav = $("#side-nav");
    if (!nav) return;
    let btn = nav.querySelector("[data-innova-payments-view]");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nav-item";
      btn.dataset.innovaPaymentsView = "payments";
      btn.innerHTML = '<i class="ri-bank-card-2-line"></i><span>Cobros y pagos</span>';
      const accounting = nav.querySelector('a[href="contador.html"]');
      if (accounting) accounting.before(btn); else nav.appendChild(btn);
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        renderPayments();
      });
    }
    nav.addEventListener("click", (event) => {
      if (!event.target.closest("[data-innova-payments-view]")) btn.classList.remove("active");
    });
  }

  function healthHtml(h) {
    if (!h) return "";
    return `
      <div class="ipay-health">
        <span class="ipay-pill ${h.database_configured ? "ok" : "warn"}"><i class="ri-database-2-line"></i>BD ${h.database_configured ? "lista" : "pendiente"}</span>
        <span class="ipay-pill ${h.mercadopago_configured ? "ok" : "warn"}"><i class="ri-bank-card-line"></i>Mercado Pago ${h.mercadopago_configured ? "conectado" : "pendiente"}</span>
        <span class="ipay-pill ${h.webhook_configured ? "ok" : "warn"}"><i class="ri-radar-line"></i>Webhook ${h.webhook_configured ? "firmado" : "pendiente"}</span>
      </div>`;
  }

  function rowHtml(row) {
    return `<tr>
      <td><strong>${esc(row.customer_name || "Sin cliente")}</strong><div style="color:#7b879c;margin-top:2px">${esc(row.customer_rut || "")}</div></td>
      <td>${esc(row.description || "—")}</td>
      <td><strong>${money(row.amount)}</strong></td>
      <td><span class="ipay-status ${esc(row.status)}">${esc(statusLabel(row.status))}</span></td>
      <td>${esc(row.provider_status || "—")}</td>
      <td>${dateCL(row.expires_at)}</td>
      <td><div class="ipay-row-actions">
        <button class="ipay-btn" data-pay-copy="${esc(row.id)}" title="Copiar link"><i class="ri-file-copy-line"></i></button>
        <button class="ipay-btn" data-pay-open="${esc(row.id)}" title="Abrir"><i class="ri-external-link-line"></i></button>
        <button class="ipay-btn" data-pay-edit="${esc(row.id)}" title="Editar"><i class="ri-edit-line"></i></button>
        ${row.provider_order_id ? `<button class="ipay-btn" data-pay-sync="${esc(row.id)}" title="Sincronizar"><i class="ri-refresh-line"></i></button>` : ""}
      </div></td>
    </tr>`;
  }

  async function renderPayments() {
    ensureNav();
    const main = $("#main-content");
    if (!main) return;
    document.querySelectorAll(".nav-item").forEach((el) => el.classList.remove("active"));
    const btn = $("[data-innova-payments-view]");
    if (btn) btn.classList.add("active");
    const title = $("#view-title");
    if (title) title.textContent = "Cobros y pagos";
    main.innerHTML = '<div class="empty-state"><div class="loading-orb" style="margin:auto;width:38px;height:38px"></div><p>Cargando Innova Pay…</p></div>';

    let health = null;
    let links = [];
    let loadError = "";
    try {
      const results = await Promise.allSettled([
        api("/api/admin/payments/health"),
        api("/api/admin/payments/links"),
      ]);
      if (results[0].status === "fulfilled") health = results[0].value;
      if (results[1].status === "fulfilled") links = results[1].value.links || [];
      else loadError = results[1].reason?.message || "No fue posible cargar los cobros";
    } catch (error) {
      loadError = error.message || "No fue posible cargar Innova Pay";
    }
    lastHealth = health;
    cache = links;

    const paid = links.filter((x) => x.status === "paid");
    const open = links.filter((x) => ["active","opened","processing"].includes(x.status));
    const paidAmount = paid.reduce((sum, x) => sum + Number(x.amount || 0), 0);

    main.innerHTML = `<section class="ipay-shell">
      <div class="ipay-head">
        <div><h2>Innova Pay</h2><p>Crea links de cobro reutilizables. El cliente paga en Mercado Pago y CEO recibe el estado del pago mediante webhook.</p></div>
        <div class="ipay-actions"><button class="ipay-btn" data-pay-refresh><i class="ri-refresh-line"></i>Actualizar</button><button class="ipay-btn primary" data-pay-new><i class="ri-add-line"></i>Nuevo link</button></div>
      </div>
      ${healthHtml(health)}
      ${loadError ? `<div class="ipay-warning"><strong>Configuración pendiente:</strong> ${esc(loadError)}. El módulo está instalado, pero necesita la migración de base de datos y las credenciales privadas del backend para operar en producción.</div>` : ""}
      <div class="ipay-metrics">
        <div class="ipay-metric"><span>Links</span><strong>${links.length}</strong></div>
        <div class="ipay-metric"><span>Cobros abiertos</span><strong>${open.length}</strong></div>
        <div class="ipay-metric"><span>Pagados</span><strong>${paid.length}</strong></div>
        <div class="ipay-metric"><span>Total pagado</span><strong>${money(paidAmount)}</strong></div>
      </div>
      <div class="ipay-card">
        <div class="ipay-card-head"><strong>Links de cobro</strong><span style="font-size:.72rem;color:#79859b">Proveedor actual: Mercado Pago</span></div>
        <div class="ipay-card-body">
          ${links.length ? `<div class="ipay-table-wrap"><table class="ipay-table"><thead><tr><th>Cliente</th><th>Concepto</th><th>Monto</th><th>Estado</th><th>Proveedor</th><th>Vence</th><th>Acciones</th></tr></thead><tbody>${links.map(rowHtml).join("")}</tbody></table></div>` : '<div class="ipay-empty"><i class="ri-bank-card-line" style="font-size:1.8rem"></i><p>Aún no hay links de cobro.</p></div>'}
        </div>
      </div>
    </section>`;

    bindTable();
  }

  function bindTable() {
    const root = $("#main-content");
    if (!root) return;
    root.querySelector("[data-pay-new]")?.addEventListener("click", () => openCreateDialog());
    root.querySelector("[data-pay-refresh]")?.addEventListener("click", renderPayments);
    root.querySelectorAll("[data-pay-edit]").forEach((btn) => btn.addEventListener("click", () => {
      const row = cache.find((x) => x.id === btn.dataset.payEdit);
      if (row) openCreateDialog(row, { edit: true });
    }));
    root.querySelectorAll("[data-pay-copy]").forEach((btn) => btn.addEventListener("click", async () => {
      const row = cache.find((x) => x.id === btn.dataset.payCopy);
      if (!row) return;
      await navigator.clipboard.writeText(row.public_url || row.fallback_url);
      toast("Link copiado.");
    }));
    root.querySelectorAll("[data-pay-open]").forEach((btn) => btn.addEventListener("click", () => {
      const row = cache.find((x) => x.id === btn.dataset.payOpen);
      if (row) window.open(row.public_url || row.fallback_url, "_blank", "noopener");
    }));
    root.querySelectorAll("[data-pay-sync]").forEach((btn) => btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await api("/api/admin/payments/links/" + encodeURIComponent(btn.dataset.paySync) + "/sync", { method: "POST" });
        toast("Estado sincronizado.");
        await renderPayments();
      } catch (error) {
        toast(error.message, "error");
      } finally {
        btn.disabled = false;
      }
    }));
  }

  function openCreateDialog(prefill = {}, options = {}) {
    injectStyle();
    const root = $("#modal-root") || document.body;
    const previous = root.querySelector(".ipay-modal");
    if (previous) previous.remove();

    const modal = document.createElement("div");
    modal.className = "ipay-modal";
    const isEdit = Boolean(options.edit && prefill.id);
    const expires = prefill.expires_at ? String(prefill.expires_at).slice(0,10) : "";
    modal.innerHTML = `<div class="ipay-modal-card">
      <div class="ipay-modal-head"><div><strong>${isEdit ? "Editar cobro" : "Crear link de pago"}</strong><div style="font-size:.7rem;color:#7b879c;margin-top:3px">Mercado Pago · CLP</div></div><button class="ipay-btn" data-pay-close><i class="ri-close-line"></i></button></div>
      <form class="ipay-modal-body ipay-form" data-pay-form>
        <label class="ipay-field full"><span>Cliente / empresa</span><input name="customer_name" value="${esc(prefill.customer_name || "")}" placeholder="Razón social o nombre"></label>
        <label class="ipay-field"><span>RUT</span><input name="customer_rut" value="${esc(prefill.customer_rut || "")}" placeholder="76.123.456-7"></label>
        <label class="ipay-field"><span>Correo</span><input name="customer_email" type="email" value="${esc(prefill.customer_email || "")}" placeholder="cliente@empresa.cl"></label>
        <label class="ipay-field"><span>Fono</span><input name="customer_phone" value="${esc(prefill.customer_phone || "")}" placeholder="+56 9 ..."></label>
        <label class="ipay-field"><span>Vencimiento</span><input name="expires_at" type="date" value="${esc(expires)}"></label>
        <label class="ipay-field full"><span>Concepto</span><textarea name="description" required placeholder="Ej. Anticipo proyecto Sala de Música">${esc(prefill.description || "")}</textarea></label>
        <label class="ipay-field full"><span>Monto CLP</span><input name="amount" type="number" min="1" step="1" required value="${esc(prefill.amount || "")}" placeholder="500000"></label>
        <input type="hidden" name="project_id" value="${esc(prefill.project_id || "")}">
        <input type="hidden" name="quotation_id" value="${esc(prefill.quotation_id || "")}">
        <input type="hidden" name="invoice_id" value="${esc(prefill.invoice_id || "")}">
        <input type="hidden" name="source" value="${esc(prefill.source || (isEdit ? "ceo_admin_edit" : "ceo_admin"))}">
      </form>
      <div class="ipay-modal-foot"><button class="ipay-btn" type="button" data-pay-close>Cancelar</button><button class="ipay-btn primary" type="button" data-pay-submit>${isEdit ? "Guardar cambios" : "Crear link"}</button></div>
    </div>`;
    root.appendChild(modal);

    modal.querySelectorAll("[data-pay-close]").forEach((btn) => btn.addEventListener("click", () => modal.remove()));
    modal.addEventListener("click", (event) => { if (event.target === modal) modal.remove(); });
    modal.querySelector("[data-pay-submit]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const form = modal.querySelector("[data-pay-form]");
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      const body = Object.fromEntries(fd.entries());
      body.amount = Number(body.amount || 0);
      button.disabled = true;
      button.textContent = isEdit ? "Guardando…" : "Creando…";
      try {
        const response = isEdit
          ? await api("/api/admin/payments/links/" + encodeURIComponent(prefill.id), { method: "PATCH", body })
          : await api("/api/admin/payments/links", { method: "POST", body });
        showCreated(modal, response.link, isEdit);
        if ($("#main-content")?.querySelector(".ipay-shell")) setTimeout(renderPayments, 250);
      } catch (error) {
        toast(error.message || "No fue posible guardar el cobro", "error");
        button.disabled = false;
        button.textContent = isEdit ? "Guardar cambios" : "Crear link";
      }
    });
  }

  function showCreated(modal, link, edited) {
    const card = modal.querySelector(".ipay-modal-card");
    const url = link?.public_url || link?.fallback_url || "";
    const fallback = link?.fallback_url || "";
    card.innerHTML = `<div class="ipay-modal-head"><div><strong>${edited ? "Cobro actualizado" : "Link creado"}</strong><div style="font-size:.7rem;color:#7b879c;margin-top:3px">${money(link?.amount)}</div></div><button class="ipay-btn" data-pay-close><i class="ri-close-line"></i></button></div>
      <div class="ipay-modal-body ipay-created">
        <div><strong>${esc(link?.customer_name || "Cliente")}</strong><div style="font-size:.75rem;color:#718096;margin-top:3px">${esc(link?.description || "")}</div></div>
        <div class="ipay-linkbox">${esc(url)}</div>
        ${fallback && fallback !== url ? `<div style="font-size:.7rem;color:#7d8799">Ruta de respaldo: ${esc(fallback)}</div>` : ""}
        <div class="ipay-created-actions">
          <button class="ipay-btn primary" data-result-copy><i class="ri-file-copy-line"></i>Copiar link</button>
          <button class="ipay-btn" data-result-open><i class="ri-external-link-line"></i>Abrir</button>
          <button class="ipay-btn" data-result-whatsapp><i class="ri-whatsapp-line"></i>WhatsApp</button>
        </div>
      </div>`;
    card.querySelector("[data-pay-close]")?.addEventListener("click", () => modal.remove());
    card.querySelector("[data-result-copy]")?.addEventListener("click", async () => {
      await navigator.clipboard.writeText(url);
      toast("Link copiado.");
    });
    card.querySelector("[data-result-open]")?.addEventListener("click", () => window.open(url, "_blank", "noopener"));
    card.querySelector("[data-result-whatsapp]")?.addEventListener("click", () => {
      const text = "Pago Innova Space Edu SpA · " + money(link?.amount) + "\n" + url;
      window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
    });
  }

  function toast(message, type = "") {
    const root = $("#toast-root");
    if (!root) return;
    const item = document.createElement("div");
    item.className = "toast " + type;
    item.textContent = message;
    root.appendChild(item);
    setTimeout(() => item.remove(), 4200);
  }

  const observer = new MutationObserver(ensureNav);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureNav, { once: true });
  else ensureNav();

  window.InnovaPaymentsAdmin = Object.freeze({
    renderPayments,
    openCreateDialog,
    get health() { return lastHealth; }
  });
})();