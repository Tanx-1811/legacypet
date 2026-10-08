// Snacks, games and pats from `/pet feed`, `/pet play` and `/pet pat`. Commits stay the real
// food: a snack is a small top-up for the day. Each person can do each thing once a day,
// and the day's boost is capped, so a comment storm can't keep a neglected pet alive.

export const CARE_ACTIONS = ['feed', 'play', 'pat'];
export const SNACK = 4;
export const DAILY_CAP = 12;
const MAX_FRIENDS = 30;

const fresh = (date) => ({ day: date, feed: [], play: [], pat: [] });

// prev: last run's `care` from pet.json. action: { name: 'feed' | 'play' | 'pat', user }.
// result.outcome: 'ok' | 'again' (already did it today) | 'cant' (eggs, zombies and sleepers can't eat or play).
export function applyCare({ prev = null, action = null, date, mood }) {
  const today = prev?.day === date ? { ...fresh(date), ...prev.today } : fresh(date);
  const care = {
    day: date,
    today: { feed: [...today.feed], play: [...today.play], pat: [...today.pat] },
    total: prev?.total ?? 0,
    friends: { ...(prev?.friends ?? {}) },
  };
  let outcome = null;
  if (action && CARE_ACTIONS.includes(action.name)) {
    const user = String(action.user ?? 'someone');
    const resting = mood === 'egg' || mood === 'zombie' || mood === 'hibernating';
    if (resting && action.name !== 'pat') outcome = 'cant';
    else if (care.today[action.name].includes(user)) outcome = 'again';
    else {
      outcome = 'ok';
      care.today[action.name].push(user);
      care.total += 1;
      care.friends[user] = (care.friends[user] ?? 0) + 1;
      const top = Object.entries(care.friends).sort((a, b) => b[1] - a[1]).slice(0, MAX_FRIENDS);
      care.friends = Object.fromEntries(top);
    }
  }
  return { care, outcome };
}

// The day's boost: snacks fill the bowl, games give energy and joy.
export function careBonus(care, date) {
  if (!care || care.day !== date) return { fullness: 0, energy: 0, joy: 0 };
  const cap = (n) => Math.min(DAILY_CAP, n * SNACK);
  const games = cap(care.today.play.length);
  return { fullness: cap(care.today.feed.length), energy: games, joy: Math.min(DAILY_CAP, games + care.today.pat.length * 2) };
}

export const friendCount = (care) => care?.total ?? 0;

export const topFriends = (care, n = 3) => Object.entries(care?.friends ?? {}).sort((a, b) => b[1] - a[1]).slice(0, n);
