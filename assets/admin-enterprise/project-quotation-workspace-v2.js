(() => {
  'use strict';

  const cfg = window.INNOVA_ADMIN_CONFIG;
  const db = window.getInnovaAdminSupabaseClient?.() || window.INNOVA_ADMIN_SUPABASE_CLIENT;
  if (!cfg || !db) return;

  const MARKER = 'project_quotation_workspace_v2';
  const LEGACY_MARKERS = ['project_quotation_workspace', MARKER];
  const OFFICIAL = {
    source: 'Presupuesto_Sala_de_Musica_54.600.480(1).xlsx',
    subtotal: 45882756,
    vat: 8717724,
    total: 54600480,
    vatRate: 19,
    summary: [
      ['Tratamiento acústico y terminaciones', 3753980],
      ['Mobiliario y terminaciones', 7192004],
      ['Pantalla interactiva y sistema de pizarra', 6862646],
      ['Audio y sonorización', 2974216],
      ['Estructura metálica, entrepiso, escalera y barandas', 4286115],
      ['Piso y terminaciones planta baja', 1701208],
      ['Instalación eléctrica', 3012587],
      ['Gastos generales, profesionales y personal', 16100000]
    ]
  };

  const state = {
    projectId: null, project: null, quote: null, items: [], comments: '', ai: '', vatRate: 19,
    saving: false, saveTimer: null, seeded: false
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (v) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(v) || 0);
  const today = () => new Date().toISOString().slice(0, 10);
  const slug = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  function parsePrice(value) {
    const s = String(value ?? '').trim().toLowerCase();
    if (!s || s.includes('incluido abajo')) return 0;
    const m = s.match(/\$?\s*([\d.]+)/);
    return m ? Number(m[1].replace(/\./g, '')) || 0 : 0;
  }

  function parseQuantity(value) {
    const s = String(value ?? '').trim();
    const m = s.match(/^([\d.,]+)/);
    if (!m) return 1;
    let n = m[1];
    if (n.includes(',') && n.includes('.')) n = n.replace(/\./g, '').replace(',', '.');
    else if (n.includes(',')) n = n.replace(',', '.');
    const parsed = Number(n);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  function blankItem() {
    return { id: uid(), section: '', group: '', name: '', quantity_label: '1', calc_quantity: 1, unit: 'un.', price_label: '$0', unit_price: 0, supplier: '', url: '', notes: '' };
  }

  function normalizeItem(row = {}) {
    const quantityLabel = row.quantity_label ?? row.quantity ?? '1';
    const priceLabel = row.price_label ?? (row.unit_price != null ? `$${Number(row.unit_price).toLocaleString('es-CL')}` : '$0');
    return {
      id: row.id || uid(),
      section: row.section || '',
      group: row.group || row.category || '',
      name: row.name || row.item || row.description || '',
      quantity_label: String(quantityLabel ?? '1'),
      calc_quantity: Number.isFinite(Number(row.calc_quantity)) ? Number(row.calc_quantity) : parseQuantity(quantityLabel),
      unit: row.unit || '',
      price_label: String(priceLabel || '$0'),
      unit_price: Number.isFinite(Number(row.unit_price)) ? Number(row.unit_price) : parsePrice(priceLabel),
      supplier: row.supplier || row.provider || '',
      url: row.url || row.link || '',
      notes: row.notes || row.specification || row.details || ''
    };
  }

  function lineSubtotal(row) { return Math.round((Number(row.calc_quantity) || 0) * (Number(row.unit_price) || 0)); }
  function totals() {
    const net = state.items.reduce((sum, row) => sum + lineSubtotal(row), 0);
    const vat = Math.round(net * (Number(state.vatRate) || 0) / 100);
    return { net, vat, total: net + vat };
  }
  function sectionTotals() {
    const map = new Map();
    state.items.forEach((row) => map.set(row.section || 'Sin sección', (map.get(row.section || 'Sin sección') || 0) + lineSubtotal(row)));
    return [...map.entries()];
  }
  function metaFromQuote(q) {
    try { const obj = JSON.parse(q?.notes || '{}'); return obj && typeof obj === 'object' ? obj : {}; } catch { return {}; }
  }
  function isSalaMusica(project) { return slug(project?.title || project?.name || '').includes('sala de musica'); }
  function seedRows() { return (window.INNOVA_SALA_MUSICA_BUDGET_PARTS || []).flat().map(normalizeItem); }
  function hasMeaningfulItems(items) { return Array.isArray(items) && items.some((r) => String(r?.name || r?.item || '').trim() || Number(r?.unit_price) > 0); }

  function injectStyle() {
    if ($('#pqw2-style')) return;
    const style = document.createElement('style');
    style.id = 'pqw2-style';
    style.textContent = `
      #main-content.pqw2-enhanced .ceo-project-hero{gap:18px;align-items:stretch}
      #main-content.pqw2-enhanced .ceo-summary-card{background:linear-gradient(135deg,#14214d 0%,#30246d 100%);box-shadow:0 18px 44px rgba(25,34,74,.16);border:1px solid rgba(255,255,255,.08);padding:25px 27px}
      #main-content.pqw2-enhanced .ceo-summary-card h2{font-size:1.65rem;letter-spacing:-.03em;margin-bottom:8px}
      #main-content.pqw2-enhanced .ceo-deadline{box-shadow:0 12px 34px rgba(29,45,88,.08);border-radius:18px;padding:20px}
      #main-content.pqw2-enhanced .ceo-deadline>div:last-child{overflow:visible!important}
      #main-content.pqw2-enhanced .ceo-tabs{position:sticky;top:74px;z-index:12;background:rgba(245,248,253,.94);backdrop-filter:blur(12px);padding:10px 0 8px;gap:5px;overflow-x:auto}
      #main-content.pqw2-enhanced .ceo-tab{white-space:nowrap}
      .pqw2-shell{display:grid;gap:16px}.pqw2-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}.pqw2-head h3{margin:0 0 5px;font-size:1.2rem;color:#172342}.pqw2-head p{margin:0;color:#6e7b95;font-size:.82rem;max-width:760px}
      .pqw2-actions{display:flex;gap:8px;flex-wrap:wrap}.pqw2-actions button{border:1px solid #dbe2ef;background:#fff;color:#253456;border-radius:10px;padding:9px 12px;font:600 .78rem Inter,sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:7px}.pqw2-actions button.primary{background:#5147ed;color:#fff;border-color:#5147ed}.pqw2-actions button.ai{background:#eeeafe;color:#5147ed;border-color:#d9d3ff}.pqw2-actions button:disabled{opacity:.55;cursor:not-allowed}
      .pqw2-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.pqw2-metric{background:#fff;border:1px solid #dde4f1;border-radius:14px;padding:14px 15px;box-shadow:0 7px 20px rgba(30,44,80,.045)}.pqw2-metric span{display:block;color:#7a86a0;font-size:.69rem;text-transform:uppercase;letter-spacing:.05em;font-weight:700}.pqw2-metric strong{display:block;margin-top:5px;color:#172342;font-size:1.08rem}.pqw2-metric.total{background:#18234c;border-color:#18234c}.pqw2-metric.total span,.pqw2-metric.total strong{color:#fff}
      .pqw2-card{background:#fff;border:1px solid #dde4f1;border-radius:17px;box-shadow:0 10px 28px rgba(29,44,79,.055);overflow:hidden}.pqw2-card-head{padding:14px 16px;border-bottom:1px solid #e7ebf4;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.pqw2-card-head strong{color:#1c2948}.pqw2-card-body{padding:16px}
      .pqw2-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.pqw2-summary-chip{border:1px solid #e0e6f0;background:#f8f9fc;border-radius:11px;padding:10px 11px}.pqw2-summary-chip span{display:block;color:#74809a;font-size:.68rem;line-height:1.25}.pqw2-summary-chip strong{display:block;margin-top:4px;color:#1c2948;font-size:.85rem}
      .pqw2-table-wrap{overflow:auto;max-width:100%;border:1px solid #e2e7f0;border-radius:12px;max-height:68vh}.pqw2-table{width:100%;border-collapse:separate;border-spacing:0;min-width:2050px;background:#fff}.pqw2-table th{position:sticky;top:0;background:#f5f7fb;z-index:2;color:#66738f;font-size:.66rem;text-transform:uppercase;letter-spacing:.045em;padding:9px 8px;text-align:left;border-bottom:1px solid #dfe5ef}.pqw2-table td{padding:5px;border-bottom:1px solid #edf0f6;vertical-align:top}.pqw2-table input{width:100%;min-width:0;border:1px solid transparent;border-radius:8px;padding:8px 9px;background:transparent;color:#1f2d4c;font:500 .76rem Inter,sans-serif;outline:none}.pqw2-table input:hover{border-color:#e2e6ef;background:#fafbfe}.pqw2-table input:focus{border-color:#8179ff;background:#fff;box-shadow:0 0 0 3px rgba(81,71,237,.10)}.pqw2-subtotal{font-weight:800;text-align:right;color:#1b2847;white-space:nowrap;padding-top:14px!important}.pqw2-row-actions{white-space:nowrap;padding-top:9px!important}.pqw2-icon{width:30px;height:30px;border:0;border-radius:8px;background:#f1f3f8;color:#52617f;cursor:pointer;margin-left:3px}.pqw2-icon.danger{color:#b93852;background:#fff1f4}
      .pqw2-footer-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:14px}.pqw2-textarea{width:100%;min-height:110px;resize:vertical;border:1px solid #dfe5ef;border-radius:11px;padding:11px;font:500 .82rem Inter,sans-serif;color:#253453}.pqw2-totalbox{border:1px solid #dce2ef;border-radius:13px;padding:12px 14px;background:#f8f9fc;display:grid;gap:8px}.pqw2-totalrow{display:flex;justify-content:space-between;gap:12px;color:#66738c;font-size:.82rem}.pqw2-totalrow strong{color:#1c2948}.pqw2-totalrow.final{padding-top:9px;border-top:1px solid #dfe4ee;font-size:1rem}.pqw2-vat{display:flex;align-items:center;gap:7px}.pqw2-vat input{width:60px;border:1px solid #d9e0ec;border-radius:7px;padding:5px;text-align:right}.pqw2-status{font-size:.72rem;color:#78849d;display:flex;align-items:center;gap:6px}.pqw2-status .dot{width:7px;height:7px;border-radius:50%;background:#9aa5b8}.pqw2-status.saving .dot{background:#e4a038}.pqw2-status.saved .dot{background:#32a56e}.pqw2-status.error .dot{background:#d64c67}
      .pqw2-ai{white-space:pre-wrap;line-height:1.55;font-size:.82rem;color:#34415f;background:#f8f9fd;border:1px solid #e2e6f0;border-radius:12px;padding:13px}
      .pqw2-modal{position:fixed;inset:0;background:rgba(11,18,38,.58);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px}.pqw2-modal-card{width:min(1180px,96vw);max-height:94vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 28px 80px rgba(0,0,0,.25)}.pqw2-modal-bar{position:sticky;top:0;background:#fff;border-bottom:1px solid #e5e9f1;padding:12px 14px;display:flex;justify-content:space-between;gap:10px;z-index:3}.pqw2-document{padding:38px 42px;color:#18233f}.pqw2-doc-head{display:flex;justify-content:space-between;gap:22px;align-items:flex-start;margin-bottom:22px}.pqw2-doc-brand{display:flex;gap:14px;align-items:center}.pqw2-doc-brand img{width:64px;height:64px;border-radius:12px;object-fit:contain;border:1px solid #e5e9f1}.pqw2-document h1{margin:0;font-size:1.55rem}.pqw2-document .meta{margin-top:5px;color:#6f7c96;font-size:.82rem}.pqw2-document table{width:100%;border-collapse:collapse;font-size:.69rem}.pqw2-document th,.pqw2-document td{border-bottom:1px solid #dde3ed;padding:7px 6px;text-align:left;vertical-align:top}.pqw2-document th{background:#f4f6fa}.pqw2-document td.num,.pqw2-document th.num{text-align:right;white-space:nowrap}.pqw2-doc-section{background:#eef1f8!important;font-weight:800;color:#23304f}.pqw2-doc-totals{margin:22px 0 0 auto;width:min(350px,100%);display:grid;gap:7px}.pqw2-doc-totals>div{display:flex;justify-content:space-between}.pqw2-doc-totals .grand{font-size:1.05rem;font-weight:800;border-top:1px solid #ccd4e2;padding-top:9px}.pqw2-doc-footer{margin-top:34px;padding-top:16px;border-top:1px solid #dce2ec;color:#6e7b91;font-size:.68rem;line-height:1.55}.pqw2-source-link{max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      @media(max-width:1000px){.pqw2-metrics,.pqw2-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pqw2-footer-grid{grid-template-columns:1fr}}
      @media(max-width:620px){.pqw2-metrics,.pqw2-summary-grid{grid-template-columns:1fr 1fr}.pqw2-card-body{padding:11px}.pqw2-document{padding:22px 18px}.pqw2-actions{width:100%}.pqw2-actions button{flex:1;justify-content:center}}
    `;
    document.head.appendChild(style);
  }

  function detectProjectId() {
    const root = $('#main-content');
    if (!root || !root.querySelector('.ceo-project-hero')) return null;
    return root.querySelector('[data-ceo-upload][data-project-id]')?.dataset.projectId || null;
  }

  function ensureControls() {
    const root = $('#main-content');
    const projectId = detectProjectId();
    if (!root || !projectId) return;
    injectStyle(); root.classList.add('pqw2-enhanced'); state.projectId = projectId;
    const tabs = root.querySelector('.ceo-tabs');
    if (tabs && !tabs.querySelector('[data-pqw2-tab]')) {
      const btn = document.createElement('button');
      btn.className = 'ceo-tab'; btn.dataset.pqw2Tab = 'quotation';
      btn.innerHTML = '<i class="ri-file-list-3-line"></i> Cotización';
      btn.addEventListener('click', () => openWorkspace(projectId));
      tabs.appendChild(btn);
      tabs.addEventListener('click', (event) => { if (event.target.closest('[data-ceo-tab]')) btn.classList.remove('active'); });
    }
    const headActions = root.querySelector('.ceo-head .ceo-actions:last-child');
    if (headActions && !headActions.querySelector('[data-pqw2-open]')) {
      const btn = document.createElement('button'); btn.className = 'btn ghost'; btn.dataset.pqw2Open = projectId;
      btn.innerHTML = '<i class="ri-file-add-line"></i> Crear cotización';
      btn.addEventListener('click', () => openWorkspace(projectId)); headActions.prepend(btn);
    }
  }

  async function loadWorkspace(projectId) {
    const [p, q] = await Promise.all([
      db.from('company_projects').select('*').eq('id', projectId).maybeSingle(),
      db.from('company_quotations').select('*').eq('project_id', projectId).order('updated_at', { ascending: false }).limit(50)
    ]);
    if (p.error) throw p.error; if (q.error) throw q.error;
    state.project = p.data || { id: projectId, title: $('.ceo-summary-card h2')?.textContent || 'Proyecto' };
    const quotes = q.data || [];
    state.quote = quotes.find((row) => LEGACY_MARKERS.includes(metaFromQuote(row).source)) || null;
    const meta = metaFromQuote(state.quote);
    const existing = Array.isArray(state.quote?.items) ? state.quote.items : [];
    const shouldSeed = isSalaMusica(state.project) && !hasMeaningfulItems(existing);
    if (shouldSeed) {
      const seed = seedRows();
      if (seed.length !== 207) throw new Error(`Presupuesto base incompleto: se esperaban 207 partidas y se cargaron ${seed.length}.`);
      state.items = seed;
      state.vatRate = 19;
      state.comments = 'Presupuesto base consolidado desde Presupuesto_Sala_de_Musica_54.600.480(1).xlsx. Incluye todas las partidas, provisiones, jefaturas y gastos generales del expediente.';
      state.ai = '';
      state.seeded = true;
      const check = totals();
      if (check.net !== OFFICIAL.subtotal || check.vat !== OFFICIAL.vat || check.total !== OFFICIAL.total) throw new Error(`El presupuesto base no coincide con el cierre oficial (${money(check.total)} vs ${money(OFFICIAL.total)}).`);
    } else {
      state.items = existing.length ? existing.map(normalizeItem) : [blankItem()];
      state.vatRate = Number.isFinite(Number(state.quote?.vat_rate)) ? Number(state.quote.vat_rate) : 19;
      state.comments = meta.comments || '';
      state.ai = meta.ai_analysis || '';
      state.seeded = false;
    }
  }

  async function openWorkspace(projectId) {
    const root = $('#ceo-project-tab'); if (!root) return;
    $$('.ceo-tab', $('#main-content')).forEach((b) => b.classList.remove('active'));
    $('[data-pqw2-tab]', $('#main-content'))?.classList.add('active');
    root.innerHTML = '<section class="ceo-panel"><div class="ceo-panel-body"><div class="ceo-empty"><i class="ri-loader-4-line"></i><strong>Cargando cotización…</strong></div></div></section>';
    try {
      await loadWorkspace(projectId); renderWorkspace();
      if (state.seeded) await saveQuote(false);
    } catch (error) {
      root.innerHTML = `<section class="ceo-panel"><div class="ceo-panel-body"><div class="ceo-inline-warning">${esc(error.message || 'No se pudo cargar la cotización.')}</div></div></section>`;
    }
  }

  function rowHtml(row, index) {
    return `<tr data-row="${index}">
      <td><input data-field="section" value="${esc(row.section)}" placeholder="Sección"></td>
      <td><input data-field="group" value="${esc(row.group)}" placeholder="Grupo"></td>
      <td><input data-field="name" value="${esc(row.name)}" placeholder="Ítem / material / servicio"></td>
      <td><input data-field="quantity_label" value="${esc(row.quantity_label)}" placeholder="Cantidad"></td>
      <td><input data-field="unit" value="${esc(row.unit)}" placeholder="Unidad"></td>
      <td><input data-field="price_label" value="${esc(row.price_label)}" placeholder="$0"></td>
      <td class="pqw2-subtotal" data-subtotal>${money(lineSubtotal(row))}</td>
      <td><input data-field="supplier" value="${esc(row.supplier)}" placeholder="Proveedor / lugar"></td>
      <td><input data-field="url" value="${esc(row.url)}" placeholder="Página web / fuente"></td>
      <td><input data-field="notes" value="${esc(row.notes)}" placeholder="Notas"></td>
      <td class="pqw2-row-actions"><button class="pqw2-icon" data-duplicate="${index}" title="Duplicar"><i class="ri-file-copy-line"></i></button><button class="pqw2-icon danger" data-delete="${index}" title="Eliminar"><i class="ri-delete-bin-6-line"></i></button></td>
    </tr>`;
  }

  function renderWorkspace() {
    const root = $('#ceo-project-tab'); if (!root) return;
    const t = totals();
    root.innerHTML = `<section class="ceo-panel"><div class="ceo-panel-body pqw2-shell">
      <div class="pqw2-head"><div><h3>Cotización del proyecto</h3><p>Planilla nativa del expediente. Todos los subtotales se calculan automáticamente; el neto es la suma exacta de las partidas y el IVA se redondea a peso entero.</p></div>
        <div class="pqw2-actions"><button data-add><i class="ri-add-line"></i>Agregar fila</button><button data-csv><i class="ri-file-excel-2-line"></i>CSV</button><button data-preview><i class="ri-eye-line"></i>Vista previa</button><button class="ai" data-ai><i class="ri-sparkling-2-line"></i>Analizar IA</button><button class="primary" data-save><i class="ri-save-3-line"></i>Guardar</button></div>
      </div>
      <div class="pqw2-metrics"><div class="pqw2-metric"><span>Partidas</span><strong data-count>${state.items.length}</strong></div><div class="pqw2-metric"><span>Subtotal neto</span><strong data-net>${money(t.net)}</strong></div><div class="pqw2-metric"><span>IVA ${esc(state.vatRate)}%</span><strong data-vat>${money(t.vat)}</strong></div><div class="pqw2-metric total"><span>Total con IVA</span><strong data-total>${money(t.total)}</strong></div></div>
      <div class="pqw2-card"><div class="pqw2-card-head"><strong>Resumen por sección</strong><span class="pqw2-status" data-status><span class="dot"></span><span>Listo</span></span></div><div class="pqw2-card-body"><div class="pqw2-summary-grid" data-section-summary>${sectionSummaryHtml()}</div></div></div>
      <div class="pqw2-card"><div class="pqw2-card-head"><strong>Listado completo</strong><small>${state.seeded ? 'Base oficial cargada desde Excel consolidado' : 'Edición directa'}</small></div><div class="pqw2-card-body"><div class="pqw2-table-wrap"><table class="pqw2-table"><thead><tr><th>Sección</th><th>Grupo</th><th>Ítem / material / servicio</th><th>Cantidad</th><th>Unidad</th><th>Precio ref.</th><th>Subtotal</th><th>Proveedor / lugar</th><th>Página web / fuente</th><th>Notas</th><th></th></tr></thead><tbody data-body>${state.items.map(rowHtml).join('')}</tbody></table></div></div></div>
      <div class="pqw2-footer-grid"><div class="pqw2-card"><div class="pqw2-card-head"><strong>Observaciones y antecedentes</strong></div><div class="pqw2-card-body"><textarea class="pqw2-textarea" data-comments>${esc(state.comments)}</textarea>${state.ai ? `<div class="pqw2-ai" style="margin-top:12px">${esc(state.ai)}</div>` : ''}</div></div>
      <div class="pqw2-card"><div class="pqw2-card-head"><strong>Totales</strong></div><div class="pqw2-card-body"><div class="pqw2-totalbox"><div class="pqw2-totalrow"><span>Subtotal neto</span><strong data-net2>${money(t.net)}</strong></div><div class="pqw2-totalrow"><span class="pqw2-vat">IVA <input data-vat-rate type="number" min="0" max="100" step="0.01" value="${esc(state.vatRate)}">%</span><strong data-vat2>${money(t.vat)}</strong></div><div class="pqw2-totalrow final"><span>Total</span><strong data-total2>${money(t.total)}</strong></div></div></div></div></div>
    </div></section>`;
    bindWorkspace();
  }

  function sectionSummaryHtml() { return sectionTotals().map(([name, amount]) => `<div class="pqw2-summary-chip"><span>${esc(name)}</span><strong>${money(amount)}</strong></div>`).join(''); }

  function bindWorkspace() {
    const root = $('#ceo-project-tab'); if (!root) return;
    root.addEventListener('input', onInput);
    root.addEventListener('click', onClick);
    $('[data-comments]', root)?.addEventListener('input', (e) => { state.comments = e.target.value; scheduleSave(); });
    $('[data-vat-rate]', root)?.addEventListener('input', (e) => { state.vatRate = Number(e.target.value) || 0; refreshTotals(); scheduleSave(); });
  }

  function onInput(event) {
    const input = event.target.closest('[data-field]'); if (!input) return;
    const tr = input.closest('[data-row]'); if (!tr) return;
    const index = Number(tr.dataset.row); const row = state.items[index]; if (!row) return;
    const field = input.dataset.field; row[field] = input.value;
    if (field === 'quantity_label') row.calc_quantity = parseQuantity(input.value);
    if (field === 'price_label') row.unit_price = parsePrice(input.value);
    tr.querySelector('[data-subtotal]').textContent = money(lineSubtotal(row));
    refreshTotals(); scheduleSave();
  }

  function onClick(event) {
    const add = event.target.closest('[data-add]'); if (add) { state.items.push(blankItem()); renderWorkspace(); scheduleSave(); return; }
    const dup = event.target.closest('[data-duplicate]'); if (dup) { const i = Number(dup.dataset.duplicate); state.items.splice(i + 1, 0, { ...state.items[i], id: uid() }); renderWorkspace(); scheduleSave(); return; }
    const del = event.target.closest('[data-delete]'); if (del) { const i = Number(del.dataset.delete); state.items.splice(i, 1); if (!state.items.length) state.items.push(blankItem()); renderWorkspace(); scheduleSave(); return; }
    if (event.target.closest('[data-save]')) saveQuote(true);
    if (event.target.closest('[data-preview]')) openPreview();
    if (event.target.closest('[data-csv]')) exportCsv();
    if (event.target.closest('[data-ai]')) analyzeAI();
  }

  function refreshTotals() {
    const root = $('#ceo-project-tab'); if (!root) return;
    const t = totals();
    root.querySelectorAll('[data-net],[data-net2]').forEach((el) => el.textContent = money(t.net));
    root.querySelectorAll('[data-vat],[data-vat2]').forEach((el) => el.textContent = money(t.vat));
    root.querySelectorAll('[data-total],[data-total2]').forEach((el) => el.textContent = money(t.total));
    const count = $('[data-count]', root); if (count) count.textContent = String(state.items.length);
    const sum = $('[data-section-summary]', root); if (sum) sum.innerHTML = sectionSummaryHtml();
  }

  function setStatus(kind, text) { const el = $('[data-status]', $('#ceo-project-tab')); if (!el) return; el.className = `pqw2-status ${kind || ''}`; el.innerHTML = `<span class="dot"></span><span>${esc(text)}</span>`; }
  function scheduleSave() { clearTimeout(state.saveTimer); setStatus('saving', 'Cambios pendientes'); state.saveTimer = setTimeout(() => saveQuote(false), 900); }

  async function saveQuote(notify = false) {
    if (state.saving || !state.projectId) return;
    state.saving = true; setStatus('saving', 'Guardando…');
    try {
      const t = totals();
      const meta = {
        source: MARKER,
        source_workbook: isSalaMusica(state.project) ? OFFICIAL.source : null,
        comments: state.comments,
        ai_analysis: state.ai,
        item_count: state.items.length,
        section_totals: Object.fromEntries(sectionTotals()),
        official_reference: isSalaMusica(state.project) ? { subtotal: OFFICIAL.subtotal, vat: OFFICIAL.vat, total: OFFICIAL.total } : null,
        updated_at: new Date().toISOString()
      };
      const payload = {
        project_id: state.projectId,
        client_name: state.project?.title ? `Proyecto: ${state.project.title}` : 'Cotización interna de proyecto',
        issue_date: state.quote?.issue_date || today(), status: 'draft',
        items: state.items.map((r) => ({ ...r, subtotal: lineSubtotal(r) })),
        subtotal: t.net, discount: 0, net_amount: t.net, vat_rate: Number(state.vatRate) || 0, vat_amount: t.vat, total_amount: t.total,
        notes: JSON.stringify(meta)
      };
      let result;
      if (state.quote?.id) result = await db.from('company_quotations').update(payload).eq('id', state.quote.id).select('*').single();
      else result = await db.from('company_quotations').insert(payload).select('*').single();
      if (result.error) throw result.error;
      state.quote = result.data; state.seeded = false; setStatus('saved', 'Guardado en el expediente');
      if (notify) toast('Cotización guardada.');
      window.dispatchEvent(new CustomEvent('innova-business-sync'));
    } catch (error) { setStatus('error', error.message || 'Error al guardar'); if (notify) toast(error.message || 'No se pudo guardar.', 'error'); }
    finally { state.saving = false; }
  }

  function documentCode() { return state.quote?.id ? `ISE-COT-${String(state.quote.id).replace(/-/g, '').slice(0, 10).toUpperCase()}` : 'ISE-COT-BORRADOR'; }

  function previewHtml() {
    const t = totals(); let lastSection = null; const rows = [];
    state.items.forEach((r) => {
      if (r.section !== lastSection) { lastSection = r.section; rows.push(`<tr><td colspan="7" class="pqw2-doc-section">${esc(r.section || 'Sin sección')}</td></tr>`); }
      rows.push(`<tr><td>${esc(r.group)}</td><td>${esc(r.name)}${r.notes ? `<div style="color:#76829a;margin-top:3px">${esc(r.notes)}</div>` : ''}</td><td>${esc(r.quantity_label)}${r.unit ? ` ${esc(r.unit)}` : ''}</td><td class="num">${esc(r.price_label)}</td><td>${esc(r.supplier)}</td><td class="pqw2-source-link">${esc(r.url)}</td><td class="num">${money(lineSubtotal(r))}</td></tr>`);
    });
    return `<div class="pqw2-document" data-document><div class="pqw2-doc-head"><div class="pqw2-doc-brand"><img src="assets/img/logo1.jpg" alt="Innova Space Education"><div><div style="font-size:.72rem;font-weight:800;color:#6258f3;letter-spacing:.08em">INNOVA SPACE EDUCATION</div><h1>Cotización del proyecto</h1><div class="meta">${esc(state.project?.title || 'Proyecto')} · ${today()}</div></div></div><div style="text-align:right"><div style="font-size:.72rem;color:#7a869f">Borrador</div><strong style="font-size:.78rem">${documentCode()}</strong></div></div><table><thead><tr><th>Grupo</th><th>Ítem / especificación</th><th>Cantidad</th><th class="num">Precio ref.</th><th>Proveedor</th><th>Fuente</th><th class="num">Subtotal</th></tr></thead><tbody>${rows.join('')}</tbody></table><div class="pqw2-doc-totals"><div><span>Neto</span><strong>${money(t.net)}</strong></div><div><span>IVA ${esc(state.vatRate)}%</span><strong>${money(t.vat)}</strong></div><div class="grand"><span>Total</span><strong>${money(t.total)}</strong></div></div>${state.comments ? `<div style="margin-top:22px;font-size:.75rem"><strong>Observaciones</strong><div style="margin-top:5px;color:#68758e">${esc(state.comments)}</div></div>` : ''}<div class="pqw2-doc-footer">Documento generado automáticamente por Innova Space Education a partir del expediente digital del proyecto. El código interno identifica esta emisión dentro del sistema. Documento firmado por la entidad emisora mediante su registro electrónico interno.</div></div>`;
  }

  function openPreview() {
    const modal = document.createElement('div'); modal.className = 'pqw2-modal';
    modal.innerHTML = `<div class="pqw2-modal-card"><div class="pqw2-modal-bar"><div class="pqw2-actions"><button data-print><i class="ri-printer-line"></i>Imprimir</button><button data-pdf><i class="ri-file-pdf-2-line"></i>PDF</button></div><button class="pqw2-icon" data-close><i class="ri-close-line"></i></button></div>${previewHtml()}</div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', async (e) => {
      if (e.target.closest('[data-close]') || e.target === modal) modal.remove();
      if (e.target.closest('[data-print]')) printDocument(modal.querySelector('[data-document]'));
      if (e.target.closest('[data-pdf]')) await exportPdf(modal.querySelector('[data-document]'));
    });
  }

  function printDocument(node) {
    const win = window.open('', '_blank'); if (!win) return;
    win.document.write(`<html><head><title>${esc(state.project?.title || 'Cotización')}</title><style>body{font-family:Arial,sans-serif;margin:30px;color:#18233f}img{width:64px;height:64px;object-fit:contain}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}.num{text-align:right}.pqw2-doc-head{display:flex;justify-content:space-between}.pqw2-doc-brand{display:flex;gap:12px}.pqw2-doc-section{background:#eef1f8;font-weight:bold}.pqw2-doc-totals{margin:20px 0 0 auto;width:320px}.pqw2-doc-totals>div{display:flex;justify-content:space-between;padding:4px}.grand{border-top:1px solid #bbb;font-weight:bold}.pqw2-doc-footer{margin-top:28px;padding-top:12px;border-top:1px solid #ddd;font-size:9px;color:#666}</style></head><body>${node.innerHTML}</body></html>`); win.document.close(); win.focus(); setTimeout(() => win.print(), 200);
  }

  async function exportPdf(node) {
    if (!window.html2pdf) { printDocument(node); return; }
    const opt = { margin: 8, filename: `cotizacion-${slug(state.project?.title || 'proyecto').replace(/ /g, '-')}.pdf`, image: { type: 'jpeg', quality: .98 }, html2canvas: { scale: 1.4 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }, pagebreak: { mode: ['css', 'legacy'] } };
    await window.html2pdf().set(opt).from(node).save();
  }

  function exportCsv() {
    const header = ['Sección','Grupo','Ítem / material / servicio','Cantidad','Unidad','Precio ref.','Subtotal','Proveedor / lugar','Página web / fuente','Notas'];
    const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [header, ...state.items.map((r) => [r.section,r.group,r.name,r.quantity_label,r.unit,r.price_label,lineSubtotal(r),r.supplier,r.url,r.notes])];
    const blob = new Blob(['\ufeff' + lines.map((row) => row.map(csvEscape).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `cotizacion-${slug(state.project?.title || 'proyecto').replace(/ /g, '-')}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function analyzeAI() {
    const button = $('[data-ai]', $('#ceo-project-tab')); if (button) button.disabled = true;
    try {
      const { data: sessionData } = await db.auth.getSession(); const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Sesión no disponible para MIRA.');
      const t = totals();
      const context = { project: { id: state.projectId, title: state.project?.title, budget: state.project?.budget, contracted_amount: state.project?.contracted_amount }, totals: t, vat_rate: state.vatRate, item_count: state.items.length, sections: Object.fromEntries(sectionTotals()), items: state.items.map((r) => ({ section:r.section, group:r.group, name:r.name, quantity:r.quantity_label, price:r.price_label, subtotal:lineSubtotal(r), supplier:r.supplier, url:r.url, notes:r.notes })) };
      const response = await fetch(`${cfg.backendUrl}/api/admin/mira`, { method: 'POST', headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ message: 'Analiza esta cotización del proyecto. Revisa factibilidad, coherencia matemática, partidas sin proveedor o fuente, riesgos de presupuesto, posibles duplicidades y antecedentes faltantes. No inventes precios ni documentos.', context: `COTIZACIÓN PROYECTO\n${JSON.stringify(context).slice(0,45000)}` }) });
      const data = await response.json(); if (!response.ok) throw new Error(data?.error || 'MIRA no respondió.');
      state.ai = data?.answer || data?.message || data?.response || 'Análisis completado.'; renderWorkspace(); scheduleSave();
    } catch (error) { toast(error.message || 'No se pudo analizar con MIRA.', 'error'); }
    finally { if (button) button.disabled = false; }
  }

  function toast(message, type = '') { const root = $('#toast-root'); if (!root) return; const item = document.createElement('div'); item.className = `toast ${type}`; item.textContent = message; root.appendChild(item); setTimeout(() => item.remove(), 4500); }

  const observer = new MutationObserver(() => ensureControls());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureControls, { once: true }); else ensureControls();
})();
