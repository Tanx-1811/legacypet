import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { after, test } from 'node:test';
import { startServer } from '../src/app/server.js';
import { adoptLocal, gitHint, publishAdoption, workflowOptions } from '../src/local/adopt.js';
import { communityHealth, dailyCounts, guessLanguage, readRepo } from '../src/local/git.js';
import { detectTools, publicTools } from '../src/local/open.js';
import {
  cleanConfigPatch, cleanOptions, createProjects, inQuietHours, localDay, notifyRules, STREAK_REMINDER_HOUR,
} from '../src/local/projects.js';
import { findRepos, suggestFolders } from '../src/local/scan.js';
import { createStore, projectId } from '../src/local/store.js';
import { workflowYaml } from '../src/setup.js';

const DAY = 86_400_000;
const NOW = new Date('2026-10-08T12:00:00Z');
const temp = mkdtempSync(join(tmpdir(), 'legacypet-local-'));
after(() => rmSync(temp, { recursive: true, force: true }));
let n = 0;
const dir = (name = 'x') => {
  const path = join(temp, `${name}-${++n}`);
  mkdirSync(path, { recursive: true });
  return path;
};

// git with fixed people and dates, so the pet's numbers are predictable.
function sh(cwd, args, daysAgo = 0) {
  const date = new Date(NOW.getTime() - daysAgo * DAY).toISOString();
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date, GIT_AUTHOR_NAME: 'Ada', GIT_AUTHOR_EMAIL: 'ada@example.com',
      GIT_COMMITTER_NAME: 'Ada', GIT_COMMITTER_EMAIL: 'ada@example.com', GIT_CONFIG_NOSYSTEM: '1',
    },
  });
}
function makeRepo(name, { commits = [3, 2, 1], remote = null, parent = null, files = { 'README.md': `# ${name}\n` } } = {}) {
  const path = parent ? join(parent, name) : dir(name);
  mkdirSync(path, { recursive: true });
  sh(path, ['init', '-q', '-b', 'main']);
  sh(path, ['config', 'user.name', 'Ada']);
  sh(path, ['config', 'user.email', 'ada@example.com']);
  sh(path, ['config', 'commit.gpgsign', 'false']);
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(join(path, file, '..'), { recursive: true });
    writeFileSync(join(path, file), text);
  }
  sh(path, ['add', '.'], commits[0] ?? 0);
  commits.forEach((daysAgo, i) => {
    writeFileSync(join(path, 'log.txt'), `${i}\n`);
    sh(path, ['add', '.'], daysAgo);
    sh(path, ['commit', '-q', '-m', `change ${i}`], daysAgo);
  });
  if (remote) {
    // A bare repo stands in for GitHub: the remote URL says github.com, git pushes to the folder.
    const bare = dir(`${name}-remote`);
    sh(bare, ['init', '-q', '--bare', '-b', 'main']);
    sh(path, ['remote', 'add', 'origin', `https://github.com/${remote}.git`]);
    sh(path, ['config', `url.${bare}.insteadOf`, `https://github.com/${remote}.git`]);
    sh(path, ['push', '-q', '-u', 'origin', 'main']);
    return { path, bare };
  }
  return { path };
}

test('guessLanguage counts bytes of code and skips vendored files', () => {
  assert.equal(guessLanguage([{ path: 'src/main.rs', size: 900 }, { path: 'build.py', size: 100 }]), 'Rust');
  assert.equal(guessLanguage([{ path: 'node_modules/x/index.js', size: 9e6 }, { path: 'app.py', size: 10 }]), 'Python');
  assert.equal(guessLanguage([{ path: 'README.md', size: 10 }]), null);
});

test('communityHealth scores README, license, conduct, contributing and templates', () => {
  assert.equal(communityHealth([]), 0);
  assert.equal(communityHealth(['README.md', 'LICENSE']), 33);
  assert.equal(communityHealth(['README.md', 'LICENSE', 'CODE_OF_CONDUCT.md', '.github/CONTRIBUTING.md',
    '.github/ISSUE_TEMPLATE/bug.yml', '.github/pull_request_template.md']), 100);
});

test('workflowOptions reads the LegacyPet step\'s inputs, and nothing else', () => {
  const yaml = workflowYaml({ lang: 'vi', species: 'cat', name: 'Bánh "Bao"', wear: 'cap, bird' });
  assert.deepEqual(workflowOptions(yaml), { lang: 'vi', species: 'cat', name: 'Bánh "Bao"', wear: 'cap, bird' });
  assert.deepEqual(workflowOptions(workflowYaml()), {});
  assert.deepEqual(workflowOptions("- uses: Tanx-1811/legacypet@v1\n  with:\n    name: 'It''s Mochi'\n"), { name: "It's Mochi" });
  const other = 'steps:\n  - uses: Tanx-1811/legacypet@v1\n  - uses: actions/other@v1\n    with:\n      species: dragon\n';
  assert.deepEqual(workflowOptions(other), {}, 'with: of another step');
  assert.deepEqual(workflowOptions('      - uses: Tanx-1811/legacypet@v1\n        with:\n          species: ninja # sneaky\n          lang: ja\n'), { species: 'ninja', lang: 'ja' });
});

