// LegacyPet for the desktop: the same app as `legacypet app`, in its own window, with a
// menu bar (tray) icon, a pet that sits on the desktop and native notifications.
// All the work happens in ../src (bundled into ./bundle for the packaged app).
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, nativeTheme, Notification, screen, shell, Tray } from 'electron';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = existsSync(join(here, 'bundle', 'src')) ? join(here, 'bundle') : join(here, '..');
const isMac = process.platform === 'darwin';
const preload = join(here, 'preload.cjs');
const startHidden = process.argv.includes('--hidden') || (isMac && app.getLoginItemSettings().wasOpenedAtLogin);

// The app's own words; the pets speak through src/i18n.
const WORDS = {
  en: {
    pets: (n, care) => (care ? `${n} pets · ${care} need care` : `${n} pets · all good`),
    noPets: 'No pets yet',
    more: (n) => `${n} more…`,
    open: 'Open LegacyPet',
    float: 'Pet on the desktop',
    refresh: 'Refresh now',
    quit: 'Quit LegacyPet',
    feed: '🍪 Feed', play: '🎾 Play', pat: '🤚 Pat',
    switchPet: 'Switch pet',
    neediest: 'The one that needs care most',
    hidePet: 'Hide this pet',
    stillHere: isMac ? 'LegacyPet is still in the menu bar, keeping an eye on your pets.' : 'LegacyPet is still in the system tray, keeping an eye on your pets.',
  },
  vi: {
    pets: (n, care) => (care ? `${n} thú · ${care} cần chăm` : `${n} thú · đều ổn`),
    noPets: 'Chưa có thú nào',
    more: (n) => `Thêm ${n} thú…`,
    open: 'Mở LegacyPet',
    float: 'Thú trên màn hình',
    refresh: 'Làm mới ngay',
    quit: 'Thoát LegacyPet',
    feed: '🍪 Cho ăn', play: '🎾 Chơi', pat: '🤚 Xoa đầu',
    switchPet: 'Đổi thú',
    neediest: 'Thú cần chăm nhất',
    hidePet: 'Ẩn thú này',
    stillHere: isMac ? 'LegacyPet vẫn ở trên thanh menu, trông chừng các chú thú.' : 'LegacyPet vẫn ở khay hệ thống, trông chừng các chú thú.',
  },
};

let server = null;
let mainWin = null;
let floatWin = null;
let tray = null;
let quitting = false;
let toldStillHere = false;
const words = () => WORDS[server?.projects.config.ui === 'vi' ? 'vi' : 'en'];
const isOwn = (url) => server && url.startsWith(server.url);
const ATTENTION = { bad: 0, warn: 1, good: 2 };
const neediest = (list) => list.filter((p) => p.summary).sort((a, b) => ATTENTION[a.summary.attention] - ATTENTION[b.summary.attention]);

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => showMain());
app.setAppUserModelId?.('io.github.tanx1811.legacypet');

// Links to GitHub open in the real browser; the app's own pages stay in the app.
function guard(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isOwn(url)) return { action: 'allow' };
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (isOwn(url)) return;
    event.preventDefault();
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
  });
}

