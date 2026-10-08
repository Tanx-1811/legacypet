import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCare, careBonus, DAILY_CAP } from '../src/engine/care.js';
import { EVOLVE_AFTER_DAYS, PATH_IDS, choosePath } from '../src/engine/evolution.js';
import { ITEMS, parseWear, resolveWear, unlockedItems, wearCommand } from '../src/engine/items.js';
import { nextState } from '../src/engine/memory.js';
import { buildPet } from '../src/engine/pet.js';
import { evaluateQuests, QUESTS, weekOf } from '../src/engine/quests.js';
import { commandArg, commandDays, commandFromEvent, commandReply, parseCommand } from '../src/github/command.js';
import { LANGS } from '../src/i18n/index.js';
import { mockSnapshot } from '../src/mock.js';
import { renderCard } from '../src/render/card.js';
import { renderMini } from '../src/render/mini.js';
import { EMBLEMS, HATS, PALS } from '../src/sprites/accessories.js';
import { SPECIES_IDS } from '../src/sprites/index.js';

const DAY = 86_400_000;
const MONDAY = new Date('2026-10-05T09:00:00Z');

// Runs the real engine day by day, carrying pet.json over like the action does.
function live(days, { mood = 'ecstatic', options = () => ({}), start = MONDAY, fullName = 'me/game' } = {}) {
  let state = null;
  const pets = [];
  for (let d = 0; d < days; d++) {
    const now = new Date(start.getTime() + d * DAY);
    const snapshot = mockSnapshot({ mood, now, fullName });
    const pet = buildPet({ snapshot, prevState: state, now, options: { holiday: null, species: 'cat', ...options(d) } });
    state = nextState(pet, state);
    pets.push({ pet, snapshot, state });
  }
  return pets;
}

test('weeks start on Monday (UTC)', () => {
  assert.equal(weekOf(new Date('2026-10-05T00:00:00Z')).id, '2026-10-05');
  assert.equal(weekOf(new Date('2026-10-11T23:59:00Z')).id, '2026-10-05');
  assert.equal(weekOf(new Date('2026-10-12T00:00:00Z')).id, '2026-10-12');
});

test('quests: three a week, stable all week, sticky once done, stars only once', () => {
  const days = live(14);
  const week1 = days.slice(0, 7).map((d) => d.pet.quests);
  assert.equal(week1[0].list.length, 3);
  for (const q of week1) assert.deepEqual(q.ids, week1[0].ids, 'the same three quests all week');
  for (let i = 1; i < 7; i++) {
    for (const id of Object.keys(week1[i - 1].done)) assert.ok(week1[i].done[id], `${id} stays done`);
  }
  const stars = days.map((d) => d.pet.questStars);
  for (let i = 1; i < stars.length; i++) assert.ok(stars[i] >= stars[i - 1], 'stars never go down');
  const doneWeek1 = Object.keys(week1[6].done).length;
  const perfect1 = week1[6].perfect ? 2 : 0;
  assert.equal(days[6].pet.questStars, doneWeek1 + perfect1);
  assert.equal(days[7].pet.quests.week, '2026-10-12', 'a new week brings new quests');
  assert.ok(days.some((d) => d.pet.events.includes('questDone')));
});

test('quests are only picked when the repo can do them', () => {
  const now = MONDAY;
  const snapshot = mockSnapshot({ mood: 'egg', now, fullName: 'me/new' }); // no CI, no issues, no release
  for (let i = 0; i < 40; i++) {
    const q = evaluateQuests({ snapshot, today: { date: '2026-10-05', mood: 'egg', vitals: [] }, fullName: `me/new${i}`, now });
    for (const id of q.ids) assert.ok(['feast', 'marathon', 'sunny'].includes(id), id);
  }
  assert.equal(new Set(QUESTS.map((q) => q.id)).size, QUESTS.length);
});

