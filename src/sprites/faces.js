// Expressions are tiny pixel stamps placed on each species' eye and mouth anchors.
// '.' is transparent, 'o' is the species outline, 'a'/'A' the species accent (beaks).
// Patterns wider than 2px grow toward the middle of the face; `mirror` flips the right eye.

export const FACE_COLORS = {
  w: '#ffffff',
  r: '#ff5d73',
  y: '#ffd23f',
  t: '#5ec8ff',
  k: '#ff8fab99',
  f: '#ff4d4daa',
  g: '#e9f5c9',
};

export const EYES = {
  normal: { rows: ['wo', 'oo'] },
  happy: { rows: ['.o.', 'o.o'] },
  closed: { rows: ['..', 'oo'] },
  star: { rows: ['.y.', 'yyy', '.y.'], dy: -1 },
  puppy: { rows: ['wwo', 'woo', 'ooo'], dy: -1 },
  teary: { rows: ['wo', 'oo', 't.'], mirror: true },
  squint: { rows: ['o..', '.oo', 'o..'], dy: -1, mirror: true },
  zombie: { perEye: [{ rows: ['gg', 'go'] }, { rows: ['..', 'oo'] }] },
};

export const MOUTHS = {
  smile: ['o..o', '.oo.'],
  grin: ['oooo', 'orro', '.oo.'],
  flat: ['.oo.'],
  frown: ['.oo.', 'o..o'],
  open: ['.oo.', 'orro', '.oo.'],
  wavy: ['o.o.', '.o.o'],
  stitch: ['.o.o', 'oooo', '.o.o'],
};

export const BEAKS = {
  smile: ['aaaa', '.AA.'],
  grin: ['aaaa', 'orro', 'AAAA'],
  flat: ['aaaa', '.AA.'],
  frown: ['.aa.', 'AAAA'],
  open: ['aaaa', 'orro', 'AAAA'],
  wavy: ['aaaa', 'A.AA'],
  stitch: ['aaaa', 'oAoA'],
};

// The same expressions at twice the resolution, for the pet on cards and in the park (the badge
// and the terminal keep the small ones above). An eye anchor covers a 4×4 block of these finer
// pixels. Patterns are drawn for the left eye and grow toward the middle of the face for the
// right one, like the small ones; `dx`/`dy` nudge them. 'i' is the iris (the outline color
// lifted toward white) and 'm' the inside of a mouth (the outline color warmed toward red).
export const EYES_HD = {
  normal: { rows: ['.oo.', 'owoo', 'oooo', 'oiio', '.oo.'] },
  happy: { rows: ['.oo.', 'o..o'], dy: 1 },
  closed: { rows: ['....', '....', 'oooo', '.oo.'] },
  star: { rows: ['..y..', '..y..', 'yyyyy', '.yyy.', '.y.y.'], dy: -1 },
  puppy: { rows: ['.oooo.', 'owwooo', 'owwooo', 'oooooo', 'oooowo', '.oooo.'], dy: -2 },
  teary: {
    perEye: [
      { rows: ['.oo.', 'owoo', 'oooo', 'oiio', '.oo.', 't...', 'tt..'] },
      { rows: ['.oo.', 'owoo', 'oooo', 'oiio', '.oo.', '...t', '..tt'] },
    ],
  },
  squint: { rows: ['oo....', '..oo..', '....oo', '..oo..', 'oo....'], dy: -1, mirror: true },
  zombie: { perEye: [{ rows: ['.oo.', 'oggo', 'ogoo', '.oo.'] }, { rows: ['o..o', '.oo.', '.oo.', 'o..o'] }] },
};

// Mouths sit in the 8×(2…6) block of the 4-wide mouth anchor.
export const MOUTHS_HD = {
  smile: { rows: ['o....o', '.oooo.'], dx: 1 },
  grin: { rows: ['oooooo', 'ommmmo', '.orro.', '..oo..'], dx: 1 },
  flat: { rows: ['oooo'], dx: 2, dy: 1 },
  frown: { rows: ['.oooo.', 'o....o'], dx: 1, dy: 1 },
  open: { rows: ['.oo.', 'ommo', 'orro', '.oo.'], dx: 2 },
  wavy: { rows: ['.o..o.', 'o.oo.o'], dx: 1, dy: 1 },
  stitch: { rows: ['.o..o.', 'oooooo', '.o..o.'], dx: 1 },
};

export const CHEEKS_HD = { k: ['kkkk', '.kk.'], f: ['ffff', '.ff.'] };

export const MOOD_FACES = {
  ecstatic: { eyes: 'happy', mouth: 'grin', cheeks: 'k' },
  happy: { eyes: 'normal', mouth: 'smile', cheeks: 'k', blink: true },
  party: { eyes: 'star', mouth: 'grin', cheeks: 'k' },
  hungry: { eyes: 'puppy', mouth: 'open', blink: true },
  sleepy: { eyes: 'closed', mouth: 'flat' },
  hibernating: { eyes: 'closed', mouth: 'flat' },
  sad: { eyes: 'teary', mouth: 'frown', blink: true },
  sick: { eyes: 'squint', mouth: 'wavy', cheeks: 'f' },
  zombie: { eyes: 'zombie', mouth: 'stitch' },
};
