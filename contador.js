(() => {
  'use strict';
  const PARTS = ['assets/admin-enterprise/contador-1.b64?v=20260915-1','assets/admin-enterprise/contador-2.b64?v=20260915-1'];
  async function boot(){
    try{
      if(typeof DecompressionStream!=='function') throw new Error('Actualiza el navegador para usar Contador IA.');
      const chunks=await Promise.all(PARTS.map(async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`No se pudo cargar ${url}`);return (await r.text()).trim();}));
      const raw=atob(chunks.join(''));const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
      const source=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      const src=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));const s=document.createElement('script');s.src=src;s.onload=()=>URL.revokeObjectURL(src);s.onerror=()=>{URL.revokeObjectURL(src);throw new Error('No se pudo ejecutar Contador IA.');};document.head.appendChild(s);
    }catch(e){console.error(e);document.body.innerHTML=`<p style="padding:40px;font-family:Inter,sans-serif">${String(e.message||e)}</p>`;}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
