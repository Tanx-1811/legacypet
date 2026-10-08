// Signature moves: every species has its own little trick, played every few seconds on good days.
// A move is one keyframe animation on the whole pet that idles for most of its cycle, so it
// layers on top of the mood animation (bounce, hop...) without fighting it. Transforms are in
// the pet's foot frame (0,0 = between its feet, y up is negative); `pivot: 'center'` spins it
// around the middle of its body instead. Some moves bring an effect: ninja clones, jet flames.

export const MOVE_MOODS = new Set(['happy', 'ecstatic', 'party']);

const T = (v) => `{transform:${v}}`;
const REST = 'translate(0,0) rotate(0) scale(1,1) skewX(0)';

export const MOVES = {
  // Slime: squashes flat, then springs up.
  squish: {
    frames: `0%,80%,100%${T(REST)}84%${T('translate(0,0) rotate(0) scale(1.25,.72) skewX(0)')}89%${T('translate(0,-12px) rotate(0) scale(.86,1.18) skewX(0)')}94%${T('translate(0,0) rotate(0) scale(1.12,.9) skewX(0)')}`,
  },
  // Cat: a long, lazy stretch.
  stretch: {
    frames: `0%,76%,100%${T(REST)}82%,92%${T('translate(0,0) rotate(0) scale(1.16,.86) skewX(0)')}`,
  },
  // Rubber duck: waddles left and right.
  waddle: {
    frames: `0%,76%,100%${T(REST)}80%${T('translate(-3px,0) rotate(-10deg) scale(1,1) skewX(0)')}84%${T('translate(0,0) rotate(10deg) scale(1,1) skewX(0)')}88%${T('translate(3px,0) rotate(-10deg) scale(1,1) skewX(0)')}92%${T('translate(0,0) rotate(10deg) scale(1,1) skewX(0)')}96%${T('translate(0,0) rotate(-4deg) scale(1,1) skewX(0)')}`,
  },
  // Crab: scuttles sideways, the only way it knows.
  sidestep: {
    frames: `0%,74%,100%${T(REST)}79%${T('translate(-10px,0) rotate(0) scale(1,1) skewX(0)')}82%${T('translate(-10px,-3px) rotate(0) scale(1,1) skewX(0)')}87%${T('translate(10px,0) rotate(0) scale(1,1) skewX(0)')}90%${T('translate(10px,-3px) rotate(0) scale(1,1) skewX(0)')}95%${T(REST)}`,
  },
  // Octopus: a wobbly, eight-armed wiggle.
  wiggle: {
    frames: `0%,78%,100%${T(REST)}81%${T('translate(0,0) rotate(0) scale(1,1) skewX(-12deg)')}84%${T('translate(0,0) rotate(0) scale(1,1) skewX(12deg)')}87%${T('translate(0,0) rotate(0) scale(1,1) skewX(-10deg)')}90%${T('translate(0,0) rotate(0) scale(1,1) skewX(10deg)')}94%${T('translate(0,0) rotate(0) scale(1,1) skewX(-4deg)')}`,
  },
  // Snake: slithers forward and back.
  slither: {
    frames: `0%,76%,100%${T(REST)}81%${T('translate(-6px,0) rotate(0) scale(1,1) skewX(14deg)')}86%${T('translate(6px,0) rotate(0) scale(1,1) skewX(-14deg)')}91%${T('translate(-3px,0) rotate(0) scale(1,1) skewX(8deg)')}96%${T(REST)}`,
  },
  // Cactus: in no hurry at all. A slow sway in the desert wind.
  sway: {
    duration: 9,
    frames: `0%,70%,100%${T(REST)}78%${T('translate(0,0) rotate(-6deg) scale(1,1) skewX(0)')}86%${T('translate(0,0) rotate(6deg) scale(1,1) skewX(0)')}93%${T('translate(0,0) rotate(-3deg) scale(1,1) skewX(0)')}`,
  },
  // Ninja fox: a blink-fast dash, leaving shadow clones behind.
  clone: {
    effect: 'clones',
    frames: `0%,82%,100%${T(REST)}85%${T('translate(-14px,0) rotate(0) scale(1,1) skewX(0)')}88%${T('translate(14px,0) rotate(0) scale(1,1) skewX(0)')}91%${T(REST)}`,
  },
  // Mecha: crouches, fires its jets and hovers.
  jet: {
    effect: 'flames',
    frames: `0%,76%,100%${T(REST)}80%${T('translate(0,4px) rotate(0) scale(1.08,.92) skewX(0)')}86%,93%${T('translate(0,-22px) rotate(0) scale(1,1) skewX(0)')}98%${T('translate(0,2px) rotate(0) scale(1.06,.94) skewX(0)')}`,
  },
  // Spirit dragon: rises and coils through the air.
  coil: {
    frames: `0%,74%,100%${T(REST)}80%${T('translate(0,-10px) rotate(-8deg) scale(1,1) skewX(0)')}86%${T('translate(0,-14px) rotate(8deg) scale(1,1) skewX(0)')}92%${T('translate(0,-8px) rotate(-5deg) scale(1,1) skewX(0)')}`,
  },
  // Magical bunny: a twirl on the spot, like a transformation sequence.
  twirl: {
    pivot: 'center',
    frames: `0%,78%,100%${T(REST)}82%${T('translate(0,-8px) rotate(0) scale(.2,1) skewX(0)')}85%${T('translate(0,-10px) rotate(0) scale(-1,1) skewX(0)')}88%${T('translate(0,-8px) rotate(0) scale(.2,1) skewX(0)')}91%${T('translate(0,-4px) rotate(0) scale(1,1) skewX(0)')}`,
  },
  // Night guardian: a backflip off the rooftop.
  backflip: {
    pivot: 'center',
    frames: `0%,78%${T(REST)}83%${T('translate(0,-16px) rotate(-180deg) scale(1,1) skewX(0)')}88%${T('translate(0,-12px) rotate(-360deg) scale(1,1) skewX(0)')}92%,100%${T('translate(0,0) rotate(-360deg) scale(1,1) skewX(0)')}`,
  },
  // Super pup: up, up and away, then a hero landing.
  fly: {
    frames: `0%,74%,100%${T(REST)}78%${T('translate(0,0) rotate(0) scale(1.1,.88) skewX(0)')}84%,91%${T('translate(4px,-26px) rotate(-8deg) scale(1,1) skewX(0)')}96%${T('translate(0,0) rotate(0) scale(1.08,.9) skewX(0)')}`,
  },
};

export const DEFAULT_MOVE = 'squish';
export const moveOf = (species) => (MOVES[species?.move] ? species.move : DEFAULT_MOVE);

// Effects show only while the move plays, on the same clock as the move.
export const EFFECT_FRAMES = {
  clones: '0%,82%,95%,100%{opacity:0}85%,91%{opacity:.45}',
  flames: '0%,82%,95%,100%{opacity:0}85%,93%{opacity:1}',
};

export function moveCss(id) {
  const move = MOVES[id];
  const effect = move.effect ? `@keyframes lp-fx-${move.effect}{${EFFECT_FRAMES[move.effect]}}.lp-fx-${move.effect}{opacity:0;animation:lp-fx-${move.effect} 7s linear infinite}` : '';
  return `@keyframes lp-mv-${id}{${move.frames}}.lp-mv-${id}{animation:lp-mv-${id} 7s ease-in-out infinite}${effect}`;
}

export const FLAME = { rows: ['.yy.', 'yooy', '.oo.', '..r.'], colors: { y: '#ffe066', o: '#ff8c1a', r: '#e63946' } };
