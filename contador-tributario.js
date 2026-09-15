(() => {
  'use strict';

  const cfg = window.INNOVA_ADMIN_CONFIG;
  const client = window.getInnovaAdminSupabaseClient?.() || window.INNOVA_ADMIN_SUPABASE_CLIENT;
  if (!cfg || !client) return;

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const money = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(n || 0));
  const esc = (v = '') => String(v).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  const norm = (v = '') => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const rut = (v = '') => String(v).toUpperCase().replace(/[^0-9K]/g, '');
  const num = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    let s = String(v ?? '').trim().replace(/\s/g, '').replace(/\$/g, '');
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    else if (/^-?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
    else if (s.includes(',')) s = s.replace(',', '.');
    s = s.replace(/[^0-9.-]/g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };
  const safe = (v = '') => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 100) || 'archivo';
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const period = () => $('#global-period')?.value || new Date().toISOString().slice(0, 7);
  const bounds = (p) => { const [y, m] = p.split('-').map(Number); const start = `${p}-01`; const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); return { start, next }; };
  const main = () => $('#main');
  const title = (t) => { const el = $('#view-title'); if (el) el.textContent = t; };
  const toast = (msg, type = '') => { const root = $('#toast-root'); if (!root) return; const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = msg; root.appendChild(el); setTimeout(() => el.remove(), 4200); };
  const modal = (heading, body, foot = '') => { const root = $('#modal-root'); root.innerHTML = `<div class="modal-backdrop"><section class="modal"><header class="modal-head"><h3>${esc(heading)}</h3><button class="icon-btn tax-modal-close"><i class="ri-close-line"></i></button></header><div class="modal-body">${body}</div><footer class="modal-foot">${foot}</footer></section></div>`; $$('.tax-modal-close', root).forEach(b => b.onclick = () => root.innerHTML = ''); return root; };
  const closeModal = () => { const root = $('#modal-root'); if (root) root.innerHTML = ''; };
  const dteName = (code) => ({ '33': 'Factura electrónica', '34': 'Factura exenta', '39': 'Boleta electrónica', '41': 'Boleta exenta', '56': 'Nota de débito', '61': 'Nota de crédito', '52': 'Guía de despacho' }[String(code)] || `DTE ${code || '—'}`);
  const signed = (n, type) => String(type) === '61' ? -Math.abs(Number(n || 0)) : Math.abs(Number(n || 0));
  const field = (obj, aliases) => { const map = new Map(Object.keys(obj).map(k => [norm(k), k])); for (const a of aliases) { const na = norm(a); if (map.has(na)) return obj[map.get(na)]; const partial = [...map.keys()].find(k => k.includes(na) || na.includes(k)); if (partial) return obj[map.get(partial)]; } return ''; };
  const isoDate = (v) => { const s = String(v || '').trim(); let m = s.match(/^(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})$/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](20\d{2})$/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return s.slice(0, 10); };

  let activeView = null;
  let profile = null;

  async function sessionProfile() {
    const { data } = await client.auth.getSession();
    const session = data?.session;
    if (!session) { location.href = 'admin.html'; return null; }
    const { data: p } = await client.from('company_users').select('*').eq('id', session.user.id).maybeSingle();
    profile = p || { id: session.user.id, email: session.user.email, role: 'viewer', full_name: session.user.email };
    return { session, profile };
  }

  async function loadPeriod(p = period()) {
    const { start, next } = bounds(p);
    const [invoices, tax, bank, files, projects] = await Promise.all([
      client.from('company_invoices').select('*').gte('issue_date', start).lt('issue_date', next).order('issue_date', { ascending: false }),
      client.from('company_tax_records').select('*').eq('period', start).order('created_at', { ascending: false }),
      client.from('company_bank_movements').select('*').gte('movement_date', start).lt('movement_date', next).order('movement_date', { ascending: false }),
      client.from('company_files').select('id,title,original_name,storage_path,mime_type,file_size,metadata,created_at,project_id,category').in('category', ['invoice', 'tax']).gte('created_at', `${start}T00:00:00`).lt('created_at', `${next}T00:00:00`).order('created_at', { ascending: false }),
      client.from('company_projects').select('id,title,budget,status').order('title')
    ]);
    return {
      invoices: invoices.data || [], tax: tax.data || [], bank: bank.data || [], files: files.data || [], projects: projects.data || [],
      errors: [invoices.error, tax.error, bank.error, files.error, projects.error].filter(Boolean)
    };
  }

  function parseCSV(text) {
    const first = text.split(/\r?\n/).find(l => l.trim()) || '';
    const candidates = [';', '\t', ','];
    const delim = candidates.sort((a, b) => first.split(b).length - first.split(a).length)[0];
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], n = text[i + 1];
      if (c === '"' && quoted && n === '"') { cell += '"'; i++; continue; }
      if (c === '"') { quoted = !quoted; continue; }
      if (c === delim && !quoted) { row.push(cell); cell = ''; continue; }
      if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && n === '\n') i++; row.push(cell); cell = ''; if (row.some(x => String(x).trim())) rows.push(row); row = []; continue; }
      cell += c;
    }
    row.push(cell); if (row.some(x => String(x).trim())) rows.push(row);
    if (!rows.length) return [];
    const headers = rows.shift().map((h, i) => String(h || `col_${i + 1}`).trim());
    return rows.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
  }

  async function tableRows(file) {
    const lower = file.name.toLowerCase();
    if ((lower.endsWith('.xlsx') || lower.endsWith('.xls')) && window.XLSX) {
      const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
      return window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    }
    return parseCSV(await file.text());
  }

  function normalizeRCV(rows, book) {
    return rows.map((r, index) => {
      const type = String(field(r, ['tipo doc', 'tipo documento', 'tipo dte', 'tipo']) || '').replace(/\D/g, '') || String(field(r, ['tipo doc']) || '').trim();
      const folio = String(field(r, ['folio', 'numero documento', 'nro documento', 'numero']) || '').trim();
      const counterpartyRut = String(field(r, book === 'purchases' ? ['rut proveedor', 'rut emisor', 'rut contraparte'] : ['rut cliente', 'rut receptor', 'rut contraparte']) || '').trim();
      const counterpartyName = String(field(r, book === 'purchases' ? ['razon social', 'razon social proveedor', 'nombre proveedor'] : ['razon social', 'razon social receptor', 'nombre cliente']) || '').trim();
      const issueDate = isoDate(field(r, ['fecha docto', 'fecha documento', 'fecha emision', 'fecha']));
      const net = num(field(r, ['monto neto', 'neto']));
      const exempt = num(field(r, ['monto exento', 'exento']));
      const vatRecoverable = num(field(r, ['iva recuperable', 'monto iva recuperable', 'iva recup']));
      const vatNotRecoverable = num(field(r, ['iva no recuperable', 'monto iva no recuperable']));
      const vatGeneric = num(field(r, ['monto iva', 'iva']));
      const total = num(field(r, ['monto total', 'total']));
      const vat = vatRecoverable || vatGeneric;
      return { index, type, folio, counterpartyRut, counterpartyName, issueDate, net, exempt, vat, vatRecoverable, vatNotRecoverable, total, raw: r };
    }).filter(r => r.folio || r.total || r.counterpartyRut);
  }

  function keyRCV(r) { return `${String(r.type || '')}|${String(r.folio || '')}|${rut(r.counterpartyRut)}`; }
  function keyInvoice(i) {
    const cp = i.invoice_type === 'sale' ? (i.recipient_rut || '') : (i.issuer_rut || '');
    return `${String(i.dte_type || '')}|${String(i.folio || '')}|${rut(cp)}`;
  }

  function compareRows(rcvRows, invoices, book) {
    const relevant = invoices.filter(i => book === 'purchases' ? i.invoice_type === 'purchase' : i.invoice_type === 'sale');
    const rcvMap = new Map(), dbMap = new Map();
    rcvRows.forEach(r => { const k = keyRCV(r); const a = rcvMap.get(k) || []; a.push(r); rcvMap.set(k, a); });
    relevant.forEach(i => { const k = keyInvoice(i); const a = dbMap.get(k) || []; a.push(i); dbMap.set(k, a); });
    const keys = new Set([...rcvMap.keys(), ...dbMap.keys()]);
    const diffs = []; let matched = 0, mismatched = 0, siiOnly = 0, dbOnly = 0, duplicates = 0;
    keys.forEach(k => {
      const rs = rcvMap.get(k) || [], ds = dbMap.get(k) || [];
      if (rs.length > 1 || ds.length > 1) duplicates++;
      if (rs.length && ds.length) {
        const r = rs[0], d = ds[0]; const delta = Math.abs(Number(r.total || 0) - Number(d.total_amount || 0));
        if (delta <= 1) { matched++; diffs.push({ status: 'ok', label: 'Coincide', r, d, delta }); }
        else { mismatched++; diffs.push({ status: 'warn', label: 'Monto distinto', r, d, delta }); }
      } else if (rs.length) { siiOnly++; diffs.push({ status: 'bad', label: 'Solo SII', r: rs[0], d: null, delta: rs[0].total }); }
      else { dbOnly++; diffs.push({ status: 'bad', label: 'Solo base', r: null, d: ds[0], delta: ds[0].total_amount }); }
    });
    return { matched, mismatched, siiOnly, dbOnly, duplicates, diffs, dbCount: relevant.length, siiCount: rcvRows.length };
  }

  async function findRCVFile(data, book) {
    const candidates = data.files.filter(f => f.category === 'tax' && f.metadata?.kind === 'rcv' && f.metadata?.period === period() && f.metadata?.book === book);
    return candidates.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
  }

  async function readStoredTable(fileRow) {
    if (!fileRow?.storage_path) return [];
    const { data, error } = await client.storage.from(cfg.storageBucket).download(fileRow.storage_path);
    if (error) throw error;
    const file = new File([data], fileRow.original_name || 'rcv.csv', { type: fileRow.mime_type || data.type });
    return tableRows(file);
  }

  async function uploadTaxFile(file, metadata, titleText) {
    const auth = await client.auth.getSession(); const user = auth.data?.session?.user;
    if (!user) throw new Error('Sesión expirada');
    const p = metadata.period || period(); const [y, m] = p.split('-');
    const path = `${user.id}/contabilidad/${y}/${m}/sii/${uuid()}-${safe(file.name)}`;
    const up = await client.storage.from(cfg.storageBucket).upload(path, file, { contentType: file.type || 'application/octet-stream' });
    if (up.error) throw up.error;
    const ins = await client.from('company_files').insert({
      project_id: metadata.project_id || null, category: 'tax', title: titleText, original_name: file.name,
      storage_path: path, mime_type: file.type || null, file_size: file.size, metadata, created_by: user.id
    }).select().single();
    if (ins.error) { await client.storage.from(cfg.storageBucket).remove([path]); throw ins.error; }
    return ins.data;
  }

  async function upsertTaxRecord(recordType, payload) {
    const p = `${period()}-01`;
    const { data: existing } = await client.from('company_tax_records').select('id').eq('period', p).eq('record_type', recordType).order('created_at', { ascending: false }).limit(1);
    if (existing?.[0]?.id) return client.from('company_tax_records').update(payload).eq('id', existing[0].id).select().single();
    return client.from('company_tax_records').insert({ period: p, record_type: recordType, ...payload }).select().single();
  }

  async function importRCV() {
    const root = modal('Importar Registro de Compras y Ventas', `<div class="form-grid">
      <label class="field"><span>Libro</span><select id="rcv-book"><option value="purchases">RCV Compras</option><option value="sales">RCV Ventas</option></select></label>
      <label class="field"><span>Período</span><input id="rcv-period" type="month" value="${esc(period())}" /></label>
      <label class="dropzone full"><i class="ri-file-excel-2-line"></i><strong>Archivo exportado desde el SII</strong><span>CSV, TXT, XLS o XLSX del Registro de Compras y Ventas.</span><input id="rcv-file" type="file" accept=".csv,.txt,.xls,.xlsx,text/csv,text/plain" /></label>
      <div id="rcv-preview" class="full alert info">El archivo será conservado en Storage y se usará para conciliación con la base de datos.</div>
    </div>`, `<button class="btn tax-modal-close">Cancelar</button><button id="rcv-save" class="btn primary">Importar y conciliar</button>`);
    const input = $('#rcv-file', root); $('.dropzone', root).onclick = () => input.click();
    input.onchange = async () => { const f = input.files?.[0]; if (!f) return; try { const rows = await tableRows(f); $('#rcv-preview', root).textContent = `${f.name}: ${rows.length.toLocaleString('es-CL')} filas detectadas.`; } catch (e) { $('#rcv-preview', root).textContent = `No fue posible leer el archivo: ${e.message}`; } };
    $('#rcv-save', root).onclick = async () => {
      const f = input.files?.[0]; if (!f) return toast('Selecciona el archivo exportado desde SII.', 'warn');
      const book = $('#rcv-book', root).value; const p = $('#rcv-period', root).value || period();
      if (p !== period()) $('#global-period').value = p;
      try {
        const raw = await tableRows(f); const rows = normalizeRCV(raw, book);
        if (!rows.length) throw new Error('No se detectaron filas tributarias reconocibles');
        const totalNet = rows.reduce((a, r) => a + signed(r.net, r.type), 0);
        const totalVat = rows.reduce((a, r) => a + signed(r.vatRecoverable || r.vat, r.type), 0);
        const total = rows.reduce((a, r) => a + signed(r.total, r.type), 0);
        const stored = await uploadTaxFile(f, { module: 'contador', source: 'sii', kind: 'rcv', book, period: p, row_count: rows.length, imported_at: new Date().toISOString() }, `RCV ${book === 'purchases' ? 'Compras' : 'Ventas'} ${p}`);
        const payload = { status: 'imported', net_amount: Math.round(totalNet), debit_vat: book === 'sales' ? Math.round(totalVat) : 0, credit_vat: book === 'purchases' ? Math.round(totalVat) : 0, tax_amount: Math.round(totalVat), total_amount: Math.round(total), notes: JSON.stringify({ source_file_id: stored.id, rows: rows.length, book, imported_at: new Date().toISOString() }) };
        const res = await upsertTaxRecord(`rcv_${book}`, payload); if (res.error) throw res.error;
        closeModal(); toast('RCV importado y registrado.'); activeView = 'rcv'; await renderRCV();
      } catch (e) { console.error(e); toast(e.message || 'No fue posible importar el RCV.', 'error'); }
    };
  }

  async function renderRCV() {
    title('RCV / SII'); main().innerHTML = '<div class="empty"><i class="ri-loader-4-line"></i><strong>Conciliando RCV…</strong></div>';
    const data = await loadPeriod();
    const [pf, sf] = await Promise.all([findRCVFile(data, 'purchases'), findRCVFile(data, 'sales')]);
    let purchases = [], sales = [], pcmp = null, scmp = null, err = '';
    try { if (pf) purchases = normalizeRCV(await readStoredTable(pf), 'purchases'); if (sf) sales = normalizeRCV(await readStoredTable(sf), 'sales'); pcmp = pf ? compareRows(purchases, data.invoices, 'purchases') : null; scmp = sf ? compareRows(sales, data.invoices, 'sales') : null; } catch (e) { err = e.message; }
    const invoiceFiles = data.files.filter(f => f.category === 'invoice'); const linked = new Set(data.invoices.map(i => i.source_file_id).filter(Boolean)); const orphan = invoiceFiles.filter(f => !linked.has(f.id));
    const mismatches = [...(pcmp?.diffs || []), ...(scmp?.diffs || [])].filter(x => x.status !== 'ok').slice(0, 80);
    const matched = (pcmp?.matched || 0) + (scmp?.matched || 0), siiOnly = (pcmp?.siiOnly || 0) + (scmp?.siiOnly || 0), dbOnly = (pcmp?.dbOnly || 0) + (scmp?.dbOnly || 0), amountDiff = (pcmp?.mismatched || 0) + (scmp?.mismatched || 0);
    main().innerHTML = `<div class="page-head"><div><h2>RCV / SII</h2><p>Conciliación de Registro de Compras y Ventas contra los DTE estructurados y los archivos tributarios almacenados en Innova.</p></div><div class="actions"><button id="import-rcv" class="btn primary"><i class="ri-upload-cloud-2-line"></i> Importar RCV</button><button id="mira-rcv" class="btn soft"><i class="ri-bard-line"></i> Auditar con MIRA</button></div></div>
      <div class="tax-matrix">
        <div class="matrix-card good"><span>Coincidencias SII ↔ BD</span><strong>${matched}</strong><small>Folio, tipo DTE, contraparte y total compatibles.</small></div>
        <div class="matrix-card ${siiOnly ? 'bad' : 'good'}"><span>Solo en SII</span><strong>${siiOnly}</strong><small>Documentos del RCV sin registro estructurado equivalente.</small></div>
        <div class="matrix-card ${dbOnly ? 'warn' : 'good'}"><span>Solo en base</span><strong>${dbOnly}</strong><small>DTE de Innova no encontrados en el RCV importado.</small></div>
        <div class="matrix-card ${amountDiff ? 'warn' : 'good'}"><span>Diferencias de monto</span><strong>${amountDiff}</strong><small>La clave coincide, pero el total no coincide.</small></div>
        <div class="matrix-card ${orphan.length ? 'warn' : 'good'}"><span>Archivos sin registro</span><strong>${orphan.length}</strong><small>PDF/XML tributarios cargados sin fila equivalente en company_invoices.</small></div>
        <div class="matrix-card"><span>Fuentes RCV</span><strong>${[pf, sf].filter(Boolean).length}/2</strong><small>${pf ? 'Compras cargado' : 'Falta Compras'} · ${sf ? 'Ventas cargado' : 'Falta Ventas'}</small></div>
      </div>
      ${err ? `<div class="alert warn" style="margin-top:12px">${esc(err)}</div>` : ''}
      <div class="grid" style="margin-top:14px"><section class="panel"><div class="panel-head"><h3>RCV Compras</h3><span class="status ${pf ? 'good' : 'warn'}">${pf ? esc(pf.original_name) : 'Sin importar'}</span></div><div class="panel-body">${rcvSummary(purchases, pcmp, 'purchases')}</div></section><section class="panel"><div class="panel-head"><h3>RCV Ventas</h3><span class="status ${sf ? 'good' : 'warn'}">${sf ? esc(sf.original_name) : 'Sin importar'}</span></div><div class="panel-body">${rcvSummary(sales, scmp, 'sales')}</div></section></div>
      <section class="panel" style="margin-top:14px"><div class="panel-head"><h3>Diferencias para revisión</h3><div class="comparison-legend"><span class="warn"><i></i>Monto distinto</span><span class="bad"><i></i>Falta en una fuente</span></div></div><div class="panel-body"><div class="diff-list">${mismatches.length ? mismatches.map(diffHtml).join('') : '<div class="empty"><i class="ri-checkbox-circle-line"></i><strong>Sin diferencias detectadas con las fuentes disponibles.</strong></div>'}</div></div></section>
      <div class="tax-note" style="margin-top:14px">La conciliación usa el archivo RCV que tú importes desde el SII. No consulta ni modifica directamente tu cuenta del Servicio de Impuestos Internos.</div>`;
    $('#import-rcv').onclick = importRCV;
    $('#mira-rcv').onclick = () => askMiraTax('RCV', { period: period(), purchases: pcmp, sales: scmp, orphanFiles: orphan.length }, 'Revisa esta conciliación RCV y prioriza las diferencias que requieren revisión contable.');
  }

  function rcvSummary(rows, cmp, book) {
    if (!rows.length) return `<div class="empty"><i class="ri-file-list-3-line"></i><strong>Importa el RCV de ${book === 'purchases' ? 'Compras' : 'Ventas'}.</strong></div>`;
    const net = rows.reduce((a, r) => a + signed(r.net, r.type), 0), vat = rows.reduce((a, r) => a + signed(book === 'purchases' ? (r.vatRecoverable || r.vat) : r.vat, r.type), 0), total = rows.reduce((a, r) => a + signed(r.total, r.type), 0);
    return `<div class="tri-grid"><div class="matrix-card"><span>Documentos</span><strong>${rows.length}</strong></div><div class="matrix-card"><span>Neto</span><strong>${money(net)}</strong></div><div class="matrix-card"><span>${book === 'purchases' ? 'IVA recuperable detectado' : 'IVA débito detectado'}</span><strong>${money(vat)}</strong></div></div><div class="section-title"><h3>Total documental</h3><strong>${money(total)}</strong></div><div class="alert info">Coinciden ${cmp?.matched || 0}; solo SII ${cmp?.siiOnly || 0}; solo base ${cmp?.dbOnly || 0}; montos distintos ${cmp?.mismatched || 0}.</div>`;
  }

  function diffHtml(x) {
    const doc = x.r || x.d || {}; const type = x.r?.type || x.d?.dte_type; const folio = x.r?.folio || x.d?.folio; const name = x.r?.counterpartyName || x.d?.issuer_name || x.d?.recipient_rut || '';
    return `<div class="diff-row"><span class="diff-tag ${x.status}">${esc(x.label)}</span><div><strong>${esc(dteName(type))} · Folio ${esc(folio || '—')}</strong><small>${esc(name || 'Sin contraparte')}</small></div><div><strong>SII ${money(x.r?.total || 0)}</strong><small>Base ${money(x.d?.total_amount || 0)}</small></div><strong class="tax-number">Δ ${money(x.delta || 0)}</strong></div>`;
  }

  function computeF29(invoices, rcvPurchases = []) {
    const sales = invoices.filter(i => i.invoice_type === 'sale'); const purchases = invoices.filter(i => i.invoice_type === 'purchase');
    const sumVat = (arr, type) => arr.filter(i => String(i.dte_type) === String(type)).reduce((a, i) => a + Number(i.vat_amount || 0), 0);
    const count = (arr, type) => arr.filter(i => String(i.dte_type) === String(type)).length;
    const sumNet = (arr, types) => arr.filter(i => types.includes(String(i.dte_type))).reduce((a, i) => a + Number(i.net_amount || 0) + Number(i.exempt_amount || 0), 0);
    const debitInvoices = sumVat(sales, 33), debitBoletas = sumVat(sales, 39), debitND = sumVat(sales, 56), debitNC = sumVat(sales, 61);
    const totalDebit = Math.round(debitInvoices + debitBoletas + debitND - debitNC);
    let creditInv = sumVat(purchases, 33), creditND = sumVat(purchases, 56), creditNC = sumVat(purchases, 61), source = 'Base de datos';
    if (rcvPurchases.length) {
      creditInv = rcvPurchases.filter(r => String(r.type) === '33').reduce((a, r) => a + Number(r.vatRecoverable || r.vat || 0), 0);
      creditND = rcvPurchases.filter(r => String(r.type) === '56').reduce((a, r) => a + Number(r.vatRecoverable || r.vat || 0), 0);
      creditNC = rcvPurchases.filter(r => String(r.type) === '61').reduce((a, r) => a + Number(r.vatRecoverable || r.vat || 0), 0);
      source = 'RCV Compras';
    }
    const totalCredit = Math.round(creditInv + creditND - creditNC);
    return {
      source, totalDebit, totalCredit, ivaPayable: Math.max(0, totalDebit - totalCredit), creditRemainder: Math.max(0, totalCredit - totalDebit), salesBase: Math.round(sumNet(sales, ['33', '34', '39', '41', '56']) - sumNet(sales, ['61'])),
      codes: [
        ['503', 'Facturas emitidas del giro', count(sales, 33), debitInvoices, '+'], ['110', 'Boletas', count(sales, 39), debitBoletas, '+'], ['512', 'Notas de débito emitidas', count(sales, 56), debitND, '+'], ['509', 'Notas de crédito emitidas', count(sales, 61), debitNC, '−'], ['538', 'TOTAL DÉBITOS', '', totalDebit, '='],
        ['519', 'Facturas recibidas del giro', count(purchases, 33), creditInv, '+'], ['527', 'Notas de crédito recibidas', count(purchases, 61), creditNC, '−'], ['531', 'Notas de débito recibidas', count(purchases, 56), creditND, '+'], ['537', 'TOTAL CRÉDITOS estimado', '', totalCredit, '=']
      ]
    };
  }

  async function renderF29() {
    title('F29 y PPM'); main().innerHTML = '<div class="empty"><i class="ri-loader-4-line"></i><strong>Preparando prechequeo F29…</strong></div>';
    const data = await loadPeriod(); const pf = await findRCVFile(data, 'purchases'); let rcvPurchases = [];
    try { if (pf) rcvPurchases = normalizeRCV(await readStoredTable(pf), 'purchases'); } catch {}
    const f29 = computeF29(data.invoices, rcvPurchases); const official = data.tax.find(r => r.record_type === 'f29_sii'); const saved = data.tax.find(r => r.record_type === 'f29_precheck');
    const ppmRate = Number(localStorage.getItem('contador_ppm_rate') || 0); const ppmBase = f29.salesBase; const ppm = Math.round(ppmBase * ppmRate / 100); const totalEstimate = f29.ivaPayable + ppm;
    main().innerHTML = `<div class="page-head"><div><h2>F29 y PPM</h2><p>Prechequeo del Formulario 29 a partir de DTE, RCV y registros tributarios del período. Los valores oficiales siguen siendo los determinados y declarados en SII.</p><div class="sii-source"><i class="ri-external-link-line"></i><a href="https://www.sii.cl/formularios/imagen/F29.pdf" target="_blank" rel="noopener">Formulario 29 SII</a><span>· códigos documentales vigentes usados como referencia.</span></div></div><div class="actions"><button id="register-f29" class="btn"><i class="ri-file-pdf-2-line"></i> Registrar F29 SII</button><button id="save-precheck" class="btn primary"><i class="ri-save-line"></i> Guardar prechequeo</button><button id="mira-f29" class="btn soft"><i class="ri-bard-line"></i> Revisar con MIRA</button></div></div>
      <div class="f29-summary"><div class="f29-card"><span>Débito IVA documental</span><strong>${money(f29.totalDebit)}</strong></div><div class="f29-card"><span>Crédito IVA estimado</span><strong>${money(f29.totalCredit)}</strong><small class="muted">Fuente: ${esc(f29.source)}</small></div><div class="f29-card"><span>IVA estimado a pagar</span><strong>${money(f29.ivaPayable)}</strong></div><div class="f29-card total"><span>IVA + PPM estimado</span><strong id="f29-total">${money(totalEstimate)}</strong></div></div>
      <section class="panel" style="margin-top:14px"><div class="panel-head"><h3>Pagos Provisionales Mensuales</h3><span class="status warn">Tasa configurable</span></div><div class="panel-body"><div class="ppm-box"><label class="field"><span>Base referencial de ingresos</span><input id="ppm-base" type="number" value="${ppmBase}" /></label><label class="field"><span>Tasa PPM %</span><input id="ppm-rate" type="number" min="0" step="0.01" value="${ppmRate}" placeholder="Ej. tasa aplicable a tu régimen" /></label><div class="f29-card"><span>PPM calculado</span><strong id="ppm-value">${money(ppm)}</strong></div><div class="f29-card"><span>Remanente CF estimado</span><strong>${money(f29.creditRemainder)}</strong></div></div><div class="tax-note" style="margin-top:11px">La tasa de PPM depende del régimen y situación tributaria de la empresa. Por eso el sistema no impone una tasa legal por defecto: debe confirmarse con los antecedentes vigentes del contribuyente.</div></div></section>
      <div class="grid" style="margin-top:14px"><section class="panel"><div class="panel-head"><h3>Códigos documentales de control</h3><span class="status ai">Prechequeo</span></div><div class="table-wrap" style="border:0;border-radius:0"><table class="code-table"><thead><tr><th>Código</th><th>Concepto</th><th>Docs.</th><th>Monto</th><th></th></tr></thead><tbody>${f29.codes.map(c => `<tr><td><span class="code-badge">${c[0]}</span></td><td>${esc(c[1])}</td><td>${esc(c[2])}</td><td class="tax-number">${money(c[3])}</td><td>${c[4]}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="panel"><div class="panel-head"><h3>Comparación con F29 registrado</h3><span class="status ${official ? 'good' : 'warn'}">${official ? 'Disponible' : 'Sin F29 SII'}</span></div><div class="panel-body">${official ? officialCompare(official, f29, ppm) : '<div class="empty"><i class="ri-file-warning-line"></i><strong>Registra el F29 descargado/presentado en SII para comparar.</strong></div>'}${saved ? `<div class="alert info" style="margin-top:10px">Existe un prechequeo guardado para este período.</div>` : ''}</div></section></div>
      <div class="tax-note" style="margin-top:14px">Este módulo cruza antecedentes documentales. No presenta declaraciones, no determina por sí solo el derecho a crédito fiscal y no sustituye la revisión tributaria responsable.</div>`;
    const recalc = () => { const base = Number($('#ppm-base').value || 0), rate = Number($('#ppm-rate').value || 0), value = Math.round(base * rate / 100); $('#ppm-value').textContent = money(value); $('#f29-total').textContent = money(f29.ivaPayable + value); localStorage.setItem('contador_ppm_rate', String(rate)); return { base, rate, value }; };
    $('#ppm-base').oninput = recalc; $('#ppm-rate').oninput = recalc;
    $('#save-precheck').onclick = async () => { try { const p = recalc(); const notes = { version: 'f29-precheck-v2', ppm_rate: p.rate, ppm_base: p.base, credit_source: f29.source, codes: Object.fromEntries(f29.codes.map(c => [c[0], c[3]])), saved_at: new Date().toISOString() }; const res = await upsertTaxRecord('f29_precheck', { status: 'review', net_amount: f29.salesBase, debit_vat: f29.totalDebit, credit_vat: f29.totalCredit, ppm_amount: p.value, tax_amount: f29.ivaPayable, total_amount: f29.ivaPayable + p.value, notes: JSON.stringify(notes) }); if (res.error) throw res.error; toast('Prechequeo F29 guardado.'); } catch (e) { toast(e.message || 'No fue posible guardar.', 'error'); } };
    $('#register-f29').onclick = registerOfficialF29;
    $('#mira-f29').onclick = () => { const p = recalc(); askMiraTax('F29', { period: period(), computed: f29, ppm: p, official }, 'Revisa el prechequeo F29, identifica diferencias, documentación faltante y puntos que deben confirmarse antes de declarar.'); };
  }

  function officialCompare(o, f29, ppm) {
    const rows = [['Débito IVA', Number(o.debit_vat || 0), f29.totalDebit], ['Crédito IVA', Number(o.credit_vat || 0), f29.totalCredit], ['PPM', Number(o.ppm_amount || 0), ppm], ['Total F29', Number(o.total_amount || 0), f29.ivaPayable + ppm]];
    return `<div class="diff-list">${rows.map(r => { const d = Math.abs(r[1] - r[2]); return `<div class="diff-row"><span class="diff-tag ${d <= 1 ? 'good' : 'warn'}">${d <= 1 ? 'Coincide' : 'Diferencia'}</span><div><strong>${esc(r[0])}</strong><small>SII ${money(r[1])}</small></div><div><strong>Prechequeo ${money(r[2])}</strong></div><strong class="tax-number">Δ ${money(d)}</strong></div>`; }).join('')}</div>`;
  }

  function registerOfficialF29() {
    const root = modal('Registrar F29 del SII', `<div class="form-grid"><label class="field"><span>Período</span><input value="${esc(period())}" disabled /></label><label class="field"><span>Estado</span><select id="f29-status"><option value="draft">Borrador / descargado</option><option value="submitted">Presentado</option><option value="paid">Pagado</option></select></label><label class="field"><span>Débito IVA (Cód. 538)</span><input id="f29-debit" type="number" value="0" /></label><label class="field"><span>Crédito IVA (Cód. 537)</span><input id="f29-credit" type="number" value="0" /></label><label class="field"><span>PPM</span><input id="f29-ppm" type="number" value="0" /></label><label class="field"><span>Total a pagar</span><input id="f29-total-official" type="number" value="0" /></label><label class="field"><span>Vencimiento</span><input id="f29-due" type="date" /></label><label class="dropzone"><i class="ri-file-pdf-2-line"></i><strong>Adjuntar F29</strong><span>PDF descargado o comprobante del SII (opcional).</span><input id="f29-file" type="file" accept=".pdf,application/pdf" /></label></div>`, `<button class="btn tax-modal-close">Cancelar</button><button id="f29-save-official" class="btn primary">Guardar F29 SII</button>`);
    const inp = $('#f29-file', root); $('.dropzone', root).onclick = () => inp.click();
    $('#f29-save-official', root).onclick = async () => { try { let source = null; if (inp.files?.[0]) source = await uploadTaxFile(inp.files[0], { module: 'contador', source: 'sii', kind: 'f29', period: period(), imported_at: new Date().toISOString() }, `F29 SII ${period()}`); const payload = { status: $('#f29-status', root).value, due_date: $('#f29-due', root).value || null, debit_vat: Number($('#f29-debit', root).value || 0), credit_vat: Number($('#f29-credit', root).value || 0), ppm_amount: Number($('#f29-ppm', root).value || 0), tax_amount: Math.max(0, Number($('#f29-debit', root).value || 0) - Number($('#f29-credit', root).value || 0)), total_amount: Number($('#f29-total-official', root).value || 0), notes: JSON.stringify({ source_file_id: source?.id || null, registered_at: new Date().toISOString() }) }; const res = await upsertTaxRecord('f29_sii', payload); if (res.error) throw res.error; closeModal(); toast('F29 SII registrado.'); await renderF29(); } catch (e) { toast(e.message || 'No fue posible registrar el F29.', 'error'); } };
  }

  function bankScore(m, i) {
    const desc = norm(`${m.description || ''} ${m.reference || ''}`); let score = 0;
    if (Math.abs(Math.abs(Number(m.amount || 0)) - Math.abs(Number(i.total_amount || 0))) <= 1) score += 3;
    if (i.folio && desc.includes(norm(i.folio))) score += 2;
    const irut = rut(i.invoice_type === 'purchase' ? i.issuer_rut : i.recipient_rut); if (irut && desc.replace(/\s/g, '').includes(irut.toLowerCase())) score += 2;
    const name = norm(i.issuer_name || ''); if (name && name.length > 5 && desc.includes(name.slice(0, Math.min(12, name.length)))) score += 1;
    if (i.invoice_type === 'purchase' && Number(m.amount || 0) < 0) score += 1; if (i.invoice_type === 'sale' && Number(m.amount || 0) > 0) score += 1;
    return score;
  }

  async function renderReconciliation() {
    title('Conciliación bancaria'); main().innerHTML = '<div class="empty"><i class="ri-loader-4-line"></i><strong>Analizando movimientos bancarios…</strong></div>';
    const data = await loadPeriod(); const unreconciled = data.bank.filter(m => !m.reconciled); const inflow = data.bank.filter(m => Number(m.amount) > 0).reduce((a, m) => a + Number(m.amount || 0), 0); const outflow = data.bank.filter(m => Number(m.amount) < 0).reduce((a, m) => a + Math.abs(Number(m.amount || 0)), 0);
    const suggestions = unreconciled.map(m => { const ranked = data.invoices.map(i => ({ i, score: bankScore(m, i) })).sort((a, b) => b.score - a.score); return { m, best: ranked[0] }; }).filter(x => x.best?.score >= 3);
    main().innerHTML = `<div class="page-head"><div><h2>Conciliación bancaria</h2><p>Compara movimientos bancarios con facturas y boletas registradas. Las sugerencias se basan en monto, folio, RUT, descripción y sentido del movimiento.</p></div><div class="actions"><button id="import-bank" class="btn primary"><i class="ri-bank-card-line"></i> Importar cartola</button><button id="mira-bank" class="btn soft"><i class="ri-bard-line"></i> Revisar con MIRA</button></div></div>
      <div class="reconcile-grid"><div class="reconcile-card"><i class="ri-arrow-down-circle-line"></i><strong>${money(inflow)}</strong><span>Entradas del período</span></div><div class="reconcile-card"><i class="ri-arrow-up-circle-line"></i><strong>${money(outflow)}</strong><span>Salidas del período</span></div><div class="reconcile-card"><i class="ri-link-m"></i><strong>${data.bank.filter(m => m.reconciled).length}</strong><span>Movimientos conciliados</span></div><div class="reconcile-card"><i class="ri-question-line"></i><strong>${unreconciled.length}</strong><span>Pendientes de conciliación</span></div></div>
      <section class="panel" style="margin-top:14px"><div class="panel-head"><h3>Sugerencias automáticas</h3><span class="status ai">${suggestions.length} coincidencias</span></div><div class="panel-body" style="padding:0">${suggestions.length ? suggestions.map(s => bankMatchHtml(s)).join('') : '<div class="empty"><i class="ri-search-eye-line"></i><strong>No hay sugerencias con confianza suficiente.</strong></div>'}</div></section>
      <section class="panel" style="margin-top:14px"><div class="panel-head"><h3>Todos los movimientos del período</h3><span class="status">${data.bank.length}</span></div><div class="table-wrap" style="border:0;border-radius:0"><table class="table"><thead><tr><th>Fecha</th><th>Cuenta</th><th>Descripción</th><th>Referencia</th><th>Monto</th><th>Estado</th></tr></thead><tbody>${data.bank.length ? data.bank.map(m => `<tr><td>${esc(m.movement_date || '')}</td><td>${esc(m.account_label || '')}</td><td>${esc(m.description || '')}</td><td>${esc(m.reference || '')}</td><td class="money">${money(m.amount)}</td><td><span class="status ${m.reconciled ? 'good' : 'warn'}">${m.reconciled ? 'Conciliado' : 'Pendiente'}</span></td></tr>`).join('') : '<tr><td colspan="6"><div class="empty"><strong>Sin movimientos. Importa una cartola CSV/XLSX.</strong></div></td></tr>'}</tbody></table></div></section>`;
    $('#import-bank').onclick = importBank;
    $$('.mark-reconciled').forEach(b => b.onclick = async () => { const { error } = await client.from('company_bank_movements').update({ reconciled: true }).eq('id', b.dataset.id); if (error) return toast(error.message, 'error'); toast('Movimiento marcado como conciliado.'); await renderReconciliation(); });
    $('#mira-bank').onclick = () => askMiraTax('Conciliación bancaria', { period: period(), bankMovements: data.bank, suggestions: suggestions.map(s => ({ movement: s.m, invoice: s.best.i, score: s.best.score })) }, 'Revisa la conciliación bancaria y señala movimientos que requieren respaldo o verificación manual.');
  }

  function bankMatchHtml(s) {
    const m = s.m, i = s.best.i, score = Math.min(5, s.best.score);
    return `<div class="bank-match"><div><strong>${esc(m.movement_date || '')} · ${money(m.amount)}</strong><small>${esc(m.description || m.reference || '')}</small></div><div><strong>${esc(dteName(i.dte_type))} ${esc(i.folio || '')}</strong><small>${esc(i.issuer_name || i.recipient_rut || '')} · ${money(i.total_amount)}</small></div><div><div class="match-score">${[1,2,3,4,5].map(n => `<i class="ri-circle-fill ${n <= score ? 'on' : ''}"></i>`).join('')}</div><small>Confianza ${score}/5</small></div><button class="btn mark-reconciled" data-id="${esc(m.id)}">Conciliar</button></div>`;
  }

  async function importBank() {
    const root = modal('Importar cartola bancaria', `<div class="form-grid"><label class="field"><span>Cuenta / banco</span><input id="bank-account" placeholder="Ej. Cuenta corriente Banco..." /></label><label class="field"><span>Período</span><input type="month" value="${esc(period())}" disabled /></label><label class="dropzone full"><i class="ri-file-excel-2-line"></i><strong>CSV, TXT, XLS o XLSX</strong><span>Se detectarán fecha, descripción, monto, referencia y saldo cuando existan.</span><input id="bank-file" type="file" accept=".csv,.txt,.xls,.xlsx" /></label><div class="alert info full">La importación evita duplicados exactos del mismo período comparando fecha, monto, descripción y referencia.</div></div>`, `<button class="btn tax-modal-close">Cancelar</button><button id="bank-save" class="btn primary">Importar movimientos</button>`);
    const inp = $('#bank-file', root); $('.dropzone', root).onclick = () => inp.click();
    $('#bank-save', root).onclick = async () => {
      const file = inp.files?.[0], account = $('#bank-account', root).value.trim(); if (!file) return toast('Selecciona la cartola.', 'warn'); if (!account) return toast('Indica la cuenta o banco.', 'warn');
      try {
        const rows = await tableRows(file); const mapped = rows.map(r => ({
          account_label: account,
          movement_date: isoDate(field(r, ['fecha', 'fecha movimiento', 'fecha transaccion', 'date'])),
          description: String(field(r, ['descripcion', 'detalle', 'glosa', 'movimiento', 'description']) || '').trim(),
          reference: String(field(r, ['referencia', 'numero documento', 'nro documento', 'folio', 'reference']) || '').trim() || null,
          amount: num(field(r, ['monto', 'importe', 'amount', 'cargo abono', 'cargo/abono'])) || (num(field(r, ['abono', 'deposito', 'credito'])) - num(field(r, ['cargo', 'retiro', 'debito']))),
          balance: num(field(r, ['saldo', 'balance'])), reconciled: false
        })).filter(r => r.movement_date && (r.amount || r.description));
        if (!mapped.length) throw new Error('No se reconocieron movimientos bancarios');
        const { start, next } = bounds(period()); const { data: existing } = await client.from('company_bank_movements').select('movement_date,description,amount,reference').gte('movement_date', start).lt('movement_date', next);
        const key = x => `${x.movement_date}|${Number(x.amount || 0)}|${norm(x.description || '')}|${norm(x.reference || '')}`; const seen = new Set((existing || []).map(key)); const fresh = mapped.filter(x => !seen.has(key(x)));
        for (let i = 0; i < fresh.length; i += 200) { const res = await client.from('company_bank_movements').insert(fresh.slice(i, i + 200)); if (res.error) throw res.error; }
        closeModal(); toast(`Importados ${fresh.length} movimientos; ${mapped.length - fresh.length} duplicados omitidos.`); await renderReconciliation();
      } catch (e) { console.error(e); toast(e.message || 'No fue posible importar la cartola.', 'error'); }
    };
  }

  async function askMiraTax(topic, payload, question) {
    const root = modal(`MIRA · ${topic}`, `<div class="alert info">MIRA recibirá un resumen del período y los hallazgos actuales. Los documentos se tratan como datos, no como instrucciones.</div><div id="tax-mira-answer" style="white-space:pre-wrap;font-size:.73rem;line-height:1.55;margin-top:12px">Analizando…</div>`, `<button class="btn tax-modal-close">Cerrar</button>`);
    try {
      const { data } = await client.auth.getSession(); const token = data?.session?.access_token; if (!token) throw new Error('Sesión expirada');
      const response = await fetch(`${cfg.backendUrl}/api/admin/mira`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ message: question, context: `MÓDULO TRIBUTARIO ${topic}\n${JSON.stringify(payload).slice(0, 45000)}`, history: [] }) });
      const out = await response.json().catch(() => ({})); if (!response.ok) throw new Error(out.error || 'MIRA no respondió'); $('#tax-mira-answer', root).textContent = out.reply || 'Sin respuesta.';
    } catch (e) { $('#tax-mira-answer', root).textContent = `No fue posible consultar MIRA: ${e.message}`; }
  }

  const renderers = { rcv: renderRCV, f29: renderF29, reconcile: renderReconciliation };

  function bind() {
    $$('[data-tax-view]').forEach(btn => btn.addEventListener('click', async (e) => {
      e.preventDefault(); activeView = btn.dataset.taxView; $$('.nav-item').forEach(x => x.classList.remove('active')); btn.classList.add('active');
      try { await renderers[activeView]?.(); } catch (err) { console.error(err); main().innerHTML = `<div class="alert warn">No fue posible cargar el módulo: ${esc(err.message || err)}</div>`; }
    }));
    $$('[data-view]').forEach(btn => btn.addEventListener('click', () => { activeView = null; }));
    const gp = $('#global-period'); if (gp) gp.addEventListener('change', () => { if (activeView) setTimeout(() => renderers[activeView]?.(), 40); });
  }

  async function boot() {
    await sessionProfile(); bind();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
