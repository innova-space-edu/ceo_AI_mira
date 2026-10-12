import fs from "node:fs";
const html=fs.readFileSync("documentos.html","utf8");
const base="assets/documentos/";
const pdfs=[
 base+"01_Programa_Integridad_Compliance_InnovaSpace_2026.pdf",
 base+"02_Manual_Politicas_Terminos_Condiciones_InnovaSpace_2026.pdf",
 base+"03_Respaldo_Difusion_Programa_Integridad_InnovaSpace_2026.pdf",
 ...["politica-datos","acuerdo-tratamiento-datos","protocolos-proteccion-datos","continuidad-respaldos","matriz-conservacion","plantilla-respaldos","estado-implementacion"].map(x=>base+"publicos/"+x+".pdf"),
 ...["rat-eduai","rat-sello","acta-gobernanza-2026"].map(x=>base+"publicos/"+x+".pdf")
];
const cards=[...html.matchAll(/<article class="document-card" data-pdf="([^"]+)" data-title="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)];
const errors=[];
if(cards.length!==pdfs.length)errors.push("Se esperaban 13 tarjetas; hay "+cards.length);
for(const name of pdfs){
  const match=cards.find(x=>x[1]===name);
  if(!match)errors.push("No existe tarjeta: "+name);
  else if(!match[3].includes("document-preview-btn")||!match[3].includes('href="'+name+'" download'))errors.push("Faltan acciones de PDF: "+name);
  if(process.argv.includes("--pdfs")){
    const file="_site/"+name;
    if(!fs.existsSync(file)||fs.statSync(file).size<1500)errors.push("PDF vacío o ausente: "+file);
    else if(fs.readFileSync(file).subarray(0,5).toString()!=="%PDF-")errors.push("PDF inválido: "+file);
  }else if(!name.includes("/publicos/")&&!fs.existsSync(name))errors.push("Falta PDF histórico: "+name);
}
for(const key of ['id="previewOpen"','id="pdfPreview"','id="previewDownload"','id="documentSearch"'])if(!html.includes(key))errors.push("Interacción faltante: "+key);
if(html.includes("document-placeholder"))errors.push("La biblioteca mantiene tarjetas vacías");
if(errors.length){console.error(errors.join("\n"));process.exit(1)}
console.log("13 tarjetas PDF con vista previa, apertura y descarga verificadas.");
