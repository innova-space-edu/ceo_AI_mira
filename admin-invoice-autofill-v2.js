(() => {
  "use strict";

  const cfg = window.INNOVA_ADMIN_CONFIG || {};
  const companyRuts = (cfg.companyRuts || []).map(normalizeRut).filter(Boolean);
  const $ = (sel, root = document) => root.querySelector(sel);
  const MONTHS = { enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6, julio:7, agosto:8, septiembre:9, setiembre:9, octubre:10, noviembre:11, diciembre:12 };

  function normalizeText(value = "") {
    return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  }

  function normalizeRut(value = "") {
    return String(value).replace(/[^0-9kK]/g, "").toUpperCase();
  }

  function formatRut(value = "") {
    const raw = normalizeRut(value);
    if (raw.length < 2) return "";
    const body = raw.slice(0, -1), dv = raw.slice(-1), parts = [];
    for (let i = body.length; i > 0; i -= 3) parts.unshift(body.slice(Math.max(0, i - 3), i));
    return `${parts.join(".")}-${dv}`;
  }

  function findRuts(text = "") {
    const matches = String(text).match(/(?:\b\d{1,2}(?:\.\d{3}){2}|\b\d{7,8})\s*-\s*[0-9Kk]\b/g) || [];
    return [...new Set(matches.map(formatRut).filter(Boolean))];
  }

  function money(value = "") {
    const s = String(value).trim().replace(/[^0-9.,-]/g, "");
    if (!s) return 0;
    if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(s)) return Number(s.replace(/\./g, "").replace(",", "."));
    if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ""));
    return Number(s.replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".")) || 0;
  }

  function isoDate(value = "") {
    const s = normalizeText(value).toLowerCase();
    if (!s) return "";
    let m = s.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (m) return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
    m = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
    m = s.match(/\b(\d{1,2})\s+de\s+([a-z]+)\s+(?:de\s+)?(20\d{2})\b/);
    if (m && MONTHS[m[2]]) return `${m[3]}-${String(MONTHS[m[2]]).padStart(2,"0")}-${m[1].padStart(2,"0")}`;
    return "";
  }

  function dteType(text = "") {
    const t = normalizeText(text).toUpperCase();
    if (t.includes("FACTURA NO AFECTA O EXENTA ELECTRONICA") || t.includes("FACTURA EXENTA ELECTRONICA")) return "34";
    if (t.includes("FACTURA ELECTRONICA")) return "33";
    if (t.includes("NOTA DE CREDITO ELECTRONICA")) return "61";
    if (t.includes("NOTA DE DEBITO ELECTRONICA")) return "56";
    if (t.includes("GUIA DE DESPACHO ELECTRONICA")) return "52";
    if (t.includes("BOLETA NO AFECTA O EXENTA ELECTRONICA")) return "41";
    if (t.includes("BOLETA ELECTRONICA")) return "39";
    return "";
  }

  function xmlNode(root, name) {
    const wanted = String(name).toUpperCase();
    return [...root.getElementsByTagName("*")].find((n) => String(n.localName || n.nodeName).toUpperCase() === wanted);
  }

  function xmlText(root, name) {
    return xmlNode(root, name)?.textContent?.trim() || "";
  }

  function xmlNodes(root, name) {
    const wanted = String(name).toUpperCase();
    return [...root.getElementsByTagName("*")].filter((n) => String(n.localName || n.nodeName).toUpperCase() === wanted);
  }

  function parseXml(text) {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("XML inválido");

    const hasDte = !!xmlNode(doc, "TipoDTE") || !!xmlNode(doc, "MntTotal") || !!xmlNode(doc, "RUTRecep");
    if (hasDte) {
      const root = xmlNodes(doc, "Documento")[0] || doc;
      const refs = xmlNodes(root, "Referencia").map((r) => {
        const folio = xmlText(r, "FolioRef"), date = xmlText(r, "FchRef"), reason = xmlText(r, "RazonRef");
        return [folio ? `Folio ${folio}` : "", date, reason].filter(Boolean).join(" · ");
      }).filter(Boolean);
      const payment = { "1":"Contado", "2":"Crédito", "3":"Sin costo" }[xmlText(root, "FmaPago")] || "";
      const notes = [];
      if (refs.length) notes.push(`Referencias: ${refs.join(" | ")}.`);
      if (payment) notes.push(`Forma de pago: ${payment}.`);
      return {
        kind: "XML DTE", priority: 4,
        dte_type: xmlText(root,"TipoDTE"), folio: xmlText(root,"Folio"),
        issuer_rut: formatRut(xmlText(root,"RUTEmisor")), issuer_name: xmlText(root,"RznSoc") || xmlText(root,"RznSocEmisor"),
        recipient_rut: formatRut(xmlText(root,"RUTRecep")), issue_date: isoDate(xmlText(root,"FchEmis")), due_date: isoDate(xmlText(root,"FchVenc")),
        net_amount: money(xmlText(root,"MntNeto")), exempt_amount: money(xmlText(root,"MntExe")), vat_amount: money(xmlText(root,"IVA")), total_amount: money(xmlText(root,"MntTotal")),
        notes: notes.join("\n"), sourceText: normalizeText(text)
      };
    }

    const siiIssuer = xmlText(doc, "RUTEMISOR");
    const siiType = xmlText(doc, "TIPODOC");
    const siiState = xmlText(doc, "ESTADO");
    const track = xmlText(doc, "TRACKID");
    const received = xmlText(doc, "TMSTRECEPCION");
    if (siiIssuer || siiType || siiState || track) {
      const notes = [`Validación SII${track ? ` Track ID ${track}` : ""}${siiState ? `: ${siiState}` : ""}${received ? ` · Recepción ${received}` : ""}.`];
      return { kind:"Resultado SII", priority:2, dte_type:siiType, issuer_rut:formatRut(siiIssuer), notes:notes.join("\n"), sourceText:normalizeText(text) };
    }
    throw new Error("XML sin datos DTE reconocibles");
  }

  function extractIssuerName(raw) {
    const lines = String(raw).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    for (let i = 1; i < lines.length; i += 1) {
      if (/^giro\s*:/i.test(lines[i])) {
        const candidate = lines[i - 1].trim();
        if (candidate.length >= 4 && candidate.length <= 120) return candidate;
      }
    }
    const t = normalizeText(raw);
    return t.match(/\b([A-Z][A-Z0-9 .&'-]{5,100})\s+Giro\s*:/)?.[1]?.trim() || "";
  }

  function extractSummaryAmounts(t) {
    const upper = t.toUpperCase();
    const start = upper.search(/MONTO\s+NETO|MONTO\s+EXENTO|\bNETO\b/);
    if (start < 0) return {};
    const totalPos = upper.indexOf("TOTAL", start + 4);
    const end = totalPos >= 0 ? totalPos + 5 : Math.min(t.length, start + 450);
    let block = t.slice(start, end).replace(/\b\d+(?:[.,]\d+)?\s*%/g, " ");
    const values = [...block.matchAll(/\b(?:\d{1,3}(?:\.\d{3})+|\d{4,12}|0)\b/g)].map((m) => money(m[0]));
    if (!values.length) return {};
    const result = { total_amount: values[values.length - 1] || 0 };
    const hasNet = /MONTO\s+NETO|\bNETO\b/i.test(block);
    const hasExempt = /EXENTO|MNT\s*EXE/i.test(block);
    const hasIva = /I\.?V\.?A\.?/i.test(block);
    const core = values.slice(0, -1);
    let idx = 0;
    if (hasNet && core[idx] !== undefined) result.net_amount = core[idx++];
    if (hasExempt && core[idx] !== undefined) result.exempt_amount = core[idx++];
    if (hasIva && core[idx] !== undefined) result.vat_amount = core[idx++];
    if (result.exempt_amount === undefined) result.exempt_amount = 0;
    return result;
  }

  function parsePdfText(raw) {
    const t = normalizeText(raw);
    const upper = t.toUpperCase();
    const ruts = findRuts(t);
    const companyRut = ruts.find((r) => companyRuts.includes(normalizeRut(r))) || "";

    const recipientStart = upper.search(/SENOR\s*\(?ES\)?\s*:/);
    const recipientZone = recipientStart >= 0 ? t.slice(recipientStart, recipientStart + 700) : "";
    const recipientRuts = findRuts(recipientZone);
    let recipientRut = recipientRuts.find((r) => normalizeRut(r) !== normalizeRut(companyRut)) || recipientRuts[0] || "";
    let issuerRut = companyRut || ruts.find((r) => normalizeRut(r) !== normalizeRut(recipientRut)) || ruts[0] || "";
    if (!recipientRut) recipientRut = ruts.find((r) => normalizeRut(r) !== normalizeRut(issuerRut)) || "";

    const recipientName = recipientZone.match(/SENOR\s*\(?ES\)?\s*:\s*(.*?)(?=\s+FECHA\s+EMISION|\s+R\.?U\.?T\.?\s*:)/i)?.[1]?.trim() || "";
    const issueRaw = t.match(/FECHA\s+EMISION\s*:?\s*(\d{1,2}\s+DE\s+[A-Z]+\s+(?:DE\s+)?20\d{2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2}|20\d{2}[\/.\-]\d{1,2}[\/.\-]\d{1,2})/i)?.[1] || "";
    const dueRaw = t.match(/FECHA\s+(?:DE\s+)?VENCIMIENTO\s*:?\s*(\d{1,2}\s+DE\s+[A-Z]+\s+(?:DE\s+)?20\d{2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2}|20\d{2}[\/.\-]\d{1,2}[\/.\-]\d{1,2})/i)?.[1] || "";

    let folio = "";
    for (const re of [
      /(?:FACTURA|BOLETA|NOTA\s+DE\s+(?:CREDITO|DEBITO)|GUIA\s+DE\s+DESPACHO)[\sA-Z]*?N\s*[°ºO.]?\s*([0-9]{1,12})/i,
      /\bFOLIO\s*[:#-]?\s*([0-9]{1,12})\b/i,
      /\bN\s*[°º]\s*([0-9]{1,12})\b/i
    ]) { const m = t.match(re); if (m) { folio = m[1]; break; } }

    const amounts = extractSummaryAmounts(t);
    if (amounts.total_amount && !amounts.net_amount && amounts.vat_amount) amounts.net_amount = Math.max(0, amounts.total_amount - amounts.vat_amount - (amounts.exempt_amount || 0));
    if (amounts.total_amount && amounts.net_amount && !amounts.vat_amount) amounts.vat_amount = Math.max(0, amounts.total_amount - amounts.net_amount - (amounts.exempt_amount || 0));
    if (amounts.total_amount && !amounts.net_amount && !amounts.vat_amount) {
      const net = Math.round(amounts.total_amount / 1.19), vat = amounts.total_amount - net;
      if (Math.abs(vat - Math.round(net * 0.19)) <= 2) { amounts.net_amount = net; amounts.vat_amount = vat; }
    }

    const refs = t.match(/REFERENCIAS?\s*:?\s*(.*?)(?=\s+FORMA\s+DE\s+PAGO|\s+MONTO\s+NETO|\s+I\.?V\.?A|\s+TOTAL)/i)?.[1]?.trim() || "";
    const payment = t.match(/FORMA\s+DE\s+PAGO\s*:?\s*([A-Z ]{3,30})/i)?.[1]?.trim() || "";
    const notes = [];
    if (refs) notes.push(`Referencias: ${refs}.`);
    if (payment) notes.push(`Forma de pago: ${payment}.`);
    if (recipientName) notes.push(`Receptor: ${recipientName}.`);

    return {
      kind:"PDF", priority:3, dte_type:dteType(t), folio,
      issuer_rut:issuerRut, issuer_name:extractIssuerName(raw), recipient_rut:recipientRut,
      issue_date:isoDate(issueRaw), due_date:isoDate(dueRaw),
      net_amount:amounts.net_amount || 0, exempt_amount:amounts.exempt_amount || 0,
      vat_amount:amounts.vat_amount || 0, total_amount:amounts.total_amount || 0,
      notes:notes.join("\n"), sourceText:t
    };
  }

  async function pdfText(file) {
    if (!window.pdfjsLib) throw new Error("PDF.js no disponible");
    const pdf = await window.pdfjsLib.getDocument({ data:new Uint8Array(await file.arrayBuffer()) }).promise;
    let out = "";
    for (let p = 1; p <= Math.min(pdf.numPages, 100); p += 1) {
      const page = await pdf.getPage(p), content = await page.getTextContent();
      out += content.items.map((i) => i.str).join(" ") + "\n";
      if (out.length > 220000) break;
    }
    return out.slice(0,220000);
  }

  async function parseFile(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf") || file.type === "application/pdf") return [parsePdfText(await pdfText(file))];
    if (name.endsWith(".xml") || /xml/.test(file.type)) return [parseXml(await file.text())];
    if (name.endsWith(".zip") || /zip/.test(file.type)) {
      if (!window.JSZip) throw new Error("JSZip no disponible");
      const zip = await window.JSZip.loadAsync(file), results = [];
      for (const entry of Object.values(zip.files).filter((e) => !e.dir && /\.(xml|txt)$/i.test(e.name)).slice(0,25)) {
        const text = await entry.async("text");
        if (/\.xml$/i.test(entry.name)) { try { const parsed = parseXml(text); parsed.kind = `ZIP/${parsed.kind}`; results.push(parsed); } catch (_) {} }
        else if (/RESULTADO\s+DE\s+VALIDACION/i.test(normalizeText(text))) {
          const issuer = text.match(/Rut de Empresa Emisora\s*:\s*([0-9.-]+)/i)?.[1] || "";
          const type = text.match(/Tipo DTE[\s\S]*?\n\s*(\d{2,3})\s+/i)?.[1] || "";
          const state = text.match(/Estado del Envio\s*:\s*(.+)/i)?.[1]?.trim() || "";
          results.push({ kind:"ZIP/Resultado SII", priority:2, issuer_rut:formatRut(issuer), dte_type:type, notes:state ? `Validación SII: ${state}.` : "", sourceText:normalizeText(text) });
        }
      }
      if (!results.length) throw new Error("ZIP sin DTE o resultado SII reconocible");
      return results;
    }
    return [];
  }

  function merge(results) {
    const ordered = [...results].sort((a,b) => (b.priority || 0) - (a.priority || 0));
    const out = {};
    for (const key of ["dte_type","folio","issuer_rut","issuer_name","recipient_rut","issue_date","due_date","net_amount","exempt_amount","vat_amount","total_amount"]) {
      const item = ordered.find((x) => x[key] !== undefined && x[key] !== null && String(x[key]) !== "" && !(typeof x[key] === "number" && x[key] === 0));
      if (item) out[key] = item[key];
    }
    if (out.exempt_amount === undefined) out.exempt_amount = 0;
    out.notes = [...new Set(results.flatMap((x) => String(x.notes || "").split("\n")).map((x) => x.trim()).filter(Boolean))].join("\n");
    out.sourceText = results.map((x) => x.sourceText || "").join(" ");
    out.kinds = [...new Set(results.map((x) => x.kind).filter(Boolean))];
    return out;
  }

  function inferType(data) {
    const issuer = normalizeRut(data.issuer_rut), recipient = normalizeRut(data.recipient_rut);
    if (companyRuts.includes(issuer)) return "sale";
    if (companyRuts.includes(recipient)) return "purchase";
    return "";
  }

  function projectMatch(form, text) {
    const sel = form.elements.project_id, src = normalizeText(text).toLowerCase();
    if (!sel || !src) return "";
    const options = [...sel.options].filter((o) => o.value && normalizeText(o.textContent).length >= 4);
    const matches = options.filter((o) => src.includes(normalizeText(o.textContent).toLowerCase()));
    return matches.length === 1 ? matches[0].value : "";
  }

  function fill(data) {
    const form = $("#invoice-form");
    if (!form) return 0;
    let count = 0;
    for (const key of ["dte_type","folio","issuer_rut","issuer_name","recipient_rut","issue_date","due_date","net_amount","exempt_amount","vat_amount","total_amount"]) {
      const el = form.elements[key], value = data[key];
      if (!el || value === undefined || value === null || String(value) === "") continue;
      el.value = value; el.dataset.autofilled = "true"; count += 1;
    }
    const type = inferType(data); if (type && form.elements.invoice_type) { form.elements.invoice_type.value = type; count += 1; }
    const project = projectMatch(form, data.sourceText); if (project && form.elements.project_id) { form.elements.project_id.value = project; count += 1; }
    if (form.elements.payment_status) form.elements.payment_status.value ||= "pending";
    if (form.elements.notes && data.notes) { form.elements.notes.value = data.notes; count += 1; }
    return count;
  }

  async function process(files) {
    const list = [...files]; if (!list.length) return;
    const info = $("#invoice-processing");
    if (info) { info.classList.remove("hidden"); info.textContent = `Leyendo ${list.length} documento${list.length === 1 ? "" : "s"}…`; }
    const results = [], failed = [];
    for (const file of list) { try { results.push(...await parseFile(file)); } catch (e) { console.warn(file.name, e); failed.push(file.name); } }
    if (!results.length) { if (info) info.textContent = "No se pudieron detectar datos tributarios automáticamente."; return; }
    const data = merge(results), count = fill(data);
    setTimeout(() => fill(data), 350);
    if (info) info.textContent = `Autorrelleno listo: ${count} campos detectados desde ${data.kinds.join(" + ")}${failed.length ? `. Sin datos útiles en: ${failed.join(", ")}` : ""}. Revisa y guarda.`;
  }

  function enhance() {
    const input = $("#invoice-file"); if (!input || input.dataset.autofillV2) return;
    input.dataset.autofillV2 = "1"; input.multiple = true;
    input.accept = ".pdf,.xml,.zip,application/pdf,text/xml,application/xml,application/zip,application/x-zip-compressed";
    const drop = $("#invoice-drop"); if (!drop) return;
    const strong = drop.querySelector("strong"), span = drop.querySelector("span");
    if (strong) strong.textContent = "Selecciona o arrastra PDF, XML/DTE o ZIP del SII";
    if (span) span.textContent = "Puedes subir uno o varios documentos de la misma factura. El sistema cruza los datos y completa el formulario automáticamente.";
  }

  new MutationObserver(enhance).observe(document.documentElement,{childList:true,subtree:true}); enhance();
  document.addEventListener("change", (e) => { if (e.target?.id === "invoice-file") process(e.target.files).catch(console.error); });
  document.addEventListener("drop", (e) => {
    if (!e.target?.closest?.("#invoice-drop") || !e.dataTransfer?.files?.length) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const input = $("#invoice-file"); if (!input) return;
    const dt = new DataTransfer(); [...e.dataTransfer.files].forEach((f) => dt.items.add(f)); input.files = dt.files;
    input.dispatchEvent(new Event("change",{bubbles:true}));
  }, true);
})();
