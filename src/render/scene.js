import * as A from '../sprites/accessories.js';
import { createRng, hashString } from '../util/rng.js';
import { strings } from '../i18n/index.js';
import { escapeXml } from '../util/text.js';
import { composePet } from './compose.js';
import { FLAME, MOVE_MOODS, MOVES, moveCss, moveOf } from './moves.js';
import { rectsFromPixels, stamp } from './pixels.js';
import { farFx, frontFx, homeOf, propsFx, SANDY, SCENERY, skyFx } from './scenery.js';

const PX = {
  card: { egg: 6, baby: 5, adult: 7, elder: 7 },
  mini: { egg: 4, baby: 4, adult: 5, elder: 5 },
};

const ANIM = {
  ecstatic: ['lp-hop', 1.2],
  happy: ['lp-bounce', 2],
  party: ['lp-hop', 0.9],
  hungry: ['lp-growl', 3],
  sleepy: ['lp-breathe', 4],
  hibernating: ['lp-breathe', 5],
  sad: ['lp-breathe', 5.5],
  sick: ['lp-shiver', 0.35],
  zombie: ['lp-sway', 3.2],
};

const CONFETTI = ['#ff5fa2', '#ffd23f', '#5ec8ff', '#7ee081', '#b388ff', '#ff8c42'];
const LEAVES = ['#e76f51', '#f4a261', '#e9c46a', '#d62828'];
const PETALS = ['#ffb7d5', '#ffc8dd', '#ffffff'];
const FLOWERS = ['#ff7eb6', '#ffd23f', '#ffffff', '#b388ff'];

const r1 = (v) => Math.round(v * 10) / 10;
const sec = (v) => `${v.toFixed(2)}s`;

function at(x, y, content, cls = '', style = '') {
  const inner = cls || style ? `<g${cls ? ` class="${cls}"` : ''}${style ? ` style="${style}"` : ''}>${content}</g>` : content;
  return `<g transform="translate(${r1(x)} ${r1(y)})">${inner}</g>`;
}

function sky(s) {
  const { pet, rng, x, y, w, h, mini } = s;
  const p = mini ? 2 : 3;
  if (SCENERY[s.home].noSky) return '';
  const alwaysNight = pet.mood === 'hibernating';
  let night = stamp(A.MOON.rows, A.MOON.colors, p, x + w - (mini ? 22 : 32), y + (mini ? 10 : 14));
  for (let i = 0; i < 7; i++) {
    const sx = x + rng.range(6, w - 40);
    const sy = y + rng.range(6, h * 0.42);
    night += `<rect x="${r1(sx)}" y="${r1(sy)}" width="2" height="2" class="lp-star lp-twinkle" style="animation-duration:${sec(rng.range(1.6, 3.2))};animation-delay:-${sec(rng.range(0, 3))}"/>`;
  }
  if (pet.season === 'summer' && !alwaysNight) {
    for (let i = 0; i < 5; i++) {
      night += `<rect x="${r1(x + rng.range(8, w - 8))}" y="${r1(s.groundY - rng.range(10, h * 0.4))}" width="2" height="2" class="lp-firefly lp-twinkle" style="animation-duration:${sec(rng.range(1.2, 2.4))};animation-delay:-${sec(rng.range(0, 2))}"/>`;
    }
  }
  if (alwaysNight) return `<g class="lp-px">${night}</g>`;

  let day = '';
  const clouds = [[0.08, 0.08], [0.55, 0.2]];
  for (const [fx, fy] of clouds) {
    const cloud = stamp(A.CLOUD, { w: '#ffffffd9' }, p, 0, 0);
    day += at(x + w * fx, y + h * fy, cloud, 'lp-cloud', `animation-duration:${sec(rng.range(10, 16))}`);
  }
  if (pet.season === 'summer') day += stamp(A.SUN.rows, A.SUN.colors, p, x + w - (mini ? 24 : 36), y + (mini ? 8 : 12));
  return `<g class="lp-day lp-px">${day}</g><g class="lp-night lp-px">${night}</g>`;
}