function showMain(hash) {
  if (!server) return;
  if (!mainWin || mainWin.isDestroyed()) {
    mainWin = new BrowserWindow({
      width: 1240,
      height: 840,
      minWidth: 980,
      minHeight: 640,
      show: false,
      title: 'LegacyPet',
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b0b0f' : '#f7f7f9', // site/app.css --bg
      titleBarStyle: isMac ? 'hiddenInset' : 'default',
      trafficLightPosition: { x: 18, y: 16 },
      icon: isMac ? undefined : join(here, 'build', 'icon.png'),
      autoHideMenuBar: true,
      webPreferences: { preload, contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
    });
    guard(mainWin);
    mainWin.once('ready-to-show', () => mainWin.show());
    // Closing the window keeps the pets running in the menu bar / tray.
    mainWin.on('close', (event) => {
      if (quitting) return;
      event.preventDefault();
      mainWin.hide();
      if (isMac) app.dock?.hide();
      if (!toldStillHere && Notification.isSupported()) {
        toldStillHere = true;
        new Notification({ title: 'LegacyPet', body: words().stillHere, silent: true }).show();
      }
    });
    mainWin.loadURL(server.appUrl(hash ?? '#/home'));
  } else {
    if (hash) mainWin.webContents.executeJavaScript(`location.hash = ${JSON.stringify(hash)}`).catch(() => {});
    mainWin.show();
  }
  if (isMac) app.dock?.show();
  mainWin.focus();
}

// The desktop pet: a small see-through window that stays on top of everything.
const FLOAT_SIZES = { small: [150, 210], medium: [190, 260], large: [240, 325] };
const floatSize = () => FLOAT_SIZES[server?.projects.config.floatSize] ?? FLOAT_SIZES.medium;
let saveBounds = null;

// A new size keeps the pet's feet where they were: it grows up and to the left.
function resizeFloat() {
  if (!floatWin || floatWin.isDestroyed()) return;
  const [width, height] = floatSize();
  const b = floatWin.getBounds();
  // Some systems ignore new bounds on a window people can't resize: allow it for a moment.
  floatWin.setResizable(true);
  floatWin.setBounds({ x: b.x + b.width - width, y: b.y + b.height - height, width, height });
  floatWin.setResizable(false);
}
function setFloat(on) {
  if (!on) {
    if (floatWin && !floatWin.isDestroyed()) floatWin.destroy();
    floatWin = null;
    updateTray();
    return;
  }
  if (floatWin && !floatWin.isDestroyed()) {
    floatWin.showInactive();
    return;
  }
  const { workArea } = screen.getPrimaryDisplay();
  const saved = server.projects.config.floatBounds;
  const onScreen = saved && screen.getAllDisplays().some(({ workArea: a }) => saved.x >= a.x && saved.y >= a.y && saved.x < a.x + a.width && saved.y < a.y + a.height);
  const [width, height] = floatSize();
  floatWin = new BrowserWindow({
    width,
    height,
    x: onScreen ? saved.x : workArea.x + workArea.width - width - 20,
    y: onScreen ? saved.y : workArea.y + workArea.height - height - 15,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    show: false,
    title: 'LegacyPet',
    webPreferences: { preload, contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  floatWin.setAlwaysOnTop(true, 'floating');
  floatWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  guard(floatWin);
  floatWin.once('ready-to-show', () => floatWin?.showInactive());
  floatWin.on('moved', () => {
    clearTimeout(saveBounds);
    saveBounds = setTimeout(() => {
      if (floatWin && !floatWin.isDestroyed()) server.projects.updateConfig({ floatBounds: floatWin.getBounds() });
    }, 600);
  });
  floatWin.on('closed', () => { floatWin = null; });
  floatWin.webContents.on('context-menu', () => floatMenu().popup({ window: floatWin }));
  floatWin.loadURL(`${server.url}float.html?transparent=1`);
  updateTray();
}

function floatMenu() {
  const w = words();
  const list = neediest(server.projects.list());
  const favorite = server.projects.config.favorite;
  const current = list.find((p) => p.id === favorite) ?? list[0];
  const care = (name) => current && server.projects.care(current.id, name).catch(() => {});
  return Menu.buildFromTemplate([
    { label: w.feed, enabled: Boolean(current), click: () => care('feed') },
    { label: w.play, enabled: Boolean(current), click: () => care('play') },
    { label: w.pat, enabled: Boolean(current), click: () => care('pat') },
    { type: 'separator' },
    {
      label: w.switchPet,
      submenu: [
        { label: w.neediest, type: 'radio', checked: !favorite, click: () => server.projects.updateConfig({ favorite: null }) },
        ...list.slice(0, 20).map((p) => ({
          label: `${p.summary.emoji} ${p.summary.name} · ${p.folder}`, type: 'radio', checked: p.id === favorite,
          click: () => server.projects.updateConfig({ favorite: p.id }),
        })),
      ],
    },
    { label: w.open, click: () => showMain(current ? `#/home/${current.id}` : '#/home') },
    { type: 'separator' },
    { label: w.hidePet, click: () => { server.projects.updateConfig({ float: false }); setFloat(false); } },
  ]);
}

function updateTray() {
  if (!tray || !server) return;
  const w = words();
  const list = neediest(server.projects.list());
  const care = list.filter((p) => p.summary.attention !== 'good').length;
  if (isMac) tray.setTitle(care ? String(care) : '');
  tray.setToolTip(`LegacyPet · ${list.length ? w.pets(list.length, care) : w.noPets}`);
  const shown = list.slice(0, 12);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: list.length ? w.pets(list.length, care) : w.noPets, enabled: false },
    { type: 'separator' },
    ...shown.map((p) => ({
      label: `${p.summary.emoji}  ${p.summary.name} · ${p.folder}  (Lv.${p.summary.level})`,
      click: () => showMain(`#/home/${p.id}`),
    })),
    ...(list.length > shown.length ? [{ label: w.more(list.length - shown.length), click: () => showMain('#/home') }] : []),
    ...(shown.length ? [{ type: 'separator' }] : []),
    { label: w.open, click: () => showMain() },
    {
      label: w.float, type: 'checkbox', checked: Boolean(floatWin),
      click: (item) => { server.projects.updateConfig({ float: item.checked }); setFloat(item.checked); },
    },
    { label: w.refresh, click: () => server.projects.refresh().catch(() => {}) },
    { type: 'separator' },
    { label: w.quit, click: () => { quitting = true; app.quit(); } },
  ]));
}

