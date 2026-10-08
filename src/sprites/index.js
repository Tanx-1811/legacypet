import { hashString } from '../util/rng.js';
import blob from './species/blob.js';
import cactus from './species/cactus.js';
import cat from './species/cat.js';
import crab from './species/crab.js';
import duck from './species/duck.js';
import octopus from './species/octopus.js';
import snake from './species/snake.js';

export const SPECIES = { blob, cat, duck, crab, octopus, snake, cactus };
export const SPECIES_IDS = Object.keys(SPECIES);

// A few languages come with a matching pet. Everything else is decided by the repo's name.
export const LANGUAGE_SPECIES = { Rust: 'crab', Python: 'snake', 'Jupyter Notebook': 'snake' };

export function pickSpecies({ requested = 'auto', fullName, language }) {
  if (requested && requested !== 'auto') {
    const species = SPECIES[requested];
    if (!species) throw new Error(`Unknown species "${requested}". Pick one of: auto, ${SPECIES_IDS.join(', ')}`);
    return species;
  }
  if (language && LANGUAGE_SPECIES[language]) return SPECIES[LANGUAGE_SPECIES[language]];
  return SPECIES[SPECIES_IDS[hashString(`${fullName.toLowerCase()}#species`) % SPECIES_IDS.length]];
}
