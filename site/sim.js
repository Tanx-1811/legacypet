// The simulator's make-believe repo. Every day the player (or an autoplay habit) decides
// what happens; the real engine turns that into a pet, exactly like the GitHub Action does,
// and pet.json + DIARY.md carry over from one run to the next.
import { buildPet, nextState, updateDiary } from './src/index.js';
import { createRng } from './src/util/rng.js';

const DAY = 86_400_000;
const PEOPLE = ['you', 'amy', 'ben', 'chi', 'dan', 'eve'];
const iso = (ms) => new Date(ms).toISOString();

const STARTS = {
  egg: { age: 1, base: 1, last: 1, stars: 0, contributors: 1, community: 30, ci: 'unknown', release: null, recent: [] },
  young: { age: 120, base: 70, last: 1, stars: 25, contributors: 2, community: 60, ci: 'passing', release: null, recent: [1, 2, 4, 6] },
  veteran: { age: 1500, base: 900, last: 1, stars: 820, contributors: 12, community: 90, ci: 'passing', release: 60, recent: [1, 2, 3, 5, 8, 9] },
};

export const DEFAULT_TODAY = { commits: 0, authors: 1, ci: 'passing', merged: 0, waiting: 0, stale: 0, release: false, stars: 0, community: 60, archived: false };

// The first day starts today (UTC), so seasons and holidays match the real calendar.
export function newWorld({ start = 'young', fullName = 'you/your-repo' } = {}) {
  const s = STARTS[start] ?? STARTS.young;
  const day0 = Math.floor(Date.now() / DAY) * DAY;
  return {
    v: 1,
    start,
    fullName,
    day0,
    day: 0,
    createdAt: iso(day0 - s.age * DAY),
    baseCommits: s.base,
    commits: s.recent.map((d, i) => ({ date: iso(day0 - d * DAY + 10 * 3_600_000), author: PEOPLE[i % Math.min(s.contributors, 3)] })),
    lastBase: iso(day0 - s.last * DAY),
    added: 0,
    release: s.release ? { tag: 'v1.0.0', publishedAt: iso(day0 - s.release * DAY) } : null,
    releases: s.release ? 1 : 0,
    merged: [],
    prSeq: 40,
    state: null,
    diary: null,
    unlockAll: false,
    today: { ...DEFAULT_TODAY, stars: s.stars, community: s.community, ci: s.ci, authors: 1, commits: start === 'egg' ? 1 : 2 },
    contributors: s.contributors,
    log: [],
  };
}

// Starts the simulator from a real repo the visitor just hatched: same age, commits,
// CI, issues, stars and community profile, and the days that follow are made up.
export function worldFromSnapshot(snapshot) {
  const w = newWorld({ start: 'young', fullName: snapshot.repo.fullName });
  const recent = snapshot.commits.recent ?? [];
  w.createdAt = snapshot.repo.createdAt;
  w.baseCommits = Math.max(0, (snapshot.commits.total ?? recent.length) - recent.length);
  w.commits = recent.filter((c) => Date.parse(c.date) < w.day0).map((c) => ({ date: c.date, author: c.author ?? 'you' }));
  w.lastBase = snapshot.commits.lastDate ?? snapshot.repo.pushedAt ?? w.createdAt;
  w.release = snapshot.release;
  w.releases = snapshot.release ? 1 : 0;
  w.merged = (snapshot.treats ?? []).map((m) => ({ user: m.user, number: m.number, mergedAt: m.mergedAt }));
  w.contributors = snapshot.contributors?.total ?? 1;
  const issues = snapshot.issues;
  w.today = {
    ...DEFAULT_TODAY,
    commits: 0,
    ci: ['passing', 'failing'].includes(snapshot.ci?.state) ? snapshot.ci.state : 'unknown',
    waiting: Math.min(5, issues?.unanswered.length ?? 0),
    stale: Math.min(10, (issues?.stale ?? 0) + (issues?.stalePRs ?? 0)),
    stars: snapshot.repo.stars ?? 0,
    community: snapshot.community?.health ?? 50,
    archived: Boolean(snapshot.repo.archived),
  };
  return w;
}

export const nowOf =(w, day = w.day) => new Date(w.day0 + day * DAY + 18 * 3_600_000);

function todaysCommits(w, now) {
  const t = w.today;
  return Array.from({ length: t.commits }, (_, i) => ({
    date: iso(now.getTime() - (8 - (i % 8)) * 3_600_000 - i * 60_000),
    author: PEOPLE[i % Math.max(1, t.authors)],
  }));
}

