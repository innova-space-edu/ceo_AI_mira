(() => {
  'use strict';

  const cfg = window.INNOVA_ADMIN_CONFIG;
  const db = window.getInnovaAdminSupabaseClient?.() || window.INNOVA_ADMIN_SUPABASE_CLIENT;
  if (!cfg || !db) return;

  const VERIFY_BASE = `${window.location.origin.replace(/\/$/, '')}/?verify=`;

  // Mismo método de generación QR utilizado por EduAI QR Studio
  // (lib/qr/quickchart.ts): QuickChart, margen 3 y nivel de corrección M.
  function buildQrImageUrl(text, options = {}) {
    const params = new URLSearchParams({
      text,
      format: options.format || 'png',
      size: String(options.size || 480),
      margin: '3',
      ecLevel: 'M'
    });
    if (String(options.caption || '').trim()) params.set('caption', String(options.caption).trim());
    return `https://quickchart.io/qr?${params.toString()}`;
  }

  function esc(value = '') {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function money(value) {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency', currency: 'CLP', maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function dateTime(value) {
    const d = value ? new Date(value) : new Date();
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function firstRow(data) {
    return Array.isArray(data) ? data[0] : data;
  }

  async function qrAsDataUrl(url) {
    try {
      const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
      if (!response.ok) throw new Error('QR no disponible');
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (_) {
      return url;
    }
  }

  function injectStyles() {
    if (document.getElementById('ise-document-verification-admin-style')) return;
    const style = document.createElement('style');
    style.id = 'ise-document-verification-admin-style';
    style.textContent = `
      .ise-doc-seal{display:inline-flex;align-items:center;gap:5px;margin-top:7px;padding:5px 8px;border:1px solid #b9dcca;background:#eefaf3;color:#17663b;border-radius:999px;font-size:.62rem;font-weight:800;letter-spacing:.025em}
      .ise-doc-verify{margin-top:22px;padding:14px 16px;border:1px solid #d8e0ed;border-radius:14px;background:#f8fafc;display:grid;grid-template-columns:92px 1fr;gap:16px;align-items:center;break-inside:avoid;page-break-inside:avoid}
      .ise-doc-verify img{width:88px!important;height:88px!important;object-fit:contain!important;border:0!important;border-radius:8px!important;background:#fff;padding:4px}
      .ise-doc-verify h3{margin:0 0 6px;font-size:.82rem;color:#172342}.ise-doc-verify p{margin:2px 0;font-size:.66rem;color:#64718a;line-height:1.45}.ise-doc-verify strong{color:#263656}.ise-doc-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.72rem!important;font-weight:800;letter-spacing:.02em;color:#172342!important}.ise-doc-fingerprint{word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.57rem!important}
      .ise-doc-pending{margin-top:20px;padding:11px 13px;border:1px dashed #e0aa43;background:#fff9e9;color:#79520a;border-radius:10px;font-size:.7rem}
      @media print{.ise-doc-verify{grid-template-columns:82px 1fr}.ise-doc-verify img{width:78px!important;height:78px!important}}
    `;
    document.head.appendChild(style);
  }

  function internalCodeFrom(node) {
    const match = String(node?.textContent || '').match(/ISE-COT-[A-Z0-9-]+/i);
    return match ? match[0].toUpperCase() : '';
  }

  function addPending(node, message) {
    if (node.querySelector('.ise-doc-pending')) return;
    const footer = node.querySelector('.pqw2-doc-footer');
    const el = document.createElement('div');
    el.className = 'ise-doc-pending';
    el.textContent = message;
    if (footer) footer.before(el); else node.appendChild(el);
  }

  function markHeader(node, record) {
    const header = node.querySelector('.pqw2-doc-head');
    if (!header) return;
    const strongs = [...header.querySelectorAll('strong')];
    const codeNode = strongs.find((el) => /ISE-COT-/i.test(el.textContent || ''));
    if (codeNode) codeNode.textContent = record.verification_code;

    const labels = [...header.querySelectorAll('div')];
    const draft = labels.find((el) => /^Borrador$/i.test((el.textContent || '').trim()));
    if (draft) draft.textContent = 'Emitido · verificable';

    const side = codeNode?.parentElement || header.lastElementChild;
    if (side && !side.querySelector('.ise-doc-seal')) {
      const seal = document.createElement('div');
      seal.className = 'ise-doc-seal';
      seal.innerHTML = '<span>✓</span><span>Documento verificable</span>';
      side.appendChild(seal);
    }
  }

  async function renderVerification(node, record) {
    if (node.querySelector('.ise-doc-verify')) return;
    const verificationUrl = `${VERIFY_BASE}${encodeURIComponent(record.verification_code)}`;
    const remoteQr = buildQrImageUrl(verificationUrl, { size: 420, caption: 'Innova Space Education' });
    const qr = await qrAsDataUrl(remoteQr);
    const footer = node.querySelector('.pqw2-doc-footer');
    const fingerprint = String(record.fingerprint || '');

    const panel = document.createElement('div');
    panel.className = 'ise-doc-verify';
    panel.innerHTML = `
      <img src="${esc(qr)}" alt="QR de verificación del documento" crossorigin="anonymous">
      <div>
        <h3>Validación documental · Innova Space Education</h3>
        <p class="ise-doc-code">${esc(record.verification_code)}</p>
        <p><strong>Emisión:</strong> ${esc(dateTime(record.issued_at))} · <strong>Versión:</strong> ${esc(record.version)}</p>
        <p><strong>Proyecto:</strong> ${esc(record.project_name || 'Proyecto')} · <strong>Total:</strong> ${esc(money(record.total_amount))}</p>
        <p>Escanee el QR o ingrese el código en <strong>innova-space-edu.cl → Verificar documentos</strong>.</p>
        <p class="ise-doc-fingerprint"><strong>Huella SHA-256:</strong> ${esc(fingerprint)}</p>
      </div>`;
    if (footer) footer.before(panel); else node.appendChild(panel);

    if (footer) {
      footer.innerHTML = '<strong>Documento generado automáticamente por Innova Space Education.</strong><br>Validado digitalmente por Innova Space Education para fines de verificación interna. La autenticidad y vigencia de esta emisión puede comprobarse mediante el código o QR indicado.';
    }
  }

  async function enhanceDocument(node) {
    if (!node || node.dataset.iseVerificationState === 'loading' || node.dataset.iseVerificationState === 'done') return;
    injectStyles();
    const internalCode = internalCodeFrom(node);
    if (!internalCode || /BORRADOR/i.test(internalCode)) {
      addPending(node, 'Guardar la cotización para emitir el código de verificación, la huella digital y el QR.');
      node.dataset.iseVerificationState = 'pending';
      return;
    }

    node.dataset.iseVerificationState = 'loading';
    try {
      const { data, error } = await db.rpc('resolve_company_document_verification', { p_internal_code: internalCode });
      if (error) throw error;
      const record = firstRow(data);
      if (!record?.verification_code) throw new Error('No se obtuvo un código de verificación.');
      markHeader(node, record);
      await renderVerification(node, record);
      node.dataset.iseVerificationState = 'done';
    } catch (error) {
      console.warn('Verificación documental:', error?.message || error);
      addPending(node, 'La cotización está guardada, pero la verificación documental aún no está habilitada en la base de datos.');
      node.dataset.iseVerificationState = 'error';
    }
  }

  function scan() {
    document.querySelectorAll('.pqw2-document[data-document]').forEach((node) => enhanceDocument(node));
  }

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
  else scan();

  window.InnovaDocumentVerification = Object.freeze({ buildQrImageUrl, scan });
})();
