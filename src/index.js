import { MOOD_EMOJI } from './engine/mood.js';
import { nextState, updateDiary } from './engine/memory.js';
import { strings } from './i18n/index.js';
import { renderBadge } from './render/badge.js';
import { renderCard } from './render/card.js';
import { renderMini } from './render/mini.js';
import { snippetFor } from './setup.js';

export const HOMEPAGE = 'https://github.com/Tanx-1811/legacypet';
export const PLAYGROUND = 'https://tanx-1811.github.io/legacypet/';

export { buildPet } from './engine/pet.js';
export { checkup } from './engine/checkup.js';
export { MOODS, MOOD_EMOJI } from './engine/mood.js';
export { ACHIEVEMENTS } from './engine/achievements.js';
export { nextState, updateDiary, diaryEntry } from './engine/memory.js';
export { SPECIES, SPECIES_IDS } from './sprites/index.js';
export { LANGS } from './i18n/index.js';
export { createClient, GitHubError } from './github/client.js';
export { collectSnapshot } from './github/collect.js';
export { loadPrevious, publishFiles } from './github/publish.js';
export { collectPark, resolveParkRepos } from './github/park.js';
export { mockSnapshot } from './mock.js';
export { renderCard, renderMini, renderBadge };
export { renderPark, parkSummary } from './render/park.js';
export { terminalArt } from './render/terminal.js';
export { insertSnippet, parseRemote, snippetFor, workflowYaml } from './setup.js';

export function petUrls(fullName, branch = 'legacypet') {
  const raw = `https://raw.githubusercontent.com/${fullName}/${branch}`;
  return {
    card: `${raw}/pet.svg`,
    mini: `${raw}/pet-mini.svg`,
    badge: `${raw}/pet-badge.svg`,
    park: `${raw}/park.svg`,
    diary: `https://github.com/${fullName}/blob/${branch}/DIARY.md`,
  };
}

export const readmeSnippet = (fullName, branch = 'legacypet', style = 'card') => snippetFor(fullName, style, branch);

function branchReadme(pet, branch, hasPark) {
  const tr = strings(pet.lang);
  const name = pet.repo.fullName;
  return [
    `# 🐾 ${pet.displayName}`,
    '',
    `${MOOD_EMOJI[pet.mood]} ${tr.level(pet.level)} ${tr.kind(tr.stages[pet.stage], tr.species[pet.speciesId])}, ${tr.moods[pet.mood]}.`,
    '',
    '![pet](pet.svg)',
    '',
    `This branch is rewritten on every run by [LegacyPet](${HOMEPAGE}). Please don't edit it by hand.`,
    '',
    '| File | What it is | Markdown |',
    '| --- | --- | --- |',
    `| \`pet.svg\` | The full card | \`${snippetFor(name, 'card', branch)}\` |`,
    `| \`pet-mini.svg\` | A compact card for profiles and sidebars | \`${snippetFor(name, 'mini', branch)}\` |`,
    `| \`pet-badge.svg\` | A badge for the top of your README | \`${snippetFor(name, 'badge', branch)}\` |`,
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
  const files = [
    { path: 'pet.svg', content: renderCard(pet, { theme }) },
    { path: 'pet-mini.svg', content: renderMini(pet, { theme }) },
    { path: 'pet-badge.svg', content: renderBadge(pet) },
    { path: 'pet.json', content: `${JSON.stringify(nextState(pet, prevState), null, 2)}\n` },
    { path: 'README.md', content: branchReadme(pet, branch, Boolean(park)) },
  ];
  if (park) files.push({ path: 'park.svg', content: park });
  if (diary) files.push({ path: 'DIARY.md', content: updateDiary(previousDiary, pet, snapshot) });
  return files;
}
