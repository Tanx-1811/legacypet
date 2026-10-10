// The scenes the terminal plays. A commit gets eaten, a push takes off in a rocket, a pull
// rains gifts, a new branch gets a signpost and `legacypet hi` says hello. A scene draws a
// stage of pixels at time t, plus a panel of text beside it, and can pause at `waitAt`
// (the pet keeps chewing) until the numbers it needs have been read from git.
import { MOOD_EMOJI } from '../engine/mood.js';
import { withDefaults } from '../engine/vitals.js';
import { strings } from '../i18n/index.js';
import { MOVE_MOODS } from '../render/moves.js';
import { textWidth, truncate, wrapText } from '../util/text.js';
import { drawBitmap, REST } from './actor.js';
import { arc, confettiPieces, drawBurst, drawConfetti, foodFor, GIFT_COLORS, PROPS, sprite } from './fx.js';
import { Canvas, clip, createPlayer, paint, sideBySide, sleep } from './screen.js';

const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const hop = (u, height) => Math.sin(clamp01(u) * Math.PI) * height;

const GOLD = '#ffd23f';
const DIM = '#7d8590';
const GREEN = '#7ee081';

// --- the panel ------------------------------------------------------------------------------

// A speech bubble whose tail points left, at the pet. `shown` types it out a few characters at a time.
export function bubble(text, maxWidth, { shown = Infinity, mode = 'true' } = {}) {
  const p = paint(mode);
  const lines = wrapText(text, Math.max(10, maxWidth - 5), 2);
  const inner = Math.max(...lines.map(textWidth));
  let left = shown;
  const edge = (s) => p(s, { fg: DIM });
  const body = lines.map((line, i) => {
    let visible = '';
    for (const ch of line) {
      if (left <= 0) break;
      visible += ch;
      left -= 1;
    }
    left -= 1; // the space the wrap took away
    return `${edge(i === 0 ? '─┤' : ' │')} ${visible}${' '.repeat(Math.max(0, inner - textWidth(visible)))} ${edge('│')}`;
  });
  return [edge(` ╭${'─'.repeat(inner + 2)}╮`), ...body, edge(` ╰${'─'.repeat(inner + 2)}╯`)];
}

export function bar(fraction, width, color, mode) {
  const n = Math.round(clamp01(fraction) * width);
  if (mode === 'none') return `[${'#'.repeat(n)}${'-'.repeat(width - n)}]`;
  const p = paint(mode);
  return p('━'.repeat(n), { fg: color }) + p('━'.repeat(width - n), { fg: '#3d444d' });
}

const dot = (mode) => paint(mode)(' · ', { fg: DIM });

// "Mochi · Lv.12 🥉 Bronze · 😊 happy"
export function nameLine(pet, mode) {
  const tr = strings(pet.lang);
  const p = paint(mode);
  const rank = pet.rank ? ` ${pet.rank.emoji} ${tr.ranks[pet.rank.id] ?? ''}` : '';
  return [p(pet.name, { bold: true }), `Lv.${pet.level}${rank}`, `${MOOD_EMOJI[pet.mood] ?? ''} ${tr.moods[pet.mood] ?? pet.mood}`].join(dot(mode));
}

// How full the bar to the next level is, counted in commits (like levelProgress).
export function levelFraction(pet) {
  const next = pet.progress?.nextLevel;
  if (!next) return 1;
  const rate = withDefaults(pet.species?.modifiers).xpRate;
  const need = (lv) => Math.ceil((lv - 1) ** 2 / rate);
  const span = need(next.level) - need(pet.level);
  return span > 0 ? clamp01(1 - next.commits / span) : 1;
}

export function xpLine(pet, w, mode, fill = null) {
  const next = pet.progress?.nextLevel;
  if (!next) return paint(mode)(`★ ${w.maxLevel}`, { fg: GOLD, bold: true });
  return `${bar(fill ?? levelFraction(pet), 16, pet.rank?.color ?? GREEN, mode)} ${w.toNext(next.commits, next.level)}`;
}

