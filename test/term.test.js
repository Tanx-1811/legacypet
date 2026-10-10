import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';

const temp = mkdtempSync(join(tmpdir(), 'legacypet-term-'));
process.env.LEGACYPET_HOME = join(temp, 'home');
after(() => rmSync(temp, { recursive: true, force: true }));

const { buildPet } = await import('../src/engine/pet.js');
const { strings } = await import('../src/i18n/index.js');
const { END, hookBlock, hookCommand, hookStatus, installHooks, removeHooks, START, withBlock, withoutBlock } = await import('../src/local/hooks.js');
const { mockSnapshot } = await import('../src/mock.js');
const { MOODS } = await import('../src/engine/mood.js');
const { MOVES } = await import('../src/render/moves.js');
const { SPECIES, SPECIES_IDS } = await import('../src/sprites/index.js');
const { createActor, drawBitmap, idlePose, moveTrack, parseKeyframes, petSprites, stampBitmap } = await import('../src/term/actor.js');
const { fitsBig, live } = await import('../src/term/live.js');
const {
  branchChanged, commitInfo, findRoot, nameOf, outputStyle, parsePushRefs, parseReflog, petFromMemory, pushData, react, replaying,
} = await import('../src/term/react.js');
const { blankTop, composeFrame, highlight, play, SCENES, still } = await import('../src/term/scenes.js');
const { Canvas, clip, colorMode, sideBySide, to256, visibleWidth } = await import('../src/term/screen.js');
const { commitKind, WORDS, words } = await import('../src/term/words.js');
const { gitDirs } = await import('../src/local/git.js');

const NOW = new Date('2026-10-08T09:00:00Z');
const CLI = fileURLToPath(new URL('../src/cli.js', import.meta.url));
const strip = (s) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
const pet = (species = 'cat', mood = 'happy', options = {}) =>
  buildPet({ snapshot: mockSnapshot({ mood, now: NOW }), now: NOW, options: { species, mood, holiday: null, name: 'Mochi', ...options } });

function fakeOut({ tty = true, columns = 100, rows = 40 } = {}) {
  const out = new EventEmitter();
  const chunks = [];
  Object.assign(out, { isTTY: tty, columns, rows, getColorDepth: () => 24, write: (s) => chunks.push(String(s)) > 0 });
  out.text = () => chunks.join('');
  return out;
}

