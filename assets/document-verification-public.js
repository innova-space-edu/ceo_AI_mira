(() => {
  'use strict';

  const SUPABASE_URL = 'https://alogqktilzgylzomzwem.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_x8GWfejC94VkWopDMUBXSQ_PQcqNIj8';
  const RPC_URL = `${SUPABASE_URL}/rest/v1/rpc/verify_company_document`;

  const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const money = (value) => new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', maximumFractionDigits: 0
  }).format(Number(value || 0));
  const dateTime = (value) => {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  function injectStyles() {
    if (document.getElementById('ise-public-verifier-style')) return;
    const style = document.createElement('style');
    style.id = 'ise-public-verifier-style';
    style.textContent = `
      .ise-verify-footer-btn{margin-top:10px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.07);color:inherit;border-radius:999px;padding:8px 14px;font:600 .82rem Inter,system-ui,sans-serif;cursor:pointer;transition:.2s}.ise-verify-footer-btn:hover{background:rgba(255,255,255,.14);transform:translateY(-1px)}
      .ise-verify-overlay{position:fixed;inset:0;z-index:100000;background:rgba(7,12,28,.72);backdrop-filter:blur(8px);display:grid;place-items:center;padding:18px}.ise-verify-card{width:min(620px,96vw);max-height:90vh;overflow:auto;background:#fff;color:#172342;border-radius:22px;box-shadow:0 28px 90px rgba(0,0,0,.35);font-family:Inter,system-ui,sans-serif}.ise-verify-head{padding:20px 22px 14px;border-bottom:1px solid #e7ebf2;display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.ise-verify-head h2{margin:0;font-size:1.25rem}.ise-verify-head p{margin:5px 0 0;color:#73809a;font-size:.79rem}.ise-verify-close{border:0;background:#eef1f6;color:#46536e;width:34px;height:34px;border-radius:10px;cursor:pointer;font-size:20px}.ise-verify-body{padding:20px 22px 24px}.ise-verify-form{display:flex;gap:8px}.ise-verify-form input{flex:1;min-width:0;border:1px solid #d7deea;border-radius:11px;padding:12px 13px;font:600 .86rem ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;outline:none}.ise-verify-form input:focus{border-color:#6159ee;box-shadow:0 0 0 3px rgba(97,89,238,.1)}.ise-verify-form button{border:0;border-radius:11px;padding:0 16px;background:#5147ed;color:#fff;font-weight:800;cursor:pointer}.ise-verify-result{margin-top:16px}.ise-verify-status{border-radius:14px;padding:14px 15px}.ise-verify-status.valid{background:#ecf8f1;border:1px solid #bde3cc}.ise-verify-status.invalid{background:#fff2f3;border:1px solid #f0c8ce}.ise-verify-status.outdated{background:#fff8e7;border:1px solid #edd79b}.ise-verify-status h3{margin:0 0 4px;font-size:1rem}.ise-verify-status p{margin:0;color:#617089;font-size:.78rem}.ise-verify-grid{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:9px}.ise-verify-field{background:#f7f9fc;border:1px solid #e4e9f1;border-radius:11px;padding:10px 11px}.ise-verify-field span{display:block;color:#7c879e;font-size:.65rem;text-transform:uppercase;font-weight:800;letter-spacing:.04em}.ise-verify-field strong{display:block;margin-top:3px;font-size:.82rem;word-break:break-word}.ise-verify-field.wide{grid-column:1/-1}.ise-verify-hash{font:600 .67rem ui-monospace,SFMono-Regular,Menlo,monospace!important}.ise-verify-loading{padding:15px;color:#66748d;text-align:center;font-size:.82rem}@media(max-width:520px){.ise-verify-form{flex-direction:column}.ise-verify-form button{padding:12px}.ise-verify-grid{grid-template-columns:1fr}.ise-verify-field.wide{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  async function verify(code) {
    const clean = String(code || '').trim().toUpperCase();
    if (!clean) return [];
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_code: clean })
    });
    if (!response.ok) throw new Error('No se pudo consultar el registro de verificación.');
    const data = await response.json();
    return Array.isArray(data) ? data : (data ? [data] : []);
  }

  function resultHtml(record) {
    if (!record) {
      return `<div class="ise-verify-status invalid"><h3>Documento no encontrado</h3><p>El código no existe en el registro público de Innova Space Education o todavía no ha sido emitido.</p></div>`;
    }
    const current = record.valid === true && record.status === 'issued';
    const outdated = record.status === 'superseded';
    const title = current ? 'Documento válido' : outdated ? 'Documento actualizado / no vigente' : 'Documento inválido o no vigente';
    const cls = current ? 'valid' : outdated ? 'outdated' : 'invalid';
    const type = record.document_type === 'quotation' ? 'Cotización' : record.document_type || 'Documento';
    return `<div class="ise-verify-status ${cls}"><h3>${current ? '✓ ' : ''}${esc(title)}</h3><p>${current ? 'El código corresponde a una emisión registrada y vigente.' : outdated ? 'Esta versión existe, pero fue reemplazada por una emisión posterior.' : 'La emisión existe, pero no está vigente.'}</p></div>
      <div class="ise-verify-grid">
        <div class="ise-verify-field"><span>Tipo</span><strong>${esc(type)}</strong></div>
        <div class="ise-verify-field"><span>Estado</span><strong>${esc(record.status || '—')}</strong></div>
        <div class="ise-verify-field wide"><span>Proyecto</span><strong>${esc(record.project_name || 'Proyecto')}</strong></div>
        <div class="ise-verify-field"><span>Fecha de emisión</span><strong>${esc(dateTime(record.issued_at))}</strong></div>
        <div class="ise-verify-field"><span>Versión</span><strong>${esc(record.version || '1')}</strong></div>
        <div class="ise-verify-field"><span>Neto</span><strong>${esc(money(record.net_amount))}</strong></div>
        <div class="ise-verify-field"><span>IVA</span><strong>${esc(money(record.vat_amount))}</strong></div>
        <div class="ise-verify-field wide"><span>Total</span><strong>${esc(money(record.total_amount))}</strong></div>
        <div class="ise-verify-field wide"><span>Emitido por</span><strong>${esc(record.issuer || 'Innova Space Education SpA')}</strong></div>
        <div class="ise-verify-field wide"><span>Código de verificación</span><strong class="ise-verify-hash">${esc(record.verification_code)}</strong></div>
        <div class="ise-verify-field wide"><span>Huella SHA-256</span><strong class="ise-verify-hash">${esc(record.fingerprint || '—')}</strong></div>
      </div>`;
  }

  function openVerifier(initialCode = '') {
    document.querySelector('.ise-verify-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'ise-verify-overlay';
    overlay.innerHTML = `<section class="ise-verify-card" role="dialog" aria-modal="true" aria-labelledby="ise-verify-title">
      <div class="ise-verify-head"><div><h2 id="ise-verify-title">Verificar documentos</h2><p>Consulte una cotización mediante su código oficial de Innova Space Education.</p></div><button class="ise-verify-close" type="button" aria-label="Cerrar">×</button></div>
      <div class="ise-verify-body"><form class="ise-verify-form"><input name="code" autocomplete="off" spellcheck="false" placeholder="ISE-COT-20260917-XXXXXX-V01" value="${esc(initialCode)}" aria-label="Código de verificación"><button type="submit">Verificar</button></form><div class="ise-verify-result" aria-live="polite"></div></div>
    </section>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('input[name="code"]');
    const result = overlay.querySelector('.ise-verify-result');
    const close = () => overlay.remove();
    overlay.querySelector('.ise-verify-close').addEventListener('click', close);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
    const onKey = (event) => { if (event.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);

    const run = async () => {
      const code = input.value.trim();
      if (!code) { result.innerHTML = resultHtml(null); return; }
      result.innerHTML = '<div class="ise-verify-loading">Consultando registro…</div>';
      try {
        const records = await verify(code);
        result.innerHTML = resultHtml(records[0] || null);
      } catch (error) {
        result.innerHTML = `<div class="ise-verify-status invalid"><h3>No fue posible verificar</h3><p>${esc(error.message || 'Intente nuevamente.')}</p></div>`;
      }
    };

    overlay.querySelector('form').addEventListener('submit', (event) => { event.preventDefault(); run(); });
    input.focus();
    if (initialCode) run();
  }

  function mount() {
    injectStyles();
    const footer = document.querySelector('footer.footer, footer');
    if (footer && !footer.querySelector('[data-ise-verify-documents]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ise-verify-footer-btn';
      button.dataset.iseVerifyDocuments = '1';
      button.textContent = 'Verificar documentos';
      button.addEventListener('click', () => openVerifier(''));
      footer.appendChild(button);
    }

    const code = new URLSearchParams(window.location.search).get('verify');
    if (code) openVerifier(code);
  }

  window.InnovaPublicDocumentVerifier = Object.freeze({ open: openVerifier, verify });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
