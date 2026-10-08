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
