// Serves the playground locally the same way GitHub Pages does: site/ at the root,
// with src/ and the gallery next to it. Usage: npm run playground
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const MOUNTS = [['/src/', join(root, 'src')], ['/gallery/', join(root, 'docs', 'gallery')], ['/', join(root, 'site')]];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.css': 'text/css' };
const port = Number(process.env.PORT) || 4173;

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const [prefix, dir] = MOUNTS.find(([p]) => path.startsWith(p));
  let file = resolve(dir, `.${sep}${path.slice(prefix.length)}`);
  if (path.endsWith('/')) file = join(file, 'index.html');
  if (!file.startsWith(dir)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`🐣 Playground running at http://localhost:${port}`));