// The repo as GitHub would report it at `now`, including what is planned for today.
export function snapshotOf(w, now = nowOf(w)) {
  const t = w.today;
  const cutoff = now.getTime() - 90 * DAY;
  const recent = [...w.commits, ...todaysCommits(w, now)]
    .filter((c) => Date.parse(c.date) >= cutoff)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .map((c, i) => ({ sha: `sim${i}`, date: c.date, author: c.author, bot: false }));
  const lastDate = recent[0]?.date ?? w.lastBase;
  const release = t.release ? { tag: `v1.${w.releases}.0`, name: `v1.${w.releases}.0`, publishedAt: iso(now.getTime() - 2 * 3_600_000) } : w.release;
  const merged = [
    ...Array.from({ length: t.merged }, (_, i) => ({ user: PEOPLE[(i + 1) % PEOPLE.length], number: w.prSeq + i + 1, mergedAt: iso(now.getTime() - (3 + i) * 3_600_000) })),
    ...w.merged,
  ].filter((m) => now.getTime() - Date.parse(m.mergedAt) <= 14 * DAY);
  const [owner, name] = w.fullName.split('/');
  return {
    repo: {
      owner, name, fullName: w.fullName, defaultBranch: 'main', archived: Boolean(t.archived), isPrivate: false,
      stars: t.stars, forks: Math.floor(t.stars / 8), language: null, createdAt: w.createdAt, pushedAt: lastDate,
    },
    commits: { total: w.baseCommits + w.added + t.commits, lastDate, recent },
    ci: t.ci === 'unknown'
      ? { state: 'unknown', total: 0, failing: 0, failingNames: [] }
      : { state: t.ci, total: 3, failing: t.ci === 'failing' ? 1 : 0, failingNames: t.ci === 'failing' ? ['test'] : [] },
    issues: {
      open: t.waiting + t.stale + 2,
      stale: t.stale,
      openPRs: 1,
      stalePRs: 0,
      unanswered: Array.from({ length: Math.min(5, t.waiting) }, (_, i) => ({ number: 12 + i * 3, days: 8 + i * 6 })),
    },
    release,
    community: { health: t.community },
    contributors: { total: Math.max(w.contributors, t.authors) },
    treats: merged.map((m) => ({ ...m, title: 'A pull request', external: m.user !== 'you' })),
    warnings: [],
    fetchedAt: now.toISOString(),
  };
}

// One run of the action. `persist` keeps the result in pet.json and the diary.
export function run(w, { options = {}, persist = false } = {}) {
  const now = nowOf(w);
  const snapshot = snapshotOf(w, now);
  const pet = buildPet({ snapshot, prevState: w.state, now, options: { ...options, unlockAll: w.unlockAll || undefined } });
  if (persist) {
    w.state = nextState(pet, w.state);
    w.diary = updateDiary(w.diary, pet, snapshot);
  }
  return { pet, snapshot };
}

// Ends today: the last run of the day is remembered, then the calendar moves on.
// Today's plan becomes tomorrow's default, except one-off things like a release.
export function nextDay(w, options) {
  const result = run(w, { options, persist: true });
  const now = nowOf(w);
  const t = w.today;
  w.commits.push(...todaysCommits(w, now));
  w.commits = w.commits.filter((c) => now.getTime() - Date.parse(c.date) <= 92 * DAY);
  w.added += t.commits;
  w.contributors = Math.max(w.contributors, t.authors);
  for (let i = 0; i < t.merged; i++) {
    w.prSeq += 1;
    w.merged.unshift({ user: PEOPLE[(i + 1) % PEOPLE.length], number: w.prSeq, mergedAt: iso(now.getTime() - (3 + i) * 3_600_000) });
  }
  w.merged = w.merged.filter((m) => now.getTime() - Date.parse(m.mergedAt) <= 15 * DAY);
  if (t.release) {
    w.release = { tag: `v1.${w.releases}.0`, name: `v1.${w.releases}.0`, publishedAt: iso(now.getTime() - 2 * 3_600_000) };
    w.releases += 1;
  }
  w.day += 1;
  w.today = { ...t, release: false, merged: 0 };
  return result;
}

// Autoplay habits: what a certain kind of maintainer does on a given day.
export const HABITS = {
  diligent: (r, t) => ({
    commits: r.next() < 0.8 ? r.int(1, 4) : 0, authors: 1, ci: r.next() < 0.95 ? 'passing' : 'failing',
    merged: r.next() < 0.3 ? 1 : 0, waiting: 0, stale: Math.max(0, t.stale - 1), release: r.next() < 0.05,
    stars: t.stars + r.int(0, 3), community: Math.min(100, t.community + (r.next() < 0.1 ? 10 : 0)),
  }),
  community: (r, t) => ({
    commits: r.int(2, 6), authors: r.int(2, 4), ci: r.next() < 0.9 ? 'passing' : 'failing',
    merged: r.int(0, 2), waiting: r.next() < 0.2 ? 1 : 0, stale: 0, release: r.next() < 0.04,
    stars: t.stars + r.int(1, 8), community: Math.min(100, t.community + 2),
  }),
  busy: (r, t) => {
    const on = r.next() < 0.45;
    return {
      commits: on ? r.int(3, 9) : 0, authors: on ? r.int(1, 2) : 1, ci: r.next() < 0.8 ? 'passing' : 'failing',
      merged: on && r.next() < 0.4 ? 1 : 0, waiting: Math.max(0, Math.min(5, t.waiting + (on ? -1 : r.int(0, 1)))),
      stale: Math.max(0, Math.min(10, t.stale + (on ? -1 : 1))), release: on && r.next() < 0.06, stars: t.stars + r.int(0, 2),
    };
  },
  redci: (r, t) => ({ commits: r.int(1, 3), authors: 1, ci: r.next() < 0.8 ? 'failing' : 'passing', merged: 0, stars: t.stars }),
  neglect: (r, t) => ({
    commits: 0, merged: 0, release: false, waiting: Math.min(5, t.waiting + (r.next() < 0.35 ? 1 : 0)),
    stale: Math.min(10, t.stale + (r.next() < 0.5 ? 1 : 0)), stars: t.stars,
  }),
};

export function planDay(w, habit) {
  const r = createRng(`${w.fullName}|${w.day}|${habit}`);
  w.today = { ...w.today, ...HABITS[habit](r, w.today) };
}
