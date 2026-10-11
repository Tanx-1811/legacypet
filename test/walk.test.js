import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MOODS } from '../src/engine/mood.js';
import { buildPet } from '../src/engine/pet.js';
import { mockSnapshot } from '../src/mock.js';
import { renderCard } from '../src/render/card.js';
import { renderMini } from '../src/render/mini.js';
import { renderPark } from '../src/render/park.js';
import { WALK_MOODS, walkCss, walkPlan } from '../src/render/walk.js';
import { SPECIES_IDS } from '../src/sprites/index.js';

const NOW = new Date('2026-10-08T09:00:00Z');
const make = (mood, options = {}) => buildPet({ snapshot: mockSnapshot({ mood, now: NOW }), now: NOW, options: { mood, holiday: null, ...options } });
const strollOf = (svg) => /<style>(@keyframes (lp-w[a-z0-9]+)-x\{[^<]*)<\/style>/.exec(svg);

test('pets on a good day stroll around their home; sad, sick or sleepy ones stay put', () => {
  for (const mood of MOODS) {
    const pet = make(mood, { species: 'blob' });
    for (const svg of [renderCard(pet), renderMini(pet)]) {
      assert.equal(Boolean(strollOf(svg)), WALK_MOODS.has(mood), `${mood}: ${WALK_MOODS.has(mood) ? 'walks' : 'stays put'}`);
    }
  }
});

test('a stroll starts and ends at home, so a still picture shows the pet where it always stands', () => {
  for (const species of SPECIES_IDS) {
    const svg = renderCard(make('happy', { species }));
    const [, css, name] = strollOf(svg);
    const x = new RegExp(`@keyframes ${name}-x\\{(.*?\\})\\}`).exec(css)[1];
    const home = /([\d.%,]+)\{transform:translateX\(0\)\}/.exec(x)[1].split(',');
    assert.ok(home.includes('0%') && home.includes('100%'), `${species}: home at both ends`);
    assert.ok(svg.includes(`class="${name}-x"`) && svg.includes(`class="${name}-s"`), `${species}: both halves are drawn`);
  }
});

test('the route stays inside the frame, keeps far enough apart and checks the bowl when hungry', () => {
  for (const mood of WALK_MOODS) {
    for (let i = 0; i < 40; i++) {
      const plan = walkPlan(mood, { seed: `r${i}`, min: -30, max: 50, cell: 5, bowl: 24 });
      assert.ok(plan, `${mood}: walks`);
      const legs = plan.segments.filter((s) => s.walk);
      assert.equal(legs.at(-1).to, 0, 'comes back home');
      for (const leg of legs) {
        assert.ok(leg.to >= -30 && leg.to <= 50, `${mood}: ${leg.to} is in the frame`);
        assert.ok(Math.abs(leg.to - leg.from) >= 9, `${mood}: a leg worth walking`);
      }
      if (mood === 'hungry') assert.equal(legs[0].to, 24, 'goes to the bowl first');
      assert.ok(plan.duration > 5 && plan.duration < 60, `${mood}: ${plan.duration}s loop`);
      assert.doesNotMatch(walkCss('lp-wx', plan), /NaN|undefined|Infinity/);
    }
  }
  assert.equal(walkPlan('sad', { seed: 'x', min: -30, max: 50, cell: 5 }), null, 'a sad pet stays');
  assert.equal(walkPlan('happy', { seed: 'x', min: 0, max: 6, cell: 5 }), null, 'no room, no walk');
});

test('every pet in a park walks on its own clock, within its own patch', () => {
  const pets = ['cat', 'duck', 'crab'].map((species, i) => {
    const pet = make(['happy', 'party', 'hungry'][i], { species });
    return { ...pet, repo: { ...pet.repo, fullName: `me/r${i}`, name: `r${i}` } };
  });
  const svg = renderPark(pets, { owner: 'me' });
  const names = [...svg.matchAll(/@keyframes (lp-w[a-z0-9]+)-x\{/g)].map((m) => m[1]);
  assert.equal(names.length, 3);
  assert.equal(new Set(names).size, 3, 'no two pets share a stroll');
  // Eight pets fill the park: no room to wander, so they stay by their name signs.
  const full = renderPark(Array.from({ length: 8 }, (_, i) => ({ ...pets[0], repo: { ...pets[0].repo, fullName: `me/f${i}`, name: `f${i}` } })), { owner: 'me' });
  assert.equal(strollOf(full), null);
});
