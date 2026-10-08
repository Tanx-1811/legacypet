import { MOOD_EMOJI } from '../engine/mood.js';
import { strings } from '../i18n/index.js';
import { hashString } from '../util/rng.js';
import { escapeXml as esc, textWidth, truncate, wrapText } from '../util/text.js';
import { renderScene } from './scene.js';
import { homeOf } from './scenery.js';
import { buildCss } from './theme.js';

const W = 520;
const H = 256;
const X = 228;
const R = 508;
const STATS = [['fullness', '🍖'], ['health', '❤️'], ['joy', '😊'], ['energy', '⚡'], ['hygiene', '🧼']];

export const uidFor = (pet, variant) => `lp${hashString(`${pet.repo.fullName}|${pet.mood}|${variant}`).toString(36)}`;

export function describe(pet) {
  const tr = strings(pet.lang);
  const v = pet.vitals;
  const vitals = STATS.filter(([key]) => v[key] != null).map(([key]) => `${tr.stats[key]} ${v[key]}%`).join(', ');
  return `${pet.displayName}: ${tr.level(pet.level)} (${tr.ranks[pet.rank.id]}) ${tr.kind(tr.stages[pet.stage], tr.species[pet.speciesId])}, ${tr.moods[pet.mood]}. ${vitals}. “${pet.speech}”`;
}

function subline(pet, tr) {
  const parts = [`${pet.rank.emoji} ${tr.level(pet.level)}`, tr.kind(tr.stages[pet.stage], tr.species[pet.speciesId])];
  if (pet.shiny) parts.push(`✨ ${tr.shiny}`);
  if (pet.path) parts.push(`${pet.path.emoji} ${tr.paths[pet.path.id]}`);
  const withTrait = [...parts, tr.traits[pet.species.trait]].join(' · ');
  return textWidth(withTrait) <= 42 ? withTrait : truncate(parts.join(' · '), 42);
}

function bubble(pet) {
  const by = 68;
  const bh = 46;
  const lines = wrapText(pet.speech, 36, 2);
  let out = `<rect x="${X}" y="${by}" width="${R - X}" height="${bh}" rx="9" class="lp-bubble"/>`;
  out += `<path d="M${X + 1} ${by + 15} L${X - 9} ${by + 22} L${X + 1} ${by + 29}" class="lp-tail"/>`;
  const ys = lines.length === 1 ? [by + 27] : [by + 19, by + 36];
  lines.forEach((line, i) => {
    out += `<text x="${X + 11}" y="${ys[i]}" class="lp-say">${esc(line)}</text>`;
  });
  return out;
}

function stats(pet, tr) {
  let out = '';
  let y = 134;
  for (const [key, icon] of STATS) {
    const value = pet.vitals[key];
    if (value == null) continue;
    const level = value >= 60 ? 'lp-good' : value >= 30 ? 'lp-mid' : 'lp-low';
    const filled = Math.round(value / 10);
    out += `<text x="${X}" y="${y}" class="lp-icon">${icon}</text>`;
    out += `<text x="${X + 18}" y="${y}" class="lp-label">${esc(tr.stats[key])}</text>`;
    for (let i = 0; i < 10; i++) {
      out += `<rect x="${340 + i * 13}" y="${y - 9}" width="11" height="9" rx="1.5" class="${i < filled ? level : 'lp-seg'}"/>`;
    }
    out += `<text x="${R}" y="${y}" text-anchor="end" class="lp-val${value < 30 ? ' lp-alert' : ''}">${value}</text>`;
    y += 17;
  }
  return out;
}

// The trophy shelf, and on the right this week's quests and the pet's quest stars.
function trophies(pet, tr) {
  const q = pet.quests;
  const quest = q?.list.length && pet.mood !== 'egg' && pet.mood !== 'hibernating'
    ? `<text x="${R}" y="228" text-anchor="end" class="lp-quest">📜 ${q.completed}/${q.list.length} · ⭐ ${pet.questStars ?? 0}</text>`
    : '';
  if (!pet.achievements.length) return `<text x="${X}" y="226" class="lp-foot">${esc(tr.noAchievements)}</text>${quest}`;
  const max = quest ? 8 : 12;
  // When the shelf is full, keep the newest trophies on it (in their usual order).
  const newest = [...pet.achievements]
    .sort((a, b) => Number(b.isNew) - Number(a.isNew) || String(b.unlockedAt).localeCompare(String(a.unlockedAt)))
    .slice(0, max - 1)
    .map((a) => a.id);
  const shown = pet.achievements.length > max ? pet.achievements.filter((a) => newest.includes(a.id)) : pet.achievements;
  const more = pet.achievements.length - shown.length;
  return shown
    .map((a, i) => `<text x="${X + i * 23}" y="228" class="lp-trophy${a.isNew ? ' lp-new' : ''}">${a.emoji}</text>`)
    .join('')
    + (more ? `<text x="${X + shown.length * 23 + 2}" y="226" class="lp-more">+${more}</text>` : '')
    + quest;
}

export function renderCard(pet, { theme = 'auto' } = {}) {
  const tr = strings(pet.lang);
  const uid = uidFor(pet, 'card');
  const scene = renderScene(pet, { x: 10, y: 10, w: 200, h: H - 20, uid, variant: 'card' });
  const fed = tr.fed(pet.facts.daysSinceCommit);
  const footer = `${truncate(pet.repo.fullName, Math.max(10, 38 - textWidth(fed) - 3))} · ${fed}`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${uid}-t ${uid}-d">`,
    `<title id="${uid}-t">${esc(`${pet.displayName} ${MOOD_EMOJI[pet.mood]} ${pet.repo.fullName}`)}</title>`,
    `<desc id="${uid}-d">${esc(describe(pet))}</desc>`,
    `<style>${buildCss({ theme, mood: pet.mood, home: homeOf(pet) })}</style>`,
    `<defs>${scene.defs}</defs>`,
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" class="lp-card"/>`,
    scene.body,
    `<text x="${X}" y="34" class="lp-name">${esc(truncate(pet.displayName, 28))}</text>`,
    `<text x="${X}" y="52" class="lp-sub">${esc(subline(pet, tr))}</text>`,
    `<rect x="${X}" y="58" width="${R - X}" height="3" rx="1.5" class="lp-track"/>`,
    `<rect x="${X}" y="58" width="${Math.max(3, Math.round((R - X) * pet.xp))}" height="3" rx="1.5" class="lp-xp" style="fill:${pet.rank.color}"/>`,
    bubble(pet),
    stats(pet, tr),
    trophies(pet, tr),
    `<text x="${X}" y="246" class="lp-foot">${esc(footer)}</text>`,
    `<text x="${R}" y="246" text-anchor="end" class="lp-brand">🐾 legacypet</text>`,
    '</svg>',
  ].join('');
}
