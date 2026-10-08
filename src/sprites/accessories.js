// Hats sit on a species' `hat` anchor: [center column, top row of the head].
// Their bottom row overlaps the head outline so they look snug.
export const HATS = {
  party: {
    rows: ['..yy..', '..oo..', '.ohho.', '.oyyo.', 'ohhhho', 'oyyyyo'],
    colors: { o: '#4a1d5c', h: '#ff5fa2', y: '#ffd23f' },
  },
  crown: {
    rows: ['y..yy..y', 'yy.yy.yy', 'yyyrryyy', 'dddddddd'],
    colors: { y: '#ffd23f', d: '#c99a06', r: '#ff4d6d' },
  },
  nightcap: {
    rows: ['.....oow', '....obo.', '..oobbo.', '.obbbbbo', 'wwwwwwww'],
    colors: { o: '#1b2a4a', b: '#6b8cff', w: '#eef3ff' },
  },
  santa: {
    rows: ['.....oow', '....obo.', '..oobbo.', '.obbbbbo', 'wwwwwwww'],
    colors: { o: '#5c0f14', b: '#e63946', w: '#ffffff' },
  },
  witch: {
    rows: ['.....oo...', '....obbo..', '...obbbo..', '..oaaaaao.', 'oooooooooo'],
    colors: { o: '#1a1023', b: '#3d2a5c', a: '#b388ff' },
  },
  icepack: {
    rows: ['.oooo.', 'occcco', 'occcco'],
    colors: { o: '#2b4a6b', c: '#a8e6ff' },
    dy: 1,
  },
  sprout: {
    rows: ['gg..gg', '.gddg.', '..dd..'],
    colors: { g: '#7ee081', d: '#3c8a4b' },
  },
  flower: {
    rows: ['.pp.', 'pyyp', '.pp.'],
    colors: { p: '#ff7eb6', y: '#ffd23f' },
  },
  // Wardrobe hats (engine/items.js).
  cap: {
    rows: ['..oooo....', '.obbbbo...', 'obbwwbbo..', 'obbbbbbovv', 'oooooooooo'],
    colors: { o: '#1b2a4a', b: '#e63946', w: '#ffffff', v: '#b0222d' },
  },
  bow: {
    rows: ['oo....oo', 'orroorro', 'orrkkrro', 'orroorro', 'oo....oo'],
    colors: { o: '#7a1d3a', r: '#ff5fa2', k: '#ffd23f' },
  },
  beanie: {
    rows: ['...ww...', '..obbo..', '.obbbbo.', 'obbbbbbo', 'rrrrrrrr'],
    colors: { o: '#1f3b57', b: '#4cc9f0', w: '#ffffff', r: '#2b8fb3' },
  },
  headphones: {
    rows: [
      '....oooooooo....', '...o........o...', '..o..........o..', '.o............o.',
      'cc............cc', 'cC............Cc', 'cc............cc',
    ],
    colors: { o: '#2f343b', c: '#ff5fa2', C: '#ffd23f' },
    dy: 3,
  },
  halo: {
    rows: ['.yyyyyy.', 'y......y', '.yyyyyy.'],
    colors: { y: '#ffe066' },
    dy: -3,
  },
  tiara: {
    rows: ['...pp...', '.y.yy.y.', 'yyyyyyyy'],
    colors: { y: '#e0e6ff', p: '#ff7eb6' },
  },
  wizard: {
    rows: ['......oo..', '.....obo..', '....obbo..', '...obybo..', '..obbbbbo.', '.obbybbbbo', 'oooooooooo'],
    colors: { o: '#1a1a3d', b: '#3a56d4', y: '#ffd23f' },
  },
};

// Pals follow the pet around (engine/items.js).
export const PALS = {
  chick: {
    rows: ['.oooo..', 'oyyyyo.', 'oykyyob', 'oyyyyo.', '.oooo..'],
    colors: { o: '#c99a06', y: '#ffe066', k: '#1b1b2f', b: '#ff8c42' },
    motion: 'hop',
  },
  bird: {
    rows: ['..ooo..', '.obbkoy', 'obbbbo.', '.obbbbo', '..o.o..'],
    colors: { o: '#1b3a5c', b: '#5ec8ff', k: '#1b1b2f', y: '#ffb703' },
    motion: 'fly',
  },
  butterfly: {
    rows: ['pp...pp', 'pPpkpPp', '.ppkpp.', 'pPpkpPp', 'pp...pp'],
    colors: { p: '#ff7eb6', P: '#ffd23f', k: '#3b2416' },
    motion: 'fly',
  },
  ghost: {
    rows: ['.ooooo.', 'owwwwwo', 'owkwkwo', 'owwwwwo', 'owwwwwo', 'owowowo'],
    colors: { o: '#9aa0ae', w: '#f5f7ff', k: '#1b1b2f' },
    motion: 'fly',
  },
  drone: {
    rows: ['...ccc...', '..cwwwc..', 'ommmmmmmo', '.oyoyoyo.'],
    colors: { c: '#a8e6ff', w: '#e4f7ff', m: '#8a93a6', o: '#4a4f5c', y: '#ffd23f' },
    motion: 'fly',
  },
};

