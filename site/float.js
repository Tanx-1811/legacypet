// The desktop pet: one pet in a tiny window that stays on top. Hover for snacks and games,
// click the pet to hear what it thinks. Used by the desktop app and by "Floating window".
import { renderMini, LANGS, commandReply } from './src/index.js';
import { api, desktop, listen, petOf } from './local.js';
import { hoverToMove, resolveMotion, stopHoverToMove } from './motion.js';

const params = new URLSearchParams(location.search);
if (params.has('transparent')) document.documentElement.classList.add('transparent');
const $ = (id) => document.getElementById(id);
const dark = matchMedia('(prefers-color-scheme: dark)');
const saved = () => {
  try { return JSON.parse(localStorage.getItem('legacypet.playground.v2')) ?? {}; } catch { return {}; }
};
const uiLang = () => saved().cfg?.lang ?? null;
// The app's motion setting (shared through this browser's storage, or the app's settings).
const motion = () => resolveMotion(saved().motion ?? state?.config?.motion ?? 'auto');
let state = null;
let project = null;
let hideTimer = null;

const SIZES = { small: '100px', medium: '132px', large: '176px' };

// `asked`: someone clicked the pet. Otherwise it's the pet speaking up on its own, which
// Settings can turn off.
function say(text, ms = 4500, { asked = false } = {}) {
  if (!asked && state?.config?.floatBubbles === false) return;
  const bubble = $('bubble');
  bubble.textContent = text;
  bubble.classList.add('show');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => bubble.classList.remove('show'), ms);
}

// Which pet sits here: the one asked for, the favorite, or the one that needs care most.
function choose() {
  const list = state?.projects?.filter((p) => p.summary) ?? [];
  const wanted = params.get('id') || state?.config?.favorite;
  const rank = { bad: 0, warn: 1, good: 2 };
  return list.find((p) => p.id === wanted)
    ?? list.slice().sort((a, b) => rank[a.summary.attention] - rank[b.summary.attention])[0] ?? null;
}

function draw() {
  project = choose();
  document.documentElement.style.setProperty('--pet-w', SIZES[state?.config?.floatSize] ?? SIZES.medium);
  const bar = $('bar');
  if (!project) {
    $('pet').removeAttribute('src');
    bar.replaceChildren();
    say('🥚', 60_000, { asked: true });
    return;
  }
  const lang = uiLang() ?? state.config.ui ?? 'en';
  const pet = petOf(project, { lang });
  // On 'lite' the pet holds still and wakes up while the pointer is on it: a pet that never
  // stops moving keeps a slow computer busy all day.
  const picture = (still) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderMini(pet, { theme: dark.matches ? 'dark' : 'light', still }))}`;
  const mode = motion();
  const img = $('pet');
  img.src = picture(mode !== 'full');
  if (mode === 'lite') hoverToMove(img, { still: () => picture(true), live: () => picture(false) });
  else stopHoverToMove(img);
  $('pet').alt = `${pet.displayName}: ${pet.speech}`;
  document.title = `${pet.name} · LegacyPet`;
  const L = LANGS[pet.lang] ?? LANGS.en;
  const care = async (name) => {
    try {
      const { project: fresh } = await api(`projects/${project.id}/care`, { name });
      const i = state.projects.findIndex((p) => p.id === fresh.id);
      if (i !== -1) state.projects[i] = fresh;
      const after = petOf(fresh, { lang });
      const outcome = fresh.summary.careOutcome;
      say(outcome === 'again' ? L.command.again[name]
        : outcome === 'cant' ? (L.command.cant[after.mood] ?? L.command.cant.egg)
          : commandReply(after, fresh.snapshot, { command: name, user: fresh.user }).split('\n').find((l) => l.startsWith('> '))?.slice(2) ?? '❤️', 4500, { asked: true });
      draw();
    } catch (err) {
      say(err.message, 4500, { asked: true });
    }
  };
  const button = (emoji, title, onclick) => Object.assign(document.createElement('button'), { type: 'button', textContent: emoji, title, onclick });
  bar.replaceChildren(
    button('🍪', L.command.usage?.feed ?? 'feed', () => care('feed')),
    button('🎾', L.command.usage?.play ?? 'play', () => care('play')),
    button('🤚', L.command.usage?.pat ?? 'pat', () => care('pat')),
    button('↗', 'LegacyPet', () => (desktop?.showMain ? desktop.showMain(`#/home/${project.id}`) : window.open(`/#/home/${project.id}`, 'legacypet'))));
}

async function load() {
  try {
    state = await api('state');
    draw();
  } catch (err) {
    say(err.message, 60_000, { asked: true });
  }
}

$('pet').addEventListener('click', () => { if (project) say(petOf(project, { lang: uiLang() ?? 'en' }).speech, 4500, { asked: true }); });
dark.addEventListener('change', draw);
listen({ onChange: load, onEvent: (e) => { if (!e.muted && (!project || e.projectId === project.id)) say(e.text, 8000); } });
await load();
if (project) say(petOf(project, { lang: uiLang() ?? 'en' }).speech);
