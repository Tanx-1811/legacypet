#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  buildPet, checkup, collectPark, collectSnapshot, createClient, insertSnippet, LANG_NAMES, mockSnapshot, MOOD_EMOJI, MOODS,
  parseRemote, PLAYGROUND, renderBadge, renderCard, renderFiles, renderMini, renderPark, resolveParkRepos,
  snippetFor, HOMES, adoptRepo, hasPet, listRepos, parseSelection, ITEMS, PATHS, RANKS, renderStats, SPECIES_IDS, terminalArt, workflowYaml,
} from './index.js';
import { adoptLocal, findReadme } from './local/adopt.js';

const HELP = `
🐾 legacypet: a pixel pet that lives in your README

Usage
  legacypet app                   Open the LegacyPet app: every project on this computer gets a pet
  legacypet init                  Adopt a pet: add the workflow and put the pet in README.md
  legacypet adopt [owner]         Pick any of your repos from a list and adopt pets in all of them (no clone)
  legacypet render <owner/repo>   Visit a real repo, draw its pet and give it a checkup
  legacypet park <owner> [repos]  Draw a Pet Park with an owner's repos (default: their top 6)
  legacypet demo                  Draw a pet from made-up data
  legacypet gallery               Draw every species, mood, stage and holiday

Options
  --species <id>   auto | ${SPECIES_IDS.join(' | ')}
  --scenery <home> auto | ${HOMES.join(' | ')}
  --name <name>    custom pet name
  --lang <code>    ${Object.keys(LANG_NAMES).join(' | ')}
  --theme <mode>   auto | light | dark
  --out <dir>      output directory (default: legacypet-out)
  --token <token>  GitHub token (default: $GITHUB_TOKEN)

  init:    --repo <owner/name>  --style card|mini|badge|park  --park auto|<repos>  --force  --private
  adopt:   --repos "1,3" | "app,lib" | all  --all (include forks)  --style  --force   (token: $GITHUB_TOKEN or gh)
  park:    --size <1-8>
  app:     --port <n>  --no-open (just print the address)
  demo:    --mood ${MOODS.join('|')}  --stage egg|baby|adult|elder  --shiny  --aura  --level-up  --commits <n>  --holiday <id>
  render, demo:  --vacation "until 2027-01-05"  preview the pet on vacation
  demo:    --wear "cap, bird" (any item, locked or not)  --path swift|guardian|social|sage

Preview any repo in the browser: ${PLAYGROUND}
`;

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    species: { type: 'string', default: 'auto' },
    scenery: { type: 'string', default: 'auto' },
    vacation: { type: 'string' },
    wear: { type: 'string' },
    path: { type: 'string' },
    mood: { type: 'string' },
    stage: { type: 'string' },
    shiny: { type: 'boolean' },
    aura: { type: 'boolean' },
    'level-up': { type: 'boolean' },
    commits: { type: 'string' },
    holiday: { type: 'string' },
    name: { type: 'string' },
    lang: { type: 'string', default: 'en' },
    theme: { type: 'string', default: 'auto' },
    out: { type: 'string', default: 'legacypet-out' },
    token: { type: 'string' },
    repo: { type: 'string' },
    style: { type: 'string' },
    park: { type: 'string' },
    size: { type: 'string', default: '6' },
    force: { type: 'boolean' },
    private: { type: 'boolean' },
    repos: { type: 'string' },
    all: { type: 'boolean' },
    port: { type: 'string' },
    'no-open': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

const CHECK_ICON = { good: '✔', warn: '!', bad: '✖', tip: '·' };
const token = () => opts.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

// Falls back to the GitHub CLI's login, so `gh auth login` is all the setup `adopt` needs.
function ghToken() {
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

const write = (dir, file, content) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), content);
};

