#!/usr/bin/env python3
"""Renderiza las plantillas Markdown públicas en HTML imprimible sin dependencias externas."""
import html
import pathlib
import re
import sys

source, destination, title, layout = sys.argv[1:]
lines = pathlib.Path(source).read_text(encoding="utf-8").replace("\r\n", "\n").split("\n")
output = []

def fmt(value):
    value = html.escape(value, quote=True)
    value = re.sub(r"\[([^\]]+)\]\((https?://[^\s)]+|\.\.?/[^\s)]+)\)",
                   lambda m: '<a href="' + html.escape(m.group(2), quote=True) + '">' + m.group(1) + '</a>', value)
    value = re.sub(r"\x60([^\x60]+)\x60", r"<code>\1</code>", value)
    value = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", value)
    value = re.sub(r"(?<!\*)\*([^\*\n]+)\*(?!\*)", r"<em>\1</em>", value)
    return value

def table_separator(line):
    return "|" in line and "-" in line and re.fullmatch(r"[\s|:\-]+", line) is not None

def cells(line):
    return [fmt(x.strip()) for x in line.strip().strip("|").split("|")]

def block(line, nxt):
    t = line.strip()
    return (bool(re.match(r"^#{1,6}\s+|^([-*]|\d+\.)\s+|^>\s+|^\x60{3}|^---+$", t))
            or ("|" in t and bool(nxt) and table_separator(nxt)))

i = 0
while i < len(lines):
    current = lines[i].strip()
    if not current:
        i += 1
        continue
    if re.match(r"^\x60{3}", current):
        i += 1
        code = []
        while i < len(lines) and not re.match(r"^\x60{3}", lines[i].strip()):
            code.append(lines[i])
            i += 1
        i += 1
        output.append("<pre><code>" + html.escape("\n".join(code)) + "</code></pre>")
        continue
    match = re.match(r"^(#{1,6})\s+(.*)$", current)
    if match:
        level = len(match.group(1))
        output.append(f"<h{level}>{fmt(match.group(2))}</h{level}>")
        i += 1
        continue
    if "|" in current and i + 1 < len(lines) and table_separator(lines[i + 1].strip()):
        headers = cells(current)
        i += 2
        table_rows = []
        while i < len(lines) and "|" in lines[i] and lines[i].strip():
            row = cells(lines[i])
            table_rows.append("<tr>" + "".join(
                "<td>" + (row[x] if x < len(row) else "") + "</td>" for x in range(len(headers))
            ) + "</tr>")
            i += 1
        output.append("<table><thead><tr>" + "".join("<th>" + x + "</th>" for x in headers)
                      + "</tr></thead><tbody>" + "".join(table_rows) + "</tbody></table>")
        continue
    if re.match(r"^([-*]|\d+\.)\s+", current):
        ordered = bool(re.match(r"^\d+\.\s", current))
        kind = "ol" if ordered else "ul"
        entries = []
        while i < len(lines) and re.match(r"^([-*]|\d+\.)\s+", lines[i].strip()):
            item = re.sub(r"^([-*]|\d+\.)\s+", "", lines[i].strip())
            item = re.sub(r"^\[[xX]\]\s*", "☑ ", item)
            item = re.sub(r"^\[ \]\s*", "☐ ", item)
            entries.append("<li>" + fmt(item) + "</li>")
            i += 1
        output.append("<" + kind + ">" + "".join(entries) + "</" + kind + ">")
        continue
    if re.match(r"^>\s", current):
        output.append("<blockquote>" + fmt(re.sub(r"^>\s+", "", current)) + "</blockquote>")
        i += 1
        continue
    if re.fullmatch(r"-{3,}", current):
        output.append("<hr>")
        i += 1
        continue
    paragraph = [current]
    i += 1
    while i < len(lines) and lines[i].strip() and not block(lines[i], lines[i + 1].strip() if i + 1 < len(lines) else ""):
        paragraph.append(lines[i].strip())
        i += 1
    output.append("<p>" + fmt(" ".join(paragraph)) + "</p>")

style = '<link rel="stylesheet" href="../pdf-print.css">'
if layout == "landscape":
    style += '<link rel="stylesheet" href="../pdf-landscape.css">'
page = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + html.escape(title) + '</title>' + style + '</head><body><main>' + "\n".join(output) + '</main></body></html>'
pathlib.Path(destination).write_text(page, encoding="utf-8")
print("Plantilla convertida:", source, "->", destination, "(" + str(len(output)) + " bloques)")
