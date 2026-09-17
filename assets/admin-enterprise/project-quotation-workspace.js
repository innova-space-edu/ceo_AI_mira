(() => {
  'use strict';

  const cfg = window.INNOVA_ADMIN_CONFIG;
  const db = window.getInnovaAdminSupabaseClient?.() || window.INNOVA_ADMIN_SUPABASE_CLIENT;
  if (!cfg || !db) return;

  const MARKER = 'project_quotation_workspace';
  const state = { projectId: null, project: null, quote: null, items: [], notes: '', ai: '', vatRate: 19, saving: false, saveTimer: null };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>'\"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
  const num = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const s = String(v ?? '').trim().replace(/\s/g, '').replace(/\$/g, '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
    const n = Number(s); return Number.isFinite(n) ? n : 0;
  };
  const money = (v) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(num(v));
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  function blankItem() {
    return { id: uid(), category: '', name: '', specification: '', quantity: 1, unit: 'un.', unit_price: 0, supplier: '', url: '' };
  }
  function normalizeItem(row) {
    return {
      id: row?.id || uid(), category: row?.category || row?.group || '', name: row?.name || row?.item || row?.description || '',
      specification: row?.specification || row?.details || '', quantity: num(row?.quantity || 1) || 1, unit: row?.unit || 'un.',
      unit_price: num(row?.unit_price ?? row?.price ?? 0), supplier: row?.supplier || row?.provider || '', url: row?.url || row?.link || ''
    };
  }
  function totals() {
    const net = state.items.reduce((s, r) => s + num(r.quantity) * num(r.unit_price), 0);
    const vat = Math.round(net * num(state.vatRate) / 100);
    return { net, vat, total: net + vat };
  }
  function metaFromQuote(q) {
    try { const x = JSON.parse(q?.notes || '{}'); return x && typeof x === 'object' ? x : {}; } catch { return {}; }
  }

  function injectStyle() {
    if ($('#pqw-style')) return;
    const style = document.createElement('style');
    style.id = 'pqw-style';
    style.textContent = `
      #main-content.pqw-enhanced .ceo-project-hero{gap:18px;align-items:stretch}
      #main-content.pqw-enhanced .ceo-summary-card{background:linear-gradient(135deg,#14214d 0%,#30246d 100%);box-shadow:0 18px 44px rgba(25,34,74,.16);border:1px solid rgba(255,255,255,.08);padding:25px 27px}
      #main-content.pqw-enhanced .ceo-summary-card h2{font-size:1.65rem;letter-spacing:-.03em;margin-bottom:8px}
      #main-content.pqw-enhanced .ceo-deadline{box-shadow:0 12px 34px rgba(29,45,88,.08);border-radius:18px;padding:20px}
      #main-content.pqw-enhanced .ceo-deadline>div:last-child{overflow:visible!important}
      #main-content.pqw-enhanced .ceo-tabs{position:sticky;top:74px;z-index:12;background:rgba(245,248,253,.94);backdrop-filter:blur(12px);padding:10px 0 8px;gap:5px;overflow-x:auto}
      #main-content.pqw-enhanced .ceo-tab{white-space:nowrap}
      .pqw-shell{display:grid;gap:16px}.pqw-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
      .pqw-title h3{margin:0 0 5px;font-size:1.18rem;color:#16213d}.pqw-title p{margin:0;color:#6b7893;font-size:.82rem;max-width:720px}
      .pqw-actions{display:flex;gap:8px;flex-wrap:wrap}.pqw-actions button{border:1px solid #d9e0ef;background:#fff;color:#253456;border-radius:10px;padding:9px 12px;font:600 .78rem Inter,sans-serif;cursor:pointer;display:inline-flex;gap:7px;align-items:center}.pqw-actions button.primary{background:#5147ed;color:#fff;border-color:#5147ed}.pqw-actions button.ai{background:#edeafe;color:#5147ed;border-color:#d8d3ff}.pqw-actions button:disabled{opacity:.55;cursor:not-allowed}
      .pqw-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.pqw-metric{background:#fff;border:1px solid #dde4f1;border-radius:14px;padding:14px 15px;box-shadow:0 7px 20px rgba(30,44,80,.045)}.pqw-metric span{display:block;color:#7a86a0;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;font-weight:700}.pqw-metric strong{display:block;margin-top:5px;color:#172342;font-size:1.08rem}.pqw-metric.total{background:#18234c;border-color:#18234c}.pqw-metric.total span,.pqw-metric.total strong{color:#fff}
      .pqw-card{background:#fff;border:1px solid #dde4f1;border-radius:17px;box-shadow:0 10px 28px rgba(29,44,79,.055);overflow:hidden}.pqw-card-head{padding:14px 16px;border-bottom:1px solid #e7ebf4;display:flex;justify-content:space-between;align-items:center;gap:12px}.pqw-card-head strong{color:#1c2948}.pqw-card-body{padding:16px}
      .pqw-table-wrap{overflow:auto;max-width:100%;border:1px solid #e2e7f0;border-radius:12px}.pqw-table{width:100%;border-collapse:separate;border-spacing:0;min-width:1230px;background:#fff}.pqw-table th{position:sticky;top:0;background:#f5f7fb;z-index:2;color:#66738f;font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;padding:9px 8px;text-align:left;border-bottom:1px solid #dfe5ef}.pqw-table td{padding:6px;border-bottom:1px solid #edf0f6;vertical-align:top}.pqw-table tr:last-child td{border-bottom:0}.pqw-table input{width:100%;min-width:0;border:1px solid transparent;border-radius:8px;padding:8px 9px;background:transparent;color:#1f2d4c;font:500 .78rem Inter,sans-serif;outline:none}.pqw-table input:hover{border-color:#e2e6ef;background:#fafbfe}.pqw-table input:focus{border-color:#8179ff;background:#fff;box-shadow:0 0 0 3px rgba(81,71,237,.10)}.pqw-table .num{text-align:right}.pqw-subtotal{font-weight:800;text-align:right;color:#1b2847;white-space:nowrap;padding-top:14px!important}.pqw-row-actions{white-space:nowrap;padding-top:9px!important}.pqw-icon-btn{width:30px;height:30px;border:0;border-radius:8px;background:#f1f3f8;color:#52617f;cursor:pointer;margin-left:3px}.pqw-icon-btn.danger{color:#b93852;background:#fff1f4}
      .pqw-footer-grid{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:14px}.pqw-textarea{width:100%;min-height:108px;resize:vertical;border:1px solid #dfe5ef;border-radius:11px;padding:11px;font:500 .82rem Inter,sans-serif;color:#253453}.pqw-totalbox{border:1px solid #dce2ef;border-radius:13px;padding:12px 14px;background:#f8f9fc;display:grid;gap:8px}.pqw-totalrow{display:flex;justify-content:space-between;gap:12px;color:#66738c;font-size:.82rem}.pqw-totalrow strong{color:#1c2948}.pqw-totalrow.final{padding-top:9px;border-top:1px solid #dfe4ee;font-size:1rem}.pqw-vat{display:flex;align-items:center;gap:7px}.pqw-vat input{width:58px;border:1px solid #d9e0ec;border-radius:7px;padding:5px;text-align:right}
      .pqw-ai-result{white-space:pre-wrap;line-height:1.55;font-size:.82rem;color:#34415f;background:#f8f9fd;border:1px solid #e2e6f0;border-radius:12px;padding:13px}.pqw-save-state{font-size:.72rem;color:#78849d;display:flex;align-items:center;gap:6px}.pqw-save-state .dot{width:7px;height:7px;border-radius:50%;background:#9aa5b8}.pqw-save-state.saving .dot{background:#f1a23c}.pqw-save-state.saved .dot{background:#35a871}.pqw-save-state.error .dot{background:#d44b65}
      .pqw-modal{position:fixed;inset:0;background:rgba(11,18,38,.58);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px}.pqw-modal-card{width:min(1100px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 28px 80px rgba(0,0,0,.25)}.pqw-modal-bar{position:sticky;top:0;background:#fff;border-bottom:1px solid #e5e9f1;padding:12px 14px;display:flex;justify-content:space-between;gap:10px;z-index:3}.pqw-document{padding:38px 42px;color:#18233f}.pqw-document h1{margin:0;font-size:1.5rem}.pqw-document .doc-meta{margin:6px 0 24px;color:#6f7c96}.pqw-document table{width:100%;border-collapse:collapse;font-size:.76rem}.pqw-document th,.pqw-document td{border-bottom:1px solid #dde3ed;padding:9px 7px;text-align:left}.pqw-document th{background:#f4f6fa}.pqw-document td:nth-last-child(1),.pqw-document td:nth-last-child(2),.pqw-document th:nth-last-child(1),.pqw-document th:nth-last-child(2){text-align:right}.pqw-doc-totals{margin:22px 0 0 auto;width:min(340px,100%);display:grid;gap:7px}.pqw-doc-totals>div{display:flex;justify-content:space-between}.pqw-doc-totals .grand{font-size:1.05rem;font-weight:800;border-top:1px solid #ccd4e2;padding-top:9px}.pqw-paste-area{width:100%;height:250px;border:1px solid #dce2ed;border-radius:10px;padding:11px;font:500 .8rem ui-monospace,monospace;resize:vertical}
      @media(max-width:1000px){.pqw-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.pqw-footer-grid{grid-template-columns:1fr}}
      @media(max-width:620px){.pqw-metrics{grid-template-columns:1fr 1fr}.pqw-card-body{padding:11px}.pqw-document{padding:22px 18px}.pqw-actions{width:100%}.pqw-actions button{flex:1;justify-content:center}}
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
    injectStyle(); root.classList.add('pqw-enhanced'); state.projectId = projectId;
    const tabs = root.querySelector('.ceo-tabs');
    if (tabs && !tabs.querySelector('[data-pqw-tab]')) {
      const btn = document.createElement('button'); btn.className = 'ceo-tab'; btn.dataset.pqwTab = 'quotation'; btn.innerHTML = '<i class="ri-file-list-3-line"></i> Cotización';
      btn.addEventListener('click', () => openWorkspace(projectId)); tabs.appendChild(btn);
      tabs.addEventListener('click', (e) => { if (e.target.closest('[data-ceo-tab]')) btn.classList.remove('active'); });
    }
    const headActions = root.querySelector('.ceo-head .ceo-actions:last-child');
    if (headActions && !headActions.querySelector('[data-pqw-open]')) {
      const btn = document.createElement('button'); btn.className = 'btn ghost'; btn.dataset.pqwOpen = projectId; btn.innerHTML = '<i class="ri-file-add-line"></i> Crear cotización';
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
    state.quote = quotes.find((row) => metaFromQuote(row).source === MARKER) || null;
    const meta = metaFromQuote(state.quote);
    state.items = Array.isArray(state.quote?.items) ? state.quote.items.map(normalizeItem) : [blankItem()];
    if (!state.items.length) state.items = [blankItem()];
    state.notes = meta.comments || '';
    state.ai = meta.ai_analysis || '';
    state.vatRate = Number.isFinite(Number(state.quote?.vat_rate)) ? Number(state.quote.vat_rate) : 19;
  }

  async function openWorkspace(projectId) {
    const root = $('#ceo-project-tab'); if (!root) return;
    $$('.ceo-tab', $('#main-content')).forEach((b) => b.classList.remove('active'));
    $('[data-pqw-tab]', $('#main-content'))?.classList.add('active');
    root.innerHTML = '<section class="ceo-panel"><div class="ceo-panel-body"><div class="ceo-empty"><i class="ri-loader-4-line"></i><strong>Cargando cotización…</strong></div></div></section>';
    try { await loadWorkspace(projectId); renderWorkspace(); }
    catch (error) { root.innerHTML = `<section class="ceo-panel"><div class="ceo-panel-body"><div class="ceo-inline-warning">${esc(error.message || 'No se pudo cargar la cotización.')}</div></div></section>`; }
  }

  function itemRow(r, i) {
    const sub = num(r.quantity) * num(r.unit_price);
    return `<tr data-pqw-row="${i}">
      <td><input data-field="category" value="${esc(r.category)}" placeholder="Ej. Acústica"></td>
      <td><input data-field="name" value="${esc(r.name)}" placeholder="Material o servicio"></td>
      <td><input data-field="specification" value="${esc(r.specification)}" placeholder="Marca, medida, modelo…"></td>
      <td><input class="num" data-field="quantity" inputmode="decimal" value="${esc(r.quantity)}"></td>
      <td><input data-field="unit" value="${esc(r.unit)}" placeholder="un."></td>
      <td><input class="num" data-field="unit_price" inputmode="numeric" value="${esc(r.unit_price || '')}" placeholder="0"></td>
      <td><input data-field="supplier" value="${esc(r.supplier)}" placeholder="Tienda / proveedor"></td>
      <td><input data-field="url" value="${esc(r.url)}" placeholder="https://…"></td>
      <td class="pqw-subtotal" data-subtotal>${money(sub)}</td>
      <td class="pqw-row-actions"><button class="pqw-icon-btn" data-dup="${i}" title="Duplicar"><i class="ri-file-copy-line"></i></button><button class="pqw-icon-btn danger" data-del="${i}" title="Eliminar"><i class="ri-delete-bin-line"></i></button></td>
    </tr>`;
  }

  function renderWorkspace() {
    const root = $('#ceo-project-tab'); if (!root) return;
    const t = totals();
    root.innerHTML = `<div class="pqw-shell">
      <div class="pqw-head"><div class="pqw-title"><h3>Cotización del proyecto</h3><p>Planilla nativa del expediente. Los agentes pueden leer cada cantidad, precio, proveedor y enlace sin depender de un archivo externo.</p></div><div class="pqw-actions">
        <button data-pqw-paste><i class="ri-clipboard-line"></i> Pegar lista</button><button data-pqw-csv><i class="ri-file-excel-2-line"></i> CSV</button><button data-pqw-preview><i class="ri-eye-line"></i> Vista previa</button><button class="ai" data-pqw-ai><i class="ri-sparkling-2-line"></i> Analizar IA</button><button class="primary" data-pqw-save><i class="ri-save-line"></i> Guardar</button>
      </div></div>
      <div class="pqw-metrics"><div class="pqw-metric"><span>Ítems</span><strong data-pqw-count>${state.items.length}</strong></div><div class="pqw-metric"><span>Neto</span><strong data-pqw-net>${money(t.net)}</strong></div><div class="pqw-metric"><span>IVA ${esc(state.vatRate)}%</span><strong data-pqw-vat>${money(t.vat)}</strong></div><div class="pqw-metric total"><span>Total estimado</span><strong data-pqw-total>${money(t.total)}</strong></div></div>
      <section class="pqw-card"><div class="pqw-card-head"><div><strong>Listado de materiales, equipos y servicios</strong><div class="pqw-save-state" data-pqw-state><span class="dot"></span><span>Sin cambios pendientes</span></div></div><div class="pqw-actions"><button data-pqw-add><i class="ri-add-line"></i> Agregar fila</button></div></div><div class="pqw-card-body"><div class="pqw-table-wrap"><table class="pqw-table"><thead><tr><th style="width:120px">Grupo</th><th style="width:190px">Ítem</th><th style="width:230px">Especificación</th><th style="width:90px">Cantidad</th><th style="width:85px">Unidad</th><th style="width:120px">Precio unit.</th><th style="width:170px">Proveedor</th><th style="width:180px">Enlace</th><th style="width:120px;text-align:right">Subtotal</th><th style="width:80px"></th></tr></thead><tbody data-pqw-body>${state.items.map(itemRow).join('')}</tbody></table></div></div></section>
      <div class="pqw-footer-grid"><section class="pqw-card"><div class="pqw-card-head"><strong>Observaciones y antecedentes</strong></div><div class="pqw-card-body"><textarea class="pqw-textarea" data-pqw-notes placeholder="Condiciones, alternativas, restricciones, proveedores por confirmar…">${esc(state.notes)}</textarea>${state.ai ? `<div style="height:12px"></div><div class="pqw-ai-result" data-pqw-ai-result>${esc(state.ai)}</div>` : '<div data-pqw-ai-result></div>'}</div></section>
      <section class="pqw-card"><div class="pqw-card-head"><strong>Totales</strong></div><div class="pqw-card-body"><div class="pqw-totalbox"><div class="pqw-totalrow"><span>Neto</span><strong data-pqw-net2>${money(t.net)}</strong></div><div class="pqw-totalrow"><span class="pqw-vat">IVA <input data-pqw-vatrate inputmode="decimal" value="${esc(state.vatRate)}">%</span><strong data-pqw-vat2>${money(t.vat)}</strong></div><div class="pqw-totalrow final"><span>Total</span><strong data-pqw-total2>${money(t.total)}</strong></div></div></div></section></div>
    </div>`;
    bindWorkspace();
  }

  function syncRowFromInput(input) {
    const tr = input.closest('[data-pqw-row]'); if (!tr) return;
    const i = Number(tr.dataset.pqwRow); const row = state.items[i]; if (!row) return;
    const field = input.dataset.field; row[field] = ['quantity','unit_price'].includes(field) ? num(input.value) : input.value;
    tr.querySelector('[data-subtotal]').textContent = money(num(row.quantity) * num(row.unit_price)); updateTotals(); scheduleSave();
  }
  function updateTotals() {
    const t = totals();
    $('[data-pqw-count]') && ($('[data-pqw-count]').textContent = state.items.length);
    for (const [sel, val] of [['[data-pqw-net]',t.net],['[data-pqw-net2]',t.net],['[data-pqw-vat]',t.vat],['[data-pqw-vat2]',t.vat],['[data-pqw-total]',t.total],['[data-pqw-total2]',t.total]]) { const el=$(sel); if(el) el.textContent=money(val); }
  }
  function saveState(kind, text) { const el=$('[data-pqw-state]'); if (!el) return; el.className=`pqw-save-state ${kind||''}`; el.querySelector('span:last-child').textContent=text; }
  function scheduleSave() { clearTimeout(state.saveTimer); saveState('saving','Cambios pendientes…'); state.saveTimer=setTimeout(()=>save(false),900); }

  async function save(notify = true) {
    if (state.saving || !state.projectId) return;
    state.saving = true; saveState('saving','Guardando…');
    try {
      const t = totals(); const payloadMeta = { source: MARKER, version: 2, comments: state.notes, ai_analysis: state.ai, saved_at: new Date().toISOString() };
      const payload = {
        direction: 'purchase', project_id: state.projectId, quote_number: state.quote?.quote_number || `COT-PROY-${new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,12)}`,
        client_name: state.project?.title ? `Proyecto: ${state.project.title}` : 'Cotización interna de proyecto', issue_date: state.quote?.issue_date || today(), status: 'draft',
        items: state.items.map(({id,...r}) => ({...r, subtotal: num(r.quantity)*num(r.unit_price)})), subtotal: t.net, discount: 0, net_amount: t.net,
        vat_rate: num(state.vatRate), vat_amount: t.vat, total_amount: t.total, notes: JSON.stringify(payloadMeta)
      };
      let result;
      if (state.quote?.id) result = await db.from('company_quotations').update(payload).eq('id', state.quote.id).select('*').single();
      else result = await db.from('company_quotations').insert(payload).select('*').single();
      if (result.error) throw result.error; state.quote = result.data; saveState('saved','Guardado en el expediente'); if (notify) toast('Cotización guardada.');
      window.dispatchEvent(new CustomEvent('innova-business-sync'));
    } catch (error) { saveState('error', error.message || 'Error al guardar'); if (notify) toast(error.message || 'No se pudo guardar.', 'error'); }
    finally { state.saving = false; }
  }

  function bindWorkspace() {
    $$('[data-field]').forEach((input) => input.addEventListener('input', () => syncRowFromInput(input)));
    $('[data-pqw-notes]')?.addEventListener('input', (e) => { state.notes=e.target.value; scheduleSave(); });
    $('[data-pqw-vatrate]')?.addEventListener('input', (e) => { state.vatRate=num(e.target.value); updateTotals(); scheduleSave(); });
    $('[data-pqw-add]')?.addEventListener('click', () => { state.items.push(blankItem()); renderWorkspace(); scheduleSave(); });
    $$('[data-dup]').forEach((b)=>b.addEventListener('click',()=>{ const r=state.items[Number(b.dataset.dup)]; state.items.splice(Number(b.dataset.dup)+1,0,normalizeItem(r)); renderWorkspace(); scheduleSave(); }));
    $$('[data-del]').forEach((b)=>b.addEventListener('click',()=>{ if(state.items.length===1) state.items=[blankItem()]; else state.items.splice(Number(b.dataset.del),1); renderWorkspace(); scheduleSave(); }));
    $('[data-pqw-save]')?.addEventListener('click',()=>save(true)); $('[data-pqw-preview]')?.addEventListener('click',preview); $('[data-pqw-csv]')?.addEventListener('click',exportCsv); $('[data-pqw-paste]')?.addEventListener('click',openPaste); $('[data-pqw-ai]')?.addEventListener('click',analyze);
  }

  function toast(message, type='success') {
    const root=$('#toast-root'); if(!root){console[type==='error'?'error':'log'](message);return;}
    const el=document.createElement('div'); el.className=`toast ${type}`; el.textContent=message; root.appendChild(el); setTimeout(()=>el.remove(),4200);
  }

  function documentHtml() {
    const t=totals(); const rows=state.items.filter(r=>r.name||r.specification||num(r.unit_price));
    return `<div class="pqw-document" id="pqw-document"><div style="display:flex;justify-content:space-between;gap:20px;align-items:flex-start"><div><div style="font-size:.72rem;font-weight:800;letter-spacing:.08em;color:#655cf2">INNOVA SPACE EDUCATION</div><h1>Cotización del proyecto</h1><div class="doc-meta">${esc(state.project?.title||'Proyecto')} · ${esc(today())}</div></div><div style="text-align:right;font-size:.75rem;color:#66738d">${esc(state.quote?.quote_number||'Borrador')}</div></div><table><thead><tr><th>Grupo</th><th>Ítem / especificación</th><th>Cant.</th><th>Precio unit.</th><th>Proveedor</th><th>Subtotal</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.category)}</td><td><strong>${esc(r.name)}</strong>${r.specification?`<br><span style="color:#71809a">${esc(r.specification)}</span>`:''}</td><td>${esc(r.quantity)} ${esc(r.unit)}</td><td>${money(r.unit_price)}</td><td>${r.url?`<a href="${esc(r.url)}">${esc(r.supplier||'Enlace')}</a>`:esc(r.supplier)}</td><td>${money(num(r.quantity)*num(r.unit_price))}</td></tr>`).join('')}</tbody></table><div class="pqw-doc-totals"><div><span>Neto</span><strong>${money(t.net)}</strong></div><div><span>IVA ${esc(state.vatRate)}%</span><strong>${money(t.vat)}</strong></div><div class="grand"><span>Total</span><strong>${money(t.total)}</strong></div></div>${state.notes?`<div style="margin-top:26px"><strong>Observaciones</strong><p style="white-space:pre-wrap;color:#53617d;font-size:.8rem;line-height:1.5">${esc(state.notes)}</p></div>`:''}</div>`;
  }
  function preview() {
    const modal=document.createElement('div'); modal.className='pqw-modal'; modal.innerHTML=`<div class="pqw-modal-card"><div class="pqw-modal-bar"><div class="pqw-actions"><button data-print><i class="ri-printer-line"></i> Imprimir</button><button data-pdf><i class="ri-file-pdf-2-line"></i> PDF</button></div><button class="pqw-icon-btn" data-close><i class="ri-close-line"></i></button></div>${documentHtml()}</div>`; document.body.appendChild(modal);
    modal.querySelector('[data-close]').onclick=()=>modal.remove(); modal.addEventListener('click',(e)=>{if(e.target===modal)modal.remove();});
    modal.querySelector('[data-print]').onclick=()=>{const w=window.open('','_blank'); if(!w)return; w.document.write(`<html><head><title>Cotización</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#18233f}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}.pqw-doc-totals{margin:20px 0 0 auto;width:320px}.pqw-doc-totals>div{display:flex;justify-content:space-between;margin:6px 0}.grand{font-weight:bold;border-top:1px solid #aaa;padding-top:8px}.doc-meta{color:#666;margin:5px 0 22px}</style></head><body>${documentHtml()}</body></html>`);w.document.close();w.focus();setTimeout(()=>w.print(),200);};
    modal.querySelector('[data-pdf]').onclick=()=>{const doc=modal.querySelector('#pqw-document'); if(window.html2pdf){window.html2pdf().set({margin:8,filename:`cotizacion-${(state.project?.title||'proyecto').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.pdf`,html2canvas:{scale:2},jsPDF:{unit:'mm',format:'a4',orientation:'landscape'}}).from(doc).save();}else toast('PDF no disponible; usa Imprimir > Guardar como PDF.','warning');};
  }

  function exportCsv() {
    const headers=['Grupo','Ítem','Especificación','Cantidad','Unidad','Precio unitario','Proveedor','Enlace','Subtotal']; const q=(v)=>`"${String(v??'').replace(/"/g,'""')}"`;
    const lines=[headers.map(q).join(';'),...state.items.map(r=>[r.category,r.name,r.specification,r.quantity,r.unit,r.unit_price,r.supplier,r.url,num(r.quantity)*num(r.unit_price)].map(q).join(';'))];
    const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`cotizacion-${(state.project?.title||'proyecto').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
  }

  function parsePaste(text) {
    return String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).filter(x=>!/^\|?\s*:?-{3}/.test(x)).map(line=>{
      let cells=line.includes('\t')?line.split('\t'):line.includes('|')?line.split('|').map(s=>s.trim()).filter((_,i,a)=>!(i===0&&a[i]==='')&&!(i===a.length-1&&a[i]==='')):line.split(';');
      cells=cells.map(s=>s.replace(/\*\*/g,'').trim()); if(/grupo.*material|grupo.*elemento|partida general/i.test(cells.join(' ')))return null;
      const [category='',name='',quantity='1',price='0',supplier='',url='']=cells;
      return normalizeItem({category,name,quantity:quantity.replace(/[^0-9,.-].*$/,''),unit:quantity.replace(/^[0-9.,\s]+/,'').trim()||'un.',price,supplier,url});
    }).filter(Boolean);
  }
  function openPaste() {
    const modal=document.createElement('div');modal.className='pqw-modal';modal.innerHTML=`<div class="pqw-modal-card" style="max-width:760px"><div class="pqw-modal-bar"><strong>Pegar listado</strong><button class="pqw-icon-btn" data-close><i class="ri-close-line"></i></button></div><div style="padding:18px"><p style="font-size:.8rem;color:#66738c">Pega filas desde Excel/Sheets o una tabla Markdown. Se agregarán al listado actual.</p><textarea class="pqw-paste-area" placeholder="Grupo    Ítem    Cantidad    Precio    Proveedor    Enlace"></textarea><div class="pqw-actions" style="justify-content:flex-end;margin-top:12px"><button class="primary" data-import>Agregar filas</button></div></div></div>`;document.body.appendChild(modal);modal.querySelector('[data-close]').onclick=()=>modal.remove();modal.querySelector('[data-import]').onclick=()=>{const rows=parsePaste(modal.querySelector('textarea').value);if(!rows.length)return toast('No se detectaron filas válidas.','warning'); if(state.items.length===1&&!state.items[0].name&&!state.items[0].specification)state.items=[];state.items.push(...rows);modal.remove();renderWorkspace();scheduleSave();toast(`${rows.length} fila(s) agregada(s).`);};
  }

  async function analyze() {
    const btn=$('[data-pqw-ai]'); if(btn){btn.disabled=true;btn.innerHTML='<i class="ri-loader-4-line"></i> Analizando…';}
    try {
      await save(false); const session=(await db.auth.getSession()).data.session; if(!session?.access_token)throw new Error('Sesión no disponible.');
      const [files,po,events]=await Promise.all([
        db.from('company_files').select('title,category,notes,metadata,created_at').eq('project_id',state.projectId).limit(100),
        db.from('company_purchase_orders').select('order_number,status,items,total_amount,notes').eq('project_id',state.projectId).limit(50),
        db.from('company_project_events').select('event_type,title,description,amount,status,event_date').eq('project_id',state.projectId).order('event_date',{ascending:false}).limit(50)
      ]);
      const context={project:state.project,quotation:{items:state.items,totals:totals(),vat_rate:state.vatRate,comments:state.notes},files:files.data||[],purchase_orders:po.data||[],events:events.data||[]};
      const response=await fetch(`${cfg.backendUrl}/api/admin/mira`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({message:'Analiza la factibilidad de esta cotización de proyecto. Identifica ítems sin precio, proveedor o enlace; posibles duplicados; inconsistencias de cantidades/subtotales; riesgos frente a presupuesto/plazo; antecedentes faltantes y próximos pasos. No inventes precios ni proveedores.',context:`COTIZACIÓN ESTRUCTURADA DEL PROYECTO\n${JSON.stringify(context).slice(0,45000)}`,history:[]})});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'No fue posible consultar MIRA.');state.ai=String(data.reply||'').trim();const box=$('[data-pqw-ai-result]');if(box){box.className='pqw-ai-result';box.textContent=state.ai;}await save(false);
      try{await db.from('company_project_events').insert({project_id:state.projectId,event_type:'analysis',title:'Análisis de factibilidad de cotización',description:state.ai.slice(0,3500),event_date:new Date().toISOString(),status:'confirmed'});}catch{}
      toast('Análisis de factibilidad completado.');
    }catch(error){toast(error.message||'No se pudo analizar la cotización.','error');}finally{if(btn){btn.disabled=false;btn.innerHTML='<i class="ri-sparkling-2-line"></i> Analizar IA';}}
  }

  let scheduled=false;
  function scan(){scheduled=false;ensureControls();}
  const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(scan);});
  function boot(){injectStyle();observer.observe(document.getElementById('main-content')||document.body,{childList:true,subtree:true});ensureControls();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
