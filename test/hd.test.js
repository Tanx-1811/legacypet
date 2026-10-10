import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPet } from '../src/engine/pet.js';
import { parseColor } from '../src/engine/look.js';
import { mockSnapshot } from '../src/mock.js';
import { renderCard } from '../src/render/card.js';
import { composePet, resolvePalette } from '../src/render/compose.js';
import { magnify } from '../src/render/mmpx.js';
import { drawPixels } from '../src/render/pixels.js';
import { hdPixels, shadeColor } from '../src/render/shading.js';
import { CHEEKS_HD, EYES_HD, MOOD_FACES, MOUTHS_HD } from '../src/sprites/faces.js';
import { SPECIES, SPECIES_IDS } from '../src/sprites/index.js';
import { fromOklch, oklchOf } from '../src/util/color.js';

const NOW = new Date('2026-10-08T09:00:00Z');
const pet = (species, mood = 'happy', options = {}) => buildPet({
  snapshot: mockSnapshot({ mood, now: NOW, fullName: `me/${species}` }), now: NOW, options: { species, mood, holiday: null, ...options },
});
const where = (pixels) => new Set(pixels.map((p) => `${p.x},${p.y}`));

test('OKLCH round-trips sRGB colors', () => {
  for (const hex of ['#000000', '#ffffff', '#ff5d73', '#3d6bff', '#7ee081', '#808080', '#ffd93d']) {
    assert.equal(fromOklch(oklchOf(hex)), hex);
  }
});

test('MMPX doubles a sprite, keeps solid shapes and smooths a staircase', () => {
  const block = magnify(['....', '.oo.', '.oo.', '....'], () => 0);
  assert.deepEqual(block, ['........', '........', '..oooo..', '..oooo..', '..oooo..', '..oooo..', '........', '........']);
  const stairs = magnify(['o...', 'oo..', 'ooo.', 'oooo'], () => 0);
  assert.equal(stairs.length, 8);
  assert.equal(stairs[1][2], 'o', 'the step gets filled in where plain doubling would leave a notch');
});

test('a ramp keeps the color itself and steps darker below, lighter above', () => {
  const l = (c) => oklchOf(c).l;
  for (const hex of ['#f4a259', '#3a3358', '#fff6ea', '#62c46a', '#9d9aa8']) {
    assert.equal(shadeColor(hex, 0), hex);
    assert.ok(l(shadeColor(hex, -2)) < l(shadeColor(hex, -1)) && l(shadeColor(hex, -1)) < l(hex), `${hex} shadows`);
    assert.ok(l(shadeColor(hex, 2)) >= l(shadeColor(hex, 1)) && l(shadeColor(hex, 1)) >= l(hex), `${hex} highlights`);
    assert.match(shadeColor(hex, -2), /^#[0-9a-f]{6}$/);
  }
});

test('shadows lean toward purple the way painters do it', () => {
  // A yellow's shadow goes toward orange (its hue drops), never toward a sickly green;
  // a green's goes toward teal and blue (its hue climbs).
  assert.ok(oklchOf(shadeColor('#ffd93d', -2)).h < oklchOf('#ffd93d').h);
  assert.ok(oklchOf(shadeColor('#fff1b8', -2)).h < oklchOf('#fff1b8').h);
  assert.ok(oklchOf(shadeColor('#62c46a', -2)).h > oklchOf('#62c46a').h);
});

test('every species keeps exactly the same HD shape in every mood and color', () => {
  for (const id of SPECIES_IDS) {
    const species = SPECIES[id];
    const shape = (look) => where(hdPixels(species.grid, (k) => resolvePalette(species, look)[k], { rankBy: (k) => species.palette[k] }));
    const happy = [...shape({ mood: 'happy' })].join(' ');
    for (const look of [{ mood: 'zombie' }, { mood: 'sick' }, { mood: 'happy', shiny: true }, { mood: 'happy', tint: parseColor('teal') }, { mood: 'happy', tint: parseColor('mono') }]) {
      assert.equal([...shape(look)].join(' '), happy, `${id} in ${JSON.stringify(look)}`);
    }
  }
});

test('HD pets fill the doubled grid, and their eyes and mouth sit on the body', () => {
  for (const id of SPECIES_IDS) {
    const comp = composePet(pet(id));
    assert.equal(comp.scale, 2);
    const { minX, minY, maxX, maxY } = comp.bbox;
    assert.ok(minX >= 0 && minY >= 0 && maxX <= 31 && maxY <= 31, `${id}: body inside 32×32`);
    const species = SPECIES[id];
    const body = where(hdPixels(species.grid, (k) => species.palette[k]));
    for (const mood of ['happy', 'ecstatic', 'party', 'sad', 'sick', 'hungry', 'sleepy', 'zombie']) {
      const face = composePet(pet(id, mood));
      for (const p of face.eyesOpen) assert.ok(body.has(`${p.x},${p.y}`), `${id}/${mood}: eye pixel ${p.x},${p.y} is off the body`);
      const mouth = face.base.filter((p) => !body.has(`${p.x},${p.y}`));
      assert.deepEqual(mouth, [], `${id}/${mood}: face pixels off the body`);
    }
  }
});

test('HD faces exist for every mood and are rectangular stamps', () => {
  const check = (name, rows) => rows.forEach((row) => assert.equal(row.length, rows[0].length, name));
  for (const [mood, face] of Object.entries(MOOD_FACES)) {
    assert.ok(EYES_HD[face.eyes], `${mood} eyes`);
    assert.ok(MOUTHS_HD[face.mouth], `${mood} mouth`);
    if (face.cheeks) assert.ok(CHEEKS_HD[face.cheeks], `${mood} cheeks`);
  }
  for (const [name, eye] of Object.entries(EYES_HD)) for (const p of eye.perEye ?? [eye]) check(name, p.rows);
  for (const [name, m] of Object.entries(MOUTHS_HD)) {
    check(name, m.rows);
    assert.ok((m.dx ?? 0) + m.rows[0].length <= 8, `${name} fits the mouth's 8 columns`);
  }
});

test('the badge and the terminal keep the original pixels', () => {
  const small = composePet(pet('cat'), { hd: false });
  assert.equal(small.scale, 1);
  assert.ok(small.bbox.maxX <= 15 && small.bbox.maxY <= 15);
});

test('a still picture holds its animations on the first frame', () => {
  const p = pet('cat');
  const PAUSED = '}*{animation-play-state:paused!important}</style>';
  assert.ok(renderCard(p, { still: true }).includes(PAUSED));
  assert.ok(!renderCard(p).includes(PAUSED));
});

test('drawPixels merges runs into rectangles, one path per color, and blends see-through pixels', () => {
  const red = '#ff0000';
  const svg = drawPixels([{ x: 0, y: 0, c: red }, { x: 1, y: 0, c: red }, { x: 0, y: 1, c: red }, { x: 1, y: 1, c: red }, { x: 2, y: 0, c: '#0000ff' }], 2, 10, 20);
  assert.equal(svg, '<g transform="translate(10 20) scale(2)"><path fill="#ff0000" d="M0 0h2v2h-2z"/><path fill="#0000ff" d="M2 0h1v1h-1z"/></g>');
  assert.match(drawPixels([{ x: 0, y: 0, c: '#ffffff' }, { x: 0, y: 0, c: '#00000080' }], 1), /fill="#7f7f7f"/);
  assert.equal(drawPixels([], 3), '');
});
