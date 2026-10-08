import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient, lastPageFromLink } from '../src/github/client.js';
import { collectSnapshot } from '../src/github/collect.js';
import { loadPrevious, publishFiles } from '../src/github/publish.js';

const NOW = new Date('2026-10-08T09:00:00Z');
const daysAgo = (d) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

// A fake GitHub: routes are "METHOD /path" → (url, body) => [status, json, headers?]
function fakeGitHub(routes) {
  const calls = [];
  const fetch = async (url, init) => {
    const key = `${init.method} ${url.pathname}`;
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ key, url, body, headers: init.headers });
    const handler = routes[key];
    const [status, json, headers = {}] = handler ? handler(url, body) : [404, { message: 'Not Found' }];
    return new Response(json === undefined ? '' : JSON.stringify(json), { status, headers });
  };
  return { client: createClient({ token: 't0ken', fetch }), calls };
}

const REPO = {
  name: 'demo', full_name: 'octo/demo', owner: { login: 'octo' }, default_branch: 'main', archived: false,
  private: false, stargazers_count: 120, forks_count: 7, language: 'Rust', created_at: daysAgo(500), pushed_at: daysAgo(1),
};

const commit = (sha, days, login = 'alice') => ({ sha, author: { login, type: 'User' }, commit: { committer: { date: daysAgo(days) }, author: { date: daysAgo(days) } } });

test('lastPageFromLink reads the last page number', () => {
  assert.equal(lastPageFromLink('<https://api.github.com/x?per_page=1&page=2>; rel="next", <https://api.github.com/x?per_page=1&page=873>; rel="last"'), 873);
  assert.equal(lastPageFromLink(null), null);
});

test('collectSnapshot normalizes a healthy repo', async () => {
  const { client, calls } = fakeGitHub({
    'GET /repos/octo/demo': () => [200, REPO],
    'GET /repos/octo/demo/commits': (url) => url.searchParams.get('per_page') === '1'
      ? [200, [commit('head', 1)], { link: '<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=420>; rel="last"' }]
      : [200, [commit('head', 1), commit('c2', 2, 'bob'), commit('c3', 3)]],
    'GET /repos/octo/demo/commits/head/check-runs': () => [200, {
      check_runs: [
        { name: 'test', status: 'completed', conclusion: 'failure' },
        { name: 'lint', status: 'completed', conclusion: 'success' },
        { name: 'legacypet', status: 'in_progress', conclusion: null },
      ],
    }],
    'GET /repos/octo/demo/commits/head/status': () => [200, { statuses: [] }],
    'GET /repos/octo/demo/issues': () => [200, [
      { number: 5, comments: 0, author_association: 'NONE', user: { login: 'x' }, created_at: daysAgo(40), updated_at: daysAgo(40) },
      { number: 6, comments: 0, author_association: 'OWNER', user: { login: 'octo' }, created_at: daysAgo(40), updated_at: daysAgo(40) },
      { number: 7, pull_request: {}, created_at: daysAgo(2), updated_at: daysAgo(2) },
    ]],
    'GET /repos/octo/demo/releases/latest': () => [200, { tag_name: 'v1.2.0', name: 'v1.2.0', published_at: daysAgo(10) }],
    'GET /repos/octo/demo/community/profile': () => [200, { health_percentage: 85 }],
    'GET /repos/octo/demo/contributors': () => [200, [{}], { link: '<https://api.github.com/x?page=12>; rel="last"' }],
    'GET /repos/octo/demo/pulls': () => [200, [
      { number: 9, title: 'Fix', merged_at: daysAgo(1), user: { login: 'carol', type: 'User' }, author_association: 'CONTRIBUTOR' },
      { number: 8, title: 'Bump', merged_at: daysAgo(1), user: { login: 'dependabot[bot]', type: 'Bot' }, author_association: 'NONE' },
    ]],
  });

  const s = await collectSnapshot(client, { owner: 'octo', repo: 'demo', now: NOW });
  assert.deepEqual(s.warnings, []);
  assert.equal(s.repo.fullName, 'octo/demo');
  assert.equal(s.commits.total, 420);
  assert.equal(s.commits.recent.length, 3);
  assert.deepEqual(s.ci, { state: 'failing', total: 2, failing: 1, failingNames: ['test'], sha: 'head' });
  assert.equal(s.issues.open, 2);
  assert.equal(s.issues.openPRs, 1);
  assert.deepEqual(s.issues.unanswered, [{ number: 5, days: 40 }]); // the owner's own issue doesn't count
  assert.equal(s.release.tag, 'v1.2.0');
  assert.equal(s.community.health, 85);
  assert.equal(s.contributors.total, 12);
  assert.deepEqual(s.treats.map((t) => t.user), ['carol']); // bots don't give treats
  assert.equal(calls[0].headers.authorization, 'Bearer t0ken');
});

