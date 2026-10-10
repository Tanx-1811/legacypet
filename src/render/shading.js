// Light for the pets: a soft light from the top left, shaded the way pixel artists do it by hand.
//
// 1. Shape: every part of a pet (head, ears, belly, a hat) becomes a little dome fitted to its own
//    silhouette (a distance field from the outline), so it gets a highlight on its top left and a
//    shadow on its bottom right without anyone drawing them, and every species gets them alike.
// 2. Color: tones come from a ramp built in OKLCH. Shadows don't just get darker, they lean toward
//    purple (warm colors through red, cool ones through blue) and highlights lean toward a warm
//    yellow, which is what keeps them from looking muddy. Whites and greys take a faint tint
//    from the species' own outline, so a panda's shadows are cool and a cat's are warm.
// 3. Outline: drawn at twice the resolution, the outline keeps only its outer half; the inner
//    half joins the fill, so the sprite reads as finer without losing its silhouette.
//
// The shape work (steps 1 and 3) depends only on a sprite's rows, so it runs once per sprite and
// is cached; drawing a pet after that is a table lookup per pixel, cheap enough for slow machines.
import { fromOklch, oklchOf } from '../util/color.js';
import { magnifyCodes } from './mmpx.js';

const LIGHT = (() => {
  const v = [-0.45, -0.85, 1.05];
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
})();
const LIFT = [-0.16, -0.075, 0, 0.06, 0.13]; // lightness change for levels -2..2
const SHADOW_HUE = 300; // purple
const LIGHT_HUE = 95; // warm yellow

// Turns hue h toward `target` by up to `step` degrees, the way the ramp should travel: shadows
// go yellow → orange → red → purple and green → blue → purple; highlights go the other way round.
function lean(h, target, step, climbs) {
  const up = climbs(h);
  const dist = up ? (target - h + 360) % 360 : (h - target + 360) % 360;
  return (h + (up ? 1 : -1) * Math.min(dist, step) + 360) % 360;
}
const towardShadow = (h) => h >= 120 && h < SHADOW_HUE; // greens and blues climb to purple
const towardLight = (h) => h >= SHADOW_HUE - 25 || h < LIGHT_HUE; // purples and reds climb to yellow

const tones = new Map();

// One step of a ramp: level -2 (deep shadow) .. 0 (the color itself) .. 2 (highlight).
// `tint` is the hue a grey's shadows lean to (the outline's), or null for a cool grey.
export function shadeColor(hex, level, tint = null) {
  if (!level) return hex;
  const key = `${hex}|${level}|${tint}`;
  const hit = tones.get(key);
  if (hit) return hit;
  const alpha = hex.length === 9 ? hex.slice(7) : '';
  const { l, c, h } = oklchOf(hex);
  const n = Math.abs(level);
  const dark = level < 0;
  const grey = c < 0.03;
  let lift = LIFT[level + 2];
  if (dark && l < 0.35) lift *= 0.75; // little room left below
  if (!dark && l > 0.9) lift *= 0.5; // or above
  if (!dark && l < 0.4) lift *= 1.3; // dark coats need a brighter sheen to show
  let hue = h;
  let chroma = c;
  if (dark) {
    if (grey) {
      hue = tint ?? 285;
      chroma = c + 0.012 * n;
    } else {
      hue = lean(h, SHADOW_HUE, 8 * n, towardShadow);
      chroma = c * (1 + 0.06 * n);
    }
  } else if (!grey) {
    // A warm shift turns a dark navy olive, so dark colors keep their hue in the light.
    if (l >= 0.5) hue = lean(h, LIGHT_HUE, 6 * n, towardLight);
    chroma = c * (1 - 0.14 * n);
  }
  const out = fromOklch({ l: l + lift, c: chroma, h: hue }, alpha);
  if (tones.size >= 4000) tones.clear();
  tones.set(key, out);
  return out;
}

