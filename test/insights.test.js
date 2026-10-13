// The app's tools: what git says about a repo beyond the pet (src/local/insights.js), work
// reports across repos, and the API the Tools page and a pet's Insights and Code tabs use.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { startServer } from '../src/app/server.js';
import {
  commitTypes, findTodos, healthChecklist, languageShares, parseRefs, parseStashes, parseStatus, parseTodos, punchCard, readInsights,
  readReport, topAuthors,
} from '../src/local/insights.js';
import { fileArgs } from '../src/local/open.js';
import { createProjects } from '../src/local/projects.js';
import { createStore } from '../src/local/store.js';

const DAY = 86_400_000;
const NOW = new Date('2026-10-08T12:00:00Z');
const SEP = '\x1f';
const temp = mkdtempSync(join(tmpdir(), 'legacypet-insights-'));
after(() => rmSync(temp, { recursive: true, force: true }));
let n = 0;
const dir = (name) => {
  const path = join(temp, `${name}-${++n}`);
  mkdirSync(path, { recursive: true });
  return path;
};

const PEOPLE = { ada: ['Ada', 'ada@example.com'], bob: ['Bob', 'bob@example.com'] };
function sh(cwd, args, { daysAgo = 0, who = 'ada' } = {}) {
  const date = new Date(NOW.getTime() - daysAgo * DAY).toISOString();
  const [name, email] = PEOPLE[who];
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date, GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email,
      GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email, GIT_CONFIG_NOSYSTEM: '1',
      // `git status` here must not refresh the index: that would move the repo's fingerprint.
      GIT_OPTIONAL_LOCKS: '0',
    },
  });
}
function write(root, files) {
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(join(root, file, '..'), { recursive: true });
    writeFileSync(join(root, file), text);
  }
}
// A repo whose commits are [subject, daysAgo, who], oldest first.
function makeRepo(path, commits, files = {}) {
  mkdirSync(path, { recursive: true });
  sh(path, ['init', '-q', '-b', 'main']);
  sh(path, ['config', 'user.name', 'Ada']);
  sh(path, ['config', 'user.email', 'ada@example.com']);
  sh(path, ['config', 'commit.gpgsign', 'false']);
  sh(path, ['config', 'tag.gpgsign', 'false']);
  write(path, files);
  commits.forEach(([subject, daysAgo, who = 'ada'], i) => {
    writeFileSync(join(path, 'log.txt'), `${i}\n`);
    sh(path, ['add', '.'], { daysAgo, who });
    sh(path, ['commit', '-q', '-m', subject], { daysAgo, who });
  });
  return path;
}

test('the working tree: modified, staged, renamed, untracked and conflicting files', () => {
  const changes = parseStatus('R  src/new.js\0src/old.js\0 M README.md\0?? notes.txt\0D  gone.js\0UU both.js\0A  added.js\0');
  assert.deepEqual(changes.map((c) => [c.path, c.kind, c.staged]), [
    ['src/new.js', 'renamed', true], ['README.md', 'modified', false], ['notes.txt', 'untracked', false],
    ['gone.js', 'deleted', true], ['both.js', 'conflict', true], ['added.js', 'added', true],
  ]);
  assert.equal(changes[0].from, 'src/old.js');
  assert.deepEqual(parseStatus(''), []);
  assert.deepEqual(parseStatus(null), []);
});

test('branches with their upstream, newest first, and the newest tags', () => {
  const row = (...cells) => cells.join(SEP);
  const { branches, tags } = parseRefs([
    row('refs/heads/old', '2026-09-01T10:00:00+00:00', '', '', '', ' ', 'old work'),
    row('refs/heads/main', '2026-10-08T10:00:00+00:00', '', 'origin/main', '[ahead 2, behind 1]', '*', 'feat: x'),
    row('refs/heads/lost', '2026-10-01T10:00:00+00:00', '', 'origin/lost', '[gone]', ' ', 'wip'),
    row('refs/tags/v1', '', '2026-09-03T10:00:00+00:00', '', '', ' ', 'release'),
    row('refs/tags/v2', '2026-10-02T10:00:00+00:00', '2026-10-02T10:00:00+00:00', '', '', ' ', 'release'),
  ].join('\n'), new Set(['old']));
  assert.deepEqual(branches.map((b) => b.name), ['main', 'lost', 'old']);
  assert.deepEqual(branches[0], {
    name: 'main', date: '2026-10-08T10:00:00+00:00', upstream: 'origin/main', ahead: 2, behind: 1, gone: false, current: true, merged: false, subject: 'feat: x',
  });
  assert.equal(branches[1].gone, true);
  assert.equal(branches[2].merged, true);
  assert.deepEqual(tags.map((t) => t.name), ['v2', 'v1']);
  assert.equal(tags[1].date, '2026-09-03T10:00:00+00:00', 'an annotated tag has only its tagger date');
  assert.deepEqual(parseStashes(`stash@{0}${SEP}2026-10-07T09:00:00+00:00${SEP}WIP on main: x`), [{ ref: 'stash@{0}', date: '2026-10-07T09:00:00+00:00', message: 'WIP on main: x' }]);
});

