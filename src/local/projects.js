// The app's model: the repos on this computer, each with a pet that lives right here.
// It scans the folders someone allowed, reads each repo with git, raises its pet with the
// same engine as the GitHub Action and keeps the pet's memory in ~/.legacypet.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { userInfo } from 'node:os';
import { join } from 'node:path';
import { buildPet } from '../engine/pet.js';
import { MOOD_EMOJI } from '../engine/mood.js';
import { nextState } from '../engine/memory.js';
import { createClient } from '../github/client.js';
import { collectSnapshot } from '../github/collect.js';
import { strings } from '../i18n/index.js';
import { adoptLocal, findReadme, publishAdoption, readWorkflow, workflowOptions } from './adopt.js';
import { readRepo } from './git.js';
import { findRepos, suggestFolders } from './scan.js';
import { createStore, projectId } from './store.js';

export const BAD_MOODS = ['sick', 'zombie'];
export const WARN_MOODS = ['hungry', 'sad', 'sleepy'];
const ONLINE_TTL = 20 * 60_000;
const POOL = 6;
const KEEP_EVENTS = 60;

// The few sentences the app says on its own (notifications). The pet's words come from src/i18n.
const NOTES = {
  en: {
    hungry: (p) => `${p} is hungry. A commit would be a nice meal.`,
    sick: (p) => `${p} caught a fever: CI is failing.`,
    zombie: (p) => `${p} turned into a zombie. One commit brings it back!`,
    sad: (p) => `${p} feels lonely: issues are waiting for a reply.`,
    sleepy: (p) => `${p} is getting sleepy. It misses your commits.`,
    hatched: (p) => `🐣 ${p} just hatched!`,
    revived: (p) => `💚 ${p} is back from the dead!`,
    levelUp: (p, n) => `⬆️ ${p} reached Lv.${n}!`,
    trophy: (p, t) => `🏆 ${p} earned a trophy: ${t}`,
    evolved: (p) => `🧬 ${p} evolved!`,
    quest: (p) => `📜 ${p} finished a quest!`,
  },
  vi: {
    hungry: (p) => `${p} đang đói. Một commit là bữa ngon đấy.`,
    sick: (p) => `${p} bị sốt: CI đang đỏ.`,
    zombie: (p) => `${p} đã thành thây ma. Một commit là sống lại!`,
    sad: (p) => `${p} buồn vì issue chờ trả lời.`,
    sleepy: (p) => `${p} buồn ngủ rồi. Nó nhớ commit của bạn.`,
    hatched: (p) => `🐣 ${p} vừa nở!`,
    revived: (p) => `💚 ${p} đã sống lại!`,
    levelUp: (p, n) => `⬆️ ${p} lên Lv.${n}!`,
    trophy: (p, t) => `🏆 ${p} có thành tích mới: ${t}`,
    evolved: (p) => `🧬 ${p} đã tiến hóa!`,
    quest: (p) => `📜 ${p} xong một nhiệm vụ!`,
  },
};
const notes = (lang) => NOTES[lang] ?? NOTES.en;

export const attention = (mood) => (BAD_MOODS.includes(mood) ? 'bad' : WARN_MOODS.includes(mood) ? 'warn' : 'good');

// A GitHub token for "online details": one pasted in the app, the environment's, or the
// GitHub CLI's login. Looked up only when online details are on.
export function findToken(config) {
  if (config.token) return { token: config.token, from: 'app' };
  const env = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (env) return { token: env, from: 'env' };
  try {
    const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000, windowsHide: true }).trim();
    if (token) return { token, from: 'gh' };
  } catch { /* gh is not installed or not logged in */ }
  return { token: null, from: null };
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

