import { MOOD_EMOJI } from '../engine/mood.js';
import { strings } from '../i18n/index.js';
import { escapeXml as esc, truncate } from '../util/text.js';
import { describe, uidFor } from './card.js';
import { renderScene } from './scene.js';
import { homeOf } from './scenery.js';
import { buildCss } from './theme.js';

const W = 160;
const H = 192;

// A compact version for profile READMEs, sidebars and "pet park" grids.
export function renderMini(pet, { theme = 'auto' } = {}) {
  const tr = strings(pet.lang);
  const uid = uidFor(pet, 'mini');
  const scene = renderScene(pet, { x: 6, y: 6, w: W - 12, h: 148, uid, variant: 'mini' });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${uid}-t ${uid}-d">`,
    `<title id="${uid}-t">${esc(`${pet.displayName} ${MOOD_EMOJI[pet.mood]} ${pet.repo.fullName}`)}</title>`,
    `<desc id="${uid}-d">${esc(describe(pet))}</desc>`,
    `<style>${buildCss({ theme, mood: pet.mood, home: homeOf(pet) })}</style>`,
    `<defs>${scene.defs}</defs>`,
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="16" class="lp-card"/>`,
    scene.body,
    `<text x="${W / 2}" y="171" text-anchor="middle" class="lp-mini-name">${esc(truncate(pet.name, 18))}</text>`,
    `<text x="${W / 2}" y="185" text-anchor="middle" class="lp-mini-sub">${esc(truncate(`${tr.level(pet.level)} · ${MOOD_EMOJI[pet.mood]} ${tr.moods[pet.mood]}`, 26))}</text>`,
    '</svg>',
  ].join('');
}