function createTray() {
  const icon = nativeImage.createFromPath(join(here, 'build', isMac ? 'trayTemplate.png' : 'tray.png'));
  if (isMac) icon.setTemplateImage(true);
  tray = new Tray(icon);
  // On Windows and Linux a click opens the app; the menu is on right-click.
  if (!isMac) tray.on('click', () => showMain());
  updateTray();
}

function notify(event) {
  // The server decides: notifications on, this kind not muted, not during quiet hours.
  if (!(event.notify ?? server.projects.config.notify) || !Notification.isSupported()) return;
  const note = new Notification({ title: 'LegacyPet', body: event.text, silent: !event.urgent });
  note.on('click', () => showMain(`#/home/${event.projectId}`));
  note.show();
}

// The desktop pet's ↗ button opens the main window on that pet.
ipcMain.on('legacypet:show-main', (event, hash) => {
  if (!isOwn(event.senderFrame?.url ?? '')) return;
  showMain(/^#\/[\w/-]*$/.test(hash) ? hash : undefined);
});

app.on('window-all-closed', () => { /* stay in the menu bar / tray */ });
app.on('activate', () => showMain());
app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => { globalShortcut.unregisterAll(); server?.close(); });

app.whenReady().then(async () => {
  const { startServer, DEFAULT_PORT } = await import(pathToFileURL(join(root, 'src', 'app', 'server.js')).href);
  server = await startServer({
    port: DEFAULT_PORT,
    root,
    desktop: {
      info: () => ({
        platform: process.platform,
        float: Boolean(floatWin),
        loginItem: process.platform === 'linux' ? null : app.getLoginItemSettings().openAtLogin,
      }),
      pickFolder: async () => {
        const parent = mainWin && !mainWin.isDestroyed() ? mainWin : undefined;
        const result = await dialog.showOpenDialog(parent, { properties: ['openDirectory', 'createDirectory'] });
        return result.canceled ? null : result.filePaths[0] ?? null;
      },
      reveal: (path) => { shell.openPath(path); },
      setFloat,
      resizeFloat,
      setLoginItem: (on) => app.setLoginItemSettings({ openAtLogin: on, openAsHidden: true, args: on ? ['--hidden'] : [] }),
    },
  });
  server.projects.on((type, payload) => {
    if (type === 'event') notify(payload);
    if (type === 'change' || type === 'config') updateTray();
  });
  createTray();
  // ⌘⇧L / Ctrl+Shift+L from anywhere: show LegacyPet, or hide it when it is in front.
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    if (mainWin && !mainWin.isDestroyed() && mainWin.isVisible() && mainWin.isFocused()) mainWin.hide();
    else showMain();
  });
  if (server.projects.config.float) setFloat(true);
  if (!startHidden) showMain();
  else if (isMac) app.dock?.hide();
  if (process.env.LEGACYPET_SMOKE) smokeTest(process.env.LEGACYPET_SMOKE);
});

// CI and release checks: LEGACYPET_SMOKE=<dir> opens the app, saves pictures of its own
// windows (never the screen) plus a summary, then quits.
async function smokeTest(dir) {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  mkdirSync(dir, { recursive: true });
  const report = { ok: false, version: app.getVersion(), electron: process.versions.electron, url: server.url };
  try {
    showMain();
    await wait(4000);
    writeFileSync(join(dir, 'main.png'), (await mainWin.webContents.capturePage()).toPNG());
    report.title = await mainWin.webContents.executeJavaScript('document.title');
    report.view = await mainWin.webContents.executeJavaScript(`document.querySelector('main')?.innerText.slice(0, 300)`);
    setFloat(true);
    await wait(3000);
    writeFileSync(join(dir, 'float.png'), (await floatWin.webContents.capturePage()).toPNG());
    report.float = await floatWin.webContents.executeJavaScript('document.title');
    report.pets = server.projects.list().length;
    report.ok = true;
  } catch (err) {
    report.error = String(err?.stack ?? err);
  }
  writeFileSync(join(dir, 'smoke.json'), `${JSON.stringify(report, null, 2)}\n`);
  quitting = true;
  app.exit(report.ok ? 0 : 1);
}
