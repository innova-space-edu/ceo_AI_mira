window.INNOVA_ADMIN_CONFIG = Object.freeze({
  supabaseUrl: "https://alogqktilzgylzomzwem.supabase.co",
  supabasePublishableKey: "sb_publishable_x8GWfejC94VkWopDMUBXSQ_PQcqNIj8",
  backendUrl: "https://ceo-ai-mira.onrender.com",
  storageBucket: "company-files",
  companyName: "Innova Space Education SPA",
  companyEmail: "contacto@innova-space-edu.cl",
  companyRuts: ["10.236.204-7"],
  initialAdminEmail: "contacto@innova-space-edu.cl"
});

// Autorrelleno de facturas para la versión publicada en GitHub Pages.
// admin.js conserva el texto completo del PDF para auditoría; este módulo
// transforma ese mismo tipo de texto en campos estructurados del formulario.
(() => {
  "use strict";

  const MONTHS = {
    enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
    julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10",
    noviembre: "11", diciembre: "12"
  };

  const normalize = (value = "") => String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const numberCL = (value = "") => Number(String(value).replace(/[^0-9]/g, "")) || 0;
  const normalizeRut = (value = "") => String(value).replace(/[^0-9kK]/g, "").toUpperCase();

  function formatRut(value = "") {
    const raw = normalizeRut(value);
    if (raw.length < 2) return "";
    const body = raw.slice(0, -1);
    const dv = raw.slice(-1);
    const groups = [];
    for (let i = body.length; i > 0; i -= 3) groups.unshift(body.slice(Math.max(0, i - 3), i));
    return `${groups.join(".")}-${dv}`;
  }

  function dateISO(value = "") {
    const s = normalize(value).toLowerCase();
    let m = s.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    m = s.match(/\b(\d{1,2})\s+de\s+([a-z]+)\s+(?:de\s+)?(20\d{2})\b/);
    if (m && MONTHS[m[2]]) return `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, "0")}`;
    return "";
  }

  function allRuts(text = "") {
    const matches = String(text).match(/(?:\b\d{1,2}(?:\.\d{3}){2}|\b\d{7,8})\s*-\s*[0-9Kk]\b/g) || [];
    return [...new Set(matches.map(formatRut).filter(Boolean))];
  }

  function dteType(text = "") {
    const t = normalize(text).toUpperCase();
    if (t.includes("FACTURA NO AFECTA O EXENTA ELECTRONICA") || t.includes("FACTURA EXENTA ELECTRONICA")) return "34";
    if (t.includes("FACTURA ELECTRONICA")) return "33";
    if (t.includes("NOTA DE CREDITO ELECTRONICA")) return "61";
    if (t.includes("NOTA DE DEBITO ELECTRONICA")) return "56";
    if (t.includes("GUIA DE DESPACHO ELECTRONICA")) return "52";
    if (t.includes("BOLETA NO AFECTA O EXENTA ELECTRONICA")) return "41";
    if (t.includes("BOLETA ELECTRONICA")) return "39";
    return "";
  }

  // Los PDF tributarios chilenos no siempre entregan el texto en orden visual.
  // En algunos DTE, todos los rótulos aparecen primero y los cuatro montos después.
  // Por eso se recorta exclusivamente el bloque financiero y se interpreta su secuencia.
  function financialAmounts(text = "") {
    const t = normalize(text);
    const upper = t.toUpperCase();
    const out = { net_amount: 0, exempt_amount: 0, vat_amount: 0, total_amount: 0 };

    const start = upper.search(/MONTO\s+NETO|\bMNTNETO\b|\bNETO\b/);
    if (start >= 0) {
      const restUpper = upper.slice(start);
      let relativeEnd = restUpper.search(/\sR\.?\s*U\.?\s*T\.?\s*:/i);
      if (relativeEnd < 0) relativeEnd = restUpper.search(/TIMBRE\s+ELECTRONICO/i);
      if (relativeEnd < 0) relativeEnd = Math.min(restUpper.length, 500);

      let block = t.slice(start, start + relativeEnd);
      block = block.replace(/\b\d+(?:[.,]\d+)?\s*%/g, " ");

      const values = [...block.matchAll(/(?:\b\d{1,3}(?:\.\d{3})+\b|\b\d{4,12}\b|\b0\b)/g)]
        .map((m) => numberCL(m[0]));
      const monetary = values.filter((v) => v >= 1000);

      if (monetary.length >= 1) out.net_amount = monetary[0];
      if (monetary.length >= 2) out.vat_amount = monetary[1];
      if (monetary.length >= 3) out.total_amount = monetary[monetary.length - 1];

      if (/MONTO\s+EXENTO|MNTEXE/i.test(block)) {
        const total = out.total_amount;
        const net = out.net_amount;
        const iva = out.vat_amount;
        const calculated = total - net - iva;
        if (calculated > 0) out.exempt_amount = calculated;
      }
    }

    const totalAfter = t.match(/\bTOTAL\b\s*[:$]?\s*\$?\s*(\d{1,3}(?:\.\d{3})+|\d{4,12})/i);
    const totalBefore = t.match(/(\d{1,3}(?:\.\d{3})+|\d{4,12})\s*\$?\s*TOTAL\b/i);
    if (totalAfter) out.total_amount = numberCL(totalAfter[1]);
    else if (totalBefore) out.total_amount = numberCL(totalBefore[1]);

    // Solo usar coincidencias directas cuando el monto está inmediatamente junto al rótulo.
    const netDirect = t.match(/(?:MONTO\s+NETO|MNTNETO)\s*[:$]?\s*\$?\s*(\d{1,3}(?:\.\d{3})+|\d{4,12})/i);
    const ivaDirect = t.match(/I\.?V\.?A\.?(?:\s*19\s*%)?\s*[:$]?\s*\$?\s*(\d{1,3}(?:\.\d{3})+|\d{4,12})/i);
    const exemptDirect = t.match(/(?:MONTO\s+EXENTO|MNTEXE)\s*[:$]?\s*\$?\s*(\d{1,3}(?:\.\d{3})+|\d{1,12})/i);
    if (netDirect) out.net_amount = numberCL(netDirect[1]);
    if (ivaDirect) out.vat_amount = numberCL(ivaDirect[1]);
    if (exemptDirect) out.exempt_amount = numberCL(exemptDirect[1]);

    if (out.total_amount && out.net_amount && !out.vat_amount) {
      out.vat_amount = Math.max(0, out.total_amount - out.net_amount - out.exempt_amount);
    }
    if (out.total_amount && out.vat_amount && !out.net_amount) {
      out.net_amount = Math.max(0, out.total_amount - out.vat_amount - out.exempt_amount);
    }
    return out;
  }

  function parsePdfText(raw = "") {
    const t = normalize(raw);
    const upper = t.toUpperCase();
    const ruts = allRuts(t);

    const recipientPos = upper.search(/SENOR\s*\(?ES\)?\s*:/);
    const recipientZone = recipientPos >= 0 ? t.slice(recipientPos, recipientPos + 850) : "";
    const recipientRut = allRuts(recipientZone)[0] || "";

    const dtePos = upper.search(/FACTURA\s+(?:NO\s+AFECTA\s+O\s+EXENTA\s+)?ELECTRONICA|NOTA\s+DE\s+(?:CREDITO|DEBITO)\s+ELECTRONICA/);
    const dteZone = dtePos >= 0 ? t.slice(Math.max(0, dtePos - 240), dtePos + 220) : "";
    let issuerRut = allRuts(dteZone).find((rut) => normalizeRut(rut) !== normalizeRut(recipientRut)) || "";
    if (!issuerRut) issuerRut = ruts.find((rut) => normalizeRut(rut) !== normalizeRut(recipientRut)) || ruts[0] || "";

    let folio = "";
    for (const re of [
      /(?:FACTURA|BOLETA|NOTA\s+DE\s+(?:CREDITO|DEBITO)|GUIA\s+DE\s+DESPACHO)[\sA-Z]*?N\s*[°ºO.]?\s*([0-9]{1,12})/i,
      /\bFOLIO\s*[:#-]?\s*([0-9]{1,12})\b/i,
      /\bN\s*[°º]\s*([0-9]{1,12})\b/i
    ]) {
      const m = t.match(re);
      if (m) { folio = m[1]; break; }
    }

    const nameMatch = raw.match(/(?:^|\n)\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .&'\-]{4,120})\s*(?:\n|\r\n?)\s*Giro\s*:/im)
      || t.match(/\b([A-Z][A-Z0-9 .&'\-]{5,120})\s+Giro\s*:/i);

    const issueMatch = t.match(/FECHA\s+EMISION\s*:?\s*(\d{1,2}\s+DE\s+[A-Z]+\s+(?:DE\s+)?20\d{2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2}|20\d{2}[\/.\-]\d{1,2}[\/.\-]\d{1,2})/i);
    const dueMatch = t.match(/FECHA\s+(?:DE\s+)?VENCIMIENTO\s*:?\s*(\d{1,2}\s+DE\s+[A-Z]+\s+(?:DE\s+)?20\d{2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2}|20\d{2}[\/.\-]\d{1,2}[\/.\-]\d{1,2})/i);

    const refs = t.match(/REFERENCIAS?\s*:?\s*(.*?)(?=\s+FORMA\s+DE\s+PAGO|\s+MONTO\s+NETO|\s+I\.?V\.?A|\s+TOTAL)/i)?.[1]?.trim() || "";
    const payment = t.match(/FORMA\s+DE\s+PAGO\s*:?\s*(.*?)(?=\s+MONTO\s+NETO|\s+MONTO\s+EXENTO|\s+I\.?V\.?A|\s+TOTAL|$)/i)?.[1]?.trim() || "";

    return {
      dte_type: dteType(t),
      folio,
      issuer_rut: issuerRut,
      issuer_name: nameMatch ? String(nameMatch[1]).trim() : "",
      recipient_rut: recipientRut,
      issue_date: dateISO(issueMatch?.[1] || ""),
      due_date: dateISO(dueMatch?.[1] || ""),
      ...financialAmounts(t),
      notes: [refs ? `Referencias: ${refs}.` : "", payment ? `Forma de pago: ${payment}.` : ""].filter(Boolean).join("\n")
    };
  }

  function xmlText(root, name) {
    const wanted = String(name).toUpperCase();
    const node = [...root.getElementsByTagName("*")].find((n) => String(n.localName || n.nodeName).toUpperCase() === wanted);
    return node?.textContent?.trim() || "";
  }

  function parseXml(text = "") {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("XML inválido");
    return {
      dte_type: xmlText(doc, "TipoDTE"),
      folio: xmlText(doc, "Folio"),
      issuer_rut: formatRut(xmlText(doc, "RUTEmisor")),
      issuer_name: xmlText(doc, "RznSoc") || xmlText(doc, "RznSocEmisor"),
      recipient_rut: formatRut(xmlText(doc, "RUTRecep")),
      issue_date: dateISO(xmlText(doc, "FchEmis")),
      due_date: dateISO(xmlText(doc, "FchVenc")),
      net_amount: numberCL(xmlText(doc, "MntNeto")),
      exempt_amount: numberCL(xmlText(doc, "MntExe")),
      vat_amount: numberCL(xmlText(doc, "IVA")),
      total_amount: numberCL(xmlText(doc, "MntTotal"))
    };
  }

  async function extractPdf(file) {
    if (!window.pdfjsLib) throw new Error("PDF.js no está disponible");
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    let text = "";
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 80); pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      text += content.items.map((item) => item.str).join(" ") + "\n";
      if (text.length > 180000) break;
    }
    return text.slice(0, 180000);
  }

  function fillForm(data = {}) {
    const form = document.querySelector("#invoice-form");
    if (!form) return 0;
    let count = 0;
    const fields = ["dte_type", "folio", "issuer_rut", "issuer_name", "recipient_rut", "issue_date", "due_date", "net_amount", "exempt_amount", "vat_amount", "total_amount"];
    for (const key of fields) {
      const input = form.elements[key];
      const value = data[key];
      if (!input || value === undefined || value === null || String(value) === "") continue;
      input.value = value;
      input.dataset.autofilled = "true";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      count += 1;
    }
    if (form.elements.notes && data.notes) form.elements.notes.value = data.notes;

    const ownRuts = (window.INNOVA_ADMIN_CONFIG?.companyRuts || []).map(normalizeRut);
    const issuer = normalizeRut(data.issuer_rut);
    const recipient = normalizeRut(data.recipient_rut);
    if (form.elements.invoice_type) {
      if (ownRuts.includes(issuer)) form.elements.invoice_type.value = "sale";
      else if (ownRuts.includes(recipient)) form.elements.invoice_type.value = "purchase";
    }
    return count;
  }

  async function processFile(file) {
    if (!file) return;
    const info = document.querySelector("#invoice-processing");
    if (info) {
      info.classList.remove("hidden");
      info.textContent = `Leyendo ${file.name} y completando el formulario…`;
    }

    try {
      let data;
      if (file.name.toLowerCase().endsWith(".xml") || String(file.type).includes("xml")) {
        data = parseXml(await file.text());
      } else if (file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") {
        const text = await extractPdf(file);
        if (!normalize(text)) throw new Error("El PDF no contiene texto digital");
        data = parsePdfText(text);
      } else {
        return;
      }

      const count = fillForm(data);
      [250, 700, 1500, 2600].forEach((delay) => setTimeout(() => fillForm(data), delay));
      if (info) info.textContent = `Datos detectados y aplicados: ${count} campos. Revisa la información antes de guardar.`;
    } catch (error) {
      console.error("Autorrelleno de factura:", error);
      if (info) info.textContent = `No fue posible completar automáticamente: ${error.message}`;
    }
  }

  document.addEventListener("change", (event) => {
    if (event.target?.id !== "invoice-file") return;
    processFile(event.target.files?.[0]);
  });

  const enhance = () => {
    const input = document.querySelector("#invoice-file");
    const drop = document.querySelector("#invoice-drop");
    if (!input || !drop || input.dataset.innovaAutofill) return;
    input.dataset.innovaAutofill = "1";
    const title = drop.querySelector("strong");
    const help = drop.querySelector("span");
    if (title) title.textContent = "Selecciona PDF o XML DTE";
    if (help) help.textContent = "Al seleccionar el documento, los campos se completan automáticamente con la información detectada.";
  };

  new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
  enhance();
})();