function holidaySky(s) {
  const { pet, rng, x, y, w, h, mini } = s;
  let out = '';
  if (pet.holiday === 'newyear' || pet.holiday === 'tet') {
    const colors = pet.holiday === 'tet' ? ['#ffd166', '#e63946'] : CONFETTI;
    const spots = [[0.22, 0.16], [0.74, 0.12], [0.5, 0.3]];
    spots.forEach(([fx, fy], i) => {
      const radius = mini ? 8 : 13;
      let dots = '';
      for (let k = 0; k < 10; k++) {
        const angle = (k / 10) * Math.PI * 2;
        dots += `<rect x="${r1(Math.cos(angle) * radius - 1.5)}" y="${r1(Math.sin(angle) * radius - 1.5)}" width="3" height="3" fill="${colors[(k + i) % colors.length]}"/>`;
      }
      out += at(x + w * fx, y + h * fy, dots, 'lp-burst', `animation-delay:${sec(i * 0.8)}`);
    });
  }
  if (pet.holiday === 'tet') {
    const p = mini ? 2 : 3;
    for (const fx of [0.1, 0.86]) {
      const lantern = `<rect x="-0.5" y="0" width="1" height="${mini ? 8 : 14}" class="lp-string"/>`
        + stamp(A.LANTERN.rows, A.LANTERN.colors, p, -2.5 * p, mini ? 8 : 14);
      out += at(x + w * fx, y, lantern, 'lp-swing', `animation-duration:${sec(rng.range(2.6, 3.4))}`);
    }
  }
  if (pet.holiday === 'programmers') {
    for (let i = 0; i < 8; i++) {
      const bit = `<text class="lp-bit" x="0" y="0">${i % 2}</text>`;
      out += at(x + rng.range(6, w - 10), y, bit, 'lp-drift', `animation-duration:${sec(rng.range(6, 10))};animation-delay:-${sec(rng.range(0, 10))}`);
    }
  }
  return out;
}

function ground(s) {
  const { pet, rng, x, w, groundY, groundH, mini } = s;
  let out = `<rect x="${x}" y="${groundY}" width="${w}" height="${groundH}" class="lp-ground"/>`;
  out += `<rect x="${x}" y="${groundY}" width="${w}" height="2" class="lp-ground2"/>`;
  const grassy = !SANDY.has(s.home);
  for (let gx = x + 5; grassy && gx < x + w - 6; gx += rng.int(12, 22)) {
    out += `<rect x="${gx}" y="${groundY - 3}" width="2" height="3" class="lp-ground2"/>`;
    out += `<rect x="${gx + 3}" y="${groundY - 5}" width="2" height="5" class="lp-ground2"/>`;
  }
  for (let i = 0; i < (mini ? 3 : 5); i++) {
    out += `<rect x="${r1(x + rng.range(6, w - 10))}" y="${r1(groundY + rng.range(10, groundH - 5))}" width="3" height="2" class="lp-ground2"/>`;
  }
  const blooming = grassy && (pet.season === 'spring' || pet.season === 'summer') && !['zombie', 'sick', 'hibernating', 'hungry'].includes(pet.mood);
  if (blooming) {
    for (let i = 0; i < 3; i++) {
      const fx = r1(x + rng.range(6, w - 10));
      const fy = r1(groundY + rng.range(8, groundH - 8));
      out += `<rect x="${fx + 1}" y="${fy}" width="1" height="4" fill="#3c8a4b"/><rect x="${fx}" y="${fy - 3}" width="3" height="3" fill="${rng.pick(FLOWERS)}"/>`;
    }
  }
  return `<g class="lp-px">${out}</g>`;
}

function decor(s) {
  const { pet, x, groundY, mini } = s;
  const p = mini ? 2 : 3;
  let out = '';
  if (pet.mood === 'zombie') {
    const tx = x + (pet.holiday === 'halloween' ? (mini ? 18 : 28) : (mini ? 5 : 10));
    out += stamp(A.TOMBSTONE.rows, A.TOMBSTONE.colors, p, tx, groundY - A.TOMBSTONE.rows.length * p + p * 2);
  }
  if (pet.holiday === 'halloween') {
    out += stamp(A.PUMPKIN.rows, A.PUMPKIN.colors, p, x + (mini ? 3 : 6), groundY - A.PUMPKIN.rows.length * p + p * 3);
  }
  return out ? `<g class="lp-px">${out}</g>` : '';
}

