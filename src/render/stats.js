import { MOOD_EMOJI } from '../engine/mood.js';
import { VITALS } from '../engine/memory.js';
import { strings } from '../i18n/index.js';
import { hashString } from '../util/rng.js';
import { daysBetween } from '../util/time.js';
import { escapeXml as esc } from '../util/text.js';
import { chromeCss, FONT } from './theme.js';

const W = 520;
const H = 200;
const PLOT = { x: 34, y: 58, w: 470, h: 100 };
const COLORS = { fullness: '#f0883e', health: '#f85149', joy: '#e3b341', energy: '#58a6ff' };
const ICONS = { fullness: '🍖', health: '❤️', joy: '😊', energy: '⚡' };
const r1 = (v) => Math.round(v * 10) / 10;

const CSS = `
.lp-card{fill:var(--lp-bg);stroke:var(--lp-border)}
.lp-name{font:700 14px ${FONT};fill:var(--lp-text)}
.lp-label{font:400 10px ${FONT};fill:var(--lp-muted)}
.lp-grid{stroke:var(--lp-track);stroke-width:1}
.lp-emoji{font:400 10px ${FONT}}
.lp-line{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;animation:lp-draw 1.6s ease-out forwards}
.lp-dot{animation:lp-pop 1.6s ease-out both}
@keyframes lp-draw{to{stroke-dashoffset:0}}
@keyframes lp-pop{0%,80%{opacity:0}100%{opacity:1}}
@media (prefers-reduced-motion:reduce){.lp-line{animation:none;stroke-dashoffset:0}.lp-dot{animation:none}}
`.replace(/\n/g, '');

// A 30-day chart of the pet's vitals from pet.json's history, with the mood of each day underneath.
export function renderStats(pet, history = [], { theme = 'auto', days = 30 } = {}) {
  const tr = strings(pet.lang);
  const uid = `lp${hashString(`${pet.repo.fullName}|stats`).toString(36)}`;
  const recent = history.filter((h) => h.date > '' && daysBetween(h.date, pet.date) < days).sort((a, b) => (a.date < b.date ? -1 : 1));
  const points = recent.filter((h) => Array.isArray(h.vitals));
  const span = Math.max(1, days - 1);
  const xOf = (date) => PLOT.x + PLOT.w * (1 - daysBetween(date, pet.date) / span);
  const yOf = (v) => PLOT.y + PLOT.h * (1 - v / 100);
  const title = `📈 ${tr.chart.title(pet.name, days)}`;

  let body = '';
  for (const v of [0, 50, 100]) {
    body += `<line x1="${PLOT.x}" y1="${yOf(v)}" x2="${PLOT.x + PLOT.w}" y2="${yOf(v)}" class="lp-grid"/>`;
    body += `<text x="${PLOT.x - 6}" y="${yOf(v) + 3}" text-anchor="end" class="lp-label">${v}</text>`;
  }
  if (points.length < 2) {
    body += `<text x="${PLOT.x + PLOT.w / 2}" y="${PLOT.y + PLOT.h / 2}" text-anchor="middle" class="lp-label">${esc(tr.chart.empty)}</text>`;
  } else {
    VITALS.forEach((key, i) => {
      // Days without data (or a vital we couldn't read) break the line instead of drawing a lie.
      const runs = [[]];
      let prev = null;
      for (const h of points) {
        const value = h.vitals[i];
        if (value == null || (prev && daysBetween(prev, h.date) > 1.5)) runs.push([]);
        if (value != null) runs[runs.length - 1].push(`${r1(xOf(h.date))},${r1(yOf(value))}`);
        prev = h.date;
      }
      for (const run of runs.filter((r) => r.length > 1)) {
        body += `<polyline points="${run.join(' ')}" pathLength="1" stroke="${COLORS[key]}" class="lp-line" style="animation-delay:${i * 0.15}s"/>`;
      }
      const last = points[points.length - 1];
      if (last.vitals[i] != null) body += `<circle cx="${r1(xOf(last.date))}" cy="${r1(yOf(last.vitals[i]))}" r="3" fill="${COLORS[key]}" class="lp-dot"/>`;
    });
  }
  for (const h of recent) body += `<text x="${r1(xOf(h.date))}" y="${PLOT.y + PLOT.h + 18}" text-anchor="middle" class="lp-emoji">${MOOD_EMOJI[h.mood] ?? '·'}</text>`;
  if (recent.length) {
    body += `<text x="${PLOT.x}" y="${H - 12}" class="lp-label">${recent[0].date}</text>`;
    body += `<text x="${PLOT.x + PLOT.w}" y="${H - 12}" text-anchor="end" class="lp-label">${pet.date}</text>`;
  }
  const legend = VITALS.map((key, i) => {
    const x = 250 + i * 66;
    return `<rect x="${x}" y="27" width="8" height="8" rx="2" fill="${COLORS[key]}"/><text x="${x + 12}" y="35" class="lp-label">${ICONS[key]} ${esc(tr.stats[key])}</text>`;
  }).join('');
  const desc = points.length
    ? VITALS.map((key, i) => `${tr.stats[key]} ${points[0].vitals[i] ?? '?'}→${points[points.length - 1].vitals[i] ?? '?'}`).join(', ')
    : tr.chart.empty;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${uid}-t ${uid}-d">`,
    `<title id="${uid}-t">${esc(title)}</title>`,
    `<desc id="${uid}-d">${esc(desc)}</desc>`,
    `<style>${chromeCss(theme)}${CSS}</style>`,
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" class="lp-card"/>`,
    `<text x="16" y="35" class="lp-name">${esc(title)}</text>`,
    legend,
    body,
    '</svg>',
  ].join('');
}
