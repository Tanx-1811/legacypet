// GitHub Action entry point. Reads inputs from INPUT_* env vars (no @actions/core needed).
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  answerCommand, buildPet, checkup, collectPark, collectSnapshot, commandFromEvent, createClient, HOMEPAGE, loadPrevious,
  MOOD_EMOJI, moodStrip, nextState, parkSummary, petUrls, publishFiles, renderFiles, renderPark, resolveParkRepos, snippetFor,
  VERSION, whatsNew, activeVacation, parseAlerts, syncAlert,
} from './index.js';
import { questLines } from './github/command.js';
import { strings } from './i18n/index.js';

const CHECK_ICON = { good: '✅', warn: '⚠️', bad: '❌', tip: '💡' };

const input = (name, fallback = '') => {
  const value = process.env[`INPUT_${name.toUpperCase()}`];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
};
const flag = (name, fallback) => ['true', '1', 'yes', 'on'].includes(input(name, String(fallback)).toLowerCase());
// Workflow commands are single-line; newlines must be URL-encoded.
const command = (kind, message) => console.log(`::${kind}::${String(message).replace(/%/g, '%25').replace(/\r?\n/g, '%0A')}`);
const warn = (message) => command('warning', message);

function setOutputs(outputs) {
  if (!process.env.GITHUB_OUTPUT) return;
  const lines = Object.entries(outputs).map(([key, value]) => {
    const text = String(value);
    return text.includes('\n') ? `${key}<<LEGACYPET_EOF\n${text}\nLEGACYPET_EOF` : `${key}=${text}`;
  });
  appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
}

// The workflow file that is running right now, to see whether it already has what new features need.
async function currentWorkflow(client, owner, repo) {
  const match = /\.github\/workflows\/([^@]+)@/.exec(process.env.GITHUB_WORKFLOW_REF ?? '');
  if (!match || process.env.GITHUB_REPOSITORY?.toLowerCase() !== `${owner}/${repo}`.toLowerCase()) return null;
  try {
    const file = await client.get(`/repos/${owner}/${repo}/contents/.github/workflows/${encodeURIComponent(match[1])}`);
    return Buffer.from(file.content ?? '', 'base64').toString('utf8');
  } catch {
    return null;
  }
}

// Tells the owner about releases since the pet's last run: an annotation on the run page
// and a section in the job summary. Pinned to `@v1`, they get the code automatically;
// this is how they hear about it, and about workflow changes a feature needs.
async function announceUpdates(client, { owner, repo, prevState }) {
  const fresh = whatsNew(prevState);
  if (!fresh.length) return '';
  const yaml = fresh.some((e) => e.workflow) ? await currentWorkflow(client, owner, repo) : null;
  const todo = fresh.filter((e) => e.workflow && yaml != null && !e.workflow.test(yaml));
  command('notice', `🐾 LegacyPet updated to v${VERSION}: ${fresh.flatMap((e) => e.items).length} new things. See the job summary.${todo.length ? ' One step is needed to unlock everything.' : ''}`);
  return [
    `### 🆕 What's new in LegacyPet v${VERSION}`,
    '',
    ...fresh.flatMap((e) => e.items.map((item) => `- ${item}`)),
    '',
    ...(todo.length
      ? ['> [!TIP]', ...todo.map((e) => `> ${e.workflow.why}`),
        '> Update your workflow from [the example](https://github.com/Tanx-1811/legacypet/blob/main/examples/legacypet.yml), or run `npx github:Tanx-1811/legacypet init --force`.', '']
      : []),
  ].join('\n');
}