test('finished quests add joy from the next run until Monday', () => {
  const days = live(10, { mood: 'happy' });
  const i = days.findIndex((d) => d.pet.quests.fresh.length);
  assert.ok(i >= 0 && i < 6, 'a quest gets done in the first week');
  const plain = buildPet({ snapshot: days[i + 1].snapshot, now: new Date(MONDAY.getTime() + (i + 1) * DAY), options: { holiday: null, species: 'cat' } });
  assert.ok(days[i + 1].pet.vitals.joy >= plain.vitals.joy);
});

test('evolution: after a week as an adult, a permanent path with an event, a trophy and a boost', () => {
  const days = live(EVOLVE_AFTER_DAYS + 3);
  assert.equal(days[EVOLVE_AFTER_DAYS - 1].pet.path, null, 'no path in the first week');
  const at = days.findIndex((d) => d.pet.path);
  assert.equal(at, EVOLVE_AFTER_DAYS);
  assert.ok(days[at].pet.events.includes('evolved'));
  assert.ok(days[at].pet.achievements.some((a) => a.id === 'evolved'));
  assert.ok(!days[at + 1].pet.events.includes('evolved'), 'evolving happens once');
  assert.equal(days[at + 2].pet.path.id, days[at].pet.path.id, 'the path is permanent');
  assert.match(renderCard(days[at].pet), new RegExp(days[at].pet.path.emoji));
});

test('evolution paths follow the repo', () => {
  const now = MONDAY;
  const base = mockSnapshot({ mood: 'happy', now, fullName: 'me/a' });
  const facts = { commits30: 0, streak: 0, activeAuthors30: 1 };
  assert.equal(choosePath({ snapshot: { ...base, community: null, release: null, treats: [] }, facts: { ...facts, commits30: 40, streak: 12 } }), 'swift');
  assert.equal(choosePath({ snapshot: { ...base, community: null, release: null, treats: [] }, facts, history: [{ vitals: [0, 100] }] }), 'guardian');
  const social = { ...base, ci: { state: 'unknown' }, community: null, release: null, treats: [1, 2, 3, 4] };
  assert.equal(choosePath({ snapshot: social, facts: { ...facts, activeAuthors30: 5 } }), 'social');
  assert.equal(choosePath({ snapshot: { ...base, ci: { state: 'unknown' }, treats: [], community: { health: 100 } }, facts }), 'sage');
  for (const id of PATH_IDS) assert.ok(EMBLEMS[id], `${id} has an emblem`);
});

test('items: unlocks, one per slot, locked and unknown items are refused', () => {
  const none = { achievements: {}, stars: 0, friends: 0 };
  assert.deepEqual(unlockedItems(none), ['cap']);
  assert.ok(unlockedItems({ achievements: { lazarus: 'x' }, stars: 25, friends: 5 }).includes('drone'));
  assert.deepEqual(parseWear('Cap, bird'), ['cap', 'bird']);
  assert.deepEqual(parseWear('none'), []);
  assert.equal(parseWear(undefined), null);
  const r = resolveWear(['cap', 'crown', 'nope', 'bird'], { achievements: {}, stars: 1, friends: 0 });
  assert.deepEqual(r.worn, ['cap', 'bird']);
  assert.deepEqual(r.rejected, [['crown', 'locked'], ['nope', 'unknown']]);
  assert.deepEqual(resolveWear(['cap', 'bow'], none, { all: true }).worn, ['bow'], 'later items replace their slot');
  assert.deepEqual(wearCommand(['cap'], 'bird'), ['cap', 'bird']);
  assert.deepEqual(wearCommand(['cap', 'bird'], 'none'), []);
  for (const item of ITEMS) {
    if (item.slot === 'hat') assert.ok(HATS[item.id], `${item.id} has a sprite`);
    if (item.slot === 'pal') assert.ok(PALS[item.id], `${item.id} has a sprite`);
    for (const code of Object.keys(LANGS)) assert.equal(typeof LANGS[code].items[item.id], 'string', `${code}: ${item.id}`);
  }
});

