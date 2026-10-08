import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MOODS } from '../src/engine/mood.js';
import { buildPet } from '../src/engine/pet.js';
import { mockSnapshot } from '../src/mock.js';
import { renderCard } from '../src/render/card.js';
import { renderMini } from '../src/render/mini.js';
import { renderPark } from '../src/render/park.js';
import { terminalArt } from '../src/render/terminal.js';
import { HOMES, SPECIES, SPECIES_IDS } from '../src/sprites/index.js';
import { renderFiles } from '../src/index.js';

const NOW = new Date('2026-10-08T09:00:00Z');

// A small well-formedness check: balanced tags, escaped text, no broken numbers.
function assertValidSvg(svg, label) {
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), `${label}: root`);
  const body = svg.replace(/<style>[\s\S]*?<\/style>/, '');
  const stack = [];
  for (const [, closing, name, , selfClosing] of body.matchAll(/<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g)) {
    if (closing) assert.equal(stack.pop(), name, `${label}: unbalanced </${name}>`);
    else if (!selfClosing) stack.push(name);
  }
  assert.deepEqual(stack, [], `${label}: unclosed tags`);
  assert.doesNotMatch(body, /&(?!amp;|lt;|gt;|quot;|apos;)/, `${label}: unescaped &`);
  assert.doesNotMatch(svg, /NaN|undefined|Infinity|\[object/, `${label}: broken value`);
  assert.ok(svg.length < 120_000, `${label}: ${svg.length} bytes is too big`);
}

for (const species of SPECIES_IDS) {
  test(`${species}: renders every mood as a valid card and mini`, () => {
    for (const mood of MOODS) {
      for (const lang of ['en', 'vi']) {
        const pet = buildPet({ snapshot: mockSnapshot({ mood, now: NOW }), now: NOW, options: { species, mood, lang, holiday: null } });
        assertValidSvg(renderCard(pet), `${species}/${mood}/${lang}`);
        assertValidSvg(renderMini(pet, { theme: 'dark' }), `${species}/${mood}/${lang}/mini`);
      }
    }
  });
}

test('holidays, stages and shiny variants render', () => {
  for (const holiday of ['halloween', 'christmas', 'newyear', 'tet', 'programmers']) {
    for (const stage of ['baby', 'adult', 'elder']) {
      const pet = buildPet({ snapshot: mockSnapshot({ mood: 'zombie', stage, now: NOW }), now: NOW, options: { holiday, shiny: true } });
      assertValidSvg(renderCard(pet, { theme: 'light' }), `${holiday}/${stage}`);
    }
  }
});

test('user-controlled text is escaped', () => {
  const snapshot = mockSnapshot({ mood: 'happy', now: NOW, fullName: 'evil/<script>&"repo' });
  const pet = buildPet({ snapshot, now: NOW, options: { name: '<b>&Bobby\'s "pet"', holiday: null } });
  const svg = renderCard(pet);
  assertValidSvg(svg, 'escaped');
  assert.doesNotMatch(svg, /<script>|<b>/);
});

test('the same input renders the same bytes', () => {
  const make = () => renderCard(buildPet({ snapshot: mockSnapshot({ mood: 'party', now: NOW }), now: NOW, options: { holiday: null } }));
  assert.equal(make(), make());
});

test('respects reduced motion and supports dark mode', () => {
  const svg = renderCard(buildPet({ snapshot: mockSnapshot({ mood: 'happy', now: NOW }), now: NOW, options: { holiday: null } }));
  assert.match(svg, /prefers-reduced-motion/);
  assert.match(svg, /prefers-color-scheme:dark/);
  assert.match(svg, /<title id="[^"]+">/);
});

test('renderFiles produces the branch contents', () => {
  const snapshot = mockSnapshot({ mood: 'happy', now: NOW });
  const pet = buildPet({ snapshot, now: NOW, options: { holiday: null } });
  const files = renderFiles(pet, snapshot);
  assert.deepEqual(files.map((f) => f.path).sort(), ['DIARY.md', 'README.md', 'pet-badge.svg', 'pet-mini.svg', 'pet-shields.json', 'pet.json', 'pet.svg']);
  const state = JSON.parse(files.find((f) => f.path === 'pet.json').content);
  assert.equal(state.lastMood, 'happy');
  assert.equal(state.history[0].date, '2026-10-08');
});

test('terminal art draws the pet with half blocks', () => {
  const art = terminalArt(buildPet({ snapshot: mockSnapshot({ mood: 'happy', now: NOW }), now: NOW, options: { species: 'cat', holiday: null } }));
  assert.match(art, /▀|▄/);
  assert.ok(art.split('\n').length >= 7);
});

test('every home renders in every season, mood and holiday, light and dark', () => {
  for (const scenery of HOMES) {
    for (const season of ['spring', 'summer', 'autumn', 'winter']) {
      for (const [mood, holiday] of [['ecstatic', null], ['party', 'tet'], ['zombie', 'halloween'], ['hibernating', 'christmas'], ['egg', null]]) {
        const pet = buildPet({ snapshot: mockSnapshot({ mood, now: NOW }), now: NOW, options: { species: 'blob', scenery, mood, season, holiday } });
        assertValidSvg(renderCard(pet, { theme: 'light' }), `${scenery}/${season}/${mood}`);
        assertValidSvg(renderMini(pet, { theme: 'dark' }), `${scenery}/${season}/${mood}/mini`);
      }
    }
  }
});

test('each species lives in a known home, and scenery can move it', () => {
  for (const id of SPECIES_IDS) assert.ok(HOMES.includes(SPECIES[id].home), `${id} has no home`);
  const build = (scenery) => buildPet({ snapshot: mockSnapshot({ mood: 'happy', now: NOW }), now: NOW, options: { species: 'duck', scenery, holiday: null } });
  assert.equal(build('auto').home, 'pond');
  assert.equal(build('reef').home, 'reef');
  assert.match(renderCard(build('beach')), /--lp-water:#3fa7e0/);
  assert.throws(() => build('moon'), /Unknown scenery "moon"/);
});

test('the park gets scenery too and stays a reasonable size', () => {
  const pets = SPECIES_IDS.slice(0, 8).map((species) => buildPet({ snapshot: mockSnapshot({ mood: 'party', now: NOW, fullName: `me/${species}` }), now: NOW, options: { species, holiday: 'christmas' } }));
  const svg = renderPark(pets, { owner: 'me' });
  assertValidSvg(svg, 'park');
  assert.match(svg, /lp-spin/);
});
