(() => {
  'use strict';

  if (window.__INNOVA_SHARED_DASHBOARD_SYNC__) return;
  window.__INNOVA_SHARED_DASHBOARD_SYNC__ = true;

  const STORAGE_KEY = 'innova:dashboard-period:v1';
  const REFRESH_MS = 60000;
  const page = document.getElementById('admin-app') ? 'admin' : (document.getElementById('accounting-app') ? 'contador' : '');
  if (!page) return;

  const db = window.getInnovaAdminSupabaseClient?.() || window.INNOVA_ADMIN_SUPABASE_CLIENT;
  if (!db) {
    console.warn('Dashboard Sync: cliente Supabase no disponible.');
    return;
  }

  const CONFIG = {
    company_projects: { limit: 1200 },
    company_files: { limit: 2000 },
    company_documents: { limit: 700 },
    company_quotations: { limit: 1000 },
    company_purchase_orders: { limit: 1000 },
    company_invoices: { limit: 1600 },
    company_transactions: { limit: 1600 },
    company_bank_movements: { limit: 1800 },
    company_tax_records: { limit: 1000 },
    company_project_events: { limit: 1200 },
    company_deadlines: { limit: 900 },
    company_alerts: { limit: 900 },
    company_service_cases: { limit: 900 },
    company_contracts: { limit: 900 },
    company_approvals: { limit: 900 },
    company_assets: { limit: 1200 },
    company_employees: { limit: 700 },
    company_activity: { limit: 500 },
  };

  const REALTIME_TABLES = [
    'company_projects', 'company_files', 'company_invoices', 'company_transactions',
    'company_bank_movements', 'company_tax_records', 'company_project_events',
    'company_deadlines', 'company_alerts', 'company_purchase_orders', 'company_quotations',
  ];

  const LABELS = {
    company_projects: 'Proyectos',
    company_files: 'Archivos',
    company_documents: 'Documentos',
    company_quotations: 'Cotizaciones',
    company_purchase_orders: 'Órdenes de compra',
    company_invoices: 'Facturas / DTE',
    company_transactions: 'Transacciones',
    company_bank_movements: 'Movimientos bancarios',
    company_tax_records: 'Registros tributarios',
    company_project_events: 'Eventos de proyecto',
    company_deadlines: 'Plazos',
    company_alerts: 'Alertas',
    company_service_cases: 'Casos / postventa',
    company_contracts: 'Contratos',
    company_approvals: 'Aprobaciones',
    company_assets: 'Activos',
    company_employees: 'Personal',
    company_activity: 'Actividad',
  };

  const state = {
    period: '',
    data: {},
    errors: {},
    loading: false,
    syncedAt: null,
    timer: null,
    debounce: null,
    channel: null,
    renderGuard: false,
  };

  const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const int = (value) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(num(value));
  const money = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(num(value));
  const pct = (value) => `${Math.round(num(value))}%`;
  const lower = (value) => String(value ?? '').trim().toLowerCase();
  const currentMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const validPeriod = (value) => /^\d{4}-\d{2}$/.test(String(value || ''));
  const toDate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const dateKey = (value) => {
    if (!value) return '';
    const raw = String(value).trim();
    const match = raw.match(/^(\d{4})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}`;
    const d = toDate(value);
    return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : '';
  };
  const rowPeriod = (row, fields) => {
    for (const field of fields) {
      const key = dateKey(row?.[field]);
      if (key) return key;
    }
    return '';
  };
  const inPeriod = (row, fields, period = state.period) => rowPeriod(row, fields) === period;
  const sum = (rows, field, mapper) => (rows || []).reduce((acc, row) => acc + (mapper ? mapper(row) : num(row?.[field])), 0);
  const signedDte = (row, field = 'total_amount') => (String(row?.dte_type || '') === '61' ? -1 : 1) * num(row?.[field]);
  const isOpenStatus = (value) => !['completed', 'cancelled', 'closed', 'resolved', 'paid', 'filed', 'archived', 'approved', 'done', 'not_applicable'].includes(lower(value));
  const isoDay = (date) => {
    if (!date) return '';
    const d = toDate(date);
    return d ? d.toISOString().slice(0, 10) : '';
  };
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const formatDate = (value) => {
    const d = toDate(value);
    return d ? d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  };

  function mainRoot() {
    return document.getElementById(page === 'admin' ? 'main-content' : 'main');
  }

  function isDashboardActive() {
    if (page === 'admin') return !!document.querySelector('[data-ceo-view="dashboard"].active');
    return !!document.querySelector('[data-view="dashboard"].active');
  }

  function readInitialPeriod() {
    const stored = localStorage.getItem(STORAGE_KEY);
    const contadorPeriod = document.getElementById('global-period')?.value;
    if (validPeriod(stored)) return stored;
    if (validPeriod(contadorPeriod)) return contadorPeriod;
    return currentMonth();
  }

  function setPeriod(value, { source = 'dashboard', dispatch = true } = {}) {
    if (!validPeriod(value) || value === state.period) return;
    state.period = value;
    localStorage.setItem(STORAGE_KEY, value);

    const global = document.getElementById('global-period');
    if (global && global.value !== value) {
      global.value = value;
      if (dispatch && source !== 'contador-control') global.dispatchEvent(new Event('change', { bubbles: true }));
    }
    render();
    reload({ reason: 'period' });
  }

  async function readTable(table, limit) {
    try {
      const { data, error } = await db.from(table).select('*').limit(limit);
      if (error) throw error;
      return { data: Array.isArray(data) ? data : [], error: null };
    } catch (error) {
      return { data: [], error: String(error?.message || error || 'Error desconocido') };
    }
  }

  async function reload({ reason = 'manual' } = {}) {
    if (state.loading) return;
    const session = (await db.auth.getSession()).data?.session;
    if (!session?.user) return;
    state.loading = true;
    renderStatus();
    try {
      const entries = Object.entries(CONFIG);
      const results = await Promise.all(entries.map(([table, cfg]) => readTable(table, cfg.limit)));
      state.data = {};
      state.errors = {};
      entries.forEach(([table], index) => {
        state.data[table] = results[index].data;
        if (results[index].error) state.errors[table] = results[index].error;
      });
      state.syncedAt = new Date();
      render();
      window.dispatchEvent(new CustomEvent('innova-dashboard-synced', {
        detail: { period: state.period, at: state.syncedAt, page, reason, errors: Object.keys(state.errors) },
      }));
    } finally {
      state.loading = false;
      renderStatus();
    }
  }

  function metrics() {
    const d = state.data;
    const period = state.period;
    const today = todayKey();

    const projects = d.company_projects || [];
    const activeProjects = projects.filter((p) => ['planning', 'active', 'paused'].includes(lower(p.status)));
    const overdueProjects = activeProjects.filter((p) => p.due_date && isoDay(p.due_date) < today);
    const contracted = sum(projects, 'contracted_amount');
    const projectBudget = sum(projects, 'budget');

    const files = d.company_files || [];
    const filesPeriod = files.filter((r) => inPeriod(r, ['occurred_at', 'created_at'], period));
    const documents = d.company_documents || [];
    const docsPeriod = documents.filter((r) => inPeriod(r, ['created_at'], period));

    const quotations = (d.company_quotations || []).filter((r) => inPeriod(r, ['issue_date', 'created_at'], period));
    const quotesSale = quotations.filter((r) => lower(r.direction) === 'sale');
    const quotesPurchase = quotations.filter((r) => lower(r.direction) === 'purchase');

    const purchaseOrders = (d.company_purchase_orders || []).filter((r) => inPeriod(r, ['issue_date', 'created_at'], period));
    const poCustomer = purchaseOrders.filter((r) => lower(r.direction) === 'customer');
    const poSupplier = purchaseOrders.filter((r) => lower(r.direction) === 'supplier');

    const invoices = (d.company_invoices || []).filter((r) => inPeriod(r, ['issue_date', 'created_at'], period));
    const sales = invoices.filter((r) => lower(r.invoice_type) === 'sale');
    const purchases = invoices.filter((r) => lower(r.invoice_type) === 'purchase');
    const salesTotal = sales.reduce((a, r) => a + signedDte(r, 'total_amount'), 0);
    const purchaseTotal = purchases.reduce((a, r) => a + signedDte(r, 'total_amount'), 0);
    const debitVat = sales.reduce((a, r) => a + signedDte(r, 'vat_amount'), 0);
    const creditVat = purchases.reduce((a, r) => a + signedDte(r, 'vat_amount'), 0);
    const ivaEstimate = Math.max(0, debitVat - creditVat);

    const transactions = (d.company_transactions || []).filter((r) => inPeriod(r, ['transaction_date', 'created_at'], period));
    const txIncome = sum(transactions.filter((r) => lower(r.direction) === 'income'), 'amount');
    const txExpense = sum(transactions.filter((r) => lower(r.direction) === 'expense'), 'amount');
    const pendingTransactions = transactions.filter((r) => ['pending', 'partial'].includes(lower(r.status)));

    const bank = (d.company_bank_movements || []).filter((r) => inPeriod(r, ['movement_date', 'created_at'], period));
    const bankIncome = bank.filter((r) => num(r.amount) > 0).reduce((a, r) => a + num(r.amount), 0);
    const bankExpense = bank.filter((r) => num(r.amount) < 0).reduce((a, r) => a + Math.abs(num(r.amount)), 0);
    const bankNet = bankIncome - bankExpense;
    const unreconciled = bank.filter((r) => !r.reconciled).length;
    const reconciliation = bank.length ? ((bank.length - unreconciled) / bank.length) * 100 : 0;

    const taxes = (d.company_tax_records || []).filter((r) => inPeriod(r, ['period', 'due_date', 'created_at'], period));
    const byTaxType = (type) => taxes.find((r) => lower(r.record_type) === type);
    const rcvPurchases = byTaxType('rcv_purchases');
    const rcvSales = byTaxType('rcv_sales');
    const f29Official = byTaxType('f29_sii') || byTaxType('f29');
    const f29Precheck = byTaxType('f29_precheck');
    const taxDue = taxes.filter((r) => r.due_date && isoDay(r.due_date) < today && isOpenStatus(r.status));

    const events = (d.company_project_events || []).filter((r) => inPeriod(r, ['event_date', 'created_at'], period));
    const pendingEvents = events.filter((r) => ['draft', 'suggested'].includes(lower(r.status)));

    const deadlines = d.company_deadlines || [];
    const openDeadlines = deadlines.filter((r) => isOpenStatus(r.status));
    const overdueDeadlines = openDeadlines.filter((r) => r.due_date && isoDay(r.due_date) < today);
    const soonLimit = new Date(); soonLimit.setDate(soonLimit.getDate() + 14);
    const soonKey = soonLimit.toISOString().slice(0, 10);
    const soonDeadlines = openDeadlines.filter((r) => r.due_date && isoDay(r.due_date) >= today && isoDay(r.due_date) <= soonKey);

    const alerts = (d.company_alerts || []).filter((r) => isOpenStatus(r.status));
    const cases = (d.company_service_cases || []).filter((r) => isOpenStatus(r.status));
    const approvals = (d.company_approvals || []).filter((r) => lower(r.status) === 'pending');
    const contracts = d.company_contracts || [];
    const activeContracts = contracts.filter((r) => ['active', 'signed', 'approved'].includes(lower(r.status)));
    const assets = d.company_assets || [];
    const assetIssues = assets.filter((r) => ['maintenance', 'lost'].includes(lower(r.status)));
    const employees = d.company_employees || [];
    const activeEmployees = employees.filter((r) => lower(r.status) === 'active');

    const criticalCount = overdueProjects.length + overdueDeadlines.length + taxDue.length + alerts.filter((a) => ['critical', 'high'].includes(lower(a.severity))).length;

    return {
      projects, activeProjects, overdueProjects, contracted, projectBudget,
      files, filesPeriod, documents, docsPeriod,
      quotations, quotesSale, quotesPurchase,
      purchaseOrders, poCustomer, poSupplier,
      invoices, sales, purchases, salesTotal, purchaseTotal, debitVat, creditVat, ivaEstimate,
      transactions, txIncome, txExpense, pendingTransactions,
      bank, bankIncome, bankExpense, bankNet, unreconciled, reconciliation,
      taxes, rcvPurchases, rcvSales, f29Official, f29Precheck, taxDue,
      events, pendingEvents,
      deadlines, openDeadlines, overdueDeadlines, soonDeadlines,
      alerts, cases, approvals, contracts, activeContracts, assets, assetIssues, employees, activeEmployees,
      criticalCount,
    };
  }

  function taxState(row, missing = 'Falta importar') {
    if (!row) return { label: missing, cls: 'warn' };
    const status = lower(row.status);
    if (['paid', 'filed', 'submitted', 'imported', 'reviewed'].includes(status)) return { label: row.status || 'Disponible', cls: 'good' };
    if (['review', 'prepared', 'draft', 'pending'].includes(status)) return { label: row.status || 'En revisión', cls: 'warn' };
    return { label: row.status || 'Disponible', cls: 'info' };
  }

  function recentItems(m) {
    const items = [];
    (state.data.company_activity || []).forEach((r) => items.push({
      date: r.created_at, icon: 'ri-pulse-line', title: r.action || 'Actividad administrativa', meta: r.entity_type || 'Sistema',
    }));
    m.events.forEach((r) => items.push({
      date: r.event_date || r.created_at, icon: 'ri-calendar-event-line', title: r.title || r.event_type || 'Evento de proyecto', meta: r.status || 'Evento',
    }));
    m.invoices.forEach((r) => items.push({
      date: r.issue_date || r.created_at, icon: 'ri-file-list-3-line', title: `DTE ${r.folio || '—'} · ${r.issuer_name || 'Sin emisor'}`, meta: `${r.invoice_type || 'factura'} · ${money(r.total_amount)}`,
    }));
    m.filesPeriod.forEach((r) => items.push({
      date: r.occurred_at || r.created_at, icon: 'ri-attachment-2', title: r.title || r.file_name || r.original_name || 'Archivo', meta: r.category || 'Archivo empresarial',
    }));
    return items
      .filter((r) => r.date)
      .sort((a, b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0))
      .slice(0, 8);
  }

  function coverageRows() {
    return Object.keys(CONFIG).map((table) => ({
      table,
      label: LABELS[table] || table,
      count: (state.data[table] || []).length,
      error: state.errors[table] || '',
    }));
  }

  function statusMarkup() {
    const errors = Object.keys(state.errors).length;
    if (state.loading) return '<span class="ids-live busy"><i></i> Sincronizando</span>';
    if (errors) return `<span class="ids-live warn"><i></i> ${errors} módulo${errors === 1 ? '' : 's'} con advertencia</span>`;
    if (state.syncedAt) return '<span class="ids-live good"><i></i> Sincronizado</span>';
    return '<span class="ids-live"><i></i> Preparando datos</span>';
  }

  function renderStatus() {
    const root = document.getElementById('ids-dashboard-sync');
    if (!root) return;
    const live = root.querySelector('[data-ids-live]');
    if (live) live.innerHTML = statusMarkup();
    const time = root.querySelector('[data-ids-time]');
    if (time) time.textContent = state.syncedAt ? `Última actualización ${state.syncedAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}` : 'Esperando sincronización';
    const refresh = root.querySelector('[data-ids-refresh]');
    if (refresh) refresh.disabled = state.loading;
  }

  function render() {
    if (state.renderGuard || !isDashboardActive()) return;
    const main = mainRoot();
    if (!main) return;
    state.renderGuard = true;
    try {
      let root = document.getElementById('ids-dashboard-sync');
      if (!root || root.parentElement !== main) {
        root?.remove();
        root = document.createElement('section');
        root.id = 'ids-dashboard-sync';
        root.className = 'ids-dashboard';
        main.prepend(root);
      }

      const m = metrics();
      const rcvP = taxState(m.rcvPurchases, 'RCV compras pendiente');
      const rcvS = taxState(m.rcvSales, 'RCV ventas pendiente');
      const f29 = taxState(m.f29Official || m.f29Precheck, 'F29 sin registro');
      const recent = recentItems(m);
      const coverage = coverageRows();
      const otherPage = page === 'admin' ? 'contador.html' : 'admin.html';
      const otherLabel = page === 'admin' ? 'Abrir Contador IA' : 'Abrir Administración CEO';
      const pageLabel = page === 'admin' ? 'Administración CEO' : 'Contador IA';

      root.innerHTML = `
        <div class="ids-head">
          <div>
            <span class="ids-eyebrow">INNOVA · DASHBOARD COMPARTIDO</span>
            <h2>Dashboard empresarial sincronizado</h2>
            <p>Una sola lectura de proyectos, documentos, finanzas, banco, SII, plazos y operación. ${pageLabel} usa exactamente la misma fuente y el mismo período.</p>
          </div>
          <div class="ids-head-actions">
            <div data-ids-live>${statusMarkup()}</div>
            <label class="ids-period"><i class="ri-calendar-2-line"></i><input data-ids-period type="month" value="${esc(state.period)}" aria-label="Período del dashboard" /></label>
            <button class="ids-btn" type="button" data-ids-refresh><i class="ri-refresh-line"></i> Actualizar</button>
            <a class="ids-btn primary" href="${otherPage}"><i class="ri-arrow-left-right-line"></i> ${otherLabel}</a>
          </div>
        </div>
        <div class="ids-meta"><span data-ids-time>${state.syncedAt ? `Última actualización ${state.syncedAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}` : 'Esperando sincronización'}</span><span>Actualización automática cada 60 s + cambios en tiempo real cuando Supabase Realtime está disponible.</span></div>

        <div class="ids-kpis">
          ${kpi('ri-briefcase-4-line', int(m.activeProjects.length), 'Proyectos activos', `${m.overdueProjects.length} vencido${m.overdueProjects.length === 1 ? '' : 's'}`, m.overdueProjects.length ? 'warn' : '')}
          ${kpi('ri-arrow-up-circle-line', money(m.salesTotal), 'Ventas del período', `${m.sales.length} DTE`, '')}
          ${kpi('ri-arrow-down-circle-line', money(m.purchaseTotal), 'Compras del período', `${m.purchases.length} DTE`, '')}
          ${kpi('ri-percent-line', money(m.ivaEstimate), 'IVA estimado', `Débito ${money(m.debitVat)} · Crédito ${money(m.creditVat)}`, '')}
          ${kpi('ri-bank-line', money(m.bankNet), 'Flujo bancario neto', `${m.bank.length} movimientos`, m.bankNet < 0 ? 'warn' : '')}
          ${kpi('ri-link-unlink-m', int(m.unreconciled), 'Sin conciliar', `${pct(m.reconciliation)} conciliado`, m.unreconciled ? 'warn' : '')}
          ${kpi('ri-folder-5-line', int(m.filesPeriod.length + m.docsPeriod.length), 'Documentos del período', `${m.files.length + m.documents.length} en repositorio`, '')}
          ${kpi('ri-alarm-warning-line', int(m.criticalCount), 'Alertas y vencimientos', `${m.soonDeadlines.length} próximos 14 días`, m.criticalCount ? 'bad' : '')}
        </div>

        <div class="ids-grid ids-grid-main">
          <article class="ids-panel">
            <div class="ids-panel-head"><div><span class="ids-tag">OPERACIÓN</span><h3>Proyectos y ejecución</h3></div><span>${int(m.projects.length)} proyectos</span></div>
            <div class="ids-panel-body">
              <div class="ids-mini-grid">
                ${mini('Monto contratado', money(m.contracted))}
                ${mini('Presupuesto registrado', money(m.projectBudget))}
                ${mini('Eventos del período', int(m.events.length))}
                ${mini('Eventos pendientes', int(m.pendingEvents.length))}
                ${mini('Casos abiertos', int(m.cases.length))}
                ${mini('Aprobaciones pendientes', int(m.approvals.length))}
                ${mini('Contratos activos', int(m.activeContracts.length))}
                ${mini('Activos con incidencia', int(m.assetIssues.length))}
                ${mini('Personal activo', int(m.activeEmployees.length))}
              </div>
              ${m.overdueProjects.length ? `<div class="ids-callout warn"><i class="ri-time-line"></i><div><strong>${m.overdueProjects.length} proyecto${m.overdueProjects.length === 1 ? '' : 's'} con fecha objetivo vencida</strong><span>${m.overdueProjects.slice(0, 3).map((p) => esc(p.title || p.code || 'Proyecto')).join(' · ')}</span></div></div>` : '<div class="ids-callout good"><i class="ri-checkbox-circle-line"></i><div><strong>Sin proyectos activos vencidos</strong><span>Según las fechas objetivo registradas.</span></div></div>'}
            </div>
          </article>

          <article class="ids-panel">
            <div class="ids-panel-head"><div><span class="ids-tag">FINANZAS + SII</span><h3>Control del período ${esc(state.period)}</h3></div><span>${int(m.invoices.length)} DTE</span></div>
            <div class="ids-panel-body">
              <div class="ids-mini-grid">
                ${mini('Ingresos registrados', money(m.txIncome))}
                ${mini('Gastos registrados', money(m.txExpense))}
                ${mini('Transacciones pendientes', int(m.pendingTransactions.length))}
                ${mini('Entradas banco', money(m.bankIncome))}
                ${mini('Salidas banco', money(m.bankExpense))}
                ${mini('Registros tributarios', int(m.taxes.length))}
              </div>
              <div class="ids-tax-state">
                ${statePill('RCV compras', rcvP.label, rcvP.cls)}
                ${statePill('RCV ventas', rcvS.label, rcvS.cls)}
                ${statePill('F29', f29.label, f29.cls)}
                ${statePill('Conciliación', pct(m.reconciliation), m.unreconciled ? 'warn' : 'good')}
              </div>
              ${m.taxDue.length ? `<div class="ids-callout bad"><i class="ri-error-warning-line"></i><div><strong>${m.taxDue.length} registro${m.taxDue.length === 1 ? '' : 's'} tributario${m.taxDue.length === 1 ? '' : 's'} vencido${m.taxDue.length === 1 ? '' : 's'}</strong><span>Revisar estado y respaldo antes de cerrar el período.</span></div></div>` : ''}
            </div>
          </article>
        </div>

        <div class="ids-grid ids-grid-secondary">
          <article class="ids-panel">
            <div class="ids-panel-head"><div><span class="ids-tag">COMERCIAL</span><h3>Cotizaciones y órdenes</h3></div><span>Período</span></div>
            <div class="ids-panel-body">
              <div class="ids-commercial-row"><span>Cotizaciones de venta</span><strong>${int(m.quotesSale.length)}</strong><b>${money(sum(m.quotesSale, 'total_amount'))}</b></div>
              <div class="ids-commercial-row"><span>Cotizaciones de compra</span><strong>${int(m.quotesPurchase.length)}</strong><b>${money(sum(m.quotesPurchase, 'total_amount'))}</b></div>
              <div class="ids-commercial-row"><span>OC de clientes</span><strong>${int(m.poCustomer.length)}</strong><b>${money(sum(m.poCustomer, 'total_amount'))}</b></div>
              <div class="ids-commercial-row"><span>OC a proveedores</span><strong>${int(m.poSupplier.length)}</strong><b>${money(sum(m.poSupplier, 'total_amount'))}</b></div>
            </div>
          </article>

          <article class="ids-panel">
            <div class="ids-panel-head"><div><span class="ids-tag">PLAZOS</span><h3>Agenda crítica</h3></div><span>${int(m.openDeadlines.length)} abiertos</span></div>
            <div class="ids-panel-body">
              <div class="ids-commercial-row"><span>Vencidos</span><strong class="${m.overdueDeadlines.length ? 'ids-danger-text' : ''}">${int(m.overdueDeadlines.length)}</strong><b>${m.overdueDeadlines[0]?.due_date ? formatDate(m.overdueDeadlines[0].due_date) : '—'}</b></div>
              <div class="ids-commercial-row"><span>Próximos 14 días</span><strong>${int(m.soonDeadlines.length)}</strong><b>${m.soonDeadlines[0]?.due_date ? formatDate(m.soonDeadlines[0].due_date) : '—'}</b></div>
              <div class="ids-commercial-row"><span>Alertas activas</span><strong>${int(m.alerts.length)}</strong><b>${m.alerts.filter((a) => ['critical', 'high'].includes(lower(a.severity))).length} alta/crit.</b></div>
              <div class="ids-commercial-row"><span>Casos/postventa abiertos</span><strong>${int(m.cases.length)}</strong><b>${m.cases.filter((c) => ['critical', 'high'].includes(lower(c.priority))).length} prior.</b></div>
            </div>
          </article>
        </div>

        <div class="ids-grid ids-grid-bottom">
          <article class="ids-panel">
            <div class="ids-panel-head"><div><span class="ids-tag">ACTIVIDAD</span><h3>Movimientos recientes</h3></div><span>${recent.length}</span></div>
            <div class="ids-panel-body ids-recent">
              ${recent.length ? recent.map((r) => `<div class="ids-recent-row"><i class="${esc(r.icon)}"></i><div><strong>${esc(r.title)}</strong><span>${esc(r.meta)}</span></div><time>${esc(formatDate(r.date))}</time></div>`).join('') : '<div class="ids-empty">Sin actividad reciente para mostrar.</div>'}
            </div>
          </article>

          <article class="ids-panel">
            <div class="ids-panel-head"><div><span class="ids-tag">COBERTURA</span><h3>Datos disponibles en el sistema</h3></div><span>${coverage.filter((r) => !r.error).length}/${coverage.length} módulos</span></div>
            <div class="ids-panel-body ids-coverage-wrap">
              <table class="ids-coverage"><thead><tr><th>Módulo</th><th>Registros</th><th>Estado</th></tr></thead><tbody>
                ${coverage.map((r) => `<tr><td>${esc(r.label)}</td><td>${r.error ? '—' : int(r.count)}</td><td>${r.error ? '<span class="ids-state warn">No disponible</span>' : '<span class="ids-state good">Sincronizado</span>'}</td></tr>`).join('')}
              </tbody></table>
            </div>
          </article>
        </div>
      `;

      root.querySelector('[data-ids-period]')?.addEventListener('change', (event) => setPeriod(event.target.value, { source: 'dashboard' }));
      root.querySelector('[data-ids-refresh]')?.addEventListener('click', () => reload({ reason: 'manual' }));
      renderStatus();
    } finally {
      state.renderGuard = false;
    }
  }

  function kpi(icon, value, label, meta, tone = '') {
    return `<article class="ids-kpi ${tone}"><div class="ids-kpi-icon"><i class="${icon}"></i></div><div><strong>${esc(value)}</strong><span>${esc(label)}</span><small>${esc(meta)}</small></div></article>`;
  }
  function mini(label, value) {
    return `<div class="ids-mini"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  }
  function statePill(label, value, cls) {
    return `<div class="ids-tax-pill"><span>${esc(label)}</span><strong class="${esc(cls)}">${esc(value)}</strong></div>`;
  }

  function scheduleReload(reason = 'realtime') {
    clearTimeout(state.debounce);
    state.debounce = setTimeout(() => {
      if (document.visibilityState === 'visible') reload({ reason });
    }, 900);
  }

  function syncExternalPeriodControl() {
    const global = document.getElementById('global-period');
    if (!global) return;
    if (validPeriod(state.period) && global.value !== state.period) {
      global.value = state.period;
      global.dispatchEvent(new Event('change', { bubbles: true }));
    }
    global.addEventListener('change', () => {
      if (!validPeriod(global.value)) return;
      if (global.value !== state.period) setPeriod(global.value, { source: 'contador-control', dispatch: false });
    });
  }

  function observeDashboard() {
    const main = mainRoot();
    const nav = document.getElementById(page === 'admin' ? 'side-nav' : 'accounting-nav');
    const observer = new MutationObserver(() => {
      if (!isDashboardActive()) {
        document.getElementById('ids-dashboard-sync')?.remove();
        return;
      }
      if (!document.getElementById('ids-dashboard-sync')) render();
    });
    if (main) observer.observe(main, { childList: true });
    if (nav) observer.observe(nav, { attributes: true, subtree: true, attributeFilter: ['class'] });
  }

  function setupRealtime() {
    try {
      let channel = db.channel(`innova-dashboard-${page}-${Date.now()}`);
      REALTIME_TABLES.forEach((table) => {
        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => scheduleReload(`realtime:${table}`));
      });
      state.channel = channel.subscribe();
    } catch (error) {
      console.warn('Dashboard Sync: Realtime no disponible:', error?.message || error);
    }
  }

  async function init() {
    state.period = readInitialPeriod();
    localStorage.setItem(STORAGE_KEY, state.period);
    syncExternalPeriodControl();
    observeDashboard();
    setupRealtime();
    render();
    await reload({ reason: 'init' });

    state.timer = setInterval(() => {
      if (document.visibilityState === 'visible' && isDashboardActive()) reload({ reason: 'interval' });
    }, REFRESH_MS);

    window.addEventListener('focus', () => {
      if (isDashboardActive()) scheduleReload('focus');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isDashboardActive()) scheduleReload('visible');
    });
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY || !validPeriod(event.newValue) || event.newValue === state.period) return;
      setPeriod(event.newValue, { source: 'storage' });
    });
    window.addEventListener('innova-business-sync', () => scheduleReload('business-sync'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 450), { once: true });
  else setTimeout(init, 450);
})();
