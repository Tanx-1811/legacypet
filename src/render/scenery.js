// Each species has a home: a little landscape with its own props and ambient effects.
// Layers are drawn back to front: sky → far → (ground) → props → (pet) → front → overhead.
// Fixed-color props sit in `.lp-prop`, which the theme dims at night.
import { HOMES } from '../sprites/index.js';
import { stamp as px } from './pixels.js';

export const SANDY = new Set(['beach', 'reef', 'desert']);

const r1 = (v) => Math.round(v * 10) / 10;
const sec = (v) => `${v.toFixed(2)}s`;
const at = (x, y, content, cls = '', style = '') => `<g transform="translate(${r1(x)} ${r1(y)})">`
  + (cls || style ? `<g${cls ? ` class="${cls}"` : ''}${style ? ` style="${style}"` : ''}>${content}</g>` : content) + '</g>';
const anim = (dur, delay = 0) => `animation-duration:${sec(dur)};animation-delay:-${sec(delay)}`;

// --- pixel sprites ---------------------------------------------------------------------------

const TREE = ['...llllll...', '.llllLlllll.', 'llLllllllLll', 'lllllllLllll', 'lLllllllllLl', 'llllLlllllll', '.llllllLlll.', '...llllll...', '.....tt.....', '.....tt.....', '....tttt....'];
const DEAD_TREE = ['.t.......t..', '..t..t..t...', '...t.t.t..t.', '.t..ttt..t..', '..t..tt.t...', '...t.tttt...', '....ttt.....', '.....tt.....', '.....tt.....', '.....tt.....', '....tttt....'];
const LEAVES = {
  spring: { l: '#7ccf5f', L: '#ffb7d5', t: '#7a4b2a' },
  summer: { l: '#4fae4a', L: '#3a8f3a', t: '#7a4b2a' },
  autumn: { l: '#f0a030', L: '#d9542b', t: '#7a4b2a' },
  winter: { l: '#eef5fc', L: '#bcd0e6', t: '#6b4a32' },
};
const PALM = ['..ff.....ff...', '.ffff...ffff..', 'ff..ffFffF.fff', 'f..fFfcffff..f', '..f..cTcf..f..', '.f....T.....f.', '......T.......', '......TT......', '.......T......', '.......T......', '.......TT.....', '........T.....', '........T.....', '.......TTT....'];
const SUNFLOWER = ['.yyy.', 'yybyy', '.yyy.', '..g..', '.gg..', '..g..', '..gg.', '..g..'];
const CACTUS = ['..g..', 'g.g..', 'g.g.g', 'ggg.g', '..ggg', '..g..', '..g..'];
const CORAL = ['p.p..p.', 'p.p.pp.', 'ppp.p..', '.pppp.p', '..ppppp', '...pp..', '..pppp.'];
const FISH = ['..ooo..', '.ooooo.o', 'oeoooooo', '.ooooo.o', '..ooo..'].map((r) => r.padEnd(8, '.'));
const SHELL = ['.ss.', 'sSss', 'ssss'];
const STAR = ['..r..', 'rrrrr', '.rrr.', 'r...r'];
const CASTLE = ['s.s.s...', 'sssss.s.', 'sdsss.s.', 'sssssss.', 'ssdssss.', 'sssssss.'];
const SNOWMAN = ['..hh..', '.hhhh.', '..ww..', '.wkww.', '..ww..', '.wwww.', 'wwbwww', 'wwwwww', '.wwbw.', '..ww..'];
const BIRD = [['o...o', '.o.o.', '..o..'], ['..o..', '.o.o.', 'o...o']];
const BAT = [['o.....o', 'oo...oo', '.ooooo.', '..o.o..'], ['.......', '..ooo..', '.ooooo.', 'oo.o.oo']];
const BUTTERFLY = [['pp.pp', 'ppbpp', '.pbp.'], ['.p.p.', '.pbp.', '..b..']];
const TUMBLEWEED = ['.bbbb.', 'b.b..b', 'bb.bbb', 'b.bb.b', 'b..b.b', '.bbbb.'];
const MAI = ['.y.', 'yoy', '.y.'];

// --- shared building blocks -----------------------------------------------------------------

// A stepped, pixel-style skyline of hills: heights from two sines so it looks natural but stays deterministic.
function ridge(s, { base, amp, step, cls, scale = 24 }) {
  const { rng, x, w } = s;
  const ph1 = rng.range(0, 6.28);
  const ph2 = rng.range(0, 6.28);
  let d = `M${x} ${base}`;
  for (let gx = x; gx < x + w; gx += step) {
    const t = (gx - x) / scale;
    const hgt = amp * (0.55 + 0.3 * Math.sin(t + ph1) + 0.15 * Math.sin(t * 2.7 + ph2));
    d += `V${Math.round((base - hgt) / 2) * 2}H${r1(Math.min(gx + step, x + w))}`;
  }
  return `<path d="${d}V${base}Z" class="${cls}"/>`;
}