const VITAL_ICONS = { fullness: '🍖', health: '💚', joy: '😊', energy: '⚡' };
const VITAL_COLORS = { fullness: '#ff8c42', health: '#7ee081', joy: '#ffd23f', energy: '#5ec8ff' };

export function vitalsLines(pet, mode) {
  const cell = (key) => `${VITAL_ICONS[key]} ${bar((pet.vitals[key] ?? 0) / 100, 8, VITAL_COLORS[key], mode)} ${String(pet.vitals[key] ?? 0).padStart(3)}`;
  return [`${cell('fullness')}  ${cell('health')}`, `${cell('joy')}  ${cell('energy')}`];
}

// The one thing worth saying out loud after a commit, if anything.
export function highlight(ctx) {
  const { pet, data = {}, w, tr, now } = ctx;
  if (!pet) return null;
  const events = new Set(pet.events);
  if (events.has('hatched')) return w.hatched(pet.name);
  if (events.has('revived')) return w.revived;
  if (events.has('rankUp')) return w.rankUp(tr.ranks[pet.rank.id], pet.rank.emoji);
  if (events.has('levelUp')) return w.levelUp(pet.level);
  if (pet.mood === 'egg') return w.egg(Math.max(1, 5 - (pet.facts.totalCommits ?? 0)));
  const total = pet.facts.totalCommits;
  if (total && (total % 100 === 0 || [10, 25, 50].includes(total))) return w.milestone(total);
  if (data.firstToday && [3, 7, 14, 30, 50, 100, 200, 365].includes(pet.facts.streak)) return w.streak(pet.facts.streak);
  const hour = now.getHours();
  if (hour >= 23 || hour < 5) return w.night;
  if (data.firstToday) return now.getDay() === 0 || now.getDay() === 6 ? w.weekend : w.first;
  if ((data.added ?? 0) + (data.deleted ?? 0) >= 400) return w.feast(data.added + data.deleted);
  return null;
}

// Which big moment the stage celebrates with a banner and confetti.
export function celebration(pet) {
  if (!pet) return null;
  return ['hatched', 'revived', 'rankUp', 'levelUp'].find((e) => pet.events.includes(e)) ?? null;
}

function banner(canvas, text, x, t) {
  const col = Math.max(0, Math.min(canvas.width - textWidth(text), Math.round(x - textWidth(text) / 2)));
  canvas.text(col, 0, text, Math.floor(t / 0.15) % 2 ? '#fff3b0' : GOLD, { bold: true });
}

function rising(canvas, art, x, y, u, { life = 0.9, speed = 7, sway = 1 } = {}) {
  if (u < 0 || u > life) return;
  drawBitmap(canvas, art, x + Math.sin(u * 8) * sway, y - u * speed, REST);
}

// --- what the pet says ----------------------------------------------------------------------

const MAIN_BRANCHES = new Set(['main', 'master', 'trunk', 'develop', 'dev']);

// The pet's line for each event. Also the one line printed where there's nothing to draw on.
export const SAY = {
  commit(ctx) {
    const { w, info } = ctx;
    if (info.action === 'amend') return w.amend;
    if (info.action === 'initial') return w.initial;
    const species = ctx.pet?.species ?? ctx.lookPet?.species;
    if (info.kind === 'other' && species?.food === 'water') return w.food.water;
    return w.food[info.kind] ?? w.food.other;
  },
  push(ctx) {
    const d = ctx.data ?? {};
    if (d.tag) return ctx.w.pushTag(d.tag);
    if (d.gone) return ctx.w.pushDelete(d.branch);
    if (d.fresh) return ctx.w.pushNew(d.branch);
    return ctx.w.push(d.count ?? 0, d.to ?? ctx.info.remote ?? 'origin');
  },
  merge: (ctx) => ctx.w.pulled(ctx.data?.count ?? 0),
  checkout(ctx) {
    const { w, info } = ctx;
    if (!info.branch) return w.detached(String(info.sha ?? '').slice(0, 7));
    return MAIN_BRANCHES.has(info.branch) ? w.home(info.branch) : w.branch(info.branch);
  },
  hello: (ctx) => (ctx.pet ?? ctx.lookPet)?.speech ?? ctx.w.live.hello((ctx.pet ?? ctx.lookPet)?.name ?? '🐣'),
};

