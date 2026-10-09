import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { blissStreak, MOODS } from '../src/engine/mood.js';
import { buildPet } from '../src/engine/pet.js';
import { moodStrip, nextState } from '../src/engine/memory.js';
import { commandFromEvent, commandReply, parseCommand } from '../src/github/command.js';
import { LANGS, strings } from '../src/i18n/index.js';
import { shieldsJson } from '../src/index.js';
import { mockSnapshot } from '../src/mock.js';
import { renderCard } from '../src/render/card.js';
import { SPECIES } from '../src/sprites/index.js';
import { computeGrowth, computeVitals } from '../src/engine/vitals.js';
import { textWidth, wrapText } from '../src/util/text.js';
import { VERSION, whatsNew } from '../src/whatsnew.js';

const NOW = new Date('2026-10-08T09:00:00Z');
const facts = (extra = {}) => ({ commits1: 0, commits14: 3, streak: 0, activeAuthors30: 1, daysSinceCommit: 0, stars: 0, ageDays: 0, ...extra });
const vitals = (id, snapshot = {}, f = {}) => computeVitals({ issues: null, ci: null, ...snapshot }, facts(f), SPECIES[id].modifiers, NOW);
const issues = (unanswered) => ({ open: 10, stale: 4, openPRs: 0, stalePRs: 0, unanswered });
const failing = { state: 'failing', total: 2, failing: 2, failingNames: ['test'] };

test('hero squad traits each bend one rule', () => {
  assert.equal(vitals('ninja', {}, { streak: 5 }).energy - vitals('blob', {}, { streak: 5 }).energy, 20);
  assert.equal(vitals('ninja', {}, { streak: 30 }).energy - vitals('blob', {}, { streak: 30 }).energy, 24);
  assert.equal(vitals('mecha', { ci: { state: 'passing' } }, { commits14: 0 }).energy, 40);
  assert.equal(vitals('mecha', { ci: failing }, { commits14: 0 }).energy, 0);
  assert.equal(vitals('bat', { issues: issues([]) }).joy - vitals('blob', { issues: issues([]) }).joy, 15);
  assert.equal(vitals('bat', { issues: issues([{ number: 1, days: 9 }]) }).joy, vitals('blob', { issues: issues([{ number: 1, days: 9 }]) }).joy);
  assert.equal(vitals('hero', { ci: failing }).health, 40);
  assert.ok(vitals('blob', { ci: failing }).health < 40);
  assert.equal(vitals('bunny', { issues: issues([]) }, { stars: 500 }).joy - vitals('blob', { issues: issues([]) }, { stars: 500 }).joy, 10);
  assert.equal(computeGrowth({ totalCommits: 100, ageDays: 400 }, SPECIES.dragon.modifiers).level, 13);
  assert.equal(computeGrowth({ totalCommits: 100, ageDays: 400 }, SPECIES.blob.modifiers).level, 11);
});

test('anime crew traits each bend one rule', () => {
  const diff = (id, stat, snapshot = {}, f = {}) => vitals(id, snapshot, f)[stat] - vitals('blob', snapshot, f)[stat];
  const calm = { issues: issues([]) };
  // Energy: daily training, a faster charge, a fresh release, a floor.
  assert.equal(diff('samurai', 'energy', {}, { commits1: 1 }), 12);
  assert.equal(diff('samurai', 'energy', {}, { commits1: 0 }), 0);
  assert.equal(diff('frog', 'energy', {}, { commits1: 2 }), 10);
  assert.ok(diff('raiju', 'energy') > diff('tengu', 'energy') && diff('tengu', 'energy') > 0);
  assert.equal(diff('phoenix', 'energy', { release: { publishedAt: '2026-10-01T00:00:00Z' } }), 20);
  assert.equal(diff('phoenix', 'energy', { release: { publishedAt: '2026-08-01T00:00:00Z' } }), 0);
  assert.equal(vitals('oni', {}, { commits14: 0 }).energy, 35);
  assert.equal(vitals('baku', {}, { commits14: 0 }).energy, 30);
  // Joy: teammates (capped), streaks, age, a tidy profile, fresh PRs, a floor.
  assert.equal(diff('tanuki', 'joy', calm, { activeAuthors30: 3 }), 10);
  assert.equal(diff('pirate', 'joy', { issues: { ...issues([]), stale: 10 } }, { activeAuthors30: 12 }), 20);
  assert.equal(diff('panda', 'joy', calm, { streak: 4 }), 12);
  assert.equal(diff('panda', 'joy', calm, { streak: 30 }), 18);
  assert.equal(diff('kodama', 'joy', calm, { ageDays: 3 * 365 + 5 }), 6);
  assert.equal(diff('kodama', 'joy', calm, { ageDays: 20 * 365 }), 12);
  assert.equal(diff('witch', 'joy', { ...calm, community: { health: 85 } }), 12);
  assert.equal(diff('witch', 'joy', { ...calm, community: { health: 70 } }), 0);
  assert.equal(diff('knight', 'joy', calm), 12);
  assert.equal(diff('knight', 'joy', { issues: { ...issues([]), openPRs: 2, stalePRs: 1 } }), 0);
  const ignored = { issues: { open: 10, stale: 10, openPRs: 0, stalePRs: 0, unanswered: Array.from({ length: 5 }, (_, i) => ({ number: i, days: 9 })) } };
  assert.equal(vitals('idol', ignored).joy, 35);
  assert.ok(vitals('blob', ignored).joy < 35);
  // Old rules, new faces.
  assert.equal(vitals('daruma', { ci: failing }).health, 45);
  assert.equal(vitals('alien', { ci: { state: 'passing' } }, { commits14: 0 }).energy, 45);
  assert.equal(computeGrowth({ totalCommits: 100, ageDays: 400 }, SPECIES.kaiju.modifiers).level, 12);
});

