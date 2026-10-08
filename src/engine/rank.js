import { withDefaults } from './vitals.js';

// Ranks group levels into tiers, so a level means something at a glance: a 🥈 Silver pet
// has been fed a few hundred commits. Each rank tints the XP bar on the card.
export const RANKS = [
  { id: 'rookie', min: 1, emoji: '🌱', color: '#7ee081' },
  { id: 'bronze', min: 10, emoji: '🥉', color: '#cd7f32' },
  { id: 'silver', min: 20, emoji: '🥈', color: '#a8b2c1' },
  { id: 'gold', min: 35, emoji: '🥇', color: '#f2b705' },
  { id: 'platinum', min: 50, emoji: '💠', color: '#4fc3f7' },
  { id: 'diamond', min: 70, emoji: '💎', color: '#b388ff' },
  { id: 'legend', min: 90, emoji: '👑', color: '#ff5fa2' },
];

export const MAX_LEVEL = 99;

export function rankFor(level) {
  let rank = RANKS[0];
  for (const r of RANKS) if (level >= r.min) rank = r;
  return rank;
}

// How far the pet is from its next level and next rank, in commits.
// Level L needs (L - 1)² commits (fewer for species with an xpRate, like the dragon).
export function levelProgress({ level, totalCommits }, modifiers = {}) {
  const rate = withDefaults(modifiers).xpRate;
  const commitsFor = (lv) => Math.ceil((lv - 1) ** 2 / rate);
  const total = totalCommits ?? 0;
  const rank = rankFor(level);
  const nextRank = RANKS[RANKS.indexOf(rank) + 1] ?? null;
  return {
    rank,
    nextLevel: level >= MAX_LEVEL ? null : { level: level + 1, commits: Math.max(1, commitsFor(level + 1) - total) },
    nextRank: nextRank ? { ...nextRank, commits: Math.max(1, commitsFor(nextRank.min) - total) } : null,
  };
}

// Level-ups since the last run. The first run (no memory yet) never counts as a level-up.
export function levelEvents(prevState, level) {
  const before = prevState?.pet?.level;
  if (!before || level <= before) return [];
  const events = ['levelUp'];
  if (rankFor(level).id !== rankFor(before).id) events.push('rankUp');
  return events;
}
