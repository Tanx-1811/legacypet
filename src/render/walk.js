// Strolls: on a good day a pet doesn't just stand there, it walks around its home. Each pet
// has its own route (from its repo and the day): it sets off, stops to look around, wanders
// on and comes back to where it started, so a still picture (paused animations) shows it at home.
// A hungry pet trots over to its bowl to check, a zombie shambles; a sad, sick or sleepy pet
// stays put until it's cared for.
//
// Two animations on one clock: the stroll moves the pet and everything that follows it
// (shadow, pal, emblem, mood effects) along the ground, and the step rocks the pet itself
// from foot to foot with a little hop while it's walking.
import { createRng, hashString } from '../util/rng.js';

// Speeds are in cells of the species' grid per second, so big and small pictures walk alike.
const GAITS = {
  happy: { speed: 2.2, step: 0.36, stops: 2, pause: [2.5, 5], tilt: 4 },
  ecstatic: { speed: 3, step: 0.3, stops: 3, pause: [1.5, 3.5], tilt: 5 },
  party: { speed: 3.4, step: 0.28, stops: 3, pause: [1.2, 3], tilt: 5 },
  hungry: { speed: 2, step: 0.34, stops: 2, pause: [2.5, 4.5], tilt: 4, bowl: true },
  zombie: { speed: 0.8, step: 0.62, stops: 1, pause: [3, 6], tilt: 7 },
};
export const WALK_MOODS = new Set(Object.keys(GAITS));

const r1 = (v) => Math.round(v * 10) / 10;
const pct = (t, total) => `${Math.round((t / total) * 10000) / 100}%`;

// The route: legs between stops on the ground, as offsets from home (dx 0), with the pauses
// in between. `min`/`max` bound the offsets; `bowl` is the offset where it can peek in its bowl.
// Returns null when the pet stays put (its mood, or no room to walk).
export function walkPlan(mood, { seed, min, max, cell, bowl = null }) {
  const gait = GAITS[mood];
  if (!gait || !(cell > 0)) return null;
  const minGap = cell * 2;
  if (max - min < minGap * 1.5) return null;
  const rng = createRng(`${seed}|walk`);
  const pause = () => rng.range(...gait.pause);
  const stops = [];
  let at = 0;
  // Every stop is a few steps from the last one and from home, so no leg is a mere shuffle.
  const far = (to) => Math.abs(to - at) >= minGap && Math.abs(to) >= minGap;
  for (let i = 0; i < gait.stops; i++) {
    let to = gait.bowl && i === 0 && bowl != null && far(Math.round(bowl)) ? Math.round(bowl) : null;
    for (let tries = 0; to == null && tries < 8; tries++) {
      const pick = Math.round(rng.range(min, max));
      if (far(pick)) to = pick;
    }
    if (to == null) continue;
    stops.push(to);
    at = to;
  }
  if (!stops.length) return null;
  const speed = gait.speed * cell;
  const segments = [];
  let t = 0;
  let x = 0;
  for (const to of [...stops, 0]) {
    const rest = pause();
    segments.push({ walk: false, t0: t, t1: t + rest, x });
    t += rest;
    const dur = Math.max(0.8, Math.abs(to - x) / speed);
    segments.push({ walk: true, t0: t, t1: t + dur, from: x, to });
    t += dur;
    x = to;
  }
  return { duration: Math.round(t * 10) / 10, segments, step: gait.step, tilt: gait.tilt, hop: r1(Math.max(1, cell * 0.35)) };
}

// Keyframes with the stops that share a value merged into one rule.
function keyframes(name, stops) {
  const byValue = new Map();
  for (const [at, value] of stops) {
    if (!byValue.has(value)) byValue.set(value, []);
    const list = byValue.get(value);
    if (list.at(-1) !== at) list.push(at);
  }
  return `@keyframes ${name}{${[...byValue].map(([value, ats]) => `${ats.join(',')}{transform:${value}}`).join('')}}`;
}

// The CSS for a plan: `${name}-x` (the stroll) and `${name}-s` (the step).
export function walkCss(name, plan) {
  const end = plan.segments.at(-1).t1;
  const at = (t) => pct(t, end);
  const tx = (dx) => (dx ? `translateX(${dx}px)` : 'translateX(0)');
  const DOWN = 'translate(0,0) rotate(0)';
  const xs = [['0%', tx(0)]];
  const steps = [['0%', DOWN]];
  for (const seg of plan.segments) {
    if (!seg.walk) {
      xs.push([at(seg.t0), tx(seg.x)], [at(seg.t1), tx(seg.x)]);
      continue;
    }
    xs.push([at(seg.t1), tx(seg.to)]);
    // An even number of half steps, so every leg ends standing on both feet.
    const span = seg.t1 - seg.t0;
    const n = Math.max(2, Math.round(span / plan.step) * 2);
    const lean = Math.sign(seg.to - seg.from) * 2;
    for (let k = 0; k <= n; k++) {
      // Up on one foot, tipped toward the other, leaning a little into the walk.
      const tilt = (k % 4 === 1 ? -plan.tilt : plan.tilt) + lean;
      steps.push([at(seg.t0 + (span * k) / n), k % 2 ? `translate(0,${-plan.hop}px) rotate(${tilt}deg)` : DOWN]);
    }
  }
  xs.push(['100%', tx(0)]);
  steps.push(['100%', DOWN]);
  const anim = (cls) => `.${cls}{animation:${cls} ${plan.duration}s ease-in-out infinite}`;
  return keyframes(`${name}-x`, xs) + keyframes(`${name}-s`, steps) + anim(`${name}-x`) + anim(`${name}-s`);
}

// The class name a pet's stroll goes by: one per pet and spot, so a park's pets each keep theirs.
export const walkName = (key) => `lp-w${hashString(key).toString(36)}`;
