import { GEAR_COLORS, GEAR_HD, HATS } from '../sprites/accessories.js';
import { EGG, EGG_CRACK } from '../sprites/egg.js';
import { BEAKS, CHEEKS_HD, EYES, EYES_HD, FACE_COLORS, MOOD_FACES, MOUTHS, MOUTHS_HD } from '../sprites/faces.js';
import { desaturate, fromHue, hslOf, hueOf, mix, mixOklab, shiftHue } from '../util/color.js';
import { bboxOf, gridToPixels } from './pixels.js';
import { hdPixels } from './shading.js';

const SHINY_HUE = 150;

// `tint` (from the `color` input) turns the species' body to another hue; details it keeps
// for shiny pets (eyes, capes, gems) keep their colors too. A shiny pet with a chosen color
// still sparkles, but wears the color it was given.
export function resolvePalette(species, { shiny, mood, tint = null }) {
  const keep = new Set(species.shinyKeep ?? []);
  const palette = {};
  const turn = tint?.hue != null ? tint.hue - hueOf(species.palette.b) : 0;
  // A white or grey coat (a bunny, a panda, a golem) has almost no color to turn, so its lighter
  // parts take on a soft wash of the chosen color; dark outlines stay as they are.
  const body = hslOf(species.palette.b);
  const wash = tint?.hue != null && (body.l > 0.85 || body.s < 0.15) ? fromHue(tint.hue, 0.7, 0.62) : null;
  for (const [key, color] of Object.entries(species.palette)) {
    let c = color;
    if (tint && !keep.has(key)) {
      c = tint.mono ? desaturate(c, 1) : shiftHue(c, turn);
      if (wash && hslOf(c).l > 0.4) c = mix(c, wash, 0.42);
    } else if (shiny && !keep.has(key)) c = shiftHue(c, SHINY_HUE);
    if (mood === 'zombie') c = desaturate(mix(c, '#8fae7a', 0.45), 0.35);
    else if (mood === 'sick' && key !== 'o') c = mix(c, '#c5e17a', 0.22);
    palette[key] = c;
  }
  return palette;
}

// --- the original pixels: the badge and the terminal ---------------------------------------

function placeEye(pattern, [x, y], index, colorOf) {
  const p = pattern.perEye ? pattern.perEye[index] : pattern;
  const width = p.rows[0].length;
  const ox = index === 0 ? x : x - (width - 2);
  return gridToPixels(p.rows, colorOf, ox, y + (p.dy ?? 0), index === 1 && Boolean(p.mirror));
}

function ring(x, y, color) {
  return [
    [x, y - 1], [x + 1, y - 1], [x, y + 2], [x + 1, y + 2],
    [x - 1, y], [x - 1, y + 1], [x + 2, y], [x + 2, y + 1],
  ].map(([px, py]) => ({ x: px, y: py, c: color }));
}

function faceGear(kind, eyes) {
  if (kind === 'monocle') {
    const [x, y] = eyes[1];
    return [...ring(x, y, GEAR_COLORS.monocle), { x: x + 2, y: y + 3, c: GEAR_COLORS.monocle }, { x: x + 2, y: y + 4, c: GEAR_COLORS.monocle }];
  }
  if (kind === 'glasses') {
    const [[lx, ly], [rx]] = eyes;
    const bridge = [];
    for (let x = lx + 3; x <= rx - 2; x++) bridge.push({ x, y: ly, c: GEAR_COLORS.glasses });
    return [...ring(lx, ly, GEAR_COLORS.glasses), ...ring(rx, ly, GEAR_COLORS.glasses), ...bridge];
  }
  return [];
}

// Vacation shades: dark lenses over both eyes with a glint, joined by a bridge.
function sunglasses(eyes) {
  const [[lx, ly], [rx]] = eyes;
  const out = [];
  for (const x0 of [lx, rx]) {
    for (let dx = -1; dx <= 2; dx++) for (let dy = 0; dy <= 1; dy++) out.push({ x: x0 + dx, y: ly + dy, c: GEAR_COLORS.shades });
    out.push({ x: x0, y: ly, c: GEAR_COLORS.glint });
  }
  for (let x = lx + 3; x <= rx - 2; x++) out.push({ x, y: ly, c: GEAR_COLORS.shades });
  return out;
}

function hatPixels(kind, [cx, top]) {
  const hat = HATS[kind];
  if (!hat) return [];
  const width = hat.rows[0].length;
  return gridToPixels(hat.rows, hat.colors, cx - width / 2, top - hat.rows.length + 1 + (hat.dy ?? 0));
}

function eggShell(palette) {
  return { o: palette.o, b: mix(palette.b, '#ffffff', 0.72), l: '#ffffff', s: palette.b };
}