const flapper = (frames, colors, p, cls = 'lp-flap', dur = 0.5) => frames
  .map((rows, i) => `<g class="${cls}" style="animation-duration:${sec(dur)};animation-delay:-${sec(i * dur / 2)}">${px(rows, colors, p, -(rows[0].length * p) / 2, 0)}</g>`)
  .join('');

function flock(s, count, color, { yMax = 0.32, sprite = BIRD, dur = [14, 20], cls = 'lp-fly' } = {}) {
  const { rng, x, y, w, h, mini } = s;
  const p = mini ? 1 : 2;
  let out = '';
  // In a wide park, send more birds so the sky never looks empty.
  const n = count * Math.max(1, Math.round(w / 260));
  for (let i = 0; i < n; i++) {
    const bird = flapper(sprite, { o: color }, p, 'lp-flap', rng.range(0.4, 0.6));
    out += at(x + rng.range(-40, w - 200), y + rng.range(0.1, yMax) * h, bird, cls, anim(rng.range(...dur), rng.range(0, 20)));
  }
  return out;
}

function butterflies(s, count) {
  const { rng, x, w, groundY, h, mini, pet } = s;
  if (pet.season === 'winter' || pet.mood === 'zombie') return '';
  const p = mini ? 1 : 2;
  const colors = ['#ff7eb6', '#ffd23f', '#b388ff', '#5ec8ff'];
  let out = '';
  for (let i = 0; i < count * Math.max(1, Math.round(w / 260)); i++) {
    const fly = flapper(BUTTERFLY, { p: colors[(i + rng.int(0, 3)) % colors.length], b: '#3b2a1a' }, p, 'lp-flap', 0.3);
    out += at(x + rng.range(0.05, 0.9) * w, groundY - rng.range(0.12, 0.3) * h, fly, 'lp-flutter', anim(rng.range(5, 8), rng.range(0, 8)));
  }
  return `<g class="lp-day">${out}</g>`;
}

function mist(s, count, { color = '#ffffff', opacity = 0.35, y0 = 0, spread = 14 } = {}) {
  const { rng, x, w, groundY, mini } = s;
  let out = '';
  for (let i = 0; i < count * Math.max(1, Math.round(w / 200)); i++) {
    const rx = rng.range(30, 60) * (mini ? 0.7 : 1);
    const ell = `<ellipse cx="0" cy="0" rx="${r1(rx)}" ry="${r1(rx * 0.16)}" fill="${color}" opacity="${opacity}"/>`;
    out += at(x + rng.range(0, w), groundY + y0 - rng.range(0, spread), ell, 'lp-mist', anim(rng.range(7, 12), rng.range(0, 12)));
  }
  return out;
}

// --- homes -----------------------------------------------------------------------------------

const leafColors = (s) => LEAVES[s.pet.mood === 'hibernating' ? 'winter' : s.pet.season] ?? LEAVES.summer;

function tree(s, fx, scale = 1) {
  const { x, w, groundY, mini, pet } = s;
  const p = (mini ? 2 : 3) * scale;
  const rows = pet.mood === 'zombie' ? DEAD_TREE : TREE;
  const colors = pet.mood === 'zombie' ? { t: '#5b4a3f' } : leafColors(s);
  const tw = rows[0].length * p;
  const body = px(rows, colors, p, -tw / 2, -rows.length * p);
  return at(x + w * fx, groundY + p, body, 'lp-sway-soft lp-prop', anim(5 + fx * 3));
}

const WINDMILL = ['.rrrr.', 'rrrrrr', '.wwww.', '.wddw.', '.wwww.', '.wwww.', 'wwwwww', 'wwddww', 'wwddww'];

const meadow = {
  far(s) {
    const { groundY, h, mini, rng, x, w } = s;
    let out = ridge(s, { base: groundY, amp: h * 0.3, step: mini ? 4 : 6, cls: 'lp-far', scale: 18 });
    // A windmill on the far hill, its sails turning in the wind.
    const p = mini ? 1.5 : 2;
    const wx = x + w * (w > 400 ? 0.62 : 0.12);
    const base = groundY - h * 0.08;
    const top = base - WINDMILL.length * p;
    const sails = [45, 135, 225, 315].map((deg) => `<g transform="rotate(${deg})"><rect x="${r1(-p / 2)}" y="${r1(-11 * p)}" width="${p}" height="${r1(11 * p)}" fill="#7a5a3b"/><rect x="${r1(p / 2)}" y="${r1(-10 * p)}" width="${r1(2 * p)}" height="${r1(7 * p)}" fill="#f4f1ea"/></g>`).join('');
    out += `<g class="lp-prop">${px(WINDMILL, { r: '#c8553d', w: '#efe6d8', d: '#7a5a3b' }, p, wx - 3 * p, top)}`
      + at(wx, top + 1.5 * p, sails + `<rect x="${-p}" y="${-p}" width="${2 * p}" height="${2 * p}" fill="#5a3a22"/>`, 'lp-spin', `animation-duration:${sec(rng.range(5, 7))}`) + '</g>';
    out += ridge(s, { base: groundY, amp: h * 0.12, step: mini ? 4 : 6, cls: 'lp-mid', scale: 12 });
    return out;
  },
  props: (s) => (s.w > 400 ? tree(s, 0.97) + tree(s, 0.02, 0.8) : tree(s, 0.87, 1.35)),
  front: (s) => butterflies(s, 2),
  birds: '#3a4a5c',
};

