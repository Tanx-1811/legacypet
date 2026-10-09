// Finds git repos inside the folders someone allowed. Before that, it only suggests
// folders by name: nothing is opened or listed until they say yes.
import { existsSync, statSync } from 'node:fs';
import { readdir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';

// Where people usually keep their code. GitHub Desktop clones into Documents/GitHub,
// Visual Studio into source/repos.
const CANDIDATES = [
  'Documents/GitHub', 'GitHub', 'Github', 'github', 'Developer', 'Projects', 'projects', 'Code', 'code', 'dev', 'Dev',
  'src', 'repos', 'Repos', 'workspace', 'Workspace', 'git', 'Git', 'Sites', 'work', 'source/repos',
  'Documents/Projects', 'Documents/Code', 'Documents/code', 'Documents/dev', 'Desktop/projects', 'Desktop/code',
];
// On macOS, even looking inside these asks the system for permission, so before someone
// agrees we only peek at the most common one and never list them.
const PROTECTED = /^(Documents|Desktop|Downloads)(\/|$)/;

const SKIP = new Set([
  'node_modules', 'vendor', 'dist', 'build', 'target', 'out', 'bin', 'obj', 'Pods', 'DerivedData', 'venv', 'env',
  '__pycache__', 'Library', 'Applications', 'Pictures', 'Movies', 'Music', 'Photos', 'AppData', 'site-packages',
  'bower_components', 'coverage', 'tmp', 'temp', 'Trash',
]);

export const MAX_DEPTH = 4;
export const MAX_REPOS = 300;
const MAX_DIRS = 25_000;

const isRepo = (dir) => existsSync(join(dir, '.git'));

// Folders worth offering, each { path, label, exists, checked }. `cwd` is offered first
// when it is (or sits in) a repo, so `legacypet app` run inside a project finds it at once.
export function suggestFolders({ home = homedir(), platform = process.platform, cwd = null } = {}) {
  const out = [];
  const seen = new Set();
  const add = (path, label, { exists, checked }) => {
    const key = platform === 'linux' ? path : path.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ path, label, exists, checked });
  };
  if (cwd && cwd !== home && isRepo(cwd)) add(cwd, cwd.replace(home, '~'), { exists: true, checked: true });
  for (const rel of CANDIDATES) {
    const path = join(home, ...rel.split('/'));
    const label = `~${sep}${rel.split('/').join(sep)}`;
    if (platform === 'darwin' && PROTECTED.test(rel)) {
      // Can't look without asking macOS; offer GitHub Desktop's folder anyway.
      if (rel === 'Documents/GitHub') add(path, label, { exists: null, checked: true });
      continue;
    }
    let exists = false;
    try {
      exists = statSync(path).isDirectory();
    } catch { /* not there */ }
    if (exists) add(path, label, { exists: true, checked: true });
  }
  add(home, '~', { exists: true, checked: false });
  return out;
}

// Walks the allowed folders and returns every repo it finds (not the repos inside a repo:
// those are submodules or vendored code). Bounded, so pointing it at a whole disk is safe.
export async function findRepos(roots, { maxDepth = MAX_DEPTH, maxRepos = MAX_REPOS, signal } = {}) {
  const found = new Map();
  let visited = 0;

  async function walk(dir, depth) {
    if (found.size >= maxRepos || visited >= MAX_DIRS || signal?.aborted) return;
    visited += 1;
    if (isRepo(dir)) {
      const real = await realpath(dir).catch(() => dir);
      if (!found.has(real)) found.set(real, dir);
      return;
    }
    if (depth >= maxDepth) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // no permission, or it vanished
    }
    const dirs = entries.filter((e) => e.isDirectory() && !e.isSymbolicLink() && !e.name.startsWith('.') && !SKIP.has(e.name));
    for (const entry of dirs) await walk(join(dir, entry.name), depth + 1);
  }

  for (const root of roots) {
    const dir = resolve(root);
    try {
      if (!(await stat(dir)).isDirectory()) continue;
    } catch {
      continue;
    }
    await walk(dir, 0);
  }
  return [...found.values()].sort((a, b) => a.localeCompare(b));
}
