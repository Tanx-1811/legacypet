import { DAY, isoDay, toDate } from '../util/time.js';

// Vacation mode: maintainers deserve time off. Days spent on vacation never count
// toward hunger (or the slow walk to zombiehood), and while away the pet relaxes on
// the beach instead of nagging about issues. Vacations are capped so a "vacation"
// can't hide an abandoned repo forever.
export const MAX_VACATION_DAYS = 60;
const KEEP = 6;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const addDays = (day, n) => isoDay(toDate(`${day}T00:00:00Z`).getTime() + n * DAY);

// The `vacation` input: "2026-12-20..2027-01-05", "until 2027-01-05" or just "2027-01-05".
export function parseVacation(spec) {
  const text = String(spec ?? '').trim().toLowerCase().replace(/^until\s+/, '');
  if (!text) return null;
  const [from, until] = text.includes('..') ? text.split('..').map((s) => s.trim()) : ['', text];
  if (!DATE.test(until) || (from && (!DATE.test(from) || from > until))) {
    throw new Error(`"vacation" must look like 2026-12-20..2027-01-05 or "until 2027-01-05", got "${spec}"`);
  }
  return { from: from || null, until };
}

// The last day a vacation really covers: its planned end, an early return, or the cap.
export function lastDay(v) {
  let end = v.until;
  if (v.ended && addDays(v.ended, -1) < end) end = addDays(v.ended, -1);
  const cap = addDays(v.from, MAX_VACATION_DAYS - 1);
  return cap < end ? cap : end;
}

export const activeVacation = (vacations, today) => vacations.find((v) => v.from <= today && today <= lastDay(v)) ?? null;

// Merges what pet.json remembers with the `vacation` input and any /pet vacation or /pet back command.
// `command` is { name: 'vacation', days } or { name: 'back' }.
export function resolveVacations({ previous = [], spec = null, command = null, today }) {
  let list = previous.map((v) => ({ ...v }));
  if (spec) {
    const known = list.find((v) => v.source === 'input' && v.until === spec.until);
    if (!known) {
      list = list.filter((v) => v.source !== 'input' || lastDay(v) < today);
      list.push({ from: spec.from ?? today, until: spec.until, source: 'input' });
    } else if (spec.from) known.from = spec.from;
  }
  if (command?.name === 'vacation') {
    const days = Math.max(1, Math.min(MAX_VACATION_DAYS, command.days ?? 7));
    list = list.filter((v) => !(v.from <= today && today <= lastDay(v)));
    list.push({ from: today, until: addDays(today, days - 1), source: 'command' });
  }
  if (command?.name === 'back') {
    for (const v of list) if (v.from <= today && today <= lastDay(v)) v.ended = today;
    list = list.filter((v) => v.from < today || !v.ended); // a same-day trip never happened
  }
  return list.sort((a, b) => (a.from < b.from ? -1 : 1)).slice(-KEEP);
}

// How many vacation days fall between the last commit and now: those don't make the pet hungry.
export function vacationDays(vacations, since, now) {
  const start = toDate(since).getTime();
  const end = toDate(now).getTime();
  let total = 0;
  for (const v of vacations) {
    const from = Math.max(start, toDate(`${v.from}T00:00:00Z`).getTime());
    const to = Math.min(end, toDate(`${lastDay(v)}T00:00:00Z`).getTime() + DAY);
    if (to > from) total += (to - from) / DAY;
  }
  return total;
}
