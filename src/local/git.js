// Reads a repo on this computer with plain `git` commands and turns it into the same
// snapshot the GitHub Action builds from the API. Nothing here touches the network:
// CI, issues and stars are unknown offline, and the pet treats them as such.
import { execFile } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { parseRemote } from '../setup.js';
import { DAY } from '../util/time.js';

const RECENT_DAYS = 90;
const SEP = '\x1f';

// Runs git in `dir`. Never prompts for a password (a hanging prompt would freeze the app).
export function git(dir, args, { timeout = 20_000, allowFail = false, env = {} } = {}) {
  return new Promise((resolve, reject) => {
    execFile('git', ['-C', dir, ...args], {
      timeout,
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C', ...env },
    }, (err, stdout, stderr) => {
      if (err) {
        if (allowFail) return resolve(null);
        err.stderr = String(stderr ?? '');
        return reject(err);
      }
      resolve(String(stdout));
    });
  });
}

const lines = (text) => String(text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
const isBot = (name) => /\[bot\]$/i.test(name ?? '') || /^(dependabot|renovate|github-actions)\b/i.test(name ?? '');

// Linguist decides a repo's language by bytes of code; this is a small, offline version of it.
// Only Rust and Python change the species, the rest is for the label.
const LANGUAGES = {
  rs: 'Rust', py: 'Python', ipynb: 'Jupyter Notebook', js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JavaScript',
  ts: 'TypeScript', tsx: 'TypeScript', go: 'Go', java: 'Java', kt: 'Kotlin', kts: 'Kotlin', swift: 'Swift', rb: 'Ruby',
  php: 'PHP', c: 'C', h: 'C', cc: 'C++', cpp: 'C++', cxx: 'C++', hpp: 'C++', cs: 'C#', dart: 'Dart', vue: 'Vue',
  svelte: 'Svelte', html: 'HTML', css: 'CSS', scss: 'SCSS', sh: 'Shell', bash: 'Shell', zsh: 'Shell', lua: 'Lua',
  ex: 'Elixir', exs: 'Elixir', hs: 'Haskell', scala: 'Scala', r: 'R', m: 'Objective-C', mm: 'Objective-C', zig: 'Zig',
  pl: 'Perl', clj: 'Clojure', erl: 'Erlang', fs: 'F#', ml: 'OCaml', nim: 'Nim', sol: 'Solidity', gd: 'GDScript',
};
const VENDORED = /(^|\/)(node_modules|vendor|third_party|dist|build|out|target|\.next|coverage|Pods)\//;
const MINIFIED = /\.min\.(js|css)$/;

export function guessLanguage(tree) {
  const bytes = new Map();
  for (const { path, size } of tree) {
    if (VENDORED.test(path) || MINIFIED.test(path)) continue;
    const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase();
    const lang = ext && LANGUAGES[ext];
    if (lang) bytes.set(lang, (bytes.get(lang) ?? 0) + size);
  }
  let best = null;
  for (const [lang, n] of bytes) if (!best || n > best[1]) best = [lang, n];
  return best?.[0] ?? null;
}

// GitHub's community profile, counted from files: README, license, code of conduct,
// contributing guide, issue templates and a pull request template.
const COMMUNITY = [
  /^(|docs\/|\.github\/)readme(\.|$)/i,
  /^(|docs\/|\.github\/)(licen[cs]e|copying)(\.|$)/i,
  /^(|docs\/|\.github\/)code_of_conduct(\.|$)/i,
  /^(|docs\/|\.github\/)contributing(\.|$)/i,
  /^(|docs\/|\.github\/)(issue_template(\.|\/)|issue_template$)/i,
  /^(|docs\/|\.github\/)(pull_request_template(\.|\/)|pull_request_template$)/i,
];
export function communityHealth(paths) {
  const found = COMMUNITY.filter((re) => paths.some((p) => re.test(p))).length;
  return Math.round((found / COMMUNITY.length) * 100);
}

function parseTree(text) {
  const out = [];
  for (const line of String(text ?? '').split('\n')) {
    const tab = line.indexOf('\t');
    if (tab === -1) continue;
    const [, type, , size] = line.slice(0, tab).split(/\s+/);
    if (type !== 'blob') continue;
    out.push({ path: line.slice(tab + 1), size: Number(size) || 0 });
    if (out.length >= 60_000) break;
  }
  return out;
}

// Commits per day over the last year, by the day the committer saw on their own clock:
// { '2026-10-08': 3, ... }, for the activity calendar.
export function dailyCounts(dates) {
  const out = {};
  for (const d of dates) {
    const day = String(d).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) out[day] = (out[day] ?? 0) + 1;
  }
  return out;
}