function show(pet, snapshot) {
  const colorful = process.stdout.isTTY && !process.env.NO_COLOR;
  if (colorful) console.log(`\n${terminalArt(pet)}\n`);
  const v = pet.vitals;
  console.log(`${MOOD_EMOJI[pet.mood]} ${pet.displayName}  ·  Lv.${pet.level} ${pet.stage} ${pet.speciesId}${pet.shiny ? ' ✨' : ''}`);
  console.log(`   🍖 ${v.fullness}  ❤️ ${v.health}  😊 ${v.joy}  ⚡ ${v.energy}${v.hygiene != null ? `  🧼 ${v.hygiene}` : ''}`);
  console.log(`   “${pet.speech}”`);
  if (pet.achievements.length) console.log(`   ${pet.achievements.map((a) => a.emoji).join(' ')}`);
  if (snapshot) {
    console.log('\n🩺 Checkup');
    for (const item of checkup(pet, snapshot)) console.log(`   ${CHECK_ICON[item.level]} ${item.icon} ${item.text}`);
  }
}

async function visit(fullName, now = new Date()) {
  const [owner, repo] = (fullName ?? '').split('/');
  if (!owner || !repo) throw new Error('Expected a repo like owner/name');
  const snapshot = await collectSnapshot(createClient({ token: token() }), { owner, repo, now });
  snapshot.warnings.forEach((w) => console.warn(`⚠ ${w}`));
  const pet = buildPet({ snapshot, now, options: { species: opts.species, scenery: opts.scenery, vacation: opts.vacation, name: opts.name, lang: opts.lang } });
  return { pet, snapshot };
}

async function render(fullName) {
  if (!token()) console.warn('No token: using the unauthenticated API (60 requests/hour).');
  const { pet, snapshot } = await visit(fullName);
  for (const file of renderFiles(pet, snapshot, { theme: opts.theme, diary: false })) write(opts.out, file.path, file.content);
  show(pet, snapshot);
  console.log(`\nWrote ${join(opts.out, 'pet.svg')}, pet-mini.svg and pet-badge.svg`);
}

async function park(owner, repos) {
  if (!owner) throw new Error('Usage: legacypet park <owner> [repo ...]');
  const client = createClient({ token: token() });
  const list = await resolveParkRepos(client, { owner, spec: repos.length ? repos.join(',') : 'auto', size: opts.size });
  console.log(`🏞️ Visiting ${list.length} repos: ${list.join(', ')}`);
  const pets = await collectPark(client, { repos: list, lang: opts.lang, onWarning: (w) => console.warn(`⚠ ${w}`) });
  if (!pets.length) throw new Error('No repos could be read for the park.');
  write(opts.out, 'park.svg', renderPark(pets, { owner, lang: opts.lang, theme: opts.theme }));
  for (const pet of pets) console.log(`   ${MOOD_EMOJI[pet.mood]} ${pet.name.padEnd(10)} ${pet.repo.fullName} · Lv.${pet.level}`);
  console.log(`\nWrote ${join(opts.out, 'park.svg')}`);
}

function gitRemote() {
  try {
    return parseRemote(execFileSync('git', ['config', '--get', 'remote.origin.url'], { encoding: 'utf8' }));
  } catch {
    return null;
  }
}

const ago = (iso) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (!iso || Number.isNaN(days)) return '';
  if (days < 1) return 'today';
  if (days < 60) return `${days}d ago`;
  return days < 730 ? `${Math.round(days / 30)}mo ago` : `${Math.round(days / 365)}y ago`;
};

