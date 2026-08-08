(() => {
  "use strict";

  const cfg = window.INNOVA_ADMIN_CONFIG || {};
  const companyRuts = (cfg.companyRuts || []).map(normalizeRut).filter(Boolean);
  const $ = (sel, root = document) => root.querySelector(sel);

  function normalizeText(value = "") {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeRut(value = "") {
    return String(value).replace(/[^0-9kK]/g, "").toUpperCase();
  }

  function formatRut(value = "") {
    const raw = normalizeRut(value);
    if (raw.length < 2) return "";
    const body = raw.slice(0, -1);
    const dv = raw.slice(-1);
    const parts = [];
    for (let i = body.length; i > 0; i -= 3) parts.unshift(body.slice(Math.max(0, i - 3), i));
    return `${parts.join(".")}-${dv}`;
  }

  function findRuts(text = "") {
    const found = String(text).match(/(?:\b\d{1,2}(?:\.\d{3}){2}|\b\d{7,8})\s*-\s*[0-9Kk]\b/g) || [];
    return [...new Set(found.map(formatRut).filter(Boolean))];
  }

  function parseMoney(value) {
    if (value === null || value === undefined || value === "") return null;
    const s = String(value).replace(/[^0-9,.-]/g, "").trim();
    if (!s) return null;
    if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(s)) return Number(s.replace(/\./g, "").replace(",", "."));
    if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ""));
    return Number(s.replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", "."));
  }

  function isoDate(value = "") {
    const s = normalizeText(value).toLowerCase();
    if (!s) return "";
    let m = s.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const months = { enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6, julio:7, agosto:8, septiembre:9, setiembre:9, octubre:10, noviembre:11, diciembre:12 };
    m = s.match(/\b(\d{1,2})\s+de\s+([a-z]+)\s+(?:de\s+)?(20\d{2})\b/);
    if (m && months[m[2]]) return `${m[3]}-${String(months[m[2]]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return "";
  }

  function dteTypeFromText(text = "") {
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

  function xmlText(root, name) {
    const wanted = String(name).toUpperCase();
    const el = [...root.getElementsByTagName("*")].find((n) => String(n.localName || n.nodeName).toUpperCase() === wanted);
    return el?.textContent?.trim() || "";
  }

  function parseXml(text) {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("XML inválido");
    const total = xmlText(doc, "MntTotal");
    const tipo = xmlText(doc, "TipoDTE");
    if (tipo || total || xmlText(doc, "RUTRecep")) {
      const fma = { "1":"Contado", "2":"Crédito", "3":"Sin costo" }[xmlText(doc, "FmaPago")] || "";
      return {
        priority: 4,
        kind: "XML DTE",
        dte_type: tipo,
        folio: xmlText(doc, "Folio"),
        issuer_rut: formatRut(xmlText(doc, "RUTEmisor")),
        issuer_name: xmlText(doc, "RznSoc") || xmlText(doc, "RznSocEmisor"),
        recipient_rut: formatRut(xmlText(doc, "RUTRecep")),
        issue_date: isoDate(xmlText(doc, "FchEmis")),
        due_date: isoDate(xmlText(doc, "FchVenc")),
        net_amount: parseMoney(xmlText(doc, "MntNeto")),
        exempt_amount: parseMoney(xmlText(doc, "MntExe")) ?? 0,
        vat_amount: parseMoney(xmlText(doc, "IVA")),
        total_amount: parseMoney(total),
        notes: fma ? `Forma de pago: ${fma}.` : "",
        sourceText: normalizeText(text),
      };
    }
    const siiRut = xmlText(doc, "RUTEMISOR");
    const siiType = xmlText(doc, "TIPODOC");
    const siiState = xmlText(doc, "ESTADO");
    if (siiRut || siiType || siiState) {
      return {
        priority: 2,
        kind: "Resultado SII",
        issuer_rut: formatRut(siiRut),
        dte_type: siiType,
        notes: siiState ? `Validación SII: ${siiState}.` : "",
        sourceText: normalizeText(text),
      };
    }
    throw new Error("XML sin datos tributarios reconocibles");
  }

  function lastAmount(text, regex) {
    const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
    const re = new RegExp(regex.source, flags);
    let match, last = null;
    while ((match = re.exec(text))) last = parseMoney(match[1]);
    return last;
  }

  function parsePdfText(raw) {
    const t = normalizeText(raw);
    const upper = t.toUpperCase();
    const ruts = findRuts(t);

    const recipientStart = upper.search(/SENOR\s*\(?ES\)?\s*:/);
    const recipientZone = recipientStart >= 0 ? t.slice(recipientStart, recipientStart + 900) : "";
    const recipientRuts = findRuts(recipientZone);
    const recipientRut = recipientRuts[0] || "";
    const issuerRut = ruts.find((r) => normalizeRut(r) !== normalizeRut(recipientRut)) || ruts[0] || "";

    let issuerName = "";
    const nameMatch = t.match(/([A-Z][A-Z0-9 .&'\-]{5,100})\s+Giro\s*:/) || t.match(/([A-Z][A-Z0-9 .&'\-]{5,100})\s+GIRO\s*:/);
    if (nameMatch) issuerName = nameMatch[1].trim();

    let folio = "";
    const folioPatterns = [
      /(?:FACTURA|BOLETA|NOTA\s+DE\s+(?:CREDITO|DEBITO)|GUIA\s+DE\s+DESPACHO)[A-Z\s]*?N\s*[°ºO.]?\s*(\d{1,12})/i,
      /\bFOLIO\s*[:#-]?\s*(\d{1,12})\b/i,
      /\bN\s*[°º]\s*(\d{1,12})\b/i,
    ];
    for (const re of folioPatterns) {
      const m = t.match(re);
      if (m) { folio = m[1]; break; }
    }

    const issueRaw = t.match(/FECHA\s+EMISION\s*:?\s*(\d{1,2}\s+DE\s+[A-Z]+\s+(?:DE\s+)?20\d{2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2}|20\d{2}[\/.\-]\d{1,2}[\/.\-]\d{1,2})/i)?.[1] || "";
    const dueRaw = t.match(/FECHA\s+(?:DE\s+)?VENCIMIENTO\s*:?\s*(\d{1,2}\s+DE\s+[A-Z]+\s+(?:DE\s+)?20\d{2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2}|20\d{2}[\/.\-]\d{1,2}[\/.\-]\d{1,2})/i)?.[1] || "";

    let net = lastAmount(t, /MONTO\s+NETO\s*\$?\s*([\d.,]+)/i);
    const exempt = lastAmount(t, /(?:MONTO\s+EXENTO|MNT\s*EXE|EXENTO)\s*\$?\s*([\d.,]+)/i);
    let vat = lastAmount(t, /I\.?\s*V\.?\s*A\.?\s*(?:19\s*%)?\s*\$?\s*([\d.,]+)/i);
    let total = lastAmount(t, /\bTOTAL\s*\$?\s*([\d.,]+)/i);

    if (total !== null && net === null && vat !== null) net = total - vat - (exempt || 0);
    if (total !== null && net !== null && vat === null) vat = total - net - (exempt || 0);
    if (total === null && net !== null && vat !== null) total = net + vat + (exempt || 0);

    const refs = t.match(/REFERENCIAS?\s*:?\s*(.*?)(?=\s+FORMA\s+DE\s+PAGO|\s+MONTO\s+NETO|\s+I\.?V\.?A|\s+TOTAL)/i)?.[1]?.trim() || "";
    const payment = t.match(/FORMA\s+DE\s+PAGO\s*:?\s*([A-ZÁÉÍÓÚÜÑ ]{3,35})/i)?.[1]?.trim() || "";
    const recipientName = recipientZone.match(/SENOR\s*\(?ES\)?\s*:\s*(.*?)(?=\s+FECHA\s+EMISION|\s+R\.?U\.?T\.?\s*:)/i)?.[1]?.trim() || "";
    const notes = [];
    if (refs) notes.push(`Referencias: ${refs}.`);
    if (payment) notes.push(`Forma de pago: ${payment}.`);
    if (recipientName) notes.push(`Receptor: ${recipientName}.`);

    return {
      priority: 3,
      kind: "PDF",
      dte_type: dteTypeFromText(t),
      folio,
      issuer_rut: issuerRut,
      issuer_name: issuerName,
      recipient_rut: recipientRut,
      issue_date: isoDate(issueRaw),
      due_date: isoDate(dueRaw),
      net_amount: net,
      exempt_amount: exempt ?? 0,
      vat_amount: vat,
      total_amount: total,
      notes: notes.join("\n"),
      sourceText: t,
    };
  }

  async function pdfText(file) {
    if (!window.pdfjsLib) throw new Error("PDF.js no disponible");
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    let out = "";
    for (let p = 1; p <= Math.min(pdf.numPages, 100); p += 1) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      out += content.items.map((i) => i.str).join(" ") + "\n";
      if (out.length > 240000) break;
    }
    return out.slice(0, 240000);
  }

  async function parseFile(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf") || file.type === "application/pdf") return [parsePdfText(await pdfText(file))];
    if (name.endsWith(".xml") || /xml/.test(file.type)) return [parseXml(await file.text())];
    if (name.endsWith(".zip") || /zip/.test(file.type)) {
      if (!window.JSZip) throw new Error("JSZip no disponible");
      const zip = await window.JSZip.loadAsync(file);
      const rows = [];
      for (const entry of Object.values(zip.files).filter((e) => !e.dir && /\.(xml|txt)$/i.test(e.name)).slice(0, 30)) {
        const text = await entry.async("text");
        if (/\.xml$/i.test(entry.name)) {
          try { rows.push(parseXml(text)); } catch (_) {}
        } else {
          const rut = text.match(/Rut de Empresa Emisora\s*:\s*([0-9.\-]+)/i)?.[1] || "";
          const tipo = text.match(/Tipo DTE[\s\S]*?\n\s*(\d{2,3})\b/i)?.[1] || "";
          const estado = text.match(/Estado del Envio\s*:\s*(.+)/i)?.[1]?.trim() || "";
          if (rut || tipo || estado) rows.push({ priority:2, kind:"ZIP SII", issuer_rut:formatRut(rut), dte_type:tipo, notes:estado ? `Validación SII: ${estado}.` : "", sourceText:normalizeText(text) });
        }
      }
      if (!rows.length) throw new Error("ZIP sin información DTE reconocible");
      return rows;
    }
    return [];
  }

  function mergeResults(results) {
    const ordered = [...results].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    const out = {};
    const keys = ["dte_type","folio","issuer_rut","issuer_name","recipient_rut","issue_date","due_date","net_amount","exempt_amount","vat_amount","total_amount"];
    for (const key of keys) {
      const item = ordered.find((x) => x[key] !== undefined && x[key] !== null && String(x[key]) !== "");
      if (item) out[key] = item[key];
    }
    if (out.exempt_amount === undefined) out.exempt_amount = 0;
    out.notes = [...new Set(results.flatMap((x) => String(x.notes || "").split("\n")).map((x) => x.trim()).filter(Boolean))].join("\n");
    out.sourceText = results.map((x) => x.sourceText || "").join(" ");
    out.kinds = [...new Set(results.map((x) => x.kind).filter(Boolean))];
    return out;
  }

  function inferInternalType(data) {
    const issuer = normalizeRut(data.issuer_rut);
    const recipient = normalizeRut(data.recipient_rut);
    if (companyRuts.includes(issuer)) return "sale";
    if (companyRuts.includes(recipient)) return "purchase";
    return "";
  }

  function fillForm(data) {
    const form = $("#invoice-form");
    if (!form) return 0;
    let count = 0;
    const keys = ["dte_type","folio","issuer_rut","issuer_name","recipient_rut","issue_date","due_date","net_amount","exempt_amount","vat_amount","total_amount"];
    for (const key of keys) {
      const el = form.elements[key];
      const value = data[key];
      if (!el || value === undefined || value === null || String(value) === "") continue;
      el.value = value;
      el.dataset.autofilled = "true";
      count += 1;
    }
    const internalType = inferInternalType(data);
    if (internalType && form.elements.invoice_type) form.elements.invoice_type.value = internalType;
    if (form.elements.notes && data.notes) form.elements.notes.value = data.notes;
    return count;
  }

  function setInfo(message) {
    const info = $("#invoice-processing");
    if (!info) return;
    info.classList.remove("hidden");
    info.textContent = message;
  }

  async function processFiles(files) {
    const list = [...files];
    if (!list.length) return;
    setInfo(`Leyendo ${list.length} documento${list.length === 1 ? "" : "s"} y detectando datos…`);
    const parsed = [];
    const failed = [];
    for (const file of list) {
      try { parsed.push(...await parseFile(file)); }
      catch (error) { console.warn("Autorrelleno factura:", file.name, error); failed.push(file.name); }
    }
    if (!parsed.length) {
      setInfo("No se pudieron detectar datos tributarios en el archivo. Si el PDF es una imagen escaneada, se necesitará OCR.");
      return;
    }
    const data = mergeResults(parsed);
    const apply = () => {
      const count = fillForm(data);
      setInfo(`Autorrelleno listo: ${count} campos detectados desde ${data.kinds.join(" + ")}${failed.length ? `. No se pudo leer: ${failed.join(", ")}` : ""}.`);
    };
    apply();
    setTimeout(apply, 500);
    setTimeout(apply, 1400);
    setTimeout(apply, 2600);
  }

  function enhanceInvoiceInput() {
    const input = $("#invoice-file");
    if (!input || input.dataset.autofillV3) return;
    input.dataset.autofillV3 = "1";
    input.multiple = true;
    input.accept = ".pdf,.xml,.zip,application/pdf,text/xml,application/xml,application/zip,application/x-zip-compressed";
    const drop = $("#invoice-drop");
    if (drop) {
      const strong = drop.querySelector("strong");
      const span = drop.querySelector("span");
      if (strong) strong.textContent = "Selecciona PDF, XML/DTE o ZIP del SII";
      if (span) span.textContent = "Al seleccionar los archivos, el formulario se completa automáticamente en segundos.";
    }
  }

  new MutationObserver(enhanceInvoiceInput).observe(document.documentElement, { childList:true, subtree:true });
  enhanceInvoiceInput();

  document.addEventListener("change", (event) => {
    if (event.target?.id !== "invoice-file") return;
    processFiles(event.target.files).catch((error) => {
      console.error(error);
      setInfo("Ocurrió un error al leer la factura. Revisa la consola del navegador para más detalle.");
    });
  });
})();
