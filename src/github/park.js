import { buildPet } from '../engine/pet.js';
import { PARK_MAX } from '../render/park.js';
import { collectSnapshot } from './collect.js';
import { loadPrevious } from './publish.js';

// "auto" picks the owner's best public repos: no forks, no profile repo, most stars first.
export async function resolveParkRepos(client, { owner, spec = 'auto', size = 6 }) {
  const max = Math.max(1, Math.min(PARK_MAX, Number(size) || 6));
  if (spec && spec !== 'auto') {
    const names = spec.split(/[\s,]+/).filter(Boolean).map((r) => (r.includes('/') ? r : `${owner}/${r}`));
    return [...new Set(names)].slice(0, PARK_MAX);
  }
  const repos = await client.get(`/users/${owner}/repos`, { query: { per_page: 100, sort: 'pushed', type: 'owner' } });
  return (repos ?? [])
    .filter((r) => !r.fork && r.name.toLowerCase() !== owner.toLowerCase())
    .sort((a, b) => b.stargazers_count - a.stargazers_count || Date.parse(b.pushed_at) - Date.parse(a.pushed_at))
    .slice(0, max)
    .map((r) => r.full_name);
}

// Visits every repo in the park. Repos that already have a LegacyPet keep its
// name, species and trophies; repos that fail to load are skipped, not fatal.
export async function collectPark(client, { repos, now = new Date(), lang = 'en', branch = 'legacypet', onWarning = () => {} }) {
  const pets = [];
  for (const fullName of repos) {
    const [owner, repo] = fullName.split('/');
    try {
      const snapshot = await collectSnapshot(client, { owner, repo, now });
      const previous = await loadPrevious(client, { owner, repo, branch }).catch(() => ({ state: null }));
      const known = previous.state?.pet;
      pets.push(buildPet({
        snapshot,
        prevState: previous.state,
        now,
        options: { lang, species: known?.species, name: known?.name },
      }));
    } catch (err) {
      onWarning(`Skipped ${fullName} in the park: ${err.message}`);
    }
  }
  return pets;
}