// Pick repos from a list and adopt a pet in each one through the API: no clone, no push.
async function adopt(owner) {
  const auth = token() ?? ghToken();
  if (!auth) {
    throw new Error('adopt writes to your repos, so it needs a token. Run `gh auth login` (then `gh auth refresh -s workflow`), or set GITHUB_TOKEN.');
  }
  const client = createClient({ token: auth });
  console.log(`📂 Listing ${owner ? `${owner}'s` : 'your'} repos…`);
  const all = await listRepos(client, { owner });
  const repos = all.filter((r) => !r.archived && (opts.all || !r.fork) && r.canPush !== false).slice(0, 50);
  if (!repos.length) throw new Error('No repos you can push to were found. Pass an owner (legacypet adopt my-org) or --all to include forks.');
  const pets = await Promise.all(repos.map((r) => hasPet(client, r.fullName).catch(() => false)));

  const width = String(repos.length).length;
  repos.forEach((r, i) => {
    const marks = `${pets[i] ? '🐾' : '  '}${r.isPrivate ? '🔒' : '  '}`;
    const meta = [r.stars ? `★${r.stars}` : '', r.language ?? '', ago(r.pushedAt)].filter(Boolean).join(' · ');
    console.log(`  ${String(i + 1).padStart(width)}. ${marks} ${r.fullName.padEnd(36)} ${meta}`);
  });
  console.log('\n  🐾 already has a pet   🔒 private');

  let answer = opts.repos;
  if (!answer) {
    if (!process.stdin.isTTY) throw new Error('Pick repos with --repos "1,3" or --repos "app,lib" when not running in a terminal.');
    const { createInterface } = await import('node:readline/promises');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    answer = await rl.question('\nWhich ones? (e.g. 1,3,5-7 · all · names) ');
    rl.close();
  }
  const picked = parseSelection(answer, repos).map((i) => repos[i]);
  if (!picked.length) return console.log('Nothing picked. Your repos stay pet-free for now.');

  const options = { lang: opts.lang, species: opts.species, scenery: opts.scenery, name: opts.name };
  let failed = 0;
  for (const repo of picked) {
    try {
      const done = await adoptRepo(client, repo, { options, style: opts.style ?? 'card', force: opts.force });
      const said = { created: 'added', updated: 'updated', exists: 'already there', skipped: 'skipped' };
      console.log(`✔ ${repo.fullName}: workflow ${said[done.workflow]}, README ${said[done.readme]}`);
    } catch (err) {
      failed++;
      console.log(`✖ ${repo.fullName}: ${err.message.split('\n')[0]}`);
      if (err.hint === 'workflow-scope') console.log('   Your token can\'t write workflow files. Run `gh auth refresh -s workflow`, or use a token with the "workflow" scope.');
    }
  }
  const ok = picked.length - failed;
  if (ok) console.log(`\n🥚 ${ok} egg${ok > 1 ? 's' : ''} on the way. Each pet hatches by itself about a minute from now.`);
  if (failed) process.exitCode = 1;
}

async function init() {
  const fullName = opts.repo ?? gitRemote();
  if (!fullName || !fullName.includes('/')) {
    throw new Error('Could not find a GitHub remote. Run this inside your repo, pass --repo owner/name, or run `legacypet adopt` to pick repos from a list');
  }
  const [owner, name] = fullName.split('/');
  const isProfile = owner.toLowerCase() === name.toLowerCase();
  const parkSpec = opts.park ?? (isProfile ? 'auto' : '');
  const style = opts.style ?? (parkSpec ? 'park' : 'card');
  console.log(`🥚 Adopting a pet for ${fullName}${isProfile ? ' (profile README: adding a Pet Park)' : ''}\n`);

  // Peek at the repo first: for the preview, and to know whether the README needs private-friendly
  // image URLs. A 404 on a repo we just read from `git remote` almost always means private + no token.
  let peek = null;
  let hidden = false;
  try {
    peek = await visit(fullName);
  } catch (err) {
    hidden = err.status === 404;
    if (!hidden) console.log(`(Preview skipped: ${err.message.split('\n')[0]})`);
  }
  const isPrivate = opts.private ?? (peek ? peek.snapshot.repo.isPrivate : hidden);
  if (isPrivate) console.log('🔒 Private repo: the README will load the pet through github.com, so everyone with access sees it.');

  const hasReadme = Boolean(findReadme('.'));
  const { files, snippet } = adoptLocal('.', {
    fullName, repoName: name, isPrivate, style, force: opts.force, readme: hasReadme,
    options: { lang: opts.lang, species: opts.species, scenery: opts.scenery, name: opts.name, park: parkSpec },
  });
  const [workflowFile, readmeFile] = files;
  if (workflowFile.status === 'exists') console.log(`• ${workflowFile.path} already exists${opts.force ? ' and is up to date' : ' (use --force to overwrite)'}`);
  else console.log(`✔ ${workflowFile.status === 'created' ? 'Created' : 'Updated'} ${workflowFile.path}`);
  if (!readmeFile) console.log(`• No README.md here. Paste this where you want your pet:\n\n  ${snippet}\n`);
  else if (readmeFile.status === 'exists') console.log(`• ${readmeFile.path} already shows your pet`);
  else console.log(`✔ Added your pet to ${readmeFile.path}`);
  const workflow = workflowFile.path;
  const readme = readmeFile?.path;

  if (peek) {
    console.log('\n🔮 Here is who will hatch:');
    show(peek.pet, peek.snapshot);
  } else if (hidden) {
    console.log('\n(Preview skipped: GitHub hides private repos without a token. Set GITHUB_TOKEN to see who will hatch.)');
  }

  console.log(`
Next steps
  1. git add ${workflow} ${readme ?? ''} && git commit -m "Adopt a LegacyPet 🐾" && git push
  2. Your pet hatches by itself a minute after the push. Refresh your README and say hi!`);
}

function demoPet({ mood = 'happy', species = 'auto', scenery, vacation, stage, shiny, aura, levelUp, commits, holiday = null, season, lang = 'en', name, fullName, wear, path, now = new Date() }) {
  const snapshot = mockSnapshot({ mood, stage: stage ?? 'adult', now, fullName });
  if (commits != null) snapshot.commits.total = Number(commits); // sets the level: √commits + 1
  return buildPet({ snapshot, now, options: { species, scenery, vacation, mood, stage, shiny: shiny ?? false, aura: aura ?? false, levelUp, holiday, season, lang, name, wear, path, unlockAll: true } });
}

function demo() {
  const pet = demoPet({
    mood: opts.mood ?? 'happy', species: opts.species, scenery: opts.scenery, vacation: opts.vacation, stage: opts.stage, shiny: opts.shiny, aura: opts.aura, levelUp: opts['level-up'], commits: opts.commits,
    holiday: opts.holiday ?? null, lang: opts.lang, name: opts.name,
  });
  write(opts.out, 'demo.svg', renderCard(pet, { theme: opts.theme }));
  write(opts.out, 'demo-mini.svg', renderMini(pet, { theme: opts.theme }));
  write(opts.out, 'demo-badge.svg', renderBadge(pet));
  show(pet);
  console.log(`\nWrote ${join(opts.out, 'demo.svg')}, demo-mini.svg and demo-badge.svg`);
}

// One mood per species keeps the README lineup varied.
const MOOD_STARS = {
  ecstatic: 'duck', happy: 'cat', party: 'ninja', hungry: 'blob', sleepy: 'octopus',
  sad: 'bat', sick: 'mecha', zombie: 'cat', hibernating: 'cactus', egg: 'bunny',
};
// Each home with its native species, on a day that shows the place at its best.
const HOME_DEMO = {
  meadow: ['blob', 'ecstatic'], garden: ['cat', 'happy'], pond: ['duck', 'happy'], beach: ['crab', 'happy'],
  reef: ['octopus', 'happy'], jungle: ['snake', 'sleepy'], desert: ['cactus', 'party'],
};
const PATH_DEMO = { swift: 'ninja', guardian: 'mecha', social: 'octopus', sage: 'dragon' };
const HERO_SQUAD = ['ninja', 'mecha', 'dragon', 'bunny', 'bat', 'hero'];
const LANG_DEMO = { en: 'hero', vi: 'cat', ja: 'ninja', zh: 'dragon', ko: 'bunny', es: 'mecha', fr: 'bat' };
const HOLIDAYS = [['halloween', 'zombie'], ['christmas', 'happy'], ['tet', 'party'], ['newyear', 'party'], ['programmers', 'party']];
const PARK_DEMO = [
  ['awesome-cli', 'ecstatic', 'duck'], ['dotfiles', 'happy', 'cat'], ['api-server', 'sick', 'octopus'],
  ['ml-notebooks', 'hungry', 'snake'], ['rust-game', 'party', 'crab'], ['old-blog', 'zombie', 'blob'],
];

// A believable month: a CI scare mid-month, a quiet patch, then a release.
function demoHistory(now) {
  const moods = { 0: 'party', 1: 'ecstatic', 2: 'ecstatic', 9: 'sleepy', 10: 'sleepy', 16: 'sick', 17: 'sick' };
  return Array.from({ length: 30 }, (_, i) => {
    const t = i / 29;
    const sick = i === 16 || i === 17;
    return {
      date: new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10),
      mood: moods[i] ?? 'happy',
      vitals: [Math.round(70 + 25 * Math.cos(t * 7)), sick ? 25 : 100, Math.round(62 + 30 * (1 - t)), Math.round(45 + 40 * Math.sin(t * 5 + 1))],
    };
  });
}

