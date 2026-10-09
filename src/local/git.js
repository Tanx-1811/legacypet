// Reads a repo on this computer with plain `git` commands and turns it into the same
// snapshot the GitHub Action builds from the API. Nothing here touches the network:
// CI, issues and stars are unknown offline, and the pet treats them as such.
import { execFile } from 'node:child_process';
import { basename } from 'node:path';
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

// The pet the GitHub Action already raised, if the `legacypet` branch has been fetched:
// its memory keeps the species, trophies and history in step with the one on GitHub.
async function petFromBranch(dir) {
  const text = await git(dir, ['show', 'refs/remotes/origin/legacypet:pet.json'], { allowFail: true });
  if (!text) return null;
  try {
    const state = JSON.parse(text);
    return state && typeof state === 'object' && state.generator === 'legacypet' ? state : null;
  } catch {
    return null;
  }
}

// Everything about one local repo: its snapshot for the pet engine, plus what only a local
// copy knows (uncommitted changes, commits not pushed yet, whether the pet is installed).
export async function readRepo(dir, { now = new Date() } = {}) {
  const ok = (args) => git(dir, args, { allowFail: true });
  const since = new Date(now.getTime() - RECENT_DAYS * DAY).toISOString();
  const [remote, branch, originHead, count, roots, log, last, tag, authors, status, aheadBehind, petBranch, tree, user] = await Promise.all([
    ok(['config', '--get', 'remote.origin.url']),
    ok(['rev-parse', '--abbrev-ref', 'HEAD']),
    ok(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']),
    ok(['rev-list', '--count', 'HEAD']),
    ok(['log', '--max-parents=0', '--format=%cI', 'HEAD']),
    ok(['log', '-n', '600', `--since=${since}`, `--format=%H${SEP}%cI${SEP}%an`, 'HEAD']),
    ok(['log', '-1', `--format=%H${SEP}%cI`, 'HEAD']),
    ok(['for-each-ref', '--sort=-creatordate', '--count=1', `--format=%(refname:short)${SEP}%(creatordate:iso-strict)`, 'refs/tags']),
    ok(['shortlog', '-s', '-n', '-e', 'HEAD']),
    ok(['status', '--porcelain=v1']),
    ok(['rev-list', '--left-right', '--count', '@{upstream}...HEAD']),
    ok(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/legacypet']),
    ok(['ls-tree', '-r', '-l', 'HEAD']),
    ok(['config', '--get', 'user.name']),
  ]);

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
  const files = parseTree(tree);
  const [behind, ahead] = aheadBehind ? aheadBehind.trim().split(/\s+/).map(Number) : [null, null];
  const defaultBranch = originHead?.trim().replace(/^origin\//, '') || (branch?.trim() !== 'HEAD' ? branch?.trim() : null) || 'main';
  const seed = petBranch ? await petFromBranch(dir) : null;

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
      language: guessLanguage(files), createdAt: firstDate, pushedAt: lastDate ?? firstDate,
    },
    commits: { total, lastDate: lastDate ?? null, headSha: headSha ?? null, recent },
    ci,
    issues: null,
    release: tagName ? { tag: tagName, name: tagName, publishedAt: tagDate } : null,
    community: files.length ? { health: communityHealth(files.map((f) => f.path)) } : null,
    contributors: { total: Math.max(1, lines(authors).length) },
    treats: [],
    warnings: [],
    fetchedAt: now.toISOString(),
    source: 'local',
  };

  const paths = new Set(files.map((f) => f.path));
  return {
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
    petBranch: Boolean(petBranch),
    committedWorkflow: paths.has('.github/workflows/legacypet.yml'),
    user: user?.trim() || null,
    seed,
    snapshot,
  };
}
