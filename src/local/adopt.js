// Adopting a pet in a repo on this computer: write the workflow and put the pet in the
// README (what `legacypet init` does), then, only when asked, commit those two files and push.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { insertSnippet, snippetFor, workflowYaml } from '../setup.js';
import { WORKFLOW_PATH } from '../github/repos.js';
import { git } from './git.js';

export const ADOPT_MESSAGE = 'Adopt a LegacyPet 🐾';
const INPUTS = ['species', 'scenery', 'name', 'lang', 'wear', 'vacation', 'park', 'alerts'];

export const findReadme = (dir) => {
  try {
    return readdirSync(dir).find((f) => /^readme(\.(md|markdown))?$/i.test(f)) ?? null;
  } catch {
    return null;
  }
};

// The `with:` inputs of the LegacyPet step, so the pet drawn here matches the one on GitHub.
export function workflowOptions(yaml) {
  const out = {};
  const rows = String(yaml ?? '').split('\n');
  const step = rows.findIndex((l) => /uses:\s*['"]?[\w.-]+\/legacypet@/i.test(l));
  if (step === -1) return out;
  const withRow = rows.findIndex((l, i) => i > step && /^\s*with:\s*$/.test(l));
  if (withRow === -1 || /^\s*-\s/m.test(rows.slice(step + 1, withRow).join('\n'))) return out;
  const indent = rows[withRow].search(/\S/);
  for (const line of rows.slice(withRow + 1)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (line.search(/\S/) <= indent) break;
    const m = /^\s*([\w-]+):\s*(.*)$/.exec(line);
    if (!m || !INPUTS.includes(m[1])) continue;
    let value = m[2].trim();
    const double = /^"((?:[^"\\]|\\.)*)"/.exec(value);
    const single = /^'((?:[^']|'')*)'/.exec(value);
    if (double) {
      try { value = JSON.parse(`"${double[1]}"`); } catch { value = double[1]; }
    } else if (single) value = single[1].replace(/''/g, "'");
    else value = value.replace(/\s+#.*$/, '');
    out[m[1]] = value;
  }
  return out;
}

export function readWorkflow(dir) {
  const file = join(dir, ...WORKFLOW_PATH.split('/'));
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

// Writes what a pet needs. Returns each file and what happened to it:
// 'created' | 'updated' | 'exists' (already right, left alone).
export function adoptLocal(dir, { fullName, repoName, isPrivate = false, options = {}, style = 'card', force = false, readme = true } = {}) {
  const files = [];
  const workflow = join(dir, ...WORKFLOW_PATH.split('/'));
  const had = existsSync(workflow);
  if (had && !force) files.push({ path: WORKFLOW_PATH, status: 'exists' });
  else {
    const next = workflowYaml(options);
    if (had && readFileSync(workflow, 'utf8') === next) files.push({ path: WORKFLOW_PATH, status: 'exists' });
    else {
      mkdirSync(dirname(workflow), { recursive: true });
      writeFileSync(workflow, next);
      files.push({ path: WORKFLOW_PATH, status: had ? 'updated' : 'created' });
    }
  }
  if (readme) {
    const snippet = snippetFor(fullName, style, 'legacypet', { isPrivate });
    const name = findReadme(dir);
    const before = name ? readFileSync(join(dir, name), 'utf8') : `# ${repoName ?? fullName.split('/')[1]}\n`;
    const after = insertSnippet(before, snippet);
    if (name && after === before) files.push({ path: name, status: 'exists' });
    else {
      writeFileSync(join(dir, name ?? 'README.md'), after);
      files.push({ path: name ?? 'README.md', status: name ? 'updated' : 'created' });
    }
  }
  return { files, snippet: snippetFor(fullName, style, 'legacypet', { isPrivate }) };
}

// Plain-language reasons a commit or push failed, for the app to explain.
export function gitHint(text) {
  const s = String(text ?? '');
  if (/workflow.*scope|without `?workflow`? scope/i.test(s)) return 'workflow-scope';
  if (/please tell me who you are|empty ident|user\.email/i.test(s)) return 'identity';
  if (/rejected|fetch first|non-fast-forward/i.test(s)) return 'behind';
  if (/no configured push destination|does not appear to be a git repository|no such remote/i.test(s)) return 'no-remote';
  if (/authentication failed|could not read username|permission denied|permission to .* denied|403|terminal prompts disabled|could not read from remote/i.test(s)) return 'auth';
  return null;
}

// Commits only the pet's files (anything else someone had staged stays out of it) and pushes.
export async function publishAdoption(dir, paths, { message = ADOPT_MESSAGE, push = true } = {}) {
  const result = { committed: false, pushed: false, error: null, hint: null };
  if (!paths.length) return result;
  try {
    await git(dir, ['add', '--', ...paths]);
    const staged = await git(dir, ['diff', '--cached', '--name-only', '--', ...paths]);
    if (staged.trim()) {
      await git(dir, ['commit', '-m', message, '--', ...paths]);
      result.committed = true;
    }
    if (!push) return result;
    const upstream = await git(dir, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { allowFail: true });
    await git(dir, upstream ? ['push'] : ['push', '-u', 'origin', 'HEAD'], { timeout: 120_000 });
    result.pushed = true;
  } catch (err) {
    const text = `${err.stderr ?? ''}\n${err.message ?? ''}`;
    result.error = text.trim().split('\n').filter(Boolean).slice(-3).join('\n');
    result.hint = gitHint(text);
  }
  return result;
}
