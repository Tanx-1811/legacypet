import { dayOfYear, daysBetween, isoDay, toDate } from '../util/time.js';

// Lunar New Year (Tết) has no simple formula, so the next decade is listed by hand.
const LUNAR_NEW_YEAR = [
  '2026-02-17', '2027-02-06', '2028-01-26', '2029-02-13', '2030-02-03',
  '2031-01-23', '2032-02-11', '2033-01-31', '2034-02-19', '2035-02-08',
];

export const PARTY_HOLIDAYS = new Set(['newyear', 'tet', 'programmers']);

export function holidayFor(now) {
  const d = toDate(now);
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const today = isoDay(d);
  if (LUNAR_NEW_YEAR.some((start) => { const n = daysBetween(start, today); return n >= 0 && n < 3; })) return 'tet';
  if (month === 10 && day === 31) return 'halloween';
  if (month === 12 && day >= 24 && day <= 26) return 'christmas';
  if ((month === 12 && day === 31) || (month === 1 && day === 1)) return 'newyear';
  if (dayOfYear(d) === 256) return 'programmers';
  return null;
}

export function seasonFor(now) {
  const month = toDate(now).getUTCMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

export function isBirthday(createdAt, now) {
  const born = toDate(createdAt);
  const d = toDate(now);
  return d.getUTCFullYear() > born.getUTCFullYear()
    && d.getUTCMonth() === born.getUTCMonth()
    && d.getUTCDate() === born.getUTCDate();
}
