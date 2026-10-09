import { HATS, GEAR_COLORS } from '../sprites/accessories.js';
import { EGG, EGG_CRACK } from '../sprites/egg.js';
import { BEAKS, EYES, FACE_COLORS, MOOD_FACES, MOUTHS } from '../sprites/faces.js';
import { desaturate, hueOf, mix, shiftHue } from '../util/color.js';
import { bboxOf, gridToPixels } from './pixels.js';

const SHINY_HUE = 150;

// `tint` (from the `color` input) turns the species' body to another hue; details it keeps
// for shiny pets (eyes, capes, gems) keep their colors too. A shiny pet with a chosen color
// still sparkles, but wears the color it was given.
export function resolvePalette(species, { shiny, mood, tint = null }) {
  const keep = new Set(species.shinyKeep ?? []);
  const palette = {};
  const turn = tint?.hue != null ? tint.hue - hueOf(species.palette.b) : 0;
  for (const [key, color] of Object.entries(species.palette)) {
    let c = color;
    if (tint && !keep.has(key)) c = tint.mono ? desaturate(c, 1) : shiftHue(c, turn);
    else if (shiny && !keep.has(key)) c = shiftHue(c, SHINY_HUE);
    if (mood === 'zombie') c = desaturate(mix(c, '#8fae7a', 0.45), 0.35);
    else if (mood === 'sick' && key !== 'o') c = mix(c, '#c5e17a', 0.22);
    palette[key] = c;
  }
  return palette;
}

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

function composeEgg(pet, palette) {
  const shell = { o: palette.o, b: mix(palette.b, '#ffffff', 0.72), l: '#ffffff', s: palette.b };
  const base = gridToPixels(EGG, shell);
  const cracks = EGG_CRACK.slice(0, Math.round(pet.hatchProgress * EGG_CRACK.length));
  for (const [x, y] of cracks) base.push({ x, y, c: palette.o });
  return { base, eyesOpen: [], eyesClosed: null, gear: [], aura: [], bbox: bboxOf(base) };
}

const AURA_COLORS = ['#ffd23f', '#fff3a6'];

// The super-form aura: two glowing rings that hug the pet's silhouette.
function auraPixels(body) {
  const filled = new Set(body.map((p) => `${p.x},${p.y}`));
  const rings = [];
  let edge = filled;
  for (const color of AURA_COLORS) {
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
  return rings;
}

// Layers the species body, its expression and accessories into pixel lists.
export function composePet(pet) {
  const { species } = pet;
  const palette = resolvePalette(species, pet);
  if (pet.mood === 'egg') return composeEgg(pet, palette);

  const face = MOOD_FACES[pet.mood] ?? MOOD_FACES.happy;
  const colorOf = (ch) => {
    if (ch === 'o' || ch === 'a' || ch === 'A') return palette[ch];
    return FACE_COLORS[ch] ?? palette[ch];
  };

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

  const aura = pet.aura ? auraPixels([...body, ...gear]) : [];
  return { base: [...body, ...cheeks, ...mouth, ...glasses], eyesOpen, eyesClosed, gear, aura, bbox: bboxOf(body) };
}