test('readRepo turns a local repo into the snapshot the engine expects', async () => {
  const { path } = makeRepo('reader', { commits: [40, 10, 3, 1], remote: 'octo/reader', files: { 'README.md': '# r\n', 'LICENSE': 'MIT', 'lib.rs': 'fn main() {}\n'.repeat(50) } });
  sh(path, ['tag', 'v1.0.0'], 1);
  writeFileSync(join(path, 'dirty.txt'), 'wip');
  writeFileSync(join(path, 'log.txt'), 'local only');
  sh(path, ['commit', '-qam', 'not pushed'], 0);
  const info = await readRepo(path, { now: NOW });
  assert.equal(info.fullName, 'octo/reader');
  assert.equal(info.github, true);
  assert.equal(info.branch, 'main');
  assert.equal(info.dirty, 1);
  assert.equal(info.ahead, 1);
  assert.equal(info.behind, 0);
  assert.equal(info.petBranch, false);
  const s = info.snapshot;
  assert.equal(s.commits.total, 5);
  assert.equal(s.commits.recent.length, 5, 'all within 90 days');
  assert.equal(s.commits.recent[0].author, 'Ada');
  assert.equal(s.repo.language, 'Rust');
  assert.equal(s.release.tag, 'v1.0.0');
  assert.equal(s.community.health, 33);
  assert.equal(s.ci.state, 'unknown', 'offline: CI is unknown');
  assert.equal(s.issues, null);
  assert.ok(Date.parse(s.repo.createdAt) <= NOW.getTime() - 39 * DAY);

  const local = makeRepo('loner', { commits: [] });
  const empty = await readRepo(local.path, { now: NOW });
  assert.equal(empty.fullName, `local/${empty.folder}`);
  assert.equal(empty.github, false);
  assert.equal(empty.empty, true);
  assert.equal(empty.snapshot.commits.total, 0);
});

test('findRepos finds repos, but not repos inside repos or in node_modules', async () => {
  const root = dir('code');
  for (const name of ['a', 'b/c', 'node_modules/d', '.hidden/e', 'deep/1/2/3/4/f']) {
    mkdirSync(join(root, name, '.git'), { recursive: true });
  }
  mkdirSync(join(root, 'a', 'vendor', 'inner', '.git'), { recursive: true });
  const found = (await findRepos([root, join(root, 'missing')])).map((p) => p.slice(root.length + 1).replace(/\\/g, '/'));
  assert.deepEqual(found, ['a', 'b/c']);
});

test('suggestFolders offers the current repo first and never peeks into protected macOS folders', () => {
  const home = realpathSync.native(dir('home'));
  mkdirSync(join(home, 'code'), { recursive: true });
  mkdirSync(join(home, 'Documents', 'Projects'), { recursive: true });
  const repo = makeRepo('here').path;
  const mac = suggestFolders({ home, platform: 'darwin', cwd: repo });
  assert.equal(mac[0].path, repo);
  assert.equal(mac[0].current, true);
  assert.ok(mac.some((s) => s.path === join(home, 'code') && s.label === `~${sep}code` && s.exists && s.checked));
  assert.equal(mac.filter((s) => s.path.toLowerCase() === join(home, 'code').toLowerCase()).length, 1, 'Code and code are one folder here');
  assert.ok(!mac.some((s) => s.path === join(home, 'Documents', 'Projects')), 'not even a stat inside Documents');
  assert.equal(mac.find((s) => s.path === join(home, 'Documents', 'GitHub')).exists, null);
  assert.equal(mac.at(-1).path, home);
  assert.equal(mac.at(-1).checked, false);
  const linux = suggestFolders({ home, platform: 'linux' });
  assert.ok(linux.some((s) => s.path === join(home, 'Documents', 'Projects')));
});

