// How a maintainer can make the pet their own, beyond species and name: a new coat color
// (the `color` input) and a catchphrase it says on good days (the `motto` input).
import { hueOf } from '../util/color.js';

// Each color is the hue the pet's body turns to. `mono` drains the color out (a silver pet).
// The species keeps its details (eyes, capes, gems, flowers): only its own colors change.
export const PET_COLORS = {
  red: 0, orange: 24, gold: 45, lime: 88, green: 128, teal: 170, sky: 196, blue: 222, indigo: 248, purple: 276, pink: 322, mono: null,
};
export const COLOR_IDS = Object.keys(PET_COLORS);
export const MOTTO_MAX = 60;

// "teal" → { id: 'teal', hue: 170 }; "#ff8800" → { id: '#ff8800', hue: 32 }; "mono" → { id: 'mono', mono: true }.
// Empty or "auto" → null (the species' own colors).
export function parseColor(spec) {
  const value = String(spec ?? '').trim().toLowerCase();
  if (!value || value === 'auto' || value === 'default') return null;
  if (value === 'mono') return { id: 'mono', mono: true };
  if (value in PET_COLORS) return { id: value, hue: PET_COLORS[value] };
  if (/^#?[0-9a-f]{6}$/.test(value)) {
    const hex = value.startsWith('#') ? value : `#${value}`;
    return { id: hex, hue: hueOf(hex) };
  }
  throw new Error(`Unknown color "${spec}". Pick one of: auto, ${COLOR_IDS.join(', ')}, or a hex color like #ff8800`);
}

// The catchphrase: one line, short enough for the speech bubble.
export function cleanMotto(text) {
  const line = String(text ?? '').replace(/\s+/g, ' ').trim();
  return line ? [...line].slice(0, MOTTO_MAX).join('') : null;
}

// {name}, {repo}, {level}, {streak} and {days} fill in, so a motto can mention today's numbers.
export function fillMotto(motto, vars) {
  return motto.replace(/\{(name|repo|level|streak|days)\}/g, (_, key) => String(vars[key] ?? ''));
}
