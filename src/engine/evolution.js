// Evolution: after watching its maintainer for a week as an adult, a pet grows into one of four
// paths that mirror how the repo is cared for. The path is permanent and gives a small boost
// to the vital that matches it. Elders on a path "ascend" and their emblem glows.

export const EVOLVE_AFTER_DAYS = 7;
export const PATH_BONUS = 6;

export const PATHS = [
  { id: 'swift', emoji: '🌪️', vital: 'energy', color: '#5ec8ff' },
  { id: 'guardian', emoji: '🛡️', vital: 'health', color: '#7ee081' },
  { id: 'social', emoji: '💞', vital: 'joy', color: '#ff7eb6' },
  { id: 'sage', emoji: '📚', vital: 'fullness', color: '#b388ff' },
];
export const PATH_IDS = PATHS.map((p) => p.id);
export const pathById = (id) => PATHS.find((p) => p.id === id) ?? null;

// How strongly the repo leans towards each path, from 0 to about 2.
export function pathScores({ snapshot, facts, history = [] }) {
  const ciKnown = snapshot.ci && snapshot.ci.state !== 'unknown';
  const health = history.map((h) => h.vitals?.[1]).filter((v) => v != null);
  const avgHealth = health.length ? health.reduce((a, b) => a + b, 0) / health.length : snapshot.ci?.state === 'passing' ? 100 : 60;
  const issues = snapshot.issues;
  const caring = issues && issues.open > 0 && issues.unanswered.length === 0 ? 0.5 : 0;
  return {
    swift: Math.min(1.2, facts.commits30 / 25) + Math.min(0.8, facts.streak / 10),
    guardian: ciKnown ? (avgHealth / 100) * 1.4 : 0,
    social: Math.min(1, Math.max(0, facts.activeAuthors30 - 1) / 3) + Math.min(0.6, (snapshot.treats?.length ?? 0) / 4) + caring,
    sage: (snapshot.community?.health ?? 0) / 100 + (snapshot.release ? 0.3 : 0),
  };
}

export function choosePath(context) {
  const scores = pathScores(context);
  return PATH_IDS.reduce((best, id) => (scores[id] > scores[best] ? id : best), PATH_IDS[0]);
}

// prev: last run's `evolution` from pet.json. `preview` forces a path (gallery, playground).
export function evolve({ stage, history = [], prev = null, preview, date, ...context }) {
  if (preview) return pathById(preview) ? { path: preview, since: prev?.since ?? date, fresh: false } : null;
  if (prev?.path && pathById(prev.path)) return { path: prev.path, since: prev.since, fresh: false };
  if (stage !== 'adult' && stage !== 'elder') return null;
  const watched = new Set(history.filter((h) => h.date < date).map((h) => h.date)).size;
  if (watched < EVOLVE_AFTER_DAYS) return null;
  return { path: choosePath({ history, ...context }), since: date, fresh: true };
}

export function applyPathBonus(vitals, evolution) {
  const path = evolution && pathById(evolution.path);
  if (path && vitals[path.vital] != null) vitals[path.vital] = Math.min(100, vitals[path.vital] + PATH_BONUS);
  return vitals;
}