test('a hatched pet keeps its species when the pool grows', () => {
  const snapshot = mockSnapshot({ mood: 'happy', now: NOW, fullName: 'me/old-project' });
  const first = buildPet({ snapshot, now: NOW, options: { holiday: null } });
  const other = Object.keys(SPECIES).find((id) => id !== first.speciesId);
  const remembered = buildPet({ snapshot, now: NOW, prevState: { pet: { species: other } }, options: { holiday: null } });
  assert.equal(remembered.speciesId, other);
  const overridden = buildPet({ snapshot, now: NOW, prevState: { pet: { species: other } }, options: { species: 'bat', holiday: null } });
  assert.equal(overridden.speciesId, 'bat');
});

test('a week of bliss unlocks the super form', () => {
  const history = (n, mood = 'ecstatic') => Array.from({ length: n }, (_, i) => ({ date: `2026-10-0${7 - i}`, mood }));
  assert.equal(blissStreak('ecstatic', '2026-10-08', history(6)), 7);
  assert.equal(blissStreak('happy', '2026-10-08', history(6)), 0);
  assert.equal(blissStreak('ecstatic', '2026-10-08', [{ date: '2026-10-06', mood: 'ecstatic' }]), 1);
  const snapshot = mockSnapshot({ mood: 'ecstatic', now: NOW });
  const pet = buildPet({ snapshot, now: NOW, prevState: { history: history(6) }, options: { holiday: null } });
  assert.equal(pet.mood, 'ecstatic');
  assert.ok(pet.aura);
  assert.ok(pet.achievements.some((a) => a.id === 'superForm'));
  assert.match(renderCard(pet), /lp-aura/);
  assert.ok(!buildPet({ snapshot, now: NOW, options: { holiday: null } }).aura);
});

