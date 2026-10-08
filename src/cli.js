#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  buildPet, checkup, collectPark, collectSnapshot, createClient, insertSnippet, LANG_NAMES, mockSnapshot, MOOD_EMOJI, MOODS,
  parseRemote, PLAYGROUND, renderBadge, renderCard, renderFiles, renderMini, renderPark, resolveParkRepos,
  snippetFor, HOMES, renderStats, SPECIES_IDS, terminalArt, workflowYaml,
} from './index.js';

const HELP = `
🐾 legacypet: a pixel pet that lives in your README

Usage
  legacypet init                  Adopt a pet: add the workflow and put the pet in README.md
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

  init:    --repo <owner/name>  --style card|mini|badge|park  --park auto|<repos>  --force
  park:    --size <1-8>
  demo:    --mood ${MOODS.join('|')}  --stage egg|baby|adult|elder  --shiny  --aura  --holiday <id>
  render, demo:  --vacation "until 2027-01-05"  preview the pet on vacation

Preview any repo in the browser: ${PLAYGROUND}
`;

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    species: { type: 'string', default: 'auto' },
    scenery: { type: 'string', default: 'auto' },
    vacation: { type: 'string' },
    mood: { type: 'string' },
    stage: { type: 'string' },
    shiny: { type: 'boolean' },
    aura: { type: 'boolean' },
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
    help: { type: 'boolean', short: 'h' },
  },
});

const CHECK_ICON = { good: '✔', warn: '!', bad: '✖', tip: '·' };
const token = () => opts.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

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

async function init() {
  const fullName = opts.repo ?? gitRemote();
  if (!fullName || !fullName.includes('/')) {
    throw new Error('Could not find a GitHub remote. Run this inside your repo, or pass --repo owner/name');
  }
  const [owner, name] = fullName.split('/');
  const isProfile = owner.toLowerCase() === name.toLowerCase();
  const parkSpec = opts.park ?? (isProfile ? 'auto' : '');
  const style = opts.style ?? (parkSpec ? 'park' : 'card');
  console.log(`🥚 Adopting a pet for ${fullName}${isProfile ? ' (profile README: adding a Pet Park)' : ''}\n`);

  const workflow = join('.github', 'workflows', 'legacypet.yml');
  if (existsSync(workflow) && !opts.force) {
    console.log(`• ${workflow} already exists (use --force to overwrite)`);
  } else {
    mkdirSync(dirname(workflow), { recursive: true });
    writeFileSync(workflow, workflowYaml({ lang: opts.lang, species: opts.species, scenery: opts.scenery, name: opts.name, park: parkSpec }));
    console.log(`✔ Created ${workflow}`);
  }

  const snippet = snippetFor(fullName, style);
  const readme = readdirSync('.').find((f) => /^readme\.md$/i.test(f));
  if (readme) {
    const before = readFileSync(readme, 'utf8');
    const after = insertSnippet(before, snippet);
    if (after === before) console.log(`• ${readme} already shows your pet`);
    else {
      writeFileSync(readme, after);
      console.log(`✔ Added your pet to ${readme}`);
    }
  } else {
    console.log(`• No README.md here. Paste this where you want your pet:\n\n  ${snippet}\n`);
  }

  try {
    const { pet, snapshot } = await visit(fullName);
    console.log('\n🔮 Here is who will hatch:');
    show(pet, snapshot);
  } catch (err) {
    console.log(`\n(Preview skipped: ${err.message.split('\n')[0]})`);
  }

  console.log(`
Next steps
  1. git add ${workflow.replace(/\\/g, '/')} ${readme ?? ''} && git commit -m "Adopt a LegacyPet 🐾" && git push
  2. On GitHub: Actions → LegacyPet → Run workflow (or wait for the schedule)
  3. Refresh your README. Say hi to your pet!`);
}

function demoPet({ mood = 'happy', species = 'auto', scenery, vacation, stage, shiny, aura, holiday = null, season, lang = 'en', name, fullName, now = new Date() }) {
  const snapshot = mockSnapshot({ mood, stage: stage ?? 'adult', now, fullName });
  return buildPet({ snapshot, now, options: { species, scenery, vacation, mood, stage, shiny: shiny ?? false, aura: aura ?? false, holiday, season, lang, name } });
}

function demo() {
  const pet = demoPet({
    mood: opts.mood ?? 'happy', species: opts.species, scenery: opts.scenery, vacation: opts.vacation, stage: opts.stage, shiny: opts.shiny, aura: opts.aura,
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

async function main() {
  const [command, ...args] = positionals;
  if (opts.help || !command || command === 'help') return console.log(HELP);
  if (command === 'init') return init();
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