test('adoptLocal writes the workflow and the README pet once, and updates them on request', () => {
  const { path } = makeRepo('adopt');
  const first = adoptLocal(path, { fullName: 'me/adopt', options: { species: 'duck' } });
  assert.deepEqual(first.files.map((f) => f.status), ['created', 'updated']);
  assert.match(readFileSync(join(path, '.github/workflows/legacypet.yml'), 'utf8'), /species: duck/);
  assert.match(readFileSync(join(path, 'README.md'), 'utf8'), /raw\.githubusercontent\.com\/me\/adopt\/legacypet\/pet\.svg/);
  const again = adoptLocal(path, { fullName: 'me/adopt', options: { species: 'duck' } });
  assert.deepEqual(again.files.map((f) => f.status), ['exists', 'exists']);
  const forced = adoptLocal(path, { fullName: 'me/adopt', isPrivate: true, options: { species: 'cat' }, force: true });
  assert.deepEqual(forced.files.map((f) => f.status), ['updated', 'updated']);
  assert.match(readFileSync(join(path, 'README.md'), 'utf8'), /github\.com\/me\/adopt\/blob\/legacypet\/pet\.svg\?raw=true/);
  assert.equal(readFileSync(join(path, 'README.md'), 'utf8').match(/legacypet:start/g).length, 1);

  const bare = dir('no-readme');
  const made = adoptLocal(bare, { fullName: 'me/no-readme', repoName: 'no-readme' });
  assert.equal(made.files[1].status, 'created');
  assert.match(readFileSync(join(bare, 'README.md'), 'utf8'), /^# no-readme\n/);
});

test('publishAdoption commits only the pet\'s files and pushes them', async () => {
  const { path, bare } = makeRepo('pub', { remote: 'me/pub' });
  writeFileSync(join(path, 'other.txt'), 'staged but not ours');
  sh(path, ['add', 'other.txt']);
  const { files } = adoptLocal(path, { fullName: 'me/pub' });
  const result = await publishAdoption(path, files.map((f) => f.path));
  assert.deepEqual(result, { committed: true, pushed: true, error: null, hint: null });
  const shown = sh(bare, ['show', '--stat', '--format=%s', 'main']);
  assert.match(shown, /^Adopt a LegacyPet 🐾/);
  assert.match(shown, /legacypet\.yml/);
  assert.doesNotMatch(shown, /other\.txt/);
  assert.match(sh(path, ['status', '--porcelain']), /^A {2}other\.txt/m, 'still staged, untouched');

  const lonely = makeRepo('lonely');
  const failed = await publishAdoption(lonely.path, adoptLocal(lonely.path, { fullName: 'me/lonely' }).files.map((f) => f.path));
  assert.equal(failed.committed, true);
  assert.equal(failed.pushed, false);
  assert.equal(failed.hint, 'no-remote');
});

test('gitHint explains the usual push failures', () => {
  assert.equal(gitHint('refusing to allow an OAuth App to create or update workflow `.github/workflows/legacypet.yml` without `workflow` scope'), 'workflow-scope');
  assert.equal(gitHint('fatal: could not read Username for \'https://github.com\': terminal prompts disabled'), 'auth');
  assert.equal(gitHint(' ! [rejected]        main -> main (fetch first)'), 'behind');
  assert.equal(gitHint('Please tell me who you are.'), 'identity');
  assert.equal(gitHint('error: Your local changes to the following files would be overwritten by merge'), 'dirty');
  assert.equal(gitHint('fatal: Not possible to fast-forward, aborting.'), 'diverged');
  assert.equal(gitHint('There is no tracking information for the current branch.'), 'no-upstream');
  assert.equal(gitHint('something else'), null);
});

const fakeGitHub = async () => new Response('{"message":"Not Found"}', { status: 404 });

test('projects: allow, scan, raise, care, adopt, hide and forget', async () => {
  const root = dir('workspace');
  const busy = makeRepo('busy', { commits: [6, 5, 4, 3, 2, 1, 0.5], remote: 'me/busy', parent: root });
  makeRepo('old', { commits: [420, 410, 400, 390, 380, 300], parent: root });
  const store = createStore(dir('data'));
  let clock = NOW;
  const projects = createProjects({ store, now: () => clock, fetch: fakeGitHub });
  const events = [];
  projects.on((type, payload) => { if (type === 'event') events.push(payload); });

  assert.equal(projects.config.consented, false);
  assert.deepEqual(await projects.scan(), [], 'nothing before someone allows it');
  const list = await projects.allow([root]);
  assert.equal(projects.config.consented, true);
  assert.equal(list.length, 2);
  const b = list.find((p) => p.fullName === 'me/busy');
  assert.equal(b.status, 'none');
  assert.equal(b.path, busy.path);
  const o = list.find((p) => p.github === false);
  assert.equal(b.summary.attention, 'good');
  assert.equal(o.summary.mood, 'zombie');
  assert.equal(o.summary.attention, 'bad');
  assert.equal(o.status, 'local');
  assert.ok(existsSync(join(store.dir, 'pets', `${b.id}.json`)), 'the pet remembers');
  assert.equal(events.length, 0, 'no flood of notifications on the first scan');

  const fed = await projects.care(b.id, 'feed');
  assert.equal(fed.summary.careOutcome, 'ok');
  assert.equal((await projects.care(b.id, 'feed')).summary.careOutcome, 'again');
  assert.equal((await projects.care(o.id, 'play')).summary.careOutcome, 'cant', 'zombies can\'t play');

  // Days pass without commits: the busy pet gets hungry and says so.
  clock = new Date(NOW.getTime() + 30 * DAY);
  await projects.refresh();
  assert.ok(events.some((e) => e.kind === 'mood' && e.projectId === b.id), JSON.stringify(events));
  assert.ok(events.every((e) => !/undefined/.test(e.text)), JSON.stringify(events));

  const adopted = await projects.adopt(b.id, { publish: true, options: { name: 'Mochi' } });
  assert.equal(adopted.publish.pushed, true);
  assert.equal(adopted.isPrivate, true, 'GitHub says 404: treated as private');
  assert.equal(adopted.project.status, 'live');
  assert.equal(adopted.project.options.name, 'Mochi');
  assert.equal(adopted.project.summary.name, 'Mochi');
  await assert.rejects(projects.adopt(o.id), /not on GitHub/);

  projects.updateConfig({ hidden: [o.id] });
  assert.deepEqual(projects.list().map((p) => p.id), [b.id]);
  assert.deepEqual(projects.hiddenList(), [{ id: o.id, name: o.fullName }]);

  const reopened = createProjects({ store, now: () => clock, fetch: fakeGitHub });
  assert.equal(reopened.list().length, 1, 'the cache brings the pets back at once');
  reopened.reset();
  assert.equal(reopened.config.consented, false);
  assert.equal(existsSync(join(store.dir, 'pets')), false);
  assert.equal(projectId(b.path), b.id);
});

// ----- The local server ------------------------------------------------------------
function call(port, path, { method = 'GET', host = `127.0.0.1:${port}`, token, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method, headers: { host, ...(token ? { 'x-legacypet-token': token } : {}), ...(body ? { 'content-type': 'application/json' } : {}) } }, (res) => {
      let text = '';
      res.on('data', (c) => { text += c; });
      res.on('end', () => resolve({ status: res.statusCode, text, json: () => JSON.parse(text) }));
    });
    req.on('error', reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
}

test('server: only its own pages can use the API, only through its own address', async () => {
  const projects = createProjects({ store: createStore(dir('server-data')), fetch: fakeGitHub });
  const app = await startServer({ port: 0, projects, autoRefresh: false });
  try {
    const { port, secret } = app;
    assert.deepEqual((await call(port, '/api/ping')).json(), { app: 'legacypet', version: (await import('../src/whatsnew.js')).VERSION });
    assert.equal((await call(port, '/api/state')).status, 403, 'no secret');
    assert.equal((await call(port, '/api/state', { token: 'nope' })).status, 403);
    assert.equal((await call(port, '/api/state', { token: secret, host: 'evil.example' })).status, 421, 'DNS rebinding');
    assert.equal((await call(port, '/', { host: `attacker.test:${port}` })).status, 421);
    assert.equal((await call(port, '/api/stream?token=nope')).status, 403);

    const page = await call(port, '/');
    assert.equal(page.status, 200);
    assert.ok(page.text.includes(`<meta name="legacypet-token" content="${secret}">`), 'the page knows the secret');
    assert.notEqual((await call(port, '/src/../../package.json')).status, 200);
    assert.notEqual((await call(port, '/%2e%2e/%2e%2e/package.json')).status, 200);
    assert.equal((await call(port, '/src/..%2f..%2fpackage.json')).status, 403);
    assert.equal((await call(port, '/src/index.js')).status, 200);

    const state = (await call(port, '/api/state', { token: secret })).json();
    assert.equal(state.mode, 'browser');
    assert.equal(state.config.consented, false);
    assert.equal(state.config.token, undefined, 'never sends a token back');
    assert.ok(Array.isArray(state.suggestions));

    const patched = (await call(port, '/api/config', { method: 'POST', token: secret, body: { notify: false, consented: true, evil: 1 } })).json();
    assert.equal(patched.config.notify, false);
    assert.equal(patched.config.consented, false, 'consent only comes from /api/allow');
    assert.equal(patched.config.evil, undefined);
    assert.equal((await call(port, '/api/projects/000000000000/care', { method: 'POST', token: secret, body: { name: 'feed' } })).status, 404);
    assert.equal((await call(port, '/api/allow', { method: 'POST', token: secret, body: { roots: 'nope' } })).status, 400);
  } finally {
    await app.close();
  }
});

// ----- The app's pages and the desktop package ------------------------------------
test('the app speaks Vietnamese and English with the same keys', async () => {
  const { UI } = await import('../site/ui.js');
  const shape = (value) => (value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]))
    : Array.isArray(value) ? `array:${value.length}` : typeof value);
  assert.deepEqual(shape(UI.vi), shape(UI.en));
});

