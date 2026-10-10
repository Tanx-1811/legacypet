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
import { fromOklch, oklchOf } from '../util/color.js';
import { magnify } from './mmpx.js';

const LIGHT = (() => {
  const v = [-0.45, -0.85, 1.05];
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
})();
const LIFT = [-0.16, -0.075, 0, 0.06, 0.13]; // lightness change for levels -2..2
const SHADOW_HUE = 300; // purple
const LIGHT_HUE = 95; // warm yellow
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Turns hue h toward `target` by up to `step` degrees, the way the ramp should travel: shadows
// go yellow → orange → red → purple and green → blue → purple; highlights go the other way round.
function lean(h, target, step, climbs) {
  const up = climbs(h);
  const dist = up ? (target - h + 360) % 360 : (h - target + 360) % 360;
  return (h + (up ? 1 : -1) * Math.min(dist, step) + 360) % 360;
}
const towardShadow = (h) => h >= 120 && h < SHADOW_HUE; // greens and blues climb to purple
const towardLight = (h) => h >= SHADOW_HUE - 25 || h < LIGHT_HUE; // purples and reds climb to yellow

const cache = new Map();

// One step of a ramp: level -2 (deep shadow) .. 0 (the color itself) .. 2 (highlight).
// `tint` is the hue a grey's shadows lean to (the outline's), or null for a cool grey.
export function shadeColor(hex, level, tint = null) {
  if (!level) return hex;
  const key = `${hex}|${level}|${tint}`;
  const hit = cache.get(key);
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
  cache.set(key, out);
  return out;
}

// Chamfer distance from every filled cell to the nearest empty one (or the edge of the grid).
function distanceField(fill, w, h) {
  const d = fill.map((f) => (f ? Infinity : 0));
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  const D = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (fill[i]) d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + D, at(x + 1, y - 1) + D);
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (fill[i]) d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + D, at(x - 1, y + 1) + D);
    }
  }
  return d;
}

// Labels the separate parts of the fill (4-connected).
function parts(fill, w, h) {
  const label = new Array(w * h).fill(-1);
  let count = 0;
  for (let i = 0; i < w * h; i++) {
    if (!fill[i] || label[i] >= 0) continue;
    const stack = [i];
    label[i] = count;
    while (stack.length) {
      const j = stack.pop();
      const x = j % w;
      const y = (j - x) / w;
      for (const [dx, dy] of N4) {
        const nx = x + dx;
        const ny = y + dy;
        const k = ny * w + nx;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && fill[k] && label[k] < 0) {
          label[k] = count;
          stack.push(k);
        }
      }
    }
    count++;
  }
  return { label, count };
}

// The light level (-2..2) of every filled cell.
export function lightLevels(fill, w, h) {
  const d = distanceField(fill, w, h);
  const { label, count } = parts(fill, w, h);
  // Each part is a dome as tall as it is thick (up to a point), with a round profile.
  const radius = new Array(count).fill(1.5);
  for (let i = 0; i < w * h; i++) if (fill[i]) radius[label[i]] = Math.min(5, Math.max(radius[label[i]], d[i]));
  let height = d.map((di, i) => {
    if (!fill[i]) return 0;
    const r = radius[label[i]];
    const t = r - Math.min(di, r);
    return Math.sqrt(r * r - t * t);
  });
  const hAt = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : height[y * w + x]);
  // One soft blur pass takes the corners off the chamfer distances.
  height = height.map((v, i) => {
    if (!fill[i]) return 0;
    const x = i % w;
    const y = (i - x) / w;
    return (4 * v + 2 * (hAt(x - 1, y) + hAt(x + 1, y) + hAt(x, y - 1) + hAt(x, y + 1))
      + hAt(x - 1, y - 1) + hAt(x + 1, y - 1) + hAt(x - 1, y + 1) + hAt(x + 1, y + 1)) / 16;
  });
  const level = new Array(w * h).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!fill[i]) continue;
      // Sobel gradient → surface normal → how much more (or less) light than a flat surface.
      const gx = (hAt(x + 1, y - 1) + 2 * hAt(x + 1, y) + hAt(x + 1, y + 1) - hAt(x - 1, y - 1) - 2 * hAt(x - 1, y) - hAt(x - 1, y + 1)) / 8;
      const gy = (hAt(x - 1, y + 1) + 2 * hAt(x, y + 1) + hAt(x + 1, y + 1) - hAt(x - 1, y - 1) - 2 * hAt(x, y - 1) - hAt(x + 1, y - 1)) / 8;
      const s = (LIGHT[2] - gx * LIGHT[0] - gy * LIGHT[1]) / Math.hypot(gx, gy, 1) - LIGHT[2];
      level[i] = s > 0.45 ? 2 : s > 0.17 ? 1 : s < -0.42 ? -2 : s < -0.15 ? -1 : 0;
    }
  }
  return despeckle(level, fill, w, h);
}

