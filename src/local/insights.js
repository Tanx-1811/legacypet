// What the app's tools read from a repo, beyond what the pet needs: the changes not committed
// yet, branches, stashes and tags, who commits and when, what kinds of commits, the languages and
// the biggest files, the usual project files, the TODOs left in the code, and work reports across
// every repo. Read on demand (a pet's Insights and Code tabs, the Tools page), never during a
// refresh. Every command here only looks: nothing writes to the repo.
// Starting a process is the slow part (half a second each on a busy Windows laptop), so each
// look runs as few git commands as it can, in the same few slots as the refresh (git.js).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DAY } from '../util/time.js';
import { commitKind } from '../term/words.js';
import { fingerprint, git, gitDirs, inSlot, isVendored, languageBytes, parseTree } from './git.js';

const SEP = '\x1f';
const lines = (text) => String(text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
const run = (dir, args, opts = {}) => inSlot(() => git(dir, args, { allowFail: true, ...opts }));

// ----- Working tree -----------------------------------------------------------------
// `git status --porcelain=v1 -z`: "XY path\0", and a rename or copy adds "\0from".
export function parseStatus(text) {
  const parts = String(text ?? '').split('\0');
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i];
    if (entry.length < 4) continue;
    const [x, y] = entry;
    const from = x === 'R' || x === 'C' ? parts[++i] || null : null;
    out.push({ path: entry.slice(3), from, x, y, kind: changeKind(x, y), staged: x !== ' ' && x !== '?' && x !== '!' });
  }
  return out;
}
function changeKind(x, y) {
  if (x === '?') return 'untracked';
  if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) return 'conflict';
  if (x === 'R' || x === 'C') return 'renamed';
  if (x === 'A') return 'added';
  if (x === 'D' || y === 'D') return 'deleted';
  return 'modified';
}

// ----- Branches, tags, stashes -------------------------------------------------------
// One for-each-ref over refs/heads and refs/tags (see REF_FORMAT): branches newest first, with
// their upstream ("[ahead 1, behind 2]" or "[gone]"), and the newest tags.
const REF_FORMAT = ['%(refname)', '%(committerdate:iso-strict)', '%(creatordate:iso-strict)', '%(upstream:short)', '%(upstream:track)', '%(HEAD)', '%(contents:subject)'].join(SEP);
export function parseRefs(text, merged = new Set(), { tags: keepTags = 8 } = {}) {
  const branches = [];
  const tags = [];
  for (const line of lines(text)) {
    const [ref, committed, created, upstream, track = '', head, subject = ''] = line.split(SEP);
    if (ref.startsWith('refs/tags/')) tags.push({ name: ref.slice(10), date: created || committed || null });
    else if (ref.startsWith('refs/heads/')) {
      const name = ref.slice(11);
      branches.push({
        name,
        date: committed || null,
        upstream: upstream || null,
        ahead: Number(/ahead (\d+)/.exec(track)?.[1] ?? 0),
        behind: Number(/behind (\d+)/.exec(track)?.[1] ?? 0),
        gone: /gone/.test(track),
        current: head === '*',
        merged: merged.has(name),
        subject,
      });
    }
  }
  const newest = (a, b) => Date.parse(b.date ?? 0) - Date.parse(a.date ?? 0);
  return { branches: branches.sort(newest), tags: tags.sort(newest).slice(0, keepTags) };
}

export function parseStashes(text) {
  return lines(text).map((line) => {
    const [ref, date, message = ''] = line.split(SEP);
    return { ref, date: date || null, message };
  });
}

// ----- Commits: kinds, when, who -------------------------------------------------------
// When people commit, on their own clocks: rows are weekdays (0 = Sunday), columns hours.
// "2026-10-08T21:33:10+07:00" counts at 21:00 on that Thursday, wherever this computer is.
export function punchCard(isoDates) {
  const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const iso of isoDates) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})/.exec(String(iso));
    if (!m) continue;
    const weekday = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
    grid[weekday][Number(m[4])] += 1;
  }
  return grid;
}

// Conventional Commits, gitmoji or plain words (see commitKind): { feat: 12, fix: 4, ... }.
export function commitTypes(subjects) {
  const out = {};
  for (const s of subjects) {
    const kind = commitKind(s);
    out[kind] = (out[kind] ?? 0) + 1;
  }
  return out;
}

