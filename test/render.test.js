import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MOODS } from '../src/engine/mood.js';
import { buildPet } from '../src/engine/pet.js';
import { mockSnapshot } from '../src/mock.js';
import { renderCard } from '../src/render/card.js';
import { renderMini } from '../src/render/mini.js';
import { terminalArt } from '../src/render/terminal.js';
import { SPECIES_IDS } from '../src/sprites/index.js';
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
