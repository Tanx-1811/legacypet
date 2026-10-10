// `legacypet react <event>`: what the git hooks run (local/hooks.js). The repo's pet pops up
// in the terminal and reacts to what just happened: it eats a commit, sends a push off in a
// rocket, unwraps a pull, walks down a new branch. `legacypet hi` says hello.
//
// It has to feel instant, and reading a repo takes a second or two on a slow computer. So the
// pet starts moving at once, drawn from its memory (~/.legacypet, shared with the app), while
// git is read in the background; the scene pauses (the pet keeps chewing) until the numbers
// are in. Where nothing can be drawn (a GUI commit button), it prints one line and reads nothing.
import { closeSync, existsSync, fstatSync, openSync, readFileSync, readSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { petName } from '../engine/identity.js';
import { parseColor } from '../engine/look.js';
import { nextState } from '../engine/memory.js';
import { buildPet } from '../engine/pet.js';
import { rankFor } from '../engine/rank.js';
import { resolveLang, strings } from '../i18n/index.js';
import { readWorkflow, workflowOptions } from '../local/adopt.js';
import { git, gitDirs, readRepo } from '../local/git.js';
import { cleanOptions, localDay } from '../local/projects.js';
import { createStore, projectId } from '../local/store.js';
import { SPECIES } from '../sprites/index.js';
import { createActor } from './actor.js';
import { frameHeight, play, SCENES, sayLine, still } from './scenes.js';
import { colorMode, paint } from './screen.js';
import { commitKind, words } from './words.js';

export const EVENTS = Object.keys(SCENES);
const ZERO = /^0+$/;
const lines = (text) => String(text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
const read = (file) => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
};

// The top of the work tree `dir` is in (where `.git` is), found without running git.
export function findRoot(dir) {
  let cur = resolve(dir);
  for (;;) {
    if (existsSync(join(cur, '.git'))) return cur;
    const up = dirname(cur);
    if (up === cur) return null;
    cur = up;
  }
}

// The last line of a file, read from its end: a reflog can be megabytes long.
export function lastLine(file) {
  let fd;
  try {
    fd = openSync(file, 'r');
    const { size } = fstatSync(fd);
    const length = Math.min(size, 16_384);
    const buf = Buffer.alloc(length);
    readSync(fd, buf, 0, length, size - length);
    return lines(buf.toString('utf8')).at(-1) ?? null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

// One reflog line: "<old> <new> Name <email> <time> <zone>\t<what>: <text>", where <what> is
// "commit", "commit (amend)", "checkout", "pull", "merge origin/main", "rebase (finish)"…
export function parseReflog(line) {
  const m = /^([0-9a-f]{7,64}) ([0-9a-f]{7,64}) (.*?) <[^>]*> (\d+) [+-]\d{4}\t(.*)$/.exec(line ?? '');
  if (!m) return null;
  const [, old, sha, name, time, message] = m;
  const colon = message.indexOf(': ');
  return {
    old, sha, name, at: Number(time) * 1000,
    what: colon === -1 ? message : message.slice(0, colon),
    text: colon === -1 ? '' : message.slice(colon + 2),
  };
}

// The commit that was just made, from HEAD's reflog (or the message file git leaves behind).
export function commitInfo(dirs) {
  const entry = parseReflog(lastLine(join(dirs.own, 'logs', 'HEAD')));
  if (entry?.what.startsWith('commit')) {
    const action = /\((amend|initial|merge)\)/.exec(entry.what)?.[1] ?? null;
    return { sha: entry.sha, subject: entry.text, action, author: entry.name, kind: commitKind(entry.text, action ?? '') };
  }
  const subject = read(join(dirs.own, 'COMMIT_EDITMSG')).split('\n').find((l) => l.trim() && !l.startsWith('#'))?.trim() ?? '';
  return { sha: null, subject, action: null, author: entry?.name ?? null, kind: commitKind(subject) };
}

// The branch HEAD is on, or the commit it points at when detached.
export function headOf(dirs) {
  const head = read(join(dirs.own, 'HEAD')).trim();
  const branch = /^ref:\s*refs\/heads\/(.+)$/.exec(head)?.[1] ?? null;
  return { branch, sha: branch ? null : head.slice(0, 40) };
}

// post-checkout runs for files too, and on clones. The pet only walks when HEAD moved to
// another branch (or commit): git's flag says a branch was checked out, the reflog says from
// where to where (`git switch -c` stays on the same commit but still changes branch).
export function branchChanged(dirs, [prev, next, flag] = []) {
  if (flag !== '1' || !prev || ZERO.test(prev)) return false;
  const entry = parseReflog(lastLine(join(dirs.own, 'logs', 'HEAD')));
  const move = entry?.what === 'checkout' ? /^moving from (.+) to (.+)$/.exec(entry.text) : null;
  return move ? move[1] !== move[2] : prev !== next;
}

// A rebase, cherry-pick or `git am` replays commits one by one, each one firing the hooks, and
// a bisect checks out commit after commit: the pet sits those out.
export function replaying(dirs, env = process.env) {
  if (/\b(rebase|cherry-pick|am|revert)\b/.test(env.GIT_REFLOG_ACTION ?? '')) return true;
  return ['rebase-merge', 'rebase-apply', 'sequencer', 'BISECT_LOG'].some((f) => existsSync(join(dirs.own, f)));
}

// The app keeps each pet under an id made from its repo's path, as the app's scan spelled it.
// The same folder can be spelled another way here (a drive letter's case), so the app's
// cache is asked first.
export function knownId(store, root) {
  const norm = (p) => (process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p));
  const want = norm(root);
  const hit = (store.loadCache().projects ?? []).find((p) => p.path && norm(p.path) === want);
  return hit?.id ?? projectId(root.replace(/^[a-z]:/, (d) => d.toUpperCase()));
}

// What the app knows about a repo: its settings, the pet's memory and its options.
export function appState(root, store = createStore()) {
  const config = store.loadConfig();
  const id = knownId(store, root);
  const memory = store.loadMemory(id);
  const options = cleanOptions({ ...workflowOptions(readWorkflow(root)), ...(config.options?.[id] ?? {}) });
  return { store, config, id, memory, options };
}

// The pet as it was last seen, from its memory alone: enough to draw it while git is read.
export function petFromMemory(memory, options = {}, lang = 'en') {
  const id = options.species && options.species !== 'auto' ? options.species : memory?.pet?.species;
  const species = SPECIES[id];
  if (!species || !memory) return null;
  const fullName = memory.repo ?? 'local/pet';
  const level = memory.pet?.level ?? 1;
  const mood = memory.lastMood ?? memory.pet?.mood ?? 'happy';
  let tint = null;
  try {
    tint = parseColor(options.color);
  } catch { /* a color that can't be read: the pet keeps its own */ }
  return {
    repo: { fullName }, lang, species, speciesId: species.id, mood, level, rank: rankFor(level),
    name: options.name?.trim() || memory.pet?.name || petName(fullName),
    shiny: Boolean(memory.pet?.shiny), tint, aura: Boolean(memory.pet?.aura), accessories: memory.pet?.accessories ?? {},
    stage: memory.pet?.stage ?? 'adult', hatchProgress: Math.min(1, (memory.facts?.totalCommits ?? 5) / 5), speech: memory.pet?.speech,
  };
}

// Reads the repo and raises its pet one step, like the app does on a visit.
export async function raise(root, state, { now = new Date(), lang, care = null } = {}) {
  const info = await readRepo(root, { now });
  let prev = state.memory ?? info.seed ?? null;
  // Once the pet lives on GitHub, it is that pet: same species everywhere.
  if (state.memory && info.seed?.pet?.species) prev = { ...state.memory, pet: { ...state.memory.pet, species: info.seed.pet.species } };
  const user = info.user || 'you';
  const pet = buildPet({
    snapshot: info.snapshot, prevState: prev, now,
    options: { ...state.options, lang, care: care ? { name: care, user } : undefined },
  });
  return { pet, info, prev };
}

// Saves what the pet just lived through, and keeps it as the memory for the next visit.
export function remember(state, pet, prev) {
  const memory = nextState(pet, prev);
  try {
    state.store.saveMemory(state.id, memory);
  } catch { /* a read-only home folder: the pet just won't remember this one */ }
  state.memory = memory;
  return memory;
}

async function shortstat(root) {
  const text = await git(root, ['show', '--shortstat', '--format=', 'HEAD'], { allowFail: true });
  if (!text?.trim()) return null;
  return { added: Number(/(\d+) insertion/.exec(text)?.[1] ?? 0), deleted: Number(/(\d+) deletion/.exec(text)?.[1] ?? 0) };
}

// What pre-push is about to send, from the lines git gives it on stdin:
// "<local ref> <local sha> <remote ref> <remote sha>".
export function parsePushRefs(text) {
  return lines(text).map((line) => {
    const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);
    return { localRef, localSha, remoteRef, remoteSha };
  }).filter((r) => r.remoteRef);
}

const shortRef = (ref) => String(ref ?? '').replace(/^refs\/(heads|tags)\//, '');

export async function pushData(root, refs, remote = 'origin', now = new Date()) {
  const friday = now.getDay() === 5 && now.getHours() >= 16;
  const ref = refs.find((r) => !ZERO.test(r.localSha)) ?? refs[0];
  if (!ref) return { count: null, to: remote, friday };
  if (ref.remoteRef.startsWith('refs/tags/')) return { tag: shortRef(ref.remoteRef), to: remote, friday };
  const branch = shortRef(ref.remoteRef);
  const to = `${remote}/${branch}`;
  if (ZERO.test(ref.localSha)) return { gone: true, branch, to, friday };
  const fresh = ZERO.test(ref.remoteSha);
  const range = fresh ? [ref.localSha, '--not', `--remotes=${remote}`] : [`${ref.remoteSha}..${ref.localSha}`];
  const out = await git(root, ['rev-list', '--count', ...range], { allowFail: true });
  return { count: out == null ? null : Number(out.trim()) || 0, branch: shortRef(ref.localRef), to, fresh, friday };
}

export async function mergeData(root, me = null) {
  const log = await git(root, ['log', '--format=%an', '-n', '1000', 'ORIG_HEAD..HEAD'], { allowFail: true });
  const authors = lines(log);
  const names = [...new Set(authors)].filter((n) => n !== me);
  return { count: authors.length, names };
}

function readInput(input, ms = 1500) {
  if (!input || input.isTTY) return Promise.resolve('');
  return new Promise((done) => {
    let text = '';
    const finish = () => {
      clearTimeout(timer);
      input.pause();
      done(text);
    };
    const timer = setTimeout(finish, ms);
    input.setEncoding('utf8');
    input.on('data', (chunk) => { text += chunk; });
    input.once('end', finish);
    input.once('error', finish);
  });
}

// A terminal language for people who never picked one: the system's.
export function systemLang(env = process.env) {
  const tag = env.LC_ALL || env.LC_MESSAGES || env.LANG || Intl.DateTimeFormat().resolvedOptions().locale || 'en';
  return resolveLang(tag);
}

// Hooks write to whichever of stdout and stderr is a terminal (git sends a hook's stdout to its stderr).
export const terminalStream = () => (process.stdout.isTTY ? process.stdout : process.stderr.isTTY ? process.stderr : process.stdout);

const withTimeout = (promise, ms) => Promise.race([promise, new Promise((done) => setTimeout(() => done(null), ms).unref())]);

async function wakeUp(promise, out, text) {
  let shown = false;
  const timer = setTimeout(() => {
    shown = true;
    out.write(`  ${text}`);
  }, 400);
  try {
    return await promise;
  } finally {
    clearTimeout(timer);
    if (shown) out.write('\r\x1b[2K');
  }
}

// How to show it: 'full' animation, a 'still' last frame, plain 'text', one 'line' (no git), or nothing.
export function outputStyle({ hook = false, tty = false, mode = 'true', motion = null, env = process.env }) {
  const asked = String(env.LEGACYPET_HOOK ?? '').toLowerCase();
  if (hook && (env.LEGACYPET_QUIET || asked === 'off' || env.CI)) return 'off';
  if (hook && (!tty || asked === 'line')) return 'line';
  if (mode === 'none') return 'text';
  if (motion === 'off' || String(env.LEGACYPET_MOTION ?? '').toLowerCase() === 'off' || (hook && asked === 'still')) return 'still';
  return 'full';
}

// Plays the reaction to `event`. In a hook (`hook: true`) it never fails the git command: a
// problem means the pet just stays quiet.
export async function react(event, options = {}) {
  try {
    return await reactTo(event, options);
  } catch (err) {
    if (options.hook) return null;
    throw err;
  }
}

async function reactTo(event, {
  dir = process.cwd(), args = [], hook = false, lang: langOption = null, size = null, motion = null,
  demo = null, message = null, env = process.env, now = new Date(), input = process.stdin, out = terminalStream(),
} = {}) {
  if (!SCENES[event]) throw new Error(`Unknown event "${event}". Pick one of: ${EVENTS.join(', ')}`);
  const mode = colorMode(out, env);
  const style = outputStyle({ hook, tty: Boolean(out.isTTY), mode, motion, env });
  if (style === 'off') return null;

  const root = demo ? null : findRoot(dir);
  if (!demo && !root) {
    if (hook) return null;
    throw new Error('This is not a git repo. Run it inside a project, or add --demo to see a made-up pet.');
  }
  const dirs = root ? gitDirs(root) : null;
  if (hook && dirs && replaying(dirs, env)) return null;
  if (hook && event === 'checkout' && !branchChanged(dirs, args)) return null;
  // Inside a commit hook git may point GIT_INDEX_FILE at a temporary index: read the real one.
  if (hook) delete process.env.GIT_INDEX_FILE;

  const state = root ? appState(root) : null;
  const lang = resolveLang(langOption ?? state?.options.lang ?? state?.config.ui ?? systemLang(env));
  const ctx = {
    w: words(lang), tr: strings(lang), mode, now, lang,
    info: {}, data: null, ready: false, pet: null, lookPet: null, look: null, final: null,
  };
  const big = size === 'big' || (size == null && !hook && event === 'hello' && (out.rows ?? 0) >= 34 && (out.columns ?? 0) >= 110)
    || (size == null && hook && String(env.LEGACYPET_SIZE ?? '').toLowerCase() === 'big');
  const actor = (pet) => createActor(pet, { hd: big });

  // What can be known at once, from files git just wrote.
  if (demo) {
    Object.assign(ctx, demoContext(event, demo, { message, now }));
    ctx.final = actor(ctx.pet);
  } else if (event === 'commit') ctx.info = commitInfo(dirs);
  else if (event === 'checkout') ctx.info = { ...headOf(dirs), sha: args[1] ?? headOf(dirs).sha };
  else if (event === 'push') ctx.info = { remote: args[0] ?? 'origin' };
  if (state) ctx.lookPet = petFromMemory(state.memory, state.options, lang);

  if (style === 'line') {
    out.write(`${sayLine(event, ctx)}\n`);
    return ctx;
  }

  // The rest is read in the background.
  let raised = null;
  const needPet = !demo && (!ctx.lookPet || event === 'commit' || event === 'hello' || event === 'merge');
  const raising = needPet ? raise(root, state, { now, lang }).then((r) => (raised = r)) : Promise.resolve(null);
  const finish = (data, r = raised) => {
    if (r) {
      ctx.pet = r.pet;
      ctx.final = actor(r.pet);
    }
    ctx.data = data;
    ctx.ready = true;
  };
  let work;
  if (demo) work = Promise.resolve();
  else if (event === 'commit') {
    work = Promise.all([raising, shortstat(root)]).then(([r, stat]) => {
      const today = r.info.activity[localDay(now)] ?? 0;
      finish({ today, firstToday: today === 1, added: stat?.added, deleted: stat?.deleted }, r);
    });
  } else if (event === 'push') {
    const refs = parsePushRefs(hook ? await readInput(input) : '');
    work = Promise.all([pushData(root, refs, ctx.info.remote, now), ctx.lookPet ? null : raising]).then(([data, r]) => finish(data, r));
  } else if (event === 'merge') {
    work = Promise.all([mergeData(root, parseReflog(lastLine(join(dirs.own, 'logs', 'HEAD')))?.name), ctx.lookPet ? null : raising])
      .then(([data, r]) => finish(data, r));
  } else if (event === 'hello') {
    work = raising.then((r) => {
      const last = r.info.snapshot.commits.lastDate;
      finish({
        today: r.info.activity[localDay(now)] ?? 0, branch: r.info.branch, dirty: r.info.dirty, ahead: r.info.ahead, behind: r.info.behind,
        lastMinutes: last ? (now.getTime() - Date.parse(last)) / 60_000 : null,
      }, r);
    });
  } else work = (ctx.lookPet ? Promise.resolve(null) : raising).then((r) => finish({}, r));
  // Git that can't be read leaves the numbers out: the scene goes on without them.
  work = work.catch((err) => {
    ctx.error = err;
    ctx.ready = true;
  });

  const waitFirst = !ctx.lookPet || event === 'hello' || style !== 'full';
  if (waitFirst) {
    const done = style === 'full' ? wakeUp(work, out, paint(mode)(`🥚 ${ctx.w.waking}`, { fg: '#7d8590' })) : work;
    if (await withTimeout(done.then(() => true), 15_000) === null) return null;
  }
  ctx.lookPet ??= ctx.pet;
  if (!ctx.lookPet) {
    if (ctx.error && !hook) throw ctx.error;
    return null;
  }
  ctx.look = actor(ctx.lookPet);
  const scene = SCENES[event](ctx);
  const columns = out.columns ?? 80;

  if (style === 'text') out.write(`${scene.text().join('\n')}\n`);
  else if (style === 'still' || frameHeight(scene, columns, mode) >= (out.rows ?? 24) - 1) out.write(`${still(scene, { mode, columns }).join('\n')}\n`);
  else await play(scene, { out, mode, ready: () => ctx.ready, columns });

  // A pet that was read is remembered, so the next reaction (and the app) start from here.
  await withTimeout(Promise.all([work, raising]).catch(() => null), 10_000);
  if (raised && state) remember(state, raised.pet, raised.prev);
  return ctx;
}

// Made-up events for `--demo`: see every reaction without a repo.
function demoContext(event, pet, { message, now }) {
  const subject = message ?? 'feat: a brand-new feature';
  const info = {
    commit: { sha: 'c0ffee1234', subject, action: null, kind: commitKind(subject) },
    checkout: { branch: 'feature/new-idea' },
    push: { remote: 'origin' },
  }[event] ?? {};
  const data = {
    commit: { today: 2, firstToday: false, added: 42, deleted: 7 },
    push: { count: 3, branch: 'main', to: 'origin/main', friday: now.getDay() === 5 && now.getHours() >= 16 },
    merge: { count: 4, names: ['Ada', 'Linus'] },
    hello: { today: 2, lastMinutes: 12, branch: 'main', dirty: 3, ahead: 1 },
  }[event] ?? {};
  const look = event === 'commit' && pet.mood !== 'egg' && !pet.events.includes('hatched') ? { ...pet, mood: 'hungry' } : pet;
  return { info, data, ready: true, pet, lookPet: look };
}
