import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPet } from '../src/engine/pet.js';
import { diaryEntry } from '../src/engine/memory.js';
import { levelEvents, levelProgress, MAX_LEVEL, RANKS, rankFor } from '../src/engine/rank.js';
import { commandReply, parseCommand } from '../src/github/command.js';
import { mockSnapshot } from '../src/mock.js';
import { renderBadge } from '../src/render/badge.js';
import { renderCard } from '../src/render/card.js';

const NOW = new Date('2026-10-08T09:00:00Z');
const snapshot = (mood = 'happy', total) => {
  const s = mockSnapshot({ mood, now: NOW });
  if (total != null) s.commits.total = total;
  return s;
};
const pet = (opts = {}, prevState = null, s = snapshot()) => buildPet({ snapshot: s, prevState, now: NOW, options: { species: 'blob', holiday: null, ...opts } });

test('ranks cover every level, in order', () => {
  assert.equal(RANKS[0].min, 1);
  for (let i = 1; i < RANKS.length; i++) assert.ok(RANKS[i].min > RANKS[i - 1].min);
  assert.equal(rankFor(1).id, 'rookie');
  assert.equal(rankFor(9).id, 'rookie');
  assert.equal(rankFor(10).id, 'bronze');
  assert.equal(rankFor(34).id, 'silver');
  assert.equal(rankFor(35).id, 'gold');
  assert.equal(rankFor(MAX_LEVEL).id, 'legend');
});

test('progress counts the commits to the next level and rank', () => {
  // Lv.11 needs 100 commits, Lv.12 needs 121, bronze starts at Lv.10 (81), silver at Lv.20 (361).
  const p = levelProgress({ level: 11, totalCommits: 100 });
  assert.deepEqual(p.nextLevel, { level: 12, commits: 21 });
  assert.equal(p.nextRank.id, 'silver');
  assert.equal(p.nextRank.commits, 261);
  // The dragon counts every commit for 1.5.
  assert.equal(levelProgress({ level: 11, totalCommits: 100 }, { xpRate: 1.5 }).nextLevel.commits, 1);
  assert.equal(levelProgress({ level: 99, totalCommits: 99999 }).nextLevel, null);
  assert.equal(levelProgress({ level: 95, totalCommits: 9000 }).nextRank, null);
});

test('level-ups are detected from memory, never on the first run', () => {
  assert.deepEqual(levelEvents(null, 12), []);
  assert.deepEqual(levelEvents({ pet: { level: 12 } }, 12), []);
  assert.deepEqual(levelEvents({ pet: { level: 11 } }, 12), ['levelUp']);
  assert.deepEqual(levelEvents({ pet: { level: 19 } }, 20), ['levelUp', 'rankUp']);
});

test('a level-up shows on the card, in the speech and in the diary', () => {
  const before = pet({}, null, snapshot('happy', 99));
  const after = pet({}, { pet: { level: before.level } }, snapshot('happy', 100));
  assert.equal(after.level, before.level + 1);
  assert.ok(after.events.includes('levelUp'));
  assert.match(after.speech, new RegExp(`Lv\\.${after.level}`));
  assert.match(renderCard(after), /class="lp-lvup"/);
  assert.match(diaryEntry(after, snapshot()), new RegExp(`leveled up to Lv\\.${after.level}`));
  assert.doesNotMatch(renderCard(before), /class="lp-lvup"/);

  const ranked = pet({ levelUp: 'rank', lang: 'vi' });
  assert.ok(ranked.events.includes('rankUp'));
  assert.match(ranked.speech, /hạng|Hạng/);
  assert.match(diaryEntry(ranked, snapshot()), /đạt hạng/);
});

test('rank shows on the card, the badge and in milestone trophies', () => {
  const p = pet({}, null, snapshot('happy', 2600)); // Lv.51
  assert.equal(p.rank.id, 'platinum');
  const card = renderCard(p);
  assert.match(card, /💠 Lv\.51/);
  assert.match(card, /class="lp-xp" style="fill:#4fc3f7"/);
  assert.match(renderBadge(p), /💠 Lv\.51/);
  const ids = p.achievements.map((a) => a.id);
  assert.ok(ids.includes('veteran') && ids.includes('master') && !ids.includes('maxLevel'));
});

test('/pet level explains what the next level takes', () => {
  assert.equal(parseCommand('/pet level'), 'level');
  const s = snapshot('happy', 100);
  const p = pet({}, null, s);
  const reply = commandReply(p, s, { command: 'level' });
  assert.match(reply, /Lv\.11 · Bronze rank/);
  assert.match(reply, /21 more commits to Lv\.12/);
  assert.match(reply, /261 more commits to Silver/);
  assert.match(reply, /\*\*🥉 Bronze\*\*/);
  assert.doesNotMatch(reply, /undefined/);
});
