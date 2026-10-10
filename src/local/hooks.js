// `legacypet hooks`: git hooks that bring the pet into the terminal when you commit, push,
// pull or switch branches (src/term/react.js plays the scene). Each hook file gets one block
// between two marker lines, so a hook that was already there keeps working, and
// `legacypet hooks remove` takes out exactly that block.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

export const HOOKS = { commit: 'post-commit', push: 'pre-push', merge: 'post-merge', checkout: 'post-checkout' };
export const START = '# >>> legacypet >>>';
export const END = '# <<< legacypet <<<';

// A path inside double quotes for sh. Windows paths use forward slashes there.
const quote = (path) => `"${String(path).replace(/\\/g, '/').replace(/(["$`])/g, '\\$1')}"`;

// The block for one hook. It runs the copy of LegacyPet that installed it (with the same node),
// or a `legacypet` on the PATH if that copy is gone, and it can never fail the git command.
export function hookBlock(event, { node = process.execPath, cli }) {
  const run = `react ${event} --hook "$@"`;
  return [
    START,
    `# 🐣 LegacyPet: the pet reacts in your terminal (${event}). Quiet for one command: LEGACYPET_QUIET=1 git …`,
    '# Remove with: legacypet hooks remove',
    'if [ -z "$LEGACYPET_QUIET" ]; then',
    `  lp_cli=${quote(cli)}`,
    '  if [ -f "$lp_cli" ]; then',
    `    lp_node=${quote(node)}`,
    '    [ -x "$lp_node" ] || lp_node=$(command -v node || true)',
    `    if [ -n "$lp_node" ]; then "$lp_node" "$lp_cli" ${run} || true; fi`,
    '  elif command -v legacypet >/dev/null 2>&1; then',
    `    legacypet ${run} || true`,
    '  fi',
    'fi',
    END,
  ].join('\n');
}

function gitOut(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim();
  } catch {
    return null;
  }
}

// Where the repo's hooks live: .git/hooks, or core.hooksPath when a tool (husky…) set one.
export function hooksDir(root) {
  const path = gitOut(root, ['rev-parse', '--git-path', 'hooks']);
  if (!path) throw new Error(`${root} is not a git repo.`);
  const custom = gitOut(root, ['config', '--get', 'core.hooksPath']) || null;
  return { dir: isAbsolute(path) ? path : resolve(root, path), custom };
}

// The text with our block taken out (and nothing else touched).
export function withoutBlock(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.trim() === START);
  const end = lines.findIndex((l, i) => i > start && l.trim() === END);
  if (start === -1 || end === -1) return text;
  lines.splice(start, end - start + 1);
  return lines.join('\n');
}

// Adds the block to a hook's text: before its final `exit`, if it ends with one, or at the end.
export function withBlock(text, block) {
  const lines = withoutBlock(text).replace(/\n+$/, '').split('\n');
  let at = lines.length;
  while (at > 0 && !lines[at - 1].trim()) at--;
  if (at > 0 && /^\s*exit\b/.test(lines[at - 1])) at--;
  lines.splice(at, 0, block);
  return `${lines.join('\n')}\n`;
}

const SHELLS = /^#!.*\b(sh|bash|zsh|dash|ksh|ash)\b/;

function installOne(file, event, options) {
  const hook = HOOKS[event];
  const block = hookBlock(event, options);
  if (!existsSync(file)) {
    writeFileSync(file, `#!/bin/sh\n${block}\n`);
    chmodSync(file, 0o755);
    return { event, hook, file, status: 'created' };
  }
  const text = readFileSync(file, 'utf8');
  const first = text.split('\n')[0];
  if (first.startsWith('#!') && !SHELLS.test(first)) return { event, hook, file, status: 'skipped', reason: 'not-shell' };
  const next = withBlock(text, block);
  if (next === text) return { event, hook, file, status: 'exists' };
  writeFileSync(file, next);
  chmodSync(file, 0o755);
  return { event, hook, file, status: text.includes(START) ? 'updated' : 'added' };
}

// Installs the hooks for `events`. A repo whose hooks live somewhere shared (core.hooksPath,
// often committed for the whole team) is left alone unless `force` is set.
export function installHooks(root, { events = Object.keys(HOOKS), node = process.execPath, cli, force = false } = {}) {
  const { dir, custom } = hooksDir(root);
  if (custom && !force) return { dir, custom, blocked: true, results: [] };
  mkdirSync(dir, { recursive: true });
  const results = events.map((event) => {
    if (!HOOKS[event]) throw new Error(`Unknown event "${event}". Pick from: ${Object.keys(HOOKS).join(', ')}`);
    return installOne(join(dir, HOOKS[event]), event, { node, cli });
  });
  return { dir, custom, blocked: false, results };
}

// Takes our block out of every hook. A hook left with nothing but its first line is deleted.
export function removeHooks(root) {
  const { dir, custom } = hooksDir(root);
  const results = Object.entries(HOOKS).map(([event, hook]) => {
    const file = join(dir, hook);
    const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
    if (!text.includes(START)) return { event, hook, file, status: 'none' };
    const rest = withoutBlock(text);
    if (!rest.replace(/^#!.*$/m, '').trim()) {
      rmSync(file);
      return { event, hook, file, status: 'deleted' };
    }
    writeFileSync(file, `${rest.replace(/\n+$/, '')}\n`);
    return { event, hook, file, status: 'removed' };
  });
  return { dir, custom, results };
}

export function hookStatus(root) {
  const { dir, custom } = hooksDir(root);
  const hooks = Object.entries(HOOKS).map(([event, hook]) => {
    const file = join(dir, hook);
    return { event, hook, file, installed: existsSync(file) && readFileSync(file, 'utf8').includes(START) };
  });
  return { dir, custom, hooks };
}