// The light level (-2..2) of every filled cell of a w×h grid (`fill` is 1 for filled cells).
// Grids are padded with an empty border, so neighbours never need a bounds check.
export function lightLevels(fill, w, h) {
  const pw = w + 2;
  const size = pw * (h + 2);
  const at = (x, y) => (y + 1) * pw + x + 1;
  const solid = new Uint8Array(size);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) solid[at(x, y)] = fill[y * w + x];

  // Chamfer distance to the nearest empty cell, in two passes.
  const D = Math.SQRT2;
  const dist = new Float32Array(size);
  for (let i = 0; i < size; i++) dist[i] = solid[i] ? 1e9 : 0;
  for (let i = pw + 1; i < size - pw - 1; i++) {
    if (solid[i]) dist[i] = Math.min(dist[i], dist[i - 1] + 1, dist[i - pw] + 1, dist[i - pw - 1] + D, dist[i - pw + 1] + D);
  }
  for (let i = size - pw - 2; i > pw; i--) {
    if (solid[i]) dist[i] = Math.min(dist[i], dist[i + 1] + 1, dist[i + pw] + 1, dist[i + pw + 1] + D, dist[i + pw - 1] + D);
  }

  // Separate parts (4-connected), each a dome as tall as it is thick, up to a point.
  const part = new Int16Array(size).fill(-1);
  const radius = [];
  const stack = new Int32Array(size);
  for (let i = 0; i < size; i++) {
    if (!solid[i] || part[i] >= 0) continue;
    const id = radius.length;
    let r = 1.5;
    let top = 0;
    stack[top++] = i;
    part[i] = id;
    while (top) {
      const j = stack[--top];
      if (dist[j] > r) r = dist[j];
      if (solid[j - 1] && part[j - 1] < 0) { part[j - 1] = id; stack[top++] = j - 1; }
      if (solid[j + 1] && part[j + 1] < 0) { part[j + 1] = id; stack[top++] = j + 1; }
      if (solid[j - pw] && part[j - pw] < 0) { part[j - pw] = id; stack[top++] = j - pw; }
      if (solid[j + pw] && part[j + pw] < 0) { part[j + pw] = id; stack[top++] = j + pw; }
    }
    radius.push(Math.min(5, r));
  }
  const raw = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    if (!solid[i]) continue;
    const r = radius[part[i]];
    const t = r - Math.min(dist[i], r);
    raw[i] = Math.sqrt(r * r - t * t);
  }
  // One soft blur pass takes the corners off the chamfer distances.
  const height = new Float32Array(size);
  for (let i = pw + 1; i < size - pw - 1; i++) {
    if (!solid[i]) continue;
    height[i] = (4 * raw[i] + 2 * (raw[i - 1] + raw[i + 1] + raw[i - pw] + raw[i + pw])
      + raw[i - pw - 1] + raw[i - pw + 1] + raw[i + pw - 1] + raw[i + pw + 1]) / 16;
  }

  // Sobel gradient → surface normal → how much more (or less) light than a flat surface gets.
  const level = new Int8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = at(x, y);
      if (!solid[i]) continue;
      const gx = (height[i - pw + 1] + 2 * height[i + 1] + height[i + pw + 1] - height[i - pw - 1] - 2 * height[i - 1] - height[i + pw - 1]) / 8;
      const gy = (height[i + pw - 1] + 2 * height[i + pw] + height[i + pw + 1] - height[i - pw - 1] - 2 * height[i - pw] - height[i - pw + 1]) / 8;
      const s = (LIGHT[2] - gx * LIGHT[0] - gy * LIGHT[1]) / Math.hypot(gx, gy, 1) - LIGHT[2];
      level[y * w + x] = s > 0.45 ? 2 : s > 0.17 ? 1 : s < -0.42 ? -2 : s < -0.15 ? -1 : 0;
    }
  }
  return despeckle(level, fill, w, h);
}

// A lone cell whose level none of its neighbours share takes the most common one around it
// (on a tie, the one closest to the plain color).
function despeckle(level, fill, w, h) {
  let cur = level;
  const votes = new Int8Array(5);
  for (let pass = 0; pass < 2; pass++) {
    const next = cur.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!fill[i]) continue;
        votes.fill(0);
        let around = 0;
        if (x > 0 && fill[i - 1]) { votes[cur[i - 1] + 2]++; around++; }
        if (x < w - 1 && fill[i + 1]) { votes[cur[i + 1] + 2]++; around++; }
        if (y > 0 && fill[i - w]) { votes[cur[i - w] + 2]++; around++; }
        if (y < h - 1 && fill[i + w]) { votes[cur[i + w] + 2]++; around++; }
        if (around < 2 || votes[cur[i] + 2]) continue;
        let best = 0;
        for (const v of [-1, 1, -2, 2]) if (votes[v + 2] > votes[best + 2]) best = v;
        next[i] = best;
      }
    }
    cur = next;
  }
  return cur;
}