const garden = {
  far(s) {
    const { groundY, h, mini, x, w } = s;
    const p = mini ? 2 : 3;
    let out = ridge(s, { base: groundY, amp: h * 0.08, step: mini ? 4 : 6, cls: 'lp-far', scale: 14 });
    // A cottage whose window lights up at night.
    const hx = x + w * 0.04;
    const roofY = groundY - 15 * p;
    out += `<g class="lp-prop">${px(['....rr....', '...rrrr...', '..rrrrrr..', '.rrrrrrrr.', 'rrrrrrrrrr'], { r: '#c8553d' }, p, hx, roofY)}`
      + `<rect x="${r1(hx + p)}" y="${r1(roofY + 5 * p)}" width="${8 * p}" height="${10 * p}" fill="#f2e3c6"/>`
      + `<rect x="${r1(hx + 5 * p)}" y="${r1(roofY + 9 * p)}" width="${2 * p}" height="${6 * p}" fill="#8a5a3b"/></g>`
      + `<rect x="${r1(hx + 2 * p)}" y="${r1(roofY + 7 * p)}" width="${2 * p}" height="${2 * p}" class="lp-day" fill="#9ad9ff"/>`
      + `<g class="lp-night"><rect x="${r1(hx + 1.5 * p)}" y="${r1(roofY + 6.5 * p)}" width="${3 * p}" height="${3 * p}" fill="#ffd166" opacity=".35" class="lp-glow"/>`
      + `<rect x="${r1(hx + 2 * p)}" y="${r1(roofY + 7 * p)}" width="${2 * p}" height="${2 * p}" fill="#ffe08a"/></g>`;
    return out;
  },
  props(s) {
    const { x, w, groundY, mini, pet, rng } = s;
    const p = mini ? 2 : 3;
    // A picket fence along the back of the yard.
    const top = groundY - 6 * p;
    let fence = `<rect x="${x}" y="${top + 2 * p}" width="${w}" height="${p}" fill="#efe6d8"/><rect x="${x}" y="${top + 4.5 * p}" width="${w}" height="${p}" fill="#efe6d8"/>`;
    for (let fx = x + 1; fx < x + w; fx += 3 * p) {
      fence += `<rect x="${fx}" y="${top + p}" width="${2 * p}" height="${5 * p + 2}" fill="#fbf7f0"/><rect x="${fx + p / 2}" y="${top}" width="${p}" height="${p}" fill="#fbf7f0"/>`;
    }
    let out = `<g class="lp-prop">${fence}</g>`;
    if (pet.mood !== 'zombie' && pet.season !== 'winter') {
      const spots = w > 400 ? [0.3, 0.55, 0.8, 0.95] : [0.82, 0.93];
      for (const fx of spots) {
        const f = px(SUNFLOWER, { y: '#ffd23f', b: '#7a4b2a', g: '#3c8a4b' }, p, -2.5 * p, -8 * p);
        out += at(x + w * fx, groundY + p * rng.range(0, 1), f, 'lp-sway-soft lp-prop', anim(rng.range(3, 5), rng.range(0, 4)));
      }
    }
    return out;
  },
  front: (s) => butterflies(s, 2),
  birds: '#3a4a5c',
};

const pond = {
  far(s) {
    const { groundY, h, mini, rng, x, w } = s;
    const lakeH = mini ? 9 : 14;
    let out = ridge(s, { base: groundY - lakeH, amp: h * 0.14, step: mini ? 3 : 4, cls: 'lp-far', scale: 8 });
    out += ridge(s, { base: groundY - lakeH, amp: h * 0.06, step: mini ? 3 : 4, cls: 'lp-mid', scale: 6 });
    out += `<rect x="${x}" y="${groundY - lakeH}" width="${w}" height="${lakeH}" class="lp-water"/>`;
    // Glints dancing on the water, and rings where a fish just jumped.
    for (let i = 0; i < (mini ? 4 : 7) * Math.max(1, Math.round(w / 200)); i++) {
      out += `<rect x="${r1(x + rng.range(4, w - 10))}" y="${r1(groundY - lakeH + rng.range(2, lakeH - 3))}" width="${rng.int(3, 7)}" height="1" class="lp-water2 lp-twinkle" style="${anim(rng.range(1.5, 3), rng.range(0, 3))}"/>`;
    }
    for (let i = 0; i < 2; i++) {
      out += at(x + rng.range(0.1, 0.9) * w, groundY - lakeH / 2, `<ellipse rx="${mini ? 7 : 10}" ry="${mini ? 2 : 3}" fill="none" stroke-width="1" class="lp-ripple-line"/>`, 'lp-ripple', anim(3, i * 1.5));
    }
    return out;
  },
  props(s) {
    const { x, w, groundY, mini, rng, pet } = s;
    const p = mini ? 2 : 3;
    let out = '';
    // Cattails swaying at the water's edge.
    for (const fx of w > 400 ? [0.01, 0.35, 0.68, 0.98] : [0.03, 0.95]) {
      let reeds = '';
      for (let i = 0; i < 4; i++) {
        const hgt = rng.range(7, 12) * p;
        const rx = (i - 1.5) * p * 1.6;
        reeds += `<rect x="${r1(rx)}" y="${r1(-hgt)}" width="${r1(p * 0.6)}" height="${r1(hgt)}" fill="#3c8a4b"/>`;
        if (i % 2 === 0 && pet.mood !== 'zombie') reeds += `<rect x="${r1(rx - p * 0.3)}" y="${r1(-hgt)}" width="${r1(p * 1.2)}" height="${r1(p * 2.4)}" fill="#7a4b2a"/>`;
      }
      out += at(x + w * fx, groundY + 2, reeds, 'lp-sway-soft lp-prop', anim(rng.range(3, 4.5), rng.range(0, 4)));
    }
    return out;
  },
  front: () => '',
  birds: '#3a4a5c',
};

