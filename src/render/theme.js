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

function vars(mode, mood) {
  const sky = (SKIES[mood] ?? SKIES.default)[mode];
  const ground = (GROUNDS[mood] ?? GROUNDS.default)[mode];
  return { ...CHROME[mode], sky1: sky[0], sky2: sky[1], g1: ground[0], g2: ground[1] };
}

const decl = (o) => `svg{${Object.entries(o).map(([k, v]) => `--lp-${k}:${v}`).join(';')}}`;

function themeBlock(theme, mood) {
  if (theme === 'light') return `${decl(vars('light', mood))}.lp-night{display:none}`;
  if (theme === 'dark') return `${decl(vars('dark', mood))}.lp-day{display:none}`;
  return `${decl(vars('light', mood))}.lp-night{display:none}`
    + `@media (prefers-color-scheme:dark){${decl(vars('dark', mood))}.lp-night{display:inline}.lp-day{display:none}}`;
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
.lp-new{animation:lp-float 1.6s ease-in-out infinite}
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
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
`.replace(/\n/g, '');

export const buildCss = ({ theme = 'auto', mood }) => themeBlock(theme, mood) + STATIC_CSS;
