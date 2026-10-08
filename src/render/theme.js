export const FONT = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";

const CHROME = {
  light: {
    bg: '#ffffff', border: '#e3e8ef', text: '#1f2430', muted: '#6b7385',
    bubble: '#f5f7fb', 'bubble-border': '#d5dbe7', track: '#e6eaf1', shadow: 'rgba(0,0,0,.16)',
  },
  dark: {
    bg: '#0d1117', border: '#30363d', text: '#e6edf3', muted: '#8b949e',
    bubble: '#161b22', 'bubble-border': '#30363d', track: '#21262d', shadow: 'rgba(0,0,0,.45)',
  },
};

// In dark mode the scene turns to night: same pet, moon and stars instead of clouds.
const SKIES = {
  default: { light: ['#9ad9ff', '#e4f6ff'], dark: ['#0f1b3d', '#25386b'] },
  party: { light: ['#ffc8e4', '#fff1c9'], dark: ['#2a1442', '#55265c'] },
  sad: { light: ['#a9b6c6', '#dfe6ee'], dark: ['#151d29', '#2b3747'] },
  sick: { light: ['#cfe3bf', '#f1f7e8'], dark: ['#17241c', '#2e4235'] },
  zombie: { light: ['#8c84a8', '#cdc6dd'], dark: ['#1d1528', '#3a2d4d'] },
  hibernating: { light: ['#2c3e70', '#7f97cf'], dark: ['#0c1530', '#2a3d6e'] },
};

const GROUNDS = {
  default: { light: ['#79c267', '#5aa851'], dark: ['#2f6b3a', '#24552e'] },
  hungry: { light: ['#c9b867', '#ab9a4c'], dark: ['#5c5230', '#4a4126'] },
  zombie: { light: ['#7c6a58', '#5f5043'], dark: ['#3d3229', '#2e251e'] },
  hibernating: { light: ['#eef4ff', '#cfdcf5'], dark: ['#c9d6ee', '#a5b6d6'] },
};

// Each home's horizon (far, mid), water and, for sandy places, its own ground.
const HOME_COLORS = {
  meadow: { light: { far: '#a9d8a0', mid: '#8cc97c' }, dark: { far: '#1d3a34', mid: '#26503c' } },
  garden: { light: { far: '#9fcf8c', mid: '#8cc97c' }, dark: { far: '#20392f', mid: '#26503c' } },
  pond: {
    light: { far: '#7fb89a', mid: '#64a882', water: '#5fb8e8', water2: '#e4f7ff' },
    dark: { far: '#18342f', mid: '#1f4638', water: '#1d3f6e', water2: '#7ea6e0' },
  },
  beach: {
    light: { far: '#7fbf8f', mid: '#86c49a', water: '#3fa7e0', water2: '#e4f7ff', ground: ['#f3dc96', '#e3c472'] },
    dark: { far: '#1f3b3a', mid: '#22423d', water: '#173a6b', water2: '#6f93cf', ground: ['#6b5a3a', '#57492f'] },
  },
  reef: {
    light: { far: '#4f9fc4', mid: '#3f8fb8', water: '#1f7fd0', ground: ['#ecd7a0', '#d5bb78'] },
    dark: { far: '#163a66', mid: '#123056', water: '#0a2a5c', ground: ['#3d4560', '#2f3650'] },
  },
  jungle: {
    light: { far: '#5fae6a', mid: '#3f8f52', water: '#8fd3ff', water2: '#ffffff' },
    dark: { far: '#143424', mid: '#1a4a2c', water: '#2c5c8f', water2: '#9fc2ee' },
  },
  desert: {
    light: { far: '#e2a072', mid: '#f0c987', ground: ['#f3d79a', '#e0bd74'] },
    dark: { far: '#4a2f3a', mid: '#5a4536', ground: ['#6e5a3c', '#5a4930'] },
  },
};
const KEEP_GROUND = new Set(['zombie', 'hibernating']);

function vars(mode, mood, home) {
  const sky = (SKIES[mood] ?? SKIES.default)[mode];
  const { ground: sand, ...place } = (HOME_COLORS[home] ?? HOME_COLORS.meadow)[mode];
  const ground = (!KEEP_GROUND.has(mood) && sand) || (GROUNDS[mood] ?? GROUNDS.default)[mode];
  return { ...CHROME[mode], sky1: sky[0], sky2: sky[1], g1: ground[0], g2: ground[1], water: '#5fb8e8', water2: '#e4f7ff', ...place };
}

