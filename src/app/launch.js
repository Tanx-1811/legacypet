// Opens the app in its own window without installing anything: Chrome, Edge, Brave or
// Chromium in "app mode" (no tabs, no address bar), or the default browser as a fallback.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

function candidates(platform = process.platform, env = process.env) {
  if (platform === 'darwin') {
    return ['Google Chrome', 'Microsoft Edge', 'Brave Browser', 'Chromium', 'Vivaldi', 'Arc']
      .flatMap((app) => [`/Applications/${app}.app/Contents/MacOS/${app}`, join(env.HOME ?? '', `Applications/${app}.app/Contents/MacOS/${app}`)]);
  }
  if (platform === 'win32') {
    const roots = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean);
    const apps = ['Google\\Chrome\\Application\\chrome.exe', 'Microsoft\\Edge\\Application\\msedge.exe', 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'];
    return roots.flatMap((r) => apps.map((a) => `${r}\\${a}`));
  }
  const dirs = (env.PATH ?? '').split(':').filter(Boolean);
  return ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser']
    .flatMap((bin) => dirs.map((d) => join(d, bin)));
}

export const findAppBrowser = (platform, env) => candidates(platform, env).find((p) => existsSync(p)) ?? null;

// Resolves when the window closes (app mode), or right away when it fell back to a tab.
export function openAppWindow(url, { profileDir, width = 1200, height = 820 } = {}) {
  const browser = findAppBrowser();
  if (browser) {
    const child = spawn(browser, [
      `--app=${url}`, `--user-data-dir=${profileDir}`, `--window-size=${width},${height}`,
      '--no-first-run', '--no-default-browser-check', '--disable-features=Translate',
    ], { stdio: 'ignore', windowsHide: false });
    return { kind: 'window', browser, closed: new Promise((done) => { child.on('exit', done); child.on('error', done); }) };
  }
  const [cmd, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true }).on('error', () => {}).unref();
  return { kind: 'tab', browser: null, closed: null };
}