function bowl(s) {
  const { pet, x, w, footY, mini } = s;
  if (pet.mood === 'egg' || pet.mood === 'hibernating') return '';
  const p = mini ? 2 : 3;
  const fullness = pet.vitals.fullness;
  const rows = A.BOWLS[fullness >= 66 ? 'full' : fullness >= 33 ? 'half' : 'empty'];
  const colors = { ...A.BOWL_COLORS, ...(pet.species.food === 'water' ? A.WATER_COLORS : A.KIBBLE_COLORS) };
  const bx = Math.round(x + w * 0.84 - (12 * p) / 2);
  const by = footY - rows.length * p + p;
  return `<g class="lp-px">${stamp(rows, colors, p, bx, by)}</g>`;
}

function petGroup(s, comp) {
  const { pet, rng, cx, footY, ox, oy, px } = s;
  const [cls, dur] = pet.mood === 'egg' ? ['lp-wobble', 4 - 2.5 * pet.hatchProgress] : ANIM[pet.mood] ?? ANIM.happy;
  const blink = sec(rng.range(3.2, 5.6));
  let inner = comp.aura.length ? `<g class="lp-aura">${rectsFromPixels(comp.aura, px, ox, oy)}</g>` : '';
  inner += rectsFromPixels(comp.base, px, ox, oy);
  if (comp.eyesClosed) {
    inner += `<g class="lp-blink-open" style="animation-duration:${blink}">${rectsFromPixels(comp.eyesOpen, px, ox, oy)}</g>`;
    inner += `<g class="lp-blink-closed" style="animation-duration:${blink}">${rectsFromPixels(comp.eyesClosed, px, ox, oy)}</g>`;
  } else {
    inner += rectsFromPixels(comp.eyesOpen, px, ox, oy);
  }
  inner += rectsFromPixels(comp.gear, px, ox, oy);
  // Rotations and squashes pivot on the pet's feet: translate there, animate, translate back.
  // The ninja's shadow clones reuse the drawn pet through <use>, so it needs an id.
  const id = pet.mood !== 'egg' && MOVES[moveOf(pet.species)].effect === 'clones'
    ? ` id="lp${hashString(`${pet.repo.fullName}|${pet.date}|${s.mini ? 'mini' : 'card'}|pet`).toString(36)}"` : '';
  const body = `<g class="${cls}" style="animation-duration:${sec(dur)}">`
    + `<g${id} transform="translate(${-cx} ${-footY})" class="lp-px">${inner}</g></g>`;
  return `<g transform="translate(${cx} ${footY})">${signatureMove(s, comp, body)}</g>`;
}

// On good days the pet shows off its species' signature move every few seconds (see moves.js).
function signatureMove(s, comp, body) {
  const { pet, px, bw, mini } = s;
  if (pet.mood === 'egg' || !MOVE_MOODS.has(pet.mood)) return body;
  const id = moveOf(pet.species);
  const move = MOVES[id];
  const rng = createRng(`${pet.repo.fullName}|${pet.date}|move`);
  const clock = `animation-duration:${sec(move.duration ?? 7)};animation-delay:${sec(rng.range(0.6, 3))}`;
  const height = (comp.bbox.maxY - comp.bbox.minY + 1) * px;
  const origin = move.pivot === 'center' ? `;transform-origin:0 ${-Math.round(height / 2)}px` : '';
  let before = '';
  let under = '';
  if (move.effect === 'clones') {
    const ref = /id="([^"]+)"/.exec(body)?.[1];
    const dx = Math.round(bw * 0.6);
    if (ref) before = `<g class="lp-fx-clones" style="${clock}"><use href="#${ref}" x="${-dx}"/><use href="#${ref}" x="${dx}"/></g>`;
  } else if (move.effect === 'flames') {
    const fp = Math.max(2, Math.round(px * (mini ? 0.6 : 0.7)));
    const flame = (x) => stamp(FLAME.rows, FLAME.colors, fp, x - 2 * fp, -fp);
    under = `<g class="lp-fx-flames lp-px" style="${clock}">${flame(-bw * 0.22)}${flame(bw * 0.22)}</g>`;
  }
  return `<style>${moveCss(id)}</style>${before}<g class="lp-mv-${id}" style="${clock}${origin}">${under}${body}</g>`;
}

