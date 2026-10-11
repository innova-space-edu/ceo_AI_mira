#!/usr/bin/env bash
set -euo pipefail
if command -v google-chrome-stable >/dev/null 2>&1; then CHROME=google-chrome-stable
elif command -v google-chrome >/dev/null 2>&1; then CHROME=google-chrome
elif command -v chromium >/dev/null 2>&1; then CHROME=chromium
else echo 'Falta Chrome/Chromium: no se publican PDF incompletos.' >&2; exit 1; fi
command -v pandoc >/dev/null 2>&1 || { echo 'Falta Pandoc: no se publican PDF incompletos.' >&2; exit 1; }
ROOT="$(pwd)"
SITE="$ROOT/_site"
OUT="$SITE/assets/documentos/publicos"
SOURCE="$SITE/_pdf_fuentes_temporales"
mkdir -p "$OUT" "$SOURCE"
cat > "$SITE/pdf-print.css" <<'CSS'
@page{size:A4;margin:16mm}
html{font-family:Arial,Helvetica,sans-serif;color:#14263f;font-size:11pt;line-height:1.55}
body{max-width:none;margin:0}
h1,h2,h3{color:#113a64;break-after:avoid}
h1{font-size:23pt;border-bottom:3px solid #14bae4;padding-bottom:10pt}
h2{font-size:16pt;border-bottom:1px solid #bcd2e8;margin-top:18pt}
table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:9pt}
th,td{border:1px solid #b8cbe0;padding:6pt;vertical-align:top;overflow-wrap:anywhere}
th{background:#e8f4ff;color:#183a58}
tr{break-inside:avoid}
pre{white-space:pre-wrap;overflow-wrap:anywhere}
p,li{overflow-wrap:anywhere}
CSS
cat > "$SITE/pdf-landscape.css" <<'CSS'
@page{size:A3 landscape;margin:13mm}
table{font-size:8pt}
th,td{padding:5pt}
CSS
render_pdf() {
  local source="$1" dest="$2"
  "$CHROME" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --disable-extensions \
    --allow-file-access-from-files --no-pdf-header-footer \
    --print-to-pdf="$dest" "file://$(realpath "$source")" >/dev/null 2>&1
  if [[ ! -s "$dest" ]] || [[ "$(head -c 5 "$dest")" != '%PDF-' ]]; then
    echo "No se generó un PDF válido: $dest" >&2
    exit 1
  fi
  echo "PDF verificado: $dest"
}
render_pdf "$SITE/politica-datos.html" "$OUT/politica-datos.pdf"
render_pdf "$SITE/acuerdo-tratamiento-datos.html" "$OUT/acuerdo-tratamiento-datos.pdf"
render_pdf "$SITE/protocolos-proteccion-datos.html" "$OUT/protocolos-proteccion-datos.pdf"
render_pdf "$SITE/continuidad-respaldos.html" "$OUT/continuidad-respaldos.pdf"
render_markdown() {
  local source="$1" name="$2" output="$3" mode="$4"
  if [[ "$mode" == landscape ]]; then
    pandoc "$source" --standalone -f gfm -t html5 --metadata "title=$name" --css=../pdf-print.css --css=../pdf-landscape.css -o "$SOURCE/$output.html"
  else
    pandoc "$source" --standalone -f gfm -t html5 --metadata "title=$name" --css=../pdf-print.css -o "$SOURCE/$output.html"
  fi
  render_pdf "$SOURCE/$output.html" "$OUT/$output.pdf"
}
render_markdown "$ROOT/docs/PLANTILLA_MATRIZ_CONSERVACION_2026.md" 'Matriz de conservación' matriz-conservacion landscape
render_markdown "$ROOT/docs/PLANTILLA_RESPALDOS_CONTINUIDAD_2026.md" 'Respaldo y restauración' plantilla-respaldos portrait
render_markdown "$ROOT/docs/PRIVACY_REVIEW_CHECKLIST_2026.md" 'Estado público de implementación' estado-implementacion portrait
rm -rf "$SOURCE" "$SITE/pdf-print.css" "$SITE/pdf-landscape.css"
echo 'Los 7 PDF públicos se generaron y verificaron.'