test('collectSnapshot degrades gracefully when optional data is forbidden', async () => {
  const { client } = fakeGitHub({
    'GET /repos/octo/demo': () => [200, REPO],
    'GET /repos/octo/demo/commits': () => [409, { message: 'Git Repository is empty.' }],
    'GET /repos/octo/demo/issues': () => [403, { message: 'Resource not accessible by integration' }],
  });
  const s = await collectSnapshot(client, { owner: 'octo', repo: 'demo', now: NOW });
  assert.equal(s.commits.total, 0);
  assert.equal(s.issues, null);
  assert.equal(s.release, null);
  assert.equal(s.ci.state, 'unknown');
  assert.ok(s.warnings.some((w) => w.includes('issues')));
});

test('collectSnapshot fails loudly when the repo itself is missing', async () => {
  const { client } = fakeGitHub({});
  await assert.rejects(collectSnapshot(client, { owner: 'octo', repo: 'nope', now: NOW }), /404/);
});

test('publishFiles creates the branch on the first run', async () => {
  const { client, calls } = fakeGitHub({
    'POST /repos/octo/demo/git/trees': () => [201, { sha: 'tree1' }],
    'POST /repos/octo/demo/git/commits': (_, body) => [201, { sha: 'commit1', parents: body.parents }],
    'POST /repos/octo/demo/git/refs': () => [201, {}],
  });
  const result = await publishFiles(client, { owner: 'octo', repo: 'demo', branch: 'legacypet', message: 'hi', files: [{ path: 'pet.svg', content: '<svg/>' }] });
  assert.deepEqual(result, { changed: true, created: true, sha: 'commit1' });
  const tree = calls.find((c) => c.key.endsWith('/git/trees')).body.tree;
  assert.deepEqual(tree, [{ path: 'pet.svg', mode: '100644', type: 'blob', content: '<svg/>' }]);
  assert.deepEqual(calls.find((c) => c.key.endsWith('/git/commits')).body.parents, []);
  assert.equal(calls.at(-1).body.ref, 'refs/heads/legacypet');
});

test('publishFiles force-updates the branch, or skips when nothing changed', async () => {
  const routes = (treeSha) => ({
    'GET /repos/octo/demo/git/ref/heads/legacypet': () => [200, { object: { sha: 'old' } }],
    'GET /repos/octo/demo/git/commits/old': () => [200, { tree: { sha: 'same-tree' } }],
    'POST /repos/octo/demo/git/trees': () => [201, { sha: treeSha }],
    'POST /repos/octo/demo/git/commits': () => [201, { sha: 'new' }],
    'PATCH /repos/octo/demo/git/refs/heads/legacypet': () => [200, {}],
  });
  const files = [{ path: 'pet.svg', content: '<svg/>' }];

  const unchanged = fakeGitHub(routes('same-tree'));
  assert.deepEqual(await publishFiles(unchanged.client, { owner: 'octo', repo: 'demo', branch: 'legacypet', files, message: 'm' }), { changed: false, sha: 'old' });

  const changed = fakeGitHub(routes('new-tree'));
  const result = await publishFiles(changed.client, { owner: 'octo', repo: 'demo', branch: 'legacypet', files, message: 'm' });
  assert.equal(result.changed, true);
  assert.deepEqual(changed.calls.at(-1).body, { sha: 'new', force: true });
});

test('loadPrevious reads memory and diary, tolerating a missing branch', async () => {
  const encode = (s) => Buffer.from(s).toString('base64');
  const { client } = fakeGitHub({
    'GET /repos/octo/demo/contents/pet.json': () => [200, { content: encode('{"lastMood":"zombie"}'), encoding: 'base64' }],
    'GET /repos/octo/demo/contents/DIARY.md': () => [200, { content: encode('# Diary'), encoding: 'base64' }],
  });
  assert.deepEqual(await loadPrevious(client, { owner: 'octo', repo: 'demo', branch: 'legacypet' }), { state: { lastMood: 'zombie' }, diary: '# Diary' });

  const empty = fakeGitHub({});
  assert.deepEqual(await loadPrevious(empty.client, { owner: 'octo', repo: 'demo', branch: 'legacypet' }), { state: null, diary: null });
  await assert.rejects(loadPrevious(empty.client, { owner: 'octo', repo: 'demo', branch: '../main' }), /Invalid branch/);
});
