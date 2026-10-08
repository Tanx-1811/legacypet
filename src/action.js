// GitHub Action entry point. Reads inputs from INPUT_* env vars (no @actions/core needed).
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  answerCommand, buildPet, checkup, collectPark, collectSnapshot, commandFromEvent, createClient, HOMEPAGE, loadPrevious,
  MOOD_EMOJI, moodStrip, nextState, parkSummary, petUrls, publishFiles, renderFiles, renderPark, resolveParkRepos, snippetFor,
} from './index.js';
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

function writeSummary(pet, snapshot, { branch, published, dryRun, parkPets, prevState }) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const tr = strings(pet.lang);
  const v = pet.vitals;
  const urls = petUrls(pet.repo.fullName, branch);
  const head = ['fullness', 'health', 'joy', 'energy', 'hygiene'].filter((k) => v[k] != null);
  const park = parkPets?.length ? parkSummary(parkPets) : null;
  const md = [
    `## 🐾 ${pet.displayName}`,
    '',
    `${MOOD_EMOJI[pet.mood]} **${tr.level(pet.level)} ${tr.kind(tr.stages[pet.stage], tr.species[pet.speciesId])}**, ${tr.moods[pet.mood]}${pet.shiny ? ' ✨' : ''}`,
    '',
    `> ${pet.speech}`,
    '',
    `| ${head.map((k) => tr.stats[k]).join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    `| ${head.map((k) => v[k]).join(' | ')} |`,
    '',
    `📈 ${moodStrip(nextState(pet, prevState).history)}`,
    '',
    pet.newAchievements.length ? `🏆 New: ${pet.achievements.filter((a) => a.isNew).map((a) => `${a.emoji} ${tr.achievements[a.id]}`).join(', ')}\n` : '',
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
  const options = { species: input('species', 'auto'), name: input('name'), lang: input('lang', 'en') };

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
  console.log(`${MOOD_EMOJI[pet.mood]} ${pet.displayName} · Lv.${pet.level} ${pet.stage} ${pet.speciesId} · ${pet.mood}`);
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
      const cardUrl = dryRun ? null : `${petUrls(pet.repo.fullName, branch).card}?run=${process.env.GITHUB_RUN_ID ?? Date.now()}`;
      await answerCommand(client, { owner, repo, request: comment.request, pet, snapshot, cardUrl });
      console.log(`💬 Answered /pet ${comment.request.command} on #${comment.request.issue}`);
    } catch (err) {
      warn(`Could not answer the /pet command (${err.status ?? err.message}). Add \`issues: write\` and \`pull-requests: write\` to the workflow permissions.`);
    }
  }

  const previousMood = previous.state?.lastMood ?? '';
  setOutputs({
    mood: pet.mood, name: pet.name, level: pet.level, species: pet.speciesId,
    stage: pet.stage, speech: pet.speech, 'svg-path': join(outputDir, 'pet.svg'),
    'previous-mood': previousMood,
    'mood-changed': Boolean(previousMood) && previousMood !== pet.mood,
    aura: pet.aura,
    'new-trophies': pet.newAchievements.join(','),
  });
  writeSummary(pet, snapshot, { branch, published, dryRun, parkPets, prevState: previous.state });
}

main().catch((err) => {
  command('error', err.message);
  process.exitCode = 1;
});
