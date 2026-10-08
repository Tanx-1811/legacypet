import { createRng } from '../util/rng.js';
import { DAY, isoDay, utcDayIndex } from '../util/time.js';

// Weekly quests: three small goals a week, picked from what the repo really does and
// measured from real data. A finished quest stays finished for the rest of the week,
// earns a quest star (two more for finishing all three) and gives +5 joy until Monday.

export const QUESTS_PER_WEEK = 3;
export const QUEST_JOY = 5;
export const PERFECT_BONUS = 2;
const HAPPY = new Set(['happy', 'ecstatic', 'party']);

// Weeks start on Monday (UTC). The week's id is that Monday's date.
export function weekOf(now) {
  const day = utcDayIndex(now);
  const monday = day - ((new Date(day * DAY).getUTCDay() + 6) % 7);
  return { id: isoDay(monday * DAY), start: monday * DAY, end: (monday + 7) * DAY };
}

const thisWeek = (c, date) => Date.parse(date) >= c.week.start;
const commitsThisWeek = (c) => (c.snapshot.commits?.recent ?? []).filter((x) => thisWeek(c, x.date));
const daysThisWeek = (c, test) => {
  const days = new Set(c.history.filter((h) => Date.parse(h.date) >= c.week.start && test(h)).map((h) => h.date));
  if (c.today && test(c.today)) days.add(c.today.date);
  return days.size;
};

// `goal` is how far progress has to go; `eligible` keeps quests a repo can't do out of its week.
export const QUESTS = [
  {
    id: 'feast', emoji: '🍱', goal: 3,
    progress: (c) => new Set(commitsThisWeek(c).map((x) => isoDay(x.date))).size,
  },
  {
    id: 'marathon', emoji: '🏃', goal: 10,
    progress: (c) => commitsThisWeek(c).length,
  },
  {
    id: 'doctor', emoji: '🩺', goal: 4,
    eligible: (c) => c.snapshot.ci && c.snapshot.ci.state !== 'unknown',
    progress: (c) => daysThisWeek(c, (h) => (h.vitals?.[1] ?? 0) >= 85),
  },
  {
    id: 'replies', emoji: '💌', goal: 1,
    eligible: (c) => (c.snapshot.issues?.open ?? 0) > 0,
    progress: (c) => (c.snapshot.issues && c.snapshot.issues.unanswered.length === 0 ? 1 : 0),
  },
  {
    id: 'merge', emoji: '🔀', goal: 2,
    eligible: (c) => (c.snapshot.treats?.length ?? 0) > 0 || (c.snapshot.issues?.openPRs ?? 0) > 0,
    progress: (c) => (c.snapshot.treats ?? []).filter((t) => thisWeek(c, t.mergedAt)).length,
  },
  {
    id: 'ship', emoji: '🚀', goal: 1,
    eligible: (c) => Boolean(c.snapshot.release),
    progress: (c) => (c.snapshot.release && thisWeek(c, c.snapshot.release.publishedAt) ? 1 : 0),
  },
  {
    id: 'squad', emoji: '🤝', goal: 2,
    eligible: (c) => (c.snapshot.contributors?.total ?? 0) >= 2,
    progress: (c) => new Set(commitsThisWeek(c).filter((x) => !x.bot && x.author).map((x) => x.author)).size,
  },
  {
    id: 'sunny', emoji: '🌞', goal: 3,
    progress: (c) => daysThisWeek(c, (h) => HAPPY.has(h.mood)),
  },
  {
    id: 'tidy', emoji: '🧹', goal: 1,
    eligible: (c) => Boolean(c.snapshot.issues) && (c.snapshot.issues.open + c.snapshot.issues.openPRs) > 0,
    progress: (c) => (c.snapshot.issues && c.snapshot.issues.stale + c.snapshot.issues.stalePRs === 0 ? 1 : 0),
  },
];
export const QUEST_IDS = QUESTS.map((q) => q.id);
const byId = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

// The week's three quests stay the same all week, even if a quest stops being eligible.
function pickQuests(c, fullName) {
  const pool = QUESTS.filter((q) => !q.eligible || q.eligible(c));
  const rng = createRng(`${fullName}|${c.week.id}|quests`);
  const picked = [];
  while (picked.length < QUESTS_PER_WEEK && pool.length) picked.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0].id);
  return picked;
}

// Joy from quests finished on earlier runs this week. Applied before the mood is chosen,
// so a fresh completion pays off from the next run on.
export function questJoy(prev, now) {
  if (!prev || prev.week !== weekOf(now).id) return 0;
  return Object.keys(prev.done ?? {}).length * QUEST_JOY;
}

// prev: last run's `quests` from pet.json. today: { date, mood, vitals: [fullness, health, joy, energy] }.
export function evaluateQuests({ snapshot, history = [], today, prev = null, stars = 0, fullName, now, ids }) {
  const week = weekOf(now);
  const c = { snapshot, history, today, week };
  const sameWeek = prev?.week === week.id;
  const chosen = ids ?? (sameWeek && prev.ids?.length ? prev.ids.filter((id) => byId[id]) : pickQuests(c, fullName));
  const done = sameWeek ? { ...prev.done } : {};
  const fresh = [];
  const list = chosen.map((id) => {
    const quest = byId[id];
    const value = Math.min(quest.goal, Math.max(0, quest.progress(c) ?? 0));
    if (!done[id] && value >= quest.goal) {
      done[id] = today.date;
      fresh.push(id);
    }
    return { id, emoji: quest.emoji, goal: quest.goal, progress: done[id] ? quest.goal : value, done: Boolean(done[id]), isNew: fresh.includes(id) };
  });
  const completed = list.filter((q) => q.done).length;
  const perfect = completed === list.length && list.length > 0;
  const wasPerfect = sameWeek && chosen.every((id) => prev.done?.[id]);
  const earned = fresh.length + (perfect && !wasPerfect ? PERFECT_BONUS : 0);
  return {
    week: week.id,
    ends: isoDay(week.end - DAY),
    ids: chosen,
    done,
    list,
    completed,
    perfect,
    fresh,
    stars: stars + earned,
    earned,
  };
}
