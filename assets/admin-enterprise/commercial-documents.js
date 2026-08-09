(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  if (params.get("safe") === "1") return;

  const cfg = window.INNOVA_ADMIN_CONFIG;
  if (!cfg?.supabaseUrl || !cfg?.supabasePublishableKey) return;

  const QUOTE_ROLES = new Set(["superadmin", "admin", "finance"]);
  const OC_ROLES = new Set(["superadmin", "admin", "finance", "project_manager"]);
  const DEFAULT_PROFILE = Object.freeze({
    brand_name: "Innova Space Edu SpA",
    legal_name: "CONSTRUCTORA Y SOLUCIONES EDUCATIVAS MORALES SpA",
    rut: "78.220.699-0",
    billing_address: "Libertad 514, Vallenar",
    city: "Vallenar",
    region: "Atacama",
    phone: "926301822",
    email: "contacto@innova-space-edu.cl",
    website: "https://innova-space-edu.cl",
    legal_representative: "IVÁN EDUARDO MORALES SANDOVAL",
    legal_representative_rut: "10.236.204-7",
    legal_representative_title: "Administrador y Representante Legal",
    mercado_publico_active: true,
    quotation_sequence_start: 34,
  });

  let profile = null;
  let userProfile = null;
  let enhanceTimer = null;
  let itemCounter = 0;

  const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[c]));
  const enc = (value = "") => encodeURIComponent(String(value));
  const number = (value) => Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || 0;
  const money = (value) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(value || 0));
  const normalize = (value = "") => String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  const padQuote = (value) => String(Math.max(0, Number(value) || 0)).padStart(3, "0");

  function localISODate(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function addDaysISO(days, from = new Date()) {
    const next = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days, 12, 0, 0);
    return localISODate(next);
  }

  function formatDate(value) {
    if (!value) return "—";
    const d = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? String(value) : new Intl.DateTimeFormat("es-CL").format(d);
  }

  function formatPhone(value = "") {
    const digits = String(value).replace(/\D/g, "");
    if (digits.length === 9) return `+56 9 ${digits.slice(1, 5)} ${digits.slice(5)}`;
    return value || "—";
  }

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
      const raw = token.split(".")[1];
      if (!raw) return "";
      const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
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

  async function storageFetch(path, options = {}) {
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

  async function loadUserProfile() {
    if (userProfile) return userProfile;
    const session = findStoredSession();
    const id = jwtSub(session?.access_token || "");
    if (!id) return null;
    const rows = await rest(`company_users?select=role,status&user_id=eq.${enc(id)}&limit=1`);
    userProfile = Array.isArray(rows) ? rows[0] : null;
    return userProfile;
  }

  async function loadCompanyProfile() {
    if (profile) return profile;
    try {
      const rows = await rest("company_settings?select=value&key=eq.company_profile&limit=1");
      profile = { ...DEFAULT_PROFILE, ...((Array.isArray(rows) && rows[0]?.value) || {}) };
    } catch (_) {
      profile = { ...DEFAULT_PROFILE };
    }
    return profile;
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

  function ensureStyles() {
    if (document.getElementById("commercial-documents-style")) return;
    const style = document.createElement("style");
    style.id = "commercial-documents-style";
    style.textContent = `
      .commercial-toolbar{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px 20px;border:1px solid #dce5f3;background:linear-gradient(135deg,#fff,#f4f7ff);border-radius:20px;margin:0 0 20px;box-shadow:0 10px 28px rgba(38,55,92,.06)}
      .commercial-toolbar-copy{display:flex;gap:13px;align-items:center}.commercial-toolbar-icon{width:44px;height:44px;display:grid;place-items:center;border-radius:14px;background:#eef1ff;color:#5146ff;font-size:22px}.commercial-toolbar strong{display:block;color:#101c39;font-size:15px}.commercial-toolbar small{display:block;color:#6c7898;margin-top:3px;line-height:1.4}.commercial-toolbar-actions{display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end}
      .commercial-modal{width:min(1260px,96vw)!important;max-width:1260px!important}.commercial-form-section{border:1px solid #e2e8f2;border-radius:16px;padding:16px;background:#fff;margin-bottom:14px}.commercial-form-section>h3{font-size:14px;margin:0 0 13px;color:#13213f}.commercial-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.commercial-form-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.commercial-form-grid .full{grid-column:1/-1}.commercial-static-card{background:#f6f8fd;border:1px solid #e3e9f4;border-radius:14px;padding:14px;line-height:1.55;color:#52617e}.commercial-static-card strong{display:block;color:#13213f;margin-bottom:4px}.commercial-items{width:100%;border-collapse:collapse}.commercial-items th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#61708e;background:#f5f7fb;padding:9px 7px;text-align:left}.commercial-items td{border-top:1px solid #e8edf5;padding:6px}.commercial-items input{width:100%;min-width:0;border:1px solid #dbe2ee;border-radius:8px;padding:8px;background:white}.commercial-items .line-no{width:34px;text-align:center;color:#68758f;font-weight:700}.commercial-items .money-cell{white-space:nowrap;font-weight:700;color:#1d2b49}.commercial-summary{margin-left:auto;width:min(390px,100%);display:grid;grid-template-columns:1fr auto;gap:8px 18px;padding:14px 4px 0;color:#53617c}.commercial-summary strong{color:#111d38}.commercial-summary .grand{font-size:18px;color:#111d38;border-top:1px solid #dce3ef;padding-top:9px}.commercial-message{min-height:20px;color:#b42318;margin-top:8px}.commercial-sheet-wrap{background:#dfe5ee;padding:24px;border-radius:18px;max-height:72vh;overflow:auto}.commercial-sheet{width:210mm;min-height:297mm;background:#fff;margin:0 auto;padding:14mm 14mm 12mm;box-sizing:border-box;color:#17213a;font-family:Inter,Arial,sans-serif;position:relative}.commercial-sheet *{box-sizing:border-box}.commercial-head{display:grid;grid-template-columns:1.3fr .7fr;gap:18px;padding-bottom:14px;border-bottom:3px solid #4e46e5}.commercial-brand{display:flex;gap:14px;align-items:center}.commercial-brand img{width:72px;height:72px;object-fit:cover;border-radius:16px}.commercial-brand h1{font-size:20px;margin:0;color:#121b37}.commercial-brand p{font-size:10px;margin:3px 0;color:#63708b;line-height:1.45}.commercial-doc-no{text-align:right}.commercial-doc-no span{display:block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#74819a}.commercial-doc-no strong{display:block;font-size:26px;margin-top:4px}.commercial-doc-no small{display:block;margin-top:6px;color:#68758f}.commercial-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:16px 0}.commercial-box{border:1px solid #dfe5ef;border-radius:12px;padding:12px}.commercial-box .box-title{font-size:9px;text-transform:uppercase;letter-spacing:.11em;color:#687892;font-weight:800;margin-bottom:7px}.commercial-box strong{font-size:12px}.commercial-box p{font-size:10px;line-height:1.45;margin:3px 0;color:#56647f}.commercial-sheet table{width:100%;border-collapse:collapse;margin:13px 0}.commercial-sheet th{background:#17213a;color:#fff;font-size:9px;text-transform:uppercase;padding:8px 7px;text-align:left}.commercial-sheet td{border-bottom:1px solid #e0e5ee;padding:8px 7px;font-size:9.5px;vertical-align:top}.commercial-sheet .right{text-align:right}.commercial-sheet .center{text-align:center}.commercial-sheet-totals{width:48%;margin-left:auto;display:grid;grid-template-columns:1fr auto;gap:7px 16px;font-size:10px;padding:10px 0 16px}.commercial-sheet-totals .total{font-size:14px;font-weight:800;border-top:2px solid #17213a;padding-top:8px}.commercial-section-title{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#4e46e5;font-weight:800;margin:12px 0 6px}.commercial-copy{font-size:9.5px;line-height:1.55;color:#43516e;white-space:pre-wrap}.commercial-signature{display:flex;justify-content:flex-end;margin-top:24px}.commercial-signature>div{width:260px;text-align:center;border-top:1px solid #65718a;padding-top:7px;font-size:9px;line-height:1.45}.commercial-footer{position:absolute;left:14mm;right:14mm;bottom:8mm;border-top:1px solid #e0e5ed;padding-top:6px;display:flex;justify-content:space-between;gap:8px;font-size:8px;color:#6a7791}.mp-badge{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:999px;background:#eef0ff;color:#4338ca;font-size:8px;font-weight:800}.commercial-internal-badge{display:inline-block;font-size:8px;font-weight:800;color:#7a5400;background:#fff2c6;padding:4px 7px;border-radius:999px;margin-bottom:6px}.commercial-read-result{font-size:12px;color:#52617e;padding:8px 0}.commercial-modal .modal-foot{gap:8px;flex-wrap:wrap}
      @media(max-width:900px){.commercial-toolbar{align-items:flex-start;flex-direction:column}.commercial-toolbar-actions{justify-content:flex-start}.commercial-form-grid,.commercial-form-grid.two{grid-template-columns:1fr}.commercial-sheet-wrap{padding:8px;overflow:auto}.commercial-sheet{transform-origin:top left}.commercial-items{display:block;overflow:auto}.commercial-modal{width:98vw!important}}
      @media print{.commercial-sheet-wrap{padding:0;background:#fff}.commercial-sheet{box-shadow:none;margin:0}.commercial-footer{position:fixed}}
    `;
    document.head.appendChild(style);
  }

  function closeCommercialModal() {
    const root = document.getElementById("modal-root");
    if (root?.querySelector("[data-commercial-modal]")) root.innerHTML = "";
  }

  function modalShell(title, subtitle = "") {
    const root = document.getElementById("modal-root");
    if (!root) return null;
    root.innerHTML = `<div class="modal-backdrop" data-commercial-modal><div class="modal commercial-modal"><div class="modal-head"><div><h2>${esc(title)}</h2>${subtitle ? `<p class="muted small">${esc(subtitle)}</p>` : ""}</div><button type="button" class="mini-btn" data-commercial-close><i class="ri-close-line"></i></button></div><div class="modal-body"></div><div class="modal-foot"></div></div></div>`;
    root.querySelector("[data-commercial-close]")?.addEventListener("click", closeCommercialModal);
    root.querySelector("[data-commercial-modal]")?.addEventListener("click", (event) => { if (event.target === event.currentTarget) closeCommercialModal(); });
    return root.querySelector(".modal");
  }

  async function loadLookups() {
    const [parties, projects, quotations] = await Promise.all([
      rest("company_parties?select=id,name,rut,roles,email,phone,address,city,contact_name,active&active=eq.true&order=name.asc"),
      rest("company_projects?select=id,title,client_party_id,status&order=title.asc"),
      rest("company_quotations?select=id,quote_number,client_name,total_amount,status&direction=eq.sale&order=created_at.desc&limit=300"),
    ]);
    return {
      parties: Array.isArray(parties) ? parties : [],
      projects: Array.isArray(projects) ? projects : [],
      quotations: Array.isArray(quotations) ? quotations : [],
    };
  }

  function option(value, text, selected = false) {
    return `<option value="${esc(value)}"${selected ? " selected" : ""}>${esc(text)}</option>`;
  }

  async function peekNextQuoteNumber() {
    const p = await loadCompanyProfile();
    try {
      const rows = await rest(`company_settings?select=value&key=eq.${enc("sequence:quotation")}&limit=1`);
      const last = Number(Array.isArray(rows) ? rows[0]?.value?.last : 0) || 0;
      return Math.max(last + 1, Number(p.quotation_sequence_start || 34));
    } catch (_) {
      return Number(p.quotation_sequence_start || 34);
    }
  }

  async function reserveQuoteNumber() {
    const p = await loadCompanyProfile();
    const result = await rest("rpc/company_next_sequence", {
      method: "POST",
      body: JSON.stringify({ p_key: "quotation", p_start: Number(p.quotation_sequence_start || 34) }),
    });
    const value = Number(Array.isArray(result) ? result[0] : result);
    if (!value) throw new Error("No se pudo reservar el número de cotización.");
    return value;
  }

  function addItemRow(tbody, values = {}) {
    itemCounter += 1;
    const tr = document.createElement("tr");
    tr.dataset.itemRow = String(itemCounter);
    tr.innerHTML = `
      <td class="line-no"></td>
      <td><input name="description" type="text" placeholder="Producto o servicio" value="${esc(values.description || "")}" /></td>
      <td><input name="unit" type="text" placeholder="Unidad" value="${esc(values.unit || "Unidad")}" /></td>
      <td><input name="quantity" type="number" min="0" step="0.01" value="${esc(values.quantity ?? 1)}" /></td>
      <td><input name="unit_price" type="number" min="0" step="1" value="${esc(values.unit_price ?? 0)}" /></td>
      <td><input name="discount_pct" type="number" min="0" max="100" step="0.01" value="${esc(values.discount_pct ?? 0)}" /></td>
      <td class="money-cell" data-line-total>$0</td>
      <td><button type="button" class="mini-btn" data-remove-line title="Eliminar ítem"><i class="ri-delete-bin-line"></i></button></td>`;
    tbody.appendChild(tr);
    renumberRows(tbody);
    return tr;
  }

  function renumberRows(tbody) {
    [...tbody.querySelectorAll("tr[data-item-row]")].forEach((tr, index) => { const cell = tr.querySelector(".line-no"); if (cell) cell.textContent = String(index + 1); });
  }

  function collectItems(tbody) {
    return [...tbody.querySelectorAll("tr[data-item-row]")].map((tr, index) => {
      const quantity = number(tr.querySelector('[name="quantity"]')?.value);
      const unitPrice = number(tr.querySelector('[name="unit_price"]')?.value);
      const discountPct = Math.min(100, Math.max(0, number(tr.querySelector('[name="discount_pct"]')?.value)));
      const gross = Math.round(quantity * unitPrice);
      const discount = Math.round(gross * discountPct / 100);
      return {
        line_no: index + 1,
        description: String(tr.querySelector('[name="description"]')?.value || "").trim(),
        unit: String(tr.querySelector('[name="unit"]')?.value || "Unidad").trim() || "Unidad",
        quantity,
        unit_price: unitPrice,
        discount_pct: discountPct,
        discount_amount: discount,
        line_total: Math.max(0, gross - discount),
      };
    }).filter((item) => item.description || item.unit_price || item.quantity);
  }

  function totalsFromItems(items) {
    const subtotal = items.reduce((sum, item) => sum + Math.round(item.quantity * item.unit_price), 0);
    const discount = items.reduce((sum, item) => sum + Number(item.discount_amount || 0), 0);
    const net = Math.max(0, subtotal - discount);
    const vat = Math.round(net * 0.19);
    return { subtotal, discount, net, vat, total: net + vat };
  }

  function updateItemTotals(tbody, root) {
    const items = collectItems(tbody);
    [...tbody.querySelectorAll("tr[data-item-row]")].forEach((tr, index) => {
      const item = items[index];
      const cell = tr.querySelector("[data-line-total]");
      if (cell) cell.textContent = money(item?.line_total || 0);
    });
    const t = totalsFromItems(items);
    ["subtotal", "discount", "net", "vat", "total"].forEach((key) => {
      const node = root.querySelector(`[data-total-${key}]`);
      if (node) node.textContent = money(t[key]);
    });
    return { items, ...t };
  }

  function bindItemTable(root) {
    const tbody = root.querySelector("[data-items-body]");
    if (!tbody) return;
    root.querySelector("[data-add-line]")?.addEventListener("click", () => { addItemRow(tbody); updateItemTotals(tbody, root); });
    tbody.addEventListener("input", () => updateItemTotals(tbody, root));
    tbody.addEventListener("click", (event) => {
      const button = event.target.closest?.("[data-remove-line]");
      if (!button) return;
      const rows = tbody.querySelectorAll("tr[data-item-row]");
      if (rows.length <= 1) {
        const row = button.closest("tr");
        row?.querySelectorAll("input").forEach((input) => { input.value = input.name === "quantity" ? "1" : input.name === "unit" ? "Unidad" : ""; });
      } else button.closest("tr")?.remove();
      renumberRows(tbody);
      updateItemTotals(tbody, root);
    });
  }

  function commercialItemsTable() {
    return `<div style="overflow:auto"><table class="commercial-items"><thead><tr><th>#</th><th style="min-width:260px">Descripción</th><th>Unidad</th><th>Cant.</th><th>Precio unit.</th><th>Desc. %</th><th>Total</th><th></th></tr></thead><tbody data-items-body></tbody></table></div><div style="display:flex;justify-content:flex-start;margin-top:9px"><button type="button" class="btn ghost" data-add-line><i class="ri-add-line"></i> Agregar ítem</button></div><div class="commercial-summary"><span>Subtotal</span><strong data-total-subtotal>$0</strong><span>Descuentos</span><strong data-total-discount>$0</strong><span>Neto</span><strong data-total-net>$0</strong><span>IVA 19%</span><strong data-total-vat>$0</strong><span class="grand">TOTAL</span><strong class="grand" data-total-total>$0</strong></div>`;
  }

  function readPartyIntoForm(form, party) {
    if (!form || !party) return;
    const map = { client_name: party.name, client_rut: party.rut, client_address: [party.address, party.city].filter(Boolean).join(", "), client_email: party.email, client_phone: party.phone, client_contact: party.contact_name, buyer_name: party.name, buyer_rut: party.rut, buyer_address: [party.address, party.city].filter(Boolean).join(", "), buyer_email: party.email, buyer_phone: party.phone, buyer_contact: party.contact_name };
    Object.entries(map).forEach(([name, value]) => { const field = form.elements.namedItem(name); if (field && value != null) field.value = value; });
  }

  function quoteSnapshot(form, tbody, quoteNumber, company) {
    const fd = new FormData(form);
    const calc = updateItemTotals(tbody, form.closest(".modal") || form);
    return {
      quote_number: padQuote(quoteNumber),
      issue_date: String(fd.get("issue_date") || ""),
      valid_until: String(fd.get("valid_until") || ""),
      project_title: String(form.querySelector('[name="project_id"] option:checked')?.textContent || "Sin proyecto"),
      client_name: String(fd.get("client_name") || "").trim(),
      client_rut: String(fd.get("client_rut") || "").trim(),
      client_address: String(fd.get("client_address") || "").trim(),
      client_contact: String(fd.get("client_contact") || "").trim(),
      client_email: String(fd.get("client_email") || "").trim(),
      client_phone: String(fd.get("client_phone") || "").trim(),
      title: String(fd.get("title") || "").trim(),
      description: String(fd.get("description") || "").trim(),
      delivery_term: String(fd.get("delivery_term") || "").trim(),
      payment_terms: String(fd.get("payment_terms") || "").trim(),
      warranty: String(fd.get("warranty") || "").trim(),
      conditions: String(fd.get("conditions") || "").trim(),
      mp_process_type: String(fd.get("mp_process_type") || "").trim(),
      mp_process_id: String(fd.get("mp_process_id") || "").trim(),
      mp_delivery_address: String(fd.get("mp_delivery_address") || "").trim(),
      items: calc.items,
      subtotal: calc.subtotal,
      discount: calc.discount,
      net_amount: calc.net,
      vat_amount: calc.vat,
      total_amount: calc.total,
      company,
    };
  }

  function buildQuoteHtml(q) {
    const c = q.company || DEFAULT_PROFILE;
    const itemRows = (q.items || []).map((item, index) => `<tr><td class="center">${index + 1}</td><td><strong>${esc(item.description)}</strong></td><td>${esc(item.unit)}</td><td class="center">${item.quantity}</td><td class="right">${money(item.unit_price)}</td><td class="right">${item.discount_pct ? `${item.discount_pct}%` : "—"}</td><td class="right"><strong>${money(item.line_total)}</strong></td></tr>`).join("");
    const mp = q.mp_process_type || q.mp_process_id ? `<div class="commercial-box"><div class="box-title">Referencia Mercado Público</div><p><strong>${esc(q.mp_process_type || "Proceso de compra")}</strong></p><p>ID / código: ${esc(q.mp_process_id || "Por informar")}</p>${q.mp_delivery_address ? `<p>Despacho: ${esc(q.mp_delivery_address)}</p>` : ""}</div>` : `<div class="commercial-box"><div class="box-title">Proyecto / referencia</div><p><strong>${esc(q.project_title || "Cotización comercial")}</strong></p><p>${esc(q.title || "Oferta de bienes y/o servicios")}</p></div>`;
    return `<article class="commercial-sheet" data-commercial-sheet>
      <header class="commercial-head"><div class="commercial-brand"><img src="assets/img/logo1.jpg" alt="Logo Innova"><div><h1>${esc(c.brand_name)}</h1><p>${esc(c.legal_name)} · RUT ${esc(c.rut)}</p><p>${esc(c.billing_address)} · ${esc(formatPhone(c.phone))}</p><p>${esc(c.email)} · innova-space-edu.cl</p></div></div><div class="commercial-doc-no"><span>Cotización</span><strong>N° ${esc(q.quote_number)}</strong><small>Emisión ${esc(formatDate(q.issue_date))}<br>Válida hasta ${esc(formatDate(q.valid_until))}</small></div></header>
      <section class="commercial-info-grid"><div class="commercial-box"><div class="box-title">Cliente</div><strong>${esc(q.client_name || "—")}</strong><p>RUT ${esc(q.client_rut || "—")}</p><p>${esc(q.client_address || "—")}</p>${q.client_contact ? `<p>Contacto: ${esc(q.client_contact)}</p>` : ""}${q.client_email ? `<p>${esc(q.client_email)}</p>` : ""}${q.client_phone ? `<p>${esc(q.client_phone)}</p>` : ""}</div>${mp}</section>
      ${q.title ? `<div class="commercial-section-title">Propuesta</div><div class="commercial-copy"><strong>${esc(q.title)}</strong></div>` : ""}
      <table><thead><tr><th>#</th><th>Descripción</th><th>Unidad</th><th>Cant.</th><th class="right">Precio unit.</th><th class="right">Desc.</th><th class="right">Total</th></tr></thead><tbody>${itemRows || `<tr><td colspan="7">Sin ítems.</td></tr>`}</tbody></table>
      <div class="commercial-sheet-totals"><span>Subtotal</span><strong>${money(q.subtotal)}</strong>${q.discount ? `<span>Descuento</span><strong>− ${money(q.discount)}</strong>` : ""}<span>Neto</span><strong>${money(q.net_amount)}</strong><span>IVA 19%</span><strong>${money(q.vat_amount)}</strong><span class="total">TOTAL</span><span class="total">${money(q.total_amount)}</span></div>
      ${q.description ? `<div class="commercial-section-title">Descripción / alcance</div><div class="commercial-copy">${esc(q.description)}</div>` : ""}
      <section class="commercial-info-grid" style="margin-top:12px"><div class="commercial-box"><div class="box-title">Condiciones comerciales</div><p><strong>Plazo / entrega:</strong> ${esc(q.delivery_term || "A convenir")}</p><p><strong>Forma de pago:</strong> ${esc(q.payment_terms || "A convenir")}</p><p><strong>Garantía:</strong> ${esc(q.warranty || "Según producto o servicio")}</p></div><div class="commercial-box"><div class="box-title">Términos</div><div class="commercial-copy">${esc(q.conditions || "La cotización es válida hasta la fecha indicada. Cualquier modificación deberá acordarse por escrito entre las partes.")}</div></div></section>
      <div class="commercial-signature"><div><strong>${esc(c.legal_representative)}</strong><br>${esc(c.legal_representative_title)}<br>${esc(c.brand_name)}<br>RUT sociedad ${esc(c.rut)}</div></div>
      <footer class="commercial-footer"><span>${esc(c.brand_name)} · ${esc(c.email)} · ${esc(formatPhone(c.phone))}</span><span class="mp-badge"><i class="ri-government-line"></i> Proveedor activo en Mercado Público</span></footer>
    </article>`;
  }

  async function showPreview(html, filename) {
    const modal = modalShell("Vista previa del documento", "Formato corporativo A4 listo para enviar o guardar en PDF.");
    if (!modal) return;
    modal.querySelector(".modal-body").innerHTML = `<div class="commercial-sheet-wrap">${html}</div>`;
    modal.querySelector(".modal-foot").innerHTML = `<button type="button" class="btn ghost" data-commercial-close-foot>Cerrar</button><button type="button" class="btn primary" data-download-commercial><i class="ri-file-pdf-2-line"></i> Descargar PDF</button>`;
    modal.querySelector("[data-commercial-close-foot]")?.addEventListener("click", closeCommercialModal);
    modal.querySelector("[data-download-commercial]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const sheet = modal.querySelector("[data-commercial-sheet]");
      if (!sheet || typeof window.html2pdf !== "function") { toast("No está disponible el generador PDF.", "error"); return; }
      button.disabled = true;
      button.textContent = "Generando PDF…";
      try {
        await window.html2pdf().set({
          margin: 0,
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] },
        }).from(sheet).save();
      } catch (error) { toast(error.message || "No se pudo generar el PDF.", "error"); }
      finally { button.disabled = false; button.innerHTML = '<i class="ri-file-pdf-2-line"></i> Descargar PDF'; }
    });
  }

  async function openQuoteCreator() {
    const account = await loadUserProfile();
    if (!account || account.status !== "active" || !QUOTE_ROLES.has(account.role)) { toast("No tienes permisos para crear cotizaciones.", "warning"); return; }
    const [company, lookups, nextNumber] = await Promise.all([loadCompanyProfile(), loadLookups(), peekNextQuoteNumber()]);
    const clients = lookups.parties.filter((p) => (p.roles || []).includes("client"));
    const defaultClient = clients.find((p) => String(p.rut || "").replace(/\D/g, "") === "651552036") || clients[0] || null;
    const modal = modalShell(`Nueva cotización N° ${padQuote(nextNumber)}`, "Numeración reservada al guardar. Los datos de Innova se cargan desde Configuración empresarial.");
    if (!modal) return;
    const body = modal.querySelector(".modal-body");
    body.innerHTML = `<form id="commercial-quote-form">
      <section class="commercial-form-section"><h3>Emisor</h3><div class="commercial-form-grid two"><div class="commercial-static-card"><strong>${esc(company.brand_name)}</strong>${esc(company.legal_name)}<br>RUT ${esc(company.rut)}<br>${esc(company.billing_address)}<br>${esc(formatPhone(company.phone))}<br>${esc(company.email)}</div><div class="commercial-static-card"><strong>Firma autorizada</strong>${esc(company.legal_representative)}<br>${esc(company.legal_representative_title)}<br><br><span class="mp-badge"><i class="ri-government-line"></i> Proveedor activo en Mercado Público</span></div></div></section>
      <section class="commercial-form-section"><h3>Cliente y referencia</h3><div class="commercial-form-grid">
        <label class="form-field"><span>Cliente registrado</span><select name="client_party_id">${option("", "Seleccionar cliente")}${clients.map((p) => option(p.id, `${p.name}${p.rut ? ` · ${p.rut}` : ""}`, p.id === defaultClient?.id)).join("")}</select></label>
        <label class="form-field"><span>Proyecto</span><select name="project_id">${option("", "Sin proyecto")}${lookups.projects.map((p) => option(p.id, p.title)).join("")}</select></label>
        <label class="form-field"><span>Número</span><input value="${padQuote(nextNumber)}" disabled><small class="muted">Solo número correlativo.</small></label>
        <label class="form-field"><span>Cliente / institución</span><input name="client_name" required value="${esc(defaultClient?.name || "Colegio Providencia")}"></label>
        <label class="form-field"><span>RUT cliente</span><input name="client_rut" value="${esc(defaultClient?.rut || "65.155.203-6")}"></label>
        <label class="form-field"><span>Dirección</span><input name="client_address" value="${esc(defaultClient ? [defaultClient.address, defaultClient.city].filter(Boolean).join(", ") : "Manuel Antonio Matta 3205, Antofagasta")}"></label>
        <label class="form-field"><span>Contacto</span><input name="client_contact" value="${esc(defaultClient?.contact_name || "")}"></label>
        <label class="form-field"><span>Correo cliente</span><input type="email" name="client_email" value="${esc(defaultClient?.email || "")}"></label>
        <label class="form-field"><span>Teléfono cliente</span><input name="client_phone" value="${esc(defaultClient?.phone || "")}"></label>
        <label class="form-field"><span>Fecha emisión</span><input type="date" name="issue_date" required value="${localISODate()}"></label>
        <label class="form-field"><span>Válida hasta</span><input type="date" name="valid_until" value="${addDaysISO(10)}"></label>
        <label class="form-field"><span>Título de la propuesta</span><input name="title" placeholder="Ej.: Equipamiento tecnológico para sala de clases"></label>
      </div></section>
      <section class="commercial-form-section"><h3>Mercado Público / despacho</h3><div class="commercial-form-grid">
        <label class="form-field"><span>Tipo de proceso</span><select name="mp_process_type">${[["","Sin referencia"],["Compra Ágil","Compra Ágil"],["Licitación Pública","Licitación Pública"],["Trato Directo","Trato Directo"],["Convenio Marco","Convenio Marco"],["Otro","Otro"]].map(([v,t]) => option(v,t)).join("")}</select></label>
        <label class="form-field"><span>ID / código del proceso</span><input name="mp_process_id" placeholder="Ej.: 1234-56-COT26"></label>
        <label class="form-field"><span>Dirección de despacho</span><input name="mp_delivery_address" placeholder="Dirección de entrega"></label>
      </div></section>
      <section class="commercial-form-section"><h3>Productos y servicios</h3>${commercialItemsTable()}</section>
      <section class="commercial-form-section"><h3>Descripción y condiciones</h3><div class="commercial-form-grid two">
        <label class="form-field full"><span>Descripción / alcance</span><textarea name="description" rows="4" placeholder="Describe el proyecto, servicio o suministro incluido en la oferta."></textarea></label>
        <label class="form-field"><span>Plazo y condiciones de entrega</span><textarea name="delivery_term" rows="3" placeholder="Ej.: 15 días hábiles desde aceptación de OC."></textarea></label>
        <label class="form-field"><span>Forma de pago</span><textarea name="payment_terms" rows="3" placeholder="Ej.: 30 días contra factura y recepción conforme."></textarea></label>
        <label class="form-field"><span>Garantía</span><textarea name="warranty" rows="3" placeholder="Garantía de productos, instalación o servicio."></textarea></label>
        <label class="form-field"><span>Términos y condiciones</span><textarea name="conditions" rows="3">La cotización es válida hasta la fecha indicada. Cualquier modificación o cambio en el proyecto o servicio deberá ser acordado por escrito entre las partes. La aceptación de la cotización implica la aceptación de las condiciones establecidas en este documento.</textarea></label>
      </div></section><div class="commercial-message" id="quote-commercial-message"></div>
    </form>`;
    const form = body.querySelector("#commercial-quote-form");
    const tbody = form.querySelector("[data-items-body]");
    addItemRow(tbody);
    bindItemTable(form);
    updateItemTotals(tbody, form);
    form.elements.namedItem("client_party_id")?.addEventListener("change", (event) => { const party = clients.find((p) => p.id === event.target.value); if (party) readPartyIntoForm(form, party); });
    form.elements.namedItem("project_id")?.addEventListener("change", (event) => { const project = lookups.projects.find((p) => p.id === event.target.value); if (!project?.client_party_id) return; const party = clients.find((p) => p.id === project.client_party_id); if (party) { form.elements.namedItem("client_party_id").value = party.id; readPartyIntoForm(form, party); } });

    const footer = modal.querySelector(".modal-foot");
    footer.innerHTML = `<button type="button" class="btn ghost" data-commercial-cancel>Cancelar</button><button type="button" class="btn ghost" data-preview-quote><i class="ri-eye-line"></i> Vista previa</button><button type="button" class="btn ghost" data-save-quote="draft"><i class="ri-save-line"></i> Guardar borrador</button><button type="button" class="btn primary" data-save-quote="sent"><i class="ri-send-plane-line"></i> Guardar cotización</button>`;
    footer.querySelector("[data-commercial-cancel]")?.addEventListener("click", closeCommercialModal);
    footer.querySelector("[data-preview-quote]")?.addEventListener("click", async () => {
      const snapshot = quoteSnapshot(form, tbody, nextNumber, company);
      if (!snapshot.client_name || !snapshot.items.length) { toast("Completa el cliente y al menos un ítem para la vista previa.", "warning"); return; }
      await showPreview(buildQuoteHtml(snapshot), `Cotizacion-${snapshot.quote_number}.pdf`);
    });
    footer.querySelectorAll("[data-save-quote]").forEach((button) => button.addEventListener("click", async () => {
      const message = body.querySelector("#quote-commercial-message");
      const snapshot = quoteSnapshot(form, tbody, nextNumber, company);
      if (!snapshot.client_name || !snapshot.issue_date || !snapshot.items.length) { if (message) message.textContent = "Completa cliente, fecha y al menos un ítem."; return; }
      button.disabled = true;
      const old = button.innerHTML;
      button.textContent = "Guardando…";
      try {
        const reserved = await reserveQuoteNumber();
        const quoteNumber = padQuote(reserved);
        const fd = new FormData(form);
        const payload = {
          direction: "sale",
          quote_number: quoteNumber,
          project_id: String(fd.get("project_id") || "") || null,
          client_party_id: String(fd.get("client_party_id") || "") || null,
          party_id: String(fd.get("client_party_id") || "") || null,
          client_name: snapshot.client_name,
          client_rut: snapshot.client_rut || null,
          issue_date: snapshot.issue_date,
          valid_until: snapshot.valid_until || null,
          status: button.dataset.saveQuote === "sent" ? "sent" : "draft",
          items: snapshot.items,
          subtotal: snapshot.subtotal,
          discount: snapshot.discount,
          net_amount: snapshot.net_amount,
          vat_rate: 19,
          vat_amount: snapshot.vat_amount,
          total_amount: snapshot.total_amount,
          notes: snapshot.description || null,
          metadata: {
            document_schema: "innova_commercial_v2",
            company_snapshot: { brand_name: company.brand_name, legal_name: company.legal_name, rut: company.rut, billing_address: company.billing_address, phone: company.phone, email: company.email },
            client: { address: snapshot.client_address, contact: snapshot.client_contact, email: snapshot.client_email, phone: snapshot.client_phone },
            title: snapshot.title,
            delivery_term: snapshot.delivery_term,
            payment_terms: snapshot.payment_terms,
            warranty: snapshot.warranty,
            conditions: snapshot.conditions,
            mercado_publico: { process_type: snapshot.mp_process_type, process_id: snapshot.mp_process_id, delivery_address: snapshot.mp_delivery_address },
          },
        };
        const rows = await rest("company_quotations", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) });
        const saved = Array.isArray(rows) ? rows[0] : null;
        const finalSnapshot = { ...snapshot, quote_number: saved?.quote_number || quoteNumber };
        closeCommercialModal();
        toast(`Cotización N° ${finalSnapshot.quote_number} guardada.`);
        await showPreview(buildQuoteHtml(finalSnapshot), `Cotizacion-${finalSnapshot.quote_number}.pdf`);
        setTimeout(refreshCurrentView, 350);
      } catch (error) {
        if (message) message.textContent = error.message || "No se pudo guardar la cotización.";
        button.disabled = false;
        button.innerHTML = old;
      }
    }));
  }

  function parseDateCL(value = "") {
    const m = String(value).match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})/);
    return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
  }

  function amountCL(value = "") { return Number(String(value).replace(/[^0-9]/g, "")) || 0; }

  async function extractPdfText(file) {
    if (!window.pdfjsLib) throw new Error("PDF.js no está disponible.");
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    let text = "";
    for (let p = 1; p <= Math.min(pdf.numPages, 60); p += 1) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      text += content.items.map((item) => item.str).join(" ") + "\n";
      if (text.length > 180000) break;
    }
    return text;
  }

  function parseMercadoPublicoOc(text = "") {
    const t = String(text).replace(/\s+/g, " ").trim();
    const order = t.match(/N[uú]mero\s+de\s+la\s+Orden\s+de\s+Compra\s+([A-Z0-9-]+)/i) || t.match(/Orden\s+de\s+Compra\.?\s*N[°º]\s*([A-Z0-9-]+)/i);
    const issue = t.match(/Fecha\s+de\s+Env[ií]o\s+(\d{1,2}[-/.]\d{1,2}[-/.]20\d{2})/i);
    const delivery = t.match(/Fecha\s+de\s+Entrega\s+(\d{1,2}[-/.]\d{1,2}[-/.]20\d{2})/i);
    const net = t.match(/Total\s+Neto\s*\$?\s*([0-9.]+)/i);
    const vat = t.match(/IVA\s*19\s*%?\s*\$?\s*([0-9.]+)/i);
    const total = t.match(/TOTAL\s+OC\s*\$?\s*([0-9.]+)/i);
    const payment = t.match(/Plazo\s+de\s+Pago\s+(.+?)(?=Moneda|Raz[oó]n\s+Social|Direcci[oó]n|4\s*\.-|$)/i);
    const buyerSection = t.match(/Datos\s+del\s+Comprador(.+?)(?=Datos\s+de\s+Pago|3\s*\.-)/i)?.[1] || "";
    const buyerRut = buyerSection.match(/R\.?U\.?T\.?\s*([0-9.]+-[0-9Kk])/i)?.[1] || "";
    const buyerName = buyerSection.match(/Raz[oó]n\s+Social\s+(.+?)(?=R\.?U\.?T\.?|Direcci[oó]n|$)/i)?.[1]?.trim() || "";
    return { order_number: order?.[1] || "", issue_date: parseDateCL(issue?.[1] || ""), expected_date: parseDateCL(delivery?.[1] || ""), net_amount: amountCL(net?.[1] || ""), vat_amount: amountCL(vat?.[1] || ""), total_amount: amountCL(total?.[1] || ""), payment_terms: payment?.[1]?.trim() || "", buyer_rut: buyerRut, buyer_name: buyerName };
  }

  async function uploadOcSource(file, data) {
    if (!file) return null;
    const safeName = String(file.name || "orden-compra.pdf").replace(/[^a-zA-Z0-9._-]+/g, "-");
    const now = new Date();
    const path = `purchase_orders/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}-${safeName}`;
    await storageFetch(`object/${enc(cfg.storageBucket || "company-files")}/${path.split("/").map(enc).join("/")}`, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" }, body: file });
    try {
      const rows = await rest("company_files", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ project_id: data.project_id || null, party_id: data.party_id || null, category: "purchase_order", title: `Orden de compra ${data.order_number}`, original_name: file.name, storage_path: path, mime_type: file.type || null, file_size: file.size || 0, occurred_at: data.issue_date ? `${data.issue_date}T12:00:00-04:00` : null, metadata: { source: "commercial_documents_v2", mercado_publico: true } }) });
      return Array.isArray(rows) ? rows[0] : null;
    } catch (error) {
      try { await storageFetch(`object/${enc(cfg.storageBucket || "company-files")}/${path.split("/").map(enc).join("/")}`, { method: "DELETE" }); } catch (_) {}
      throw error;
    }
  }

  function ocSnapshot(form, tbody, company) {
    const fd = new FormData(form);
    const calc = updateItemTotals(tbody, form.closest(".modal") || form);
    return {
      order_number: String(fd.get("order_number") || "").trim(), issue_date: String(fd.get("issue_date") || ""), expected_date: String(fd.get("expected_date") || ""), status: String(fd.get("status") || "received"),
      buyer_name: String(fd.get("buyer_name") || "").trim(), buyer_rut: String(fd.get("buyer_rut") || "").trim(), buyer_address: String(fd.get("buyer_address") || "").trim(), buyer_contact: String(fd.get("buyer_contact") || "").trim(), buyer_email: String(fd.get("buyer_email") || "").trim(), buyer_phone: String(fd.get("buyer_phone") || "").trim(),
      project_title: String(form.querySelector('[name="project_id"] option:checked')?.textContent || "Sin proyecto"), quotation_text: String(form.querySelector('[name="quotation_id"] option:checked')?.textContent || "Sin cotización vinculada"),
      process_type: String(fd.get("process_type") || "").trim(), process_id: String(fd.get("process_id") || "").trim(), buyer_unit: String(fd.get("buyer_unit") || "").trim(), billing_address: String(fd.get("billing_address") || "").trim(), shipping_address: String(fd.get("shipping_address") || "").trim(), payment_terms: String(fd.get("payment_terms") || "").trim(), notes: String(fd.get("notes") || "").trim(),
      items: calc.items, net_amount: calc.net, vat_amount: calc.vat, total_amount: calc.total, company,
    };
  }

  function buildOcReceiptHtml(o) {
    const c = o.company || DEFAULT_PROFILE;
    const rows = (o.items || []).map((item, index) => `<tr><td class="center">${index + 1}</td><td>${esc(item.description)}</td><td>${esc(item.unit)}</td><td class="center">${item.quantity}</td><td class="right">${money(item.unit_price)}</td><td class="right"><strong>${money(item.line_total)}</strong></td></tr>`).join("");
    return `<article class="commercial-sheet" data-commercial-sheet><header class="commercial-head"><div class="commercial-brand"><img src="assets/img/logo1.jpg" alt="Logo Innova"><div><h1>${esc(c.brand_name)}</h1><p>${esc(c.legal_name)} · RUT ${esc(c.rut)}</p><p>${esc(c.billing_address)} · ${esc(c.email)}</p></div></div><div class="commercial-doc-no"><span>Ficha interna · OC recibida</span><strong>${esc(o.order_number || "Sin número")}</strong><small>Recibida / emitida ${esc(formatDate(o.issue_date))}</small></div></header>
      <div style="margin-top:12px"><span class="commercial-internal-badge">REGISTRO INTERNO — NO REEMPLAZA LA OC OFICIAL DEL COMPRADOR</span></div>
      <section class="commercial-info-grid"><div class="commercial-box"><div class="box-title">Organismo / cliente comprador</div><strong>${esc(o.buyer_name || "—")}</strong><p>RUT ${esc(o.buyer_rut || "—")}</p><p>${esc(o.buyer_address || "—")}</p>${o.buyer_unit ? `<p>Unidad de compra: ${esc(o.buyer_unit)}</p>` : ""}${o.buyer_contact ? `<p>Contacto: ${esc(o.buyer_contact)}</p>` : ""}</div><div class="commercial-box"><div class="box-title">Referencia</div><p><strong>${esc(o.process_type || "Mercado Público")}</strong></p><p>ID proceso: ${esc(o.process_id || "—")}</p><p>Proyecto: ${esc(o.project_title || "—")}</p><p>Entrega comprometida: ${esc(formatDate(o.expected_date))}</p></div></section>
      <table><thead><tr><th>#</th><th>Producto / servicio</th><th>Unidad</th><th>Cant.</th><th class="right">Precio unit.</th><th class="right">Total</th></tr></thead><tbody>${rows || `<tr><td colspan="6">Detalle según orden de compra oficial adjunta.</td></tr>`}</tbody></table>
      <div class="commercial-sheet-totals"><span>Neto</span><strong>${money(o.net_amount)}</strong><span>IVA 19%</span><strong>${money(o.vat_amount)}</strong><span class="total">TOTAL OC</span><span class="total">${money(o.total_amount)}</span></div>
      <section class="commercial-info-grid"><div class="commercial-box"><div class="box-title">Pago y facturación</div><p>${esc(o.payment_terms || "Según condiciones de la OC recibida")}</p>${o.billing_address ? `<p>Facturación: ${esc(o.billing_address)}</p>` : ""}</div><div class="commercial-box"><div class="box-title">Despacho / observaciones</div>${o.shipping_address ? `<p>Despacho: ${esc(o.shipping_address)}</p>` : ""}<div class="commercial-copy">${esc(o.notes || "Sin observaciones internas.")}</div></div></section>
      <footer class="commercial-footer"><span>${esc(c.brand_name)} · seguimiento interno de órdenes recibidas</span><span class="mp-badge"><i class="ri-government-line"></i> Mercado Público / ChileCompra</span></footer></article>`;
  }

  async function openReceivedOcCreator() {
    const account = await loadUserProfile();
    if (!account || account.status !== "active" || !OC_ROLES.has(account.role)) { toast("No tienes permisos para registrar órdenes de compra.", "warning"); return; }
    const [company, lookups] = await Promise.all([loadCompanyProfile(), loadLookups()]);
    const clients = lookups.parties.filter((p) => (p.roles || []).includes("client"));
    const defaultClient = clients.find((p) => String(p.rut || "").replace(/\D/g, "") === "651552036") || clients[0] || null;
    const modal = modalShell("Registrar orden de compra recibida", "Este módulo registra OCs emitidas por clientes/organismos hacia Innova. No genera órdenes de compra a proveedores.");
    if (!modal) return;
    const body = modal.querySelector(".modal-body");
    body.innerHTML = `<form id="received-oc-form">
      <section class="commercial-form-section"><h3>Proveedor receptor</h3><div class="commercial-static-card"><strong>${esc(company.brand_name)}</strong>${esc(company.legal_name)} · RUT ${esc(company.rut)}<br>${esc(company.billing_address)} · ${esc(company.email)} · ${esc(formatPhone(company.phone))}</div></section>
      <section class="commercial-form-section"><h3>Orden recibida</h3><div class="commercial-form-grid">
        <label class="form-field"><span>Número OC</span><input name="order_number" required placeholder="Ej.: 1234-56-AG26"></label>
        <label class="form-field"><span>Fecha emisión / envío</span><input type="date" name="issue_date" required value="${localISODate()}"></label>
        <label class="form-field"><span>Fecha esperada de entrega</span><input type="date" name="expected_date"></label>
        <label class="form-field"><span>Estado</span><select name="status">${[["received","Recibida"],["approved","Aceptada / aprobada"],["partial","Entrega parcial"],["completed","Completada"],["cancelled","Cancelada"]].map(([v,t]) => option(v,t,v === "received")).join("")}</select></label>
        <label class="form-field"><span>Proyecto</span><select name="project_id">${option("", "Sin proyecto")}${lookups.projects.map((p) => option(p.id,p.title)).join("")}</select></label>
        <label class="form-field"><span>Cotización relacionada</span><select name="quotation_id">${option("", "Sin cotización vinculada")}${lookups.quotations.map((q) => option(q.id, `N° ${q.quote_number} · ${q.client_name} · ${money(q.total_amount)}`)).join("")}</select></label>
        <label class="form-field full"><span>PDF / archivo original de la OC</span><input type="file" name="source_file" accept=".pdf,.xml,.png,.jpg,.jpeg"><small class="muted">El archivo original se guarda en Archivo empresarial y queda vinculado a esta OC.</small></label>
      </div><div class="commercial-read-result" data-oc-read-result></div><button type="button" class="btn ghost" data-read-oc><i class="ri-scan-2-line"></i> Leer datos del PDF</button></section>
      <section class="commercial-form-section"><h3>Organismo / cliente comprador</h3><div class="commercial-form-grid">
        <label class="form-field"><span>Cliente registrado</span><select name="party_id">${option("", "Seleccionar cliente")}${clients.map((p) => option(p.id, `${p.name}${p.rut ? ` · ${p.rut}` : ""}`, p.id === defaultClient?.id)).join("")}</select></label>
        <label class="form-field"><span>Razón social / institución</span><input name="buyer_name" required value="${esc(defaultClient?.name || "Colegio Providencia")}"></label>
        <label class="form-field"><span>RUT comprador</span><input name="buyer_rut" value="${esc(defaultClient?.rut || "65.155.203-6")}"></label>
        <label class="form-field"><span>Dirección</span><input name="buyer_address" value="${esc(defaultClient ? [defaultClient.address, defaultClient.city].filter(Boolean).join(", ") : "Manuel Antonio Matta 3205, Antofagasta")}"></label>
        <label class="form-field"><span>Unidad de compra</span><input name="buyer_unit"></label><label class="form-field"><span>Contacto</span><input name="buyer_contact" value="${esc(defaultClient?.contact_name || "")}"></label>
        <label class="form-field"><span>Correo</span><input type="email" name="buyer_email" value="${esc(defaultClient?.email || "")}"></label><label class="form-field"><span>Teléfono</span><input name="buyer_phone" value="${esc(defaultClient?.phone || "")}"></label>
      </div></section>
      <section class="commercial-form-section"><h3>Mercado Público y condiciones</h3><div class="commercial-form-grid">
        <label class="form-field"><span>Tipo de proceso</span><select name="process_type">${[["Mercado Público","Mercado Público"],["Compra Ágil","Compra Ágil"],["Licitación Pública","Licitación Pública"],["Trato Directo","Trato Directo"],["Convenio Marco","Convenio Marco"],["Otro","Otro"]].map(([v,t]) => option(v,t,v === "Mercado Público")).join("")}</select></label>
        <label class="form-field"><span>ID proceso / cotización MP</span><input name="process_id" placeholder="Ej.: 1234-56-COT26"></label>
        <label class="form-field"><span>Plazo / forma de pago</span><input name="payment_terms" placeholder="Ej.: 30 días contra recepción conforme"></label>
        <label class="form-field"><span>Dirección de facturación</span><input name="billing_address"></label><label class="form-field"><span>Dirección de despacho</span><input name="shipping_address"></label>
        <label class="form-field full"><span>Observaciones</span><textarea name="notes" rows="3"></textarea></label>
      </div></section>
      <section class="commercial-form-section"><h3>Productos / servicios de la OC</h3>${commercialItemsTable()}</section><div class="commercial-message" id="oc-commercial-message"></div>
    </form>`;
    const form = body.querySelector("#received-oc-form");
    const tbody = form.querySelector("[data-items-body]");
    addItemRow(tbody, { description: "Según orden de compra recibida", unit: "Unidad", quantity: 1, unit_price: 0 });
    bindItemTable(form);
    updateItemTotals(tbody, form);
    form.elements.namedItem("party_id")?.addEventListener("change", (event) => { const party = clients.find((p) => p.id === event.target.value); if (party) readPartyIntoForm(form, party); });
    form.querySelector("[data-read-oc]")?.addEventListener("click", async (event) => {
      const file = form.elements.namedItem("source_file")?.files?.[0];
      const result = form.querySelector("[data-oc-read-result]");
      if (!file || !/pdf/i.test(file.type || file.name)) { if (result) result.textContent = "Selecciona un PDF de la orden de compra."; return; }
      event.currentTarget.disabled = true;
      if (result) result.textContent = "Leyendo orden de compra…";
      try {
        const parsed = parseMercadoPublicoOc(await extractPdfText(file));
        [["order_number",parsed.order_number],["issue_date",parsed.issue_date],["expected_date",parsed.expected_date],["buyer_name",parsed.buyer_name],["buyer_rut",parsed.buyer_rut],["payment_terms",parsed.payment_terms]].forEach(([name,value]) => { if (value && form.elements.namedItem(name)) form.elements.namedItem(name).value = value; });
        const matching = clients.find((p) => String(p.rut || "").replace(/\D/g, "") === String(parsed.buyer_rut || "").replace(/\D/g, ""));
        if (matching) { form.elements.namedItem("party_id").value = matching.id; readPartyIntoForm(form, matching); }
        if (parsed.total_amount) {
          const row = tbody.querySelector("tr[data-item-row]");
          if (row) { row.querySelector('[name="description"]').value = "Según detalle de OC adjunta"; row.querySelector('[name="quantity"]').value = "1"; row.querySelector('[name="unit_price"]').value = String(parsed.net_amount || Math.round(parsed.total_amount / 1.19)); updateItemTotals(tbody, form); }
        }
        if (result) result.textContent = `Lectura completada${parsed.order_number ? ` · OC ${parsed.order_number}` : ""}${parsed.total_amount ? ` · total ${money(parsed.total_amount)}` : ""}. Revisa antes de guardar.`;
      } catch (error) { if (result) result.textContent = error.message || "No se pudo leer el PDF."; }
      finally { event.currentTarget.disabled = false; }
    });

    const footer = modal.querySelector(".modal-foot");
    footer.innerHTML = `<button type="button" class="btn ghost" data-commercial-cancel>Cancelar</button><button type="button" class="btn ghost" data-preview-oc><i class="ri-eye-line"></i> Vista previa interna</button><button type="button" class="btn primary" data-save-oc><i class="ri-inbox-archive-line"></i> Registrar OC recibida</button>`;
    footer.querySelector("[data-commercial-cancel]")?.addEventListener("click", closeCommercialModal);
    footer.querySelector("[data-preview-oc]")?.addEventListener("click", async () => { const snapshot = ocSnapshot(form, tbody, company); if (!snapshot.order_number || !snapshot.buyer_name) { toast("Completa número de OC y comprador.", "warning"); return; } await showPreview(buildOcReceiptHtml(snapshot), `Ficha-OC-${snapshot.order_number}.pdf`); });
    footer.querySelector("[data-save-oc]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const message = body.querySelector("#oc-commercial-message");
      const snapshot = ocSnapshot(form, tbody, company);
      if (!snapshot.order_number || !snapshot.issue_date || !snapshot.buyer_name) { if (message) message.textContent = "Completa número de OC, fecha y organismo comprador."; return; }
      button.disabled = true; button.textContent = "Registrando…";
      try {
        const existing = await rest(`company_purchase_orders?select=id&order_number=eq.${enc(snapshot.order_number)}&limit=1`);
        if (Array.isArray(existing) && existing.length) throw new Error("Esta orden de compra ya está registrada.");
        const fd = new FormData(form);
        const base = { project_id: String(fd.get("project_id") || "") || null, party_id: String(fd.get("party_id") || "") || null, order_number: snapshot.order_number, issue_date: snapshot.issue_date };
        const source = await uploadOcSource(form.elements.namedItem("source_file")?.files?.[0] || null, base);
        const payload = {
          direction: "customer", order_number: snapshot.order_number, party_id: base.party_id, project_id: base.project_id, quotation_id: String(fd.get("quotation_id") || "") || null,
          issue_date: snapshot.issue_date, expected_date: snapshot.expected_date || null, status: snapshot.status || "received", items: snapshot.items,
          net_amount: snapshot.net_amount, vat_amount: snapshot.vat_amount, total_amount: snapshot.total_amount, source_file_id: source?.id || null, notes: snapshot.notes || null,
          metadata: { document_schema: "received_purchase_order_v2", buyer: { name: snapshot.buyer_name, rut: snapshot.buyer_rut, address: snapshot.buyer_address, unit: snapshot.buyer_unit, contact: snapshot.buyer_contact, email: snapshot.buyer_email, phone: snapshot.buyer_phone }, mercado_publico: { process_type: snapshot.process_type, process_id: snapshot.process_id }, payment_terms: snapshot.payment_terms, billing_address: snapshot.billing_address, shipping_address: snapshot.shipping_address },
        };
        await rest("company_purchase_orders", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) });
        closeCommercialModal(); toast(`OC ${snapshot.order_number} registrada.`); await showPreview(buildOcReceiptHtml(snapshot), `Ficha-OC-${snapshot.order_number}.pdf`); setTimeout(refreshCurrentView, 350);
      } catch (error) { if (message) message.textContent = error.message || "No se pudo registrar la orden de compra."; button.disabled = false; button.innerHTML = '<i class="ri-inbox-archive-line"></i> Registrar OC recibida'; }
    });
  }

  function currentCommercialPage() {
    const title = normalize(`${document.getElementById("view-title")?.textContent || ""} ${document.getElementById("main-content")?.querySelector("h2")?.textContent || ""}`);
    if (title.includes("cotizaciones")) return "quotations";
    if (title.includes("ordenes de compra") || title.includes("orden de compra")) return "purchase_orders";
    return "";
  }

  function hideLegacyCreateButtons(page) {
    const main = document.getElementById("main-content");
    if (!main) return;
    const pattern = page === "quotations" ? /(nueva|crear|agregar).*cotiz/i : /(nueva|crear|agregar|registrar).*orden.*compra/i;
    main.querySelectorAll("button,a.btn").forEach((el) => {
      if (el.dataset.commercialAction) return;
      if (pattern.test(String(el.textContent || "").trim())) { el.style.display = "none"; el.dataset.commercialLegacyHidden = "true"; }
    });
  }

  async function enhancePage() {
    ensureStyles();
    const main = document.getElementById("main-content");
    if (!main || !main.childElementCount) return;
    const page = currentCommercialPage();
    if (!page) return;
    hideLegacyCreateButtons(page);
    if (main.querySelector(`[data-commercial-toolbar="${page}"]`)) return;
    const account = await loadUserProfile().catch(() => null);
    const allowed = page === "quotations" ? QUOTE_ROLES.has(account?.role) : OC_ROLES.has(account?.role);
    if (!allowed || account?.status !== "active") return;
    const toolbar = document.createElement("section");
    toolbar.className = "commercial-toolbar";
    toolbar.dataset.commercialToolbar = page;
    if (page === "quotations") {
      const next = await peekNextQuoteNumber().catch(() => 34);
      toolbar.innerHTML = `<div class="commercial-toolbar-copy"><div class="commercial-toolbar-icon"><i class="ri-file-list-3-line"></i></div><div><strong>Cotizaciones profesionales Innova</strong><small>Logo, datos legales, cliente, ítems numerados, IVA, condiciones, firma y Mercado Público. Próximo número: ${padQuote(next)}.</small></div></div><div class="commercial-toolbar-actions"><button class="btn primary" type="button" data-commercial-action="new-quote"><i class="ri-add-line"></i> Nueva cotización</button></div>`;
    } else {
      toolbar.innerHTML = `<div class="commercial-toolbar-copy"><div class="commercial-toolbar-icon"><i class="ri-shopping-bag-3-line"></i></div><div><strong>Órdenes de compra recibidas</strong><small>Registra únicamente OCs emitidas por clientes u organismos hacia Innova; permite adjuntar y leer el PDF de Mercado Público.</small></div></div><div class="commercial-toolbar-actions"><button class="btn primary" type="button" data-commercial-action="new-oc"><i class="ri-inbox-archive-line"></i> Registrar OC recibida</button></div>`;
    }
    main.prepend(toolbar);
  }

  function refreshCurrentView() {
    const active = document.querySelector("#side-nav .nav-item.active");
    if (active) { active.click(); return; }
    const page = currentCommercialPage();
    const targetText = page === "quotations" ? "cotizaciones" : "ordenes de compra";
    const target = [...document.querySelectorAll("#side-nav .nav-item")].find((el) => normalize(el.textContent).includes(targetText));
    target?.click();
  }

  document.addEventListener("click", (event) => {
    const action = event.target.closest?.("[data-commercial-action]")?.dataset.commercialAction;
    if (action === "new-quote") { event.preventDefault(); event.stopPropagation(); openQuoteCreator().catch((error) => toast(error.message || "No se pudo abrir la cotización.", "error")); }
    if (action === "new-oc") { event.preventDefault(); event.stopPropagation(); openReceivedOcCreator().catch((error) => toast(error.message || "No se pudo abrir la orden de compra.", "error")); }
  }, true);

  const main = document.getElementById("main-content");
  if (main) new MutationObserver(() => { clearTimeout(enhanceTimer); enhanceTimer = setTimeout(() => enhancePage().catch(console.warn), 220); }).observe(main, { childList: true, subtree: true });
  window.addEventListener("innova-record-manager-ready", () => setTimeout(() => enhancePage().catch(console.warn), 250), { once: true });
  setTimeout(() => enhancePage().catch(console.warn), 900);

  window.InnovaCommercialDocuments = Object.freeze({ openQuoteCreator, openReceivedOcCreator });
})();
