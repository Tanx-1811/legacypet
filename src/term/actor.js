// The pet as a terminal sprite: the same pixels as the badge (or the cards' HD ones), how it
// idles in each mood, and its signature move, replayed from the card's own keyframes.
import { composePet } from '../render/compose.js';
import { EFFECT_FRAMES, FLAME, MOVES, moveOf } from '../render/moves.js';
import { PALS } from '../sprites/accessories.js';
import { mix } from '../util/color.js';

// Moves are written in the card's units: 7 of them make one cell of the species' grid.
const CARD_UNIT = 7;
export const REST = Object.freeze({ dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, skew: 0 });

const over = (under, color) => {
  if (color.length !== 9) return color;
  const alpha = parseInt(color.slice(7), 16) / 255;
  if (under) return mix(under, color.slice(0, 7), alpha);
  return alpha >= 0.5 ? color.slice(0, 7) : null;
};

// A dense bitmap of pixels, anchored at (ax, ay): between the pet's feet.
export function bitmap(pixels, anchor = { x: 0, y: 0 }) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const solid = pixels.filter((p) => p.c?.[0] === '#');
  for (const p of solid) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!solid.length) return { w: 0, h: 0, data: [], ax: 0, ay: 0 };
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const data = new Array(w * h).fill(null);
  for (const p of solid) {
    const i = (p.y - minY) * w + (p.x - minX);
    data[i] = over(data[i], p.c) ?? data[i];
  }
  return { w, h, data, ax: anchor.x - minX, ay: anchor.y - minY };
}

// A stamp (rows of characters) as a bitmap, `scale` pixels per character, anchored at its bottom middle.
export function stampBitmap(rows, colors, scale = 1) {
  const pixels = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    const c = typeof colors === 'function' ? colors(ch) : colors[ch];
    for (let i = 0; i < scale; i++) for (let j = 0; j < scale; j++) pixels.push({ x: x * scale + i, y: y * scale + j, c });
  }));
  return bitmap(pixels, { x: (rows[0].length * scale) / 2, y: rows.length * scale });
}

// The pet's pixels with its eyes open and (if it blinks) closed. `face` borrows another
// mood's expression for a moment: hungry when food comes, ecstatic when it's eaten.
export function petSprites(pet, { hd = false, face = null } = {}) {
  const look = face && pet.mood !== 'egg' ? { ...pet, mood: face } : pet;
  const comp = composePet(look, { hd });
  const { minX, minY, maxX, maxY } = comp.bbox;
  const anchor = { x: (minX + maxX + 1) / 2, y: maxY + 1 };
  const layer = (eyes) => [...comp.aura, ...comp.base, ...eyes, ...comp.gear];
  const [mx, my] = pet.species.mouth ?? [6, 11];
  return {
    scale: comp.scale,
    open: bitmap(layer(comp.eyesOpen), anchor),
    closed: comp.eyesClosed ? bitmap(layer(comp.eyesClosed), anchor) : null,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    mouth: { x: (mx + 2) * comp.scale - anchor.x, y: (my + 1) * comp.scale - anchor.y },
  };
}

// Draws a bitmap with its anchor at (x, y), moved, turned, stretched and slanted by `pose`
// around its feet or its middle. Each pixel of the result looks up the pixel it came from,
// so a stretched or turned pet has no holes.
export function drawBitmap(canvas, bmp, x, y, pose = REST, { pivot = 'feet', recolor = null } = {}) {
  const { w, h, data, ax, ay } = bmp;
  if (!w) return;
  const p = { ...REST, ...pose };
  const paint = recolor ?? ((c) => c);
  if (!p.rot && p.sx === 1 && p.sy === 1 && !p.skew) {
    const ox = Math.round(x + p.dx - ax);
    const oy = Math.round(y + p.dy - ay);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const c = data[j * w + i];
        if (c) canvas.set(ox + i, oy + j, paint(c));
      }
    }
    return;
  }
  const py = pivot === 'center' ? -h / 2 : 0;
  const rad = (p.rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const k = Math.tan((p.skew * Math.PI) / 180);
  const sx = Math.abs(p.sx) < 0.05 ? Math.sign(p.sx || 1) * 0.05 : p.sx;
  const sy = Math.abs(p.sy) < 0.05 ? 0.05 : p.sy;
  // Where a point of the bitmap (relative to the anchor) lands.
  const forward = (u, v) => {
    const kx = (u + k * (v - py)) * sx;
    const ky = (v - py) * sy;
    return [kx * cos - ky * sin + p.dx, kx * sin + ky * cos + py + p.dy];
  };
  const corners = [[-ax, -ay], [w - ax, -ay], [-ax, h - ay], [w - ax, h - ay]].map(([u, v]) => forward(u, v));
  const x0 = Math.floor(Math.min(...corners.map((c) => c[0])) + x);
  const x1 = Math.ceil(Math.max(...corners.map((c) => c[0])) + x);
  const y0 = Math.floor(Math.min(...corners.map((c) => c[1])) + y);
  const y1 = Math.ceil(Math.max(...corners.map((c) => c[1])) + y);
  for (let cy = y0; cy < y1; cy++) {
    for (let cx = x0; cx < x1; cx++) {
      const vx = cx + 0.5 - x - p.dx;
      const vy = cy + 0.5 - y - p.dy - py;
      const rx = vx * cos + vy * sin;
      const ry = -vx * sin + vy * cos;
      const v = ry / sy;
      const u = rx / sx - k * v;
      const i = Math.floor(u + ax);
      const j = Math.floor(v + py + ay);
      if (i < 0 || j < 0 || i >= w || j >= h) continue;
      const c = data[j * w + i];
      if (c) canvas.set(cx, cy, paint(c));
    }
  }
}

