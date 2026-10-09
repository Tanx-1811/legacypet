// Opening a project in the tools people already use: their code editor or a terminal.
// Only apps found on this computer are offered.
import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

const MAC_EDITORS = [
  ['vscode', 'Visual Studio Code'], ['cursor', 'Cursor'], ['windsurf', 'Windsurf'], ['zed', 'Zed'],
  ['sublime', 'Sublime Text'], ['webstorm', 'WebStorm'], ['idea', 'IntelliJ IDEA'], ['pycharm', 'PyCharm'], ['xcode', 'Xcode'],
];
const MAC_TERMINALS = [['terminal', 'Terminal'], ['iterm', 'iTerm'], ['warp', 'Warp'], ['ghostty', 'Ghostty']];
const CLI_EDITORS = [['vscode', 'Visual Studio Code', 'code'], ['cursor', 'Cursor', 'cursor'], ['windsurf', 'Windsurf', 'windsurf'], ['zed', 'Zed', 'zed'], ['sublime', 'Sublime Text', 'subl']];
const LINUX_TERMINALS = [['gnome', 'GNOME Terminal', 'gnome-terminal'], ['konsole', 'Konsole', 'konsole'], ['xterm', 'Terminal', 'x-terminal-emulator']];

function onPath(bin, env, platform) {
  const exts = platform === 'win32' ? ['.cmd', '.exe', ''] : [''];
  for (const dir of String(env.PATH ?? env.Path ?? '').split(platform === 'win32' ? ';' : delimiter).filter(Boolean)) {
    for (const ext of exts) if (existsSync(join(dir, bin + ext))) return join(dir, bin + ext);
  }
  return null;
}

function macApp(name, env) {
  return [`/Applications/${name}.app`, join(env.HOME ?? '', 'Applications', `${name}.app`)].find((p) => existsSync(p)) ?? null;
}

// Each tool is { id, name, cmd, args(path) }. The first of each list is the default.
export function detectTools({ platform = process.platform, env = process.env } = {}) {
  const editors = [];
  const terminals = [];
  if (platform === 'darwin') {
    for (const [id, name] of MAC_EDITORS) if (macApp(name, env)) editors.push({ id, name, cmd: 'open', args: (p) => ['-a', name, p] });
    for (const [id, name] of MAC_TERMINALS) {
      if (id === 'terminal' || macApp(name, env)) terminals.push({ id, name, cmd: 'open', args: (p) => ['-a', name, p] });
    }
  } else if (platform === 'win32') {
    // Run the editors' own .exe, never through a shell, so no folder name can turn into a command.
    const local = env.LOCALAPPDATA ?? '';
    const programs = env.PROGRAMFILES ?? 'C:\\Program Files';
    const codeCmd = onPath('code', env, platform);
    const WIN_EDITORS = [
      ['vscode', 'Visual Studio Code', [join(local, 'Programs', 'Microsoft VS Code', 'Code.exe'), join(programs, 'Microsoft VS Code', 'Code.exe'), codeCmd && join(codeCmd, '..', '..', 'Code.exe')]],
      ['cursor', 'Cursor', [join(local, 'Programs', 'cursor', 'Cursor.exe')]],
      ['windsurf', 'Windsurf', [join(local, 'Programs', 'Windsurf', 'Windsurf.exe')]],
      ['sublime', 'Sublime Text', [join(programs, 'Sublime Text', 'sublime_text.exe')]],
    ];
    for (const [id, name, paths] of WIN_EDITORS) {
      const exe = paths.find((p) => p && existsSync(p));
      if (exe) editors.push({ id, name, cmd: exe, args: (p) => [p] });
    }
    const wt = onPath('wt', env, platform);
    if (wt) terminals.push({ id: 'wt', name: 'Windows Terminal', cmd: wt, args: (p) => ['-d', p] });
    // `start` opens a new window in the working directory it is given.
    terminals.push({ id: 'cmd', name: 'Command Prompt', cmd: 'cmd.exe', args: () => ['/c', 'start', 'cmd.exe'], cwd: true });
  } else {
    for (const [id, name, bin] of CLI_EDITORS) {
      const path = onPath(bin, env, platform);
      if (path) editors.push({ id, name, cmd: path, args: (p) => [p] });
    }
    for (const [id, name, bin] of LINUX_TERMINALS) {
      const path = onPath(bin, env, platform);
      if (path) terminals.push({ id, name, cmd: path, args: (p) => (id === 'konsole' ? ['--workdir', p] : [`--working-directory=${p}`]) });
    }
  }
  return { editors, terminals };
}

export const publicTools = ({ editors, terminals }) => ({
  editors: editors.map(({ id, name }) => ({ id, name })),
  terminals: terminals.map(({ id, name }) => ({ id, name })),
});

// Starts the tool on `path`. Resolves once it has started (or failed to).
export function launch(tool, path) {
  return new Promise((resolve, reject) => {
    if (tool.cmd === 'open') {
      // `open` returns quickly and says when the app is missing.
      execFile('open', tool.args(path), { timeout: 15_000 }, (err) => (err ? reject(err) : resolve()));
      return;
    }
    const child = spawn(tool.cmd, tool.args(path), { detached: true, stdio: 'ignore', windowsHide: false, ...(tool.cwd ? { cwd: path } : {}) });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}