test('when commits happen is read on each committer\'s own clock', () => {
  const grid = punchCard(['2026-10-08T21:33:10+07:00', '2026-10-08T21:59:00-05:00', '2026-10-11T00:05:00-05:00', 'garbage']);
  assert.equal(grid.length, 7);
  assert.ok(grid.every((row) => row.length === 24));
  assert.equal(grid[4][21], 2, 'Thursday 21:00 twice, whatever the offset');
  assert.equal(grid[0][0], 1, 'Sunday just after midnight');
  assert.equal(grid.flat().reduce((a, b) => a + b, 0), 3);
});

test('kinds of commits, the busiest people, languages and the usual project files', () => {
  assert.deepEqual(commitTypes(['feat: a', 'fix(ui): b', '✨ c', 'Merge branch x', 'update stuff', 'docs: d']), { feat: 2, fix: 1, merge: 1, other: 1, docs: 1 });
  assert.deepEqual(topAuthors(['Ada', 'Bob', 'Ada', null, 'Ada', 'Bob', 'Cy'], 2), [{ name: 'Ada', commits: 3 }, { name: 'Bob', commits: 2 }]);

  const shares = languageShares([
    { path: 'src/main.rs', size: 600 }, { path: 'app.py', size: 200 }, { path: 'x.go', size: 100 }, { path: 'y.rb', size: 100 },
    { path: 'node_modules/big.js', size: 9e6 }, { path: 'web/app.min.js', size: 9e6 }, { path: 'README.md', size: 50 },
  ], 2);
  assert.deepEqual(shares.map((s) => [s.name, s.share]), [['Rust', 0.6], ['Python', 0.2], ['Other', 0.2]]);
  assert.equal(shares[2].other, true);
  assert.deepEqual(languageShares([{ path: 'README.md', size: 10 }]), []);

  const health = Object.fromEntries(healthChecklist([
    'README.md', 'LICENSE', '.github/workflows/ci.yml', 'src/app.test.js', '.gitignore', 'docs/CONTRIBUTING.md', '.github/dependabot.yml',
  ]).map((x) => [x.id, x.ok]));
  assert.deepEqual(health, {
    readme: true, license: true, contributing: true, conduct: false, security: false, changelog: false, templates: false,
    gitignore: true, editorconfig: false, ci: true, tests: true, deps: true,
  });
  assert.ok(healthChecklist([]).every((x) => !x.ok));
});

test('TODOs: tagged lines in tracked files, vendored code left out, and a cap', () => {
  const found = parseTodos([
    'src/a.js:3:  // TODO: handle errors */',
    'src/b.py:10:# FIXME broken on Windows',
    'node_modules/x/index.js:1:// TODO not ours',
    'notes.md:4:This is not a todo',
    'C:/weird:path.js:7:/* HACK around it */',
  ].join('\n'));
  assert.deepEqual(found.items.map((x) => [x.path, x.line, x.tag, x.text]), [
    ['src/a.js', 3, 'TODO', 'TODO: handle errors'],
    ['src/b.py', 10, 'FIXME', 'FIXME broken on Windows'],
    ['C:/weird:path.js', 7, 'HACK', 'HACK around it'],
  ]);
  assert.equal(found.total, 3);
  assert.equal(found.truncated, false);
  const many = parseTodos(Array.from({ length: 30 }, (_, i) => `f.js:${i + 1}:// TODO ${i}`).join('\n'), 10);
  assert.equal(many.items.length, 10);
  assert.equal(many.total, 30);
  assert.equal(many.truncated, true);
});

