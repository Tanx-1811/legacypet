import { MOOD_EMOJI } from './engine/mood.js';
import { moodStrip, nextState, updateDiary } from './engine/memory.js';
import { strings } from './i18n/index.js';
import { BADGE_COLORS, renderBadge } from './render/badge.js';
import { renderCard } from './render/card.js';
import { renderMini } from './render/mini.js';
import { renderStats } from './render/stats.js';
import { snippetFor } from './setup.js';

export const HOMEPAGE = 'https://github.com/Tanx-1811/legacypet';
export const PLAYGROUND = 'https://tanx-1811.github.io/legacypet/';

export { buildPet } from './engine/pet.js';
export { checkup } from './engine/checkup.js';
export { AURA_DAYS, MOODS, MOOD_EMOJI } from './engine/mood.js';
export { ACHIEVEMENTS } from './engine/achievements.js';
export { QUESTS, QUEST_IDS, weekOf } from './engine/quests.js';
export { PATHS, PATH_IDS, pathScores, EVOLVE_AFTER_DAYS } from './engine/evolution.js';
export { ITEMS, ITEM_IDS, SLOTS, isUnlocked } from './engine/items.js';
export { COLOR_IDS, MOTTO_MAX, PET_COLORS, cleanMotto, parseColor } from './engine/look.js';
export { NAME_PARTS, petName, randomName } from './engine/identity.js';
export { CARE_ACTIONS, careBonus, topFriends } from './engine/care.js';
export { levelProgress, MAX_LEVEL, RANKS, rankFor } from './engine/rank.js';
export { nextState, updateDiary, diaryEntry, moodStrip } from './engine/memory.js';
export { HOMES, SPECIES, SPECIES_IDS } from './sprites/index.js';
export { LANGS, LANG_NAMES } from './i18n/index.js';
export { createClient, GitHubError } from './github/client.js';
export { collectSnapshot } from './github/collect.js';
export { loadPrevious, publishFiles } from './github/publish.js';
export { collectPark, resolveParkRepos } from './github/park.js';
export { adoptRepo, hasPet, listRepos, parseSelection, WORKFLOW_PATH } from './github/repos.js';
export { answerCommand, commandArg, commandFromEvent, commandReply, COMMANDS, parseCommand, questLines, unlockHint } from './github/command.js';
export { ALERT_MOODS, alertIssue, parseAlerts, syncAlert } from './github/alerts.js';
export { activeVacation, parseVacation, resolveVacations } from './engine/vacation.js';
export { mockSnapshot } from './mock.js';
export { CHANGELOG, VERSION, whatsNew } from './whatsnew.js';
export { renderCard, renderMini, renderBadge, renderStats };
export { PARK_MAX, renderPark, parkSummary } from './render/park.js';
export { terminalArt } from './render/terminal.js';
export { adoptUrl, insertSnippet, parseRemote, snippetFor, workflowYaml } from './setup.js';

export function petUrls(fullName, branch = 'legacypet') {
  const raw = `https://raw.githubusercontent.com/${fullName}/${branch}`;
  return {
    card: `${raw}/pet.svg`,
    mini: `${raw}/pet-mini.svg`,
    badge: `${raw}/pet-badge.svg`,
    park: `${raw}/park.svg`,
    shields: `${raw}/pet-shields.json`,
    stats: `${raw}/pet-stats.svg`,
    diary: `https://github.com/${fullName}/blob/${branch}/DIARY.md`,
  };
}

export const readmeSnippet = (fullName, branch = 'legacypet', style = 'card') => snippetFor(fullName, style, branch);

// A shields.io endpoint (https://shields.io/badges/endpoint-badge), for READMEs
// that want the pet's mood in the same style as the rest of their badges.
export function shieldsJson(pet) {
  const tr = strings(pet.lang);
  return {
    schemaVersion: 1,
    label: pet.name,
    message: `${MOOD_EMOJI[pet.mood]} ${tr.moods[pet.mood]} · ${tr.level(pet.level)}`,
    color: BADGE_COLORS[pet.mood].slice(1),
    labelColor: '2f343b',
  };
}

function branchReadme(pet, branch, hasPark, state) {
  const tr = strings(pet.lang);
  const name = pet.repo.fullName;
  const shields = `https://img.shields.io/endpoint?url=${encodeURIComponent(petUrls(name, branch).shields)}`;
  return [
    `# 🐾 ${pet.displayName}`,
    '',
    `${MOOD_EMOJI[pet.mood]} ${tr.level(pet.level)} ${tr.kind(tr.stages[pet.stage], tr.species[pet.speciesId])}, ${tr.moods[pet.mood]}.`,
    '',
    '![pet](pet.svg)',
    '',
    '![stats](pet-stats.svg)',
    '',
    `**Mood, last ${Math.min(14, state.history.length)} days:** ${moodStrip(state.history)}`,
    '',
    `This branch is rewritten on every run by [LegacyPet](${HOMEPAGE}). Please don't edit it by hand.`,
    '',
    '| File | What it is | Markdown |',
    '| --- | --- | --- |',
    `| \`pet.svg\` | The full card | \`${snippetFor(name, 'card', branch)}\` |`,
    `| \`pet-mini.svg\` | A compact card for profiles and sidebars | \`${snippetFor(name, 'mini', branch)}\` |`,
    `| \`pet-badge.svg\` | A badge for the top of your README | \`${snippetFor(name, 'badge', branch)}\` |`,
    `| \`pet-stats.svg\` | Vitals and moods over the last 30 days | \`![stats](${petUrls(name, branch).stats})\` |`,
    `| \`pet-shields.json\` | A [shields.io endpoint](https://shields.io/badges/endpoint-badge) | \`![pet](${shields})\` |`,
    ...(hasPark ? [`| \`park.svg\` | Every pet from your repos together | \`${snippetFor(name, 'park', branch)}\` |`] : []),
    '| `pet.json` | The pet\'s memory: vitals, trophies and mood history | |',
    '| `DIARY.md` | One diary entry per day | |',
    '',
  ].join('\n');
}

// Everything that gets published to the pet's branch.
export function renderFiles(pet, snapshot, {
  theme = 'auto', prevState = null, previousDiary = null, diary = true, branch = 'legacypet', park = null,
} = {}) {
  const state = nextState(pet, prevState);
  const files = [
    { path: 'pet.svg', content: renderCard(pet, { theme }) },
    { path: 'pet-mini.svg', content: renderMini(pet, { theme }) },
    { path: 'pet-badge.svg', content: renderBadge(pet) },
    { path: 'pet-stats.svg', content: renderStats(pet, state.history, { theme }) },
    { path: 'pet-shields.json', content: `${JSON.stringify(shieldsJson(pet))}\n` },
    { path: 'pet.json', content: `${JSON.stringify(state, null, 2)}\n` },
    { path: 'README.md', content: branchReadme(pet, branch, Boolean(park), state) },
  ];
  if (park) files.push({ path: 'park.svg', content: park });
  if (diary) files.push({ path: 'DIARY.md', content: updateDiary(previousDiary, pet, snapshot) });
  return files;
}