const rise = (s, x, y, content, dur, delay) => at(x, y, content, 'lp-rise lp-px', `animation-duration:${sec(dur)};animation-delay:${sec(delay)}`);

function moodFx(s) {
  const { pet, cx, bw, headTop, pp, mini, rng, x, y, w } = s;
  const k = mini ? 0.7 : 1;
  switch (pet.mood) {
    case 'ecstatic':
      return [[-0.5, 6, 0], [0.44, -4, 1.1], [0, -14, 2.2]]
        .map(([dx, dy, delay]) => rise(s, cx + dx * bw, headTop + dy * k, stamp(A.HEART, { r: '#ff5d8f' }, pp, -2.5 * pp, -2 * pp), 3.3, delay))
        .join('');
    case 'happy':
      return [[0.46, 0, 0], [-0.52, -6, 1.6]]
        .map(([dx, dy, delay]) => rise(s, cx + dx * bw, headTop + dy * k, stamp(A.NOTE, { o: '.lp-ink' }, pp - 1, -4, -5), 3.6, delay))
        .join('');
    case 'party': {
      let out = '';
      for (let i = 0; i < (mini ? 12 : 18); i++) {
        const cw = mini ? 2 : 3;
        const ch = mini ? 3 : 5;
        out += at(x + rng.range(4, w - 4), y, `<rect x="${-cw / 2}" y="${-ch / 2}" width="${cw}" height="${ch}" fill="${rng.pick(CONFETTI)}" class="lp-fall" style="animation-duration:${sec(rng.range(2.4, 4.4))};animation-delay:-${sec(rng.range(0, 4))}"/>`);
      }
      return out;
    }
    case 'hungry': {
      const bx = cx + bw * 0.52;
      const by = headTop - 14 * k;
      const food = pet.species.food === 'water' ? A.WATER : A.DRUMSTICK;
      const width = food.rows[0].length;
      return `<g class="lp-float" style="animation-duration:2.6s">`
        + `<circle cx="${r1(cx + bw * 0.3)}" cy="${r1(headTop + 2 * k)}" r="${r1(2 * k)}" class="lp-thought"/>`
        + `<circle cx="${r1(cx + bw * 0.4)}" cy="${r1(headTop - 6 * k)}" r="${r1(3 * k)}" class="lp-thought"/>`
        + `<rect x="${r1(bx - 15 * k)}" y="${r1(by - 11 * k)}" width="${r1(30 * k)}" height="${r1(22 * k)}" rx="${r1(10 * k)}" class="lp-thought"/>`
        + `<g class="lp-px">${stamp(food.rows, food.colors, pp - (mini ? 0 : 1), bx - (width / 2) * (pp - (mini ? 0 : 1)), by - 2.5 * (pp - (mini ? 0 : 1)))}</g></g>`;
    }
    case 'sleepy':
    case 'hibernating': {
      const sizes = mini ? [8, 10, 12] : [10, 13, 16];
      const color = pet.mood === 'hibernating' ? ';fill:#ffffff' : '';
      return sizes
        .map((size, i) => at(cx + bw * 0.3 + i * 5 * k, headTop - 2 - i * 4 * k, `<text class="lp-z lp-zz" style="font-size:${size}px;animation-duration:3.6s;animation-delay:${sec(i * 1.2)}${color}">${i === 0 ? 'z' : 'Z'}</text>`))
        .join('');
    }
    case 'sad': {
      const cp = pp + 1;
      const left = cx - 5 * cp;
      const top = headTop - (mini ? 20 : 30);
      let drops = '';
      for (let i = 0; i < 4; i++) {
        drops += `<rect x="${r1(left + cp * (1.5 + i * 2.2))}" y="${r1(top + 4 * cp)}" width="${pp - 1}" height="${pp + 2}" class="lp-raindrop lp-drip" style="animation-duration:1.1s;animation-delay:${sec(i * 0.27)}"/>`;
      }
      return `<g class="lp-float" style="animation-duration:4s">${drops}<g class="lp-px">${stamp(A.RAINCLOUD.rows, A.RAINCLOUD.colors, cp, left, top)}</g></g>`;
    }
    case 'sick': {
      const dp = Math.max(2, pp - 1);
      return [[0.42, 0], [-0.46, 0.9]]
        .map(([dx, delay]) => at(cx + dx * bw, headTop + 8 * k, stamp(A.DROP, { t: '#7fd3ff' }, dp, -1.5 * dp, 0), 'lp-drip lp-px', `animation-duration:1.8s;animation-delay:${sec(delay)}`))
        .join('');
    }
    case 'zombie': {
      let out = '';
      for (let i = 0; i < 3; i++) {
        const radius = (mini ? 14 : 22) + i * (mini ? 4 : 6);
        const orbit = `<g class="lp-orbit" style="animation-duration:${sec(1.8 + i * 0.7)};animation-direction:${i % 2 ? 'reverse' : 'normal'}"><rect x="${radius}" y="-3" width="3" height="${mini ? 4 : 6}" class="lp-fly"/></g>`;
        out += `<g transform="translate(${cx} ${r1(headTop + 8 * k)}) scale(1 .42)">${orbit}</g>`;
      }
      return out;
    }
    case 'egg':
      return sparkles(s, 3, ['#ffffff', '#fff3b0']);
    default:
      return '';
  }
}