const beach = {
  far(s) {
    const { groundY, h, mini, rng, x, w } = s;
    const seaH = Math.round(h * 0.17);
    const top = groundY - seaH;
    let out = ridge(s, { base: top, amp: h * 0.05, step: 4, cls: 'lp-mid', scale: 5 }).replace(/^<path/, '<path opacity=".8"');
    out += `<rect x="${x}" y="${top}" width="${w}" height="${seaH + 2}" class="lp-water"/>`;
    for (let row = 0; row < 3; row++) {
      let foam = '';
      for (let fx = x - 10; fx < x + w + 10; fx += mini ? 14 : 20) foam += `<rect x="${r1(fx + row * 6)}" y="0" width="${mini ? 5 : 8}" height="1.5" class="lp-water2"/>`;
      out += at(0, top + 3 + row * (seaH / 3.2), foam, 'lp-wave', anim(2.4 + row * 0.6, row));
    }
    for (let i = 0; i < 5 * Math.max(1, Math.round(w / 200)); i++) {
      out += `<rect x="${r1(x + rng.range(4, w - 6))}" y="${r1(top + rng.range(2, seaH - 2))}" width="2" height="2" fill="#ffffff" class="lp-twinkle" style="${anim(rng.range(1.2, 2.4), rng.range(0, 2))}"/>`;
    }
    // Foam washing onto the sand.
    out += at(x, groundY, `<rect x="0" y="-1" width="${w}" height="3" fill="#ffffff" opacity=".7"/>`, 'lp-tide', anim(4));
    return out;
  },
  props(s) {
    const { x, w, groundY, groundH, mini, rng, pet } = s;
    const p = mini ? 2 : 3;
    let out = '';
    for (const fx of w > 400 ? [0.97, 0.03] : [0.88]) {
      const palm = px(PALM, { f: pet.mood === 'zombie' ? '#8a8a5a' : '#3fa34d', F: '#2d7a3a', T: '#a0703f', c: '#6b3f1d' }, p, -7 * p, -PALM.length * p);
      out += at(x + w * fx, groundY + p * 2, palm, 'lp-sway-soft lp-prop', anim(4.5));
    }
    const sand = [];
    sand.push(at(x + w * 0.02, groundY + 4, px(CASTLE, { s: '#e3b866', d: '#a07a3a' }, mini ? 1.5 : 2, 0, -12), 'lp-prop'));
    for (let i = 0; i < 2 * Math.max(1, Math.round(w / 200)); i++) {
      const art = i % 2 ? px(STAR, { r: '#ff8c69' }, mini ? 1 : 1.5, 0, 0) : px(SHELL, { s: '#ffd9e6', S: '#ff9ab8' }, mini ? 1 : 1.5, 0, 0);
      sand.push(at(x + rng.range(0.1, 0.9) * w, groundY + rng.range(groundH * 0.45, groundH - 8), art, 'lp-prop'));
    }
    return out + sand.join('');
  },
  front: () => '',
  birds: '#ffffff',
};

