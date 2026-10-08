import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkup } from '../src/engine/checkup.js';
import { buildPet } from '../src/engine/pet.js';
import { createClient } from '../src/github/client.js';
import { collectPark, resolveParkRepos } from '../src/github/park.js';
import { mockSnapshot } from '../src/mock.js';
import { renderBadge } from '../src/render/badge.js';
import { parkSummary, renderPark } from '../src/render/park.js';
import { insertSnippet, parseRemote, snippetFor, workflowYaml } from '../src/setup.js';

const NOW = new Date('2026-10-08T09:00:00Z');
const pet = (mood, extra = {}) => buildPet({
  snapshot: mockSnapshot({ mood, now: NOW, fullName: extra.fullName ?? `me/${mood}-repo` }),
  now: NOW,
  options: { holiday: null, species: 'blob', ...extra },
});

const balanced = (svg) => {
  const body = svg.replace(/<style>[\s\S]*?<\/style>/, '');
  const stack = [];
  for (const [, closing, name, , self] of body.matchAll(/<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g)) {
    if (closing) assert.equal(stack.pop(), name);
    else if (!self) stack.push(name);
  }
  assert.deepEqual(stack, []);
  assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
};

test('Pet Park renders 1 to 8 pets, in both languages', () => {
  const moods = ['ecstatic', 'happy', 'party', 'hungry', 'sleepy', 'sad', 'sick', 'zombie', 'hibernating', 'egg'];
  for (let n = 1; n <= 8; n++) {
    const pets = moods.slice(0, n).map((m) => pet(m));
    for (const lang of ['en', 'vi']) {
      const svg = renderPark(pets, { owner: 'me', lang });
      balanced(svg);
      assert.match(svg, lang === 'vi' ? /Công viên thú của me/ : /me&apos;s Pet Park/);
    }
  }
  assert.throws(() => renderPark([], { owner: 'me' }), /at least one pet/);
});

test('park summary counts pets that need care', () => {
  const s = parkSummary([pet('happy'), pet('zombie'), pet('sick')]);
  assert.deepEqual(s.needCare, ['me/zombie-repo', 'me/sick-repo']);
  assert.ok(s.health > 0 && s.health <= 100);
});

