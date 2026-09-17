(() => {
  'use strict';
  const VERSION = '20260917-project-quotation-1';
  const SOURCE = `assets/admin-enterprise/project-quotation-workspace.b64?v=${VERSION}`;

  async function boot() {
    if (window.__INNOVA_PROJECT_QUOTATION_WORKSPACE_LOADING__) return;
    window.__INNOVA_PROJECT_QUOTATION_WORKSPACE_LOADING__ = true;
    try {
      if (typeof DecompressionStream !== 'function') throw new Error('Actualiza el navegador para usar la cotización del proyecto.');
      const response = await fetch(SOURCE, { cache: 'no-store' });
      if (!response.ok) throw new Error('No se pudo cargar el módulo de cotización del proyecto.');
      const encoded = (await response.text()).trim();
      const raw = atob(encoded);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
      const source = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
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
        throw new Error('No se pudo ejecutar la cotización del proyecto.');
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
