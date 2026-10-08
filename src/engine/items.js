// The wardrobe: items a pet unlocks by playing the game (trophies, quest stars, friends)
// and its maintainer dresses it in, with the `wear` input or `/pet wear <item>`.
// One item per slot. Hats that say something (a party hat, an ice pack when sick, a
// nightcap) still win over a worn hat for that day, and so do vacation shades.

export const SLOTS = ['hat', 'face', 'pal'];

// unlock: { achievement } | { stars } (quest stars) | { friends } (pats, snacks and games) | {} (free)
export const ITEMS = [
  { id: 'cap', slot: 'hat', emoji: '🧢', unlock: {} },
  { id: 'bow', slot: 'hat', emoji: '🎀', unlock: { stars: 3 } },
  { id: 'beanie', slot: 'hat', emoji: '🧶', unlock: { achievement: 'streak7' } },
  { id: 'headphones', slot: 'hat', emoji: '🎧', unlock: { achievement: 'centurion' } },
  { id: 'halo', slot: 'hat', emoji: '😇', unlock: { achievement: 'lazarus' } },
  { id: 'tiara', slot: 'hat', emoji: '💎', unlock: { achievement: 'stars100' } },
  { id: 'wizard', slot: 'hat', emoji: '🧙', unlock: { achievement: 'master' } },
  { id: 'crown', slot: 'hat', emoji: '👑', unlock: { achievement: 'stars1k' } },
  { id: 'glasses', slot: 'face', emoji: '👓', unlock: { achievement: 'spotless' } },
  { id: 'shades', slot: 'face', emoji: '🕶️', unlock: { achievement: 'shipper' } },
  { id: 'monocle', slot: 'face', emoji: '🧐', unlock: { achievement: 'elder' } },
  { id: 'chick', slot: 'pal', emoji: '🐤', unlock: { friends: 5 } },
  { id: 'bird', slot: 'pal', emoji: '🐦', unlock: { stars: 1 } },
  { id: 'butterfly', slot: 'pal', emoji: '🦋', unlock: { stars: 10 } },
  { id: 'ghost', slot: 'pal', emoji: '👻', unlock: { achievement: 'lazarus' } },
  { id: 'drone', slot: 'pal', emoji: '🛸', unlock: { stars: 25 } },
];
export const ITEM_IDS = ITEMS.map((i) => i.id);
export const itemById = (id) => ITEMS.find((i) => i.id === id) ?? null;

export function isUnlocked(item, { achievements = {}, stars = 0, friends = 0 } = {}) {
  const u = item.unlock;
  if (u.achievement) return Boolean(achievements[u.achievement]);
  if (u.stars) return stars >= u.stars;
  if (u.friends) return friends >= u.friends;
  return true;
}

export const unlockedItems = (progress) => ITEMS.filter((i) => isUnlocked(i, progress)).map((i) => i.id);

// "cap, bird" → ['cap', 'bird']. "none" clears everything.
export function parseWear(spec) {
  if (spec == null) return null;
  const words = String(spec).toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (words.includes('none') || words.includes('off')) return [];
  return words;
}

// What the pet ends up wearing: one item per slot, only unlocked ones (unless `all`, for previews).
// Returns { worn, rejected } where rejected lists [id, 'unknown' | 'locked'].
export function resolveWear(requested, progress, { all = false } = {}) {
  const worn = {};
  const rejected = [];
  for (const id of requested ?? []) {
    const item = itemById(id);
    if (!item) rejected.push([id, 'unknown']);
    else if (!all && !isUnlocked(item, progress)) rejected.push([id, 'locked']);
    else worn[item.slot] = item.id;
  }
  return { worn: SLOTS.map((s) => worn[s]).filter(Boolean), rejected };
}

// `/pet wear bird` puts one more item on, replacing whatever was in that slot; a locked
// or unknown item leaves the slot as it was (resolveWear keeps the last valid item per slot).
// `/pet wear none` takes everything off.
export function wearCommand(current = [], arg) {
  const words = parseWear(arg) ?? [];
  return words.length ? [...(current ?? []), ...words] : [];
}
