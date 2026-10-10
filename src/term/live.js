// `legacypet live`: the pet keeps you company in a terminal pane while you code. It idles,
// blinks and shows off its signature move; reacts the moment you commit, pull, push or switch
// branches; notices when a lot of work hasn't been committed; runs a focus timer; and takes
// snacks, games and pats from the keyboard. What it lives through is remembered, like in the app.
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { resolveLang, strings } from '../i18n/index.js';
import { git, gitDirs } from '../local/git.js';
import { localDay } from '../local/projects.js';
import { MOVE_MOODS } from '../render/moves.js';
import { createRng } from '../util/rng.js';
import { createActor, drawBitmap, REST } from './actor.js';
import { arc, confettiPieces, drawBurst, drawConfetti, FOODS, PROPS, sprite } from './fx.js';
import {
  appState, commitInfo, findRoot, headOf, lastLine, mergeData, parseReflog, petFromMemory, raise, remember, systemLang,
} from './react.js';
import { bubble, nameLine, SCENES, vitalsLines, xpLine } from './scenes.js';
import { Canvas, clip, colorMode, paint, sideBySide } from './screen.js';
import { words } from './words.js';

const FPS = 12;
const STATUS_EVERY = 5_000;
const REFRESH_EVERY = 15 * 60_000;
const NAP_AFTER = 15 * 60_000;
const SCENE_HOLD = 2.5; // seconds a scene's last frame stays up
const DIM = '#7d8590';
const ZERO = /^0+$/;
const ease = (t) => t * t * (3 - 2 * t);
const hop = (u, height) => Math.sin(Math.min(1, Math.max(0, u)) * Math.PI) * height;
const CARE_KEYS = { f: 'feed', p: 'play', ' ': 'pat' };

const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function stamp(file) {
  try {
    const st = statSync(file);
    return `${st.size}:${st.mtimeMs}`;
  } catch {
    return null;
  }
}

// Big (HD) pets when there's room for them: beside the panel, or above it.
export function fitsBig(columns, rows) {
  return (columns >= 110 && rows >= 28) || (columns >= 76 && rows >= 40);
}