function gallery() {
  const out = opts.out === 'legacypet-out' ? 'docs/gallery' : opts.out;
  const now = new Date('2026-10-08T09:00:00Z');
  const sections = [];
  const add = (title, items) => sections.push({ title, items });
  const save = (dir, file, svg) => {
    write(join(out, dir), file, svg);
    return `${dir}/${file}`;
  };
  const card = (dir, file, pet, theme = 'light') => save(dir, file, renderCard(pet, { theme }));
  const mini = (dir, file, pet, theme = 'light') => save(dir, file, renderMini(pet, { theme }));
  const parkPets = (lang) => PARK_DEMO.map(([repo, mood, species]) => demoPet({ mood, species, now, lang, fullName: `Tanx-1811/${repo}` }));

  save('hero', 'hero.svg', renderCard(demoPet({ mood: 'ecstatic', species: 'duck', now, name: 'Mochi', fullName: 'Tanx-1811/legacypet' })));
  save('hero', 'hero-vi.svg', renderCard(demoPet({ mood: 'hungry', species: 'cat', now, lang: 'vi', name: 'Bánh Bao', fullName: 'Tanx-1811/legacypet' })));

  add('Pet Park', [
    { label: 'park.svg', src: save('park', 'park.svg', renderPark(parkPets('en'), { owner: 'Tanx-1811', theme: 'light' })), wide: true },
    { label: 'dark mode', src: save('park', 'park-dark.svg', renderPark(parkPets('en'), { owner: 'Tanx-1811', theme: 'dark' })), wide: true, dark: true },
    { label: 'tiếng Việt', src: save('park', 'park-vi.svg', renderPark(parkPets('vi'), { owner: 'Tanx-1811', lang: 'vi', theme: 'light' })), wide: true },
  ]);
  add('Badges', MOODS.map((mood) => ({ label: mood, src: save('badges', `${mood}.svg`, renderBadge(demoPet({ mood, species: MOOD_STARS[mood], now, name: 'Mochi' }))) })));
  add('Moods', MOODS.map((mood) => ({ label: mood, src: mini('moods', `${mood}.svg`, demoPet({ mood, species: MOOD_STARS[mood], now })) })));
  add('Species', SPECIES_IDS.map((species) => ({ label: species, src: mini('species', `${species}.svg`, demoPet({ mood: 'happy', species, now })) })));
  add('Homes (each species lives somewhere special; set `scenery` to move)', HOMES.map((home) => ({ label: home, src: mini('homes', `${home}.svg`, demoPet({ mood: HOME_DEMO[home][1], species: HOME_DEMO[home][0], scenery: home, season: 'summer', now })) })));
  add('Vacation mode and the stats chart', [
    { label: 'vacation', src: mini('care', 'vacation.svg', demoPet({ mood: 'happy', species: 'cat', vacation: '2026-10-01..2026-10-20', now })) },
    { label: 'pet-stats.svg', src: save('care', 'stats.svg', renderStats(demoPet({ mood: 'happy', species: 'duck', now, name: 'Mochi' }), demoHistory(now), { theme: 'light' })), wide: true },
    { label: 'pet-stats.svg (dark)', src: save('care', 'stats-dark.svg', renderStats(demoPet({ mood: 'happy', species: 'duck', now, name: 'Mochi' }), demoHistory(now), { theme: 'dark' })), wide: true, dark: true },
  ]);
  add('Homes at night', HOMES.map((home) => ({ label: home, src: mini('homes', `${home}-night.svg`, demoPet({ mood: 'happy', species: HOME_DEMO[home][0], scenery: home, season: home === 'meadow' ? 'winter' : 'summer', now }), 'dark'), dark: true })));
  add('Shiny variants (1 in 64 repos)', SPECIES_IDS.map((species) => ({ label: `✨ ${species}`, src: mini('shiny', `${species}.svg`, demoPet({ mood: 'ecstatic', species, shiny: true, now })) })));
  add('Ranks (one per level tier)', RANKS.map((r) => ({ label: `${r.emoji} ${r.id} (Lv.${r.min}+)`, src: save('ranks', `${r.id}.svg`, renderBadge(demoPet({ mood: 'happy', species: 'cat', commits: (r.min - 1) ** 2, now, name: 'Mochi' }))) })));
  add('Level up and rank up', [
    { label: 'level up', src: card('ranks', 'level-up.svg', demoPet({ mood: 'happy', species: 'ninja', commits: 144, levelUp: true, now })), wide: true },
    { label: 'rank up', src: card('ranks', 'rank-up.svg', demoPet({ mood: 'ecstatic', species: 'dragon', commits: 1200, levelUp: 'rank', now })), wide: true },
    { label: 'lên hạng', src: card('ranks', 'rank-up-vi.svg', demoPet({ mood: 'party', species: 'bunny', commits: 361, levelUp: 'rank', lang: 'vi', now })), wide: true },
  ]);
  add('Evolution paths (after a week as an adult)', PATHS.map((p) => ({ label: `${p.emoji} ${p.id}`, src: mini('evolution', `${p.id}.svg`, demoPet({ mood: 'happy', species: PATH_DEMO[p.id], path: p.id, now })) })));
  add('Wardrobe (unlocked by trophies, quest stars and friends)', ITEMS.map((item, i) => ({ label: `${item.emoji} ${item.id}`, src: mini('wardrobe', `${item.id}.svg`, demoPet({ mood: 'happy', species: SPECIES_IDS[i % SPECIES_IDS.length], wear: item.id, now })) })));
  add('Quests and a dressed-up pet', [
    { label: 'card', src: card('wardrobe', 'card.svg', demoPet({ mood: 'ecstatic', species: 'cat', wear: 'cap, bird', path: 'swift', now, name: 'Mochi' })), wide: true },
    { label: 'thẻ', src: card('wardrobe', 'card-vi.svg', demoPet({ mood: 'happy', species: 'bunny', wear: 'bow, butterfly', path: 'social', lang: 'vi', now, name: 'Bánh Bao' })), wide: true },
  ]);
  add('Super form (7 ecstatic days in a row)', HERO_SQUAD.map((species) => ({ label: `💥 ${species}`, src: mini('aura', `${species}.svg`, demoPet({ mood: 'ecstatic', species, aura: true, now })) })));
  add('Languages', Object.entries(LANG_DEMO).map(([lang, species]) => ({ label: LANG_NAMES[lang], src: card('langs', `${lang}.svg`, demoPet({ mood: 'happy', species, lang, now, fullName: 'Tanx-1811/legacypet' })), wide: true })));
  add('Life stages', ['egg', 'baby', 'adult', 'elder'].map((stage) => ({ label: stage, src: mini('stages', `${stage}.svg`, demoPet({ mood: stage === 'egg' ? 'egg' : 'happy', species: 'octopus', stage, now })) })));
  add('Holidays', HOLIDAYS.map(([holiday, mood], i) => ({ label: holiday, src: mini('holidays', `${holiday}.svg`, demoPet({ mood, holiday, species: SPECIES_IDS[i + 1], season: holiday === 'christmas' ? 'winter' : 'autumn', now })) })));
  add('Every species × mood (light)', SPECIES_IDS.flatMap((species) => MOODS.map((mood) => ({ label: `${species} · ${mood}`, src: card('cards', `${species}-${mood}.svg`, demoPet({ mood, species, now })), wide: true }))));
  add('Dark mode', MOODS.map((mood) => ({ label: mood, src: card('dark', `${mood}.svg`, demoPet({ mood, species: MOOD_STARS[mood], now }), 'dark'), wide: true, dark: true })));
  add('Tiếng Việt', MOODS.map((mood) => ({ label: mood, src: card('vi', `${mood}.svg`, demoPet({ mood, species: MOOD_STARS[mood], now, lang: 'vi' })), wide: true })));

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LegacyPet gallery</title><style>
body{margin:0;padding:24px 16px;font:14px/1.5 ui-sans-serif,system-ui,sans-serif;background:#f6f8fa;color:#1f2328}
h1{margin:0 0 4px}h2{margin:32px 0 12px;font-size:18px}p{margin:0;color:#59636e}
.grid{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}figure{margin:0;text-align:center}figcaption{font-size:12px;color:#59636e}
.dark{background:#0d1117;padding:8px;border-radius:12px}img{display:block;max-width:100%}
</style></head><body><h1>🐾 LegacyPet gallery</h1><p>Generated by <code>npm run gallery</code>. Every image is an animated SVG, the same file GitHub would show.</p>
${sections.map((s) => `<h2>${s.title}</h2><div class="grid">${s.items.map((i) => `<figure${i.dark ? ' class="dark"' : ''}><img src="${i.src}" alt="${i.label}" loading="lazy"><figcaption>${i.label}</figcaption></figure>`).join('')}</div>`).join('\n')}
</body></html>`;
  write(out, 'index.html', html);
  console.log(`Wrote the gallery to ${join(out, 'index.html')}`);
}

// The app: a local server plus a window. Quits when the last window closes.
async function app() {
  const { DEFAULT_PORT, startServer } = await import('./app/server.js');
  const { openAppWindow } = await import('./app/launch.js');
  const { dataDir } = await import('./local/store.js');
  const port = Number(opts.port) || DEFAULT_PORT;
  // Already open? Just show another window of that one.
  try {
    const ping = await fetch(`http://127.0.0.1:${port}/api/ping`, { signal: AbortSignal.timeout(800) }).then((r) => r.json());
    if (ping?.app === 'legacypet') {
      const url = `http://127.0.0.1:${port}/#/home`;
      if (!opts['no-open']) openAppWindow(url, { profileDir: join(dataDir(), 'window') });
      return console.log(`🐾 LegacyPet is already running at ${url}`);
    }
  } catch { /* nothing there: start it */ }

  let server;
  const quit = async () => {
    await server?.close();
    process.exit(0);
  };
  server = await startServer({ port, onIdle: opts['no-open'] ? null : quit });
  const url = server.appUrl();
  console.log(`🐾 LegacyPet is running at ${url}`);
  console.log('   Everything stays on this computer. Press Ctrl+C to quit.');
  if (opts['no-open']) return;
  const win = openAppWindow(url, { profileDir: join(dataDir(), 'window') });
  if (win.kind === 'tab') console.log('   (Opened in your browser. Install Chrome or Edge for an app window.)');
  win.closed?.then(() => setTimeout(() => { if (!server.windows) quit(); }, 1500));
  process.on('SIGINT', quit);
  process.on('SIGTERM', quit);
}

async function main() {
  const [command, ...args] = positionals;
  if (opts.help || !command || command === 'help') return console.log(HELP);
  if (command === 'app' || command === 'desktop') return app();
  if (command === 'init') return init();
  if (command === 'adopt') return adopt(args[0]);
  if (command === 'render') return render(args[0]);
  if (command === 'park') return park(args[0], args.slice(1));
  if (command === 'demo') return demo();
  if (command === 'gallery') return gallery();
  throw new Error(`Unknown command "${command}". Run legacypet --help`);
}

main().catch((err) => {
  console.error(`✖ ${err.message}`);
  process.exitCode = 1;
});
