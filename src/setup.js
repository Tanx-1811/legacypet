// Helpers for `legacypet init` and the web playground: they write the workflow
// file and the README snippet so adopting a pet takes one command.

export const ACTION_REF = 'Tanx-1811/legacypet@v1';
export const MARK_START = '<!-- legacypet:start -->';
export const MARK_END = '<!-- legacypet:end -->';

const FILES = { card: 'pet.svg', mini: 'pet-mini.svg', badge: 'pet-badge.svg', park: 'park.svg' };

export function parseRemote(url) {
  const match = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(String(url ?? '').trim());
  return match ? `${match[1]}/${match[2]}` : null;
}

export function snippetFor(fullName, style = 'card', branch = 'legacypet') {
  const file = FILES[style] ?? FILES.card;
  return `[![LegacyPet](https://raw.githubusercontent.com/${fullName}/${branch}/${file})](https://github.com/${fullName}/blob/${branch}/DIARY.md)`;
}

export function workflowYaml({ lang = 'en', species = 'auto', scenery = 'auto', name = '', park = '', wear = '', alerts = '', vacation = '' } = {}) {
  const inputs = [];
  if (lang && lang !== 'en') inputs.push(`lang: ${lang}`);
  if (species && species !== 'auto') inputs.push(`species: ${species}`);
  if (scenery && scenery !== 'auto') inputs.push(`scenery: ${scenery}`);
  if (name) inputs.push(`name: ${JSON.stringify(name)}`);
  if (park) inputs.push(`park: ${park}`);
  if (wear) inputs.push(`wear: ${JSON.stringify(wear)}`);
  if (alerts) inputs.push(`alerts: ${alerts}`);
  if (vacation) inputs.push(`vacation: ${JSON.stringify(vacation)}`);
  return [
    'name: LegacyPet',
    '',
    'on:',
    '  schedule:',
    "    - cron: '17 */6 * * *' # check on the pet four times a day",
    '  release:',
    '    types: [published] # throw a party the moment you ship',
    '  issue_comment:',
    '    types: [created] # talk to your pet: /pet, /pet feed, /pet play, /pet quests',
    '  workflow_dispatch:',
    '',
    'permissions:',
    '  contents: write # publish the pet to the `legacypet` branch',
    '  actions: write # keep the schedule alive while the repo sleeps',
    '  issues: write # answer /pet in issues',
    '  pull-requests: write # ...and in pull requests',
    '  checks: read',
    '  statuses: read',
    '',
    'jobs:',
    '  legacypet:',
    "    if: github.event_name != 'issue_comment' || startsWith(github.event.comment.body, '/pet')",
    '    runs-on: ubuntu-latest',
    '    steps:',
    `      - uses: ${ACTION_REF}`,
    ...(inputs.length ? ['        with:', ...inputs.map((line) => `          ${line}`)] : []),
    '',
  ].join('\n');
}

// Puts the snippet between markers so re-running init updates it instead of duplicating it.
export function insertSnippet(readme, snippet) {
  const block = `${MARK_START}\n${snippet}\n${MARK_END}`;
  const existing = /<!-- legacypet:start -->[\s\S]*?<!-- legacypet:end -->/;
  if (existing.test(readme)) return readme.replace(existing, () => block);
  const lines = readme.split('\n');
  const heading = lines.findIndex((line) => /^#\s/.test(line));
  if (heading === -1) return `${block}\n\n${readme}`;
  lines.splice(heading + 1, 0, '', block);
  return lines.join('\n');
}