test('badges render for every mood and carry an accessible label', () => {
  for (const mood of ['ecstatic', 'sick', 'zombie', 'egg', 'hibernating']) {
    const svg = renderBadge(pet(mood, { name: 'Mochi' }));
    balanced(svg);
    assert.match(svg, /height="20"/);
    assert.match(svg, /aria-label="Mochi: /);
  }
});

test('checkup explains the mood with actionable items', () => {
  const sick = checkup(pet('sick'), mockSnapshot({ mood: 'sick', now: NOW }));
  assert.ok(sick.some((i) => i.level === 'bad' && /test \(ubuntu-latest\)/.test(i.text)));
  const hungry = checkup(pet('hungry'), mockSnapshot({ mood: 'hungry', now: NOW }));
  assert.ok(hungry.some((i) => i.level === 'bad' && /40 days/.test(i.text)));
  const vi = checkup(pet('sad', { lang: 'vi' }), mockSnapshot({ mood: 'sad', now: NOW }));
  assert.ok(vi.some((i) => /#12 \(87 ngày\)/.test(i.text)));
  for (const item of [...sick, ...hungry, ...vi]) assert.ok(['good', 'warn', 'bad', 'tip'].includes(item.level));
});

test('parseRemote understands https and ssh remotes', () => {
  assert.equal(parseRemote('https://github.com/Tanx-1811/legacypet.git\n'), 'Tanx-1811/legacypet');
  assert.equal(parseRemote('git@github.com:octo/my.repo.git'), 'octo/my.repo');
  assert.equal(parseRemote('https://github.com/octo/demo'), 'octo/demo');
  assert.equal(parseRemote('https://gitlab.com/octo/demo.git'), null);
});

test('workflowYaml only adds the inputs you changed', () => {
  const plain = workflowYaml();
  assert.match(plain, /uses: Tanx-1811\/legacypet@v1\n$/);
  assert.doesNotMatch(plain, /with:/);
  const custom = workflowYaml({ lang: 'vi', species: 'cactus', name: 'Bánh "Bao"', park: 'auto' });
  assert.match(custom, /with:\n {10}lang: vi\n {10}species: cactus\n {10}name: "Bánh \\"Bao\\""\n {10}park: auto/);
  assert.match(custom, /actions: write/);
});

test('insertSnippet adds the pet under the title and updates it in place', () => {
  const snippet = snippetFor('me/app');
  const once = insertSnippet('# My App\n\nIt does things.\n', snippet);
  assert.equal(once, `# My App\n\n<!-- legacypet:start -->\n${snippet}\n<!-- legacypet:end -->\n\nIt does things.\n`);
  const badge = snippetFor('me/app', 'badge');
  const twice = insertSnippet(once, badge);
  assert.equal(twice.match(/legacypet:start/g).length, 1);
  assert.ok(twice.includes('pet-badge.svg') && !twice.includes('/pet.svg'));
  assert.ok(insertSnippet('No heading here', snippet).startsWith('<!-- legacypet:start -->'));
});

test('snippetFor serves private repos through github.com', () => {
  assert.match(snippetFor('me/app'), /raw\.githubusercontent\.com\/me\/app\/legacypet\/pet\.svg/);
  const secret = snippetFor('me/app', 'mini', 'legacypet', { isPrivate: true });
  assert.match(secret, /\(https:\/\/github\.com\/me\/app\/blob\/legacypet\/pet-mini\.svg\?raw=true\)/);
  assert.ok(!secret.includes('raw.githubusercontent.com'));
});

test('resolveParkRepos: explicit lists and auto selection', async () => {
  const repos = [
    { name: 'me', full_name: 'me/me', fork: false, stargazers_count: 99, pushed_at: '2026-10-01' },
    { name: 'fork', full_name: 'me/fork', fork: true, stargazers_count: 500, pushed_at: '2026-10-01' },
    { name: 'a', full_name: 'me/a', fork: false, stargazers_count: 5, pushed_at: '2026-10-01' },
    { name: 'b', full_name: 'me/b', fork: false, stargazers_count: 50, pushed_at: '2026-01-01' },
    { name: 'c', full_name: 'me/c', fork: false, stargazers_count: 5, pushed_at: '2026-10-05' },
  ];
  const fetch = async (url) => new Response(JSON.stringify(url.pathname === '/users/me/repos' ? repos : []), { status: 200 });
  const client = createClient({ fetch });
  assert.deepEqual(await resolveParkRepos(client, { owner: 'me', spec: 'auto', size: 2 }), ['me/b', 'me/c']);
  assert.deepEqual(await resolveParkRepos(client, { owner: 'me', spec: 'x, other/y\nx' }), ['me/x', 'other/y']);
});

test('collectPark skips repos it cannot read and keeps going', async () => {
  const fetch = async (url) => {
    if (url.pathname === '/repos/me/gone') return new Response('{"message":"Not Found"}', { status: 404 });
    if (url.pathname === '/repos/me/ok') {
      return new Response(JSON.stringify({
        name: 'ok', full_name: 'me/ok', owner: { login: 'me' }, default_branch: 'main', archived: true,
        private: false, stargazers_count: 1, forks_count: 0, language: null, created_at: '2024-01-01T00:00:00Z', pushed_at: '2025-01-01T00:00:00Z',
      }), { status: 200 });
    }
    return new Response('{"message":"Not Found"}', { status: 404 });
  };
  const warnings = [];
  const pets = await collectPark(createClient({ fetch }), { repos: ['me/gone', 'me/ok'], now: NOW, onWarning: (w) => warnings.push(w) });
  assert.equal(pets.length, 1);
  assert.equal(pets[0].mood, 'hibernating');
  assert.match(warnings[0], /me\/gone/);
});