test('a file opens at its line in editors that take one', () => {
  const tool = (id, cmd = `/bin/${id}`) => ({ id, cmd, args: (p) => [p] });
  assert.deepEqual(fileArgs(tool('vscode'), '/r/a.js', 12), ['--goto', '/r/a.js:12']);
  assert.deepEqual(fileArgs(tool('cursor'), '/r/a.js', 3), ['--goto', '/r/a.js:3']);
  assert.deepEqual(fileArgs(tool('zed'), '/r/a.js', 3), ['/r/a.js:3']);
  assert.deepEqual(fileArgs(tool('vscode'), '/r/a.js'), ['/r/a.js'], 'no line, just the file');
  assert.deepEqual(fileArgs(tool('vscode'), '/r/a.js', -1), ['/r/a.js']);
  assert.deepEqual(fileArgs(tool('idea'), '/r/a.js', 3), ['/r/a.js'], 'an editor without a line option gets the file');
  const mac = { id: 'vscode', cmd: 'open', args: (p) => ['-a', 'Visual Studio Code', p] };
  assert.deepEqual(fileArgs(mac, '/r/a.js', 3), ['-a', 'Visual Studio Code', '/r/a.js'], "macOS's open can't take a line");
});

// One real repo for the rest: a few kinds of commits, a merged and an unmerged branch, a tag,
// a stash, a change not committed and TODOs (one of them in vendored code).
const repo = makeRepo(dir('insights'), [['docs: readme', 9], ['feat: add the parser', 5], ['fix: off by one', 2], ['feat: the tools page', 1, 'bob']], {
  'README.md': '# demo\n',
  LICENSE: 'MIT\n',
  '.gitignore': 'node_modules\n',
  'src/main.rs': `${'fn main() {}\n'.repeat(60)}// TODO: tidy this up\n`,
  'app.py': '# FIXME broken\nprint(1)\n',
  'tests/app.test.js': 'test()\n',
  'vendor/lib.js': '// TODO vendored, not ours\n',
});
sh(repo, ['branch', 'old', 'HEAD~2']);
sh(repo, ['checkout', '-q', '-b', 'feature']);
writeFileSync(join(repo, 'feature.txt'), 'new\n');
sh(repo, ['add', '.']);
sh(repo, ['commit', '-q', '-m', 'feat: on a branch']);
sh(repo, ['checkout', '-q', 'main']);
sh(repo, ['tag', 'v1.0']);
writeFileSync(join(repo, 'README.md'), '# stashed\n');
sh(repo, ['stash', '-q']);
writeFileSync(join(repo, 'README.md'), '# changed\n');
writeFileSync(join(repo, 'new.txt'), 'untracked\n');

test('insights: a real repo, read with plain git and nothing written', async () => {
  const before = sh(repo, ['status', '--porcelain=v1']);
  const d = await readInsights(repo, { now: NOW, defaultBranch: 'main' });
  assert.equal(sh(repo, ['status', '--porcelain=v1']), before, 'reading changes nothing');

  assert.deepEqual(d.changes.map((c) => [c.path, c.kind]).sort(), [['README.md', 'modified'], ['new.txt', 'untracked']]);
  assert.equal(d.changesTotal, 2);
  assert.equal(d.stashes.length, 1);
  assert.match(d.stashes[0].ref, /^stash@\{0\}$/);

  const branches = Object.fromEntries(d.branches.map((b) => [b.name, b]));
  assert.deepEqual(Object.keys(branches).sort(), ['feature', 'main', 'old']);
  assert.equal(branches.main.current, true);
  assert.equal(branches.main.merged, false, 'the default branch is never "merged"');
  assert.equal(branches.old.merged, true, 'behind main: safe to delete');
  assert.equal(branches.feature.merged, false);
  assert.equal(d.branchCount, 3);
  assert.equal(d.defaultBranch, 'main');
  assert.deepEqual(d.tags.map((t) => t.name), ['v1.0']);

  assert.equal(d.yearCommits, 4);
  assert.deepEqual(d.types, { docs: 1, feat: 2, fix: 1 });
  assert.deepEqual(d.authors, [{ name: 'Ada', commits: 3 }, { name: 'Bob', commits: 1 }]);
  assert.equal(d.punch.flat().reduce((a, b) => a + b, 0), 4);
  assert.equal(d.languages[0].name, 'Rust');
  assert.ok(!d.largest.some((f) => f.path.startsWith('vendor/')));
  assert.equal(d.largest[0].path, 'src/main.rs');
  const health = Object.fromEntries(d.health.map((x) => [x.id, x.ok]));
  assert.equal(health.readme && health.license && health.gitignore && health.tests, true);
  assert.equal(health.contributing || health.ci, false);

  // Same history, same day: the slow part comes from the cache, the working tree is read again.
  writeFileSync(join(repo, 'another.txt'), 'x\n');
  const again = await readInsights(repo, { now: NOW, defaultBranch: 'main' });
  assert.equal(again.changesTotal, 3);
  assert.equal(again.branches, d.branches, 'cached');
  rmSync(join(repo, 'another.txt'));
});