// A lone cell whose level none of its neighbours share takes the most common one around it.
function despeckle(level, fill, w, h) {
  let cur = level;
  for (let pass = 0; pass < 2; pass++) {
    const next = cur.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!fill[i]) continue;
        const around = [];
        for (const [dx, dy] of N4) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && fill[ny * w + nx]) around.push(cur[ny * w + nx]);
        }
        if (around.length < 2 || around.includes(cur[i])) continue;
        const votes = new Map();
        for (const v of around) votes.set(v, (votes.get(v) ?? 0) + 1);
        next[i] = [...votes].sort((a, b) => b[1] - a[1] || Math.abs(a[0]) - Math.abs(b[0]))[0][0];
      }
    }
    cur = next;
  }
  return cur;
}

const lumaOf = (hex) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
};

// Draws a sprite at twice its resolution: magnified, its outline thinned and the rest lit.
// `colorOf(letter)` gives each letter's color; `ink` is the outline letter (or null for none).
// Returns pixels { x, y, c } on the doubled grid, offset by (ox, oy).
export function hdPixels(rows, colorOf, { ink = 'o', light = true, ox = 0, oy = 0 } = {}) {
  const w = rows[0].length;
  const h = rows.length;
  const big = magnify(rows, (k) => lumaOf(colorOf(k)));
  const W = w * 2;
  const H = h * 2;
  let cells = big.flatMap((row) => [...row]);
  const empty = (grid, gw, gh, x, y) => x < 0 || y < 0 || x >= gw || y >= gh || grid[y * gw + x] === '.';
  const small = rows.flatMap((row) => [...row]);
  const rim = small.map((k, i) => k === ink && N4.some(([dx, dy]) => empty(small, w, h, (i % w) + dx, Math.floor(i / w) + dy)));
  if (ink) {
    const thin = cells.slice();
    cells.forEach((k, i) => {
      const x = i % W;
      const y = (i - x) / W;
      if (k !== ink || !rim[(y >> 1) * w + (x >> 1)] || N4.some(([dx, dy]) => empty(cells, W, H, x + dx, y + dy))) return;
      const votes = new Map();
      for (const [dx, dy] of N4) {
        const n = cells[(y + dy) * W + x + dx];
        if (n !== ink && n !== '.') votes.set(n, (votes.get(n) ?? 0) + 1);
      }
      if (votes.size) thin[i] = [...votes].sort((a, b) => b[1] - a[1])[0][0];
    });
    cells = thin;
  }
  const fill = cells.map((k) => k !== '.' && k !== ink);
  const level = light ? lightLevels(fill, W, H) : null;
  const inkHex = ink && colorOf(ink);
  const tone = inkHex ? oklchOf(inkHex) : null;
  const tint = tone && tone.c > 0.02 ? Math.round(tone.h) : null;
  const out = [];
  cells.forEach((k, i) => {
    if (k === '.') return;
    const x = i % W;
    const c = colorOf(k);
    out.push({ x: ox + x, y: oy + (i - x) / W, c: level && fill[i] ? shadeColor(c, level[i], tint) : c });
  });
  return out;
}