test('the desktop app ships the same version as the action and CLI', () => {
  const root = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const desktop = JSON.parse(readFileSync(new URL('../desktop/package.json', import.meta.url), 'utf8'));
  assert.equal(desktop.version, root.version);
  assert.deepEqual(Object.keys(root.dependencies ?? {}), [], 'the action and CLI stay dependency-free');
  for (const name of ['LegacyPet-mac-${arch}.${ext}', 'LegacyPet-win-x64.${ext}', 'LegacyPet-linux-x86_64.${ext}', 'LegacyPet-linux-amd64.${ext}']) {
    assert.ok(JSON.stringify(desktop.build).includes(name), `${name}: the download page links to it`);
  }
});

test('dailyCounts groups commits by the committer\'s own day', () => {
  assert.deepEqual(dailyCounts(['2026-10-08T23:30:00+07:00', '2026-10-08T01:00:00+07:00', '2026-10-07T10:00:00Z', 'nope']), { '2026-10-08': 2, '2026-10-07': 1 });
});

test('readRepo keeps a year of activity and the latest commits', async () => {
  const { path } = makeRepo('active', { commits: [200, 30, 2, 1] });
  const info = await readRepo(path, { now: NOW });
  assert.equal(Object.values(info.activity).reduce((a, b) => a + b, 0), 4);
  assert.equal(info.log.length, 4);
  assert.equal(info.log[0].subject, 'change 3');
  assert.match(info.log[0].sha, /^[0-9a-f]{7,}$/);
});