// "🐣 Mochi: Nom nom! …"
export function sayLine(event, ctx) {
  const name = (ctx.pet ?? ctx.lookPet)?.name;
  return `🐣 ${name ? `${name}: ` : ''}${SAY[event](ctx)}`;
}

// --- commit: the pet eats it ------------------------------------------------------------------

export function commitScene(ctx) {
  const s = ctx.look.scale;
  const W = 34 * s;
  const H = 22 * s;
  const P = { x: 10 * s, y: H };
  const T = { fly: 0.25, eat: 0.8, react: 1.4, party: 2.4 };
  const food = sprite(foodFor(ctx.info.kind, ctx.look.pet.species), s);
  const heart = sprite(PROPS.tinyHeart, s);
  const from = { x: W - 4 * s, y: 7 * s };
  const confetti = confettiPieces(ctx.info.sha ?? 'commit', 18 * s, W);
  const party = () => (ctx.ready ? celebration(ctx.pet) : null);
  const say = () => SAY.commit(ctx);

  return {
    size: { w: W, h: H },
    waitAt: T.react,
    get duration() {
      return party() ? 3.6 : 2.5;
    },
    draw(c, t, wall, final) {
      const actor = (t >= T.react || final) && ctx.final ? ctx.final : ctx.look;
      if (final) {
        actor.draw(c, P.x, P.y, 0, { idle: false, blink: false });
        return;
      }
      const egg = actor.pet.mood === 'egg';
      const mouth = { x: P.x + actor.mouth.x, y: P.y + actor.mouth.y };
      let face = null;
      let pose = null;
      let move = null;
      let idle = true;
      if (t < T.fly) {
        drawBitmap(c, food, from.x, from.y + Math.round(Math.sin(wall * 9) * s * 0.6), REST);
      } else if (t < T.eat) {
        const f = (t - T.fly) / (T.eat - T.fly);
        const p = arc(from, { x: mouth.x + 2 * s, y: mouth.y + food.h / 2 }, ease(f), 6 * s);
        drawBitmap(c, food, p.x, p.y, REST);
        face = 'hungry';
        pose = { dx: Math.round(f * s) };
      } else if (t < T.react) {
        const chew = Math.floor(wall / 0.14) % 2;
        face = chew ? 'ecstatic' : 'hungry';
        pose = egg ? { rot: Math.sin(wall * 30) * 12 } : { sx: chew ? 1.06 : 1, sy: chew ? 0.94 : 1 };
        idle = false;
        const u = t - T.eat;
        for (let i = 0; i < 3; i++) {
          const k = (u * 2.2 + i / 3) % 1;
          c.set(mouth.x + (i - 1) * s * 1.5, mouth.y + k * 6 * s, food.data.find(Boolean));
        }
        if (u < 0.5 && !egg) c.text(mouth.x + 5 * s, Math.floor((mouth.y - 6 * s) / 2), ctx.w.nom, GOLD, { bold: true });
      } else {
        const u = t - T.react;
        const moving = !egg && actor.track && MOVE_MOODS.has(actor.pet.mood) && u < actor.track.seconds;
        if (moving) {
          move = u;
          idle = false;
        } else if (u < 0.5) pose = { dy: -Math.round(hop(u / 0.5, 3 * s)) };
        const head = P.y - actor.height - s;
        rising(c, heart, P.x - 5 * s, head, u);
        rising(c, heart, P.x + 6 * s, head + 2 * s, u - 0.35);
        if (u < 0.8) c.text(P.x + 7 * s, Math.floor((head - 2 * s - u * 6 * s) / 2), '+1', GREEN, { bold: true });
        const kind = party();
        if (kind && t >= T.party) {
          const v = t - T.party;
          banner(c, ctx.w.banner[kind] ?? ctx.tr.levelUpBanner, P.x + 4 * s, v);
          drawBurst(c, P.x, P.y - actor.height / 2, v / 0.7, { reach: 13 * s, count: 10 });
          drawBurst(c, P.x, P.y - actor.height / 2, (v - 0.3) / 0.7, { reach: 9 * s, count: 8, color: '#ff5fa2' });
          drawConfetti(c, confetti, v);
          if (!moving) {
            pose = { dy: -Math.round(hop((v % 0.55) / 0.55, 3 * s)) };
            face = kind === 'levelUp' || kind === 'rankUp' ? 'party' : null;
          }
        }
      }
      actor.draw(c, P.x, P.y, wall, { face: egg ? null : face, pose, move, idle });
    },
    panel(t, width, final) {
      const { w, mode } = ctx;
      const p = paint(mode);
      const out = [];
      const shown = final ? Infinity : Math.max(0, (t - T.eat + 0.1) * 50);
      out.push(...(final || t >= T.eat - 0.1 ? bubble(say(), width, { shown, mode }) : ['', '', '']));
      const sha = ctx.info.sha ? ctx.info.sha.slice(0, 7) : '';
      out.push(p(truncate([sha, ctx.info.subject].filter(Boolean).join(' · '), width), { fg: DIM }));
      const pet = ctx.ready && ctx.pet ? ctx.pet : ctx.lookPet;
      out.push(nameLine(pet, mode));
      if (ctx.ready && ctx.pet) {
        const target = levelFraction(ctx.pet);
        const leveled = ctx.pet.events.includes('levelUp');
        const span = ctx.pet.progress?.nextLevel ? 1 / Math.max(1, ctx.pet.progress.nextLevel.commits + 1) : 0;
        const before = leveled ? 0 : Math.max(0, target - span);
        const fill = final ? target : before + (target - before) * ease(clamp01((t - T.react) / 0.6));
        out.push(xpLine(ctx.pet, w, mode, fill));
        const d = ctx.data ?? {};
        const facts = [
          ctx.pet.facts.streak >= 2 ? w.streakDays(ctx.pet.facts.streak) : null,
          d.today != null ? w.today(d.today) : null,
          d.added != null ? w.lines(d.added, d.deleted) : null,
        ].filter(Boolean);
        out.push(facts.join(dot(mode)));
        const hl = highlight(ctx);
        out.push(hl && (final || t >= T.react) ? p(hl, { fg: GOLD, bold: true }) : '');
      } else out.push(p('…', { fg: DIM }), '', '');
      return out;
    },
    text() {
      const lines = [sayLine('commit', ctx)];
      if (ctx.pet) {
        const next = ctx.pet.progress?.nextLevel;
        lines.push([`Lv.${ctx.pet.level} ${ctx.pet.rank.emoji}`, next ? ctx.w.toNext(next.commits, next.level) : ctx.w.maxLevel,
          ctx.pet.facts.streak >= 2 ? ctx.w.streakDays(ctx.pet.facts.streak) : null].filter(Boolean).join(' · '));
        const hl = highlight(ctx);
        if (hl) lines.push(hl);
      }
      return lines;
    },
  };
}

