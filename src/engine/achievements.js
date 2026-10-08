// Trophies are permanent: once unlocked they stay in pet.json even if the streak breaks.
export const ACHIEVEMENTS = [
  { id: 'hatched', emoji: '🐣', test: (c) => c.events.includes('hatched') },
  { id: 'lazarus', emoji: '🧟', test: (c) => c.events.includes('revived') },
  { id: 'survivor', emoji: '🩹', test: (c) => c.events.includes('recovered') },
  { id: 'shiny', emoji: '✨', test: (c) => c.shiny },
  { id: 'streak7', emoji: '🔥', test: (c) => c.facts.streak >= 7 },
  { id: 'streak30', emoji: '☄️', test: (c) => c.facts.streak >= 30 },
  { id: 'centurion', emoji: '💯', test: (c) => c.facts.totalCommits >= 100 },
  { id: 'shipper', emoji: '🚀', test: (c) => Boolean(c.snapshot.release) },
  { id: 'stars100', emoji: '⭐', test: (c) => c.facts.stars >= 100 },
  { id: 'stars1k', emoji: '🌟', test: (c) => c.facts.stars >= 1000 },
  { id: 'team', emoji: '🤝', test: (c) => (c.facts.contributors ?? 0) >= 10 },
  { id: 'spotless', emoji: '🧼', test: (c) => c.vitals.hygiene === 100 },
  {
    id: 'inboxZero',
    emoji: '📭',
    test: (c) => c.facts.openIssues === 0 && c.facts.openPRs === 0 && c.facts.totalCommits >= 20,
  },
  { id: 'elder', emoji: '🧙', test: (c) => c.growth.stage === 'elder' },
];

export function evaluateAchievements(context, unlocked = {}, today) {
  const map = { ...unlocked };
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (!map[a.id] && a.test(context)) {
      map[a.id] = today;
      fresh.push(a.id);
    }
  }
  const list = ACHIEVEMENTS.filter((a) => map[a.id]).map((a) => ({
    id: a.id,
    emoji: a.emoji,
    unlockedAt: map[a.id],
    isNew: fresh.includes(a.id),
  }));
  return { map, list, fresh };
}