test('an evening nudge keeps a streak alive, once a day', async () => {
  const root = dir('streaks');
  // Commits on the three days before "today" (local time), none today.
  const evening = new Date(2026, 9, 8, STREAK_REMINDER_HOUR + 1, 0, 0);
  const daysAgo = (n) => (NOW.getTime() - new Date(2026, 9, 8 - n, 12).getTime()) / DAY;
  makeRepo('streaky', { commits: [daysAgo(4), daysAgo(3), daysAgo(2), daysAgo(1)], parent: root });
  const store = createStore(dir('streak-data'));
  let clock = new Date(2026, 9, 8, 9);
  const projects = createProjects({ store, now: () => clock, fetch: fakeGitHub });
  const events = [];
  projects.on((type, e) => { if (type === 'event') events.push(e); });
  const [p] = await projects.allow([root]);
  assert.ok(p.summary.streak >= 3, `streak ${p.summary.streak}`);
  assert.equal(p.summary.committedToday, false);
  assert.ok(p.activity[localDay(new Date(2026, 9, 7, 12))], 'yesterday counted');
  await projects.refresh();
  assert.equal(events.filter((e) => e.kind === 'streak').length, 0, 'not in the morning');
  clock = evening;
  await projects.refresh();
  await projects.refresh();
  const nudges = events.filter((e) => e.kind === 'streak');
  assert.equal(nudges.length, 1, 'once a day');
  assert.match(nudges[0].text, /streak/);
});

test('detectTools only offers what is installed, and never through a shell on Windows', () => {
  const none = publicTools(detectTools({ platform: 'linux', env: { PATH: '' } }));
  assert.deepEqual(none, { editors: [], terminals: [] });
  const bin = dir('bin');
  writeFileSync(join(bin, 'code'), '');
  const linux = publicTools(detectTools({ platform: 'linux', env: { PATH: bin } }));
  assert.deepEqual(linux.editors, [{ id: 'vscode', name: 'Visual Studio Code' }]);
  const win = detectTools({ platform: 'win32', env: { PATH: '', LOCALAPPDATA: dir('appdata') } });
  assert.deepEqual(win.editors, []);
  assert.equal(win.terminals.at(-1).id, 'cmd');
  assert.deepEqual(win.terminals.at(-1).args('C:\\a & b'), ['/c', 'start', 'cmd.exe'], 'the path is never part of a command line');
});

test('server: pins and tools in the state, and opening needs a real project', async () => {
  const projects = createProjects({ store: createStore(dir('server-tools')), fetch: fakeGitHub });
  const app = await startServer({ port: 0, projects, autoRefresh: false });
  try {
    const { port, secret } = app;
    const state = (await call(port, '/api/state', { token: secret })).json();
    assert.ok(Array.isArray(state.tools.editors) && Array.isArray(state.tools.terminals));
    const pinned = (await call(port, '/api/config', { method: 'POST', token: secret, body: { pinned: ['abcdefabcdef'], editor: 'vscode' } })).json();
    assert.deepEqual(pinned.config.pinned, ['abcdefabcdef']);
    assert.equal(pinned.config.editor, 'vscode');
    assert.equal((await call(port, '/api/projects/abcdefabcdef/open', { method: 'POST', token: secret, body: { with: 'editor' } })).status, 404);
  } finally {
    await app.close();
  }
});

