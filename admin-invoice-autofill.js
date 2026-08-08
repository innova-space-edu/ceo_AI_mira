(() => {
  "use strict";

  const cfg = window.INNOVA_ADMIN_CONFIG || {};
  const companyRuts = (cfg.companyRuts || []).map(normalizeRut).filter(Boolean);
  const DTE_TYPES = [
    ["FACTURA NO AFECTA O EXENTA ELECTRONICA", "34"],
    ["FACTURA EXENTA ELECTRONICA", "34"],
    ["FACTURA ELECTRONICA", "33"],
    ["NOTA DE CREDITO ELECTRONICA", "61"],
    ["NOTA DE DEBITO ELECTRONICA", "56"],
    ["GUIA DE DESPACHO ELECTRONICA", "52"],
    ["BOLETA NO AFECTA O EXENTA ELECTRONICA", "41"],
    ["BOLETA ELECTRONICA", "39"],
  ];
  const SPANISH_MONTHS = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
    noviembre: 11, diciembre: 12,
  };

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
    if (raw.length < 2) return String(value || "").trim();
    const body = raw.slice(0, -1);
    const dv = raw.slice(-1);
    const groups = [];
    for (let i = body.length; i > 0; i -= 3) groups.unshift(body.slice(Math.max(0, i - 3), i));
    return `${groups.join(".")}-${dv}`;
  }

  function parseMoney(value = "") {
    const cleaned = String(value).replace(/[^0-9,.-]/g, "").trim();
    if (!cleaned) return 0;
    if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(cleaned)) return Number(cleaned.replace(/\./g, "").replace(",", "."));
    if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(cleaned)) return Number(cleaned.replace(/,/g, ""));
    return Number(cleaned.replace(/[.,](?=\d{3}(?:\D|$))/g, "").replace(",", ".")) || 0;
  }

  function toIsoDate(value = "") {
    const source = normalizeText(value).toLowerCase();
    if (!source) return "";
    const iso = source.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    const latam = source.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if (latam) return `${latam[3]}-${latam[2].padStart(2, "0")}-${latam[1].padStart(2, "0")}`;
    const words = source.match(/\b(\d{1,2})\s+de\s+([a-z]+)\s+(?:de\s+)?(20\d{2})\b/);
    if (words && SPANISH_MONTHS[words[2]]) return `${words[3]}-${String(SPANISH_MONTHS[words[2]]).padStart(2, "0")}-${words[1].padStart(2, "0")}`;
    return "";
  }

  function dteTypeFromText(text = "") {
    const upper = normalizeText(text).toUpperCase();
    const found = DTE_TYPES.find(([label]) => upper.includes(label));
    return found?.[1] || "";
  }

  function getXmlText(root, name) {
    const nodes = [...root.getElementsByTagName("*")];
    const el = nodes.find((n) => n.localName === name);
    return el?.textContent?.trim() || "";
  }

  function getXmlNodes(root, name) {
    return [...root.getElementsByTagName("*")].filter((n) => n.localName === name);
  }

  function parseDteXml(xml) {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("XML inválido");

    const documento = getXmlNodes(doc, "Documento")[0] || doc;
    const fmaPago = getXmlText(documento, "FmaPago");
    const paymentMap = { "1": "Contado", "2": "Crédito", "3": "Sin costo" };
    const references = getXmlNodes(documento, "Referencia").map((ref) => {
      const type = getXmlText(ref, "TpoDocRef");
      const folio = getXmlText(ref, "FolioRef");
      const date = getXmlText(ref, "FchRef");
      const reason = getXmlText(ref, "RazonRef");
      return [type ? `Tipo ${type}` : "", folio ? `Folio ${folio}` : "", date, reason].filter(Boolean).join(" · ");
    }).filter(Boolean);
    const detail = getXmlNodes(documento, "Detalle").slice(0, 8).map((row) => {
      const name = getXmlText(row, "NmbItem");
      const qty = getXmlText(row, "QtyItem");
      return [name, qty ? `x${qty}` : ""].filter(Boolean).join(" ");
    }).filter(Boolean);

    const notes = [];
    if (paymentMap[fmaPago]) notes.push(`Forma de pago: ${paymentMap[fmaPago]}.`);
    if (references.length) notes.push(`Referencias: ${references.join(" | ")}.`);
    if (detail.length) notes.push(`Detalle: ${detail.join(", ")}.`);

    return {
      dte_type: getXmlText(documento, "TipoDTE"),
      folio: getXmlText(documento, "Folio"),
      issuer_rut: formatRut(getXmlText(documento, "RUTEmisor")),
      issuer_name: getXmlText(documento, "RznSoc") || getXmlText(documento, "RznSocEmisor"),
      recipient_rut: formatRut(getXmlText(documento, "RUTRecep")),
      issue_date: toIsoDate(getXmlText(documento, "FchEmis")),
      due_date: toIsoDate(getXmlText(documento, "FchVenc")),
      net_amount: parseMoney(getXmlText(documento, "MntNeto")),
      exempt_amount: parseMoney(getXmlText(documento, "MntExe")),
      vat_amount: parseMoney(getXmlText(documento, "IVA")),
      total_amount: parseMoney(getXmlText(documento, "MntTotal")),
      notes: notes.join("\n"),
      sourceText: normalizeText(xml),
      sourceKind: "XML DTE",
    };
  }

  function findRuts(text = "") {
    const matches = String(text).match(/\b(?:\d{1,2}(?:\.\d{3}){2}|\d{7,8})-[0-9Kk]\b/g) || [];
    return [...new Set(matches.map(formatRut))];
  }

  function amountAfterLabel(text, labelPattern, maxGap = 80) {
    const re = new RegExp(`${labelPattern}[\\s:$]{0,${maxGap}}(?:CLP\\s*)?\\$?\\s*([0-9][0-9.,]{2,})`, "i");
    const match = text.match(re);
    return match ? parseMoney(match[1]) : 0;
  }

  function guessPdfData(text) {
    const raw = String(text || "");
    const t = normalizeText(raw);
    const upper = t.toUpperCase();
    const ruts = findRuts(t);

    const senorIndex = upper.search(/SEÑOR\s*\(?ES\)?\s*:/i);
    const recipientZone = senorIndex >= 0 ? t.slice(senorIndex, senorIndex + 650) : "";
    const recipientRuts = findRuts(recipientZone);
    let recipientRut = recipientRuts[0] || "";

    let issuerRut = "";
    if (senorIndex > 0) {
      const beforeRecipient = t.slice(0, senorIndex);
      issuerRut = findRuts(beforeRecipient)[0] || "";
    }
    if (!issuerRut) issuerRut = ruts.find((r) => normalizeRut(r) !== normalizeRut(recipientRut)) || ruts[0] || "";
    if (!recipientRut) recipientRut = ruts.find((r) => normalizeRut(r) !== normalizeRut(issuerRut)) || "";

    const issuerNameCandidates = [
      t.match(/(?:^|\s)([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .&'-]{5,100})\s+GIRO\s*:/i)?.[1],
      t.match(/(?:^|\s)([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .&'-]{5,100})\s+R\.?(?:U\.?)?T\.?\s*:/i)?.[1],
    ].filter(Boolean);
    let issuerName = normalizeText(issuerNameCandidates[0] || "").replace(/^(FACTURA|BOLETA).*$/i, "").trim();
    if (issuerName.length > 110) issuerName = "";

    const recipientName = recipientZone.match(/SEÑOR\s*\(?ES\)?\s*:\s*(.*?)(?=\s+(?:FECHA\s+EMISI[OÓ]N|R\.?(?:U\.?)?T\.?\s*:|GIRO\s*:))/i)?.[1];

    let folio = "";
    const folioPatterns = [
      /(?:FACTURA|BOLETA|NOTA\s+DE\s+(?:CREDITO|DEBITO)|GUIA\s+DE\s+DESPACHO)[^N]{0,60}N\s*[°ºO.]?\s*([0-9]{1,12})/i,
      /\bFOLIO\s*[:#-]?\s*([0-9]{1,12})\b/i,
      /\bN\s*[°º]\s*([0-9]{1,12})\b/i,
    ];
    for (const pattern of folioPatterns) {
      const m = t.match(pattern);
      if (m) { folio = m[1]; break; }
    }

    const issueMatch = t.match(/FECHA\s+EMISI[OÓ]N\s*:?\s*([^|]{4,40}?)(?=\s+(?:R\.?(?:U\.?)?T|GIRO|DIRECCI[OÓ]N|COMUNA|CIUDAD|TIPO\s+DE|C[OÓ]DIGO)|$)/i);
    const dueMatch = t.match(/FECHA\s+(?:DE\s+)?VENCIMIENTO\s*:?\s*([^|]{4,40}?)(?=\s+[A-ZÁÉÍÓÚÑ]{3,}|$)/i);

    let net = amountAfterLabel(t, "(?:MONTO\\s+)?NETO");
    let exempt = amountAfterLabel(t, "(?:MONTO\\s+)?EXENTO|MNT\\s*EXE");
    let vat = amountAfterLabel(t, "I\\.?V\\.?A\\.?\\s*(?:19\\s*%)?");
    let total = amountAfterLabel(t, "TOTAL");

    const bigAmounts = [...t.matchAll(/\b([0-9]{1,3}(?:\.[0-9]{3}){1,4}|[0-9]{5,12})\b/g)]
      .map((m) => parseMoney(m[1]))
      .filter((n) => n >= 1000);
    if (!total && bigAmounts.length) total = Math.max(...bigAmounts);

    if (total && !net && vat) net = Math.max(0, total - vat - exempt);
    if (total && !vat && net) vat = Math.max(0, total - net - exempt);
    if (total && !net && !vat && !exempt) {
      const possibleNet = Math.round(total / 1.19);
      const possibleVat = total - possibleNet;
      if (Math.abs(possibleVat - Math.round(possibleNet * 0.19)) <= 2) {
        net = possibleNet;
        vat = possibleVat;
      }
    }

    const refMatch = t.match(/REFERENCIAS?\s*:?\s*(.*?)(?=\s+FORMA\s+DE\s+PAGO|\s+MONTO\s+NETO|\s+I\.V\.A|\s+TOTAL)/i)?.[1];
    const payMatch = t.match(/FORMA\s+DE\s+PAGO\s*:?\s*([A-ZÁÉÍÓÚÑ ]{3,30})/i)?.[1];
    const notes = [];
    if (refMatch) notes.push(`Referencias: ${normalizeText(refMatch)}.`);
    if (payMatch) notes.push(`Forma de pago: ${normalizeText(payMatch)}.`);
    if (recipientName) notes.push(`Receptor: ${normalizeText(recipientName)}.`);

    return {
      dte_type: dteTypeFromText(t),
      folio,
      issuer_rut: issuerRut,
      issuer_name: issuerName,
      recipient_rut: recipientRut,
      issue_date: toIsoDate(issueMatch?.[1] || ""),
      due_date: toIsoDate(dueMatch?.[1] || ""),
      net_amount: net || 0,
      exempt_amount: exempt || 0,
      vat_amount: vat || 0,
      total_amount: total || 0,
      notes: notes.join("\n"),
      sourceText: t,
      sourceKind: "PDF",
    };
  }

  async function extractPdfText(file) {
    if (!window.pdfjsLib) throw new Error("PDF.js no está disponible");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
    let out = "";
    const max = Math.min(pdf.numPages, 100);
    for (let pageNum = 1; pageNum <= max; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      out += content.items.map((item) => item.str).join(" ") + "\n";
      if (out.length > 220000) break;
    }
    return out.slice(0, 220000);
  }

  async function parseZip(file) {
    if (!window.JSZip) throw new Error("JSZip no está disponible");
    const zip = await window.JSZip.loadAsync(file);
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);
    const xmlEntries = entries.filter((entry) => /\.xml$/i.test(entry.name));
    const results = [];
    for (const entry of xmlEntries.slice(0, 20)) {
      try {
        const xml = await entry.async("text");
        const data = parseDteXml(xml);
        if (data.folio || data.total_amount || data.issuer_rut) {
          data.sourceKind = `ZIP/XML: ${entry.name}`;
          results.push(data);
        }
      } catch (_) {
        // Algunos ZIP del SII incluyen XML de respuesta que no contiene un DTE completo.
      }
    }
    if (!results.length) throw new Error("El ZIP no contiene un XML DTE reconocible");
    return results;
  }

  function mergeData(results) {
    const score = (item) => item.sourceKind?.includes("XML") ? 3 : item.sourceKind === "PDF" ? 2 : 1;
    const ordered = [...results].sort((a, b) => score(b) - score(a));
    const merged = {};
    const keys = ["dte_type", "folio", "issuer_rut", "issuer_name", "recipient_rut", "issue_date", "due_date", "net_amount", "exempt_amount", "vat_amount", "total_amount"];
    for (const key of keys) {
      const candidate = ordered.find((item) => item[key] !== undefined && item[key] !== null && String(item[key]) !== "" && !(typeof item[key] === "number" && item[key] === 0));
      if (candidate) merged[key] = candidate[key];
    }
    if (merged.exempt_amount === undefined) merged.exempt_amount = 0;
    const notes = [...new Set(results.flatMap((item) => String(item.notes || "").split("\n")).map((x) => x.trim()).filter(Boolean))];
    merged.notes = notes.join("\n");
    merged.sourceText = results.map((item) => item.sourceText || "").join(" ");
    merged.sources = results.map((item) => item.sourceKind).filter(Boolean);
    return merged;
  }

  function inferInternalType(data) {
    const issuer = normalizeRut(data.issuer_rut);
    const recipient = normalizeRut(data.recipient_rut);
    if (companyRuts.includes(issuer)) return "sale";
    if (companyRuts.includes(recipient)) return "purchase";
    return "";
  }

  function matchProject(form, sourceText) {
    const select = form.elements.project_id;
    if (!select || !sourceText) return "";
    const source = normalizeText(sourceText).toLowerCase();
    const candidates = [...select.options].filter((o) => o.value && normalizeText(o.textContent).length >= 4);
    const exact = candidates.filter((o) => source.includes(normalizeText(o.textContent).toLowerCase()));
    if (exact.length === 1) return exact[0].value;
    return "";
  }

  function fillForm(data) {
    const form = $("#invoice-form");
    if (!form) return 0;
    let count = 0;
    const keys = ["dte_type", "folio", "issuer_rut", "issuer_name", "recipient_rut", "issue_date", "due_date", "net_amount", "exempt_amount", "vat_amount", "total_amount"];
    for (const key of keys) {
      const input = form.elements[key];
      const value = data[key];
      if (!input || value === undefined || value === null || String(value) === "") continue;
      input.value = value;
      input.dataset.autofilled = "true";
      count += 1;
    }

    const invoiceType = inferInternalType(data);
    if (invoiceType && form.elements.invoice_type) {
      form.elements.invoice_type.value = invoiceType;
      count += 1;
    }

    const projectId = matchProject(form, data.sourceText);
    if (projectId && form.elements.project_id) {
      form.elements.project_id.value = projectId;
      count += 1;
    }

    if (form.elements.payment_status && !form.elements.payment_status.value) form.elements.payment_status.value = "pending";
    if (form.elements.notes && data.notes) {
      const previous = form.elements.notes.value.trim();
      form.elements.notes.value = [previous, data.notes].filter(Boolean).join(previous ? "\n" : "");
      count += 1;
    }
    return count;
  }

  async function parseFile(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".xml") || /xml/.test(file.type)) return [parseDteXml(await file.text())];
    if (name.endsWith(".pdf") || file.type === "application/pdf") return [guessPdfData(await extractPdfText(file))];
    if (name.endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed") return parseZip(file);
    return [];
  }

  async function processAllFiles(files) {
    const list = [...files];
    if (!list.length) return;
    const info = $("#invoice-processing");
    if (info) {
      info.classList.remove("hidden");
      info.textContent = `Leyendo ${list.length} documento${list.length === 1 ? "" : "s"} y completando el formulario…`;
    }

    const results = [];
    const errors = [];
    for (const file of list) {
      try {
        results.push(...await parseFile(file));
      } catch (error) {
        console.warn("No se pudo interpretar", file.name, error);
        errors.push(file.name);
      }
    }

    if (!results.length) {
      if (info) info.textContent = "No se encontraron datos tributarios estructurados. Puedes completar el formulario manualmente.";
      return;
    }

    const merged = mergeData(results);
    const count = fillForm(merged);
    if (info) {
      const sources = [...new Set(merged.sources || [])].join(" + ");
      info.textContent = `Autorrelleno completado: ${count} campos detectados${sources ? ` desde ${sources}` : ""}${errors.length ? `. Sin datos útiles en: ${errors.join(", ")}` : ""}. Revisa antes de guardar.`;
    }
  }

  function enhanceInvoiceModal() {
    const input = $("#invoice-file");
    if (!input || input.dataset.invoiceAutofillReady === "true") return;
    input.dataset.invoiceAutofillReady = "true";
    input.multiple = true;
    input.accept = ".pdf,.xml,.zip,application/pdf,text/xml,application/xml,application/zip,application/x-zip-compressed";

    const drop = $("#invoice-drop");
    if (drop) {
      const strong = drop.querySelector("strong");
      const span = drop.querySelector("span");
      if (strong) strong.textContent = "Selecciona o arrastra PDF, XML/DTE o ZIP";
      if (span) span.textContent = "Puedes subir uno o varios documentos de la misma factura. XML/DTE tiene prioridad y PDF completa los datos faltantes.";
    }
  }

  const observer = new MutationObserver(() => enhanceInvoiceModal());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhanceInvoiceModal();

  document.addEventListener("change", (event) => {
    if (event.target?.id !== "invoice-file") return;
    processAllFiles(event.target.files).catch((error) => console.error("Autorrelleno de factura:", error));
  });

  document.addEventListener("drop", (event) => {
    const drop = event.target?.closest?.("#invoice-drop");
    if (!drop) return;
    const files = event.dataTransfer?.files;
    if (!files?.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const input = $("#invoice-file");
    if (!input) return;
    const dt = new DataTransfer();
    [...files].forEach((file) => dt.items.add(file));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, true);
})();
