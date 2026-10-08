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
