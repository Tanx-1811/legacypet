// Copies the app's code (../src and ../site) next to main.js, so the packaged app carries it.
import { cpSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const out = here('../bundle/');
rmSync(out, { recursive: true, force: true });
cpSync(here('../../src'), `${out}src`, { recursive: true });
cpSync(here('../../site'), `${out}site`, { recursive: true });
writeFileSync(`${out}package.json`, `${JSON.stringify({ type: 'module', private: true }, null, 2)}\n`);
console.log(`Bundled src/ and site/ into ${out}`);