let n = 0;
function makeRepo(name = 'repo', commits = 6) {
  const dir = join(temp, `${name}-${++n}`);
  mkdirSync(dir, { recursive: true });
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'Ada', GIT_AUTHOR_EMAIL: 'ada@example.com', GIT_COMMITTER_NAME: 'Ada', GIT_COMMITTER_EMAIL: 'ada@example.com' };
  const sh = (args) => execFileSync('git', args, { cwd: dir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  sh(['init', '-q', '-b', 'main']);
  sh(['config', 'user.name', 'Ada']);
  sh(['config', 'user.email', 'ada@example.com']);
  sh(['config', 'commit.gpgsign', 'false']);
  sh(['config', 'core.autocrlf', 'false']);
  for (let i = 0; i < commits; i++) {
    writeFileSync(join(dir, 'log.txt'), `${i}\n`);
    sh(['add', '.']);
    sh(['commit', '-q', '-m', i % 2 ? `fix: bug ${i}` : `feat: thing ${i}`]);
  }
  return { dir, sh, env };
}

// --- screen ----------------------------------------------------------------------------------

test('half blocks: a cell shows its top and bottom pixels', () => {
  const c = new Canvas(4, 2);
  c.set(0, 0, '#ff0000');
  c.set(1, 1, '#00ff00');
  c.set(2, 0, '#0000ff');
  c.set(2, 1, '#0000ff');
  c.set(3, 0, '#ff0000');
  c.set(3, 1, '#00ff00');
  const [line] = c.lines('true');
  assert.equal(strip(line), '▀▄█▀');
  assert.match(line, /38;2;255;0;0m▀/);
  assert.match(line, /38;2;255;0;0m\x1b\[48;2;0;255;0m▀/);
  assert.equal(c.lines('none')[0], '', 'no colors: nothing but trimmed spaces');
});

test('see-through pixels blend in, faint ones over nothing are skipped', () => {
  const c = new Canvas(2, 2);
  c.set(0, 0, '#000000');
  c.set(0, 0, '#ffffff80');
  c.set(1, 0, '#ffffff40');
  assert.equal(c.get(0, 0), '#808080');
  assert.equal(c.get(1, 0), null);
});

test('text sits on the pixel behind it, wide characters take two cells', () => {
  const c = new Canvas(6, 2);
  c.set(0, 1, '#112233');
  c.text(0, 0, 'a🍎b', '#ffffff');
  const [line] = c.lines('true');
  assert.equal(strip(line), 'a🍎b');
  assert.match(line, /48;2;17;34;51ma/);
  assert.equal(visibleWidth(line), 4);
});

test('256 colors, color modes, layout helpers', () => {
  assert.equal(to256('#ff0000'), 196);
  assert.equal(to256('#ffffff'), 231);
  assert.equal(to256('#808080'), 244);
  const tty = { isTTY: true, getColorDepth: () => 24 };
  assert.equal(colorMode(tty, {}), 'true');
  assert.equal(colorMode({ isTTY: true, getColorDepth: () => 8 }, {}), '256');
  assert.equal(colorMode(tty, { NO_COLOR: '1' }), 'none');
  assert.equal(colorMode({ isTTY: false }, {}), 'none');
  assert.equal(colorMode({ isTTY: false }, { FORCE_COLOR: '1' }), 'true');
  assert.deepEqual(sideBySide(['ab', 'c', 'de'], ['X', 'Y'], { gap: 1 }), ['ab', 'c  X', 'de Y']);
  assert.deepEqual(sideBySide(['a'], ['X'], { gap: 1, leftWidth: 4 }), ['a    X']);
  assert.equal(strip(clip('\x1b[1mhello world\x1b[0m', 6)), 'hello…');
});

// --- the actor ----------------------------------------------------------------------------

test('signature moves come straight from the card keyframes', () => {
  const keys = parseKeyframes(MOVES.squish.frames);
  assert.deepEqual(keys.map((k) => k.at), [0, 0.8, 0.84, 0.89, 0.94, 1]);
  assert.equal(keys[2].sx, 1.25);
  assert.equal(keys[3].dy, -12);
  for (const id of SPECIES_IDS) {
    const track = moveTrack(SPECIES[id]);
    assert.ok(track.seconds > 0.2 && track.seconds < 4, `${id}: ${track.seconds}s`);
    assert.ok(track.start < track.end, id);
  }
  assert.equal(moveTrack(SPECIES.ninja).effect.kind, 'clones');
  assert.equal(moveTrack(SPECIES.mecha).effect.kind, 'flames');
});

test('every species and mood can be drawn in the terminal, small and big', () => {
  for (const id of SPECIES_IDS) {
    for (const hd of [false, true]) {
      const sprites = petSprites(pet(id), { hd });
      assert.ok(sprites.open.w > 0 && sprites.open.w <= 20 * sprites.scale, `${id} ${hd}`);
      assert.equal(sprites.scale, hd ? 2 : 1);
    }
  }
  for (const mood of MOODS) {
    const actor = createActor(pet('bunny', mood));
    const c = new Canvas(30, 24);
    for (const t of [0, 0.4, 1.3, 2.9]) actor.draw(c, 12, 22, t, { move: mood === 'happy' ? t : null });
    const pose = idlePose({ mood, hatchProgress: 0.4 }, 1.1, 2);
    assert.ok(Object.values(pose).every(Number.isFinite), mood);
  }
});

test('turned, stretched and mirrored sprites land where they should', () => {
  const bmp = stampBitmap(['ab', 'cd'], { a: '#ff0000', b: '#00ff00', c: '#0000ff', d: '#ffffff' });
  const plain = new Canvas(6, 6);
  drawBitmap(plain, bmp, 3, 4);
  assert.equal(plain.get(2, 2), '#ff0000');
  const mirrored = new Canvas(6, 6);
  drawBitmap(mirrored, bmp, 3, 4, { sx: -1 });
  assert.equal(mirrored.get(2, 2), '#00ff00');
  const upside = new Canvas(6, 6);
  drawBitmap(upside, bmp, 3, 4, { rot: 180 }, { pivot: 'center' });
  assert.equal(upside.get(2, 2), '#ffffff');
  const big = new Canvas(10, 10);
  drawBitmap(big, bmp, 5, 8, { sx: 2, sy: 2 });
  assert.equal([0, 1, 2, 3].filter((i) => big.get(3 + i, 4)).length, 4);
});

// --- words ---------------------------------------------------------------------------------

test('a commit is a meal that matches what it does', () => {
  const kinds = {
    'feat(ui): add dark mode': 'feat', 'Fix crash on start': 'fix', 'docs: update README': 'docs', 'Merge branch \'dev\'': 'merge',
    'Revert "feat: x"': 'revert', '✨ shiny new thing': 'feat', '🐛 off by one': 'fix', 'WIP stuff': 'wip', 'refactor!: drop v1': 'refactor',
    'perf: faster boot': 'perf', 'chore(deps): bump': 'chore', 'add tests for parser': 'test', 'sửa lỗi đăng nhập': 'fix',
    'thêm trang cài đặt': 'feat', 'update deps': 'other', '': 'other',
  };
  for (const [subject, kind] of Object.entries(kinds)) assert.equal(commitKind(subject), kind, subject);
  assert.equal(commitKind('whatever', 'merge'), 'merge');
});

test('Vietnamese says everything English does', () => {
  const shape = (o, path = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? shape(v, `${path}${k}.`) : [`${path}${k}:${typeof v}`]));
  assert.deepEqual(shape(WORDS.vi).sort(), shape(WORDS.en).sort());
  assert.equal(words('vi-VN'), WORDS.vi);
  assert.equal(words('ja'), WORDS.en);
});

// --- scenes ----------------------------------------------------------------------------------

function demoCtx(event, lang = 'en', options = {}) {
  const p = pet('ninja', 'happy', { lang, levelUp: true, ...options });
  return {
    w: words(lang), tr: strings(lang), mode: 'true', now: NOW, lang, ready: true, pet: p, lookPet: { ...p, mood: 'hungry' },
    look: createActor({ ...p, mood: 'hungry' }), final: createActor(p),
    info: { sha: 'abc1234def', subject: 'fix: login', kind: 'fix', branch: 'feature/a-very-long-branch-name-that-goes-on', remote: 'origin' },
    data: { today: 1, firstToday: true, added: 3, deleted: 1, count: 3, names: ['Ada', 'Linus'], branch: 'main', to: 'origin/main', dirty: 2, lastMinutes: 5 },
  };
}

test('every scene keeps the same height while it plays, in every width', () => {
  for (const lang of ['en', 'vi']) {
    for (const event of Object.keys(SCENES)) {
      for (const columns of [60, 100, 140]) {
        const scene = SCENES[event](demoCtx(event, lang));
        const heights = new Set();
        for (let i = 0; i <= 10; i++) {
          const lines = composeFrame(scene, { t: (scene.duration * i) / 10, columns });
          heights.add(lines.length);
          for (const line of lines) assert.ok(visibleWidth(line) <= columns - 1, `${event} ${lang} ${columns}: ${strip(line)}`);
        }
        const last = still(scene, { columns });
        assert.equal(blankTop(last), 0);
        assert.ok(heights.size <= 2, `${event} ${lang} ${columns}: ${[...heights]}`);
      }
    }
  }
});

test('the commit scene says what was eaten and what it meant', () => {
  const ctx = demoCtx('commit');
  const text = still(SCENES.commit(ctx), { columns: 120 }).map(strip).join('\n');
  assert.match(text, /An apple a day/);
  assert.match(text, /abc1234 · fix: login/);
  assert.match(text, /Mochi · Lv\.\d+/);
  assert.match(text, /Level up!/);
  assert.equal(highlight({ ...ctx, pet: pet('cat') }), words('en').first, 'no level-up: the first commit of the day');
  const vi = still(SCENES.commit(demoCtx('commit', 'vi')), { columns: 120 }).map(strip).join('\n');
  assert.match(vi, /Mỗi ngày một quả táo/);
  assert.match(vi, /Lên cấp!/);
});

test('the player waits for the numbers, then leaves a tidy last frame', async () => {
  const out = fakeOut();
  let ready = false;
  let waited = 0;
  const scene = {
    size: { w: 6, h: 8 },
    duration: 0.12,
    waitAt: 0.03,
    draw(c, t) {
      if (t === 0.03 && !ready) waited += 1;
      c.set(1, 7, '#ff0000');
    },
    panel: () => ['hello'],
  };
  setTimeout(() => { ready = true; }, 150);
  await play(scene, { out, mode: 'true', fps: 60, ready: () => ready, columns: 40 });
  const text = out.text();
  assert.ok(waited >= 2, `held still while waiting (${waited} frames)`);
  assert.match(text, /\x1b\[3M/, 'the empty headroom is dropped');
  assert.ok(text.endsWith('\x1b[?25h'), 'the cursor comes back');
});

// --- reacting to git --------------------------------------------------------------------------

test('reflogs, push refs and branch moves are read without running git', () => {
  const sha = 'a'.repeat(40);
  const entry = parseReflog(`${'0'.repeat(40)} ${sha} Ada Lovelace <ada@example.com> 1760000000 +0700\tcommit (amend): fix: the thing`);
  assert.deepEqual([entry.what, entry.text, entry.name, entry.sha], ['commit (amend)', 'fix: the thing', 'Ada Lovelace', sha]);
  assert.equal(parseReflog('garbage'), null);
  assert.deepEqual(parsePushRefs(`refs/heads/main ${sha} refs/heads/main ${'b'.repeat(40)}\n`), [
    { localRef: 'refs/heads/main', localSha: sha, remoteRef: 'refs/heads/main', remoteSha: 'b'.repeat(40) },
  ]);
});

test('how a reaction shows up depends on where it runs', () => {
  assert.equal(outputStyle({ hook: true, tty: true, env: {} }), 'full');
  assert.equal(outputStyle({ hook: true, tty: false, env: {} }), 'line');
  assert.equal(outputStyle({ hook: true, tty: true, env: { LEGACYPET_QUIET: '1' } }), 'off');
  assert.equal(outputStyle({ hook: true, tty: true, env: { CI: 'true' } }), 'off');
  assert.equal(outputStyle({ hook: true, tty: true, env: { LEGACYPET_HOOK: 'line' } }), 'line');
  assert.equal(outputStyle({ hook: true, tty: true, env: { LEGACYPET_HOOK: 'still' } }), 'still');
  assert.equal(outputStyle({ tty: true, mode: 'none', env: {} }), 'text');
  assert.equal(outputStyle({ tty: true, motion: 'off', env: {} }), 'still');
});

test('a commit in a real repo: the pet eats it and remembers', async () => {
  const { dir, sh } = makeRepo('eat', 5);
  assert.equal(findRoot(join(dir)), dir);
  const dirs = gitDirs(dir);
  const info = commitInfo(dirs);
  assert.equal(info.kind, 'feat');
  assert.match(info.subject, /^feat: thing 4$/);
  assert.equal(info.sha, sh(['rev-parse', 'HEAD']).trim());
  assert.match(nameOf(dir, dirs), /^\w+$/);

  const out = fakeOut();
  const ctx = await react('commit', { dir, motion: 'off', out, env: { LANG: 'en_US.UTF-8' } });
  const text = strip(out.text());
  assert.match(text, /Cake for the new feature/);
  assert.match(text, new RegExp(`${ctx.pet.name} · Lv\\.3`));
  const pets = readdirSync(join(process.env.LEGACYPET_HOME, 'pets'));
  assert.equal(pets.length, 1, 'the pet remembers');
  const memory = JSON.parse(readFileSync(join(process.env.LEGACYPET_HOME, 'pets', pets[0]), 'utf8'));
  assert.equal(memory.facts.totalCommits, 5);
  assert.equal(petFromMemory(memory, {}, 'en').name, ctx.pet.name);

  // Where nothing can be drawn (a commit button in an editor): one line, from memory, no git.
  const line = fakeOut({ tty: false });
  await react('commit', { dir, hook: true, out: line, env: {} });
  assert.equal(line.text(), `🐣 ${ctx.pet.name}: ${words('en').food.feat}\n`);
});

test('hooks stay quiet for rebases, file checkouts and when asked', async () => {
  const { dir, sh } = makeRepo('quiet', 2);
  const head = sh(['rev-parse', 'HEAD']).trim();
  const dirs = gitDirs(dir);
  const out = fakeOut({ tty: false });
  assert.equal(await react('checkout', { dir, hook: true, args: [head, head, '0'], out, env: {} }), null);
  assert.equal(await react('commit', { dir, hook: true, out, env: { LEGACYPET_QUIET: '1' } }), null);
  assert.equal(replaying(dirs, { GIT_REFLOG_ACTION: 'rebase (pick)' }), true);
  mkdirSync(join(dirs.own, 'rebase-merge'));
  assert.equal(replaying(dirs, {}), true);
  assert.equal(await react('commit', { dir, hook: true, out, env: {} }), null);
  rmSync(join(dirs.own, 'rebase-merge'), { recursive: true });
  assert.equal(out.text(), '');
  // `git switch -c` stays on the same commit, but the branch changed: the pet walks.
  sh(['switch', '-q', '-c', 'feature/x']);
  assert.equal(branchChanged(dirs, [head, head, '1']), true);
  assert.equal(branchChanged(dirs, ['0'.repeat(40), head, '1']), false, 'a fresh clone');
  await react('checkout', { dir, hook: true, args: [head, head, '1'], out, env: {} });
  assert.match(out.text(), /New path: feature\/x/);
});

test('a push says how many commits leave, and notices tags and new branches', async () => {
  const { dir, sh } = makeRepo('push', 4);
  const [a, , , d] = sh(['rev-list', '--reverse', 'HEAD']).trim().split('\n');
  const zero = '0'.repeat(40);
  assert.deepEqual(await pushData(dir, [{ localRef: 'refs/heads/main', localSha: d, remoteRef: 'refs/heads/main', remoteSha: a }], 'origin', NOW),
    { count: 3, branch: 'main', to: 'origin/main', fresh: false, friday: false });
  assert.equal((await pushData(dir, [{ localRef: 'refs/tags/v1', localSha: d, remoteRef: 'refs/tags/v1', remoteSha: zero }])).tag, 'v1');
  assert.equal((await pushData(dir, [{ localRef: '(delete)', localSha: zero, remoteRef: 'refs/heads/old', remoteSha: a }])).gone, true);
  const fresh = await pushData(dir, [{ localRef: 'refs/heads/main', localSha: d, remoteRef: 'refs/heads/main', remoteSha: zero }]);
  assert.deepEqual([fresh.fresh, fresh.count], [true, 4]);
  const friday = new Date(2026, 9, 9, 17, 0);
  assert.equal((await pushData(dir, [], 'origin', friday)).friday, true);
});

// --- hooks ---------------------------------------------------------------------------------

test('hooks go in, keep what was there, and come out cleanly', () => {
  const { dir } = makeRepo('hooks', 1);
  const hooks = join(dir, '.git', 'hooks');
  mkdirSync(hooks, { recursive: true });
  const mine = '#!/bin/sh\necho "lint"\nexit 0\n';
  writeFileSync(join(hooks, 'pre-push'), mine);
  writeFileSync(join(hooks, 'post-merge'), '#!/usr/bin/env node\nconsole.log(1)\n');

  const first = installHooks(dir, { cli: CLI });
  assert.deepEqual(first.results.map((r) => r.status), ['created', 'added', 'skipped', 'created']);
  const prePush = readFileSync(join(hooks, 'pre-push'), 'utf8');
  assert.ok(prePush.indexOf(START) > prePush.indexOf('lint') && prePush.indexOf(END) < prePush.indexOf('exit 0'), 'before the final exit');
  assert.deepEqual(installHooks(dir, { cli: CLI }).results.map((r) => r.status), ['exists', 'exists', 'skipped', 'exists']);
  assert.deepEqual(hookStatus(dir).hooks.map((h) => h.installed), [true, true, false, true]);

  const removed = removeHooks(dir).results.map((r) => r.status);
  assert.deepEqual(removed, ['deleted', 'removed', 'none', 'deleted']);
  assert.equal(readFileSync(join(hooks, 'pre-push'), 'utf8'), mine);
  assert.equal(existsSync(join(hooks, 'post-commit')), false);
  assert.equal(withoutBlock(withBlock(mine, hookBlock('push', { cli: CLI }))), mine);
});

test('hooks a team shares (core.hooksPath) are left alone unless forced', () => {
  const { dir, sh } = makeRepo('husky', 1);
  sh(['config', 'core.hooksPath', '.husky']);
  const blocked = installHooks(dir, { cli: CLI });
  assert.equal(blocked.blocked, true);
  assert.equal(existsSync(join(dir, '.husky')), false);
  const forced = installHooks(dir, { cli: CLI, force: true, events: ['commit'] });
  assert.equal(forced.results[0].status, 'created');
  assert.ok(existsSync(join(dir, '.husky', 'post-commit')));
  assert.match(hookCommand('commit', { node: 'C:\\Program Files\\node.exe', cli: 'C:\\a $b\\cli.js' }), /^"C:\/Program Files\/node\.exe" "C:\/a \\\$b\/cli\.js" react commit --hook "\$@" \|\| true$/);
});

test('a real commit runs the hook, and the pet says something', () => {
  const { dir, env } = makeRepo('live-hook', 2);
  installHooks(dir, { cli: CLI, events: ['commit'] });
  const result = spawnSync('git', ['commit', '-q', '--allow-empty', '-m', 'docs: explain the pet'], {
    cwd: dir, env: { ...env, LEGACYPET_HOME: process.env.LEGACYPET_HOME, CI: '', LANG: 'en_US.UTF-8' }, encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(`${result.stdout}${result.stderr}`, /🐣 \w+: A fortune cookie!/);
});

// --- live ------------------------------------------------------------------------------------

test('live: a pet in a terminal pane that takes keys and leaves the screen as it was', async () => {
  assert.equal(fitsBig(120, 30), true);
  assert.equal(fitsBig(80, 30), false);
  const out = fakeOut({ columns: 100, rows: 30 });
  const input = new EventEmitter();
  Object.assign(input, { isTTY: true, setRawMode: () => {}, setEncoding: () => {}, resume: () => {}, pause: () => {} });
  const running = live({ demo: pet('duck'), out, input, env: { LANG: 'vi_VN.UTF-8' }, focusMinutes: 1 });
  await new Promise((r) => setTimeout(r, 250));
  input.emit('data', 'f');
  input.emit('data', 't');
  await new Promise((r) => setTimeout(r, 300));
  input.emit('data', 'q');
  await running;
  const text = out.text();
  assert.ok(text.startsWith('\x1b[?1049h'), 'draws on its own screen');
  assert.ok(text.includes('\x1b[?1049l'), 'and gives the terminal back');
  assert.match(strip(text), /🎯 tập trung 01:00/);
  assert.match(strip(text), /Mochi: Tạm biệt! Ship tiếp nhé/);
});