// ----- Settings, care for all, sync, backup ------------------------------------------
test('notification rules: muted groups, quiet hours across midnight', () => {
  assert.equal(inQuietHours(null, new Date(2026, 9, 8, 23)), false);
  assert.equal(inQuietHours({ from: 22, to: 8 }, new Date(2026, 9, 8, 23)), true);
  assert.equal(inQuietHours({ from: 22, to: 8 }, new Date(2026, 9, 8, 7)), true);
  assert.equal(inQuietHours({ from: 22, to: 8 }, new Date(2026, 9, 8, 8)), false);
  assert.equal(inQuietHours({ from: 0, to: 8 }, new Date(2026, 9, 8, 12)), false);
  assert.equal(inQuietHours({ from: 5, to: 5 }, new Date(2026, 9, 8, 5)), false, 'an empty range is off');
  const noon = new Date(2026, 9, 8, 12);
  assert.deepEqual(notifyRules({ notify: true, mute: [] }, 'levelUp', noon), { muted: false, notify: true });
  assert.deepEqual(notifyRules({ notify: true, mute: ['growth'] }, 'levelUp', noon), { muted: true, notify: false });
  assert.deepEqual(notifyRules({ notify: true, mute: [], quietHours: { from: 10, to: 14 } }, 'trophy', noon), { muted: false, notify: false });
  assert.deepEqual(notifyRules({ notify: false, mute: [] }, 'trophy', noon), { muted: false, notify: false });
});

test('cleanConfigPatch keeps settings in shape and cleanOptions drops typos', () => {
  const clean = cleanConfigPatch({
    mute: ['streak', 'nope', 'streak'], reminderHour: 25, quietHours: { from: 22, to: 'x' }, floatSize: 'huge', floatBubbles: 0,
    refreshMinutes: 0, notes: { abcdefabcdef: 'x'.repeat(5000), '../etc': 'no' }, options: { abcdefabcdef: { color: 'teal', evil: { a: 1 } } },
    hidden: ['abcdefabcdef', 'nope'], favorite: 'nope', editor: 'vscode',
  });
  assert.deepEqual(clean.mute, ['streak']);
  assert.equal('reminderHour' in clean, false);
  assert.equal('quietHours' in clean, false);
  assert.equal('floatSize' in clean, false);
  assert.equal(clean.floatBubbles, false);
  assert.equal('refreshMinutes' in clean, false);
  assert.deepEqual(Object.keys(clean.notes), ['abcdefabcdef']);
  assert.equal(clean.notes.abcdefabcdef.length, 4000);
  assert.deepEqual(clean.options, { abcdefabcdef: { color: 'teal' } });
  assert.deepEqual(clean.hidden, ['abcdefabcdef']);
  assert.equal(clean.favorite, null);
  assert.equal(clean.editor, 'vscode', 'other keys pass through');
  assert.deepEqual(cleanConfigPatch({ reminderHour: null, quietHours: null }), { reminderHour: null, quietHours: null });
  assert.deepEqual(cleanOptions({ species: 'unicorn', scenery: 'moon', color: 'blurple', theme: 'neon', name: 'Mo' }), { name: 'Mo' });
  assert.deepEqual(cleanOptions({ species: 'cat', color: '#ff8800', theme: 'dark' }), { species: 'cat', color: '#ff8800', theme: 'dark' });
});

test('projects: care for all, notes, a muted streak, fetch and pull', async () => {
  const root = dir('tools');
  const a = makeRepo('alpha', { commits: [6, 5, 4, 3, 2, 1], remote: 'me/alpha', parent: root });
  makeRepo('beta', { commits: [6, 5, 4, 3, 2, 1], parent: root });
  const store = createStore(dir('tools-data'));
  const projects = createProjects({ store, now: () => NOW, fetch: fakeGitHub });
  const list = await projects.allow([root]);
  assert.equal(list.length, 2);

  assert.deepEqual(await projects.careAll('feed'), { ok: 2, again: 0, cant: 0 });
  assert.deepEqual(await projects.careAll('feed'), { ok: 0, again: 2, cant: 0 }, 'once a day');

  const alpha = list.find((p) => p.fullName === 'me/alpha');
  projects.updateConfig({ notes: { [alpha.id]: 'ship v2' } });
  projects.updateConfig({ notes: { other123456: 'kept' } });
  assert.equal(projects.config.notes[alpha.id], 'ship v2', 'notes merge per project');
  projects.updateConfig({ notes: { [alpha.id]: '' } });
  assert.equal(alpha.id in projects.config.notes, false, 'an empty note is forgotten');

  // Someone else pushes to GitHub: fetch sees it, pull brings it in.
  const other = dir('alpha-clone');
  sh(other, ['clone', '-q', a.bare, '.']);
  sh(other, ['config', 'user.name', 'Bo']);
  sh(other, ['config', 'user.email', 'bo@example.com']);
  writeFileSync(join(other, 'new.txt'), 'hi\n');
  sh(other, ['add', '.']);
  sh(other, ['commit', '-q', '-m', 'from elsewhere']);
  sh(other, ['push', '-q', 'origin', 'main']);
  const fetched = await projects.sync(alpha.id, 'fetch');
  assert.equal(fetched.ok, true, fetched.error);
  assert.equal(fetched.project.behind, 1);
  const pulled = await projects.sync(alpha.id, 'pull');
  assert.equal(pulled.ok, true, pulled.error);
  assert.equal(pulled.project.behind, 0);
  assert.ok(existsSync(join(a.path, 'new.txt')));
  const beta = list.find((p) => !p.github);
  await assert.rejects(projects.sync(beta.id, 'fetch'), /no remote/);
});

