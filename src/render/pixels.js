// Pixels are { x, y, c } where c is a hex color, or '.class' to paint with a CSS class
// (so theme-dependent pixels follow light/dark mode).
import { mix } from '../util/color.js';

const r1 = (v) => Math.round(v * 10) / 10;

export function gridToPixels(rows, colors, ox = 0, oy = 0, mirror = false) {
  const colorOf = typeof colors === 'function' ? colors : (ch) => colors[ch];
  const out = [];
  rows.forEach((row, y) => {
    const chars = [...row];
    if (mirror) chars.reverse();
    chars.forEach((ch, x) => {
      if (ch === '.') return;
      const c = colorOf(ch);
      if (!c) throw new Error(`No color for pixel "${ch}"`);
      out.push({ x: ox + x, y: oy + y, c });
    });
  });
  return out;
}

// A see-through color ('#rrggbbaa') laid over a solid one becomes the solid blend of the two.
const over = (under, top) => mix(under, top.slice(0, 7), parseInt(top.slice(7), 16) / 255);

// Draws pixels as SVG, one grid cell = `px` user units, the grid's origin at (ox, oy).
// Later pixels win; a see-through pixel over another blends into it (a blush on a cheek).
// Same-colored neighbours in a row merge into one run, and each color becomes a single <path>
// of runs, drawn in grid units and scaled once: far smaller than a <rect> per run, and rows
// that share an edge can't show a hairline seam between them.
export function drawPixels(pixels, px, ox = 0, oy = 0) {
  if (!pixels.length) return '';
  const { minX, minY, maxX, maxY } = bboxOf(pixels);
  const w = maxX - minX + 1;
  const grid = new Array(w * (maxY - minY + 1));
  for (const p of pixels) {
    const i = (p.y - minY) * w + p.x - minX;
    const under = grid[i];
    grid[i] = under?.length === 7 && under[0] === '#' && p.c.length === 9 && p.c[0] === '#' ? over(under, p.c) : p.c;
  }
  const paths = new Map();
  for (let i = 0; i < grid.length;) {
    const c = grid[i];
    const col = i % w;
    if (!c) {
      i++;
      continue;
    }
    let run = 1;
    while (col + run < w && grid[i + run] === c) run++;
    const x = col + minX;
    const y = (i - col) / w + minY;
    const path = paths.get(c);
    // After a run's `z` the pen is back at that run's start, so the next run moves relative to it.
    if (path) {
      path.d += `m${x - path.x} ${y - path.y}h${run}v1h-${run}z`;
      path.x = x;
      path.y = y;
    } else paths.set(c, { d: `M${x} ${y}h${run}v1h-${run}z`, x, y });
    i += run;
  }
  let out = '';
  for (const [c, { d }] of paths) out += `<path ${c.startsWith('.') ? `class="${c.slice(1)}"` : `fill="${c}"`} d="${d}"/>`;
  return `<g transform="translate(${r1(ox)} ${r1(oy)}) scale(${px})">${out}</g>`;
}

export const stamp = (rows, colors, px, ox, oy) => drawPixels(gridToPixels(rows, colors), px, ox, oy);

export function bboxOf(pixels) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pixels) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}
