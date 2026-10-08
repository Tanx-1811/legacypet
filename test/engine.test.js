import assert from 'node:assert/strict';
import { test } from 'node:test';
import { holidayFor, isBirthday, seasonFor } from '../src/engine/calendar.js';
import { isShiny, petName } from '../src/engine/identity.js';
import { MOODS } from '../src/engine/mood.js';
import { buildPet } from '../src/engine/pet.js';
import { commitStreak, computeGrowth } from '../src/engine/vitals.js';
import { mockSnapshot } from '../src/mock.js';
import { DAY } from '../src/util/time.js';

const NOW = new Date('2026-10-08T09:00:00Z');
const pet = (mood, options = {}, prevState = null) =>
  buildPet({ snapshot: mockSnapshot({ mood, now: NOW }), prevState, now: NOW, options: { species: 'blob', holiday: null, ...options } });

for (const mood of MOODS) {
  test(`mock data for "${mood}" produces that mood naturally`, () => {
    assert.equal(pet(mood).mood, mood);
  });
}

test('vitals stay within 0–100', () => {
  for (const mood of MOODS) {
    for (const [key, value] of Object.entries(pet(mood).vitals)) {
      if (value === null) continue;
      assert.ok(Number.isInteger(value) && value >= 0 && value <= 100, `${mood}.${key} = ${value}`);
    }
  }
});

test('traits change the outcome: a cactus is not hungry after 40 days', () => {
  assert.equal(pet('hungry').mood, 'hungry');
  const cactus = pet('hungry', { species: 'cactus' });
  assert.notEqual(cactus.mood, 'hungry');
  assert.ok(cactus.vitals.fullness > 50);
});

test('a duck shrugs off a little failing CI, a blob gets sick', () => {
  assert.equal(pet('sick').mood, 'sick');
  assert.notEqual(pet('sick', { species: 'duck' }).mood, 'sick');
});

test('a zombie that gets fed comes back to life and earns Lazarus', () => {
  const revived = pet('happy', {}, { lastMood: 'zombie', lastStage: 'adult', achievements: {} });
  assert.equal(revived.mood, 'party');
  assert.ok(revived.events.includes('revived'));
  assert.ok(revived.newAchievements.includes('lazarus'));
  // A second run on the same day keeps the celebration going.
  const again = pet('happy', {}, { lastMood: 'party', lastStage: 'adult', events: { revived: '2026-10-08' } });
  assert.equal(again.mood, 'party');
});

test('an egg hatches into a party', () => {
  const hatched = pet('happy', {}, { lastMood: 'egg', lastStage: 'egg' });
  assert.ok(hatched.events.includes('hatched'));
  assert.equal(hatched.mood, 'party');
  assert.ok(hatched.newAchievements.includes('hatched'));
});

test('achievements persist even when conditions no longer hold', () => {
  const p = pet('sleepy', {}, { achievements: { streak7: '2026-01-01' } });
  assert.ok(p.achievements.some((a) => a.id === 'streak7' && !a.isNew));
});

test('speech is data-aware and translated', () => {
  assert.match(pet('sick').speech, /test \(ubuntu-latest\)|lint|cough/);
  assert.match(pet('hungry').speech, /40|hungry|README/);
  const vi = pet('zombie', { lang: 'vi' });
  assert.equal(vi.lang, 'vi');
  assert.match(vi.displayName, /Thây Ma/);
});

test('accessories follow mood, stage and holidays', () => {
  assert.equal(pet('party').accessories.hat, 'party');
  assert.equal(pet('sick').accessories.hat, 'icepack');
  assert.equal(pet('happy', { holiday: 'halloween' }).accessories.hat, 'witch');
  assert.equal(pet('ecstatic').accessories.hat, 'crown');
  const elder = buildPet({ snapshot: mockSnapshot({ mood: 'happy', stage: 'elder', now: NOW }), now: NOW, options: { species: 'cat', holiday: null } });
  assert.equal(elder.stage, 'elder');
  assert.equal(elder.accessories.face, 'monocle');
});

test('identity is deterministic', () => {
  assert.equal(petName('Tanx-1811/legacypet'), petName('tanx-1811/LegacyPet'));
  assert.equal(typeof isShiny('a/b'), 'boolean');
  const shinyCount = Array.from({ length: 6400 }, (_, i) => isShiny(`user/repo-${i}`)).filter(Boolean).length;
  assert.ok(shinyCount > 50 && shinyCount < 160, `about 1 in 64 should be shiny, got ${shinyCount}/6400`);
});

test('growth: level and stage', () => {
  assert.deepEqual(computeGrowth({ totalCommits: 0, ageDays: 1 }).stage, 'egg');
  assert.equal(computeGrowth({ totalCommits: 100, ageDays: 400 }).level, 11);
  assert.equal(computeGrowth({ totalCommits: 100, ageDays: 400 }).stage, 'adult');
  assert.equal(computeGrowth({ totalCommits: 10, ageDays: 400 }).stage, 'baby');
  assert.equal(computeGrowth({ totalCommits: 5000, ageDays: 2000 }).stage, 'elder');
  assert.equal(computeGrowth({ totalCommits: 999999, ageDays: 2000 }).level, 99);
  assert.equal(computeGrowth({ totalCommits: null, ageDays: 2000 }).stage, 'adult');
});

test('commit streaks survive until the end of the next day', () => {
  const at = (d) => new Date(NOW.getTime() - d * DAY);
  assert.equal(commitStreak([at(0), at(1), at(2)], NOW), 3);
  assert.equal(commitStreak([at(1), at(2)], NOW), 2);
  assert.equal(commitStreak([at(3)], NOW), 0);
});

test('calendar: holidays, Tết, seasons and birthdays', () => {
  assert.equal(holidayFor(new Date('2026-10-31T12:00:00Z')), 'halloween');
  assert.equal(holidayFor(new Date('2027-02-07T12:00:00Z')), 'tet');
  assert.equal(holidayFor(new Date('2026-09-13T12:00:00Z')), 'programmers');
  assert.equal(holidayFor(new Date('2028-09-12T12:00:00Z')), 'programmers'); // leap year
  assert.equal(holidayFor(NOW), null);
  assert.equal(seasonFor(NOW), 'autumn');
  assert.ok(isBirthday('2020-10-08T03:00:00Z', NOW));
  assert.ok(!isBirthday('2026-10-08T03:00:00Z', NOW));
});

test('archived repos hibernate even when everything else is fine', () => {
  const snapshot = mockSnapshot({ mood: 'ecstatic', now: NOW });
  snapshot.repo.archived = true;
  assert.equal(buildPet({ snapshot, now: NOW, options: { holiday: null } }).mood, 'hibernating');
});