test('projects: a backup moves settings and memories to another computer', async () => {
  const mine = dir('backup-a');
  const original = makeRepo('gamma', { commits: [4, 3, 2, 1], remote: 'me/gamma', parent: mine });
  const before = createProjects({ store: createStore(dir('backup-a-data')), now: () => NOW, fetch: fakeGitHub });
  const [g] = await before.allow([mine]);
  await before.care(g.id, 'pat');
  before.updateConfig({
    token: 'secret', notes: { [g.id]: 'remember me' }, options: { [g.id]: { color: 'pink', name: 'Mochi' } }, pinned: [g.id],
    mute: ['streak'], quietHours: { from: 22, to: 8 }, floatSize: 'large',
  });
  const data = JSON.parse(JSON.stringify(before.backup()));
  assert.equal(data.app, 'legacypet');
  assert.equal(data.settings.token, undefined, 'never the token');
  assert.ok(data.pets[g.id].care, 'the pet remembers its pats');

  // The same repo cloned somewhere else: another path, another id.
  const theirs = dir('backup-b');
  sh(theirs, ['clone', '-q', original.bare, 'gamma']);
  sh(join(theirs, 'gamma'), ['remote', 'set-url', 'origin', 'https://github.com/me/gamma.git']);
  const after = createProjects({ store: createStore(dir('backup-b-data')), now: () => NOW, fetch: fakeGitHub });
  const [h] = await after.allow([theirs]);
  assert.notEqual(h.id, g.id);
  await assert.rejects(after.restore({ hello: 'world' }), /not a LegacyPet backup/);
  const res = await after.restore(data);
  assert.equal(res.pets, 1);
  assert.equal(after.config.notes[h.id], 'remember me');
  assert.deepEqual(after.config.pinned, [h.id]);
  assert.deepEqual(after.config.mute, ['streak']);
  assert.deepEqual(after.config.quietHours, { from: 22, to: 8 });
  assert.equal(after.config.floatSize, 'large');
  assert.equal(after.config.token, '');
  const restored = after.get(h.id);
  assert.equal(restored.summary.name, 'Mochi');
  assert.equal(restored.options.color, 'pink');
  assert.ok(after.store.loadMemory(h.id).care, 'the memory found its repo');
});

test('a muted streak and a later reminder hour hold the evening nudge', async () => {
  const root = dir('quiet-streaks');
  const daysAgo = (n) => (NOW.getTime() - new Date(2026, 9, 8 - n, 12).getTime()) / DAY;
  makeRepo('streaky', { commits: [daysAgo(4), daysAgo(3), daysAgo(2), daysAgo(1)], parent: root });
  let clock = new Date(2026, 9, 8, 19);
  const projects = createProjects({ store: createStore(dir('quiet-data')), now: () => clock, fetch: fakeGitHub });
  const events = [];
  projects.on((type, e) => { if (type === 'event') events.push(e); });
  await projects.allow([root]);
  projects.updateConfig({ reminderHour: 21 });
  await projects.refresh();
  assert.equal(events.filter((e) => e.kind === 'streak').length, 0, 'not before 21:00');
  projects.updateConfig({ mute: ['streak'] });
  clock = new Date(2026, 9, 8, 22);
  await projects.refresh();
  assert.equal(events.filter((e) => e.kind === 'streak').length, 0, 'muted');
  projects.updateConfig({ mute: [], quietHours: { from: 22, to: 8 } });
  await projects.refresh();
  const [nudge] = events.filter((e) => e.kind === 'streak');
  assert.ok(nudge, 'the nudge comes');
  assert.equal(nudge.muted, false);
  assert.equal(nudge.notify, false, 'but quietly, during quiet hours');
});

