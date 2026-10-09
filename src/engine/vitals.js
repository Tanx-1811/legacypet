import { DAY, daysBetween, utcDayIndex } from '../util/time.js';

export const THRESHOLDS = {
  hungry: 30,
  sick: 45,
  sad: 40,
  sleepy: 15,
  ecstatic: 80,
  zombieDays: 180,
  partyDays: 3,
};

const clamp = (value, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(value)));

const DEFAULT_MODIFIERS = {
  hungerRate: 1, ciPenalty: 1, issuePenalty: 1, releaseJoy: 0, teamEnergy: 0,
  streakEnergy: 0, ciEnergyFloor: 0, inboxJoy: 0, healthFloor: 0, xpRate: 1, starJoy: 0,
  joyFloor: 0, energyFloor: 0, energyRate: 1, dailyEnergy: 0, releaseEnergy: 0,
  teamJoy: 0, streakJoy: 0, prJoy: 0, tidyJoy: 0, ageJoy: 0,
};

// Bonuses that grow with a count stop at +20 joy (team, stars) or +12 (age).
const BONUS_CAP = 20;
const AGE_CAP = 12;
const RELEASE_DAYS = 14;
const TIDY_HEALTH = 80;

export const withDefaults = (modifiers = {}) => ({ ...DEFAULT_MODIFIERS, ...modifiers });

// Consecutive UTC days with at least one commit. A streak survives until the
// end of the day after the last commit, so a morning run doesn't break it.
export function commitStreak(dates, now) {
  const days = new Set(dates.map((d) => utcDayIndex(d)));
  let day = utcDayIndex(now);
  if (!days.has(day)) day -= 1;
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day -= 1;
  }
  return streak;
}

export function computeFacts(snapshot, now) {
  const { repo, commits, issues } = snapshot;
  const nowMs = now.getTime();
  const recent = commits.recent ?? [];
  const within = (days) => recent.filter((c) => nowMs - new Date(c.date).getTime() <= days * DAY).length;
  const authors30 = new Set(
    recent.filter((c) => !c.bot && c.author && nowMs - new Date(c.date).getTime() <= 30 * DAY).map((c) => c.author),
  );
  return {
    ageDays: Math.max(0, daysBetween(repo.createdAt, now)),
    daysSinceCommit: Math.max(0, daysBetween(commits.lastDate ?? repo.createdAt, now)),
    commits1: within(1),
    commits7: within(7),
    commits14: within(14),
    commits30: within(30),
    streak: commitStreak(recent.map((c) => c.date), now),
    activeAuthors30: authors30.size,
    totalCommits: commits.total ?? null,
    stars: repo.stars ?? 0,
    contributors: snapshot.contributors?.total ?? null,
    openIssues: issues ? issues.open : null,
    openPRs: issues ? issues.openPRs : null,
  };
}

function healthFromCi(ci, penalty) {
  if (!ci || ci.state === 'unknown') return 70;
  if (ci.state === 'pending') return 85;
  if (ci.state === 'passing') return 100;
  const ratio = ci.total ? ci.failing / ci.total : 1;
  return clamp(100 - penalty * (60 + 35 * ratio), 5);
}

function joyFromIssues(issues, penalty) {
  if (!issues) return 75;
  const total = issues.open + issues.openPRs;
  if (total === 0) return 95;
  const staleRatio = (issues.stale + issues.stalePRs) / total;
  const neglected = Math.min(issues.unanswered.length, 5);
  return clamp(100 - penalty * (50 * staleRatio + 8 * neglected), 5);
}

// All vitals are 0–100. Each one maps to a real maintenance habit:
//   fullness ← how recently you committed      health ← CI on the default branch
//   joy      ← whether issues & PRs get love   energy ← commits in the last two weeks
//   hygiene  ← GitHub's community profile score (README, license, CoC…)
export function computeVitals(snapshot, facts, modifiers, now) {
  const m = withDefaults(modifiers);
  const extraAuthors = Math.max(0, facts.activeAuthors30 - 1);
  const freshRelease = snapshot.release && daysBetween(snapshot.release.publishedAt, now) <= RELEASE_DAYS;
  let joy = joyFromIssues(snapshot.issues, m.issuePenalty);
  if (m.releaseJoy && freshRelease) joy += m.releaseJoy;
  if (m.inboxJoy && snapshot.issues && !snapshot.issues.unanswered.length) joy += m.inboxJoy;
  if (m.prJoy && snapshot.issues && !snapshot.issues.stalePRs) joy += m.prJoy;
  if (m.tidyJoy && (snapshot.community?.health ?? 0) >= TIDY_HEALTH) joy += m.tidyJoy;
  if (m.starJoy) joy += Math.min(BONUS_CAP, Math.floor(facts.stars / 100) * m.starJoy);
  if (m.teamJoy) joy += Math.min(BONUS_CAP, m.teamJoy * extraAuthors);
  if (m.streakJoy) joy += m.streakJoy * Math.min(facts.streak, 6);
  if (m.ageJoy) joy += Math.min(AGE_CAP, m.ageJoy * Math.floor(facts.ageDays / 365));
  let energy = 100 * (1 - Math.exp(-(facts.commits14 * m.energyRate) / 6));
  if (m.teamEnergy) energy += m.teamEnergy * extraAuthors;
  if (m.streakEnergy) energy += m.streakEnergy * Math.min(facts.streak, 6);
  if (m.dailyEnergy && facts.commits1 > 0) energy += m.dailyEnergy;
  if (m.releaseEnergy && freshRelease) energy += m.releaseEnergy;
  if (m.ciEnergyFloor && snapshot.ci?.state === 'passing') energy = Math.max(energy, m.ciEnergyFloor);
  return {
    fullness: clamp(100 * Math.exp(-((facts.hungerDays ?? facts.daysSinceCommit) * m.hungerRate) / 21)),
    health: Math.max(healthFromCi(snapshot.ci, m.ciPenalty), m.healthFloor),
    joy: Math.max(clamp(joy), m.joyFloor),
    energy: Math.max(clamp(energy), m.energyFloor),
    hygiene: snapshot.community?.health ?? null,
  };
}

// Level grows with the square root of all-time commits: Lv.11 at 100, Lv.32 at 1,000.
// Species with an `xpRate` (the ancient dragon) count every commit for more.
export function computeGrowth(facts, modifiers = {}) {
  const total = facts.totalCommits;
  if (total == null) return { level: 1, xp: 0, stage: 'adult', hatchProgress: 1 }; // commits unreadable
  const root = Math.sqrt(total * withDefaults(modifiers).xpRate);
  const level = Math.min(99, Math.floor(root) + 1);
  let stage = 'adult';
  if (total < 5) stage = 'egg';
  else if (total < 50 || facts.ageDays < 30) stage = 'baby';
  else if (facts.ageDays >= 3 * 365 && total >= 300) stage = 'elder';
  return {
    level,
    xp: level >= 99 ? 1 : root - Math.floor(root),
    stage,
    hatchProgress: Math.min(1, total / 5),
  };
}
