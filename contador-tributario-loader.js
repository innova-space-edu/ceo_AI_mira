(() => {
  'use strict';
  const PARTS = [
    'assets/admin-enterprise/contador-tributario-1.b64?v=20260915-2',
    'assets/admin-enterprise/contador-tributario-2.b64?v=20260915-2'
  ];
  async function boot() {
    try {
      if (typeof DecompressionStream !== 'function') throw new Error('Actualiza el navegador para usar el módulo tributario.');
      const chunks = await Promise.all(PARTS.map(async (url) => {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`No se pudo cargar ${url}`);
        return (await response.text()).trim();
      }));
      const raw = atob(chunks.join(''));
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
      const source = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      const src = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => URL.revokeObjectURL(src);
      script.onerror = () => URL.revokeObjectURL(src);
      document.head.appendChild(script);
    } catch (error) {
      console.error('Contador tributario:', error);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
