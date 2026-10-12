import fs from 'node:fs';
const pages=['legal-datos.html','archivo-publico.html','politica-datos.html','acuerdo-tratamiento-datos.html','protocolos-proteccion-datos.html','continuidad-respaldos.html','rat-eduai.html','rat-sello.html','acta-gobernanza-2026.html'];
const docs=['docs/PLANTILLA_MATRIZ_CONSERVACION_2026.md','docs/PLANTILLA_RESPALDOS_CONTINUIDAD_2026.md','docs/PRIVACY_REVIEW_CHECKLIST_2026.md'];
const errors=[];
for(const p of [...pages,...docs])if(!fs.existsSync(p)||fs.statSync(p).size<80)errors.push('Falta '+p);
for(const p of pages){const html=fs.readFileSync(p,'utf8');for(const m of html.matchAll(/href="([^"]+)"/g)){const url=m[1].split(/[?#]/)[0];if(!url||/^(https?:|mailto:|tel:|#)/.test(url))continue;if(!fs.existsSync(url))errors.push(p+' enlace roto: '+url)}}
if(!fs.readFileSync('acuerdo-tratamiento-datos.html','utf8').includes('SIN FIRMAS Y SIN EFECTO CONTRACTUAL'))errors.push('Falta aviso DPA');
if(!fs.readFileSync('politica-datos.html','utf8').includes('15 de noviembre de 2026'))errors.push('Falta transición');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('OK: 9 páginas y 3 archivos públicos');