test('TODOs in a real repo, never the vendored ones', async () => {
  const { items, total } = await findTodos(repo);
  assert.equal(total, 2);
  assert.deepEqual(items.map((x) => [x.path, x.tag]).sort(), [['app.py', 'FIXME'], ['src/main.rs', 'TODO']]);
  assert.equal(items.find((x) => x.tag === 'TODO').line, 61);
});

test('work reports: every local branch, newest first, mine or everyone\'s', async () => {
  const other = makeRepo(dir('other'), [['chore: deps', 3], ['feat: bob was here', 1, 'bob'], ['refactor: tidy', 0]]);
  const repos = [{ id: 'a', path: repo }, { id: 'b', path: other }];
  const since = new Date(NOW.getTime() - 2.5 * DAY).toISOString();
  const all = await readReport(repos, { since, mine: false });
  assert.deepEqual(all.commits.map((c) => [c.projectId, c.subject]), [
    ['a', 'feat: on a branch'], ['b', 'refactor: tidy'], ['a', 'feat: the tools page'], ['b', 'feat: bob was here'], ['a', 'fix: off by one'],
  ]);
  assert.ok(all.commits.every((c) => !('email' in c)), 'addresses stay out of the page');
  assert.deepEqual(all.types, { feat: 3, refactor: 1, fix: 1 });

  const mine = await readReport(repos, { since, mine: true });
  assert.deepEqual(mine.commits.map((c) => c.subject), ['feat: on a branch', 'refactor: tidy', 'fix: off by one']);
  const until = await readReport(repos, { since, until: new Date(NOW.getTime() - 1.5 * DAY).toISOString(), mine: false });
  assert.deepEqual(until.commits.map((c) => c.subject), ['fix: off by one']);
});

function call(port, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({
      host: '127.0.0.1', port, path, method: body ? 'POST' : 'GET',
      headers: { host: `127.0.0.1:${port}`, ...(token ? { 'x-legacypet-token': token } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    }, (res) => {
      let text = '';
      res.on('data', (c) => { text += c; });
      res.on('end', () => resolve({ status: res.statusCode, json: () => JSON.parse(text) }));
    });
    req.on('error', reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
}

test('server: reports, insights, TODOs and files only from inside a project', async () => {
  const root = dir('roots');
  makeRepo(join(root, 'alpha'), [['feat: one', 1], ['fix: two', 0]], { 'src/a.js': '// TODO: test me\n' });
  const projects = createProjects({ store: createStore(dir('server-data')), now: () => NOW });
  await projects.allow([root]);
  const app = await startServer({ port: 0, projects, autoRefresh: false });
  try {
    const { port, secret } = app;
    const post = (path, body = {}) => call(port, path, { token: secret, body });
    const id = projects.list()[0].id;

    assert.equal((await call(port, '/api/report', { body: { since: NOW.toISOString() } })).status, 403, 'needs the secret');
    assert.equal((await post('/api/report', { since: 'yesterday-ish' })).status, 400);
    const report = (await post('/api/report', { since: new Date(NOW.getTime() - 3 * DAY).toISOString(), mine: false })).json();
    assert.deepEqual(report.commits.map((c) => [c.projectId, c.subject]), [[id, 'fix: two'], [id, 'feat: one']]);

    const insights = (await post(`/api/projects/${id}/insights`)).json();
    assert.deepEqual(insights.branches.map((b) => b.name), ['main']);
    assert.equal(insights.yearCommits, 2);
    const todos = (await post(`/api/projects/${id}/todos`)).json();
    assert.deepEqual(todos.items.map((x) => [x.path, x.line]), [['src/a.js', 1]]);

    assert.equal((await post(`/api/projects/${id}/file`, { path: '../../outside.txt' })).status, 400, 'no climbing out');
    assert.equal((await post(`/api/projects/${id}/file`, { path: '' })).status, 400);
    assert.equal((await post(`/api/projects/${id}/file`, { path: 'src/missing.js', line: 3 })).status, 404);
    assert.equal((await post('/api/projects/000000000000/insights')).status, 404);
  } finally {
    await app.close();
  }
});
