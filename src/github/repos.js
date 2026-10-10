// Picking repos and adopting a pet in them straight through the API: no clone, no
// push. Used by `legacypet adopt` and by the playground's repo picker.

import { insertSnippet, snippetFor, workflowYaml } from '../setup.js';

export const WORKFLOW_PATH = '.github/workflows/legacypet.yml';
const PET_BRANCH = 'legacypet';

const brief = (r) => ({
  fullName: r.full_name,
  name: r.name,
  owner: r.owner?.login ?? r.full_name.split('/')[0],
  description: r.description ?? '',
  isPrivate: Boolean(r.private),
  fork: Boolean(r.fork),
  archived: Boolean(r.archived),
  stars: r.stargazers_count ?? 0,
  language: r.language ?? null,
  pushedAt: r.pushed_at ?? null,
  defaultBranch: r.default_branch ?? 'main',
  canPush: r.permissions ? Boolean(r.permissions.push || r.permissions.admin) : null,
});

// With an owner: their public repos (an org's, or a user's). Without one: every repo
// the token can see, private ones included. Most recently pushed first.
export async function listRepos(client, { owner, limit = 100 } = {}) {
  const query = { sort: 'pushed', per_page: Math.min(100, limit) };
  let data;
  if (!owner) {
    data = await client.get('/user/repos', { query: { ...query, affiliation: 'owner,collaborator,organization_member' } });
  } else {
    try {
      data = await client.get(`/users/${owner}/repos`, { query: { ...query, type: 'owner' } });
    } catch (err) {
      if (err.status !== 404) throw err;
      data = await client.get(`/orgs/${owner}/repos`, { query });
    }
  }
  return data.slice(0, limit).map(brief).sort((a, b) => String(b.pushedAt).localeCompare(String(a.pushedAt)));
}

export async function hasPet(client, fullName) {
  try {
    await client.get(`/repos/${fullName}/branches/${PET_BRANCH}`);
    return true;
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}

// "1,3,5-7", "all", or names: turns what someone typed into indexes of `repos`.
export function parseSelection(text, repos) {
  const picked = new Set();
  for (const part of String(text ?? '').split(/[\s,]+/).filter(Boolean)) {
    if (/^(all|\*)$/i.test(part)) repos.forEach((_, i) => picked.add(i));
    else if (/^\d+-\d+$/.test(part)) {
      const [a, b] = part.split('-').map(Number);
      for (let n = Math.min(a, b); n <= Math.max(a, b); n++) if (n >= 1 && n <= repos.length) picked.add(n - 1);
    } else if (/^\d+$/.test(part)) {
      const n = Number(part);
      if (n >= 1 && n <= repos.length) picked.add(n - 1);
    } else {
      const i = repos.findIndex((r) => r.fullName.toLowerCase() === part.toLowerCase() || r.name.toLowerCase() === part.toLowerCase());
      if (i !== -1) picked.add(i);
    }
  }
  return [...picked].sort((a, b) => a - b);
}

const decode = (file) => Buffer.from(file.content ?? '', file.encoding ?? 'base64').toString('utf8');
const encode = (text) => Buffer.from(text, 'utf8').toString('base64');

async function readFile(client, fullName, path, ref) {
  try {
    const file = await client.get(`/repos/${fullName}/contents/${path}`, { query: { ref } });
    return Array.isArray(file) ? null : { sha: file.sha, text: decode(file) };
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function findReadme(client, fullName, ref) {
  try {
    const file = await client.get(`/repos/${fullName}/readme`, { query: { ref } });
    // Only a README at the root is the one GitHub shows on the repo page.
    return file.path.includes('/') ? null : { path: file.path, sha: file.sha, text: decode(file) };
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// Commits the workflow (and the pet in the README) on the default branch. The workflow's
// `push` trigger then hatches the pet within a minute. Returns what it did, step by step.
export async function adoptRepo(client, repo, { options = {}, style = 'card', force = false, readme = true } = {}) {
  const { fullName, defaultBranch: branch } = repo;
  const done = { fullName, workflow: 'skipped', readme: 'skipped' };
  const message = 'Adopt a LegacyPet 🐣';

  const existing = await readFile(client, fullName, WORKFLOW_PATH, branch);
  if (existing && !force) done.workflow = 'exists';
  else {
    try {
      await client.put(`/repos/${fullName}/contents/${WORKFLOW_PATH}`, {
        message, branch, content: encode(workflowYaml(options)), ...(existing ? { sha: existing.sha } : {}),
      });
      done.workflow = existing ? 'updated' : 'created';
    } catch (err) {
      // Writing under .github/workflows needs the token's `workflow` scope.
      if (err.status === 403 || err.status === 404) err.hint = 'workflow-scope';
      throw err;
    }
  }

  if (readme) {
    const snippet = snippetFor(fullName, style, PET_BRANCH, { isPrivate: repo.isPrivate });
    const file = await findReadme(client, fullName, branch);
    const before = file?.text ?? `# ${repo.name}\n`;
    const after = insertSnippet(before, snippet);
    if (after === before) done.readme = 'exists';
    else {
      await client.put(`/repos/${fullName}/contents/${file?.path ?? 'README.md'}`, {
        message, branch, content: encode(after), ...(file ? { sha: file.sha } : {}),
      });
      done.readme = file ? 'updated' : 'created';
    }
  }
  return done;
}