test('server: care for all, git, backup and restore', async () => {
  const root = dir('server-routes');
  makeRepo('delta', { commits: [6, 5, 4, 3, 2, 1], parent: root });
  const projects = createProjects({ store: createStore(dir('server-routes-data')), now: () => NOW, fetch: fakeGitHub });
  await projects.allow([root]);
  const app = await startServer({ port: 0, projects, autoRefresh: false });
  try {
    const { port, secret } = app;
    const post = (path, body) => call(port, path, { method: 'POST', token: secret, body });
    assert.equal((await post('/api/care-all', { name: 'dance' })).status, 400);
    const cared = (await post('/api/care-all', { name: 'play' })).json();
    assert.equal(cared.ok, 1);
    assert.ok(cared.state.projects.length);
    const [p] = cared.state.projects;
    assert.equal((await post(`/api/projects/${p.id}/git`, { action: 'push' })).status, 400);
    assert.equal((await post(`/api/projects/${p.id}/git`, { action: 'fetch' })).status, 400, 'no remote');
    const config = (await post('/api/config', { floatSize: 'small', quietHours: { from: 23, to: 7 }, notes: { [p.id]: 'hello' } })).json().config;
    assert.equal(config.floatSize, 'small');
    assert.deepEqual(config.quietHours, { from: 23, to: 7 });
    assert.equal(config.notes[p.id], 'hello');
    assert.equal((await call(port, '/api/backup')).status, 403, 'a backup needs the secret');
    const backup = (await call(port, '/api/backup', { token: secret })).json();
    assert.equal(backup.kind, 'backup');
    assert.equal((await post('/api/restore', { app: 'other' })).status, 400);
    const restored = (await post('/api/restore', backup)).json();
    assert.equal(restored.pets, 1);
    assert.equal(restored.state.config.notes[p.id], 'hello');
  } finally {
    await app.close();
  }
});

test('one broken repo never stops the other pets from updating', async () => {
  const root = dir('broken');
  const typo = makeRepo('typo', { commits: [6, 5, 4, 3, 2, 1], parent: root });
  mkdirSync(join(typo.path, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(typo.path, '.github', 'workflows', 'legacypet.yml'), workflowYaml({ species: 'unicorn', vacation: 'soon', color: 'blurple', name: 'Mo' }));
  const fine = makeRepo('fine', { commits: [6, 5, 4, 3, 2, 1], parent: root });
  const store = createStore(dir('broken-data'));
  let clock = NOW;
  const projects = createProjects({ store, now: () => clock, fetch: fakeGitHub });
  const list = await projects.allow([root]);
  assert.equal(list.length, 2);
  const t = list.find((p) => p.path === typo.path);
  assert.ok(t.summary, 'typos in the workflow are skipped, not fatal');
  assert.deepEqual(t.options, { name: 'Mo' });

  // A memory file that went bad: the pet starts over, the old file is kept, the other pet carries on.
  const events = [];
  projects.on((type, e) => { if (type === 'event') events.push(e); });
  const bad = JSON.stringify({ history: 7, achievements: 'x', quests: 5 });
  writeFileSync(join(store.dir, 'pets', `${t.id}.json`), bad);
  clock = new Date(NOW.getTime() + DAY);
  const after = await projects.refresh();
  const f = after.find((p) => p.path === fine.path);
  assert.equal(f.now, clock.toISOString(), 'the healthy pet was raised');
  const healed = after.find((p) => p.path === typo.path);
  assert.ok(healed.summary, 'it starts over instead of staying broken');
  assert.ok(Array.isArray(store.loadMemory(t.id).history), 'a fresh memory');
  assert.equal(readFileSync(join(store.dir, 'pets', `${t.id}.broken-${clock.getTime()}.json`), 'utf8'), bad, 'the old file is kept');
  assert.deepEqual(events.map((e) => e.kind), ['memory']);

  // Anything else going wrong for one pet shows on that pet only; the others still update.
  const unreadable = { ...store, loadMemory: (id) => { if (id === t.id) throw new Error('disk on fire'); return store.loadMemory(id); } };
  const shaky = createProjects({ store: unreadable, now: () => clock, fetch: fakeGitHub });
  clock = new Date(NOW.getTime() + 2 * DAY);
  const listed = await shaky.refresh();
  assert.equal(listed.find((p) => p.path === typo.path).error, 'disk on fire');
  assert.equal(listed.find((p) => p.path === fine.path).now, clock.toISOString());
});

test('a refresh of one pet does not let two full refreshes run at once', async () => {
  const root = dir('overlap');
  for (const name of ['a', 'b', 'c']) makeRepo(name, { commits: [6, 5, 4, 3, 2, 1], parent: root });
  const base = createStore(dir('overlap-data'));
  let saves = 0;
  const store = { ...base, saveMemory: (id, state) => { saves += 1; base.saveMemory(id, state); } };
  const projects = createProjects({ store, now: () => NOW, fetch: fakeGitHub });
  const [one] = await projects.allow([root]);
  saves = 0;
  const full = projects.refresh();
  const partial = projects.refresh([one.id]);
  const again = projects.refresh();
  await Promise.all([full, partial, again]);
  assert.equal(saves, 4, `3 pets once, plus the one asked for (got ${saves})`);
});