const reef = {
  sky(s) {
    const { x, y, w, h, rng, mini } = s;
    let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="lp-sea"/>`;
    // Sunbeams slanting through the water, and the wavy surface above.
    for (let i = 0; i < 3 * Math.max(1, Math.round(w / 200)); i++) {
      const bx = x + rng.range(0, w);
      const bw = rng.range(10, 22) * (mini ? 0.7 : 1);
      out += `<path d="M${r1(bx)} ${y}h${r1(bw)}l${r1(-h * 0.35)} ${h}h${r1(-bw * 1.8)}Z" fill="#ffffff" class="lp-ray lp-day" style="${anim(rng.range(4, 7), rng.range(0, 6))}"/>`;
    }
    let surface = '';
    for (let fx = x - 12; fx < x + w + 12; fx += 12) surface += `<rect x="${fx}" y="${y + 3}" width="6" height="2" fill="#ffffff" opacity=".5"/>`;
    out += at(0, 0, surface, 'lp-wave', anim(3));
    for (let i = 0; i < 9 * Math.max(1, Math.round(w / 200)); i++) {
      out += `<circle cx="${r1(x + rng.range(4, w - 4))}" cy="${r1(y + rng.range(8, h * 0.75))}" r="1.2" fill="#7df9ff" class="lp-night lp-twinkle" style="${anim(rng.range(1.6, 3.2), rng.range(0, 3))}"/>`;
    }
    return out;
  },
  far(s) {
    const { groundY, h, mini } = s;
    return ridge(s, { base: groundY, amp: h * 0.16, step: mini ? 4 : 6, cls: 'lp-far', scale: 10 });
  },
  props(s) {
    const { x, w, groundY, mini, rng, pet } = s;
    const p = mini ? 2 : 3;
    const dead = pet.mood === 'zombie';
    let out = '';
    // Kelp sways from its root; coral sits still and bright.
    for (const fx of w > 400 ? [0.01, 0.3, 0.62, 0.99] : [0.04, 0.94]) {
      let kelp = '';
      const n = rng.int(9, 14);
      for (let i = 0; i < n; i++) kelp += `<rect x="${(i % 2) * p - p}" y="${-(i + 1) * p * 1.3}" width="${p}" height="${r1(p * 1.4)}" fill="${dead ? '#6b6b4a' : i % 3 ? '#2f9e5a' : '#46c072'}"/>`;
      out += at(x + w * fx, groundY + p, kelp, 'lp-kelp lp-prop', anim(rng.range(3, 4.5), rng.range(0, 4)));
    }
    for (const fx of w > 400 ? [0.15, 0.85] : [0.84]) {
      out += at(x + w * fx, groundY + p, px(CORAL, { p: dead ? '#a89a9a' : rng.pick(['#ff6f91', '#ff9f5a', '#c77dff']) }, p, -3.5 * p, -7 * p), 'lp-prop');
    }
    return out;
  },
  front(s) {
    const { x, w, y, h, groundY, rng, mini } = s;
    const p = mini ? 1 : 1.5;
    let out = '';
    for (let i = 0; i < (mini ? 6 : 9) * Math.max(1, Math.round(w / 200)); i++) {
      const r = rng.range(1.5, 3.5) * (mini ? 0.7 : 1);
      out += at(x + rng.range(0.03, 0.97) * w, groundY - rng.range(0, 10), `<circle r="${r1(r)}" class="lp-bubble-c"/>`, 'lp-bubbling', anim(rng.range(4, 7), rng.range(0, 7)));
    }
    for (let i = 0; i < 2 * Math.max(1, Math.round(w / 200)); i++) {
      const color = rng.pick(['#ffb703', '#ff7096', '#4cc9f0']);
      out += at(x + w + rng.range(10, 120), y + rng.range(0.25, 0.55) * h, px(FISH, { o: color, e: '#1b1b2f' }, p, 0, 0), 'lp-swim', anim(rng.range(11, 16), rng.range(0, 16)));
    }
    return out;
  },
  noSky: true,
  noWeather: true,
};

const jungle = {
  far(s) {
    const { groundY, h, mini, x, w, rng } = s;
    let out = ridge(s, { base: groundY, amp: h * 0.3, step: mini ? 3 : 4, cls: 'lp-far', scale: 7 });
    // A waterfall tumbling off a cliff, with a puff of spray at its foot.
    const cx = x + w * (w > 400 ? 0.5 : 0.74);
    const top = groundY - h * 0.4;
    const fw = mini ? 8 : 12;
    // A stepped rocky cliff with the falls pouring over its lip.
    out += `<path d="M${r1(cx - fw * 1.6)} ${groundY}V${r1(top + 10)}H${r1(cx - fw * 1.1)}V${r1(top - 3)}H${r1(cx + fw * 1.1)}V${r1(top + 6)}H${r1(cx + fw * 1.7)}V${groundY}Z" class="lp-mid"/>`;
    out += `<rect x="${r1(cx - fw / 2)}" y="${r1(top - 3)}" width="${fw}" height="${r1(groundY - top + 3)}" class="lp-water"/>`;
    out += `<rect x="${r1(cx - fw / 2 - 2)}" y="${r1(top - 4)}" width="${fw + 4}" height="2" class="lp-water2"/>`;
    for (let i = 0; i < 6; i++) {
      out += at(cx - fw / 2 + rng.range(1, fw - 2), top + rng.range(0, groundY - top - 20), `<rect width="1.5" height="${mini ? 5 : 8}" class="lp-water2"/>`, 'lp-flow', anim(rng.range(0.8, 1.3), rng.range(0, 1.3)));
    }
    out += at(cx, groundY - 2, `<ellipse rx="${fw * 1.2}" ry="${fw * 0.35}" fill="#ffffff" opacity=".6"/>`, 'lp-glow', anim(1.4));
    out += ridge(s, { base: groundY, amp: h * 0.12, step: mini ? 3 : 4, cls: 'lp-mid', scale: 5 });
    return out;
  },
  props(s) {
    const { x, w, groundY, mini, rng, pet } = s;
    const p = mini ? 2 : 3;
    const green = pet.mood === 'zombie' ? '#7a7a55' : '#2f8f46';
    const light = pet.mood === 'zombie' ? '#8f8f66' : '#4cbf5e';
    let out = '';
    // Big fronds at the edges, leaning in from the undergrowth.
    for (const [fx, flip] of w > 400 ? [[0, 1], [0.33, -1], [0.66, 1], [1, -1]] : [[0, 1], [1, -1]]) {
      let frond = '';
      for (let i = 0; i < 7; i++) {
        frond += `<rect x="${r1(flip * i * p * 1.2 - (flip < 0 ? p * 3 : 0))}" y="${r1(-i * p * 1.6 - 3 * p)}" width="${p * 3}" height="${p}" fill="${i % 2 ? green : light}"/>`;
        frond += `<rect x="${r1(flip * i * p * 1.2)}" y="${r1(-i * p * 1.6 - 2 * p)}" width="${p}" height="${p * 2}" fill="${green}"/>`;
      }
      out += at(x + w * fx, groundY + p, frond, 'lp-sway-soft lp-prop', anim(rng.range(3.5, 5), rng.range(0, 4)));
    }
    return out;
  },
  front: (s) => mist(s, 2, { opacity: 0.22, y0: -2, spread: 10 }),
  overhead(s) {
    const { x, y, w, h, mini, rng, pet } = s;
    const p = mini ? 2 : 3;
    let out = '';
    // Vines hanging from the canopy above.
    for (const fx of w > 400 ? [0.2, 0.45, 0.8] : [0.06, 0.93]) {
      let vine = '';
      const len = rng.int(8, 14);
      for (let i = 0; i < len; i++) {
        vine += `<rect x="0" y="${i * p * 1.4}" width="${r1(p * 0.7)}" height="${r1(p * 1.4)}" fill="#2d6b3a"/>`;
        if (i % 3 === 1) vine += `<rect x="${i % 2 ? p * 0.7 : -p * 1.5}" y="${i * p * 1.4}" width="${r1(p * 1.5)}" height="${p}" fill="${pet.mood === 'zombie' ? '#7a7a55' : '#4cbf5e'}"/>`;
      }
      out += at(x + w * fx, y - 2, vine, 'lp-sway-soft lp-prop', anim(rng.range(4, 6), rng.range(0, 5)));
    }
    if (s.pet.mood !== 'hibernating') {
      for (let i = 0; i < 6 * Math.max(1, Math.round(w / 200)); i++) {
        out += `<rect x="${r1(x + rng.range(6, w - 6))}" y="${r1(y + rng.range(0.35, 0.8) * h)}" width="2" height="2" class="lp-firefly lp-twinkle lp-night" style="${anim(rng.range(1.2, 2.4), rng.range(0, 2))}"/>`;
      }
    }
    return out;
  },
  birds: '#2d3b2f',
};

const desert = {
  sky(s) {
    const { x, y, w, h, mini, pet } = s;
    if (pet.season === 'summer') return '';
    const p = mini ? 2 : 3;
    // The desert sun shines every season.
    const sun = px(['..yyyy..', '.yyyyyy.', 'yyyyyyyy', 'yyyyyyyy', 'yyyyyyyy', 'yyyyyyyy', '.yyyyyy.', '..yyyy..'], { y: '#ffd23f' }, p, 0, 0);
    return `<g class="lp-day">${at(x + w - (mini ? 24 : 36), y + (mini ? 8 : 12), sun)}</g>`;
  },
  far(s) {
    const { groundY, h, mini, x, w } = s;
    // Flat-topped mesas in the distance, then rolling dunes.
    let out = '';
    const mesas = w > 400 ? [[0.08, 0.16, 0.2], [0.55, 0.12, 0.26], [0.8, 0.1, 0.16]] : [[0.05, 0.3, 0.22], [0.6, 0.22, 0.15]];
    for (const [fx, fw, fh] of mesas) {
      const mx = x + w * fx;
      const mw = w * fw;
      const top = groundY - h * fh;
      out += `<path d="M${r1(mx)} ${groundY}V${r1(top + 6)}H${r1(mx + 4)}V${r1(top)}H${r1(mx + mw - 4)}V${r1(top + 6)}H${r1(mx + mw)}V${groundY}Z" class="lp-far"/>`;
    }
    out += ridge(s, { base: groundY, amp: h * 0.07, step: mini ? 4 : 6, cls: 'lp-mid', scale: 26 });
    // Heat haze shimmering just above the horizon.
    out += at(x, groundY - h * 0.05, `<rect width="${w}" height="2" fill="#ffffff" opacity=".35"/>`, 'lp-haze lp-day', anim(2.2));
    return out;
  },
  props(s) {
    const { x, w, groundY, groundH, mini, rng, pet } = s;
    const p = mini ? 2 : 3;
    let out = '';
    for (const fx of w > 400 ? [0.02, 0.4, 0.98] : [0.04, 0.92]) {
      out += at(x + w * fx, groundY + p, px(CACTUS, { g: pet.mood === 'zombie' ? '#7f8a5a' : '#3f9a4a' }, p, -2.5 * p, -7 * p), 'lp-prop');
    }
    for (let i = 0; i < 3 * Math.max(1, Math.round(w / 200)); i++) {
      out += `<rect x="${r1(x + rng.range(6, w - 10))}" y="${r1(groundY + rng.range(8, groundH - 6))}" width="${rng.int(3, 5)}" height="2" fill="#c99a5b" class="lp-prop"/>`;
    }
    return out;
  },
  front(s) {
    const { x, w, groundY, mini, rng } = s;
    const p = mini ? 1.5 : 2;
    let out = '';
    // Tumbleweeds bouncing across the dunes.
    for (let i = 0; i < Math.max(1, Math.round(w / 260)); i++) {
      const weed = at(0, 0, px(TUMBLEWEED, { b: '#a6773f' }, p, -3 * p, -3 * p), 'lp-spin', 'animation-duration:1.2s');
      out += at(x - 30 + rng.range(0, w - 200), groundY + 4 - 3 * p, weed, 'lp-roll lp-prop', anim(rng.range(8, 11), rng.range(0, 11)));
    }
    return out;
  },
  birds: null,
};

export const SCENERY = { meadow, garden, pond, beach, reef, jungle, desert };

// --- effects shared by every home ------------------------------------------------------------

function shootingStars(s) {
  const { rng, x, y, w, h } = s;
  let out = '';
  for (let i = 0; i < Math.max(1, Math.round(w / 260)); i++) {
    const streak = '<rect x="0" y="0" width="14" height="1.5" fill="#fff8d6" transform="rotate(-27)"/><rect x="-1" y="-1" width="3" height="3" fill="#ffffff"/>';
    out += at(x + rng.range(0.4, 0.9) * w, y + rng.range(0.05, 0.25) * h, streak, 'lp-shoot', anim(rng.range(6, 9), rng.range(0, 9)));
  }
  return out;
}

// Northern lights: thin curtains of light whose tops follow a slow wave, each shimmering on its own.
function aurora(s) {
  const { x, y, w, h, rng, mini } = s;
  const step = mini ? 3 : 4;
  const ph = rng.range(0, 6.28);
  let out = '';
  for (let gx = 0; gx < w; gx += step) {
    const wave = Math.sin(gx / 28 + ph);
    const top = y + h * (0.1 + 0.06 * wave);
    const len = h * (0.12 + 0.07 * Math.cos(gx / 17 + ph));
    const color = wave > 0.3 ? '#b388ff' : '#5effc4';
    out += `<rect x="${r1(x + gx)}" y="${r1(top)}" width="${step - 1}" height="${r1(len)}" fill="${color}" class="lp-aurora" style="${anim(rng.range(3, 6), rng.range(0, 6))}"/>`;
  }
  return out;
}

function rainbow(s) {
  const { x, w, groundY, h } = s;
  const cx = x + w * 0.55;
  const r0 = Math.min(w * 0.38, h * 0.55);
  const colors = ['#ff5f5f', '#ffa94d', '#ffe066', '#7ee081', '#5ec8ff', '#b388ff'];
  const arcs = colors.map((c, i) => {
    const r = r1(r0 - i * 3.2);
    return `<path d="M${r1(cx - r)} ${groundY}A${r} ${r} 0 0 1 ${r1(cx + r)} ${groundY}" fill="none" stroke="${c}" stroke-width="3.4"/>`;
  }).join('');
  return `<g class="lp-rainbow lp-day">${arcs}</g>`;
}

function bunting(s) {
  const { x, y, w, mini } = s;
  const colors = ['#ff5fa2', '#ffd23f', '#5ec8ff', '#7ee081', '#b388ff', '#ff8c42'];
  const step = mini ? 12 : 16;
  const sag = mini ? 8 : 12;
  let flags = `<path d="M${x} ${y + 4}Q${r1(x + w / 2)} ${y + 4 + sag * 2} ${x + w} ${y + 4}" fill="none" stroke="#7a5a3a" stroke-width="1"/>`;
  for (let fx = step / 2, i = 0; fx < w; fx += step, i++) {
    const t = fx / w;
    const fy = y + 4 + sag * 2 * 2 * t * (1 - t);
    const fw = mini ? 4 : 5;
    flags += at(x + fx, fy, `<path d="M${-fw} 0H${fw}L0 ${fw * 1.8}Z" fill="${colors[i % colors.length]}"/>`, 'lp-flag', anim(1.6 + (i % 3) * 0.3, i * 0.2));
  }
  return flags;
}

function stringLights(s) {
  const { x, y, w, mini } = s;
  const colors = ['#ff4d6d', '#ffd23f', '#7ee081', '#5ec8ff'];
  const step = mini ? 11 : 14;
  const sag = mini ? 7 : 10;
  let out = `<path d="M${x} ${y + 3}Q${r1(x + w / 2)} ${y + 3 + sag * 2} ${x + w} ${y + 3}" fill="none" stroke="#2b4a2b" stroke-width="1.2"/>`;
  for (let fx = step / 2, i = 0; fx < w; fx += step, i++) {
    const t = fx / w;
    const fy = y + 3 + sag * 2 * 2 * t * (1 - t);
    out += `<rect x="${r1(x + fx - 1.5)}" y="${r1(fy)}" width="3" height="4" rx="1" fill="${colors[i % colors.length]}" class="lp-bulb" style="animation-delay:-${sec((i % 2) * 0.6)}"/>`;
  }
  return out;
}

function snowman(s) {
  const { x, w, groundY, mini } = s;
  const p = mini ? 2 : 2.5;
  const art = px(SNOWMAN, { h: '#2b2b38', w: '#ffffff', k: '#2b2b38', b: '#e63946' }, p, -3 * p, -SNOWMAN.length * p);
  return at(x + w * (w > 400 ? 0.5 : 0.76), groundY + p * 2, art, 'lp-prop');
}

function maiBranch(s) {
  const { x, y, w, mini, rng } = s;
  const p = mini ? 1.5 : 2;
  const len = Math.min(w * 0.4, 90);
  let out = `<path d="M${x} ${y + 6}Q${r1(x + len * 0.5)} ${y + 2} ${r1(x + len)} ${y + 16}" fill="none" stroke="#5a3a22" stroke-width="${mini ? 2 : 3}"/>`;
  out += `<path d="M${r1(x + len * 0.4)} ${y + 6}l10 14" fill="none" stroke="#5a3a22" stroke-width="2"/>`;
  for (let i = 0; i < (mini ? 6 : 9); i++) {
    const t = rng.range(0.1, 1);
    const bx = x + len * t + rng.range(-4, 4);
    const by = y + 4 + 12 * t * t + rng.range(-3, 5);
    out += at(bx, by, px(MAI, { y: '#ffd23f', o: '#e07a00' }, p, -1.5 * p, -1.5 * p), 'lp-twinkle-soft', anim(rng.range(2, 3), rng.range(0, 3)));
  }
  return out;
}

function maiPetals(s) {
  const { rng, x, y, w } = s;
  let out = '';
  for (let i = 0; i < 6 * Math.max(1, Math.round(w / 200)); i++) {
    out += at(x + rng.range(0, w * 0.6), y, '<rect x="-1.5" y="-1.5" width="3" height="3" fill="#ffd23f"/>', 'lp-drift', anim(rng.range(7, 11), rng.range(0, 11)));
  }
  return out;
}

// Effects that sit in the sky, behind hills and props.
export function skyFx(s) {
  const { pet } = s;
  const home = SCENERY[s.home];
  const alwaysNight = pet.mood === 'hibernating';
  let out = '';
  if (home.sky) out += home.sky(s);
  if (home.noSky) return out;
  if (!alwaysNight && (pet.mood === 'ecstatic' || pet.mood === 'party')) out += rainbow(s);
  if (pet.season === 'winter' || alwaysNight) out += `<g class="${alwaysNight ? '' : 'lp-night'}">${aurora(s)}</g>`;
  out += `<g class="${alwaysNight ? '' : 'lp-night'}">${shootingStars(s)}</g>`;
  if (!alwaysNight && home.birds && pet.mood !== 'zombie') out += `<g class="lp-day lp-px">${flock(s, 2, home.birds)}</g>`;
  if (pet.holiday === 'halloween' || pet.mood === 'zombie') {
    out += `<g class="lp-px">${flock(s, pet.holiday === 'halloween' ? 3 : 1, '#2b1d3a', { sprite: BAT, dur: [9, 13], yMax: 0.4 })}</g>`;
  }
  return out;
}

// The home's horizon, drawn right before the ground.
export const farFx = (s) => `<g class="lp-px">${SCENERY[s.home].far(s)}</g>`;

// Props that stand behind the pet.
export function propsFx(s) {
  const { pet } = s;
  let out = SCENERY[s.home].props(s);
  if (pet.holiday === 'christmas' && pet.mood !== 'egg') out += snowman(s);
  return `<g class="lp-px">${out}</g>`;
}

// Things in front of the pet: fog, bubbles, tumbleweeds, festive decorations.
export function frontFx(s) {
  const { pet } = s;
  const home = SCENERY[s.home];
  let out = home.front(s);
  if (home.overhead) out += home.overhead(s);
  if (pet.mood === 'zombie') out += mist(s, 3, { color: '#d8d0e8', opacity: 0.45, y0: 4, spread: 16 });
  if (pet.mood === 'party') out += bunting(s);
  if (pet.holiday === 'christmas') out += stringLights(s);
  if (pet.holiday === 'tet') out += maiBranch(s) + maiPetals(s);
  return out ? `<g class="lp-px">${out}</g>` : '';
}

export const homeOf = (pet) => (HOMES.includes(pet.home) ? pet.home : pet.species?.home ?? 'meadow');