const keysOf = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) =>
  (v && typeof v === 'object' && !Array.isArray(v) ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

test('every translation file has every English key', async () => {
  // Checks the raw files, not LANGS: LANGS fills gaps with English, which would hide them.
  const english = keysOf(LANGS.en);
  for (const code of Object.keys(LANGS).filter((c) => c !== 'en')) {
    const raw = (await import(`../src/i18n/${code}.js`)).default;
    const missing = english.filter((key) => key.split('.').reduce((o, k) => o?.[k], raw) === undefined);
    assert.deepEqual(missing, [], `${code}.js is missing: ${missing.join(', ')}`);
    for (const key of english) {
      const kind = (o) => typeof key.split('.').reduce((x, k) => x?.[k], o);
      assert.equal(kind(raw), kind(LANGS.en), `${code}.js: ${key} should be a ${kind(LANGS.en)}`);
    }
  }
});

test('every language renders every mood', () => {
  for (const code of Object.keys(LANGS)) {
    for (const mood of MOODS) {
      const pet = buildPet({ snapshot: mockSnapshot({ mood, now: NOW }), now: NOW, options: { species: 'ninja', mood, lang: code, holiday: null } });
      const svg = renderCard(pet);
      assert.doesNotMatch(svg, /undefined|NaN|\[object/, `${code}/${mood}`);
      assert.ok(pet.speech.length > 0);
    }
  }
  assert.equal(strings('ja-JP').code, 'ja');
  assert.equal(strings('xx').code, 'en');
});

test('CJK text wraps between characters and counts as double width', () => {
  assert.equal(textWidth('日本語'), 6);
  const lines = wrapText('おなかすいた…40日もコミットがないよ、タイポ修正でもいいから食べたい', 36, 2);
  assert.equal(lines.length, 2);
  for (const line of lines) assert.ok(textWidth(line) <= 36, line);
  assert.doesNotMatch(lines[1], /^[、。]/);
  assert.deepEqual(wrapText('Hello world, this is a test of the wrap function', 36, 2), ['Hello world, this is a test of the', 'wrap function']);
});

test('/pet commands are parsed from comments, never from bots', () => {
  assert.equal(parseCommand('/pet'), 'status');
  assert.equal(parseCommand('Nice work!\n/pet pat\n'), 'pat');
  assert.equal(parseCommand('/pet CHECKUP'), 'checkup');
  assert.equal(parseCommand('/pet dance'), 'help');
  assert.equal(parseCommand('my /pet is cute'), null);
  assert.equal(parseCommand('/petition'), null);
  const event = (login, type = 'User', action = 'created') => ({
    action, issue: { number: 7 }, comment: { id: 99, body: '/pet pat', user: { login, type } },
  });
  assert.deepEqual(commandFromEvent('issue_comment', event('octocat')), { command: 'pat', issue: 7, commentId: 99, user: 'octocat', maintainer: false });
  assert.equal(commandFromEvent('issue_comment', event('github-actions[bot]', 'Bot')), null);
  assert.equal(commandFromEvent('issue_comment', event('octocat', 'User', 'edited')), null);
  assert.equal(commandFromEvent('push', event('octocat')), null);
});

test('/pet replies in the pet\'s language', () => {
  const snapshot = mockSnapshot({ mood: 'sick', now: NOW });
  const pet = buildPet({ snapshot, now: NOW, options: { species: 'hero', lang: 'vi', holiday: null } });
  const status = commandReply(pet, snapshot, { command: 'status', user: 'me', cardUrl: 'https://x/pet.svg' });
  assert.match(status, /Khám sức khỏe/);
  assert.match(status, /<img src="https:\/\/x\/pet.svg"/);
  assert.match(status, /❌/);
  assert.doesNotMatch(commandReply(pet, snapshot, { command: 'pat', user: 'me' }), /undefined/);
  assert.match(commandReply(pet, snapshot, { command: 'help' }), /\/pet pat/);
});

test('shields endpoint, mood strip and version memory', () => {
  const snapshot = mockSnapshot({ mood: 'happy', now: NOW });
  const pet = buildPet({ snapshot, now: NOW, options: { name: 'Mochi', holiday: null } });
  assert.deepEqual(Object.keys(shieldsJson(pet)), ['schemaVersion', 'label', 'message', 'color', 'labelColor']);
  assert.match(shieldsJson(pet).color, /^[0-9a-f]{6}$/);
  assert.equal(moodStrip([{ date: '2026-10-08', mood: 'happy' }, { date: '2026-10-07', mood: 'sick' }]), '🤒😊');
  assert.equal(nextState(pet).version, VERSION);
});

test('what\'s new: only for existing pets, only releases they have not seen', () => {
  assert.equal(JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version, VERSION);
  assert.deepEqual(whatsNew(null), []);
  assert.deepEqual(whatsNew({ version: VERSION }), []);
  const old = whatsNew({});
  assert.ok(old.length >= 1 && old.every((e) => e.items.length));
  const wf = old.find((e) => e.workflow);
  assert.ok(wf.workflow.test('on:\n  issue_comment:\n'));
  assert.ok(!wf.workflow.test('on:\n  schedule:\n'));
});

test('every species has a signature move, shown only on good days', async () => {
  const { MOVES, moveOf } = await import('../src/render/moves.js');
  const { renderMini } = await import('../src/render/mini.js');
  const seen = new Set();
  for (const [id, species] of Object.entries(SPECIES)) {
    assert.ok(MOVES[species.move], `${id} needs a move from moves.js, got ${species.move}`);
    seen.add(species.move);
    const happy = renderCard(buildPet({ snapshot: mockSnapshot({ mood: 'happy', now: NOW }), now: NOW, options: { species: id, mood: 'happy', holiday: null } }));
    assert.match(happy, new RegExp(`class="lp-mv-${moveOf(species)}"`), id);
    assert.match(happy, new RegExp(`@keyframes lp-mv-${moveOf(species)}\{`), id);
    const sick = renderMini(buildPet({ snapshot: mockSnapshot({ mood: 'sick', now: NOW }), now: NOW, options: { species: id, mood: 'sick', holiday: null } }));
    assert.doesNotMatch(sick, /lp-mv-/, `${id} should not show off while sick`);
  }
  assert.equal(seen.size, Object.keys(SPECIES).length, 'every species moves its own way');
  const ninja = renderCard(buildPet({ snapshot: mockSnapshot({ mood: 'party', now: NOW }), now: NOW, options: { species: 'ninja', mood: 'party', holiday: null } }));
  const ref = /<use href="#([^"]+)"/.exec(ninja)?.[1];
  assert.ok(ref && ninja.includes(`id="${ref}"`), 'shadow clones point at the drawn pet');
  const mecha = renderCard(buildPet({ snapshot: mockSnapshot({ mood: 'ecstatic', now: NOW }), now: NOW, options: { species: 'mecha', mood: 'ecstatic', holiday: null } }));
  assert.match(mecha, /lp-fx-flames/);
  const egg = renderCard(buildPet({ snapshot: mockSnapshot({ mood: 'egg', now: NOW }), now: NOW, options: { species: 'ninja', holiday: null } }));
  assert.doesNotMatch(egg, /lp-mv-|<use /);
});