// The pet the GitHub Action already raised, if the `legacypet` branch has been fetched:
// its memory keeps the species, trophies and history in step with the one on GitHub.
function parsePet(text) {
  if (!text) return null;
  try {
    const state = JSON.parse(text);
    return state && typeof state === 'object' && state.generator === 'legacypet' ? state : null;
  } catch {
    return null;
  }
}

// Reading a repo takes a dozen small git commands. Dozens of them at once (several repos, each
// running all of its commands together) make a slow computer stutter, and on Windows starting a
// process is costly, so reads share a few slots: at most as many git processes as the computer
// has cores (between 2 and 8). A waiting command gets the slot straight from the one finishing.
const SLOTS = Math.max(2, Math.min(8, availableParallelism()));
let busy = 0;
const queue = [];
async function inSlot(fn) {
  if (busy < SLOTS) busy += 1;
  else await new Promise((go) => queue.push(go));
  try {
    return await fn();
  } finally {
    const next = queue.shift();
    if (next) next();
    else busy -= 1;
  }
}

// Where a repo keeps its history: `.git`, or the folder a `.git` file points to (a worktree).
export function gitDirs(dir) {
  const dotGit = join(dir, '.git');
  try {
    if (!statSync(dotGit).isFile()) return { own: dotGit, common: dotGit };
    const target = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, 'utf8'))?.[1]?.trim();
    if (!target) return null;
    const own = isAbsolute(target) ? target : resolve(dir, target);
    let common = own;
    try { common = resolve(own, readFileSync(join(own, 'commondir'), 'utf8').trim()); } catch { /* not a worktree */ }
    return { own, common };
  } catch {
    return null;
  }
}

// A cheap summary of everything that moves when the repo's history does: the size and time of
// HEAD's reflog, the index, the refs and the config, from a few stat() calls and no process.
// The same fingerprint (on the same day) gives the same answers, so they can be reused.
export function fingerprint(dir) {
  const dirs = gitDirs(dir);
  if (!dirs) return null;
  let head;
  try {
    head = readFileSync(join(dirs.own, 'HEAD'), 'utf8').trim();
  } catch {
    return null;
  }
  const ref = /^ref:\s*(.+)$/.exec(head)?.[1];
  const files = [
    join(dirs.own, 'index'), join(dirs.own, 'logs', 'HEAD'), join(dirs.own, 'FETCH_HEAD'),
    join(dirs.common, 'packed-refs'), join(dirs.common, 'config'), join(dirs.common, 'refs', 'heads'),
    join(dirs.common, 'refs', 'remotes', 'origin'), join(dirs.common, 'refs', 'tags'),
    ...(ref ? [join(dirs.common, ref)] : []),
  ];
  const stamp = (file) => {
    try {
      const st = statSync(file);
      return `${st.size}:${st.mtimeMs}`;
    } catch {
      return '-';
    }
  };
  return [head, ...files.map(stamp)].join('|');
}

