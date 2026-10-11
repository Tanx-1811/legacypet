// How much the pets move. Every pet picture is an animated SVG, and pictures that move are what
// makes a computer work: as an <img>, an animated SVG is drawn again from scratch on the page's
// main thread every frame (a still picture costs nothing once it's drawn).
//   full: every pet moves, all the time.
//   lite: only the pet you're looking at moves; lists and grids hold still until pointed at,
//         and the pets rest when you're away from the window.
//   off:  nothing moves.
//   auto: off when the system asks for reduced motion, else lite.
export const MOTIONS = ['auto', 'full', 'lite', 'off'];

const reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export function resolveMotion(choice = 'auto') {
  if (choice !== 'auto' && MOTIONS.includes(choice)) return choice;
  return reduced?.matches ? 'off' : 'lite';
}

// Calls `fn` when the system's reduced-motion preference changes.
export const onMotionPreference = (fn) => reduced?.addEventListener?.('change', fn);

// A pet picture that moves: the SVG itself, inline, in a shadow root (so its styles and ids
// stay its own). Inline, the browser runs the picture's animations (all transforms and
// opacity) on the compositor instead of redrawing the whole picture on the main thread every
// frame, which is what an animated <img> does; and it can be paused in place (see restWhenAway).
// `cls` gives it the same box as the <img> it stands in for.
const LIVE_CSS = ':host{display:block}svg{display:block;width:100%;height:auto}'
  + '*{animation-play-state:var(--lp-play,running)!important}';
export function livePicture(svg, { cls = '', alt = '' } = {}) {
  const host = document.createElement('span');
  host.className = cls;
  host.setAttribute('role', 'img');
  if (alt) host.setAttribute('aria-label', alt);
  host.attachShadow({ mode: 'open' }).innerHTML = `<style>${LIVE_CSS}</style>${svg}`;
  return host;
}

// Resting: when nobody has touched the window for a while, or it has been in the background
// for a few seconds, every live picture pauses where it is; it moves on at the next touch.
// The browser already stops drawing a window that's hidden, but not one that's merely open
// beside the editor.
const REST_IDLE = 45_000;
const REST_AWAY = 6_000;
let resting = false;
let restOn = false;
let lastInput = 0;
let awaySince = null;
let restTimer = null;

function setRest(on) {
  if (on === resting) return;
  resting = on;
  if (on) document.documentElement.style.setProperty('--lp-play', 'paused');
  else document.documentElement.style.removeProperty('--lp-play');
}

function checkRest() {
  const now = performance.now();
  setRest(restOn && (now - lastInput > REST_IDLE || (awaySince != null && now - awaySince > REST_AWAY)));
}

function touched() {
  lastInput = performance.now();
  awaySince = null;
  if (resting) checkRest();
}

// `on`: pets rest when you're away (lite). Off: they keep moving (full).
export function restWhenAway(on) {
  restOn = Boolean(on);
  if (typeof document === 'undefined') return;
  lastInput = performance.now();
  clearInterval(restTimer);
  restTimer = restOn ? setInterval(checkRest, 2000) : null;
  checkRest();
}

if (typeof document !== 'undefined') {
  for (const type of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']) {
    addEventListener(type, touched, { passive: true, capture: true });
  }
  addEventListener('focus', touched);
  addEventListener('blur', () => { awaySince = performance.now(); });
  if (!document.hasFocus()) awaySince = performance.now();
}

// An <img> that holds still and moves only while pointed at (or while its tile has focus).
// `still` and `live` return the two picture URLs; `live` is only made when it's first needed.
// Calling it again on the same <img> (a redraw) just swaps in the new pictures.
// The pointer has to rest on it for a moment: a list scrolling under the pointer, or a pointer
// on its way somewhere else, doesn't set every pet it passes moving.
const HOVER_DELAY = 180;
const pictures = new WeakMap();
const listening = new WeakSet();
export function hoverToMove(img, { still, live }) {
  let liveSrc = null;
  let timer = null;
  let playing = false;
  pictures.set(img, {
    play: () => {
      playing = true;
      img.src = (liveSrc ??= live());
    },
    stop: () => {
      clearTimeout(timer);
      if (!playing) return;
      playing = false;
      img.src = still();
    },
    later: () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (img.matches(':hover')) pictures.get(img)?.play(); }, HOVER_DELAY);
    },
  });
  if (!listening.has(img)) {
    listening.add(img);
    img.addEventListener('pointerenter', () => pictures.get(img)?.later());
    img.addEventListener('pointerleave', () => pictures.get(img)?.stop());
  }
  return img;
}

// Back to an ordinary picture (the motion setting changed).
export const stopHoverToMove = (img) => pictures.delete(img);

// Keyboard users get the same: a focused tile plays the pictures inside it.
if (typeof document !== 'undefined') {
  for (const [type, action] of [['focusin', 'play'], ['focusout', 'stop']]) {
    document.addEventListener(type, (e) => {
      if (!(e.target instanceof Element)) return;
      for (const img of e.target.querySelectorAll('img')) pictures.get(img)?.[action]();
    });
  }
}

// Builds a picture's SVG only when it comes near the screen: a long list of pets (the codex has
// dozens) then costs nothing for the ones nobody scrolls to. `load(img)` sets its src.
let nearScreen = null;
const loaders = new WeakMap();
export function whenNear(img, load) {
  if (typeof IntersectionObserver !== 'function') {
    load(img);
    return img;
  }
  nearScreen ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      nearScreen.unobserve(entry.target);
      loaders.get(entry.target)?.(entry.target);
      loaders.delete(entry.target);
    }
  }, { rootMargin: '600px 0px' });
  loaders.set(img, load);
  nearScreen.observe(img);
  return img;
}