function sparkles(s, count, colors) {
  const { cx, bw, headTop, footY, rng, pp } = s;
  const sp = Math.max(1, pp - 1);
  let out = '';
  for (let i = 0; i < count; i++) {
    const sx = cx + rng.range(-0.62, 0.62) * bw;
    const sy = rng.range(headTop - 6, footY - 14);
    out += at(sx, sy, stamp(A.SPARK, { y: colors[i % colors.length] }, sp, -1.5 * sp, -1.5 * sp), 'lp-twinkle lp-px',
      `animation-duration:${sec(rng.range(1.4, 2.6))};animation-delay:-${sec(rng.range(0, 2))}`);
  }
  return out;
}

function weather(s) {
  const { pet, rng, x, y, w, mini, pp } = s;
  if (pet.mood === 'zombie' || SCENERY[s.home].noWeather) return '';
  const season = pet.mood === 'hibernating' || pet.holiday === 'christmas' ? 'winter' : pet.season;
  const drift = (content, dur, delay) => at(x + rng.range(0, w - 8), y, content, 'lp-drift', `animation-duration:${sec(dur)};animation-delay:-${sec(delay)}`);
  let out = '';
  const n = mini ? 6 : 9;
  if (season === 'autumn') {
    for (let i = 0; i < n; i++) out += drift(stamp(A.LEAF, { l: rng.pick(LEAVES) }, pp - 1, -(pp - 1) * 1.5, -(pp - 1) * 1.5), rng.range(7, 11), rng.range(0, 11));
  } else if (season === 'winter') {
    const size = mini ? 2 : 3;
    for (let i = 0; i < n + 4; i++) out += drift(`<rect x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" class="lp-snow"/>`, rng.range(6, 10), rng.range(0, 10));
  } else if (season === 'spring') {
    for (let i = 0; i < n; i++) out += drift(stamp(A.PETAL, { p: rng.pick(PETALS) }, 2, -2, -2), rng.range(7, 11), rng.range(0, 11));
  }
  return out ? `<g class="lp-px">${out}</g>` : '';
}

// Sky, ground and weather, shared by single-pet scenes and the Pet Park.
// `s` needs: pet (for mood, season, holiday), rng, x, y, w, h, groundY, groundH, mini, pp.
export const backdrop = { sky, skyFx, holidaySky, farFx, ground, propsFx, frontFx, weather };

export const skyDefs = (uid, { x, y, w, h, rx }) =>
  `<linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="lp-sky1"/><stop offset="1" class="lp-sky2"/></linearGradient>`
  + `<clipPath id="${uid}-clip"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/></clipPath>`;

// The day the pet levels up, a banner floats over its head (in its rank's color on a rank-up).
function levelUpFx(s) {
  const { pet, cx, headTop, mini } = s;
  if (pet.mood === 'egg' || !pet.events?.includes('levelUp')) return '';
  const tr = strings(pet.lang);
  const text = pet.events.includes('rankUp') ? `${pet.rank.emoji} ${tr.levelUpBanner}` : tr.levelUpBanner;
  const color = pet.events.includes('rankUp') ? pet.rank.color : '#ffd23f';
  return at(cx, headTop - (mini ? 4 : 8), `<text text-anchor="middle" class="lp-lvup" style="fill:${color}${mini ? ';font-size:9px' : ''}">${escapeXml(text)}</text>`, 'lp-rise', 'animation-duration:2.6s');
}