// --- motion ---------------------------------------------------------------------------------

const num = (s) => parseFloat(s);

function parseTransform(text) {
  const pose = { ...REST };
  for (const [, fn, args] of text.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const v = args.split(',').map((a) => num(a));
    if (fn === 'translate') [pose.dx, pose.dy] = [v[0] || 0, v[1] || 0];
    else if (fn === 'rotate') pose.rot = v[0] || 0;
    else if (fn === 'scale') [pose.sx, pose.sy] = [v[0], v[1] ?? v[0]];
    else if (fn === 'skewX') pose.skew = v[0] || 0;
  }
  return pose;
}

// CSS keyframes ("0%,80%{transform:…}84%{…}") as a sorted list of poses.
export function parseKeyframes(css) {
  const keys = [];
  for (const [, at, body] of css.matchAll(/([\d.%,\s]+)\{transform:([^}]*)\}/g)) {
    const pose = parseTransform(body);
    for (const k of at.split(',')) keys.push({ at: num(k) / 100, ...pose });
  }
  return keys.sort((a, b) => a.at - b.at);
}

const isRest = (k) => !k.dx && !k.dy && Math.abs(k.rot % 360) < 0.01 && k.sx === 1 && k.sy === 1 && !k.skew;
const ease = (t) => t * t * (3 - 2 * t);

export function sampleKeys(keys, at) {
  if (!keys.length) return { ...REST };
  if (at <= keys[0].at) return { ...keys[0] };
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (at > b.at) continue;
    const a = keys[i - 1];
    const f = b.at === a.at ? 1 : ease((at - a.at) / (b.at - a.at));
    const lerp = (key) => a[key] + (b[key] - a[key]) * f;
    return { dx: lerp('dx'), dy: lerp('dy'), rot: lerp('rot'), sx: lerp('sx'), sy: lerp('sy'), skew: lerp('skew') };
  }
  return { ...keys[keys.length - 1] };
}

// The species' signature move: the busy part of its 7-second cycle, after the long rest.
export function moveTrack(species) {
  const id = moveOf(species);
  const move = MOVES[id];
  const keys = parseKeyframes(move.frames);
  const cycle = move.duration ?? 7;
  const first = keys.findIndex((k) => !isRest(k));
  let last = keys.length - 1;
  while (last > 0 && isRest(keys[last])) last--;
  const start = keys[Math.max(0, first - 1)]?.at ?? 0;
  const end = keys[last + 1]?.at ?? 1;
  let effect = null;
  if (move.effect) {
    const shown = [...EFFECT_FRAMES[move.effect].matchAll(/([\d.%,]+)\{opacity:([\d.]+)\}/g)]
      .filter(([, , o]) => num(o) > 0).flatMap(([, at]) => at.split(',').map((a) => num(a) / 100));
    effect = { kind: move.effect, from: Math.min(...shown), to: Math.max(...shown) };
  }
  return { id, keys, start, end, cycle, seconds: (end - start) * cycle, pivot: move.pivot ?? 'feet', effect };
}

// The move's pose `u` seconds after it starts, in pixels of a sprite drawn at `scale`.
export function movePose(track, u, scale = 1) {
  const at = track.start + Math.min(Math.max(u, 0), track.seconds) / track.cycle;
  const pose = sampleKeys(track.keys, at);
  const k = scale / CARD_UNIT;
  return { ...pose, dx: pose.dx * k, dy: pose.dy * k, at };
}

const bump = (t, period, height, share = 0.4) => {
  const ph = (((t % period) + period) % period) / period;
  return ph < share ? Math.sin((ph / share) * Math.PI) * height : 0;
};