// The shape of a sprite at twice its resolution: the letter in each cell after MMPX and the
// outline thinning, and how much light each cell gets. It depends only on the rows and on how
// their letters rank by brightness, so it is worked out once per sprite and kept.
const shapes = new WeakMap();
const DOT = 46; // '.'

function shapeOf(rows, rank, ink, light) {
  const key = `${rank}|${ink}|${light}`;
  let byRank = shapes.get(rows);
  if (!byRank) shapes.set(rows, (byRank = new Map()));
  const hit = byRank.get(key);
  if (hit) return hit;

  const { codes, w: W, h: H } = magnifyCodes(rows, (k) => rank.indexOf(k));
  const cells = codes;
  const INK = ink ? ink.charCodeAt(0) : -1;
  if (ink) {
    // Where the outline faces the outside, its inner half joins the fill next to it.
    const w = rows[0].length;
    const h = rows.length;
    const outside = (y, x) => y < 0 || x < 0 || y >= h || x >= w || rows[y].charCodeAt(x) === DOT;
    const rim = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        rim[y * w + x] = rows[y].charCodeAt(x) === INK && (outside(y, x - 1) || outside(y, x + 1) || outside(y - 1, x) || outside(y + 1, x)) ? 1 : 0;
      }
    }
    const thin = cells.slice();
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (cells[i] !== INK || !rim[(y >> 1) * w + (x >> 1)]) continue;
        const around = [cells[i - 1], cells[i + 1], cells[i - W], cells[i + W]];
        if (around.includes(DOT)) continue;
        // The most common fill letter around it (the first one seen on a tie).
        let best = -1;
        let votes = 0;
        for (const n of around) {
          if (n === INK) continue;
          let count = 0;
          for (const m of around) if (m === n) count++;
          if (count > votes) { best = n; votes = count; }
        }
        if (best >= 0) thin[i] = best;
      }
    }
    cells.set(thin);
  }
  const fill = new Uint8Array(cells.length);
  for (let i = 0; i < cells.length; i++) fill[i] = cells[i] !== DOT && cells[i] !== INK ? 1 : 0;
  const shape = { W, cells, fill, level: light ? lightLevels(fill, W, H) : null };
  byRank.set(key, shape);
  return shape;
}

const lumaOf = (hex) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
};

const LEVELS = [-2, -1, 0, 1, 2];

// Draws a sprite at twice its resolution: magnified, its outline thinned and the rest lit.
// `colorOf(letter)` gives each letter's color and `ink` is the outline letter (null for none).
// `rankBy(letter)` gives the colors that decide which letter wins where MMPX has to choose:
// pass the sprite's usual colors, so a pet keeps exactly the same shape in every mood and tint.
// Returns pixels { x, y, c } on the doubled grid, offset by (ox, oy).
export function hdPixels(rows, colorOf, { ink = 'o', light = true, ox = 0, oy = 0, rankBy = colorOf } = {}) {
  const letters = [...new Set(rows.join(''))].filter((k) => k !== '.');
  // Letters from darkest to lightest (ties broken by letter, so the order is stable).
  const rank = letters
    .map((k) => [k, lumaOf(rankBy(k))])
    .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1))
    .map(([k]) => k)
    .join('');
  const { W, cells, fill, level } = shapeOf(rows, rank, ink, light);
  const inkHex = ink && colorOf(ink);
  const tone = inkHex ? oklchOf(inkHex) : null;
  const tint = tone && tone.c > 0.02 ? Math.round(tone.h) : null;
  // Every tone each letter can take, worked out once instead of once per pixel.
  const ramp = [];
  for (const k of letters) {
    const c = colorOf(k);
    ramp[k.charCodeAt(0)] = level ? LEVELS.map((v) => shadeColor(c, v, tint)) : [c, c, c, c, c];
  }
  const out = [];
  for (let i = 0; i < cells.length; i++) {
    const k = cells[i];
    if (k === DOT) continue;
    const x = i % W;
    out.push({ x: ox + x, y: oy + (i - x) / W, c: ramp[k][fill[i] && level ? level[i] + 2 : 2] });
  }
  return out;
}
