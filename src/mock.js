import { DAY } from './util/time.js';

// Made-up repo snapshots that produce each mood through the real engine.
// Used by `legacypet demo`, the gallery and the tests.

const STAGES = {
  egg: { total: 2, age: 3 },
  baby: { total: 24, age: 20 },
  adult: { total: 420, age: 500 },
  elder: { total: 2600, age: 1600 },
};

const passing = { state: 'passing', total: 6, failing: 0, failingNames: [] };
const calmIssues = { open: 6, stale: 1, openPRs: 1, stalePRs: 0, unanswered: [{ number: 17, days: 9 }] };

const SCENARIOS = {
  ecstatic: {
    commitDays: [0.2, 0.4, 0.9, 1.2, 1.5, 2.1, 2.6, 3.2, 3.8, 4.1, 4.6, 5.3, 5.8, 6.2, 6.7, 7.4, 8.1, 9.2, 10.4, 11.3, 12.2, 13.1],
    ci: passing,
    issues: { open: 3, stale: 0, openPRs: 2, stalePRs: 0, unanswered: [] },
    release: { tag: 'v3.1.0', days: 40 },
    community: 100, contributors: 14, stars: 1500,
    treats: [{ user: 'octocat', number: 42, days: 0.3 }],
  },
  happy: { commitDays: [2, 5, 9], ci: passing, issues: calmIssues, community: 60, contributors: 4, stars: 120 },
  party: { commitDays: [1, 3, 6], ci: passing, issues: calmIssues, release: { tag: 'v2.0.0', days: 1 }, community: 80, contributors: 6, stars: 340 },
  hungry: { commitDays: [40, 45, 60], ci: passing, issues: calmIssues, community: 50, contributors: 2, stars: 30 },
  sleepy: { commitDays: [18, 25], ci: passing, issues: calmIssues, community: 50, contributors: 2, stars: 30 },
  sad: {
    commitDays: [3, 6, 8],
    ci: passing,
    issues: {
      open: 22, stale: 19, openPRs: 4, stalePRs: 3,
      unanswered: [{ number: 12, days: 87 }, { number: 19, days: 64 }, { number: 23, days: 41 }, { number: 31, days: 20 }, { number: 33, days: 12 }],
    },
    community: 40, contributors: 5, stars: 210,
  },
  sick: {
    commitDays: [1, 1.5, 2, 4, 7],
    ci: { state: 'failing', total: 5, failing: 2, failingNames: ['test (ubuntu-latest)', 'lint'] },
    issues: calmIssues, community: 70, contributors: 3, stars: 90,
  },
  zombie: { commitDays: [], lastCommit: 420, ci: { state: 'unknown', total: 0, failing: 0, failingNames: [] }, issues: calmIssues, community: 30, contributors: 1, stars: 12 },
  hibernating: { commitDays: [], lastCommit: 200, archived: true, ci: passing, issues: null, community: 70, contributors: 3, stars: 75 },
  egg: { commitDays: [0.5, 1], ci: { state: 'unknown', total: 0, failing: 0, failingNames: [] }, issues: null, community: null, contributors: 1, stars: 0 },
};

export function mockSnapshot({ mood = 'happy', stage = 'adult', now = new Date(), fullName = 'octo-org/demo', language = null } = {}) {
  const spec = SCENARIOS[mood] ?? SCENARIOS.happy;
  const growth = STAGES[mood === 'egg' ? 'egg' : stage] ?? STAGES.adult;
  const ago = (days) => new Date(now.getTime() - days * DAY).toISOString();
  const lastCommit = spec.commitDays[0] ?? spec.lastCommit ?? 1;
  const age = Math.max(growth.age, lastCommit + 2) + 0.37; // never lands exactly on a birthday
  const [owner, name] = fullName.split('/');
  return {
    repo: {
      owner, name, fullName, defaultBranch: 'main', archived: Boolean(spec.archived), isPrivate: false,
      stars: spec.stars, forks: Math.floor(spec.stars / 8), language, createdAt: ago(age), pushedAt: ago(lastCommit),
    },
    commits: {
      total: growth.total,
      lastDate: ago(lastCommit),
      recent: spec.commitDays.map((d, i) => ({ sha: `mock${i}`, date: ago(d), author: i % 3 ? 'alice' : 'bob', bot: false })),
    },
    ci: spec.ci,
    issues: spec.issues,
    release: spec.release ? { tag: spec.release.tag, name: spec.release.tag, publishedAt: ago(spec.release.days) } : null,
    community: spec.community == null ? null : { health: spec.community },
    contributors: { total: spec.contributors },
    treats: (spec.treats ?? []).map((t) => ({ user: t.user, number: t.number, title: 'Add a feature', mergedAt: ago(t.days), external: true })),
    warnings: [],
    fetchedAt: now.toISOString(),
  };
}
