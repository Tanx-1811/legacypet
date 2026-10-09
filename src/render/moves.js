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

  // The anime crew.
  // Ronin shiba: a crouch, then one lightning-fast draw of the sword.
  slash: {
    frames: `0%,76%,100%${T(REST)}80%${T('translate(-4px,2px) rotate(-6deg) scale(1.05,.92) skewX(0)')}84%${T('translate(14px,0) rotate(8deg) scale(1.1,.95) skewX(-18deg)')}88%,92%${T('translate(14px,0) rotate(0) scale(1,1) skewX(0)')}97%${T(REST)}`,
  },
  // Nine-tailed fox: a double spin that fans out every tail.
  tailspin: {
    pivot: 'center',
    frames: `0%,80%${T(REST)}90%${T('translate(0,-4px) rotate(720deg) scale(.92,.92) skewX(0)')}94%,100%${T('translate(0,0) rotate(720deg) scale(1,1) skewX(0)')}`,
  },
  // Leaf tanuki: shrinks to nothing with a leaf on its head and pops back as itself.
  poof: {
    pivot: 'center',
    frames: `0%,78%,100%${T(REST)}82%${T('translate(0,0) rotate(0) scale(1.15,.85) skewX(0)')}86%,89%${T('translate(0,-6px) rotate(0) scale(.1,.1) skewX(0)')}93%${T('translate(0,-2px) rotate(0) scale(1.2,1.2) skewX(0)')}97%${T('translate(0,0) rotate(0) scale(.95,1.05) skewX(0)')}`,
  },
  // Little oni: two heavy stomps that shake the ground.
  stomp: {
    frames: `0%,74%,100%${T(REST)}79%${T('translate(0,-14px) rotate(0) scale(.95,1.08) skewX(0)')}83%${T('translate(0,0) rotate(0) scale(1.2,.78) skewX(0)')}86%${T(REST)}89%${T('translate(0,-10px) rotate(0) scale(.96,1.06) skewX(0)')}92%${T('translate(0,0) rotate(0) scale(1.18,.8) skewX(0)')}96%${T(REST)}`,
  },
  // Kappa: a deep, polite bow (careful, the water dish!).
  bow: {
    frames: `0%,76%,100%${T(REST)}82%,90%${T('translate(0,0) rotate(24deg) scale(1,.96) skewX(0)')}95%${T('translate(0,0) rotate(-4deg) scale(1,1) skewX(0)')}`,
  },
  // Crow tengu: a gust from its fan lifts it into a little whirlwind.
  gale: {
    frames: `0%,76%,100%${T(REST)}80%${T('translate(0,-8px) rotate(0) scale(.9,1.1) skewX(20deg)')}84%${T('translate(-6px,-12px) rotate(0) scale(1,1) skewX(-20deg)')}88%${T('translate(6px,-12px) rotate(0) scale(1,1) skewX(20deg)')}92%${T('translate(0,-6px) rotate(0) scale(1,1) skewX(-8deg)')}96%${T(REST)}`,
  },
  // Dream eater: nods off, sinks, then wakes with a start.
  doze: {
    duration: 9,
    frames: `0%,70%,100%${T(REST)}80%${T('translate(0,2px) rotate(-10deg) scale(1.03,.97) skewX(0)')}88%${T('translate(0,3px) rotate(-14deg) scale(1.04,.96) skewX(0)')}91%${T('translate(0,-6px) rotate(0) scale(.96,1.06) skewX(0)')}95%${T(REST)}`,
  },
  // Lucky cat: bobs and beckons, three times for luck.
  beckon: {
    frames: `0%,77%,100%${T(REST)}80%,86%,92%${T('translate(0,-4px) rotate(-6deg) scale(1,1) skewX(0)')}83%,89%${T('translate(0,0) rotate(-2deg) scale(1,1) skewX(0)')}96%${T(REST)}`,
  },
  // Daruma: tips right over and rocks back up. It always gets back up.
  wobble: {
    frames: `0%,78%,100%${T(REST)}82%${T('translate(0,0) rotate(-28deg) scale(1,1) skewX(0)')}86%${T('translate(0,0) rotate(20deg) scale(1,1) skewX(0)')}89%${T('translate(0,0) rotate(-12deg) scale(1,1) skewX(0)')}92%${T('translate(0,0) rotate(7deg) scale(1,1) skewX(0)')}95%${T('translate(0,0) rotate(-3deg) scale(1,1) skewX(0)')}`,
  },
  // Forest spirit: rattles its head, click-clack, like the spirits do.
  rattle: {
    pivot: 'center',
    frames: `0%,79%,92%,100%${T(REST)}80%,84%,88%${T('translate(0,0) rotate(-6deg) scale(1,1) skewX(0)')}82%,86%,90%${T('translate(0,0) rotate(6deg) scale(1,1) skewX(0)')}`,
  },
  // Yurei: drifts up and wafts side to side before sinking back.
  haunt: {
    frames: `0%,72%,100%${T(REST)}80%${T('translate(-6px,-12px) rotate(0) scale(1,1) skewX(10deg)')}86%${T('translate(6px,-16px) rotate(0) scale(1,1) skewX(-10deg)')}92%${T('translate(0,-8px) rotate(0) scale(1,1) skewX(4deg)')}97%${T(REST)}`,
  },
  // Star idol: a pose left, a pose right, and a jump for the finale.
  encore: {
    frames: `0%,78%,100%${T(REST)}81%${T('translate(-4px,-8px) rotate(-12deg) scale(1,1) skewX(0)')}84%,90%${T(REST)}87%${T('translate(4px,-8px) rotate(12deg) scale(1,1) skewX(0)')}94%${T('translate(0,-12px) rotate(0) scale(1.08,1.08) skewX(0)')}`,
  },
  // Little witch: hops on the broom for a quick loop around the garden.
  broom: {
    frames: `0%,76%,100%${T(REST)}80%${T('translate(0,2px) rotate(0) scale(1.06,.94) skewX(0)')}85%${T('translate(-14px,-18px) rotate(-14deg) scale(1,1) skewX(0)')}90%${T('translate(10px,-22px) rotate(12deg) scale(1,1) skewX(0)')}95%${T('translate(0,0) rotate(0) scale(1.04,.96) skewX(0)')}`,
  },
  // Isekai knight: braces behind the shield, then a shield bash.
  guard: {
    frames: `0%,78%,100%${T(REST)}82%,88%${T('translate(-3px,2px) rotate(-6deg) scale(1.04,.94) skewX(0)')}91%${T('translate(8px,0) rotate(6deg) scale(1,1) skewX(0)')}95%${T(REST)}`,
  },
  // Stone golem: a ground pound and a little earthquake.
  quake: {
    frames: `0%,76%,95%,100%${T(REST)}80%${T('translate(0,-8px) rotate(0) scale(1.04,1.04) skewX(0)')}83%${T('translate(0,0) rotate(0) scale(1.1,.9) skewX(0)')}85%,89%${T('translate(-2px,0) rotate(0) scale(1,1) skewX(0)')}87%,91%${T('translate(2px,0) rotate(0) scale(1,1) skewX(0)')}93%${T('translate(-1px,0) rotate(0) scale(1,1) skewX(0)')}`,
  },
  // Phoenix chick: rises high, flares up bigger, and floats back down.
  rise: {
    frames: `0%,72%,100%${T(REST)}82%${T('translate(0,-24px) rotate(-4deg) scale(1.12,1.12) skewX(0)')}88%${T('translate(0,-24px) rotate(4deg) scale(1.18,1.18) skewX(0)')}96%${T(REST)}`,
  },
  // Monk panda: winds up and throws a flying kick.
  kick: {
    frames: `0%,78%,100%${T(REST)}82%${T('translate(-3px,0) rotate(-14deg) scale(1,1) skewX(0)')}86%${T('translate(6px,-8px) rotate(24deg) scale(1,1) skewX(-8deg)')}90%${T('translate(6px,-4px) rotate(10deg) scale(1,1) skewX(0)')}95%${T(REST)}`,
  },
  // Mini kaiju: rears up to full size and roars until it shakes.
  roar: {
    frames: `0%,76%,100%${T(REST)}80%${T('translate(0,2px) rotate(0) scale(1.06,.94) skewX(0)')}84%,90%${T('translate(0,-4px) rotate(0) scale(1.25,1.25) skewX(0)')}86%${T('translate(-1.5px,-4px) rotate(0) scale(1.25,1.25) skewX(0)')}88%${T('translate(1.5px,-4px) rotate(0) scale(1.25,1.25) skewX(0)')}94%${T(REST)}`,
  },
  // Shark pup: lunges forward, chomp chomp.
  chomp: {
    frames: `0%,78%,100%${T(REST)}82%${T('translate(-4px,0) rotate(0) scale(.92,1.04) skewX(0)')}86%,90%${T('translate(12px,0) rotate(0) scale(1.2,.9) skewX(0)')}88%${T('translate(12px,0) rotate(0) scale(1.05,1) skewX(0)')}95%${T(REST)}`,
  },
  // Ice penguin: dives forward onto its belly, slides away and pops back up.
  slide: {
    frames: `0%,76%,100%${T(REST)}80%${T('translate(0,2px) rotate(-35deg) scale(1.08,.86) skewX(0)')}87%${T('translate(-16px,2px) rotate(-35deg) scale(1.08,.86) skewX(0)')}90%${T('translate(-16px,-6px) rotate(0) scale(1,1) skewX(0)')}96%${T(REST)}`,
  },
  // Axolotl: a lazy double bob, like it's floating in the pond.
  float: {
    duration: 8,
    frames: `0%,74%,100%${T(REST)}80%${T('translate(0,-8px) rotate(-4deg) scale(1,1) skewX(0)')}86%${T('translate(0,-2px) rotate(3deg) scale(1,1) skewX(0)')}92%${T('translate(0,-7px) rotate(-2deg) scale(1,1) skewX(0)')}97%${T(REST)}`,
  },
  // Frog prince: crouches low and leaps.
  leap: {
    frames: `0%,76%,100%${T(REST)}79%${T('translate(0,2px) rotate(0) scale(1.15,.82) skewX(0)')}84%${T('translate(8px,-24px) rotate(8deg) scale(.9,1.12) skewX(0)')}89%${T('translate(0,0) rotate(0) scale(1.12,.88) skewX(0)')}93%${T(REST)}`,
  },
  // Owl sage: tilts its head one way, then all the way the other. Hoo?
  swivel: {
    pivot: 'center',
    frames: `0%,78%,100%${T(REST)}81%,85%${T('translate(0,0) rotate(-25deg) scale(1,1) skewX(0)')}88%,92%${T('translate(0,0) rotate(25deg) scale(1,1) skewX(0)')}96%${T(REST)}`,
  },
  // Monkey king: a forward somersault, like riding a cloud.
  somersault: {
    pivot: 'center',
    frames: `0%,78%${T(REST)}82%${T('translate(6px,-14px) rotate(180deg) scale(1,1) skewX(0)')}86%${T('translate(12px,-10px) rotate(360deg) scale(1,1) skewX(0)')}90%${T('translate(12px,0) rotate(360deg) scale(1,1) skewX(0)')}96%,100%${T('translate(0,0) rotate(360deg) scale(1,1) skewX(0)')}`,
  },
  // Space cadet: beamed up into a thin line of light, then beamed back.
  beam: {
    frames: `0%,76%,100%${T(REST)}80%${T('translate(0,0) rotate(0) scale(.6,1.4) skewX(0)')}84%,88%${T('translate(0,-20px) rotate(0) scale(.1,1.8) skewX(0)')}92%${T('translate(0,0) rotate(0) scale(.6,1.4) skewX(0)')}96%${T(REST)}`,
  },
  // Little vampire: crouches in its cape and swoops across the garden.
  swoop: {
    frames: `0%,78%,100%${T(REST)}82%${T('translate(0,2px) rotate(0) scale(1.1,.86) skewX(0)')}87%${T('translate(-12px,-16px) rotate(-10deg) scale(1,1) skewX(16deg)')}91%${T('translate(10px,-8px) rotate(8deg) scale(1,1) skewX(-12deg)')}96%${T(REST)}`,
  },
  // Thunder pup: zigzags around like a lightning bolt.
  zap: {
    frames: `0%,78%,100%${T(REST)}80%,82%${T('translate(-12px,-4px) rotate(0) scale(1,1) skewX(0)')}84%,86%${T('translate(10px,-10px) rotate(0) scale(1,1) skewX(0)')}88%,90%${T('translate(-6px,-14px) rotate(0) scale(1,1) skewX(0)')}92%,94%${T('translate(0,0) rotate(0) scale(1.1,.9) skewX(0)')}`,
  },
  // Captain otter: swings across on a rope, there and back.
  swing: {
    frames: `0%,78%,100%${T(REST)}82%${T('translate(-12px,-10px) rotate(16deg) scale(1,1) skewX(0)')}86%,94%${T('translate(0,-2px) rotate(0) scale(1,1) skewX(0)')}90%${T('translate(12px,-10px) rotate(-16deg) scale(1,1) skewX(0)')}97%${T(REST)}`,
  },
  // Sakura sprite: opens up like a blossom, turning its petals.
  bloom: {
    pivot: 'center',
    frames: `0%,78%,100%${T(REST)}83%${T('translate(0,-4px) rotate(-12deg) scale(1.18,1.18) skewX(0)')}88%${T('translate(0,-4px) rotate(12deg) scale(1.22,1.22) skewX(0)')}93%${T('translate(0,-2px) rotate(0) scale(.94,.94) skewX(0)')}97%${T(REST)}`,
  },
  // Mimic: snaps its lid twice, then hops. Was that chest always there?
  snap: {
    frames: `0%,78%,100%${T(REST)}81%,86%${T('translate(0,0) rotate(0) scale(1,1.2) skewX(0)')}83%,88%${T('translate(0,0) rotate(0) scale(1.1,.85) skewX(0)')}91%${T('translate(0,-8px) rotate(0) scale(1,1) skewX(0)')}95%${T(REST)}`,
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