function writeSummary(pet, snapshot, { branch, published, dryRun, parkPets, prevState, news }) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const tr = strings(pet.lang);
  const v = pet.vitals;
  const urls = petUrls(pet.repo.fullName, branch);
  const head = ['fullness', 'health', 'joy', 'energy', 'hygiene'].filter((k) => v[k] != null);
  const park = parkPets?.length ? parkSummary(parkPets) : null;
  const md = [
    `## 🐾 ${pet.displayName}`,
    '',
    `${MOOD_EMOJI[pet.mood]} **${pet.rank.emoji} ${tr.level(pet.level)} ${tr.kind(tr.stages[pet.stage], tr.species[pet.speciesId])}**, ${tr.moods[pet.mood]}${pet.shiny ? ' ✨' : ''}`,
    '',
    `> ${pet.speech}`,
    '',
    `| ${head.map((k) => tr.stats[k]).join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    `| ${head.map((k) => v[k]).join(' | ')} |`,
    '',
    `📈 ${moodStrip(nextState(pet, prevState).history)}`,
    '',
    pet.vacation ? `🏖️ ${tr.checkup.vacation(pet.vacation.until)}
` : '',
    pet.alert && !pet.alert.muted ? `🚨 Care alert: #${pet.alert.issue}
` : '',
    pet.newAchievements.length ? `🏆 New: ${pet.achievements.filter((a) => a.isNew).map((a) => `${a.emoji} ${tr.achievements[a.id]}`).join(', ')}\n` : '',
    news ?? '',
    pet.quests.list.length ? `### 📜 ${tr.questBoard.title} · ⭐ ${pet.questStars}\n\n${questLines(pet, tr).join('\n')}\n` : '',
    '### 🩺 Checkup',
    '',
    ...checkup(pet, snapshot).map((item) => `- ${CHECK_ICON[item.level]} ${item.icon} ${item.text}`),
    '',
    ...(park
      ? [`### 🏞️ Pet Park: ${parkPets.length} pets, park health ${park.health}%`, '',
        ...parkPets.map((p) => `- ${MOOD_EMOJI[p.mood]} **${p.name}** · [${p.repo.fullName}](https://github.com/${p.repo.fullName}) · ${tr.level(p.level)} · ${tr.moods[p.mood]}`), '']
      : []),
    dryRun ? '_Dry run: nothing was published._' : published ? `Published to the \`${branch}\` branch.` : 'Nothing changed since the last run.',
    '',
    '### Show it in your README',
    '',
    '```md',
    snippetFor(pet.repo.fullName, park ? 'park' : 'card', branch),
    '```',
    '',
    'Also available: `pet-mini.svg` (compact card) and `pet-badge.svg` (badge):',
    '',
    '```md',
    snippetFor(pet.repo.fullName, 'badge', branch),
    '```',
    '',
    dryRun ? '' : `![pet](${park ? urls.park : urls.card})`,
    dryRun ? '' : `
![stats](${urls.stats})`,
    '',
    `<sub>Made with [LegacyPet](${HOMEPAGE})</sub>`,
  ].join('\n');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
}

// GitHub pauses scheduled workflows after 60 days without repo activity, which would
// freeze a neglected pet before it ever turns into a zombie. Re-enabling the workflow
// (a no-op when it's already on) keeps the schedule alive. Needs `actions: write`.
async function keepAlive(client, owner, repo) {
  const match = /\.github\/workflows\/([^@]+)@/.exec(process.env.GITHUB_WORKFLOW_REF ?? '');
  if (!match || process.env.GITHUB_REPOSITORY?.toLowerCase() !== `${owner}/${repo}`.toLowerCase()) return;
  try {
    await client.request('PUT', `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(match[1])}/enable`);
  } catch (err) {
    warn(`Keepalive skipped (${err.status ?? err.message}). Add \`actions: write\` to the workflow permissions so GitHub's 60-day inactivity rule can't pause your pet.`);
  }
}

// On `issue_comment` events the action only wakes up for `/pet` commands.
function commentEvent() {
  const name = process.env.GITHUB_EVENT_NAME;
  if (name !== 'issue_comment') return null;
  let event = null;
  try {
    event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  } catch {
    event = null;
  }
  return { request: commandFromEvent(name, event) };
}

