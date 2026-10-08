import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextState, updateDiary } from '../src/engine/memory.js';
import { buildPet } from '../src/engine/pet.js';
import { mockSnapshot } from '../src/mock.js';
import { truncate, wrapText } from '../src/util/text.js';

const at = (iso) => new Date(iso);

function day(iso, mood = 'happy', prevState = null) {
  const now = at(iso);
  const snapshot = mockSnapshot({ mood, now });
  return { snapshot, pet: buildPet({ snapshot, prevState, now, options: { holiday: null } }) };
}

test('the diary gets one line per day, newest first, and replaces same-day reruns', () => {
  const first = day('2026-10-07T09:00:00Z');
  let diary = updateDiary(null, first.pet, first.snapshot);
  assert.match(diary, /^# 📔 /);
  assert.match(diary, /- \*\*2026-10-07\*\*/);

  const second = day('2026-10-08T09:00:00Z', 'hungry');
  diary = updateDiary(diary, second.pet, second.snapshot);
  const rerun = day('2026-10-08T18:00:00Z', 'sick');
  diary = updateDiary(diary, rerun.pet, rerun.snapshot);

  const entries = diary.split('\n').filter((l) => l.startsWith('- **'));
  assert.equal(entries.length, 2);
  assert.match(entries[0], /2026-10-08.*🤒/);
  assert.match(entries[1], /2026-10-07/);
});

test('the diary is capped', () => {
  const { pet, snapshot } = day('2026-10-08T09:00:00Z');
  const old = Array.from({ length: 500 }, (_, i) => `- **2025-01-${String((i % 28) + 1).padStart(2, '0')}** · old`).join('\n');
  const entries = updateDiary(old, pet, snapshot, { max: 30 }).split('\n').filter((l) => l.startsWith('- **'));
  assert.equal(entries.length, 30);
});

test('pet.json keeps a mood history and remembers when it was born', () => {
  const a = day('2026-10-07T09:00:00Z');
  const s1 = nextState(a.pet, null);
  const b = day('2026-10-08T09:00:00Z', 'sleepy', s1);
  const s2 = nextState(b.pet, s1);
  assert.equal(s2.born, '2026-10-07');
  assert.deepEqual(s2.history.map((h) => h.mood), ['sleepy', 'happy']);
  assert.equal(s2.lastMood, 'sleepy');
});

test('text wrapping keeps bubbles tidy', () => {
  assert.deepEqual(wrapText('short line', 36, 2), ['short line']);
  const lines = wrapText('a '.repeat(80).trim(), 10, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines[1].endsWith('…'));
  assert.equal(truncate('supercalifragilistic', 6), 'super…');
});
