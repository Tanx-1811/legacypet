import { MOOD_EMOJI } from '../engine/mood.js';
import { strings } from '../i18n/index.js';
import * as A from '../sprites/accessories.js';
import { createRng, hashString } from '../util/rng.js';
import { escapeXml as esc, truncate } from '../util/text.js';
import { stamp } from './pixels.js';
import { backdrop, renderActor, skyDefs } from './scene.js';
import { buildCss } from './theme.js';

export const PARK_MAX = 8;
const W = 840;
const H = 280;
const NEEDS_CARE = new Set(['hungry', 'sad', 'sick', 'zombie']);
const PX = { egg: 4, baby: 4, adult: 5, elder: 5 };

export function parkSummary(pets) {
  const vitals = pets.flatMap((p) => [p.vitals.fullness, p.vitals.health, p.vitals.joy, p.vitals.energy]);
  return {
    health: vitals.length ? Math.round(vitals.reduce((a, b) => a + b, 0) / vitals.length) : 0,
    needCare: pets.filter((p) => NEEDS_CARE.has(p.mood)).map((p) => p.repo.fullName),
  };
}

// Every pet from a profile in one meadow, each with a little name sign.
export function renderPark(pets, { owner, lang = 'en', theme = 'auto' } = {}) {
  if (!pets.length) throw new Error('A park needs at least one pet');
  const list = pets.slice(0, PARK_MAX);
  const tr = strings(lang);
  const uid = `lp${hashString(`park|${owner}|${list.map((p) => p.repo.fullName).join(',')}`).toString(36)}`;
  const x = 10;
  const y = 10;
  const w = W - 20;
  const h = H - 20;
  const groundH = 82;
  const groundY = y + h - groundH;
  const footY = groundY + 12;
  const rng = createRng(`park|${owner}|${list[0].date}`);
  const scenery = { mood: 'happy', season: list[0].season, holiday: list[0].holiday, species: {}, repo: { fullName: `${owner}/park` } };
  const s = { pet: scenery, rng, x, y, w, h, groundY, groundH, mini: false, pp: 3 };
  const slot = (w - 40) / list.length;
  const tagW = Math.min(slot - 12, 124);
  const cols = Math.floor((tagW - 10) / 6.6);

  let behind = '';
  let actors = '';
  let tags = '';
  list.forEach((pet, i) => {
    const cx = Math.round(x + 20 + slot * (i + 0.5));
    const actor = renderActor(pet, {
      rng, x: cx - slot / 2, y, w: slot, h, groundY, groundH, mini: true, cx, footY, px: PX[pet.stage] ?? 5,
    });
    if (pet.mood === 'zombie') {
      behind += stamp(A.TOMBSTONE.rows, A.TOMBSTONE.colors, 2, cx - actor.s.bw / 2 - 10, footY - 18);
    }
    actors += actor.body;
    const tx = Math.round(cx - tagW / 2);
    const ty = groundY + 30;
    tags += `<rect x="${tx}" y="${ty}" width="${Math.round(tagW)}" height="36" rx="8" class="lp-bubble"/>`;
    tags += `<text x="${cx}" y="${ty + 15}" text-anchor="middle" class="lp-tag">${esc(truncate(`${MOOD_EMOJI[pet.mood]} ${pet.name} ${tr.level(pet.level)}`, cols))}</text>`;
    tags += `<text x="${cx}" y="${ty + 29}" text-anchor="middle" class="lp-tag-sub">${esc(truncate(pet.repo.name, cols + 2))}</text>`;
  });

  const summary = parkSummary(list);
  const title = `🏞️ ${tr.park.title(owner)}`;
  const sub = tr.park.summary(list.length, summary.health, summary.needCare.length);
  const desc = list.map((p) => `${p.name} (${p.repo.name}, ${tr.moods[p.mood]}, ${tr.level(p.level)})`).join('; ');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${uid}-t ${uid}-d">`,
    `<title id="${uid}-t">${esc(title)}</title>`,
    `<desc id="${uid}-d">${esc(`${sub}. ${desc}`)}</desc>`,
    `<style>${buildCss({ theme, mood: 'happy' })}</style>`,
    `<defs>${skyDefs(uid, { x, y, w, h, rx: 10 })}</defs>`,
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" class="lp-card"/>`,
    `<g clip-path="url(#${uid}-clip)">`,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${uid}-sky)"/>`,
    backdrop.sky(s),
    backdrop.holidaySky(s),
    backdrop.ground(s),
    behind ? `<g class="lp-px">${behind}</g>` : '',
    actors,
    tags,
    backdrop.weather(s),
    `<text x="${x + 16}" y="${y + 26}" class="lp-name">${esc(truncate(title, 60))}</text>`,
    `<text x="${x + 16}" y="${y + 44}" class="lp-sub">${esc(sub)}</text>`,
    '</g>',
    '</svg>',
  ].join('');
}
