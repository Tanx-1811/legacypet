// How much the pets move. Every pet picture is an animated SVG, and many of them moving at once
// is what makes a slow computer struggle (a still picture costs nothing once it's drawn).
//   full: every pet moves.
//   lite: only the pet you're looking at moves; lists and grids hold still until pointed at.
//   off:  nothing moves.
//   auto: off when the system asks for reduced motion, lite on a smaller computer, else full.
export const MOTIONS = ['auto', 'full', 'lite', 'off'];

const reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
// Four threads or less, or 4 GB of memory or less (only Chromium tells), counts as small.
export const smallDevice = (globalThis.navigator?.hardwareConcurrency ?? 8) <= 4 || (globalThis.navigator?.deviceMemory ?? 8) <= 4;

export function resolveMotion(choice = 'auto') {
  if (choice !== 'auto' && MOTIONS.includes(choice)) return choice;
  if (reduced?.matches) return 'off';
  return smallDevice ? 'lite' : 'full';
}

// Calls `fn` when the system's reduced-motion preference changes.
export const onMotionPreference = (fn) => reduced?.addEventListener?.('change', fn);

// An <img> that holds still and moves only while pointed at (or while its tile has focus).
// `still` and `live` return the two picture URLs; `live` is only made when it's first needed.
const pictures = new WeakMap();
export function hoverToMove(img, { still, live }) {
  let liveSrc = null;
  pictures.set(img, {
    play: () => { img.src = (liveSrc ??= live()); },
    stop: () => { img.src = still(); },
  });
  img.addEventListener('pointerenter', () => pictures.get(img).play());
  img.addEventListener('pointerleave', () => pictures.get(img).stop());
  return img;
}

// Keyboard users get the same: a focused tile plays the pictures inside it.
if (typeof document !== 'undefined') {
  for (const [type, action] of [['focusin', 'play'], ['focusout', 'stop']]) {
    document.addEventListener(type, (e) => {
      if (!(e.target instanceof Element)) return;
      for (const img of e.target.querySelectorAll('img')) pictures.get(img)?.[action]();
    });
  }
}