// A pal from the wardrobe keeps the pet company on its left, hopping or hovering.
function palFx(s) {
  const { pet, cx, bw, footY, headTop, mini } = s;
  const pal = A.PALS[pet.accessories?.pal];
  if (!pal || pet.mood === 'egg') return '';
  const p = mini ? 2.5 : 4;
  const w = pal.rows[0].length * p;
  const h = pal.rows.length * p;
  const px = Math.round(cx - bw / 2 - w - (mini ? 2 : 4));
  const py = pal.motion === 'hop' ? footY - h : Math.round((headTop + footY) / 2 - h);
  return at(px, py, stamp(pal.rows, pal.colors, p, 0, 0), `lp-px lp-pal-${pal.motion}`);
}

// The evolution emblem floats by the pet's head; an elder's emblem glows.
function emblemFx(s) {
  const { pet, cx, bw, headTop, mini } = s;
  const emblem = pet.path && A.EMBLEMS[pet.path.id];
  if (!emblem || pet.mood === 'egg') return '';
  const p = mini ? 2 : 3;
  const ex = Math.round(cx - bw / 2 - 4);
  const ey = Math.round(headTop - 7 * p + (mini ? 4 : 6));
  const art = stamp(emblem.rows, emblem.colors, p, 0, 0);
  return at(ex, ey, pet.stage === 'elder' ? `<g class="lp-glow">${art}</g>` : art, 'lp-px lp-float', 'animation-duration:2.8s');
}

// The pet with its shadow and mood effects, standing with its feet at (cx, footY).
// `frame` is the box it lives in (x, y, w, h, groundY, groundH), used by effects like confetti.
export function renderActor(pet, frame) {
  const { cx, footY, px } = frame;
  const comp = composePet(pet);
  const { minX, maxX, minY, maxY } = comp.bbox;
  const bw = (maxX - minX + 1) * px;
  const ox = Math.round(cx - bw / 2 - minX * px);
  const oy = footY - (maxY + 1) * px;
  const s = { ...frame, pet, bw, ox, oy, pp: frame.mini ? 2 : 3, headTop: oy + minY * px };
  const shadow = `<ellipse cx="${cx}" cy="${footY - 1}" rx="${Math.round(bw * 0.38)}" ry="${Math.max(2, Math.round(px * 0.6))}" class="lp-shadow"/>`;
  const body = shadow
    + palFx(s)
    + petGroup(s, comp)
    + emblemFx(s)
    + moodFx(s)
    + (pet.shiny && pet.mood !== 'egg' ? sparkles(s, 4, ['#ffe066', '#ffffff']) : '')
    + (pet.aura && pet.mood !== 'egg' ? sparkles(s, 5, ['#ffd23f', '#fff3a6', '#ffffff']) : '')
    + levelUpFx(s);
  return { body, s };
}

// Draws the pet's little world inside the box (x, y, w, h).
export function renderScene(pet, { x, y, w, h, uid, variant = 'card' }) {
  const mini = variant === 'mini';
  const groundH = mini ? 28 : 40;
  const groundY = y + h - groundH;
  const actor = renderActor(pet, {
    rng: createRng(`${pet.repo.fullName}|${pet.date}|${variant}`),
    home: homeOf(pet),
    x, y, w, h, groundY, groundH, mini,
    cx: Math.round(x + w * 0.42),
    footY: groundY + Math.round(groundH * 0.2),
    px: PX[variant][pet.stage] ?? PX[variant].adult,
  });
  const { s } = actor;
  const body = [
    `<g clip-path="url(#${uid}-clip)">`,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${uid}-sky)"/>`,
    sky(s),
    skyFx(s),
    holidaySky(s),
    farFx(s),
    ground(s),
    propsFx(s),
    decor(s),
    bowl(s),
    actor.body,
    frontFx(s),
    weather(s),
    '</g>',
  ].join('');
  return { defs: skyDefs(uid, { x, y, w, h, rx: mini ? 12 : 10 }), body };
}
