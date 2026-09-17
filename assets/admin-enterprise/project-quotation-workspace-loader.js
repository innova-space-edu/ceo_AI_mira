(() => {
  'use strict';
  const VERSION = '20260917-project-quotation-3';
  const SOURCE = `assets/admin-enterprise/project-quotation-workspace.b64?v=${VERSION}`;

  function extractEncodedPayload(value) {
    let text = String(value || '').trim();
    if (!text) throw new Error('Bundle de cotización vacío.');

    if (text.startsWith('[') || text.startsWith('{')) {
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        const pieces = [...text.matchAll(/["']([A-Za-z0-9+/_=-]{16,})["']/g)].map((match) => match[1]);
        if (!pieces.length) throw new Error('Bundle de cotización en formato JSON no reconocido.');
        text = pieces.join('');
      }

      if (parsed !== null) {
        if (typeof parsed === 'string') {
          text = parsed;
        } else if (Array.isArray(parsed)) {
          const pieces = parsed.flat(Infinity).filter((item) => typeof item === 'string');
          if (!pieces.length) throw new Error('Bundle de cotización sin fragmentos Base64.');
          text = pieces.join('');
        } else if (parsed && typeof parsed === 'object') {
          const candidate = parsed.base64 ?? parsed.content ?? parsed.payload ?? parsed.data ?? parsed.chunks;
          if (typeof candidate === 'string') text = candidate;
          else if (Array.isArray(candidate)) text = candidate.flat(Infinity).filter((item) => typeof item === 'string').join('');
          else throw new Error('Bundle de cotización JSON sin contenido Base64.');
        }
      }
    }

    return text;
  }

  function decodeBase64Payload(value) {
    let encoded = extractEncodedPayload(value)
      .replace(/^data:[^,]*,/, '')
      .replace(/\s+/g, '')
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const invalid = encoded.match(/[^A-Za-z0-9+/=]/);
    if (invalid) throw new Error(`Bundle de cotización inválido: carácter inesperado ${JSON.stringify(invalid[0])}.`);

    const remainder = encoded.length % 4;
    if (remainder) encoded += '='.repeat(4 - remainder);

    let raw;
    try {
      raw = atob(encoded);
    } catch (error) {
      throw new Error(`Bundle de cotización Base64 inválido (${encoded.length} caracteres).`);
    }

    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }

  async function boot() {
    if (window.__INNOVA_PROJECT_QUOTATION_WORKSPACE_LOADING__) return;
    window.__INNOVA_PROJECT_QUOTATION_WORKSPACE_LOADING__ = true;
    try {
      if (typeof DecompressionStream !== 'function') throw new Error('Actualiza el navegador para usar la cotización del proyecto.');
      const response = await fetch(SOURCE, { cache: 'no-store' });
      if (!response.ok) throw new Error(`No se pudo cargar el módulo de cotización del proyecto (${response.status}).`);
      const payload = await response.text();
      const bytes = decodeBase64Payload(payload);
      const source = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      if (!source || !source.includes('company_quotations')) throw new Error('El bundle de cotización se descomprimió, pero su contenido no es válido.');

      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      const script = document.createElement('script');
      script.src = url;
      script.dataset.projectQuotationWorkspace = 'ready';
      script.onload = () => {
        URL.revokeObjectURL(url);
        window.__INNOVA_PROJECT_QUOTATION_WORKSPACE_LOADING__ = false;
        document.documentElement.dataset.projectQuotationWorkspace = 'ready';
      };
      script.onerror = () => {
        URL.revokeObjectURL(url);
        window.__INNOVA_PROJECT_QUOTATION_WORKSPACE_LOADING__ = false;
        console.error('Project quotation workspace: no se pudo ejecutar el bundle descomprimido.');
      };
      document.head.appendChild(script);
    } catch (error) {
      window.__INNOVA_PROJECT_QUOTATION_WORKSPACE_LOADING__ = false;
      console.error('Project quotation workspace:', error);
      const root = document.getElementById('toast-root');
      if (root) {
        const item = document.createElement('div');
        item.className = 'toast error';
        item.textContent = error.message || 'No se pudo iniciar la cotización del proyecto.';
        root.appendChild(item);
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