// Who commits most: [{ name, commits }], busiest first.
export function topAuthors(names, top = 12) {
  const counts = new Map();
  for (const name of names) if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, top).map(([name, commits]) => ({ name, commits }));
}

// ----- Files: languages, the biggest ones, the usual project files ---------------------------
export function languageShares(tree, top = 6) {
  const sorted = [...languageBytes(tree)].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, n]) => sum + n, 0);
  if (!total) return [];
  const shares = sorted.slice(0, top).map(([name, bytes]) => ({ name, bytes, share: bytes / total }));
  const rest = sorted.slice(top).reduce((sum, [, n]) => sum + n, 0);
  if (rest) shares.push({ name: 'Other', bytes: rest, share: rest / total, other: true });
  return shares;
}

export function largestFiles(tree, top = 8) {
  return tree.filter((f) => !isVendored(f.path)).sort((a, b) => b.size - a.size).slice(0, top);
}

// The files a well-kept repo usually has. GitHub's community profile, plus CI, tests and tooling.
const DOC = '(|docs\\/|\\.github\\/)';
export const HEALTH_CHECKS = [
  ['readme', new RegExp(`^${DOC}readme(\\.|$)`, 'i')],
  ['license', new RegExp(`^${DOC}(licen[cs]e|copying)(\\.|$)`, 'i')],
  ['contributing', new RegExp(`^${DOC}contributing(\\.|$)`, 'i')],
  ['conduct', new RegExp(`^${DOC}code_of_conduct(\\.|$)`, 'i')],
  ['security', new RegExp(`^${DOC}security(\\.|$)`, 'i')],
  ['changelog', /^(|docs\/)(changelog|changes|history)(\.|$)/i],
  ['templates', new RegExp(`^${DOC}(issue_template|pull_request_template)`, 'i')],
  ['gitignore', /^\.gitignore$/],
  ['editorconfig', /^\.editorconfig$/],
  ['ci', /^(\.github\/workflows\/[^/]+\.ya?ml|\.gitlab-ci\.yml|\.circleci\/config\.yml|azure-pipelines\.yml|jenkinsfile|bitbucket-pipelines\.yml)$/i],
  ['tests', /(^|\/)(tests?|__tests__|specs?)\/|\.(test|spec)\.[a-z]+$|_test\.(go|py|rb)$|(^|\/)test_[^/]+\.py$/i],
  ['deps', /^(\.github\/(dependabot|renovate)\.ya?ml|renovate\.json5?|\.renovaterc(\.json)?)$/i],
];
export function healthChecklist(paths) {
  return HEALTH_CHECKS.map(([id, re]) => ({ id, ok: paths.some((p) => re.test(p)) }));
}

// ----- One repo, up close ---------------------------------------------------------------
async function gatherInsights(dir, now, defaultBranch) {
  const yearAgo = new Date(now.getTime() - 365 * DAY).toISOString();
  const recent = now.getTime() - 90 * DAY;
  // Branches already merged into the default branch are safe to delete: the Code tab says so.
  const into = defaultBranch && /^[\w./-]+$/.test(defaultBranch) ? `refs/heads/${defaultBranch}` : 'HEAD';
  const [refs, merged, log, tree] = await Promise.all([
    run(dir, ['for-each-ref', `--format=${REF_FORMAT}`, 'refs/heads', 'refs/tags']),
    run(dir, ['for-each-ref', `--merged=${into}`, '--format=%(refname:short)', 'refs/heads']),
    run(dir, ['log', `--since=${yearAgo}`, '-n', '5000', `--format=%aI${SEP}%an${SEP}%s`, 'HEAD']),
    run(dir, ['ls-tree', '-r', '-l', 'HEAD']),
  ]);
  const commits = lines(log).map((line) => {
    const [date, author, subject = ''] = line.split(SEP);
    return { date, author, subject };
  });
  const lately = commits.filter((c) => Date.parse(c.date) >= recent);
  const files = parseTree(tree);
  const { branches, tags } = parseRefs(refs, new Set(lines(merged)));
  const main = defaultBranch ?? branches.find((b) => b.current)?.name ?? null;
  return {
    branches: branches.slice(0, 60).map((b) => ({ ...b, merged: b.merged && b.name !== main && !b.current })),
    branchCount: branches.length,
    defaultBranch: main,
    tags,
    authors: topAuthors(commits.map((c) => c.author)),
    yearCommits: commits.length,
    types: commitTypes(lately.map((c) => c.subject)),
    typesDays: 90,
    punch: punchCard(commits.map((c) => c.date)),
    languages: languageShares(files),
    largest: largestFiles(files),
    fileCount: files.length,
    codeBytes: files.reduce((sum, f) => sum + (isVendored(f.path) ? 0 : f.size), 0),
    health: healthChecklist(files.map((f) => f.path)),
  };
}

