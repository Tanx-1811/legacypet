// Pixels are { x, y, c } where c is a hex color, or '.class' to paint with a CSS class
// (so theme-dependent pixels follow light/dark mode).

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

function rect(run, y, px, ox, oy) {
  const paint = run.c.startsWith('.') ? `class="${run.c.slice(1)}"` : `fill="${run.c}"`;
  return `<rect x="${r1(ox + run.x * px)}" y="${r1(oy + y * px)}" width="${r1(run.w * px)}" height="${r1(px)}" ${paint}/>`;
}

// Later pixels win. Same-colored neighbours in a row merge into one <rect>.
export function rectsFromPixels(pixels, px, ox = 0, oy = 0) {
  const cells = new Map();
  for (const p of pixels) cells.set(`${p.x},${p.y}`, p);
  const rows = new Map();
  for (const p of cells.values()) {
    if (!rows.has(p.y)) rows.set(p.y, []);
    rows.get(p.y).push(p);
  }
  let out = '';
  for (const y of [...rows.keys()].sort((a, b) => a - b)) {
    let run = null;
    for (const p of rows.get(y).sort((a, b) => a.x - b.x)) {
      if (run && p.x === run.x + run.w && p.c === run.c) {
        run.w += 1;
        continue;
      }
      if (run) out += rect(run, y, px, ox, oy);
      run = { x: p.x, w: 1, c: p.c };
    }
    if (run) out += rect(run, y, px, ox, oy);
  }
  return out;
}

export const stamp = (rows, colors, px, ox, oy) => rectsFromPixels(gridToPixels(rows, colors), px, ox, oy);

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