export async function live({
  dir = process.cwd(), lang: langOption = null, size = null, demo = null, focusMinutes = 25,
  out = process.stdout, input = process.stdin, env = process.env,
} = {}) {
  if (!out.isTTY || !input.isTTY) throw new Error('`legacypet live` needs a terminal to draw in. Run it in a terminal tab or pane.');
  const mode = colorMode(out, env) === 'none' ? '256' : colorMode(out, env);
  const root = demo ? null : findRoot(dir);
  const dirs = root ? gitDirs(root) : null;
  const state = root ? appState(root) : null;
  const lang = resolveLang(langOption ?? state?.options.lang ?? state?.config.ui ?? systemLang(env));
  const w = words(lang);
  const tr = strings(lang);
  const p = paint(mode);
  const rng = createRng(`live|${Date.now()}`);
  const wantBig = () => size === 'big' || (size !== 'small' && fitsBig(out.columns ?? 80, out.rows ?? 24));

  // --- the pet ------------------------------------------------------------------------------
  let pet = null;
  let actor = null;
  let info = null; // the last read of the repo (local/git.js readRepo)
  let hd = wantBig();
  const show = (next) => {
    pet = next;
    actor = createActor(pet, { hd });
  };

  // Reads the repo, raises the pet one step (with a snack, game or pat) and remembers it.
  async function refresh(care = null) {
    if (!root) return pet;
    const r = await raise(root, state, { now: new Date(), lang, care });
    info = r.info;
    remember(state, r.pet, r.prev);
    show(r.pet);
    return r.pet;
  }

  if (demo) show(demo);
  else if (root) {
    const quick = petFromMemory(state.memory, state.options, lang);
    if (quick) {
      show(quick);
      refresh().catch(() => {});
    } else {
      out.write(`  ${p(`🥚 ${w.waking}`, { fg: DIM })}`);
      await refresh();
      out.write('\r\x1b[2K');
    }
  } else {
    throw new Error('This is not a git repo. Run `legacypet live` inside a project, or add --demo.');
  }

  // --- what's on screen -------------------------------------------------------------------
  const start = Date.now();
  const now = () => (Date.now() - start) / 1000;
  let say = null; // { text, at, until }
  let effect = null; // { kind: 'feed' | 'play' | 'pat' | 'party', at, confetti }
  let scene = null; // { scene, ctx, at, clock, last }
  let focus = null; // { until }
  let asleep = false;
  let lastActive = Date.now();
  let moving = null;
  let nextMove = 6 + rng.range(0, 6);
  let nextNote = 20;
  let dirty = null;
  let dirtySince = null;
  const nudged = { coding: 0, big: 0, long: 0, late: false };

  const speak = (text, seconds = 6.5) => {
    if (focus && text !== w.live.focusDone) return; // quiet while you focus
    say = { text, at: now(), until: now() + seconds };
  };
  const wake = () => {
    lastActive = Date.now();
    asleep = false;
  };
  const sceneCtx = (extra = {}) => ({
    w, tr, mode, now: new Date(), lang, info: {}, data: null, ready: false, pet, lookPet: pet, look: actor, final: null, ...extra,
  });

  // A git event plays its scene on the stage; the scene waits for `work` (the numbers) like in a hook.
  function play(event, ctx, work = Promise.resolve(ctx.data)) {
    say = null;
    scene = { scene: SCENES[event](ctx), ctx, at: now(), clock: 0, last: now() };
    work.then((data) => {
      ctx.data = data ?? ctx.data ?? {};
      ctx.pet = pet;
      ctx.final = actor;
    }).catch(() => {}).finally(() => {
      ctx.ready = true;
    });
  }

  // --- watching the repo ------------------------------------------------------------------
  const headLog = dirs && join(dirs.own, 'logs', 'HEAD');
  let headSeen = headLog && stamp(headLog);
  let upstream = null;
  let upstreamSeen = null;
  const upstreamLog = () => join(dirs.common, 'logs', 'refs', 'remotes', ...upstream.split('/'));
  async function findUpstream() {
    if (!root) return;
    const name = (await git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { allowFail: true }))?.trim();
    upstream = name && !name.includes('@') ? name : null;
    upstreamSeen = upstream ? stamp(upstreamLog()) : null;
  }

  function watchHead() {
    const seen = stamp(headLog);
    if (seen === headSeen) return;
    headSeen = seen;
    wake();
    const entry = parseReflog(lastLine(headLog));
    if (!entry) return;
    if (entry.what.startsWith('commit')) {
      const ctx = sceneCtx({ info: commitInfo(dirs) });
      play('commit', ctx, refresh().then(() => {
        const today = info?.activity?.[localDay(new Date())] ?? 0;
        return { today, firstToday: today === 1 };
      }));
      dirtySince = null;
    } else if (entry.what === 'pull' || entry.what.startsWith('pull ') || entry.what.startsWith('merge')) {
      play('merge', sceneCtx(), Promise.all([mergeData(root, entry.name), refresh()]).then(([data]) => data));
    } else if (entry.what === 'checkout') {
      const move = /^moving from (.+) to (.+)$/.exec(entry.text);
      if (move && move[1] !== move[2]) {
        const head = headOf(dirs);
        play('checkout', sceneCtx({ info: { ...head, sha: head.sha ?? entry.sha }, ready: true }));
        findUpstream();
      }
      refresh().catch(() => {});
    } else refresh().catch(() => {});
  }

  function watchPush() {
    if (!upstream) return;
    const seen = stamp(upstreamLog());
    if (seen === upstreamSeen) return;
    upstreamSeen = seen;
    const entry = parseReflog(lastLine(upstreamLog()));
    if (!entry || !/push/.test(entry.what)) return; // a fetch moves it too
    wake();
    const [remote, ...branch] = upstream.split('/');
    const count = ZERO.test(entry.old) ? Promise.resolve(null)
      : git(root, ['rev-list', '--count', `${entry.old}..${entry.sha}`], { allowFail: true }).then((n) => (n == null ? null : Number(n.trim())));
    play('push', sceneCtx({ info: { remote } }), count.then((n) => ({ count: n, branch: branch.join('/'), to: upstream })));
    refresh().catch(() => {});
  }

  let checking = false;
  async function watchStatus() {
    if (!root || checking) return;
    checking = true;
    try {
      const text = await git(root, ['status', '--porcelain=v1'], { allowFail: true });
      if (text == null) return;
      const count = text.split('\n').filter((l) => l.trim()).length;
      const t = Date.now();
      if (dirty != null && count !== dirty) wake();
      if (count && !dirty) {
        dirtySince ??= t;
        if (dirty != null && t - nudged.coding > 30 * 60_000) {
          nudged.coding = t;
          speak(w.live.coding);
        }
      } else if (!count && dirty) {
        dirtySince = null;
        if (!scene) speak(w.live.clean, 4);
      }
      const minutes = dirtySince ? (t - dirtySince) / 60_000 : 0;
      if (count >= 15 && minutes > 20 && t - nudged.big > 30 * 60_000) {
        nudged.big = t;
        speak(w.live.bigChanges(count));
      } else if (count && minutes > 60 && t - nudged.long > 60 * 60_000) {
        nudged.long = t;
        speak(w.live.longChanges(Math.round(minutes)));
      }
      dirty = count;
      if (info) info.dirty = count;
    } finally {
      checking = false;
    }
  }

  // --- the keyboard -----------------------------------------------------------------------
  async function care(kind) {
    wake();
    effect = { kind, at: now() };
    const thanks = { feed: w.live.fed, play: w.live.played, pat: w.live.patted }[kind];
    if (!root) return speak(thanks, 3.5);
    try {
      const outcome = (await refresh(kind))?.careOutcome;
      speak(outcome === 'again' ? w.live.again : outcome === 'cant' ? w.live.cant : thanks, 4);
    } catch { /* the pet stays as it was */ }
  }

  function toggleFocus() {
    wake();
    if (focus) {
      focus = null;
      speak(w.live.focusStop, 3.5);
    } else {
      speak(w.live.focus(focusMinutes), 4);
      focus = { until: Date.now() + focusMinutes * 60_000 };
    }
  }

  // --- drawing ----------------------------------------------------------------------------
  // Room for the pet (and its pal) and for a ball to bounce; scenes may draw wider.
  const stageSize = () => ({ w: 30 * actor.scale + actor.pad, h: 22 * actor.scale });

  function drawIdle(c, t) {
    const s = actor.scale;
    const x = 10 * s + actor.pad;
    const y = c.height;
    const sleepy = asleep || pet.mood === 'sleepy' || pet.mood === 'hibernating';
    let face = asleep ? 'sleepy' : null;
    let pose = null;
    let move = null;
    let idle = true;
    if (effect) {
      const u = t - effect.at;
      const mouth = { x: x + actor.mouth.x, y: y + actor.mouth.y };
      if (effect.kind === 'feed') {
        const food = sprite(FOODS[pet.species.food === 'water' ? 'water' : 'drumstick'], s);
        if (u < 0.6) drawBitmap(c, food, mouth.x + 2 * s, (mouth.y + food.h / 2) * ease(u / 0.6), REST);
        face = u < 0.6 ? 'hungry' : u < 1.3 ? (Math.floor(t / 0.14) % 2 ? 'ecstatic' : 'hungry') : 'ecstatic';
      } else if (effect.kind === 'play') {
        const k = (u / 0.7) % 1;
        const back = Math.floor(u / 0.7) % 2;
        const near = { x: x + 4 * s, y: y - actor.height - 2 * s };
        const far = { x: c.width - 6 * s, y: y - 2 * s };
        const at = arc(back ? far : near, back ? near : far, k, 8 * s);
        drawBitmap(c, sprite(FOODS.ball, s), at.x, at.y, REST);
        face = 'ecstatic';
        pose = { dy: -Math.round(hop((u % 0.7) / 0.7, 2 * s)) };
      } else if (effect.kind === 'pat') {
        drawBurst(c, x, y - actor.height / 2, u / 0.8, { reach: 11 * s, count: 8, color: '#ff5d73' });
        face = 'ecstatic';
        pose = u < 0.5 ? { sx: 1.08, sy: 0.92 } : null;
      } else if (effect.kind === 'party') {
        effect.confetti ??= confettiPieces(`live|${effect.at}`, 12 * s, c.width);
        drawConfetti(c, effect.confetti, u);
        face = 'party';
        pose = { dy: -Math.round(hop((u % 0.55) / 0.55, 3 * s)) };
      }
      if (effect.kind !== 'pat' && u < 1.6) {
        drawBitmap(c, sprite(PROPS.tinyHeart, s), x + 6 * s + Math.sin(u * 8) * s, y - actor.height - u * 6 * s, REST);
      }
      if (u > (effect.kind === 'party' ? 3 : 2)) effect = null;
    } else if (!sleepy && actor.track && MOVE_MOODS.has(pet.mood)) {
      // Every so often: the signature move, or a little song.
      if (moving == null && t >= nextMove) moving = t;
      if (moving != null && t - moving < actor.track.seconds) {
        move = t - moving;
        idle = false;
      } else if (moving != null) {
        moving = null;
        nextMove = t + 10 + rng.range(0, 8);
      }
      const u = t - nextNote;
      if (u >= 0 && u < 1.4) drawBitmap(c, sprite(PROPS.note, s), x + 7 * s + Math.sin(u * 6) * s, y - actor.height - u * 5 * s, REST);
      else if (u >= 1.4) nextNote = t + 18 + rng.range(0, 14);
    }
    if (sleepy && !effect) {
      const u = t % 2.4;
      c.text(x + 6 * s + Math.round(u * 2), Math.floor((y - actor.height - u * 4 * s) / 2), u < 1.2 ? 'z' : 'Z', '#8fa6d6', { bold: true });
    }
    actor.draw(c, x, y, t, { face, pose, move, idle, blink: !asleep });
  }

  function panelLines(width) {
    // Until the repo has been read, the pet is drawn from its memory, which may not hold everything.
    const lines = [nameLine(pet, mode)];
    if (pet.progress) lines.push(xpLine(pet, w, mode));
    if (pet.vitals) lines.push(...vitalsLines(pet, mode));
    const today = info?.activity?.[localDay(new Date())];
    const last = info?.snapshot?.commits?.lastDate;
    const facts = [
      pet.facts?.streak >= 2 ? w.streakDays(pet.facts.streak) : null,
      today != null ? w.today(today) : null,
      last ? w.last(w.ago((Date.now() - Date.parse(last)) / 60_000)) : null,
    ].filter(Boolean);
    if (facts.length) lines.push(facts.join(' · '));
    const repo = [
      info?.branch ? `🌿 ${info.branch}` : null,
      info ? (info.dirty ? w.status.dirty(info.dirty) : w.status.clean) : null,
      info?.ahead ? w.status.ahead(info.ahead) : null,
      info?.behind ? w.status.behind(info.behind) : null,
      pet.quests?.list ? w.quests(pet.quests.list.filter((q) => q.done).length, pet.quests.list.length) : null,
      pet.achievements?.length ? w.trophies(pet.achievements.length) : null,
    ].filter(Boolean);
    if (repo.length) lines.push(p(repo.join(' · '), { fg: DIM }));
    if (focus) lines.push(p(w.live.focusLeft(mmss(focus.until - Date.now())), { fg: '#ffd23f', bold: true }));
    return lines.map((l) => clip(l, width));
  }

  // The stage and what goes beside it: a scene's own panel while one plays, else the pet's stats.
  function frame() {
    const cols = out.columns ?? 80;
    const rows = out.rows ?? 24;
    const t = now();
    const size = stageSize();
    const room = cols - size.w - 6;
    const width = Math.max(24, Math.min(room >= 34 ? room : cols - 4, 64));
    let stage = null;
    let right = null;
    let stageWidth = size.w;
    if (scene) {
      const dt = t - scene.last;
      scene.last = t;
      const { waitAt, duration } = scene.scene;
      const waiting = waitAt != null && scene.clock >= waitAt && !scene.ctx.ready && t - scene.at < 10;
      if (!waiting) scene.clock += dt;
      const done = scene.clock >= duration;
      if (done && scene.clock >= duration + SCENE_HOLD) scene = null;
      else {
        stageWidth = Math.max(size.w, scene.scene.size.w);
        const canvas = new Canvas(stageWidth, size.h);
        scene.scene.draw(canvas, Math.min(scene.clock, duration), t, done);
        stage = canvas.lines(mode);
        right = scene.scene.panel(Math.min(scene.clock, duration), width, done);
      }
    }
    if (!stage) {
      const canvas = new Canvas(size.w, size.h);
      drawIdle(canvas, t);
      stage = canvas.lines(mode);
      const talk = say && t < say.until ? bubble(say.text, width, { shown: (t - say.at) * 50, mode }) : [];
      right = [...talk, ...panelLines(width)];
    }
    const margin = (l) => `  ${l}`;
    const lines = room >= 34
      ? sideBySide(stage.map(margin), right, { leftWidth: stageWidth + 2, gap: 2, width: cols - 1 })
      : [...stage, ...right].map(margin).map((l) => clip(l, cols - 1));
    const body = ['', ...lines].slice(0, Math.max(1, rows - 2));
    return [...body, '', `  ${p(clip(w.live.keys, cols - 3), { fg: DIM })}`];
  }

  // --- the loop ---------------------------------------------------------------------------
  return new Promise((resolve, reject) => {
    let shown = '';
    let closed = false;
    const timers = [];
    const quit = (err = null) => {
      if (closed) return;
      closed = true;
      timers.forEach(clearInterval);
      input.removeListener('data', onKey);
      out.removeListener('resize', onResize);
      process.removeListener('SIGINT', onSigint);
      input.setRawMode?.(false);
      input.pause();
      out.write('\x1b[?25h\x1b[?1049l');
      if (err) return reject(err);
      out.write(`🐣 ${pet.name}: ${w.live.bye}\n`);
      resolve();
    };
    const draw = () => {
      try {
        const text = frame().map((l) => `${l}\x1b[K`).join('\r\n');
        if (text === shown) return;
        shown = text;
        out.write(`\x1b[?2026h\x1b[H${text}\x1b[J\x1b[?2026l`);
      } catch (err) {
        quit(err);
      }
    };
    const tick = () => {
      if (dirs) {
        watchHead();
        watchPush();
      }
      if (!asleep && !focus && Date.now() - lastActive > NAP_AFTER) asleep = true;
      if (focus && Date.now() >= focus.until) {
        focus = null;
        speak(w.live.focusDone, 8);
        effect = { kind: 'party', at: now() };
        out.write('\x07');
      }
      const hour = new Date().getHours();
      if (!nudged.late && (hour >= 23 || hour < 5)) {
        nudged.late = true;
        speak(w.live.late);
      }
    };
    const onKey = (key) => {
      if (key === 'q' || key === 'Q' || key === '\x03' || key === '\x1b') return quit();
      if (scene) return;
      const k = key.length === 1 ? key.toLowerCase() : key;
      if (CARE_KEYS[k]) care(CARE_KEYS[k]);
      else if (k === 't') toggleFocus();
      else if (k === 'r') {
        wake();
        refresh().catch(() => {});
      }
    };
    const onSigint = () => quit();
    const onResize = () => {
      const big = wantBig();
      if (big !== hd) {
        hd = big;
        actor = createActor(pet, { hd });
      }
      shown = '';
      out.write('\x1b[2J');
    };

    out.write('\x1b[?1049h\x1b[?25l\x1b[2J');
    input.setRawMode?.(true);
    input.setEncoding('utf8');
    input.resume();
    input.on('data', onKey);
    out.on('resize', onResize);
    process.on('SIGINT', onSigint);
    speak(root ? w.live.hello(pet.name) : w.live.notRepo, 5);
    timers.push(setInterval(draw, 1000 / FPS), setInterval(tick, 1000), setInterval(watchStatus, STATUS_EVERY),
      setInterval(() => refresh().catch(() => {}), REFRESH_EVERY));
    findUpstream();
    watchStatus();
    tick();
    draw();
  });
}