// Evolution emblems (engine/evolution.js), floating by the pet's head.
export const EMBLEMS = {
  swift: {
    rows: ['....kk.', '...kyk.', '..kyyk.', '.kyyyyk', '..kyyk.', '.kyk...', '.kk....'],
    colors: { k: '#12324a', y: '#5ec8ff' },
  },
  guardian: {
    rows: ['kkkkkkk', 'kgGGGgk', 'kgGGGgk', 'kgGGGgk', '.kgGgk.', '..kgk..', '...k...'],
    colors: { k: '#163d22', g: '#2f8f46', G: '#7ee081' },
  },
  social: {
    rows: ['.kk.kk.', 'kppkppk', 'kpPpppk', 'kpppppk', '.kpppk.', '..kpk..', '...k...'],
    colors: { k: '#5c0f2e', p: '#ff5fa2', P: '#ffd0e4' },
  },
  sage: {
    rows: ['...k...', '..ksk..', 'kkssskk', 'ksSsSsk', '.ksssk.', '.ksksk.', '.kk.kk.'],
    colors: { k: '#2d1a5c', s: '#8a5cf6', S: '#e2d4ff' },
  },
};

export const GEAR_COLORS = { monocle: '#ffd23f', glasses: '#4c6ef5', shades: '#1b1b2f', glint: '#8fa6d6' };

export const BOWLS = {
  full: ['...kKkKkk...', '.kKkkKkKkKk.', 'oooooooooooo', '.obbbbbbbbo.', '..oooooooo..'],
  half: ['............', '..kKkkKkKk..', 'oooooooooooo', '.obbbbbbbbo.', '..oooooooo..'],
  empty: ['............', '............', 'oooooooooooo', '.obbbbbbbbo.', '..oooooooo..'],
};
export const BOWL_COLORS = { o: '#1b3a5c', b: '#5ec8ff' };
export const KIBBLE_COLORS = { k: '#c47a3a', K: '#e8a35e' };
export const WATER_COLORS = { k: '#4cc9f0', K: '#a8e6ff' };

export const TOMBSTONE = {
  rows: ['..oooo..', '.oggggo.', 'oggggggo', 'ogoooogo', 'oggggggo', 'ogoogggo', 'oggggggo', 'oggggggo', 'oooooooo'],
  colors: { o: '#4a4f5c', g: '#9aa0ae' },
};

export const PUMPKIN = {
  rows: ['...g...', '.ooooo.', 'opppppo', 'opypypo', 'opppppo', 'opyyypo', '.ooooo.'],
  colors: { o: '#7a2e00', p: '#ff8c1a', y: '#ffe066', g: '#3c8a4b' },
};

export const LANTERN = {
  rows: ['..o..', '.ooo.', 'rryrr', 'rrrrr', 'rryrr', '.ooo.', '..y..'],
  colors: { o: '#5a1e1e', r: '#e63946', y: '#ffd166' },
};

export const CLOUD = ['...www...', '.wwwwwww.', 'wwwwwwwww', '.wwwwwww.'];
export const RAINCLOUD = {
  rows: ['...cccc...', '.cccccccc.', 'cccccccccc', '.CCCCCCCC.'],
  colors: { c: '#9aa5b8', C: '#7a8599' },
};
export const MOON = { rows: ['..mmm.', '.mm...', 'mm....', 'mm....', '.mm...', '..mmm.'], colors: { m: '#fff3b0' } };
export const SUN = {
  rows: ['..yyyy..', '.yyyyyy.', 'yyyyyyyy', 'yyyyyyyy', 'yyyyyyyy', 'yyyyyyyy', '.yyyyyy.', '..yyyy..'],
  colors: { y: '#ffd23f' },
};

export const HEART = ['rr.rr', 'rrrrr', '.rrr.', '..r..'];
export const NOTE = ['..oo', '..o.', '..o.', 'ooo.', 'oo..'];
export const DROP = ['.t.', 'ttt', 'ttt', '.t.'];
export const LEAF = ['.ll', 'lll', 'll.'];
export const PETAL = ['pp', 'p.'];
export const SPARK = ['.y.', 'yyy', '.y.'];
export const DRUMSTICK = { rows: ['.mmm..', 'mmmmm.', 'mmmmm.', '.mmmw.', '....ww'], colors: { m: '#c8642c', w: '#fff3e0' } };
export const WATER = { rows: ['..t..', '.ttt.', 'ttttt', 'ttttt', '.ttt.'], colors: { t: '#4cc9f0' } };