async function main() {
  const comment = commentEvent();
  if (comment && (!comment.request || !flag('commands', true))) {
    console.log('💬 Not a /pet command. Nothing to do.');
    return;
  }

  const repository = input('repository', process.env.GITHUB_REPOSITORY ?? '');
  const [owner, repo] = repository.split('/');
  if (!owner || !repo) throw new Error(`"repository" must look like owner/name, got "${repository}"`);

  const token = input('github-token', process.env.GITHUB_TOKEN ?? '');
  const branch = input('branch', 'legacypet');
  const theme = input('theme', 'auto');
  const dryRun = flag('dry-run', false);
  const keepDiary = flag('diary', true);
  const outputDir = input('output-dir', 'legacypet-out');
  const ignoreChecks = [process.env.GITHUB_JOB, ...input('ignore-checks').split(',').map((s) => s.trim())];
  const options = {
    species: input('species', 'auto'), scenery: input('scenery', 'auto'), name: input('name'), lang: input('lang', 'en'),
    color: input('color'), motto: input('motto'),
    vacation: input('vacation'),
    wear: input('wear') || undefined,
  };
  const alertMoods = parseAlerts(input('alerts', 'false'));
  // `/pet vacation 14` and `/pet back` change the pet's memory, so only maintainers may use them.
  const request = comment?.request;
  if (request?.maintainer && (request.command === 'vacation' || request.command === 'back')) {
    options.vacationCommand = { name: request.command, days: request.days };
  }
  // Snacks, games and pats are for everyone; dressing the pet up is for maintainers.
  if (request && ['feed', 'play', 'pat'].includes(request.command)) options.care = { name: request.command, user: request.user };
  if (request?.maintainer && request.command === 'wear') options.wearCommand = request.arg ?? 'none';

  const client = createClient({ token });
  const now = new Date();
  console.log(`🐾 Visiting the pet of ${owner}/${repo}...`);

  const snapshot = await collectSnapshot(client, { owner, repo, now, ignoreChecks });
  snapshot.warnings.forEach(warn);

  let previous = { state: null, diary: null };
  try {
    previous = await loadPrevious(client, { owner, repo, branch });
  } catch (err) {
    warn(`Could not read the pet's memory from "${branch}": ${err.message}`);
  }

  const pet = buildPet({ snapshot, prevState: previous.state, options, now });
  const wasOnVacation = Boolean(activeVacation(previous.state?.vacations ?? [], pet.date));
  if (pet.vacation) console.log(`🏖️ On vacation until ${pet.vacation.until}: hunger is paused.`);
  for (const [id, why] of pet.wardrobe.rejected) warn(`Can't wear "${id}": ${why === 'locked' ? 'not unlocked yet (see /pet wardrobe)' : 'no such item'}.`);
  if (pet.path) console.log(`🧬 ${pet.events.includes('evolved') ? 'Evolved into' : 'Path:'} ${pet.path.emoji} ${pet.path.id}`);
  if (pet.quests.fresh.length) console.log(`📜 Quests done: ${pet.quests.fresh.join(', ')} (⭐ ${pet.questStars})`);

  // Care alerts run before publishing so pet.json remembers the issue they opened.
  if (alertMoods && !dryRun) {
    try {
      pet.alert = await syncAlert(client, {
        owner, repo, pet, snapshot, moods: alertMoods, prev: previous.state?.alert, prevMood: previous.state?.lastMood,
        cardUrl: `${petUrls(pet.repo.fullName, branch).card}?d=${pet.date}`,
      });
      if (pet.alert && !pet.alert.muted) console.log(`🚨 Care alert: #${pet.alert.issue}`);
    } catch (err) {
      warn(`Could not update the care alert (${err.status ?? err.message}). Alerts need \`issues: write\` in the workflow permissions.`);
    }
  }

  // Pet Park: visit several repos (e.g. from a profile README repo) and draw them together.
  let parkPets = [];
  const parkSpec = input('park');
  if (parkSpec) {
    const repos = await resolveParkRepos(client, { owner, spec: parkSpec, size: input('park-size', '6') });
    console.log(`🏞️ Visiting ${repos.length} repos for the Pet Park: ${repos.join(', ')}`);
    parkPets = await collectPark(client, { repos, now, lang: options.lang, branch, onWarning: warn });
    if (!parkPets.length) warn('The Pet Park is empty: none of its repos could be read.');
  }
  const park = parkPets.length ? renderPark(parkPets, { owner, lang: options.lang, theme }) : null;
  const files = renderFiles(pet, snapshot, {
    theme, prevState: previous.state, previousDiary: previous.diary, diary: keepDiary, branch, park,
  });

  mkdirSync(outputDir, { recursive: true });
  for (const file of files) writeFileSync(join(outputDir, file.path), file.content);

  const v = pet.vitals;
  console.log(`${MOOD_EMOJI[pet.mood]} ${pet.displayName} · ${pet.rank.emoji} Lv.${pet.level} ${pet.stage} ${pet.speciesId} · ${pet.mood}`);
  console.log(`   fullness ${v.fullness} · health ${v.health} · joy ${v.joy} · energy ${v.energy}${v.hygiene != null ? ` · hygiene ${v.hygiene}` : ''}`);
  console.log(`   “${pet.speech}”`);

  let published = false;
  if (!dryRun) {
    try {
      const result = await publishFiles(client, {
        owner, repo, branch, files,
        message: `🐾 ${pet.name} is ${pet.mood} (Lv.${pet.level}) [skip ci]`,
      });
      published = result.changed;
      console.log(result.changed ? `📦 Published to ${branch} (${result.sha.slice(0, 7)})` : '📦 Nothing changed');
    } catch (err) {
      if (err.status === 403 || err.status === 404) {
        throw new Error(`${err.message}\nLegacyPet needs \`permissions: contents: write\` in your workflow to publish the pet.`);
      }
      throw err;
    }
  }

  if (!dryRun && flag('keepalive', true)) await keepAlive(client, owner, repo);

  if (comment?.request) {
    try {
      const run = process.env.GITHUB_RUN_ID ?? Date.now();
      const cardUrl = dryRun ? null : `${petUrls(pet.repo.fullName, branch).card}?run=${run}`;
      const miniUrl = dryRun ? null : `${petUrls(pet.repo.fullName, branch).mini}?run=${run}`;
      await answerCommand(client, { owner, repo, request: comment.request, pet, snapshot, cardUrl, miniUrl, wasOnVacation });
      console.log(`💬 Answered /pet ${comment.request.command} on #${comment.request.issue}`);
    } catch (err) {
      warn(`Could not answer the /pet command (${err.status ?? err.message}). Add \`issues: write\` and \`pull-requests: write\` to the workflow permissions.`);
    }
  }

  const news = await announceUpdates(client, { owner, repo, prevState: previous.state });
  const previousMood = previous.state?.lastMood ?? '';
  setOutputs({
    mood: pet.mood, name: pet.name, level: pet.level, species: pet.speciesId, color: pet.tint?.id ?? 'auto',
    stage: pet.stage, speech: pet.speech, 'svg-path': join(outputDir, 'pet.svg'),
    'previous-mood': previousMood,
    'mood-changed': Boolean(previousMood) && previousMood !== pet.mood,
    aura: pet.aura,
    'new-trophies': pet.newAchievements.join(','),
    'level-up': pet.events.includes('levelUp'),
    rank: pet.rank.id,
    'on-vacation': Boolean(pet.vacation),
    'alert-issue': pet.alert && !pet.alert.muted ? pet.alert.issue : '',
    path: pet.path?.id ?? '',
    'quest-stars': pet.questStars,
    'quests-done': pet.quests.list.filter((q) => q.done).map((q) => q.id).join(','),
    wearing: pet.wardrobe.worn.join(','),
  });
  writeSummary(pet, snapshot, { branch, published, dryRun, parkPets, prevState: previous.state, news });
}

main().catch((err) => {
  command('error', err.message);
  process.exitCode = 1;
});