// The slow part is cached like readRepo's facts: same history, same day, same answers. The
// working tree is read every time (it moves without the history moving), the stashes only when
// there are some.
const cache = new Map();
export async function readInsights(dir, { now = new Date(), defaultBranch = null } = {}) {
  const print = fingerprint(dir);
  const key = print && `${print}|${defaultBranch}|${now.toISOString().slice(0, 10)}`;
  const common = gitDirs(dir)?.common;
  const hasStash = Boolean(common) && existsSync(join(common, 'logs', 'refs', 'stash'));
  const [facts, status, stashes] = await Promise.all([
    key && cache.get(dir)?.key === key ? cache.get(dir).facts : gatherInsights(dir, now, defaultBranch),
    run(dir, ['status', '--porcelain=v1', '-z']),
    hasStash ? run(dir, ['stash', 'list', `--format=%gd${SEP}%cI${SEP}%gs`]) : null,
  ]);
  if (key) cache.set(dir, { key, facts });
  const changes = parseStatus(status);
  return {
    ...facts,
    changes: changes.slice(0, 300),
    changesTotal: changes.length,
    stashes: parseStashes(stashes).slice(0, 30),
    at: now.toISOString(),
  };
}

// ----- TODO, FIXME, HACK and XXX left in the code -----------------------------------------
export const TODO_TAGS = ['TODO', 'FIXME', 'HACK', 'XXX'];
const TODO_RE = new RegExp(`\\b(${TODO_TAGS.join('|')})\\b`);
const TODO_MAX = 500;

// `git grep -n`: "path:line:text". Only tracked files, never binaries.
export function parseTodos(text, max = TODO_MAX) {
  const items = [];
  let total = 0;
  for (const line of String(text ?? '').split('\n')) {
    const m = /^(.+?):(\d+):(.*)$/.exec(line);
    if (!m || isVendored(m[1])) continue;
    const tag = TODO_RE.exec(m[3]);
    if (!tag) continue;
    total += 1;
    if (items.length >= max) continue;
    const said = m[3].slice(tag.index).replace(/\s*(\*\/|-->|#\})\s*$/, '').trim();
    items.push({ path: m[1], line: Number(m[2]), tag: tag[1], text: said.length > 200 ? `${said.slice(0, 199)}…` : said });
  }
  return { items, total, truncated: total > items.length };
}

export async function findTodos(dir) {
  const out = await run(dir, ['grep', '-n', '-I', '-w', '-E', '--no-color', TODO_TAGS.join('|')], { timeout: 30_000 });
  return parseTodos(out);
}

// ----- Work reports across repos -------------------------------------------------------------
// Every commit on any local branch between `since` and `until`; with `mine`, only the ones made
// by whoever this repo's git config says you are (its user.email, or the name in `repo.user`).
// Newest first.
export async function readReport(repos, { since, until = null, mine = true, perRepo = 400 } = {}) {
  const found = await Promise.all(repos.map(async (repo) => {
    const [log, email] = await Promise.all([
      run(repo.path, ['log', '--branches', '--no-merges', `--since=${since}`, ...(until ? [`--until=${until}`] : []), '-n', String(perRepo), `--format=%h${SEP}%aI${SEP}%an${SEP}%ae${SEP}%s`]),
      mine ? run(repo.path, ['config', '--get', 'user.email']) : null,
    ]);
    const me = { email: email?.trim().toLowerCase() || null, name: repo.user?.trim().toLowerCase() || null };
    return lines(log).map((line) => {
      const [sha, date, author, mail = '', subject = ''] = line.split(SEP);
      return { projectId: repo.id, sha, date, author, email: mail.toLowerCase(), subject, kind: commitKind(subject) };
    }).filter((c) => !mine || (me.email && c.email === me.email) || (me.name && c.author.toLowerCase() === me.name));
  }));
  const commits = found.flat().sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 3000);
  const types = {};
  for (const c of commits) {
    delete c.email; // who wrote it is enough: addresses stay out of the page
    types[c.kind] = (types[c.kind] ?? 0) + 1;
  }
  return { since, until, mine, commits, types };
}