// --- push: a rocket takes the commits away -----------------------------------------------------

export function pushScene(ctx) {
  const s = ctx.look.scale;
  const W = 30 * s;
  const H = 22 * s;
  const P = { x: 10 * s, y: H };
  const R = { x: 22 * s, y: H };
  const T = { lift: 0.45, gone: 1.45 };
  const rocket = sprite(PROPS.rocket, s);
  const flame = sprite(PROPS.flame, s);
  const confetti = confettiPieces(`push|${ctx.info.to}`, 16 * s, W);
  const tag = () => ctx.data?.tag;
  const say = () => SAY.push(ctx);
  return {
    size: { w: W, h: H },
    waitAt: 0.3,
    duration: 2.1,
    draw(c, t, wall, final) {
      const actor = ctx.final ?? ctx.look;
      if (final) {
        actor.draw(c, P.x, P.y, 0, { idle: false, blink: false });
        return;
      }
      let pose = null;
      let face = 'party';
      if (t < T.lift) {
        drawBitmap(c, rocket, R.x, R.y - s, REST);
        if (Math.floor(wall / 0.1) % 2) drawBitmap(c, flame, R.x, R.y, REST);
        pose = { dy: -Math.round(hop((t % 0.45) / 0.45, 2 * s)) };
      } else if (t < T.gone) {
        const u = t - T.lift;
        const y = R.y - s - 34 * s * u * u;
        drawBitmap(c, rocket, R.x + Math.sin(u * 30) * 0.4, y, REST);
        drawBitmap(c, flame, R.x, y + flame.h + (Math.floor(wall / 0.06) % 2) * s, REST);
        for (let i = 1; i < 6; i++) c.set(R.x + ((i % 2) - 0.5) * s, y + flame.h + i * 2 * s, i < 3 ? '#ffb347' : '#8b949e');
        if (u < 0.7) {
          for (const side of [-1, 1]) {
            for (let k = 0; k < 3; k++) c.set(R.x + side * (2 + u * 10 + k) * s, H - 1 - k * s * 0.5, '#9aa5b1');
          }
        }
        face = 'ecstatic';
        pose = { rot: Math.sin(wall * 14) * 8 };
      } else {
        const u = t - T.gone;
        drawBurst(c, R.x, 2 * s, u / 0.5, { reach: 6 * s, count: 8 });
        if (tag()) drawConfetti(c, confetti, u);
        pose = { dy: -Math.round(hop((u % 0.5) / 0.5, 2 * s)) };
      }
      actor.draw(c, P.x, P.y, wall, { face, pose, idle: false });
    },
    panel(t, width, final) {
      const p = paint(ctx.mode);
      const out = [...bubble(say(), width, { shown: final ? Infinity : Math.max(0, (t - 0.3) * 50), mode: ctx.mode })];
      out.push(nameLine(ctx.pet ?? ctx.lookPet, ctx.mode));
      const d = ctx.data ?? {};
      out.push(p([d.branch, d.to].filter(Boolean).join(' → '), { fg: DIM }));
      out.push(d.friday ? p(ctx.w.friday, { fg: GOLD }) : '');
      return out;
    },
    text: () => [sayLine('push', ctx)],
  };
}

