// Drawing in the terminal: a small pixel canvas printed with half blocks (two pixels per
// character cell, one on top of the other), text laid over it, and a player that redraws
// frames in place. No dependencies: plain ANSI escape codes.
import { mix, parseHex } from '../util/color.js';
import { charWidth, textWidth } from '../util/text.js';

export const RESET = '\x1b[0m';

// How many colors the terminal shows: 'true' (24-bit), '256', or 'none'.
// NO_COLOR (https://no-color.org) always wins; FORCE_COLOR draws colors into a pipe too.
export function colorMode(stream = process.stdout, env = process.env) {
  if (env.NO_COLOR) return 'none';
  if (env.FORCE_COLOR === '0' || env.TERM === 'dumb') return 'none';
  if (!stream.isTTY) return env.FORCE_COLOR ? (env.FORCE_COLOR === '2' ? '256' : 'true') : 'none';
  const depth = stream.getColorDepth?.(env) ?? 8;
  // Windows' console and nearly every terminal that says "16 colors" really shows 256.
  return depth >= 24 ? 'true' : '256';
}

const CUBE = [0, 95, 135, 175, 215, 255];
const cubeIndex = (v) => (v < 48 ? 0 : v < 115 ? 1 : Math.floor((v - 35) / 40));

// The nearest of the 256 xterm colors: the 6×6×6 cube or the grey ramp, whichever is closer.
export function to256(hex) {
  const { r, g, b } = parseHex(hex);
  const [ri, gi, bi] = [cubeIndex(r), cubeIndex(g), cubeIndex(b)];
  const grey = Math.min(23, Math.max(0, Math.round(((r + g + b) / 3 - 8) / 10)));
  const gv = 8 + grey * 10;
  const dist = (x, y, z) => (r - x) ** 2 + (g - y) ** 2 + (b - z) ** 2;
  return dist(CUBE[ri], CUBE[gi], CUBE[bi]) <= dist(gv, gv, gv) ? 16 + 36 * ri + 6 * gi + bi : 232 + grey;
}

function painter(mode) {
  const cache = new Map();
  return (hex, layer) => {
    const key = `${layer}${hex}`;
    let seq = cache.get(key);
    if (seq === undefined) {
      if (mode === 'true') {
        const { r, g, b } = parseHex(hex);
        seq = `\x1b[${layer === 'bg' ? 48 : 38};2;${r};${g};${b}m`;
      } else seq = `\x1b[${layer === 'bg' ? 48 : 38};5;${to256(hex)}m`;
      cache.set(key, seq);
    }
    return seq;
  };
}

// Paints styled pieces of text: [text, { color, bold, dim }]. Plain text when there is no color.
export function paint(mode) {
  const color = mode === 'none' ? null : painter(mode);
  return (text, { fg = null, bold = false, dim = false } = {}) => {
    if (!color || (!fg && !bold && !dim)) return text;
    return `${bold ? '\x1b[1m' : ''}${dim ? '\x1b[2m' : ''}${fg ? color(fg, 'fg') : ''}${text}${RESET}`;
  };
}

// The visible width of a line that may hold escape codes.
export const visibleWidth = (line) => textWidth(line.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ''));

export class Canvas {
  constructor(width, height) {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(2, Math.round(height) + (Math.round(height) % 2));
    this.pixels = new Array(this.width * this.height).fill(null);
    this.glyphs = new Map(); // cell index → { ch, color, bold } (or { skip } behind a wide character)
  }

  get rows() {
    return this.height / 2;
  }

