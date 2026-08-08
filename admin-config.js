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

// Autorrelleno de facturas cargado desde admin-config.js porque este archivo
// forma parte del artefacto de GitHub Pages. La lógica funciona sobre el
// formulario dinámico que crea admin.js y no depende de un framework.
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

  const formatRut = (value = "") => {
    const raw = normalizeRut(value);
    if (raw.length < 2) return "";
    const body = raw.slice(0, -1);
    const dv = raw.slice(-1);
    const groups = [];
    for (let i = body.length; i > 0; i -= 3) groups.unshift(body.slice(Math.max(0, i - 3), i));
    return `${groups.join(".")}-${dv}`;
  };

  const dateISO = (value = "") => {
    const s = normalize(value).toLowerCase();
    let m = s.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    m = s.match(/\b(\d{1,2})\s+de\s+([a-z]+)\s+(?:de\s+)?(20\d{2})\b/);
    if (m && MONTHS[m[2]]) return `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, "0")}`;
    return "";
  };

  const allRuts = (text = "") => [...new Set(
    (String(text).match(/(?:\b\d{1,2}(?:\.\d{3}){2}|\b\d{7,8})\s*-\s*[0-9Kk]\b/g) || [])
      .map(formatRut)
      .filter(Boolean)
  )];

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

  function findAmounts(text = "") {
    const t = normalize(text);
    const upper = t.toUpperCase();
    const result = { net_amount: 0, exempt_amount: 0, vat_amount: 0, total_amount: 0 };

    const directTotal = t.match(/\bTOTAL\b[^0-9]{0,30}(\d{1,3}(?:\.\d{3})+|\d{4,12})/i);
    if (directTotal) result.total_amount = numberCL(directTotal[1]);

    const start = upper.search(/MONTO\s+NETO|\bMNTNETO\b|\bNETO\b/);
    if (start >= 0) {
      let block = t.slice(start, start + 650);
      block = block.replace(/\b\d+(?:[.,]\d+)?\s*%/g, " ");
      const values = [...block.matchAll(/(?:\b\d{1,3}(?:\.\d{3})+\b|\b\d{4,12}\b|\b0\b)/g)]
        .map((m) => numberCL(m[0]));
      const large = values.filter((v) => v >= 1000);
      if (large.length) result.net_amount = large[0];
      if (large.length >= 2) result.vat_amount = large[1];
      if (!result.total_amount && large.length >= 3) result.total_amount = large[large.length - 1];
    }

    const netDirect = t.match(/(?:MONTO\s+NETO|MNTNETO|\bNETO\b)[^0-9]{0,80}(\d{1,3}(?:\.\d{3})+|\d{4,12})/i);
    if (netDirect) result.net_amount = numberCL(netDirect[1]);

    const ivaDirect = t.match(/(?:I\.?V\.?A\.?)(?:\s*19\s*%)?[^0-9]{0,120}(\d{1,3}(?:\.\d{3})+|\d{4,12})/i);
    if (ivaDirect) result.vat_amount = numberCL(ivaDirect[1]);

    const exemptDirect = t.match(/(?:MONTO\s+EXENTO|MNTEXE|\bEXENTO\b)[^0-9]{0,80}(\d{1,3}(?:\.\d{3})+|\d{1,12})/i);
    if (exemptDirect) result.exempt_amount = numberCL(exemptDirect[1]);

    if (result.total_amount && result.net_amount && !result.vat_amount) {
      result.vat_amount = Math.max(0, result.total_amount - result.net_amount - result.exempt_amount);
    }
    if (result.total_amount && result.vat_amount && !result.net_amount) {
      result.net_amount = Math.max(0, result.total_amount - result.vat_amount - result.exempt_amount);
    }
    return result;
  }

  function parsePdfText(raw = "") {
    const t = normalize(raw);
    const upper = t.toUpperCase();
    const ruts = allRuts(t);

    const recipientPos = upper.search(/SENOR\s*\(?ES\)?\s*:/);
    const recipientZone = recipientPos >= 0 ? t.slice(recipientPos, recipientPos + 800) : "";
    const recipientRuts = allRuts(recipientZone);
    let recipientRut = recipientRuts[0] || "";

    const dtePos = upper.search(/FACTURA\s+(?:NO\s+AFECTA\s+O\s+EXENTA\s+)?ELECTRONICA|NOTA\s+DE\s+(?:CREDITO|DEBITO)\s+ELECTRONICA/);
    const dteZone = dtePos >= 0 ? t.slice(Math.max(0, dtePos - 180), dtePos + 220) : "";
    const dteRuts = allRuts(dteZone);
    let issuerRut = dteRuts.find((rut) => normalizeRut(rut) !== normalizeRut(recipientRut)) || "";

    if (!issuerRut) issuerRut = ruts.find((rut) => normalizeRut(rut) !== normalizeRut(recipientRut)) || ruts[0] || "";
    if (!recipientRut) recipientRut = ruts.find((rut) => normalizeRut(rut) !== normalizeRut(issuerRut)) || "";

    let folio = "";
    for (const re of [
      /(?:FACTURA|BOLETA|NOTA\s+DE\s+(?:CREDITO|DEBITO)|GUIA\s+DE\s+DESPACHO)[\sA-Z]*?N\s*[°ºO.]?\s*([0-9]{1,12})/i,
      /\bFOLIO\s*[:#-]?\s*([0-9]{1,12})\b/i,
      /\bN\s*[°º]\s*([0-9]{1,12})\b/i
    ]) {
      const m = t.match(re);
      if (m) { folio = m[1]; break; }
    }

    let issuerName = "";
    const nameMatch = raw.match(/(?:^|\n)\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .&'\-]{4,120})\s*(?:\n|\r\n?)\s*Giro\s*:/im)
      || t.match(/\b([A-Z][A-Z0-9 .&'\-]{5,120})\s+Giro\s*:/i);
    if (nameMatch) issuerName = String(nameMatch[1]).trim();

    const issueMatch = t.match(/FECHA\s+EMISION\s*:?\s*(\d{1,2}\s+DE\s+[A-Z]+\s+(?:DE\s+)?20\d{2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2}|20\d{2}[\/.\-]\d{1,2}[\/.\-]\d{1,2})/i);
    const dueMatch = t.match(/FECHA\s+(?:DE\s+)?VENCIMIENTO\s*:?\s*(\d{1,2}\s+DE\s+[A-Z]+\s+(?:DE\s+)?20\d{2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2}|20\d{2}[\/.\-]\d{1,2}[\/.\-]\d{1,2})/i);

    const refs = t.match(/REFERENCIAS?\s*:?\s*(.*?)(?=\s+FORMA\s+DE\s+PAGO|\s+MONTO\s+NETO|\s+I\.?V\.?A|\s+TOTAL)/i)?.[1]?.trim() || "";
    const payment = t.match(/FORMA\s+DE\s+PAGO\s*:?\s*([A-ZÁÉÍÓÚÑ ]{3,30})/i)?.[1]?.trim() || "";
    const notes = [refs ? `Referencias: ${refs}.` : "", payment ? `Forma de pago: ${payment}.` : ""].filter(Boolean).join("\n");

    return {
      dte_type: dteType(t),
      folio,
      issuer_rut: issuerRut,
      issuer_name: issuerName,
      recipient_rut: recipientRut,
      issue_date: dateISO(issueMatch?.[1] || ""),
      due_date: dateISO(dueMatch?.[1] || ""),
      ...findAmounts(t),
      notes
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
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
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