// --- merge / pull: gifts from the team ----------------------------------------------------

export function mergeScene(ctx) {
  const s = ctx.look.scale;
  const W = 42 * s;
  const H = 22 * s;
  const P = { x: 10 * s, y: H };
  const gift = PROPS.gift;
  const g = sprite(gift, s);
  const count = () => Math.max(1, Math.min(5, ctx.data?.count ?? 1));
  const spots = [[0, 0], [1, 0], [2, 0], [0.5, 1], [1.5, 1]];
  const drop = (i) => 0.3 + i * 0.22;
  const say = () => SAY.merge(ctx);
  return {
    size: { w: W, h: H },
    waitAt: 0.3,
    get duration() {
      return drop(count()) + 1.1;
    },
    draw(c, t, wall, final) {
      const actor = ctx.final ?? ctx.look;
      let landed = 0;
      for (let i = 0; i < count(); i++) {
        const [col, level] = spots[i];
        const x = 19 * s + col * (g.w + s) + g.w / 2;
        const ground = H - level * g.h;
        const u = final ? 9 : t - drop(i);
        if (u < 0) continue;
        const fall = Math.min(1, u / 0.35);
        const bounce = u > 0.35 && u < 0.5 ? -Math.round(hop((u - 0.35) / 0.15, 2 * s)) : 0;
        if (fall >= 1) landed += 1;
        const colored = sprite(gift, s, { b: GIFT_COLORS[i % GIFT_COLORS.length] });
        drawBitmap(c, colored, x, -g.h + (ground + g.h) * ease(fall) + bounce, REST);
      }
      if (final) {
        actor.draw(c, P.x, P.y, 0, { idle: false, blink: false });
        return;
      }
      const face = landed ? 'party' : 'hungry';
      const pose = landed ? { dy: -Math.round(hop((wall % 0.5) / 0.5, 2 * s)) } : null;
      actor.draw(c, P.x, P.y, wall, { face, pose, idle: !landed });
    },
    panel(t, width, final) {
      const p = paint(ctx.mode);
      const d = ctx.data ?? {};
      const out = [...bubble(say(), width, { shown: final ? Infinity : Math.max(0, (t - 0.3) * 50), mode: ctx.mode })];
      out.push(d.names?.length ? p(truncate(ctx.w.from(d.names.slice(0, 3).join(', '), Math.max(0, d.names.length - 3)), width), { fg: DIM }) : '');
      out.push(nameLine(ctx.pet ?? ctx.lookPet, ctx.mode));
      return out;
    },
    text: () => [sayLine('merge', ctx)],
  };
}