function composeEgg(pet, palette) {
  const base = gridToPixels(EGG, eggShell(palette));
  const cracks = EGG_CRACK.slice(0, Math.round(pet.hatchProgress * EGG_CRACK.length));
  for (const [x, y] of cracks) base.push({ x, y, c: palette.o });
  return { base, eyesOpen: [], eyesClosed: null, gear: [], aura: [], bbox: bboxOf(base), scale: 1 };
}

const AURA_COLORS = ['#ffd23f', '#fff3a6'];

// The super-form aura: two glowing rings that hug the pet's silhouette, `width` pixels each.
function auraPixels(body, width) {
  const filled = new Set(body.map((p) => `${p.x},${p.y}`));
  const rings = [];
  let edge = filled;
  for (const color of AURA_COLORS) {
    for (let step = 0; step < width; step++) {
      const next = new Set();
      for (const key of edge) {
        const [x, y] = key.split(',').map(Number);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = `${x + dx},${y + dy}`;
          if (!filled.has(k)) next.add(k);
        }
      }
      for (const k of next) filled.add(k);
      rings.push(...[...next].map((k) => { const [x, y] = k.split(',').map(Number); return { x, y, c: color }; }));
      edge = next;
    }
  }
  return rings;
}

function composeSmall(pet, palette, face, colorOf) {
  const { species } = pet;
  const body = gridToPixels(species.grid, palette);
  const cheeks = face.cheeks
    ? species.cheeks.flatMap(([x, y]) => [{ x, y, c: FACE_COLORS[face.cheeks] }, { x: x + 1, y, c: FACE_COLORS[face.cheeks] }])
    : [];
  const mouthRows = species.mouthStyle === 'beak' ? BEAKS[face.mouth] : MOUTHS[face.mouth];
  const mouth = gridToPixels(mouthRows, colorOf, species.mouth[0], species.mouth[1]);
  const eyesOpen = species.eyes.flatMap((anchor, i) => placeEye(EYES[face.eyes], anchor, i, colorOf));
  const eyesClosed = face.blink ? species.eyes.flatMap((anchor, i) => placeEye(EYES.closed, anchor, i, colorOf)) : null;
  // Glasses go under the eyes (eyes must stay readable), hats on top of everything.
  const glasses = faceGear(pet.accessories?.face, species.eyes);
  const gear = pet.accessories?.hat ? hatPixels(pet.accessories.hat, species.hat) : [];
  // Shades sit on top of the eyes: that's the point of them.
  if (pet.accessories?.face === 'sunglasses') gear.unshift(...sunglasses(species.eyes));

  const aura = pet.aura ? auraPixels([...body, ...gear], 1) : [];
  return { base: [...body, ...cheeks, ...mouth, ...glasses], eyesOpen, eyesClosed, gear, aura, bbox: bboxOf(body), scale: 1 };
}

// --- HD: twice the resolution, smoothed and lit (shading.js) -------------------------------

function placeEyeHd(pattern, [x, y], index, colorOf) {
  const p = pattern.perEye ? pattern.perEye[index] : pattern;
  const width = p.rows[0].length;
  const ox = index === 0 ? 2 * x + (p.dx ?? 0) : 2 * x + 4 - width - (p.dx ?? 0);
  return gridToPixels(p.rows, colorOf, ox, 2 * y + (p.dy ?? 0), index === 1 && Boolean(p.mirror));
}

function faceGearHd(kind, eyes) {
  const lens = (x, y, color) => gridToPixels(GEAR_HD.ring, { o: color }, 2 * x - 2, 2 * y - 2);
  if (kind === 'monocle') {
    const [x, y] = eyes[1];
    return [...lens(x, y, GEAR_COLORS.monocle), ...gridToPixels(GEAR_HD.chain, { o: GEAR_COLORS.monocle }, 2 * x + 4, 2 * y + 6)];
  }
  if (kind === 'glasses') {
    const [[lx, ly], [rx]] = eyes;
    const bridge = [];
    for (let x = 2 * lx + 6; x <= 2 * rx - 3; x++) bridge.push({ x, y: 2 * ly + 1, c: GEAR_COLORS.glasses });
    return [...lens(lx, ly, GEAR_COLORS.glasses), ...lens(rx, ly, GEAR_COLORS.glasses), ...bridge];
  }
  return [];
}

function sunglassesHd(eyes) {
  const [[lx, ly], [rx]] = eyes;
  const colors = { s: GEAR_COLORS.shades, g: GEAR_COLORS.glint };
  const out = [...gridToPixels(GEAR_HD.lens, colors, 2 * lx - 2, 2 * ly), ...gridToPixels(GEAR_HD.lens, colors, 2 * rx - 2, 2 * ly)];
  for (let x = 2 * lx + 6; x <= 2 * rx - 3; x++) out.push({ x, y: 2 * ly + 1, c: GEAR_COLORS.shades });
  return out;
}

