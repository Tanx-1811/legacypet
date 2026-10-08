import { hashString } from '../util/rng.js';

const PREFIX = ['Mo', 'Pi', 'Bu', 'Ko', 'Lu', 'Ze', 'Ta', 'Ni', 'Po', 'Ru', 'Mi', 'Do', 'Fi', 'Ga', 'Ju', 'Ki', 'Ba', 'No', 'Su', 'Wa'];
const SUFFIX = ['chi', 'xel', 'bbo', 'nko', 'mi', 'rin', 'po', 'zzy', 'ku', 'to', 'bun', 'ffin', 'lo', 'mo', 'ppy', 'ro', 'shi', 'nu', 'li', 'gi'];

// You don't name your pet. The repo does.
export function petName(fullName) {
  const h = hashString(fullName.toLowerCase());
  return PREFIX[h % PREFIX.length] + SUFFIX[(h >>> 8) % SUFFIX.length];
}

// One repo in 64 hatches a shiny pet. There is no way to reroll.
export const SHINY_ODDS = 64;
export const isShiny = (fullName) => hashString(`${fullName.toLowerCase()}#shiny`) % SHINY_ODDS === 0;