// --- checkout: off down a new branch --------------------------------------------------------

export function checkoutScene(ctx) {
  const s = ctx.look.scale;
  const label = truncate(ctx.info.branch ?? ctx.info.sha ?? '?', 28);
  const boardW = textWidth(label) + 2;
  const H = 22 * s;
  const W = ctx.look.width + 12 * s + boardW + 2;
  const signX = W - boardW - 1;
  const row = Math.floor((H - 13 * s) / 2);
  const x0 = Math.round(ctx.look.width / 2) + s;
  const x1 = signX - Math.round(ctx.look.width / 2) - 2 * s;
  const say = () => SAY.checkout(ctx);
  return {
    size: { w: W, h: H },
    waitAt: null,
    duration: 1.3,
    draw(c, t, wall, final) {
      for (let y = 2 * row + 2; y < H; y++) for (let k = 0; k < s; k++) c.set(signX + Math.floor(boardW / 2) + k, y, '#6b3e1f');
      for (let x = signX; x < signX + boardW; x++) for (const y of [2 * row, 2 * row + 1]) c.set(x, y, '#a0703c');
      c.text(signX + 1, row, label, '#fff3e0', { bold: true });
      const f = final ? 1 : ease(clamp01(t / 0.95));
      const step = final || t > 0.95 ? 0 : -Math.round(hop((t % 0.16) / 0.16, s));
      ctx.look.draw(c, x0 + (x1 - x0) * f, H, final ? 0 : wall, { pose: { dy: step }, idle: false, blink: !final });
    },
    panel(t, width, final) {
      return [...bubble(say(), width, { shown: final ? Infinity : t * 60, mode: ctx.mode }), nameLine(ctx.lookPet, ctx.mode)];
    },
    text: () => [sayLine('checkout', ctx)],
  };
}

// --- hello: `legacypet hi` --------------------------------------------------------------------

export function helloScene(ctx) {
  const s = ctx.look.scale;
  const W = 24 * s;
  const H = 22 * s;
  const P = { x: 12 * s, y: H };
  const heart = sprite(PROPS.tinyHeart, s);
  return {
    size: { w: W, h: H },
    waitAt: null,
    duration: 1.6,
    draw(c, t, wall, final) {
      const actor = ctx.final ?? ctx.look;
      if (final) {
        actor.draw(c, P.x, P.y, 0, { idle: false, blink: false });
        return;
      }
      const moving = actor.track && MOVE_MOODS.has(actor.pet.mood) && t > 0.5 && t - 0.5 < actor.track.seconds;
      const pose = t < 0.5 ? { dy: -Math.round(hop(t / 0.5, 3 * s)) } : null;
      rising(c, heart, P.x + 7 * s, P.y - actor.height, t - 0.2);
      actor.draw(c, P.x, P.y, wall, { pose, move: moving ? t - 0.5 : null, idle: !moving });
    },
    panel(t, width, final) {
      const { w, mode } = ctx;
      const pet = ctx.pet;
      const p = paint(mode);
      const d = ctx.data ?? {};
      const out = [...bubble(pet.speech, width, { shown: final ? Infinity : t * 70, mode })];
      out.push(nameLine(pet, mode));
      out.push(xpLine(pet, w, mode));
      out.push(...vitalsLines(pet, mode));
      const facts = [
        pet.facts.streak >= 2 ? w.streakDays(pet.facts.streak) : null,
        d.today != null ? w.today(d.today) : null,
        d.lastMinutes != null ? w.last(w.ago(d.lastMinutes)) : null,
      ].filter(Boolean);
      if (facts.length) out.push(facts.join(dot(mode)));
      const repo = [
        d.branch ? `🌿 ${d.branch}` : null,
        d.dirty != null ? (d.dirty ? w.status.dirty(d.dirty) : w.status.clean) : null,
        d.ahead ? w.status.ahead(d.ahead) : null,
        d.behind ? w.status.behind(d.behind) : null,
      ].filter(Boolean);
      const game = [
        pet.quests?.list ? w.quests(pet.quests.list.filter((q) => q.done).length, pet.quests.list.length) : null,
        pet.achievements?.length ? w.trophies(pet.achievements.length) : null,
      ].filter(Boolean);
      if (repo.length || game.length) out.push(p([...repo, ...game].join(' · '), { fg: DIM }));
      return out;
    },
    text() {
      const pet = ctx.pet;
      const next = pet.progress?.nextLevel;
      return [
        `🐣 ${pet.name}: ${pet.speech}`,
        `${MOOD_EMOJI[pet.mood]} Lv.${pet.level} ${pet.rank.emoji} · ${next ? ctx.w.toNext(next.commits, next.level) : ctx.w.maxLevel}`,
      ];
    },
  };
}

