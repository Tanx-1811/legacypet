export const DAY = 86_400_000;

export const toDate = (value) => (value instanceof Date ? value : new Date(value));

export const daysBetween = (from, to) => (toDate(to).getTime() - toDate(from).getTime()) / DAY;

export const isoDay = (value) => toDate(value).toISOString().slice(0, 10);

export const utcDayIndex = (value) => Math.floor(toDate(value).getTime() / DAY);

export function dayOfYear(value) {
  const d = toDate(value);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / DAY);
}
