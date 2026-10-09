// The LegacyPet app: the playground plus "My pets", served on this computer only.
// It listens on 127.0.0.1, answers only to its own address (no DNS rebinding) and every
// API call must carry a secret made fresh at each start, which only its own pages know.
import { execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARE_ACTIONS } from '../engine/care.js';
import { cleanConfigPatch, createProjects } from '../local/projects.js';
import { VERSION } from '../whatsnew.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const DEFAULT_PORT = 47474;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};
const MAX_BODY = 1024 * 1024;
const MAX_BACKUP = 64 * 1024 * 1024; // a backup carries every pet's memory
const CONFIG_KEYS = [
  'online', 'token', 'notify', 'mute', 'reminderHour', 'quietHours', 'refreshMinutes', 'favorite', 'float', 'floatSize', 'floatBubbles',
  'hidden', 'options', 'notes', 'ui', 'theme', 'roots', 'pinned', 'editor', 'terminal',
];

// Folder pickers that need no dependencies: the system's own dialog.
export function systemPickFolder(prompt = 'Choose a folder with your projects') {
  const run = (cmd, args) => new Promise((done) => {
    execFile(cmd, args, { timeout: 10 * 60_000, windowsHide: true }, (err, out) => done(err ? null : String(out).trim() || null));
  });
  if (process.platform === 'darwin') {
    return run('osascript', ['-e', `POSIX path of (choose folder with prompt ${JSON.stringify(prompt)})`]);
  }
  if (process.platform === 'win32') {
    const ps = "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.ShowNewFolderButton = $false; if ($f.ShowDialog() -eq 'OK') { $f.SelectedPath }";
    return run('powershell', ['-NoProfile', '-STA', '-Command', ps]);
  }
  return run('zenity', ['--file-selection', '--directory', `--title=${prompt}`]).then((p) => p ?? run('kdialog', ['--getexistingdirectory']));
}

export function systemReveal(path) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [path]] : process.platform === 'win32' ? ['explorer', [path]] : ['xdg-open', [path]];
  spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).on('error', () => {}).unref();
}

function send(res, status, body, headers = {}) {
  const json = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }).end(json);
}

function readBody(req, limit = MAX_BODY) {
  return new Promise((done, fail) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { fail(Object.assign(new Error('Too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        done(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        fail(Object.assign(new Error('Bad JSON'), { status: 400 }));
      }
    });
    req.on('error', fail);
  });
}