  // A see-through color ('#rrggbbaa') blends into what is already there. Over the terminal's
  // own background there is nothing to blend with: mostly-solid pixels are drawn, faint ones not.
  set(x, y, color) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (!color || color[0] !== '#' || px < 0 || py < 0 || px >= this.width || py >= this.height) return;
    const i = py * this.width + px;
    let c = color;
    if (c.length === 9) {
      const alpha = parseInt(c.slice(7), 16) / 255;
      const under = this.pixels[i];
      if (under) c = mix(under, c.slice(0, 7), alpha);
      else if (alpha >= 0.5) c = c.slice(0, 7);
      else return;
    }
    this.pixels[i] = c;
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    return this.pixels[y * this.width + x];
  }

  // A pixel-art stamp: rows of characters, '.' see-through, others looked up in `colors`.
  stamp(rows, colors, x, y, { flip = false } = {}) {
    const ox = Math.round(x);
    const oy = Math.round(y);
    rows.forEach((row, dy) => {
      const chars = [...row];
      if (flip) chars.reverse();
      chars.forEach((ch, dx) => {
        if (ch !== '.') this.set(ox + dx, oy + dy, typeof colors === 'function' ? colors(ch) : colors[ch]);
      });
    });
  }

  // Text on character row `row`, from column `col`. Wide characters (emoji, CJK) take two cells.
  text(col, row, str, color = null, { bold = false } = {}) {
    const r = Math.round(row);
    if (r < 0 || r >= this.rows) return;
    let c = Math.round(col);
    for (const ch of String(str)) {
      const w = charWidth(ch);
      if (w === 0) continue;
      if (c >= 0 && c + w <= this.width) {
        this.glyphs.set(r * this.width + c, { ch, color, bold });
        if (w === 2) this.glyphs.set(r * this.width + c + 1, { skip: true });
      }
      c += w;
    }
  }

  // One string per character row. Runs of the same colors share one escape code.
  lines(mode = 'true') {
    const color = mode === 'none' ? null : painter(mode);
    const out = [];
    for (let row = 0; row < this.rows; row++) {
      let line = '';
      let style = '';
      let pending = 0; // spaces held back: trailing ones are never written
      const put = (seq, ch) => {
        if (ch === ' ' && !seq) {
          pending += 1;
          return;
        }
        if (pending) {
          if (style) line += RESET;
          style = '';
          line += ' '.repeat(pending);
          pending = 0;
        }
        if (seq !== style) {
          line += (style ? RESET : '') + seq;
          style = seq;
        }
        line += ch;
      };
      for (let col = 0; col < this.width; col++) {
        const glyph = this.glyphs.get(row * this.width + col);
        if (glyph?.skip) continue;
        const top = this.pixels[2 * row * this.width + col];
        const bottom = this.pixels[(2 * row + 1) * this.width + col];
        if (glyph) {
          // Text sits on whatever is behind it, so a word over the pet stays readable.
          const behind = bottom ?? top;
          const seq = color ? `${glyph.bold ? '\x1b[1m' : ''}${glyph.color ? color(glyph.color, 'fg') : ''}${behind ? color(behind, 'bg') : ''}` : '';
          put(seq, glyph.ch);
        } else if (!color || (!top && !bottom)) put('', ' ');
        else if (top && bottom) put(top === bottom ? color(top, 'fg') : `${color(top, 'fg')}${color(bottom, 'bg')}`, top === bottom ? '█' : '▀');
        else if (top) put(color(top, 'fg'), '▀');
        else put(color(bottom, 'fg'), '▄');
      }
      out.push(style ? `${line}${RESET}` : line);
    }
    return out;
  }
}

// Places text columns next to (or under) a block of lines, padding by visible width.
export function sideBySide(left, right, { gap = 2, width = null } = {}) {
  const leftWidth = Math.max(0, ...left.map(visibleWidth));
  const rows = Math.max(left.length, right.length);
  const top = rows - right.length; // the panel sits at the bottom, by the pet's feet
  const out = [];
  for (let i = 0; i < rows; i++) {
    const l = left[i] ?? '';
    const r = right[i - top] ?? '';
    out.push(r ? `${l}${' '.repeat(leftWidth - visibleWidth(l) + gap)}${r}` : l);
  }
  return width ? out.map((line) => clip(line, width)) : out;
}

// Cuts a line with escape codes down to `width` visible columns.
export function clip(line, width) {
  if (visibleWidth(line) <= width) return line;
  let out = '';
  let cols = 0;
  for (const part of line.split(/(\x1b\[[0-9;?]*[A-Za-z])/)) {
    if (part.startsWith('\x1b[')) {
      out += part;
      continue;
    }
    for (const ch of part) {
      const w = charWidth(ch);
      if (cols + w > width - 1) return `${out}…${RESET}`;
      out += ch;
      cols += w;
    }
  }
  return out;
}

// Redraws a block of lines in place: the cursor goes back up to the block's first line and
// every line is rewritten. Frames go out in one write, inside a synchronized update where
// the terminal supports it, so nothing flickers.
export function createPlayer(out = process.stdout) {
  let drawn = 0;
  let last = null;
  let hidden = false;
  return {
    frame(lines) {
      const text = lines.join('\n');
      if (text === last) return;
      last = text;
      let s = '\x1b[?2026h';
      if (!hidden) {
        s += '\x1b[?25l';
        hidden = true;
      }
      if (drawn) s += `\x1b[${drawn}A\r`;
      for (const line of lines) s += `\x1b[2K${line}\n`;
      for (let i = lines.length; i < drawn; i++) s += '\x1b[2K\n';
      s += '\x1b[?2026l';
      out.write(s);
      drawn = Math.max(drawn, lines.length);
    },
    // Shows the cursor again. The last frame stays on screen, part of the scrollback.
    end() {
      if (hidden) out.write('\x1b[?25h');
      hidden = false;
    },
    get height() {
      return drawn;
    },
  };
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
