const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

export const escapeXml = (value) => String(value).replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);

// Monospace column width: emoji take two columns, joiners and variation selectors none.
export function charWidth(ch) {
  const cp = ch.codePointAt(0);
  if (cp === 0xfe0f || cp === 0x200d) return 0;
  if (cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf)) return 2;
  return 1;
}

export function textWidth(text) {
  let width = 0;
  for (const ch of text) width += charWidth(ch);
  return width;
}

export function truncate(text, maxCols) {
  if (textWidth(text) <= maxCols) return text;
  let out = '';
  for (const ch of text) {
    if (textWidth(out + ch) > maxCols - 1) break;
    out += ch;
  }
  return `${out.trimEnd()}…`;
}

export function wrapText(text, maxCols, maxLines) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate) <= maxCols || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const tail = lines.slice(maxLines - 1).join(' ');
    return [...lines.slice(0, maxLines - 1), truncate(tail, maxCols)];
  }
  return lines.map((l) => truncate(l, maxCols));
}
