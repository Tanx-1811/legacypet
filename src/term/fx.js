// Little pixel props for the terminal scenes: what a commit tastes like, hearts, sparkles,
// gifts from a pull, the rocket for a push, the signpost for a branch.
import { DRUMSTICK, HEART, NOTE, SPARK, WATER } from '../sprites/accessories.js';
import { createRng } from '../util/rng.js';
import { stampBitmap } from './actor.js';

// Every kind of commit is a different dish (see words.js for what the pet says about it).
export const FOODS = {
  cake: { rows: ['....r.', '.wwwww', 'pppppp', 'yyyyyy', 'pppppp', 'yyyyyy'], colors: { r: '#e63946', w: '#fff8f0', p: '#ff8fab', y: '#f4c27a' } },
  apple: { rows: ['..bg..', '.rrbrr', 'rrrrwr', 'rrrrrr', 'rrrrrr', '.rrrr.'], colors: { b: '#6b3e1f', g: '#5cb85c', r: '#e63946', w: '#ffd1d6' } },
  fortune: { rows: ['..yyy.', '.yyyyy', 'yyyyyy', 'yyywYy', '.yyyw.', '..yy..'], colors: { y: '#f2b84b', Y: '#d99a2b', w: '#ffffff' } },
  broccoli: { rows: ['.gg.g.', 'gGgggg', 'ggggGg', '.gggg.', '..ll..', '..ll..'], colors: { g: '#3fa34d', G: '#7ed957', l: '#b5e48c' } },
  onigiri: { rows: ['..oo..', '.owwo.', 'owwwwo', 'owwwwo', 'okkkko', '.kkkk.'], colors: { o: '#9aa5b1', w: '#f8f9fa', k: '#1f4037' } },
  bolt: { rows: ['...yy.', '..yy..', '.yyyy.', '..yy..', '.yy...'], colors: { y: '#ffd23f' } },
  cookie: { rows: ['.cccc.', 'ccdccc', 'cccccd', 'cdcccc', 'cccdcc', '.cccc.'], colors: { c: '#d9a066', d: '#5a3a1e' } },
  bento: { rows: ['oooooooo', 'owwogyyo', 'owwogyyo', 'oooooooo'], colors: { o: '#c0392b', w: '#f8f9fa', g: '#6fcf5f', y: '#ffd23f' } },
  drumstick: DRUMSTICK,
  water: WATER,
  ball: { rows: ['.rrw.', 'rrrrw', 'yyyyy', 'bbbbb', '.bbb.'], colors: { r: '#ff5d73', w: '#ffd1d6', y: '#ffffff', b: '#5ec8ff' } },
};

export const PROPS = {
  heart: { rows: HEART, colors: { r: '#ff5d73' } },
  tinyHeart: { rows: ['r.r', 'rrr', '.r.'], colors: { r: '#ff5d73' } },
  spark: { rows: SPARK, colors: { y: '#ffd23f' } },
  star: { rows: ['..y..', '.yyy.', 'yyyyy', '.yyy.', '.y.y.'], colors: { y: '#ffd23f' } },
  note: { rows: NOTE, colors: { o: '#b388ff' } },
  rocket: {
    rows: ['..r..', '.rwr.', '.wtw.', '.www.', '.wtw.', 'rwwwr', 'r.w.r'],
    colors: { r: '#e63946', w: '#eef2f7', t: '#5ec8ff' },
  },
  flame: { rows: ['yoy', '.o.'], colors: { y: '#ffe066', o: '#ff8c1a' } },
  gift: {
    rows: ['.r...r.', '..r.r..', 'bbbrbbb', 'bbbrbbb', 'rrrrrrr', 'bbbrbbb', 'bbbrbbb'],
    colors: { r: '#ff5fa2', b: '#5ec8ff' },
  },
  coffee: { rows: ['.s.s..', '..s...', 'wwwww.', 'wcccwo', 'wcccwo', '.www..'], colors: { s: '#c9d3e0', w: '#f8f9fa', c: '#6b3e1f', o: '#f8f9fa' } },
  tag: { rows: ['..yyyyy', '.yyyyyy', 'yykyyyy', '.yyyyyy', '..yyyyy'], colors: { y: '#ffd23f', k: '#5a3a1e' } },
};

export const GIFT_COLORS = ['#5ec8ff', '#7ee081', '#b388ff', '#ffd23f', '#ff8c42'];
export const CONFETTI = ['#ff5fa2', '#ffd23f', '#5ec8ff', '#7ee081', '#b388ff', '#ff8c42'];

const cache = new Map();
// A prop or a dish as a bitmap at `scale` pixels per cell (cached), anchored at its bottom middle.
export function sprite(art, scale = 1, recolor = null) {
  const key = `${art.rows.join('/')}|${scale}|${recolor ? JSON.stringify(recolor) : ''}`;
  if (!cache.has(key)) cache.set(key, stampBitmap(art.rows, { ...art.colors, ...recolor }, scale));
  return cache.get(key);
}

// What a commit tastes like, from its kind (words.js: commitKind).
export function foodFor(kind, species) {
  const dish = {
    feat: 'cake', fix: 'apple', docs: 'fortune', test: 'broccoli', refactor: 'onigiri', style: 'onigiri',
    perf: 'bolt', chore: 'cookie', ci: 'cookie', build: 'cookie', revert: 'cookie', wip: 'cookie', merge: 'bento', feast: 'bento',
  }[kind];
  return FOODS[dish ?? (species?.food === 'water' ? 'water' : 'drumstick')];
}

// Where something thrown from `a` to `b` is at `f` (0…1): a parabola peaking `height` above.
export function arc(a, b, f, height) {
  const t = Math.min(1, Math.max(0, f));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - 4 * height * t * (1 - t) };
}

// A burst of confetti over the stage: pieces fall from the top, each at its own pace and drift.
export function confettiPieces(seed, count, width) {
  const rng = createRng(`confetti|${seed}`);
  return Array.from({ length: count }, () => ({
    x: rng.range(0, width),
    delay: rng.range(0, 0.6),
    speed: rng.range(10, 20),
    drift: rng.range(-3, 3),
    color: rng.pick(CONFETTI),
  }));
}

export function drawConfetti(canvas, pieces, t) {
  for (const p of pieces) {
    const age = t - p.delay;
    if (age < 0) continue;
    const y = age * p.speed;
    if (y >= canvas.height) continue;
    canvas.set(p.x + Math.sin(age * 5) * p.drift, y, p.color);
  }
}

// Sparkles that pop out from a point in all directions and fade by shrinking to a dot.
export function drawBurst(canvas, x, y, t, { count = 8, reach = 10, color = '#ffd23f' } = {}) {
  if (t < 0 || t > 1) return;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const r = reach * Math.sqrt(t);
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r * 0.8;
    canvas.set(px, py, color);
    if (t < 0.6) {
      canvas.set(px + 1, py, color);
      canvas.set(px, py + 1, color);
    }
  }
}