// What git says about a repo, boiled down (the file list alone can be megabytes; only what the
// pet needs from it is kept). None of it changes until the history does.
async function gather(dir, now) {
  const ok = (args) => inSlot(() => git(dir, args, { allowFail: true }));
  const since = new Date(now.getTime() - RECENT_DAYS * DAY).toISOString();
  const yearAgo = new Date(now.getTime() - 371 * DAY).toISOString();
  const [remote, branch, originHead, count, roots, log, last, tag, authors, aheadBehind, petBranch, tree, user, year, latest] = await Promise.all([
    ok(['config', '--get', 'remote.origin.url']),
    ok(['rev-parse', '--abbrev-ref', 'HEAD']),
    ok(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']),
    ok(['rev-list', '--count', 'HEAD']),
    ok(['log', '--max-parents=0', '--format=%cI', 'HEAD']),
    ok(['log', '-n', '600', `--since=${since}`, `--format=%H${SEP}%cI${SEP}%an`, 'HEAD']),
    ok(['log', '-1', `--format=%H${SEP}%cI`, 'HEAD']),
    ok(['for-each-ref', '--sort=-creatordate', '--count=1', `--format=%(refname:short)${SEP}%(creatordate:iso-strict)`, 'refs/tags']),
    ok(['shortlog', '-s', '-n', '-e', 'HEAD']),
    ok(['rev-list', '--left-right', '--count', '@{upstream}...HEAD']),
    ok(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/legacypet']),
    ok(['ls-tree', '-r', '-l', 'HEAD']),
    ok(['config', '--get', 'user.name']),
    ok(['log', `--since=${yearAgo}`, '--format=%cI', 'HEAD']),
    ok(['log', '-n', '15', `--format=%h${SEP}%cI${SEP}%an${SEP}%s`, 'HEAD']),
  ]);
  const files = parseTree(tree);
  const paths = new Set(files.map((f) => f.path));
  return {
    remote, branch, originHead, count, roots, log, last, tag, authors: lines(authors).length, aheadBehind, user, year, latest,
    seed: petBranch ? parsePet(await ok(['show', 'refs/remotes/origin/legacypet:pet.json'])) : null,
    petBranch: Boolean(petBranch),
    language: guessLanguage(files),
    health: files.length ? communityHealth(files.map((f) => f.path)) : null,
    committedWorkflow: paths.has('.github/workflows/legacypet.yml'),
  };
}

// The last answers per repo, with the fingerprint (and day) they were read at.
const reads = new Map();

// Everything about one local repo: its snapshot for the pet engine, plus what only a local
// copy knows (uncommitted changes, commits not pushed yet, whether the pet is installed).
// A repo whose history hasn't moved since the last read today only runs `git status`.
export async function readRepo(dir, { now = new Date() } = {}) {
  const print = fingerprint(dir);
  const key = print && `${print}|${now.toISOString().slice(0, 10)}`;
  const [known, status] = await Promise.all([
    key && reads.get(dir)?.key === key ? reads.get(dir).facts : gather(dir, now),
    inSlot(() => git(dir, ['status', '--porcelain=v1'], { allowFail: true })),
  ]);
  if (key) reads.set(dir, { key, facts: known });
  const { remote, branch, originHead, count, roots, log, last, tag, authors, aheadBehind, user, year, latest, seed } = known;

  const github = parseRemote(remote ?? '');
  const folder = basename(dir);
  const fullName = github ?? `local/${folder}`;
  const [owner, name] = fullName.split('/');
  const total = count == null ? 0 : Number(count.trim()) || 0;
  const [headSha, lastDate] = last ? last.trim().split(SEP) : [null, null];
  const firstDate = lines(roots).sort()[0] ?? lastDate ?? now.toISOString();
  const recent = lines(log).map((line) => {
    const [sha, date, author] = line.split(SEP);
    return { sha, date, author: author || null, bot: isBot(author) };
  });
  const [tagName, tagDate] = tag ? tag.trim().split(SEP) : [];
  const [behind, ahead] = aheadBehind ? aheadBehind.trim().split(/\s+/).map(Number) : [null, null];
  const defaultBranch = originHead?.trim().replace(/^origin\//, '') || (branch?.trim() !== 'HEAD' ? branch?.trim() : null) || 'main';

  // The Action's last run saw CI; offline we can't. Its health tells us how CI looked then.
  let ci = { state: 'unknown', total: 0, failing: 0, failingNames: [] };
  const seedAge = seed?.generatedAt ? (now.getTime() - Date.parse(seed.generatedAt)) / DAY : Infinity;
  if (seed?.vitals && seedAge <= 7) {
    if (seed.vitals.health >= 100) ci = { state: 'passing', total: 1, failing: 0, failingNames: [] };
    else if (seed.vitals.health < 70) ci = { state: 'failing', total: 1, failing: 1, failingNames: ['CI'] };
  }

  const snapshot = {
    repo: {
      owner, name, fullName, defaultBranch, archived: false, isPrivate: false, stars: seed?.facts?.stars ?? 0, forks: 0,
      language: known.language, createdAt: firstDate, pushedAt: lastDate ?? firstDate,
    },
    commits: { total, lastDate: lastDate ?? null, headSha: headSha ?? null, recent },
    ci,
    issues: null,
    release: tagName ? { tag: tagName, name: tagName, publishedAt: tagDate } : null,
    community: known.health == null ? null : { health: known.health },
    contributors: { total: Math.max(1, authors) },
    treats: [],
    warnings: [],
    fetchedAt: now.toISOString(),
    source: 'local',
  };

  return {
    activity: dailyCounts(lines(year)),
    log: lines(latest).map((line) => {
      const [sha, date, author, subject] = line.split(SEP);
      return { sha, date, author, subject: subject ?? '' };
    }),
    path: dir,
    folder,
    fullName,
    github: Boolean(github),
    remote: remote?.trim() || null,
    branch: branch?.trim() || null,
    defaultBranch,
    empty: total === 0,
    dirty: lines(status).length,
    ahead: Number.isFinite(ahead) ? ahead : null,
    behind: Number.isFinite(behind) ? behind : null,
    petBranch: known.petBranch,
    committedWorkflow: known.committedWorkflow,
    user: user?.trim() || null,
    seed,
    snapshot,
  };
}
