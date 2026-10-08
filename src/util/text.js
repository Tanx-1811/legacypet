const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

export const escapeXml = (value) => String(value).replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);

// Chinese, Japanese and Korean: wide characters that can wrap anywhere (no spaces between words).
const CJK = '\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua960-\ua97f\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6';
const IS_CJK = new RegExp(`[${CJK}]`);
const TOKENS = new RegExp(`\s+|[${CJK}]|[^\s${CJK}]+`, 'g');
// Punctuation that must not start a line in CJK text.
const NO_LINE_START = /^[、。，．！？!?）」』〕ー…・〜]/;

// Monospace column width: emoji and CJK take two columns, joiners and variation selectors none.
export function charWidth(ch) {
  const cp = ch.codePointAt(0);
  if (cp === 0xfe0f || cp === 0x200d) return 0;
  if (cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf) || IS_CJK.test(ch)) return 2;
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

// Words separated by spaces, plus every CJK character on its own (glued to its neighbours).
function tokenize(text) {
  const out = [];
  let space = false;
  for (const [token] of text.matchAll(TOKENS)) {
    if (/^\s/.test(token)) {
      space = true;
      continue;
    }
    out.push({ token, space: space && out.length > 0 });
    space = false;
  }
  return out;
}

export function wrapText(text, maxCols, maxLines) {
  const lines = [];
  let line = '';
  for (const { token, space } of tokenize(text)) {
    const candidate = line ? `${line}${space ? ' ' : ''}${token}` : token;
    if (textWidth(candidate) <= maxCols || !line) {
      line = candidate;
    } else if (NO_LINE_START.test(token) && [...line].length > 1) {
      // Carry the last character down with the punctuation instead of orphaning it.
      const chars = [...line];
      const last = chars.pop();
      lines.push(chars.join(''));
      line = `${last}${token}`;
    } else {
      lines.push(line);
      line = token;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const tail = lines.slice(maxLines - 1).join(' ');
    return [...lines.slice(0, maxLines - 1), truncate(tail, maxCols)];
  }
  return lines.map((l) => truncate(l, maxCols));
}