// How the pet moves while nothing happens, like the mood animations on the card.
export function idlePose(pet, t, scale = 1) {
  const s = scale;
  switch (pet.mood) {
    case 'egg': {
      const period = 4 - 2.5 * (pet.hatchProgress ?? 0);
      const ph = t % period;
      return { ...REST, rot: ph < 0.8 ? Math.sin((ph / 0.8) * Math.PI * 3) * 10 * (1 - ph / 0.8) : 0 };
    }
    case 'ecstatic':
    case 'party': {
      const period = pet.mood === 'party' ? 0.9 : 1.2;
      const ph = (t % period) / period;
      const landing = ph >= 0.4 && ph < 0.5;
      return { ...REST, dy: -Math.round(bump(t, period, 2 * s)), sx: landing ? 1.1 : 1, sy: landing ? 0.9 : 1 };
    }
    case 'hungry': {
      const ph = t % 3;
      return { ...REST, dx: ph < 0.45 ? (Math.floor(ph / 0.075) % 2 ? s : -s) / 2 : 0 };
    }
    case 'sleepy':
    case 'hibernating':
    case 'sad':
      return { ...REST, sy: 1 + 0.07 * Math.sin((t * 2 * Math.PI) / 4) };
    case 'sick':
      return { ...REST, dx: Math.floor(t / 0.175) % 2 ? s / 2 : 0 };
    case 'zombie':
      return { ...REST, skew: 9 * Math.sin((t * 2 * Math.PI) / 3.2) };
    default:
      return { ...REST, dy: -Math.round(bump(t, 2, s)) };
  }
}

// Blinks for a moment every few seconds.
export const blinking = (t, every = 4.3) => t % every > every - 0.16;

const GHOST = '#7b8094';

// Everything there is to draw of one pet: its sprites (cached per face), the pal it wears,
// its move. `draw` puts it on a canvas at time `t`, in a pose, with an optional face.
export function createActor(pet, { hd = false } = {}) {
  const sprites = new Map();
  const spritesFor = (face) => {
    const key = face ?? '';
    if (!sprites.has(key)) sprites.set(key, petSprites(pet, { hd, face }));
    return sprites.get(key);
  };
  const main = spritesFor(null);
  const scale = main.scale;
  const pal = pet.mood !== 'egg' && PALS[pet.accessories?.pal];
  const palSprite = pal ? stampBitmap(pal.rows, pal.colors, scale) : null;
  const track = pet.mood === 'egg' ? null : moveTrack(pet.species);
  const flame = stampBitmap(FLAME.rows, FLAME.colors, scale);

  return {
    pet,
    scale,
    width: main.width,
    height: main.height,
    mouth: main.mouth,
    track,
    sprites: spritesFor,
    // pose: extra movement on top of the idle one; face: another mood's expression;
    // move: seconds into the signature move (null: not moving); idle: false holds still.
    draw(canvas, x, y, t, { pose = null, face = null, move = null, idle = true, blink = true, flip = false } = {}) {
      const set = spritesFor(face);
      const base = idle ? idlePose(face ? { ...pet, mood: face } : pet, t, scale) : { ...REST };
      let moved = null;
      if (move != null && track) moved = movePose(track, move, scale);
      const p = { ...base };
      for (const m of [moved, pose]) {
        if (!m) continue;
        p.dx += m.dx ?? 0;
        p.dy += m.dy ?? 0;
        p.rot += m.rot ?? 0;
        p.sx *= m.sx ?? 1;
        p.sy *= m.sy ?? 1;
        p.skew += m.skew ?? 0;
      }
      if (flip) p.sx *= -1;
      const pivot = moved && track.pivot === 'center' ? 'center' : 'feet';
      const sprite = blink && set.closed && blinking(t) ? set.closed : set.open;

      if (moved && track.effect && moved.at >= track.effect.from && moved.at <= track.effect.to) {
        if (track.effect.kind === 'clones') {
          const gap = Math.round(main.width * 0.6);
          const ghost = (c) => mix(c, GHOST, 0.55);
          for (const side of [-1, 1]) drawBitmap(canvas, sprite, x + side * gap, y, { ...REST }, { recolor: ghost });
        } else if (track.effect.kind === 'flames') {
          const fx = Math.round(main.width * 0.22);
          const flicker = Math.floor(t / 0.08) % 2;
          for (const side of [-1, 1]) drawBitmap(canvas, flame, x + side * fx + p.dx, y + p.dy + flame.h - scale + flicker, REST);
        }
      }
      if (palSprite) {
        const px = x - main.width / 2 - palSprite.w / 2 - scale;
        const lift = pal.motion === 'hop' ? -Math.round(bump(t + 0.5, 1.6, 2 * scale)) : -Math.round(main.height / 2) + Math.round(Math.sin(t * 3) * scale);
        drawBitmap(canvas, palSprite, px, y + lift, REST);
      }
      drawBitmap(canvas, sprite, x, y, p, { pivot });
    },
  };
}
