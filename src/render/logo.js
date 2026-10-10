// LegacyPet's logo: a pet that just hatched, still wearing a piece of its eggshell.
// One 12×12 pixel grid for every place the logo appears: the pet card, the desktop app's icons
// (desktop/scripts/icons.js), and site/icon.svg plus the web app's sidebar, which inline LOGO_PATH.
// Draw it at whole pixels per cell (12, 24, 36px...) so the eyes and smile stay crisp.
export const LOGO = [
  '......###...',
  '....######..',
  '...#######..',
  '...##..#.#..',
  '..#.........',
  '...######...',
  '..########..',
  '.##.####.##.',
  '.##.####.##.',
  '.####..####.',
  '..########..',
  '...######...',
];

export const LOGO_PATH = LOGO.flatMap((row, y) => [...row.matchAll(/#+/g)].map((m) => `M${m.index} ${y}h${m[0].length}v1h-${m[0].length}z`)).join('');

// LegacyPet's teal: the logo's gradient (top, bottom), used as is in both light and dark mode.
export const BRAND = ['#26c4ad', '#0a8478'];