// Hats are smoothed and lit like the pet, so they look like they belong on it.
function hatPixelsHd(kind, [cx, top]) {
  const hat = HATS[kind];
  if (!hat) return [];
  const width = hat.rows[0].length;
  const oy = top - hat.rows.length + 1 + (hat.dy ?? 0);
  return hdPixels(hat.rows, (k) => hat.colors[k], { ink: hat.colors.o ? 'o' : null, ox: 2 * cx - width, oy: 2 * oy });
}

// The egg's crack: a fine zigzag through the crack points, longer with every commit.
function composeEggHd(pet, palette) {
  const shell = eggShell(palette);
  const usual = eggShell(pet.species.palette);
  const base = hdPixels(EGG, (k) => shell[k], { rankBy: (k) => usual[k] });
  const points = EGG_CRACK.slice(0, Math.round(pet.hatchProgress * EGG_CRACK.length)).map(([x, y]) => [2 * x, 2 * y]);
  points.forEach(([x, y], i) => {
    base.push({ x, y, c: palette.o });
    const next = points[i + 1];
    if (!next) return;
    const steps = Math.max(Math.abs(next[0] - x), Math.abs(next[1] - y));
    for (let s = 1; s < steps; s++) {
      base.push({ x: x + Math.round(((next[0] - x) * s) / steps), y: y + Math.round(((next[1] - y) * s) / steps), c: palette.o });
    }
  });
  return { base, eyesOpen: [], eyesClosed: null, gear: [], aura: [], bbox: bboxOf(base), scale: 2 };
}

function composeHd(pet, palette, face, colorOf) {
  const { species } = pet;
  const ink = palette.o;
  const faceColor = (ch) => {
    if (ch === 'i') return mixOklab(ink, '#ffffff', 0.28);
    if (ch === 'm') return mixOklab(ink, '#c0304a', 0.55);
    return colorOf(ch);
  };
  // The shape is decided by the species' usual colors, so it never changes with mood or tint.
  const usual = (k) => species.palette[k] ?? FACE_COLORS[k];
  const body = hdPixels(species.grid, (k) => palette[k], { rankBy: usual });
  const [mx, my] = species.mouth;
  const cheeks = face.cheeks ? species.cheeks.flatMap(([x, y]) => gridToPixels(CHEEKS_HD[face.cheeks], FACE_COLORS, 2 * x, 2 * y)) : [];
  let mouth;
  if (species.mouthStyle === 'beak') {
    mouth = hdPixels(BEAKS[face.mouth], faceColor, { ink: null, light: false, ox: 2 * mx, oy: 2 * my, rankBy: usual });
  } else {
    const m = MOUTHS_HD[face.mouth];
    mouth = gridToPixels(m.rows, faceColor, 2 * mx + (m.dx ?? 0), 2 * my + (m.dy ?? 0));
  }
  const eyesOpen = species.eyes.flatMap((anchor, i) => placeEyeHd(EYES_HD[face.eyes], anchor, i, faceColor));
  const eyesClosed = face.blink ? species.eyes.flatMap((anchor, i) => placeEyeHd(EYES_HD.closed, anchor, i, faceColor)) : null;
  const glasses = faceGearHd(pet.accessories?.face, species.eyes);
  const gear = pet.accessories?.hat ? hatPixelsHd(pet.accessories.hat, species.hat) : [];
  if (pet.accessories?.face === 'sunglasses') gear.unshift(...sunglassesHd(species.eyes));

  const aura = pet.aura ? auraPixels([...body, ...gear], 2) : [];
  return { base: [...body, ...cheeks, ...mouth, ...glasses], eyesOpen, eyesClosed, gear, aura, bbox: bboxOf(body), scale: 2 };
}

// Layers the species body, its expression and accessories into pixel lists.
// Pets are drawn in HD by default: twice the resolution of their 16×16 grid, smoothed, lit and
// with finer faces. `{ hd: false }` keeps the original pixels, for the 16px badge and the terminal.
// `scale` says how many of the returned pixels make one cell of the species' grid.
export function composePet(pet, { hd = true } = {}) {
  const { species } = pet;
  const palette = resolvePalette(species, pet);
  if (pet.mood === 'egg') return hd ? composeEggHd(pet, palette) : composeEgg(pet, palette);

  const face = MOOD_FACES[pet.mood] ?? MOOD_FACES.happy;
  const colorOf = (ch) => {
    if (ch === 'o' || ch === 'a' || ch === 'A') return palette[ch];
    return FACE_COLORS[ch] ?? palette[ch];
  };
  return hd ? composeHd(pet, palette, face, colorOf) : composeSmall(pet, palette, face, colorOf);
}