test('worn items show up, but situational hats and eggs win', () => {
  const now = MONDAY;
  const dress = (mood, wear) => buildPet({ snapshot: mockSnapshot({ mood, now, fullName: 'me/w' }), now, options: { holiday: null, species: 'cat', wear, unlockAll: true } });
  const happy = dress('happy', 'wizard, shades, ghost');
  assert.deepEqual(happy.accessories, { hat: 'wizard', face: 'sunglasses', pal: 'ghost' });
  assert.equal(dress('sick', 'wizard').accessories.hat, 'icepack');
  assert.equal(dress('party', 'wizard').accessories.hat, 'party');
  assert.equal(dress('egg', 'wizard, ghost').accessories.pal, null);
  for (const species of SPECIES_IDS) {
    for (const pal of Object.keys(PALS)) {
      const pet = buildPet({ snapshot: mockSnapshot({ mood: 'happy', now, fullName: `me/${species}` }), now, options: { holiday: null, species, wear: `headphones, ${pal}`, unlockAll: true, path: 'sage' } });
      for (const svg of [renderCard(pet), renderMini(pet)]) assert.doesNotMatch(svg, /NaN|undefined/);
    }
  }
});

test('the wardrobe remembers /pet wear between runs; the input wins when set', () => {
  const days = live(3, { options: (d) => (d === 0 ? { wearCommand: 'cap' } : d === 2 ? { wear: 'none' } : {}) });
  assert.deepEqual(days[0].pet.wardrobe.worn, ['cap']);
  assert.deepEqual(days[1].pet.wardrobe.worn, ['cap'], 'remembered');
  assert.deepEqual(days[2].pet.wardrobe.worn, []);
});

test('care: once a day per person and action, capped, nothing for eggs and zombies', () => {
  let { care, outcome } = applyCare({ action: { name: 'feed', user: 'a' }, date: '2026-10-05', mood: 'happy' });
  assert.equal(outcome, 'ok');
  ({ care, outcome } = applyCare({ prev: care, action: { name: 'feed', user: 'a' }, date: '2026-10-05', mood: 'happy' }));
  assert.equal(outcome, 'again');
  for (const user of ['b', 'c', 'd', 'e']) ({ care } = applyCare({ prev: care, action: { name: 'feed', user }, date: '2026-10-05', mood: 'happy' }));
  assert.equal(careBonus(care, '2026-10-05').fullness, DAILY_CAP);
  assert.equal(careBonus(care, '2026-10-06').fullness, 0, 'snacks only count on their day');
  assert.equal(care.total, 5);
  assert.equal(applyCare({ prev: care, action: { name: 'feed', user: 'a' }, date: '2026-10-06', mood: 'happy' }).outcome, 'ok', 'a new day');
  assert.equal(applyCare({ action: { name: 'play', user: 'a' }, date: '2026-10-05', mood: 'zombie' }).outcome, 'cant');
  assert.equal(applyCare({ action: { name: 'pat', user: 'a' }, date: '2026-10-05', mood: 'zombie' }).outcome, 'ok', 'anyone can pat a zombie');
});

test('a snack feeds a hungry pet a little, never like a commit', () => {
  const now = MONDAY;
  const snapshot = mockSnapshot({ mood: 'hungry', now, fullName: 'me/h' });
  const plain = buildPet({ snapshot, now, options: { holiday: null } });
  const fed = buildPet({ snapshot, now, options: { holiday: null, care: { name: 'feed', user: 'a' } } });
  assert.equal(fed.vitals.fullness - plain.vitals.fullness, 4);
  assert.equal(fed.careOutcome, 'ok');
});

