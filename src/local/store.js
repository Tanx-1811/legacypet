// Everything the app remembers lives in one folder on this computer (~/.legacypet by
// default): the settings, each pet's memory and a cache of the last scan. Nothing else.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const dataDir = () => process.env.LEGACYPET_HOME || join(homedir(), '.legacypet');

export const DEFAULT_CONFIG = {
  version: 1,
  consented: false, // set once someone allows LegacyPet to look in their folders
  roots: [],
  online: false, // read CI, issues and stars from GitHub too
  token: '', // a pasted GitHub token, used only when `online` is on
  notify: true,
  refreshMinutes: 15,
  favorite: null, // the project whose pet floats on the desktop
  float: false,
  floatBounds: null,
  hidden: [],
  options: {}, // per project: species, name, scenery, lang, wear picked in the app
  pinned: [], // projects kept at the top
  editor: null, // the code editor to open projects in (null: the first one found)
  terminal: null,
  ui: null,
  theme: null,
};

export const projectId = (path) => createHash('sha1').update(String(path)).digest('hex').slice(0, 12);

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// Writes through a temp file, so a crash never leaves half a JSON file behind.
function writeJson(file, value, mode) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, mode ? { mode } : undefined);
  renameSync(tmp, file);
}

export function createStore(dir = dataDir()) {
  const ensure = (sub = '') => {
    const path = join(dir, sub);
    mkdirSync(path, { recursive: true });
    return path;
  };
  const configFile = join(dir, 'config.json');
  const cacheFile = join(dir, 'cache.json');
  const petFile = (id) => join(dir, 'pets', `${id}.json`);

  return {
    dir,
    loadConfig() {
      const saved = readJson(configFile, {});
      return { ...DEFAULT_CONFIG, ...saved, options: { ...(saved.options ?? {}) } };
    },
    saveConfig(config) {
      ensure();
      // The file may hold a token: readable by this user only.
      writeJson(configFile, config, 0o600);
    },
    loadMemory(id) {
      return readJson(petFile(id), null);
    },
    saveMemory(id, state) {
      ensure('pets');
      writeJson(petFile(id), state);
    },
    loadCache() {
      return readJson(cacheFile, { projects: [] });
    },
    saveCache(cache) {
      ensure();
      writeJson(cacheFile, cache);
    },
    // "Forget everything": the settings, every pet's memory and the cache.
    reset() {
      for (const path of [configFile, cacheFile, join(dir, 'pets')]) {
        if (existsSync(path)) rmSync(path, { recursive: true, force: true });
      }
    },
  };
}