export function createProjects({ store = createStore(), now: clock = () => new Date(), fetch: fetchImpl, cwd = null } = {}) {
  let config = store.loadConfig();
  const cache = store.loadCache();
  let projects = new Map((cache.projects ?? []).map((p) => [p.id, p]));
  const online = new Map(); // id → { at, snapshot }
  const events = [];
  const listeners = new Set();
  let seq = cache.seq ?? 0;
  let scanning = false;
  let refreshing = false;
  let lastScan = cache.lastScan ?? null;
  let tokenInfo = null;

  const emit = (type, payload) => { for (const fn of listeners) fn(type, payload); };
  const persist = () => store.saveCache({ projects: [...projects.values()], lastScan, seq });
  const ui = () => (config.ui === 'vi' ? 'vi' : 'en');

  function token() {
    if (!config.online) return null;
    tokenInfo ??= findToken(config);
    return tokenInfo.token;
  }

  function optionsFor(id, yaml) {
    return { ...workflowOptions(yaml), ...(config.options[id] ?? {}) };
  }

  function record(event) {
    seq += 1;
    const entry = { id: seq, at: clock().toISOString(), ...event };
    events.unshift(entry);
    events.length = Math.min(events.length, KEEP_EVENTS);
    emit('event', entry);
  }

  // What changed for the pet since its last visit, worth a notification.
  function noticeChanges(project, pet, prev) {
    if (!prev) return; // a pet seen for the first time says nothing: no flood after a scan
    const say = notes(ui());
    const who = `${pet.name} (${project.folder})`;
    const base = { projectId: project.id, fullName: project.fullName, mood: pet.mood };
    if (pet.events.includes('hatched')) record({ ...base, kind: 'hatched', text: say.hatched(who) });
    if (pet.events.includes('revived')) record({ ...base, kind: 'revived', text: say.revived(who) });
    if (pet.events.includes('levelUp')) record({ ...base, kind: 'levelUp', text: say.levelUp(who, pet.level) });
    if (pet.events.includes('evolved')) record({ ...base, kind: 'evolved', text: say.evolved(who) });
    if (pet.events.includes('questDone')) record({ ...base, kind: 'quest', text: say.quest(who) });
    for (const a of pet.newAchievements ?? []) {
      record({ ...base, kind: 'trophy', text: say.trophy(who, `${a.emoji} ${strings(pet.lang).achievements[a.id] ?? a.id}`) });
    }
    if (prev.lastMood !== pet.mood && say[pet.mood] && attention(pet.mood) !== 'good') {
      record({ ...base, kind: 'mood', urgent: attention(pet.mood) === 'bad', text: `${MOOD_EMOJI[pet.mood]} ${say[pet.mood](who)}` });
    }
  }

  // Reads one repo, raises its pet one step and remembers it.
  async function visit(path, { care = null } = {}) {
    const id = projectId(path);
    const now = clock();
    let info;
    try {
      info = await readRepo(path, { now });
    } catch (err) {
      return { id, path, folder: path.split(/[\\/]/).pop(), error: err.message, fullName: null };
    }
    let snapshot = info.snapshot;
    let isPrivate = projects.get(id)?.isPrivate ?? null;
    let warning = null;
    const auth = info.github ? token() : null;
    if (auth) {
      const hit = online.get(id);
      if (hit && now.getTime() - hit.at < ONLINE_TTL) snapshot = hit.snapshot;
      else {
        try {
          const [owner, repo] = info.fullName.split('/');
          const fresh = await collectSnapshot(createClient({ token: auth, fetch: fetchImpl }), { owner, repo, now });
          fresh.source = 'github';
          online.set(id, { at: now.getTime(), snapshot: fresh });
          snapshot = fresh;
        } catch (err) {
          warning = err.status === 404 ? 'not-found' : err.status === 401 ? 'bad-token' : 'offline';
        }
      }
      if (snapshot.source === 'github') isPrivate = Boolean(snapshot.repo.isPrivate);
    }

    const yaml = readWorkflow(path);
    const options = optionsFor(id, yaml);
    const memory = store.loadMemory(id);
    let prev = memory ?? info.seed ?? null;
    // Once the pet lives on GitHub, it is that pet: same species everywhere.
    if (memory && info.seed?.pet?.species) prev = { ...memory, pet: { ...memory.pet, species: info.seed.pet.species } };
    const user = info.user || safeUser();
    const pet = buildPet({ snapshot, prevState: prev, now, options: { ...options, lang: options.lang || ui(), care: care ? { name: care, user } : undefined } });
    store.saveMemory(id, nextState(pet, prev));
    if (!care) noticeChanges({ id, folder: info.folder, fullName: info.fullName }, pet, memory);

    const readme = findReadme(path);
    const readmeText = readme ? safeRead(join(path, readme)) : '';
    const hasWorkflow = yaml != null;
    const status = !info.github ? 'local'
      : info.petBranch || (info.committedWorkflow && !info.ahead) ? 'live'
        : hasWorkflow ? 'waiting' : 'none';
    return {
      id,
      path,
      folder: info.folder,
      fullName: info.fullName,
      github: info.github,
      remote: info.remote,
      branch: info.branch,
      defaultBranch: info.defaultBranch,
      empty: info.empty,
      dirty: info.dirty,
      ahead: info.ahead,
      behind: info.behind,
      user,
      status,
      hasWorkflow,
      committedWorkflow: info.committedWorkflow,
      readmeHasPet: /legacypet:start|\/legacypet\/pet/.test(readmeText),
      isPrivate,
      warning,
      options,
      snapshot,
      prev,
      care: care ? { name: care, user } : null,
      now: now.toISOString(),
      summary: {
        name: pet.name,
        displayName: pet.displayName,
        mood: pet.mood,
        emoji: MOOD_EMOJI[pet.mood],
        level: pet.level,
        species: pet.speciesId,
        stage: pet.stage,
        speech: pet.speech,
        vitals: pet.vitals,
        attention: attention(pet.mood),
        careOutcome: pet.careOutcome,
        daysSinceCommit: Math.floor(pet.facts.daysSinceCommit),
      },
    };
  }

  async function refresh(ids = null) {
    if (refreshing && !ids) return list();
    refreshing = !ids;
    try {
      const targets = [...projects.values()].filter((p) => !ids || ids.includes(p.id));
      const fresh = await pool(targets, POOL, (p) => visit(p.path));
      for (const p of fresh) projects.set(p.id, p);
      persist();
      emit('change');
    } finally {
      if (!ids) refreshing = false;
    }
    return list();
  }

  async function scan() {
    if (!config.consented || scanning) return list();
    scanning = true;
    emit('change');
    try {
      const paths = await findRepos(config.roots);
      const keep = new Set(paths.map(projectId));
      for (const id of projects.keys()) if (!keep.has(id)) projects.delete(id);
      const fresh = await pool(paths, POOL, (path) => visit(path));
      projects = new Map(fresh.map((p) => [p.id, p]));
      lastScan = clock().toISOString();
      persist();
    } finally {
      scanning = false;
      emit('change');
    }
    return list();
  }

  function list() {
    const hidden = new Set(config.hidden);
    return [...projects.values()].filter((p) => !hidden.has(p.id));
  }

  const hiddenList = () => [...projects.values()].filter((p) => config.hidden.includes(p.id)).map((p) => ({ id: p.id, name: p.fullName ?? p.folder }));

  const get = (id) => {
    const p = projects.get(id);
    if (!p) throw Object.assign(new Error('No such project'), { status: 404 });
    return p;
  };

  return {
    store,
    get config() { return config; },
    get scanning() { return scanning; },
    get lastScan() { return lastScan; },
    events: () => events,
    list,
    hiddenList,
    get,
    scan,
    refresh,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    suggestions: () => suggestFolders({ cwd }),
    tokenSource() {
      if (!config.online) return null;
      tokenInfo ??= findToken(config);
      return tokenInfo.from;
    },
    token,

    updateConfig(patch) {
      const before = config;
      config = { ...config, ...patch, options: { ...config.options, ...(patch.options ?? {}) } };
      if ('token' in patch || 'online' in patch) { tokenInfo = null; online.clear(); }
      store.saveConfig(config);
      emit('config', { before, config });
      return config;
    },

    // Someone said yes: remember the folders and look inside them.
    async allow(roots) {
      const clean = [...new Set(roots.map((r) => String(r).trim()).filter(Boolean))];
      this.updateConfig({ consented: true, roots: clean });
      return scan();
    },

    async care(id, name) {
      const p = get(id);
      const fresh = await visit(p.path, { care: name });
      projects.set(id, fresh);
      persist();
      emit('change');
      return fresh;
    },

    // Writes the pet's files into the repo; with `publish`, commits just those and pushes.
    async adopt(id, { style = 'card', options = {}, publish = false, force = false, readme = true } = {}) {
      const p = get(id);
      if (!p.github) throw Object.assign(new Error('This repo is not on GitHub, so its pet can only live here.'), { status: 400 });
      const merged = { ...p.options, ...options };
      let isPrivate = p.isPrivate;
      if (isPrivate == null) isPrivate = await guessPrivate(p.fullName, token(), fetchImpl);
      const written = adoptLocal(p.path, { fullName: p.fullName, repoName: p.folder, isPrivate, options: merged, style, force, readme });
      const changed = written.files.filter((f) => f.status !== 'exists').map((f) => f.path);
      const result = { ...written, isPrivate, publish: null };
      if (publish) result.publish = await publishAdoption(p.path, changed.length ? changed : written.files.map((f) => f.path));
      if (Object.keys(options).length) this.updateConfig({ options: { [id]: { ...(config.options[id] ?? {}), ...options } } });
      const fresh = await visit(p.path);
      projects.set(id, { ...fresh, isPrivate: isPrivate ?? fresh.isPrivate });
      persist();
      emit('change');
      return { ...result, project: projects.get(id) };
    },

    async publish(id) {
      const p = get(id);
      const paths = ['.github/workflows/legacypet.yml', findReadme(p.path)].filter(Boolean);
      const result = await publishAdoption(p.path, paths);
      const fresh = await visit(p.path);
      projects.set(id, fresh);
      persist();
      emit('change');
      return { publish: result, project: fresh };
    },

    // "Forget everything": settings, memories and the cache. The repos are never touched.
    reset() {
      store.reset();
      config = store.loadConfig();
      projects = new Map();
      events.length = 0;
      online.clear();
      tokenInfo = null;
      lastScan = null;
      emit('change');
    },
  };
}

function safeRead(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function safeUser() {
  try {
    return userInfo().username || 'you';
  } catch {
    return 'you';
  }
}

// Private repos need README image links through github.com (raw.githubusercontent.com
// would 404). Asking GitHub anonymously answers it: a private repo looks like a 404.
async function guessPrivate(fullName, auth, fetchImpl = globalThis.fetch) {
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${fullName}`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'legacypet', ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return Boolean((await res.json()).private);
    return res.status === 404;
  } catch {
    return false;
  }
}
