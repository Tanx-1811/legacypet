import { MOOD_EMOJI } from '../engine/mood.js';
import { strings } from '../i18n/index.js';
import { hashString } from '../util/rng.js';
import { escapeXml as esc, textWidth, truncate } from '../util/text.js';
import { composePet } from './compose.js';
import { bboxOf, rectsFromPixels } from './pixels.js';
import { FONT } from './theme.js';

export const BADGE_COLORS = {
  ecstatic: '#2ea043', happy: '#3fb950', party: '#bf3989', hungry: '#bf8700', sleepy: '#6e7681',
  sad: '#4c6ef5', sick: '#d1242f', zombie: '#6e5494', hibernating: '#3b5bdb', egg: '#8c959f',
};
const CHAR = 6.6;

// A shields.io-style badge with a 16px version of the pet on the left.
export function renderBadge(pet) {
  const tr = strings(pet.lang);
  const uid = `lp${hashString(`${pet.repo.fullName}|badge`).toString(36)}`;
  const left = truncate(pet.name, 16);
  const right = `${MOOD_EMOJI[pet.mood]} ${tr.moods[pet.mood]} · ${pet.rank.emoji} ${tr.level(pet.level)}`;
  const comp = composePet(pet, { hd: false });
  const pixels = [...comp.base, ...comp.eyesOpen];
  const box = bboxOf(pixels);
  const sw = box.maxX - box.minX + 1;
  const sh = box.maxY - box.minY + 1;
  const lw = Math.round(5 + sw + 5 + textWidth(left) * CHAR + 7);
  const rw = Math.round(7 + textWidth(right) * CHAR + 7);
  const width = lw + rw;
  const label = `${pet.name}: ${tr.moods[pet.mood]}, ${tr.level(pet.level)}`;
  const text = (tx, value) => `<text x="${tx}" y="15" fill="#010101" fill-opacity=".3">${esc(value)}</text><text x="${tx}" y="14">${esc(value)}</text>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" viewBox="0 0 ${width} 20" role="img" aria-label="${esc(label)}">`,
    `<title>${esc(label)}</title>`,
    `<linearGradient id="${uid}-s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>`,
    `<clipPath id="${uid}-r"><rect width="${width}" height="20" rx="3"/></clipPath>`,
    `<g clip-path="url(#${uid}-r)">`,
    `<rect width="${lw}" height="20" fill="#2f343b"/><rect x="${lw}" width="${rw}" height="20" fill="${BADGE_COLORS[pet.mood]}"/>`,
    `<rect width="${width}" height="20" fill="url(#${uid}-s)"/></g>`,
    `<g shape-rendering="crispEdges">${rectsFromPixels(pixels, 1, 5 - box.minX, Math.round((20 - sh) / 2) - box.minY)}</g>`,
    `<g fill="#fff" font-family="${FONT.replace(/"/g, "'")}" font-size="11">`,
    text(5 + sw + 5, left),
    text(lw + 7, right),
    '</g></svg>',
  ].join('');
}
