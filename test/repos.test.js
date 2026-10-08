import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '../src/github/client.js';
import { snippetFor } from '../src/setup.js';
import { adoptRepo, hasPet, listRepos, parseSelection, WORKFLOW_PATH } from '../src/github/repos.js';

// A fake GitHub: routes are "METHOD /path" → (url, body) => [status, json]
function fakeGitHub(routes) {
  const calls = [];
  const fetch = async (url, init) => {
    const key = `${init.method} ${url.pathname}`;
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ key, url, body });
    const handler = routes[key];
    const [status, json] = handler ? handler(url, body) : [404, { message: 'Not Found' }];
    return new Response(json === undefined ? '' : JSON.stringify(json), { status });
  };
  return { client: createClient({ token: 't0ken', fetch }), calls };
}

const raw = (name, extra = {}) => ({
  name, full_name: `me/${name}`, owner: { login: 'me' }, private: false, fork: false, archived: false,
  stargazers_count: 3, language: 'Go', pushed_at: '2026-10-01T00:00:00Z', default_branch: 'main', ...extra,
});
const b64 = (s) => Buffer.from(s).toString('base64');
const unb64 = (s) => Buffer.from(s, 'base64').toString('utf8');

test('listRepos: your repos (private too) or an owner\'s, falling back to orgs', async () => {
  const { client, calls } = fakeGitHub({
    'GET /user/repos': () => [200, [raw('old', { pushed_at: '2025-01-01T00:00:00Z' }), raw('secret', { private: true, permissions: { push: true } })]],
    'GET /orgs/acme/repos': () => [200, [raw('site')]],
  });
  const mine = await listRepos(client);
  assert.deepEqual(mine.map((r) => r.name), ['secret', 'old']);
  assert.equal(mine[0].isPrivate, true);
  assert.equal(mine[0].canPush, true);
  assert.equal(mine[1].canPush, null);
  assert.equal(calls[0].url.searchParams.get('sort'), 'pushed');

  const org = await listRepos(client, { owner: 'acme' });
  assert.deepEqual(org.map((r) => r.fullName), ['me/site']);
  assert.ok(calls.some((c) => c.key === 'GET /users/acme/repos'));
});

test('hasPet looks for the legacypet branch', async () => {
  const { client } = fakeGitHub({ 'GET /repos/me/app/branches/legacypet': () => [200, { name: 'legacypet' }] });
  assert.equal(await hasPet(client, 'me/app'), true);
  assert.equal(await hasPet(client, 'me/other'), false);
});

test('parseSelection understands numbers, ranges, all and names', () => {
  const repos = ['a', 'b', 'c', 'd', 'e'].map((n) => ({ name: n, fullName: `me/${n}` }));
  assert.deepEqual(parseSelection('1, 3-4', repos), [0, 2, 3]);
  assert.deepEqual(parseSelection('5-4 9 0', repos), [3, 4]);
  assert.deepEqual(parseSelection('all', repos), [0, 1, 2, 3, 4]);
  assert.deepEqual(parseSelection('me/b e nope', repos), [1, 4]);
  assert.deepEqual(parseSelection('', repos), []);
});

test('adoptRepo commits the workflow and the pet in the README', async () => {
  const puts = {};
  const { client } = fakeGitHub({
    'GET /repos/me/secret/readme': () => [200, { path: 'README.md', sha: 'r1', encoding: 'base64', content: b64('# Secret\n\nHi\n') }],
    [`PUT /repos/me/secret/contents/${WORKFLOW_PATH}`]: (_, body) => { puts.workflow = body; return [201, {}]; },
    'PUT /repos/me/secret/contents/README.md': (_, body) => { puts.readme = body; return [200, {}]; },
  });
  const repo = { fullName: 'me/secret', name: 'secret', isPrivate: true, defaultBranch: 'trunk' };
  const done = await adoptRepo(client, repo, { options: { species: 'cat' } });
  assert.deepEqual(done, { fullName: 'me/secret', workflow: 'created', readme: 'updated' });
  assert.equal(puts.workflow.branch, 'trunk');
  assert.equal(puts.workflow.sha, undefined);
  assert.match(unb64(puts.workflow.content), /species: cat/);
  assert.equal(puts.readme.sha, 'r1');
  assert.match(unb64(puts.readme.content), /^# Secret\n\n<!-- legacypet:start -->\n.*blob\/legacypet\/pet\.svg\?raw=true/);
});

test('adoptRepo leaves an existing workflow alone unless forced, and flags missing scope', async () => {
  const existing = { sha: 'w1', encoding: 'base64', content: b64('name: LegacyPet\n') };
  const snippet = `<!-- legacypet:start -->\n${snippetFor('me/app')}\n<!-- legacypet:end -->`;
  const { client, calls } = fakeGitHub({
    [`GET /repos/me/app/contents/${WORKFLOW_PATH}`]: () => [200, existing],
    'GET /repos/me/app/readme': () => [200, { path: 'README.md', sha: 'r1', encoding: 'base64', content: b64(`# App\n\n${snippet}\n`) }],
  });
  const repo = { fullName: 'me/app', name: 'app', isPrivate: false, defaultBranch: 'main' };
  const done = await adoptRepo(client, repo, { style: 'card' });
  assert.equal(done.workflow, 'exists');
  assert.equal(done.readme, 'exists');
  assert.ok(!calls.some((c) => c.key.startsWith('PUT') && c.key.includes('workflows')));

  const denied = fakeGitHub({ [`PUT /repos/me/app/contents/${WORKFLOW_PATH}`]: () => [403, { message: 'Resource not accessible' }] });
  await assert.rejects(adoptRepo(denied.client, repo), (err) => err.hint === 'workflow-scope');
});
