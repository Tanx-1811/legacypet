import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildPet, COLOR_IDS, mockSnapshot, parseColor, randomName, renderBadge, renderCard, renderMini, SPECIES, SPECIES_IDS, workflowYaml,
} from '../src/index.js';
import { cleanMotto, fillMotto, MOTTO_MAX } from '../src/engine/look.js';
import { workflowOptions } from '../src/local/adopt.js';
import { resolvePalette } from '../src/render/compose.js';
import { hueOf } from '../src/util/color.js';

const NOW = new Date('2026-10-08T12:00:00Z');
const pet = (options = {}, mood = 'happy', fullName = 'me/app') => buildPet({
  snapshot: mockSnapshot({ mood, now: NOW, fullName }), now: NOW, options: { holiday: null, ...options },
});

test('parseColor knows the named colors, hex colors and "auto"', () => {
  assert.equal(parseColor(), null);
  assert.equal(parseColor('auto'), null);
  assert.equal(parseColor(' '), null);
  assert.deepEqual(parseColor('Teal'), { id: 'teal', hue: 170 });
  assert.deepEqual(parseColor('mono'), { id: 'mono', mono: true });
  assert.deepEqual(parseColor('3366ff'), { id: '#3366ff', hue: 225 });
  assert.throws(() => parseColor('blurple'), /Unknown color "blurple"/);
  assert.throws(() => parseColor('#12345'), /Unknown color/);
});

test('a color repaints the body and keeps the species\' details', () => {
  for (const id of SPECIES_IDS) {
    const species = SPECIES[id];
    const plain = resolvePalette(species, { mood: 'happy' });
    const blue = resolvePalette(species, { mood: 'happy', tint: parseColor('blue') });
    assert.ok(Math.abs(hueOf(blue.b) - 222) <= 2, `${id}: body turns blue (${blue.b})`);
    for (const key of species.shinyKeep ?? []) assert.equal(blue[key], plain[key], `${id}: ${key} keeps its color`);
  }
  const silver = resolvePalette(SPECIES.duck, { mood: 'happy', tint: parseColor('mono') });
  assert.equal(silver.b, '#9e9e9e');
});

test('the chosen color reaches every picture, and a sick pet still looks sick', () => {
  const plain = pet({ species: 'cat' });
  const teal = pet({ species: 'cat', color: 'teal' });
  assert.equal(plain.tint, null);
  assert.deepEqual(teal.tint, { id: 'teal', hue: 170 });
  const tealBody = resolvePalette(teal.species, teal).b;
  for (const render of [renderCard, renderMini, renderBadge]) {
    assert.ok(render(teal).includes(tealBody), `${render.name} uses the new color`);
    assert.ok(!render(plain).includes(tealBody));
  }
  const sick = pet({ species: 'cat', color: 'teal' }, 'sick');
  assert.notEqual(resolvePalette(sick.species, sick).b, tealBody, 'the fever tint still shows');
  assert.throws(() => pet({ color: 'nope' }), /Unknown color/);
});

test('a catchphrase is cleaned up, filled in and said on some good days only', () => {
  assert.equal(cleanMotto('  Ship\n it  '), 'Ship it');
  assert.equal(cleanMotto(''), null);
  assert.equal([...cleanMotto('🐾'.repeat(80))].length, MOTTO_MAX);
  assert.equal(fillMotto('{name} is Lv.{level} ({nope})', { name: 'Mochi', level: 7 }), 'Mochi is Lv.7 ({nope})');

  const motto = 'Ship it, {name}!';
  let said = 0;
  for (let i = 0; i < 60; i++) {
    const p = pet({ motto }, 'happy', `me/repo-${i}`);
    assert.equal(p.motto, motto);
    if (p.speech === `Ship it, ${p.name}!`) said += 1;
  }
  assert.ok(said >= 8 && said <= 40, `said on ${said} of 60 good days`);
  for (let i = 0; i < 20; i++) {
    const p = pet({ motto: 'Ship it!', mood: 'sick' }, 'sick', `me/repo-${i}`);
    assert.equal(p.mood, 'sick');
    assert.notEqual(p.speech, 'Ship it!', 'a sick pet has other things to say');
  }
});

test('color, catchphrase and card theme travel through the workflow file', () => {
  const yaml = workflowYaml({ color: 'teal', motto: 'Ship it, "{name}"!', theme: 'dark', name: 'Mochi' });
  assert.match(yaml, /color: "teal"/);
  assert.match(yaml, /theme: dark/);
  assert.deepEqual(workflowOptions(yaml), { name: 'Mochi', color: 'teal', motto: 'Ship it, "{name}"!', theme: 'dark' });
  assert.doesNotMatch(workflowYaml({ color: 'auto', theme: 'auto' }), /color:|theme:/);
});

test('randomName mixes the same syllables the repo would pick from', () => {
  assert.equal(randomName(() => 0), 'Mochi');
  assert.match(randomName(), /^[A-Z][a-z]+$/);
  assert.ok(COLOR_IDS.includes('mono'));
});