test('/pet parses the new commands, aliases and arguments', () => {
  assert.equal(parseCommand('/pet feed'), 'feed');
  assert.equal(parseCommand('/pet snack'), 'feed');
  assert.equal(parseCommand('/pet pet'), 'pat');
  assert.equal(parseCommand('/pet quest'), 'quests');
  assert.equal(parseCommand('/pet wear cap, bird'), 'wear');
  assert.equal(commandArg('/pet wear Cap, bird'), 'cap, bird');
  assert.equal(commandDays('/pet wear cap'), null);
  assert.equal(commandDays('/pet vacation 14'), 14);
  const event = { action: 'created', issue: { number: 1 }, comment: { id: 2, body: '/pet wear cap', user: { login: 'me' }, author_association: 'OWNER' } };
  assert.equal(commandFromEvent('issue_comment', event).arg, 'cap');
});

test('/pet replies for feed, play, quests, wardrobe and wear, in every language', () => {
  const days = live(9, { options: (d) => (d === 8 ? { care: { name: 'feed', user: 'bob' }, wearCommand: 'cap nope' } : {}) });
  const { pet, snapshot } = days[8];
  for (const lang of Object.keys(LANGS)) {
    const p = { ...pet, lang };
    for (const command of ['feed', 'play', 'pat', 'quests', 'wardrobe', 'wear', 'status', 'help']) {
      const reply = commandReply(p, snapshot, { command, user: 'bob', arg: 'cap nope', miniUrl: 'https://x/mini.svg' });
      assert.doesNotMatch(reply, /undefined|NaN|\[object/, `${lang} ${command}`);
    }
  }
  const en = (command, extra = {}) => commandReply(pet, snapshot, { command, user: 'bob', ...extra });
  assert.match(en('feed'), /@bob \(1\)/);
  assert.match(en('quests'), /⭐ \d+ quest star/);
  assert.match(en('wardrobe'), /Wardrobe: \d+ of 16 unlocked/);
  assert.match(en('wear', { arg: 'cap nope' }), /"nope"/);
  assert.match(en('wear', { arg: 'cap nope' }), /wearing 🧢 Cap/);
  assert.match(en('wear', { maintainer: false, arg: 'cap' }), /Only maintainers/);
  const again = { ...pet, careOutcome: 'again' };
  assert.match(commandReply(again, snapshot, { command: 'feed', user: 'bob' }), /full/);
});

test('pet.json keeps the game between runs', () => {
  const days = live(9, { options: (d) => (d === 8 ? { care: { name: 'play', user: 'amy' } } : {}) });
  const { state } = days[8];
  assert.ok(state.quests.week && state.quests.ids.length === 3);
  assert.equal(typeof state.questStars, 'number');
  assert.ok(state.evolution.path);
  assert.equal(state.care.friends.amy, 1);
  assert.deepEqual(state.wardrobe, { worn: [] });
  const json = JSON.parse(JSON.stringify(state));
  const again = buildPet({ snapshot: days[8].snapshot, prevState: json, now: new Date(MONDAY.getTime() + 9 * DAY), options: { holiday: null, species: 'cat' } });
  assert.equal(again.path.id, state.evolution.path);
});

test('the card shows quest progress and keeps a full trophy shelf readable', () => {
  const days = live(9);
  const svg = renderCard(days[8].pet);
  assert.match(svg, /📜 \d\/3 · ⭐ \d+/);
  const crowded = { ...days[8].pet, achievements: Array.from({ length: 15 }, (_, i) => ({ id: `t${i}`, emoji: '🏆', unlockedAt: `2026-10-${10 + i}`, isNew: false })) };
  assert.match(renderCard(crowded), /\+8/);
});

test('the speech bubble never picks up the rising-bubble animation of the reef', () => {
  const pet = buildPet({ snapshot: mockSnapshot({ mood: 'happy', now: MONDAY, fullName: 'me/r' }), now: MONDAY, options: { holiday: null, species: 'octopus', scenery: 'reef' } });
  const css = /<style>([\s\S]*?)<\/style>/.exec(renderCard(pet))[1];
  assert.doesNotMatch(css, /\.lp-bubble\{animation/);
  assert.match(renderCard(pet), /class="lp-bubbling"/);
});