export async function startServer({
  port = DEFAULT_PORT, host = '127.0.0.1', projects = createProjects({ cwd: process.cwd() }), desktop = null,
  root = ROOT, secret = randomBytes(24).toString('hex'), autoRefresh = true, onIdle = null, idleAfter = 20_000,
} = {}) {
  const mounts = [['/src/', join(root, 'src')], ['/gallery/', join(root, 'docs', 'gallery')], ['/', join(root, 'site')]];
  const mode = desktop ? 'desktop' : 'browser';
  const streams = new Set();
  let actualPort = port;
  let timer = null;
  let idleTimer = null;
  let everConnected = false;

  // No window has been listening for a while: every window was closed.
  function watchIdle() {
    clearTimeout(idleTimer);
    if (!onIdle || !everConnected || streams.size) return;
    idleTimer = setTimeout(() => { if (!streams.size) onIdle(); }, idleAfter);
  }

  const state = () => {
    const config = projects.config;
    return {
      version: VERSION,
      mode,
      platform: process.platform,
      dataDir: projects.store?.dir ?? null,
      config: { ...config, token: undefined, hasToken: Boolean(config.token) },
      tokenSource: projects.tokenSource(),
      suggestions: config.consented ? [] : projects.suggestions(),
      scanning: projects.scanning,
      lastScan: projects.lastScan,
      projects: projects.list(),
      hiddenProjects: projects.hiddenList(),
      tools: projects.tools(),
      events: projects.events().slice(0, 20),
      desktop: desktop?.info?.() ?? null,
    };
  };

  function arm() {
    clearInterval(timer);
    if (!autoRefresh || !projects.config.consented) return;
    const minutes = Math.max(1, Number(projects.config.refreshMinutes) || 15);
    timer = setInterval(() => projects.refresh().catch(() => {}), minutes * 60_000);
    timer.unref?.();
  }

  const off = projects.on((type, payload) => {
    for (const res of streams) res.write(`event: ${type}\ndata: ${JSON.stringify(type === 'event' ? payload : {})}\n\n`);
    if (type === 'config') arm();
  });

  const routes = {
    'GET /api/state': () => state(),
    'POST /api/allow': async (body) => {
      if (!Array.isArray(body.roots)) throw Object.assign(new Error('roots must be a list'), { status: 400 });
      await projects.allow(body.roots);
      arm();
      return state();
    },
    'POST /api/scan': async () => { await projects.scan(); return state(); },
    'POST /api/refresh': async (body) => { await projects.refresh(Array.isArray(body.ids) ? body.ids : null); return state(); },
    'POST /api/config': (body) => {
      const patch = cleanConfigPatch(Object.fromEntries(Object.entries(body).filter(([k]) => CONFIG_KEYS.includes(k))));
      projects.updateConfig(patch);
      if ('float' in patch) desktop?.setFloat?.(Boolean(patch.float));
      if ('floatSize' in patch) desktop?.resizeFloat?.(patch.floatSize);
      if ('roots' in patch) projects.scan().catch(() => {});
      return state();
    },
    'POST /api/pick-folder': async () => ({ path: await (desktop?.pickFolder ?? systemPickFolder)() }),
    'GET /api/token': () => ({ token: projects.token() }),
    'POST /api/reset': () => { projects.reset(); arm(); return state(); },
    'POST /api/care-all': async (body) => {
      if (!CARE_ACTIONS.includes(body.name)) throw Object.assign(new Error('Unknown care action'), { status: 400 });
      return { ...(await projects.careAll(body.name)), state: state() };
    },
    'GET /api/backup': () => projects.backup(),
    'POST /api/restore': async (body) => ({ ...(await projects.restore(body)), state: state() }),
    'POST /api/login-item': (body) => { desktop?.setLoginItem?.(Boolean(body.on)); return state(); },
  };
  const projectRoutes = {
    care: async (id, body) => {
      if (!CARE_ACTIONS.includes(body.name)) throw Object.assign(new Error('Unknown care action'), { status: 400 });
      return { project: await projects.care(id, body.name) };
    },
    adopt: (id, body) => projects.adopt(id, {
      style: ['card', 'mini', 'badge'].includes(body.style) ? body.style : 'card',
      options: typeof body.options === 'object' && body.options ? body.options : {},
      publish: Boolean(body.publish),
      force: Boolean(body.force),
      readme: body.readme !== false,
    }),
    publish: (id) => projects.publish(id),
    git: (id, body) => {
      if (!['fetch', 'pull'].includes(body.action)) throw Object.assign(new Error('Unknown git action'), { status: 400 });
      return projects.sync(id, body.action);
    },
    reveal: (id) => { (desktop?.reveal ?? systemReveal)(projects.get(id).path); return { ok: true }; },
    open: (id, body) => projects.open(id, body.with === 'terminal' ? 'terminal' : 'editor'),
    hide: (id) => { projects.updateConfig({ hidden: [...new Set([...projects.config.hidden, id])] }); return state(); },
  };

  async function api(req, res, path, url) {
    // Lets a second `legacypet app` find this one instead of starting another. Says nothing private.
    if (path === '/api/ping') return send(res, 200, { app: 'legacypet', version: VERSION });
    // Server-sent events for live updates. EventSource can't send headers, so the secret rides in the URL.
    if (path === '/api/stream') {
      if (url.searchParams.get('token') !== secret) return send(res, 403, { error: 'forbidden' });
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write('retry: 3000\n\n');
      streams.add(res);
      everConnected = true;
      clearTimeout(idleTimer);
      const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
      req.on('close', () => { clearInterval(ping); streams.delete(res); watchIdle(); });
      return;
    }
    if (req.headers['x-legacypet-token'] !== secret) return send(res, 403, { error: 'forbidden' });
    try {
      const body = req.method === 'POST' ? await readBody(req, path === '/api/restore' ? MAX_BACKUP : MAX_BODY) : {};
      const key = `${req.method} ${path}`;
      if (routes[key]) return send(res, 200, await routes[key](body));
      const m = /^\/api\/projects\/([0-9a-f]{12})\/([a-z]+)$/.exec(path);
      if (m && req.method === 'POST' && projectRoutes[m[2]]) return send(res, 200, await projectRoutes[m[2]](m[1], body));
      return send(res, 404, { error: 'not found' });
    } catch (err) {
      return send(res, err.status ?? 500, { error: err.message });
    }
  }

  async function serveFile(req, res, path) {
    const [prefix, dir] = mounts.find(([p]) => path.startsWith(p));
    let file = resolve(dir, `.${sep}${path.slice(prefix.length)}`);
    if (file !== dir && !file.startsWith(dir + sep)) return res.writeHead(403).end();
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      let body = await readFile(file);
      const type = TYPES[extname(file)] ?? 'application/octet-stream';
      if (extname(file) === '.html') {
        // The page learns the secret from the page itself; other sites can't read it.
        const meta = `<meta name="legacypet-token" content="${secret}"><meta name="legacypet-mode" content="${mode}">`;
        body = Buffer.from(body.toString('utf8').replace(/<head>/i, `<head>${meta}`));
      }
      res.writeHead(200, {
        'content-type': type,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        ...(type.startsWith('text/html') ? { 'x-frame-options': 'SAMEORIGIN' } : {}),
      }).end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  }

  const server = createServer(async (req, res) => {
    // Only our own address: a web page that points some domain at 127.0.0.1 gets nothing.
    const allowed = [`127.0.0.1:${actualPort}`, `localhost:${actualPort}`];
    if (!allowed.includes(String(req.headers.host).toLowerCase())) return res.writeHead(421).end();
    const url = new URL(req.url, `http://127.0.0.1:${actualPort}`);
    let path;
    try {
      path = decodeURIComponent(url.pathname);
    } catch {
      return res.writeHead(400).end();
    }
    if (path.startsWith('/api/')) return api(req, res, path, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return res.writeHead(405).end();
    return serveFile(req, res, path);
  });

  // Tries the usual port first (the window remembers its look per address), then the next ones.
  await new Promise((done, fail) => {
    let tries = 0;
    const listen = (p) => {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && port !== 0 && tries++ < 20) listen(p + 1);
        else fail(err);
      });
      server.listen(p, host, () => { actualPort = server.address().port; done(); });
    };
    listen(port);
  });

  arm();
  // Show what we knew last time at once, then look again in the background.
  if (projects.config.consented) {
    const job = projects.list().length ? projects.refresh() : projects.scan();
    job.catch(() => {});
  }

  return {
    server,
    projects,
    secret,
    port: actualPort,
    url: `http://127.0.0.1:${actualPort}/`,
    appUrl: (hash = '#/home') => `http://127.0.0.1:${actualPort}/${hash}`,
    get windows() { return streams.size; },
    close() {
      clearInterval(timer);
      clearTimeout(idleTimer);
      off();
      for (const res of streams) res.end();
      return new Promise((done) => server.close(() => done()));
    },
  };
}

export const hasSite = (root = ROOT) => existsSync(join(root, 'site', 'index.html'));
