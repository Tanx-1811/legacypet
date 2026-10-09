import { hashString } from '../util/rng.js';
import alien from './species/alien.js';
import axolotl from './species/axolotl.js';
import baku from './species/baku.js';
import bat from './species/bat.js';
import blob from './species/blob.js';
import bunny from './species/bunny.js';
import cactus from './species/cactus.js';
import cat from './species/cat.js';
import crab from './species/crab.js';
import daruma from './species/daruma.js';
import dragon from './species/dragon.js';
import duck from './species/duck.js';
import frog from './species/frog.js';
import ghost from './species/ghost.js';
import golem from './species/golem.js';
import hero from './species/hero.js';
import idol from './species/idol.js';
import kaiju from './species/kaiju.js';
import kappa from './species/kappa.js';
import kitsune from './species/kitsune.js';
import knight from './species/knight.js';
import kodama from './species/kodama.js';
import maneki from './species/maneki.js';
import mecha from './species/mecha.js';
import mimic from './species/mimic.js';
import monkey from './species/monkey.js';
import ninja from './species/ninja.js';
import octopus from './species/octopus.js';
import oni from './species/oni.js';
import owl from './species/owl.js';
import panda from './species/panda.js';
import penguin from './species/penguin.js';
import phoenix from './species/phoenix.js';
import pirate from './species/pirate.js';
import raiju from './species/raiju.js';
import sakura from './species/sakura.js';
import samurai from './species/samurai.js';
import shark from './species/shark.js';
import snake from './species/snake.js';
import tanuki from './species/tanuki.js';
import tengu from './species/tengu.js';
import vampire from './species/vampire.js';
import witch from './species/witch.js';

export const SPECIES = {
  blob, cat, duck, crab, octopus, snake, cactus,
  // The hero squad: original characters inspired by anime and superhero cartoons.
  ninja, mecha, dragon, bunny, bat, hero,
  // The anime crew: thirty more, from Japanese folklore to anime and game classics.
  samurai, kitsune, tanuki, oni, kappa, tengu, baku, maneki, daruma, kodama, ghost, idol, witch,
  knight, golem, phoenix, panda, kaiju, shark, penguin, axolotl, frog, owl, monkey, alien, vampire,
  raiju, pirate, sakura, mimic,
};
export const SPECIES_IDS = Object.keys(SPECIES);

// Where a pet lives. Every species has a `home`; the `scenery` option can move it elsewhere.
export const HOMES = ['meadow', 'garden', 'pond', 'beach', 'reef', 'jungle', 'desert'];

export function pickHome(requested, species) {
  if (!requested || requested === 'auto') return species.home ?? 'meadow';
  if (!HOMES.includes(requested)) throw new Error(`Unknown scenery "${requested}". Pick one of: auto, ${HOMES.join(', ')}`);
  return requested;
}

// A few languages come with a matching pet. Everything else is decided by the repo's name.
export const LANGUAGE_SPECIES = { Rust: 'crab', Python: 'snake', 'Jupyter Notebook': 'snake' };

// `previous` is the species from the pet's memory: once a pet has hatched it keeps its
// species, even when new species join the pool and the repo's hash would pick another.
export function pickSpecies({ requested = 'auto', fullName, language, previous }) {
  if (requested && requested !== 'auto') {
    const species = SPECIES[requested];
    if (!species) throw new Error(`Unknown species "${requested}". Pick one of: auto, ${SPECIES_IDS.join(', ')}`);
    return species;
  }
  if (previous && SPECIES[previous]) return SPECIES[previous];
  if (language && LANGUAGE_SPECIES[language]) return SPECIES[LANGUAGE_SPECIES[language]];
  return SPECIES[SPECIES_IDS[hashString(`${fullName.toLowerCase()}#species`) % SPECIES_IDS.length]];
}