const decl = (o) => `svg{${Object.entries(o).map(([k, v]) => `--lp-${k}:${v}`).join(';')}}`;

// At night, fixed-color props (trees, palms, fences) dim along with the sky.
const DIM = '.lp-prop{filter:brightness(.6) saturate(.85)}';
const NIGHT = `.lp-day{display:none}${DIM}`;

function themeBlock(theme, mood, home) {
  const dim = mood === 'hibernating' ? DIM : '';
  if (theme === 'light') return `${decl(vars('light', mood, home))}.lp-night{display:none}${dim}`;
  if (theme === 'dark') return `${decl(vars('dark', mood, home))}${NIGHT}`;
  return `${decl(vars('light', mood, home))}.lp-night{display:none}${dim}`
    + `@media (prefers-color-scheme:dark){${decl(vars('dark', mood, home))}.lp-night{display:inline}${NIGHT}}`;
}

const STATIC_CSS = `
.lp-card{fill:var(--lp-bg);stroke:var(--lp-border)}
.lp-sky1{stop-color:var(--lp-sky1)}.lp-sky2{stop-color:var(--lp-sky2)}
.lp-ground{fill:var(--lp-g1)}.lp-ground2{fill:var(--lp-g2)}
.lp-shadow{fill:var(--lp-shadow)}
.lp-px{shape-rendering:crispEdges}
.lp-name{font:700 16px ${FONT};fill:var(--lp-text)}
.lp-sub{font:400 11px ${FONT};fill:var(--lp-muted)}
.lp-say{font:400 11.5px ${FONT};fill:var(--lp-text)}
.lp-label{font:400 11px ${FONT};fill:var(--lp-muted)}
.lp-val{font:700 11px ${FONT};fill:var(--lp-text)}
.lp-icon{font:400 11px ${FONT}}
.lp-trophy{font:400 14px ${FONT}}
.lp-foot{font:400 9.5px ${FONT};fill:var(--lp-muted)}
.lp-brand{font:700 9.5px ${FONT};fill:var(--lp-muted)}
.lp-mini-name{font:700 12px ${FONT};fill:var(--lp-text)}
.lp-tag{font:700 11px ${FONT};fill:var(--lp-text)}
.lp-tag-sub{font:400 9.5px ${FONT};fill:var(--lp-muted)}
.lp-mini-sub{font:400 9.5px ${FONT};fill:var(--lp-muted)}
.lp-z{font:700 12px ${FONT};fill:var(--lp-text)}
.lp-bit{font:700 10px ${FONT};fill:#3fb950}
.lp-bubble,.lp-thought{fill:var(--lp-bubble);stroke:var(--lp-bubble-border)}
.lp-tail{fill:var(--lp-bubble);stroke:var(--lp-bubble-border);stroke-linejoin:round}
.lp-seg,.lp-track{fill:var(--lp-track)}
.lp-good{fill:#3fb950}.lp-mid{fill:#e3b341}.lp-low{fill:#f85149}
.lp-xp{fill:#a371f7}
.lp-ink{fill:var(--lp-text)}
.lp-fly{fill:var(--lp-text)}
.lp-star{fill:#fff8d6}
.lp-snow{fill:#ffffff}
.lp-raindrop{fill:#5ec8ff}
.lp-firefly{fill:#fff59d}
.lp-string{fill:#5a1e1e}
.lp-far{fill:var(--lp-far)}.lp-mid{fill:var(--lp-mid)}
.lp-water{fill:var(--lp-water)}.lp-water2{fill:var(--lp-water2)}
.lp-ripple-line{stroke:var(--lp-water2)}
.lp-sea{fill:var(--lp-water);opacity:.38}
.lp-bubble-c{fill:none;stroke:#e4f7ff;stroke-width:1;opacity:.85}
.lp-bounce{animation:lp-bounce 2s ease-in-out infinite}
.lp-hop{animation:lp-hop 1s ease-in-out infinite}
.lp-breathe{animation:lp-breathe 4s ease-in-out infinite}
.lp-sway{animation:lp-sway 3s ease-in-out infinite}
.lp-shiver{animation:lp-shiver .35s linear infinite}
.lp-wobble{animation:lp-wobble 3s ease-in-out infinite}
.lp-growl{animation:lp-growl 3s linear infinite}
.lp-blink-open{animation:lp-blink-open 4s infinite}
.lp-blink-closed{opacity:0;animation:lp-blink-closed 4s infinite}
.lp-rise{animation:lp-rise 3s ease-out infinite both}
.lp-zz{animation:lp-zz 3s ease-out infinite both}
.lp-fall{animation:lp-fall 3s linear infinite}
.lp-drift{animation:lp-drift 9s linear infinite}
.lp-drip{animation:lp-drip 1.6s ease-in infinite both}
.lp-orbit{animation:lp-orbit 2.4s linear infinite}
.lp-twinkle{animation:lp-twinkle 2s ease-in-out infinite both}
.lp-burst{animation:lp-burst 2.4s ease-out infinite both}
.lp-float{animation:lp-float 3s ease-in-out infinite}
.lp-swing{animation:lp-swing 3s ease-in-out infinite}
.lp-cloud{animation:lp-cloud 14s ease-in-out infinite alternate}
.lp-alert{animation:lp-alert 1.2s steps(2) infinite}
.lp-flap{animation:lp-flap .5s steps(1) infinite}
.lp-fly{animation:lp-fly 16s linear infinite}
.lp-flutter{animation:lp-flutter 6s ease-in-out infinite}
.lp-sway-soft{animation:lp-sway-soft 5s ease-in-out infinite}
.lp-kelp{animation:lp-kelp 4s ease-in-out infinite}
.lp-spin{animation:lp-orbit 6s linear infinite}
.lp-mist{animation:lp-mist 9s ease-in-out infinite}
.lp-shoot{animation:lp-shoot 8s linear infinite}
.lp-aurora{animation:lp-aurora 6s ease-in-out infinite}
.lp-rainbow{animation:lp-rainbow 5s ease-in-out infinite}
.lp-wave{animation:lp-wave 3s ease-in-out infinite}
.lp-tide{animation:lp-tide 4s ease-in-out infinite}
.lp-ripple{animation:lp-ripple 3s ease-out infinite both}
.lp-bubble{animation:lp-bubble 5s ease-in infinite both}
.lp-swim{animation:lp-swim 14s linear infinite}
.lp-roll{animation:lp-roll 9s linear infinite}
.lp-ray{animation:lp-ray 5s ease-in-out infinite}
.lp-flow{animation:lp-flow 1s linear infinite both}
.lp-glow{animation:lp-glow 2s ease-in-out infinite}
.lp-haze{animation:lp-haze 2.2s ease-in-out infinite}
.lp-flag{animation:lp-flag 1.8s ease-in-out infinite}
.lp-bulb{animation:lp-bulb 1.2s steps(1) infinite}
.lp-twinkle-soft{animation:lp-twinkle-soft 2.5s ease-in-out infinite}
.lp-new{animation:lp-float 1.6s ease-in-out infinite}
.lp-aura{opacity:.8;animation:lp-aura 1.1s ease-in-out infinite}
@keyframes lp-aura{0%,100%{opacity:.45}50%{opacity:.95}}
@keyframes lp-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes lp-hop{0%,100%{transform:translateY(0)}35%{transform:translateY(-14px)}55%{transform:translateY(0)}65%{transform:translateY(-3px)}}
@keyframes lp-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.04,.96)}}
@keyframes lp-sway{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
@keyframes lp-shiver{0%,100%{transform:translateX(0)}25%{transform:translateX(-1.5px)}75%{transform:translateX(1.5px)}}
@keyframes lp-wobble{0%,60%,100%{transform:rotate(0)}68%{transform:rotate(-9deg)}78%{transform:rotate(8deg)}88%{transform:rotate(-4deg)}}
@keyframes lp-growl{0%,78%,100%{transform:translateX(0)}82%{transform:translateX(-2px)}86%{transform:translateX(2px)}90%{transform:translateX(-2px)}94%{transform:translateX(1px)}}
@keyframes lp-blink-open{0%,93%,100%{opacity:1}94%,98%{opacity:0}}
@keyframes lp-blink-closed{0%,93%,100%{opacity:0}94%,98%{opacity:1}}
@keyframes lp-rise{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(-34px);opacity:0}}
@keyframes lp-zz{0%{transform:translate(0,0);opacity:0}20%{opacity:1}100%{transform:translate(10px,-26px);opacity:0}}
@keyframes lp-fall{0%{transform:translateY(-20px) rotate(0)}100%{transform:translateY(260px) rotate(540deg)}}
@keyframes lp-drift{0%{transform:translate(0,-20px) rotate(0)}50%{transform:translate(14px,110px) rotate(160deg)}100%{transform:translate(-8px,260px) rotate(340deg)}}
@keyframes lp-drip{0%{transform:translateY(0);opacity:0}15%{opacity:1}100%{transform:translateY(16px);opacity:0}}
@keyframes lp-orbit{to{transform:rotate(360deg)}}
@keyframes lp-twinkle{0%,100%{opacity:.15}50%{opacity:1}}
@keyframes lp-burst{0%{transform:scale(.1);opacity:0}10%{opacity:1}70%{opacity:.9}100%{transform:scale(1.3);opacity:0}}
@keyframes lp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes lp-swing{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
@keyframes lp-cloud{from{transform:translateX(-6px)}to{transform:translateX(10px)}}
@keyframes lp-alert{0%{opacity:1}50%{opacity:.35}}
@keyframes lp-flap{0%{opacity:1}50%{opacity:0}}
@keyframes lp-fly{from{transform:translate(-40px,0)}50%{transform:translate(130px,-8px)}to{transform:translate(300px,4px)}}
@keyframes lp-flutter{0%,100%{transform:translate(0,0)}25%{transform:translate(14px,-9px)}50%{transform:translate(24px,1px)}75%{transform:translate(9px,7px)}}
@keyframes lp-sway-soft{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
@keyframes lp-kelp{0%,100%{transform:skewX(-9deg)}50%{transform:skewX(9deg)}}
@keyframes lp-mist{0%,100%{transform:translateX(-14px)}50%{transform:translateX(14px)}}
@keyframes lp-shoot{0%,86%{transform:translate(0,0);opacity:0}88%{opacity:1}100%{transform:translate(-70px,36px);opacity:0}}
@keyframes lp-aurora{0%,100%{opacity:.15;transform:translateX(-6px)}50%{opacity:.45;transform:translateX(6px)}}
@keyframes lp-rainbow{0%,100%{opacity:.25}50%{opacity:.6}}
@keyframes lp-wave{0%,100%{transform:translateX(0)}50%{transform:translateX(-7px)}}
@keyframes lp-tide{0%,100%{transform:translateY(0);opacity:.2}50%{transform:translateY(4px);opacity:.9}}
@keyframes lp-ripple{0%{transform:scale(.2);opacity:.9}100%{transform:scale(1.5);opacity:0}}
@keyframes lp-bubble{0%{transform:translate(0,0);opacity:0}10%{opacity:.9}50%{transform:translate(4px,-80px)}100%{transform:translate(-3px,-170px);opacity:0}}
@keyframes lp-swim{from{transform:translateX(0)}50%{transform:translate(-160px,-6px)}to{transform:translateX(-340px)}}
@keyframes lp-roll{0%{transform:translate(0,0)}20%{transform:translate(60px,-6px)}25%{transform:translate(75px,0)}55%{transform:translate(165px,-8px)}60%{transform:translate(180px,0)}100%{transform:translate(300px,0)}}
@keyframes lp-ray{0%,100%{opacity:.04}50%{opacity:.2}}
@keyframes lp-flow{0%{transform:translateY(-4px);opacity:0}25%{opacity:1}100%{transform:translateY(24px);opacity:0}}
@keyframes lp-glow{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes lp-haze{0%,100%{transform:scale(1,1);opacity:.15}50%{transform:scale(1,2.5);opacity:.4}}
@keyframes lp-flag{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
@keyframes lp-bulb{0%{opacity:1}50%{opacity:.25}}
@keyframes lp-twinkle-soft{0%,100%{opacity:.75}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
`.replace(/\n/g, '');

export const buildCss = ({ theme = 'auto', mood, home = 'meadow' }) => themeBlock(theme, mood, home) + STATIC_CSS;