export const SCENES = { commit: commitScene, push: pushScene, merge: mergeScene, checkout: checkoutScene, hello: helloScene };

// --- playing -------------------------------------------------------------------------------

const MARGIN = '  ';

// One frame: the stage's pixels with the panel beside it, or under it in a narrow terminal.
export function composeFrame(scene, { t, wall = t, final = false, columns = 100, mode = 'true' }) {
  const canvas = new Canvas(scene.size.w, scene.size.h);
  scene.draw(canvas, t, wall, final);
  const stage = canvas.lines(mode).map((line) => MARGIN + line);
  const stageWidth = MARGIN.length + scene.size.w;
  const room = columns - stageWidth - 3;
  if (room >= 32) {
    const panel = scene.panel(t, Math.min(room, 70), final);
    return sideBySide(stage, panel, { leftWidth: stageWidth, gap: 1, width: columns - 1 });
  }
  const panel = scene.panel(t, Math.max(20, Math.min(columns - 4, 70)), final).map((line) => MARGIN + line);
  return [...stage, ...panel].map((line) => clip(line, columns - 1));
}

// The height of the scene's frames, to check it fits on the screen before animating.
export const frameHeight = (scene, columns, mode) => composeFrame(scene, { t: scene.duration, final: true, columns, mode }).length;

// How many lines at the top of a frame are empty.
export function blankTop(lines) {
  let n = 0;
  while (n < lines.length && !lines[n].replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').trim()) n++;
  return n;
}

// The scene's last frame, printed once with no animation (and no empty headroom).
export function still(scene, { mode = 'true', columns = 80 } = {}) {
  const lines = composeFrame(scene, { t: scene.duration, final: true, mode, columns });
  return lines.slice(blankTop(lines));
}

// Plays a scene in place, then leaves its last frame on screen. `ready` says whether the data
// the scene waits for at `waitAt` is in; after `maxWait` seconds it stops waiting.
export async function play(scene, { out = process.stdout, mode = 'true', fps = 24, ready = () => true, maxWait = 8, columns = null } = {}) {
  const player = createPlayer(out);
  const cols = () => columns ?? out.columns ?? 80;
  const start = performance.now();
  let paused = 0;
  let waiting = null;
  const interrupt = () => {
    player.end();
    process.exit(130);
  };
  process.once('SIGINT', interrupt);
  try {
    for (;;) {
      const wall = (performance.now() - start) / 1000;
      let t = wall - paused;
      if (scene.waitAt != null && t > scene.waitAt && !ready()) {
        waiting ??= wall;
        if (wall - waiting < maxWait) {
          paused += t - scene.waitAt;
          t = scene.waitAt;
        }
      }
      if (t >= scene.duration) break;
      player.frame(composeFrame(scene, { t, wall, mode, columns: cols() }));
      await sleep(1000 / fps);
    }
    const last = composeFrame(scene, { t: scene.duration, final: true, mode, columns: cols() });
    player.frame(last);
    player.trimTop(blankTop(last));
  } finally {
    process.removeListener('SIGINT', interrupt);
    player.end();
  }
}
