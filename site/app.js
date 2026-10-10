import * as LP from './src/index.js';
import { UI, UI_LANGS } from './ui.js';
import * as Sim from './sim.js';
import { homeViews } from './home.js';
import { icon } from './icons.js';
import { api, desktop, listen, LOCAL, MODE } from './local.js';
import { createPalette } from './palette.js';
import { hoverToMove, MOTIONS, onMotionPreference, resolveMotion } from './motion.js';

// ---------------------------------------------------------------------------
// Shared state. Everything the visitor picks lives in one place, survives a reload
// (when the browser allows storage) and is the same in every view.
// ---------------------------------------------------------------------------
const KEY = 'legacypet.playground.v2';
const browserLang = (navigator.language || 'en').toLowerCase().startsWith('vi') ? 'vi' : 'en';
const defaults = () => ({
  ui: browserLang,
  theme: 'auto',
  motion: 'auto',
  cfg: { species: 'auto', scenery: 'auto', name: '', color: 'auto', motto: '', lang: browserLang, wear: [], alerts: [], vacation: '', style: 'card', repo: '' },
  world: null,
  habit: 'diligent',
  simTab: 'quests',
  user: 'you',
  park: [],
});
// Whether this browser had nothing saved yet (a new window of the app picks up its settings).
let freshStore = true;
const store = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      freshStore = false;
      return { ...defaults(), ...saved, cfg: { ...defaults().cfg, ...saved.cfg } };
    }
  } catch { /* private mode or blocked storage: start fresh */ }
  return defaults();
})();
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage is optional */ }
  }, 250);
}

// A GitHub token, if the visitor adds one: kept in memory only, never stored.
let ghToken = '';
const client = () => LP.createClient({ token: ghToken || undefined });

const t = () => UI[store.ui] ?? UI.en;
const tr = (lang = store.cfg.lang) => LP.LANGS[lang] ?? LP.LANGS.en;
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const cardTheme = () => (store.theme === 'auto' ? (darkQuery.matches ? 'dark' : 'light') : store.theme);
const svgSrc = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
// 'full', 'lite' or 'off' (see motion.js). `stillAll()`: even the one pet in view holds still.
const motion = () => resolveMotion(store.motion);
const stillAll = () => motion() === 'off';
const petOptions = (extra = {}) => ({
  species: store.cfg.species, scenery: store.cfg.scenery, name: store.cfg.name, color: store.cfg.color, motto: store.cfg.motto, lang: store.cfg.lang, ...extra,
});

// A tiny DOM builder: h('div.panel', { onclick }, child, 'text').
function h(spec, attrs, ...children) {
  if (attrs == null || typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs)) {
    children.unshift(attrs);
    attrs = {};
  }
  const [tag, ...classes] = spec.split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}
const $ = (sel, root = document) => root.querySelector(sel);

function img(svg, cls, alt = '') {
  return h(`img.${cls}`, { src: svgSrc(svg), alt, decoding: 'async' });
}

// A pet picture in a grid or a list, where many sit side by side: `make(still)` returns its URL.
// With motion on 'lite' it holds still and moves only while pointed at; on 'off' it never moves.
function gridPic(make, attrs = {}) {
  const mode = motion();
  const el = h('img', { decoding: 'async', ...attrs, src: make(mode !== 'full') });
  return mode === 'lite' ? hoverToMove(el, { still: () => make(true), live: () => make(false) }) : el;
}

function copyButton(getText) {
  const b = h('button', { type: 'button' }, t().common.copy);
  b.onclick = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      b.textContent = t().common.copied;
    } catch {
      b.textContent = '✖';
    }
    setTimeout(() => { b.textContent = t().common.copy; }, 1400);
  };
  return b;
}
const codeBlock = (text) => {
  const pre = h('pre', text);
  return h('div.code', pre, copyButton(() => pre.textContent));
};

const TOAST_ICONS = { good: 'circle-check', gold: 'sparkles', bad: 'circle-alert' };
function toast(text, kind = '') {
  const box = $('#toasts');
  const el = h(`div.toast${kind ? `.${kind}` : ''}`, { role: 'status', title: t().toastClose, onclick: () => el.remove() },
    icon(TOAST_ICONS[kind] ?? 'info', { size: 16 }), h('span', text));
  box.append(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), 4000);
}

// A button with an icon: btn('Refresh', { icon: 'refresh-cw', kind: 'primary', onclick }).
// Without a label it is an icon button, and `title` becomes its name.
function btn(label, { icon: name, kind = '', onclick, title, type = 'button', disabled, size = 16, href, ...attrs } = {}) {
  const cls = `${href ? 'a' : 'button'}.btn${kind ? `.${kind.split(' ').join('.')}` : ''}${label ? '' : '.icon-only'}`;
  return h(cls, {
    ...(href ? { href, target: /^https?:/.test(href) ? '_blank' : null, rel: /^https?:/.test(href) ? 'noopener' : null } : { type, disabled }),
    onclick, title: title ?? null, 'aria-label': label ? null : title, ...attrs,
  }, name ? icon(name, { size }) : null, label ? h('span', label) : null);
}

function select(options, value, onchange, label) {
  const el = h('select', { 'aria-label': label }, options.map(([v, text]) => h('option', { value: v, selected: v === value }, text)));
  el.onchange = () => onchange(el.value);
  return el;
}

function seg(options, value, onchange, label) {
  const box = h('div.seg', { role: 'group', 'aria-label': label });
  for (const [v, text] of options) {
    box.append(h('button', {
      type: 'button', 'aria-pressed': String(v === value), 'data-value': v,
      onclick: (e) => {
        for (const b of box.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
        onchange(v);
      },
    }, text));
  }
  return box;
}

// Pickers shared by several views: species, home, coat color, the pet's language, name and catchphrase.
function lookFields(onchange) {
  const T = t();
  const L = tr();
  const set = (key) => (v) => { store.cfg[key] = v; save(); onchange(); };
  const name = h('input', { type: 'text', value: store.cfg.name, placeholder: T.common.namePlaceholder, maxlength: 40 });
  name.oninput = () => set('name')(name.value);
  const motto = h('input', { type: 'text', value: store.cfg.motto, placeholder: T.common.mottoPlaceholder, maxlength: LP.MOTTO_MAX });
  motto.oninput = () => set('motto')(motto.value);
  const colors = ['auto', ...LP.COLOR_IDS].map((id) => [id, T.common.colors[id]]);
  return h('div.fields',
    h('label.field', T.common.species, select([['auto', `${T.common.auto} 🎲`], ...LP.SPECIES_IDS.map((id) => [id, L.species[id]])], store.cfg.species, set('species'))),
    h('label.field', T.common.scenery, select([['auto', T.common.auto], ...LP.HOMES.map((id) => [id, T.homes[id]])], store.cfg.scenery, set('scenery'))),
    h('label.field', T.common.color, select(colors, colors.some(([id]) => id === store.cfg.color) ? store.cfg.color : 'auto', set('color'))),
    h('label.field', T.common.petLang, select(Object.entries(LP.LANG_NAMES), store.cfg.lang, set('lang'))),
    h('label.field', T.common.name, h('div.input-row', name, btn('', {
      icon: 'dices', title: T.common.randomName, onclick: () => { name.value = LP.randomName(); set('name')(name.value); },
    }))),
    h('label.field', T.common.motto, motto));
}

// Turns a `/pet` reply (GitHub markdown) into safe HTML for the console.
function markdown(text, miniSrc) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s)
    .replace(/&lt;sub&gt;/g, '<sub>').replace(/&lt;\/sub&gt;/g, '</sub>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|\s)_([^_]+)_(?=\s|$)/g, '$1<i>$2</i>');
  const out = [];
  let list = null;
  let table = null;
  const flush = () => {
    if (list) out.push(`<ul>${list.join('')}</ul>`);
    if (table) out.push(`<table>${table.join('')}</table>`);
    list = null;
    table = null;
  };
  for (const line of text.split('\n')) {
    if (/^\s*<img /.test(line)) { flush(); if (miniSrc) out.push(`<img src="${miniSrc}" width="160" alt="">`); continue; }
    if (/^\|/.test(line)) {
      if (/^\|\s*-/.test(line)) continue;
      table ??= [];
      table.push(`<tr>${line.split('|').slice(1, -1).map((c) => `<td>${inline(c.trim())}</td>`).join('')}</tr>`);
      continue;
    }
    if (/^- /.test(line)) { if (table) flush(); list ??= []; list.push(`<li>${inline(line.slice(2))}</li>`); continue; }
    flush();
    if (/^#{3,4} /.test(line)) out.push(`<h4>${inline(line.replace(/^#+ /, ''))}</h4>`);
    else if (/^> /.test(line)) out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  flush();
  return out.join('');
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------
const MOOD_STARS = {
  ecstatic: 'duck', happy: 'cat', party: 'ninja', hungry: 'blob', sleepy: 'octopus',
  sad: 'bat', sick: 'mecha', zombie: 'cat', hibernating: 'cactus', egg: 'bunny',
};
const ALERT_MOODS = ['sick', 'zombie', 'hungry', 'sad'];
const demoNow = () => new Date();
function demoPet({ mood = 'happy', species = 'cat', fullName = 'you/your-repo', ...options } = {}) {
  const now = demoNow();
  return LP.buildPet({
    snapshot: LP.mockSnapshot({ mood, now, fullName, stage: options.stage ?? 'adult' }),
    now,
    options: { holiday: null, species, lang: store.cfg.lang, mood, shiny: false, aura: false, ...options },
  });
}

// ----- Hatch: a real repo (or a made-up mood) through the real engine ---------
const hatch = { snapshot: null, mood: null, now: new Date(), repo: '', blind: false };

function viewHatch(root, arg) {
  const T = t().hatch;
  const C = t().common;
  const input = h('input', { type: 'text', placeholder: T.placeholder, 'aria-label': 'GitHub repository', autocomplete: 'off', spellcheck: 'false', value: hatch.repo });
  const go = h('button.primary', { type: 'submit' }, T.button);
  const token = h('input', { type: 'password', placeholder: T.tokenPlaceholder, autocomplete: 'off', value: ghToken });
  token.oninput = () => { ghToken = token.value.trim(); };
  const status = h('p.status', { role: 'status' });
  const privateBtn = h('button.chip', { type: 'button', hidden: true }, T.privateButton);
  const result = h('div', { hidden: true });
  const setStatus = (text, bad = false) => { status.textContent = text; status.className = `status${bad ? ' bad' : ''}`; privateBtn.hidden = true; };

  async function visit(raw) {
    const cleaned = raw.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
    const [owner, repo] = cleaned.split('/');
    // Just a username or an org: list its repos to pick from.
    if (owner && !repo && /^[\w-]+$/.test(owner)) return pick(owner);
    if (!owner || !repo) return setStatus(T.badRepo, true);
    hatch.repo = `${owner}/${repo}`;
    input.value = hatch.repo;
    go.disabled = true;
    setStatus(T.visiting(hatch.repo));
    try {
      hatch.now = new Date();
      hatch.snapshot = await LP.collectSnapshot(client(), { owner, repo, now: hatch.now });
      hatch.mood = null;
      hatch.blind = false;
      store.cfg.repo = hatch.snapshot.repo.fullName;
      store.cfg.private = Boolean(hatch.snapshot.repo.isPrivate);
      save();
      history.replaceState(null, '', `#/hatch/${hatch.snapshot.repo.fullName}`);
      setStatus(hatch.snapshot.warnings.length ? T.partial(hatch.snapshot.warnings.length) : '');
      draw();
    } catch (err) {
      if (err.status === 404) {
        setStatus(T.notFound(hatch.repo), true);
        const name = hatch.repo;
        privateBtn.hidden = false;
        privateBtn.onclick = () => adoptPrivate(name);
      }
      else if (err.status === 403 || err.status === 429) setStatus(T.rateLimit, true);
      else setStatus(err.message, true);
    } finally {
      go.disabled = false;
    }
  }

  // GitHub hides private repos from anonymous visitors, so this page can't read them. The action
  // runs inside the repo and can: hand out the workflow and a private-friendly snippet, with a
  // made-up pet as the preview.
  function adoptPrivate(fullName) {
    hatch.now = new Date();
    hatch.mood = null;
    hatch.blind = true;
    hatch.snapshot = LP.mockSnapshot({ mood: 'happy', now: hatch.now, fullName });
    hatch.snapshot.repo.isPrivate = true;
    store.cfg.repo = fullName;
    store.cfg.private = true;
    save();
    history.replaceState(null, '', `#/hatch/${fullName}`);
    setStatus(T.privateStatus(fullName));
    draw();
  }

  function demo(mood) {
    hatch.now = new Date();
    hatch.mood = mood;
    hatch.blind = false;
    hatch.snapshot = LP.mockSnapshot({ mood, now: hatch.now, fullName: 'you/your-repo' });
    setStatus(T.demo(tr().moods[mood]));
    draw();
  }

  // The layout is built once; draw() only refills the parts that change, so typing a
  // name never loses focus.
  const box = { card: h('div'), shots: h('div.shots'), links: h('div.links'), checkup: h('div'), quests: h('div'), scores: h('div') };
  const shareBtn = h('button.ghost', {
    type: 'button',
    onclick: async (e) => {
      const b = e.currentTarget;
      try { await navigator.clipboard.writeText(location.href); b.textContent = `✔ ${C.shared}`; } catch { b.textContent = location.href; }
      setTimeout(() => { b.textContent = `🔗 ${C.share}`; }, 1600);
    },
  }, `🔗 ${C.share}`);
  result.append(
    h('div.grid2',
      h('section.panel', box.card, box.shots, box.links,
        h('div.row', { style: { marginTop: '14px' } },
          h('button.primary', {
            type: 'button',
            onclick: () => {
              stopAuto();
              store.world = Sim.worldFromSnapshot(hatch.snapshot);
              if (!hatch.mood) store.cfg.repo = hatch.snapshot.repo.fullName;
              save();
              go_('sim');
            },
          }, T.playInSim),
          h('button', { type: 'button', onclick: () => go_('adopt') }, T.adoptIt),
          shareBtn)),
      h('div.stack',
        h('section.panel', lookFields(() => draw())),
        h('section.panel', h('h3', `🩺 ${T.checkup}`), box.checkup))),
    h('div.grid2', { style: { marginTop: '16px' } },
      h('section.panel', h('h3', `📜 ${T.quests}`), box.quests, h('p.small.muted', { style: { margin: '10px 0 0' } }, T.questsNote)),
      h('section.panel', h('h3', `🧬 ${T.leaning}`), box.scores)));

  function draw() {
    if (!hatch.snapshot) return;
    const L = tr();
    const theme = cardTheme();
    const preview = hatch.mood ? { mood: hatch.mood, holiday: null } : {};
    const pet = LP.buildPet({ snapshot: hatch.snapshot, now: hatch.now, options: petOptions(preview) });
    const scores = LP.pathScores({ snapshot: hatch.snapshot, facts: pet.facts });
    const best = LP.PATH_IDS.reduce((a, b) => (scores[b] > scores[a] ? b : a));
    const max = Math.max(1, ...Object.values(scores));
    const files = [['pet', LP.renderCard(pet, { theme })], ['pet-mini', LP.renderMini(pet, { theme })], ['pet-badge', LP.renderBadge(pet)]];
    const shown = stillAll() ? [LP.renderCard(pet, { theme, still: true }), LP.renderMini(pet, { theme, still: true })] : [files[0][1], files[1][1]];
    box.card.replaceChildren(img(shown[0], 'card-img', `${pet.displayName}: ${pet.speech}`));
    box.shots.replaceChildren(img(shown[1], 'mini-img', pet.name), img(files[2][1], 'badge-img', 'badge'));
    box.links.replaceChildren(...files.map(([file, svg]) => h('a', { href: svgSrc(svg), download: `${file}.svg` }, `⬇ ${file}.svg`)));
    box.checkup.replaceChildren(checkupList(pet, hatch.snapshot));
    box.quests.replaceChildren(questList(pet, L));
    box.scores.replaceChildren(
      h('div.scores', LP.PATHS.map((p) => h(`div.score${p.id === best ? '.lead' : ''}`,
        h('span', `${p.emoji} ${L.paths[p.id]}`),
        h('div.meter', h('i', { style: { width: `${Math.round((scores[p.id] / max) * 100)}%`, background: p.color } })),
        h('b', scores[p.id].toFixed(2))))),
      h('p.small.muted', { style: { margin: '10px 0 0' } }, T.leaningNote(`${LP.PATHS.find((p) => p.id === best).emoji} ${L.paths[best]}`)));
    shareBtn.hidden = Boolean(hatch.mood);
    result.hidden = false;
  }

  // ----- The repo picker: an owner's repos, or (with a token) every repo you can see.
  const filter = h('input', { type: 'text', placeholder: T.filter, autocomplete: 'off', spellcheck: 'false', oninput: () => drawPicker() });
  const forksBox = h('input', { type: 'checkbox', onchange: () => drawPicker() });
  const archivedBox = h('input', { type: 'checkbox', onchange: () => drawPicker() });
  const pickTitle = h('h3');
  const pickList = h('ul.pick-list');
  const pickPanel = h('section.panel.picker', { hidden: true },
    h('div.picker-head', pickTitle, h('button.ghost', { type: 'button', onclick: () => { pickPanel.hidden = true; } }, `✕ ${T.close}`)),
    h('div.picker-tools', filter, h('label.check.small', forksBox, T.forks), h('label.check.small', archivedBox, T.archived)),
    pickList);
  const mineBtn = h('button.chip', { type: 'button', onclick: () => pick('') }, T.mine);
  const ago = (iso) => {
    const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (!iso || Number.isNaN(days)) return '';
    const fmt = new Intl.RelativeTimeFormat(store.ui, { numeric: 'auto' });
    if (days < 60) return fmt.format(-days, 'day');
    return days < 730 ? fmt.format(-Math.round(days / 30), 'month') : fmt.format(-Math.round(days / 365), 'year');
  };

  async function pick(owner) {
    if (!owner && !ghToken) {
      setStatus(T.mineHint, true);
      token.closest('details').open = true;
      token.focus();
      return;
    }
    setStatus(T.listing(owner));
    try {
      picker.repos = await LP.listRepos(client(), { owner: owner || undefined });
      picker.owner = owner;
      setStatus('');
      filter.value = '';
      drawPicker();
      pickPanel.hidden = false;
      pickPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      findPets(picker.repos);
    } catch (err) {
      if (err.status === 404) setStatus(T.noOwner(owner), true);
      else if (err.status === 401) setStatus(T.badToken, true);
      else if (err.status === 403 || err.status === 429) setStatus(T.rateLimit, true);
      else setStatus(err.message, true);
    }
  }

  // Which repos already have a pet. Public ones are asked through raw.githubusercontent.com,
  // which doesn't count against the API limit; private ones need the token.
  async function findPets(repos) {
    await Promise.all(repos.slice(0, 60).map(async (r) => {
      try {
        if (!r.isPrivate) r.pet = (await fetch(`https://raw.githubusercontent.com/${r.fullName}/legacypet/pet.json`, { method: 'HEAD' })).ok;
        else if (ghToken) r.pet = await LP.hasPet(client(), r.fullName);
      } catch { /* unknown: leave it unmarked */ }
    }));
    if (picker.repos === repos) drawPicker();
  }

  function adoptFromList(r) {
    store.cfg.repo = r.fullName;
    store.cfg.private = r.isPrivate;
    save();
    toast(T.adoptOpened);
    go_('adopt');
  }

  function drawPicker() {
    if (!picker.repos) return;
    const q = filter.value.trim().toLowerCase();
    const shown = picker.repos.filter((r) => (forksBox.checked || !r.fork) && (archivedBox.checked || !r.archived)
      && (!q || r.fullName.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)));
    pickTitle.textContent = T.pickerTitle(picker.owner, shown.length);
    if (!shown.length) return pickList.replaceChildren(h('li.empty', T.empty));
    pickList.replaceChildren(...shown.map((r) => h('li.pick-row',
      h('div.pick-main',
        h('div.pick-name', h('b.mono', picker.owner ? r.name : r.fullName),
          r.isPrivate && h('span.pick-tag', '🔒'), r.fork && h('span.pick-tag', 'fork'), r.archived && h('span.pick-tag', '📦'),
          r.pet && h('span.pick-tag.pet', `🐾 ${T.hasPet}`)),
        r.description && h('div.small.muted.clip', { title: r.description }, r.description),
        h('div.small.muted', [r.stars ? `★ ${r.stars}` : '', r.language, ago(r.pushedAt)].filter(Boolean).join(' · '))),
      h('div.pick-actions',
        h('button', { type: 'button', onclick: () => { visit(r.fullName); result.scrollIntoView({ behavior: 'smooth' }); } }, T.rowHatch),
        r.pet
          ? h('a.button', { href: `https://github.com/${r.fullName}/tree/legacypet`, target: '_blank', rel: 'noopener' }, T.rowView)
          : h('a.button.primary', {
            href: LP.adoptUrl(r.fullName, r.defaultBranch, adoptOptions()), target: '_blank', rel: 'noopener',
            onclick: () => adoptFromList(r),
          }, T.rowAdopt),
        h('button.ghost', {
          type: 'button', title: T.rowPark, 'aria-label': T.rowPark,
          onclick: () => {
            if (!store.park.includes(r.fullName) && store.park.length < LP.PARK_MAX) store.park = [...store.park.filter((n) => !n.startsWith('demo/')), r.fullName];
            save();
            toast(T.addedPark(r.fullName));
          },
        }, '🏞️+')))));
  }

  const form = h('form.hatch', { onsubmit: (e) => { e.preventDefault(); visit(input.value); } }, input, go);
  root.append(
    h('div.hero',
      h('h2', T.title),
      h('p.lead', { style: { margin: '6px auto 0' } }, t().tagline),
      form,
      h('div.examples', T.try, mineBtn, ...['rust-lang/rustlings', 'sindresorhus/awesome', 'Tanx-1811/legacypet'].map((r) => h('button.chip', { type: 'button', onclick: () => visit(r) }, r))),
      h('div.examples', T.moods, ...LP.MOODS.map((m) => h('button.chip', { type: 'button', onclick: () => demo(m) }, `${LP.MOOD_EMOJI[m]} ${tr().moods[m]}`))),
      h('details', h('summary', T.tokenSummary), token, h('div', T.tokenNote)),
      status,
      privateBtn),
    pickPanel,
    result);

  if (picker.repos) { drawPicker(); pickPanel.hidden = false; }
  if (arg && arg.includes('/')) visit(arg);
  else if (hatch.snapshot) { draw(); if (hatch.mood) setStatus(T.demo(tr().moods[hatch.mood])); }
  else demo(LP.MOODS[Math.floor(Math.random() * 4)]);
  return { redraw: draw };
}

function checkupList(pet, snapshot) {
  return h('ul.checkup', LP.checkup(pet, snapshot).map((item) => h(`li.${item.level}`, h('span.dot'), h('span', `${item.icon} ${item.text}`))));
}

function questList(pet, L) {
  const q = pet.quests;
  if (!q?.list.length) return h('p.muted', L.command.quests.none);
  return h('div', q.list.map((item) => h(`div.quest${item.done ? '.done' : ''}`,
    h('span.em', item.emoji),
    h('span.txt', L.quests[item.id](item.goal), item.isNew ? h('span.new-tag', '🆕') : null),
    h('span.n', item.done ? '✔' : `${item.progress}/${item.goal}`),
    h(`div.meter${item.done ? '.good' : ''}`, h('i', { style: { width: `${Math.round((item.progress / item.goal) * 100)}%` } })))));
}

// ----- Raise: the simulator ---------------------------------------------------
let autoTimer = null;
function stopAuto() {
  clearInterval(autoTimer);
  autoTimer = null;
}

function viewSim(root) {
  const T = t().sim;
  const C = t().common;
  if (!store.world) store.world = Sim.newWorld({ start: 'young', fullName: store.cfg.repo || 'you/your-repo' });
  const w = store.world;
  let resetArmed = false;
  let last = null;

  const els = {
    day: h('span.day-pill'),
    card: h('img.card-img', { alt: '' }),
    vitals: h('div.vitals'),
    status: h('p.small.muted', { style: { margin: 0 } }),
    panel: h('div'),
    tabs: h('div.subtabs', { role: 'tablist' }),
    auto: h('button', { type: 'button' }),
  };

  const options = (extra = {}) => petOptions({ holiday: undefined, ...extra });

  function remember() {
    save();
  }

  // A run that counts: pet.json changes and the visitor hears about what happened.
  function act(extra, { advance = false } = {}) {
    const before = { level: w.state?.pet?.level, trophies: new Set(Object.keys(w.state?.achievements ?? {})), unlocked: new Set(last?.pet.wardrobe.unlocked ?? []), mood: w.state?.lastMood };
    const result = advance ? Sim.nextDay(w, options(extra)) : Sim.run(w, { options: options(extra), persist: true });
    announce(result.pet, before);
    remember();
    update();
    return result;
  }

  function announce(pet, before) {
    const L = tr();
    const ev = pet.events;
    if (ev.includes('hatched')) toast(T.toast.hatched, 'gold');
    if (ev.includes('revived')) toast(T.toast.revived, 'good');
    if (ev.includes('rankUp')) toast(T.toast.rankUp(`${pet.rank.emoji} ${L.ranks[pet.rank.id]}`), 'gold');
    else if (ev.includes('levelUp')) toast(T.toast.levelUp(pet.level), 'gold');
    if (ev.includes('evolved') && pet.path) toast(T.toast.evolved(`${pet.path.emoji} ${L.paths[pet.path.id]}`), 'gold');
    for (const q of pet.quests.list.filter((x) => x.isNew)) toast(T.toast.quest(L.quests[q.id](q.goal)), 'good');
    if (ev.includes('perfectWeek')) toast(T.toast.perfect, 'gold');
    for (const a of pet.achievements.filter((x) => x.isNew)) toast(T.toast.trophy(`${a.emoji} ${L.achievements[a.id]}`), 'gold');
    for (const id of pet.wardrobe.unlocked.filter((x) => !before.unlocked.has(x) && last)) toast(T.toast.unlocked(`${LP.ITEMS.find((i) => i.id === id).emoji} ${L.items[id]}`), 'good');
    if (before.mood && before.mood !== pet.mood) toast(T.toast.mood(`${LP.MOOD_EMOJI[pet.mood]} ${L.moods[pet.mood]}`));
  }

  function care(name) {
    const result = act({ care: { name, user: store.user } });
    const L = tr();
    const msg = result.pet.careOutcome === 'again' ? L.command.again[name]
      : result.pet.careOutcome === 'cant' ? (L.command.cant[result.pet.mood] ?? L.command.cant.egg)
        : LP.commandReply(result.pet, result.snapshot, { command: name, user: store.user }).split('\n').find((l) => l.startsWith('> '))?.slice(2);
    if (msg) toast(msg, result.pet.careOutcome === 'ok' ? 'good' : '');
  }

  function next(days = 1) {
    for (let i = 0; i < days; i++) {
      if (days > 1 || autoTimer) Sim.planDay(w, store.habit);
      act({}, { advance: true });
    }
  }

  function toggleAuto() {
    if (autoTimer) stopAuto();
    else autoTimer = setInterval(() => next(1), 1100);
    els.auto.textContent = autoTimer ? T.pause : T.auto;
  }
  els.auto.textContent = T.auto;
  els.auto.onclick = toggleAuto;

  // Today's plan: sliders and switches. Changing them previews the pet without saving a run.
  // A new day (or an autoplay habit) rewrites the plan, so every control knows how to resync.
  const syncs = [];
  const ctl = (key, label, min, max, step = 1, fmt = (v) => v) => {
    const out = h('b', fmt(w.today[key]));
    const range = h('input', { type: 'range', min, max, step, value: w.today[key], 'aria-label': label });
    range.oninput = () => { w.today[key] = Number(range.value); out.textContent = fmt(w.today[key]); remember(); update(); };
    syncs.push(() => { range.value = w.today[key]; out.textContent = fmt(w.today[key]); });
    return h('label.ctl', h('span.head', h('span', label), out), range);
  };
  const flag = (key, label) => {
    const box = h('input', { type: 'checkbox', checked: Boolean(w.today[key]) });
    box.onchange = () => { w.today[key] = box.checked; remember(); update(); };
    syncs.push(() => { box.checked = Boolean(w.today[key]); });
    return h('label.check', box, label);
  };
  const ciSeg = seg(Object.entries(T.ciStates), w.today.ci, (v) => { w.today.ci = v; remember(); update(); }, T.ci);
  syncs.push(() => { for (const b of ciSeg.children) b.setAttribute('aria-pressed', String(b.dataset.value === w.today.ci)); });
  const controls = h('section.panel',
    h('h3', `🗓️ ${T.today}`),
    h('div.controls',
      ctl('commits', T.commits, 0, 12),
      ctl('authors', T.authors, 1, 6),
      h('div.ctl', h('span.head', h('span', T.ci)), ciSeg),
      ctl('merged', T.merged, 0, 4),
      ctl('waiting', T.waiting, 0, 5),
      ctl('stale', T.stale, 0, 10),
      ctl('stars', T.stars, 0, 3000, 10),
      ctl('community', T.community, 0, 100, 5, (v) => `${v}%`)),
    h('div.row', { style: { marginTop: '12px', gap: '18px' } }, flag('release', `🚀 ${T.release}`), flag('archived', `📦 ${T.archived}`)));

  const userSel = select(['you', 'amy', 'ben', 'chi', 'dan', 'eve'].map((u) => [u, `@${u}`]), store.user, (v) => { store.user = v; remember(); }, T.as);
  userSel.style.width = 'auto';
  const startSel = select(Object.entries(T.starts), w.start, (v) => {
    stopAuto();
    store.world = Sim.newWorld({ start: v, fullName: w.fullName });
    save();
    remount();
  }, T.start);
  startSel.style.width = 'auto';
  const resetBtn = h('button.ghost', { type: 'button' }, T.reset);
  resetBtn.onclick = () => {
    if (!resetArmed) {
      resetArmed = true;
      resetBtn.textContent = T.resetConfirm;
      setTimeout(() => { resetArmed = false; resetBtn.textContent = T.reset; }, 3000);
      return;
    }
    stopAuto();
    store.world = Sim.newWorld({ start: w.start, fullName: w.fullName });
    save();
    remount();
  };
  const habitSel = select(Object.entries(T.habit), store.habit, (v) => { store.habit = v; remember(); }, T.habits);

  root.append(
    h('div.sim-head',
      h('div', h('h2', T.title), h('p.lead', { style: { margin: 0 } }, T.lead)),
      h('div.row', h('span.small.muted', T.start), startSel, resetBtn)),
    h('div.grid2.sim-grid',
      h('div.stack',
        h('section.panel.stage',
          h('div.row', { style: { justifyContent: 'space-between' } }, els.day, els.status),
          h('div.pics', els.card),
          els.vitals,
          h('div.big-actions',
            h('button', { type: 'button', onclick: () => care('feed') }, T.feed),
            h('button', { type: 'button', onclick: () => care('play') }, T.play),
            h('button', { type: 'button', onclick: () => care('pat') }, T.pat)),
          h('div.row.small.muted', T.as, userSel),
          h('div.timeline',
            h('button.primary', { type: 'button', onclick: () => next(1) }, T.next),
            h('button', { type: 'button', onclick: () => next(7) }, T.week),
            els.auto,
            h('label.field.wide', { style: { gridColumn: '1 / -1' } }, T.habits, habitSel)),
          h('p.small.muted', { style: { margin: 0 } }, `⌨️ ${T.keys}`))),
      // Today's plan sits next to the pet, so the effect of a slider is visible at a glance.
      h('div.stack', controls, h('section.panel', els.tabs, els.panel))),
    h('section.panel', { style: { marginTop: '16px' } }, h('h3', `🎨 ${t().adopt.look}`), lookFields(() => update())));

  // Side panel: quests, evolution, wardrobe, trophies, diary, chart and a /pet console.
  for (const [id, label] of Object.entries(T.tabs)) {
    els.tabs.append(h('button', {
      type: 'button', role: 'tab', 'aria-selected': String(store.simTab === id),
      onclick: () => { store.simTab = id; remember(); for (const b of els.tabs.children) b.setAttribute('aria-selected', String(b.dataset.id === id)); drawPanel(); },
      'data-id': id,
    }, label));
  }

  let consoleState = { text: '/pet', reply: '' };

  function drawPanel() {
    const { pet, snapshot } = last;
    const L = tr();
    const tab = store.simTab;
    const box = els.panel;
    box.replaceChildren();
    if (tab === 'quests') {
      box.append(
        h('div.row', { style: { justifyContent: 'space-between', marginBottom: '6px' } }, h('b', T.stars_(pet.questStars)), h('span.small.muted', T.weekEnds(pet.quests.ends))),
        questList(pet, L),
        h('p.small.muted', { style: { margin: '10px 0 0' } }, L.questBoard.reward));
    } else if (tab === 'evolution') {
      const scores = LP.pathScores({ snapshot, facts: pet.facts, history: w.state?.history ?? [] });
      const max = Math.max(1, ...Object.values(scores));
      const watched = new Set((w.state?.history ?? []).filter((x) => x.date < pet.date).map((x) => x.date)).size;
      box.append(...[
        h('p', { style: { marginTop: 0 } }, pet.path ? h('b', T.evolved(`${pet.path.emoji} ${L.paths[pet.path.id]}`)) : T.notYet(LP.EVOLVE_AFTER_DAYS)),
        pet.path ? null : h('div.small.muted', { style: { marginBottom: '10px' } }, T.watched(Math.min(watched, LP.EVOLVE_AFTER_DAYS), LP.EVOLVE_AFTER_DAYS)),
        h('div.scores', LP.PATHS.map((p) => h(`div.score${pet.path?.id === p.id ? '.lead' : ''}`,
          h('span', `${p.emoji} ${L.paths[p.id]}`),
          h('div.meter', h('i', { style: { width: `${Math.round((scores[p.id] / max) * 100)}%`, background: p.color } })),
          h('b', scores[p.id].toFixed(2))))),
        h('ul.small.muted', { style: { paddingLeft: '18px', marginBottom: 0 } }, LP.PATHS.map((p) => h('li', `${p.emoji} ${L.paths[p.id]}: ${L.pathHints[p.id]}`)))].filter(Boolean));
    } else if (tab === 'wardrobe') {
      const worn = new Set(pet.wardrobe.worn);
      const unlocked = new Set(pet.wardrobe.unlocked);
      const toggle = (item) => {
        const next = new Set(worn);
        for (const id of next) if (LP.ITEMS.find((i) => i.id === id)?.slot === item.slot) next.delete(id);
        if (!worn.has(item.id)) next.add(item.id);
        act({ wear: [...next].join(',') || 'none' });
      };
      const all = h('input', { type: 'checkbox', checked: w.unlockAll });
      all.onchange = () => { w.unlockAll = all.checked; act({}); };
      box.append(
        h('p.small.muted', { style: { marginTop: 0 } }, T.wardrobeNote),
        ...LP.SLOTS.map((slot) => h('div', { style: { marginBottom: '12px' } },
          h('h3', L.slots[slot]),
          h('div.tiles', LP.ITEMS.filter((i) => i.slot === slot).map((item) => {
            const open = unlocked.has(item.id) || w.unlockAll;
            return h(`button.tile${worn.has(item.id) ? '.on' : ''}${open ? '' : '.locked'}`, {
              type: 'button', disabled: !open, onclick: () => toggle(item), title: LP.unlockHint(L, item),
            },
            worn.has(item.id) ? h('span.tag', '✔') : null,
            h('span.em', item.emoji), h('span.name', L.items[item.id]),
            h('span.hint', unlocked.has(item.id) ? C.unlocked : `🔒 ${LP.unlockHint(L, item)}`));
          })))),
        h('label.check', all, T.unlockAll));
    } else if (tab === 'trophies') {
      const got = new Map(pet.achievements.map((a) => [a.id, a]));
      box.append(h('div.tiles', LP.ACHIEVEMENTS.map((a) => h(`div.tile${got.has(a.id) ? '' : '.locked'}${got.get(a.id)?.isNew ? '.new' : ''}`,
        h('span.em', a.emoji), h('span.name', L.achievements[a.id]),
        h('span.hint', got.has(a.id) ? got.get(a.id).unlockedAt : t().trophyHow[a.id])))));
    } else if (tab === 'diary') {
      const lines = (w.diary ?? '').split('\n').filter((l) => l.startsWith('- **'));
      box.append(
        h('div.strip', { title: 'mood history' }, LP.moodStrip(w.state?.history ?? [], 30) || '·'),
        lines.length
          ? h('ul.diary', { style: { marginTop: '10px' } }, lines.map((l) => {
            const [, date, rest] = /^- \*\*([^*]+)\*\* · (.*)$/.exec(l) ?? [null, '', l];
            return h('li', h('b', date), ' ', rest);
          }))
          : h('p.muted', T.noDiary));
    } else if (tab === 'chart') {
      box.append(img(LP.renderStats(pet, w.state?.history ?? [], { theme: cardTheme() }), 'card-img', 'stats'));
    } else if (tab === 'reply') {
      const inputEl = h('input', { type: 'text', value: consoleState.text, placeholder: T.commandPlaceholder, class: 'mono', 'aria-label': '/pet' });
      const out = h('div.reply', { html: consoleState.reply || '' });
      const send = (text) => {
        consoleState.text = text;
        const command = LP.parseCommand(text) ?? 'help';
        const arg = LP.commandArg?.(text) ?? null;
        const extra = {};
        if (['feed', 'play', 'pat'].includes(command)) extra.care = { name: command, user: store.user };
        if (command === 'wear') extra.wearCommand = arg ?? 'none';
        if (command === 'vacation') extra.vacationCommand = { name: 'vacation', days: /^\d+$/.test(arg ?? '') ? Number(arg) : null };
        if (command === 'back') extra.vacationCommand = { name: 'back' };
        const result = Object.keys(extra).length ? act(extra) : last;
        const reply = LP.commandReply(result.pet, result.snapshot, {
          command, user: store.user, arg, maintainer: true, miniUrl: 'mini', wasOnVacation: false,
        });
        consoleState.reply = markdown(reply, svgSrc(LP.renderMini(result.pet, { theme: cardTheme(), still: stillAll() })));
        if (store.simTab === 'reply') drawPanel();
      };
      const form = h('form.row', { onsubmit: (e) => { e.preventDefault(); send(inputEl.value); } }, h('div', { style: { flex: '1', minWidth: '0' } }, inputEl), h('button.primary', { type: 'submit' }, T.send));
      box.append(
        h('div.console',
          form,
          h('div.cmd-chips', LP.COMMANDS.map((c) => h('button', { type: 'button', onclick: () => send(`/pet${c === 'status' ? '' : ` ${c}`}${c === 'wear' ? ' cap' : c === 'vacation' ? ' 7' : ''}`) }, c))),
          h('p.small.muted', { style: { margin: 0 } }, T.commandNote),
          consoleState.reply ? out : null));
    }
  }

  function update() {
    for (const sync of syncs) sync();
    last = Sim.run(w, { options: options() });
    const { pet } = last;
    const L = tr();
    const now = Sim.nowOf(w);
    els.day.textContent = T.day(w.day + 1, pet.date, T.weekdays[now.getUTCDay()]);
    els.status.textContent = `${LP.MOOD_EMOJI[pet.mood]} ${L.moods[pet.mood]} · ${pet.rank.emoji} ${L.level(pet.level)}${pet.path ? ` · ${pet.path.emoji}` : ''}`;
    els.card.src = svgSrc(LP.renderCard(pet, { theme: cardTheme(), still: stillAll() }));
    els.card.alt = `${pet.displayName}: ${pet.speech}`;
    const yesterday = (w.state?.history ?? []).find((x) => x.date < pet.date);
    els.vitals.replaceChildren(...['fullness', 'health', 'joy', 'energy'].map((k, i) => {
      const v = pet.vitals[k];
      const before = yesterday?.vitals?.[i];
      const d = before == null ? 0 : v - before;
      return h('div.vital', L.stats[k], h('b', v, d ? h(`span.delta.${d > 0 ? 'up' : 'down'}`, `${d > 0 ? '+' : ''}${d}`) : null));
    }));
    drawPanel();
  }

  const remount = () => render();

  update();
  return {
    redraw: update,
    keys: (e) => {
      const k = e.key.toLowerCase();
      if (k === 'n') next(1);
      else if (k === 'w') next(7);
      else if (k === 'f') care('feed');
      else if (k === 'p') care('play');
      else if (k === 't') care('pat');
      else if (k === ' ') { e.preventDefault(); toggleAuto(); }
      else return;
    },
    leave: stopAuto,
  };
}

// ----- Codex: every species, mood, path, item, quest, rank, trophy and home ----
const codexCache = new Map();
function cachedMini(key, make, still = false) {
  const k = `${key}|${store.cfg.lang}|${cardTheme()}|${still}`;
  if (!codexCache.has(k)) codexCache.set(k, svgSrc(LP.renderMini(make(), { theme: cardTheme(), still })));
  return codexCache.get(k);
}

function viewCodex(root, arg) {
  const T = t().codex;
  const U = t();
  const L = tr();
  const tryIn = (patch) => { Object.assign(store.cfg, patch); save(); go_('sim'); };
  const pic = (key, make) => gridPic((still) => cachedMini(key, make, still), { alt: '', loading: 'lazy', width: 112 });
  const sections = {
    species: () => h('div.tiles', LP.SPECIES_IDS.map((id) => {
      const sp = LP.SPECIES[id];
      return h('button.tile', { type: 'button', onclick: () => tryIn({ species: id }), title: U.common.tryIt },
        pic(`sp-${id}`, () => demoPet({ species: id, mood: 'happy', name: L.species[id] })),
        h('span.name', L.species[id]), h('span.hint', `${L.traits[sp.trait]}: ${U.speciesFx[id]}`), h('span.hint', `🏞️ ${U.homes[sp.home ?? 'meadow']}`));
    })),
    moods: () => h('div.tiles', LP.MOODS.map((m) => h('div.tile',
      pic(`mood-${m}`, () => demoPet({ species: MOOD_STARS[m], mood: m })),
      h('span.name', `${LP.MOOD_EMOJI[m]} ${L.moods[m]}`), h('span.hint', U.moodWhen[m])))),
    paths: () => h('div.tiles', LP.PATHS.map((p) => h('div.tile',
      pic(`path-${p.id}`, () => demoPet({ species: 'dragon', mood: 'ecstatic', path: p.id, stage: 'elder' })),
      h('span.name', `${p.emoji} ${L.paths[p.id]}`), h('span.hint', T.pathHint(L.pathHints[p.id])), h('span.hint', T.pathBonus(U.vitalNames[p.vital]))))),
    items: () => h('div.tiles', LP.ITEMS.map((item) => h('div.tile',
      pic(`item-${item.id}`, () => demoPet({ species: 'blob', mood: 'happy', wear: item.id, unlockAll: true })),
      h('span.name', `${item.emoji} ${L.items[item.id]}`), h('span.hint', `${L.slots[item.slot]} · ${LP.unlockHint(L, item)}`), h('code.small', item.id)))),
    quests: () => h('div.tiles', LP.QUESTS.map((q) => h('div.tile',
      h('span.em', q.emoji), h('span.name', L.quests[q.id](q.goal)), h('span.hint', `${T.questGoal}: ${q.goal}`)))),
    ranks: () => h('div.ladder', LP.RANKS.map((r) => h('div.rank', { style: { '--c': r.color } },
      h('b', `${r.emoji} ${L.ranks[r.id]}`), h('span.small.muted', T.rankFrom(r.min)), h('div.small.muted', T.commits((r.min - 1) ** 2))))),
    trophies: () => h('div.tiles', LP.ACHIEVEMENTS.map((a) => h('div.tile',
      h('span.em', a.emoji), h('span.name', L.achievements[a.id]), h('span.hint', U.trophyHow[a.id])))),
    homes: () => h('div.tiles', LP.HOMES.map((home) => h('button.tile', { type: 'button', onclick: () => tryIn({ scenery: home }) },
      pic(`home-${home}`, () => demoPet({ species: Object.values(LP.SPECIES).find((s) => s.home === home)?.id ?? 'blob', mood: 'happy', scenery: home, season: 'summer' })),
      h('span.name', U.homes[home])))),
  };
  const nav = h('div.codex-nav', Object.entries(T.sections).map(([id, label]) => h('button.chip', {
    type: 'button', onclick: () => { document.getElementById(`codex-${id}`)?.scrollIntoView({ behavior: 'smooth' }); history.replaceState(null, '', `#/codex/${id}`); },
  }, label)));
  root.append(h('h2', T.title), h('p.lead', T.lead), nav,
    ...Object.entries(sections).map(([id, make]) => h('section.codex-sec', { id: `codex-${id}` }, h('h3', T.sections[id]), make())));
  if (arg && sections[arg]) requestAnimationFrame(() => document.getElementById(`codex-${arg}`)?.scrollIntoView());
  return {};
}

// ----- Park: several pets in one picture ---------------------------------------
const parkPets = new Map();
function viewPark(root) {
  const T = t().park;
  const status = h('p.status', { role: 'status' });
  const list = h('div.park-list');
  const pic = h('div');
  const yaml = h('div');
  const input = h('input', { type: 'text', placeholder: T.placeholder, class: 'mono' });
  const owner = h('input', { type: 'text', placeholder: T.ownerPlaceholder, class: 'mono' });

  async function addRepo(raw) {
    const name = raw.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '');
    if (!name.includes('/')) return;
    if (store.park.length >= LP.PARK_MAX) return void (status.textContent = T.full);
    if (!store.park.includes(name)) store.park.push(name);
    save();
    await draw();
  }

  async function load(fullName) {
    if (parkPets.has(fullName)) return parkPets.get(fullName);
    if (fullName.startsWith('demo/')) {
      const [, , mood, species] = fullName.split('/');
      const snapshot = LP.mockSnapshot({ mood, now: new Date(), fullName: `you/${species}-${mood}` });
      parkPets.set(fullName, snapshot);
      return snapshot;
    }
    const [o, r] = fullName.split('/');
    status.textContent = T.loading(fullName);
    const snapshot = await LP.collectSnapshot(client(), { owner: o, repo: r, now: new Date() });
    parkPets.set(fullName, snapshot);
    return snapshot;
  }

  async function draw() {
    list.replaceChildren(...store.park.map((name) => h('span.chip', name.startsWith('demo/') ? name.split('/').slice(2).join(' · ') : name,
      h('button', { type: 'button', 'aria-label': 'remove', onclick: () => { store.park = store.park.filter((x) => x !== name); save(); draw(); } }, '×'))));
    if (!store.park.length) {
      pic.replaceChildren(h('div.empty', T.empty));
      yaml.replaceChildren();
      status.textContent = '';
      return;
    }
    const pets = [];
    for (const name of store.park) {
      try {
        const snapshot = await load(name);
        const [, , mood, species] = name.startsWith('demo/') ? name.split('/') : [];
        pets.push(LP.buildPet({ snapshot, now: new Date(), options: { lang: store.cfg.lang, ...(species ? { species, mood, holiday: null } : {}) } }));
      } catch {
        status.textContent = T.failed(name);
      }
    }
    if (pets.length) {
      status.textContent = '';
      const svg = LP.renderPark(pets, { owner: store.cfg.repo.split('/')[0] || 'you', lang: store.cfg.lang, theme: cardTheme() });
      const shown = stillAll() ? LP.renderPark(pets, { owner: store.cfg.repo.split('/')[0] || 'you', lang: store.cfg.lang, theme: cardTheme(), still: true }) : svg;
      pic.replaceChildren(img(shown, 'park-img', 'park'), h('div.links', h('a', { href: svgSrc(svg), download: 'park.svg' }, `${t().common.download} park.svg`)));
      const real = store.park.filter((n) => !n.startsWith('demo/'));
      yaml.replaceChildren(h('p.small.muted', T.yaml), codeBlock(`      - uses: Tanx-1811/legacypet@v1\n        with:\n          park: ${real.length ? real.join(', ') : 'auto'}`));
    }
  }

  const demo = () => {
    store.park = [['ecstatic', 'duck'], ['happy', 'cat'], ['sick', 'octopus'], ['hungry', 'snake'], ['party', 'crab'], ['zombie', 'blob']].map(([m, s]) => `demo/x/${m}/${s}`);
    save();
    draw();
  };
  const fetchOwner = async () => {
    const name = owner.value.trim();
    if (!name) return;
    try {
      status.textContent = T.loading(name);
      const repos = await LP.resolveParkRepos(client(), { owner: name, spec: 'auto', size: 6 });
      store.park = repos;
      save();
      await draw();
    } catch (err) {
      status.textContent = err.message;
    }
  };

  root.append(h('h2', T.title), h('p.lead', T.lead),
    h('section.panel.stack',
      h('form.row', { onsubmit: (e) => { e.preventDefault(); addRepo(input.value); input.value = ''; } }, h('div', { style: { flex: '1 1 220px' } }, input), h('button.primary', { type: 'submit' }, T.add)),
      h('form.row', { onsubmit: (e) => { e.preventDefault(); fetchOwner(); } }, h('span.small.muted', T.owner), h('div', { style: { flex: '1 1 160px' } }, owner), h('button', { type: 'submit' }, T.fetchOwner)),
      h('div.row', h('button', { type: 'button', onclick: demo }, `🎲 ${T.demo}`), h('button.ghost', { type: 'button', onclick: () => { store.park = []; save(); draw(); } }, T.clear)),
      list, status),
    h('section.panel', pic, yaml));
  draw();
  return { redraw: draw };
}

// The workflow inputs, from the choices made anywhere in the playground.
function adoptOptions(cfg = store.cfg) {
  return {
    lang: cfg.lang, species: cfg.species, scenery: cfg.scenery, name: cfg.name, color: cfg.color, motto: cfg.motto.trim(), wear: cfg.wear.join(', '),
    alerts: cfg.alerts.join(', '), vacation: cfg.vacation ? `until ${cfg.vacation}` : '', park: cfg.style === 'park' ? 'auto' : '',
  };
}

// The last repo list the picker loaded: Adopt reuses it to fill in names, branches and privacy.
const picker = { owner: '', repos: null };
const pickedRepo = (fullName) => picker.repos?.find((r) => r.fullName.toLowerCase() === String(fullName).toLowerCase());

// ----- Adopt: everything needed to install it, from the choices made anywhere ---
function viewAdopt(root) {
  const T = t().adopt;
  const C = t().common;
  const L = () => tr();
  const preview = h('div.shots');
  const steps = h('div.steps');
  // Suggests the repos the picker already listed, and knows their privacy.
  const repo = h('input', { type: 'text', value: store.cfg.repo, placeholder: T.repoPlaceholder, class: 'mono', list: 'picked-repos' });
  const repoList = h('datalist', { id: 'picked-repos' }, (picker.repos ?? []).map((r) => h('option', { value: r.fullName })));
  repo.oninput = () => {
    store.cfg.repo = repo.value.trim();
    const known = pickedRepo(store.cfg.repo);
    if (known) { store.cfg.private = known.isPrivate; privateBox.checked = known.isPrivate; }
    save();
    draw();
  };
  const vacation = h('input', { type: 'date', value: store.cfg.vacation });
  vacation.onchange = () => { store.cfg.vacation = vacation.value; save(); draw(); };
  const wearBox = h('div.tiles.compact');
  const privateBox = h('input', { type: 'checkbox', checked: Boolean(store.cfg.private) });
  privateBox.onchange = () => { store.cfg.private = privateBox.checked; save(); draw(); };
  const alertBox = h('div.row');

  function draw() {
    const cfg = store.cfg;
    const lang = L();
    const fullName = cfg.repo.includes('/') ? cfg.repo : 'OWNER/REPO';
    const pet = demoPet({ species: cfg.species === 'auto' ? 'cat' : cfg.species, scenery: cfg.scenery, name: cfg.name || undefined, color: cfg.color, motto: cfg.motto, wear: cfg.wear.join(','), unlockAll: true, fullName });
    preview.replaceChildren(img(LP.renderCard(pet, { theme: cardTheme(), still: stillAll() }), 'card-img', pet.displayName));
    wearBox.replaceChildren(...LP.ITEMS.map((item) => h(`button.tile${cfg.wear.includes(item.id) ? '.on' : ''}`, {
      type: 'button', title: LP.unlockHint(lang, item),
      onclick: () => {
        const others = cfg.wear.filter((id) => LP.ITEMS.find((i) => i.id === id).slot !== item.slot);
        cfg.wear = cfg.wear.includes(item.id) ? others : [...others, item.id];
        save();
        draw();
      },
    }, h('span.em', item.emoji), h('span.name', lang.items[item.id]), h('span.hint', LP.unlockHint(lang, item)))));
    alertBox.replaceChildren(...ALERT_MOODS.map((m) => {
      const box = h('input', { type: 'checkbox', checked: cfg.alerts.includes(m) });
      box.onchange = () => { cfg.alerts = ALERT_MOODS.filter((x) => (x === m ? box.checked : cfg.alerts.includes(x))); save(); draw(); };
      return h('label.check', box, `${LP.MOOD_EMOJI[m]} ${lang.moods[m]}`);
    }));
    const flags = [
      cfg.lang !== 'en' && `--lang ${cfg.lang}`, cfg.species !== 'auto' && `--species ${cfg.species}`, cfg.scenery !== 'auto' && `--scenery ${cfg.scenery}`,
      cfg.name && `--name "${cfg.name.replace(/"/g, '')}"`, cfg.color !== 'auto' && `--color ${cfg.color}`, cfg.motto.trim() && `--motto "${cfg.motto.trim().replace(/"/g, '')}"`,
      cfg.style !== 'card' && `--style ${cfg.style}`, cfg.private && '--private',
    ].filter(Boolean);
    const options = adoptOptions(cfg);
    const yaml = LP.workflowYaml(options);
    const commands = LP.COMMANDS.map((c) => `/pet${c === 'status' ? '' : ` ${c}`}  ${lang.command.usage[c]}`).join('\n');
    // One click: GitHub's "new file" page with the workflow filled in (see adoptUrl in src/setup.js).
    const known = hatch.snapshot && !hatch.mood && hatch.snapshot.repo.fullName === cfg.repo ? hatch.snapshot.repo.defaultBranch : (pickedRepo(cfg.repo)?.defaultBranch ?? 'main');
    const ready = /^[\w.-]+\/[\w.-]+$/.test(cfg.repo);
    // The one-click path comes first; the terminal and hand-made routes wait behind a toggle.
    steps.replaceChildren(
      h('div.step', h('h3', T.oneClick),
        h('a.button.primary', { href: ready ? LP.adoptUrl(cfg.repo, known, options) : null, target: '_blank', rel: 'noopener', 'aria-disabled': String(!ready) }, T.oneClickButton),
        h('p', ready ? T.oneClickNote : T.needRepo, ready && hatch.blind && hatch.snapshot?.repo.fullName === cfg.repo ? ` ${T.blindBranch}` : '')),
      h('div.step', h('h3', T.step3), seg(Object.entries(T.styles), cfg.style, (v) => { cfg.style = v; save(); draw(); }, T.style), codeBlock(LP.snippetFor(fullName, cfg.style, 'legacypet', { isPrivate: Boolean(cfg.private) }))),
      h('div.step', h('h3', T.commands), codeBlock(commands)));
    manual.replaceChildren(
      h('div.alt-step', h('h4', T.step1), h('p', T.step1Note), codeBlock(['npx github:Tanx-1811/legacypet init', ...flags].join(' '))),
      h('div.or', T.or),
      h('div.alt-step', h('h4', T.step2), codeBlock(yaml)));
  }
  // Built once, so redrawing (typing the repo name) never snaps the toggles shut.
  const manual = h('div.alt');
  const extrasSet = store.cfg.wear.length || store.cfg.alerts.length || store.cfg.vacation || store.cfg.private;

  root.append(h('h2', T.title), h('p.lead', T.lead),
    h('div.grid2',
      h('div.stack',
        h('section.panel.stack', h('label.field', T.repo, repo, repoList), h('h3', { style: { margin: '6px 0 0' } }, T.look), lookFields(draw), preview),
        h('details.panel.more', { open: Boolean(extrasSet) }, h('summary', T.moreOptions),
          h('div.stack', h('div.small.muted', T.wear), wearBox,
            h('div.small.muted', T.alerts), alertBox, h('label.field', T.vacation, vacation), h('label.check', privateBox, T.private)))),
      h('section.panel', steps, h('details.manual', h('summary', T.advanced), manual))));
  draw();
  return { redraw: draw };
}

// ---------------------------------------------------------------------------
// Shell: sidebar, navigation, routing, language and theme
// ---------------------------------------------------------------------------
// On someone's computer (the LegacyPet app) the first view is their own pets; on the web
// it's the playground, with a page to download the app.
const homeKit = homeViews({
  h, img, svgSrc, toast, t, tr, store, save, cardTheme, checkupList, questList, codeBlock, seg, select, go_, LP, Sim, stopAuto, demoPet,
  icon, btn, render: () => render(), motion, stillAll, gridPic, setMotion: (v) => setMotion(v),
});
const VIEWS = {
  home: homeKit.views.home, hatch: viewHatch, sim: viewSim, codex: viewCodex, park: viewPark, adopt: viewAdopt,
  settings: homeKit.views.settings, get: homeKit.views.get,
};
// The sidebar: your own pets first (in the app), then the playground, then settings or the download.
const SECTIONS = LOCAL
  ? [['mine', ['home']], ['explore', ['hatch', 'sim', 'codex', 'park', 'adopt']], ['bottom', ['settings']]]
  : [['explore', ['hatch', 'sim', 'codex', 'park', 'adopt']], ['bottom', ['get']]];
const NAV = SECTIONS.flatMap(([, ids]) => ids);
const NAV_ICONS = {
  home: 'layout-dashboard', hatch: 'egg', sim: 'gamepad-2', codex: 'book-open', park: 'trees', adopt: 'heart-handshake', settings: 'settings', get: 'monitor-down',
};
const DEFAULT_VIEW = NAV[0];
const isMac = /mac/i.test(navigator.userAgentData?.platform ?? navigator.platform ?? '');
let current = null;

function route() {
  const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [view, ...rest] = raw.split('/');
  // Old share links were #owner/repo.
  if (raw && !VIEWS[view] && raw.includes('/')) return { view: 'hatch', arg: raw };
  return { view: NAV.includes(view) ? view : DEFAULT_VIEW, arg: rest.join('/') };
}

function go_(view, arg = '') {
  location.hash = `#/${view}${arg ? `/${arg}` : ''}`;
}

function drawNav(view) {
  const T = t();
  const care = LOCAL ? homeKit.careCount() : 0;
  const item = (id) => h('a.nav-item', {
    href: `#/${id}`, 'data-view': id, title: T.navHint[id], 'aria-current': id === view ? 'page' : null,
  }, icon(NAV_ICONS[id], { size: 18 }), h('span.label', T.nav[id]),
  id === 'home' && care ? h('span.badge', { title: T.home.filters.care }, care) : null);
  $('#nav').replaceChildren(...SECTIONS.map(([section, ids]) => h(`div.nav-group.${section}`,
    section === 'bottom' ? null : h('div.nav-head', T.side[section]),
    section === 'bottom' && !LOCAL
      ? h('a.nav-cta', { href: '#/get', 'aria-current': view === 'get' ? 'page' : null, title: T.side.getAppNote },
        icon('monitor-down', { size: 18 }), h('span.label', h('b', T.side.getApp), h('small', T.side.getAppNote)))
      : ids.map(item))));
}

function render() {
  const { view, arg } = route();
  current?.leave?.();
  const T = t();
  document.documentElement.lang = store.ui;
  document.title = `LegacyPet · ${T.nav[view]}`;
  drawNav(view);
  drawSide();
  const main = $('#view');
  main.replaceChildren();
  const root = h('div.view');
  main.append(root);
  current = VIEWS[view](root, arg) ?? {};
  $('#footer-text').textContent = LOCAL ? T.footerLocal : T.footer;
  $('#tagline').textContent = T.tagline;
  drawToolbar();
  navHeight();
}

// The search button and the collapse toggle at the top of the sidebar.
function drawSide() {
  const T = t().side;
  const collapsed = store.side === 'collapsed';
  document.querySelector('.shell').classList.toggle('collapsed', collapsed);
  $('#side-toggle').replaceChildren(icon('panel-left', { size: 18 }));
  $('#side-toggle').title = collapsed ? T.expand : T.collapse;
  $('#side-toggle').setAttribute('aria-label', $('#side-toggle').title);
  $('#side-toggle').setAttribute('aria-expanded', String(!collapsed));
  $('#side-search').replaceChildren(icon('search', { size: 16 }), h('span.label', T.search), h('kbd.kbd', isMac ? '⌘K' : 'Ctrl K'));
  $('#side-search').title = `${T.search} (${isMac ? '⌘K' : 'Ctrl+K'})`;
}

function drawToolbar() {
  const T = t();
  const bar = $('#toolbar');
  const themeIcon = { auto: 'sun-moon', light: 'sun', dark: 'moon' }[store.theme];
  bar.replaceChildren(
    seg(Object.entries(UI_LANGS).map(([code]) => [code, code.toUpperCase()]), store.ui, (v) => setLang(v), T.common.uiLang),
    btn('', { icon: themeIcon, kind: 'ghost', title: `${T.common.theme}: ${T.common.themes[store.theme]}`, onclick: cycleTheme }),
    btn('', { icon: 'gauge', kind: 'ghost', title: `${T.common.motion}: ${T.common.motions[store.motion]}`, onclick: () => setMotion(MOTIONS[(MOTIONS.indexOf(store.motion) + 1) % MOTIONS.length]) }),
    btn('', { icon: 'external-link', kind: 'ghost', title: 'GitHub', href: 'https://github.com/Tanx-1811/legacypet' }));
}

function setLang(v) {
  // The pet follows the interface language until someone picks another one.
  if (store.cfg.lang === store.ui) store.cfg.lang = v;
  store.ui = v;
  save();
  if (LOCAL) api('config', { ui: v }).catch(() => {});
  render();
}

function cycleTheme() {
  store.theme = { auto: 'light', light: 'dark', dark: 'auto' }[store.theme];
  applyTheme();
  save();
  codexCache.clear();
  current?.redraw?.();
  drawToolbar();
}

// The desktop pet's window reads the same setting from this browser's storage, and hears about
// a change through the app (its 'config' event), so it is saved right away.
function setMotion(value) {
  store.motion = MOTIONS.includes(value) ? value : 'auto';
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage is optional */ }
  if (LOCAL) api('config', { motion: store.motion }).catch(() => {});
  current?.redraw?.();
  drawToolbar();
}

function applyTheme() {
  if (store.theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = store.theme;
}

// ⌘K: every page, every pet and the useful actions, from the keyboard.
const palette = createPalette({
  h, icon, t,
  items: () => {
    const T = t();
    const A = T.palette.actions;
    const items = NAV.map((id) => ({ group: 'nav', icon: NAV_ICONS[id], label: T.nav[id], hint: T.navHint[id], run: () => go_(id) }));
    const state = homeKit.state;
    if (LOCAL && state) {
      for (const p of state.projects.filter((x) => x.summary)) {
        items.push({ group: 'projects', icon: 'paw-print', label: `${p.summary.name} · ${p.folder}`, hint: p.github ? p.fullName : p.path, keywords: p.path, run: () => go_('home', p.id) });
      }
      items.push(
        { group: 'actions', icon: 'refresh-cw', label: A.refresh, run: () => homeKit.actions.refresh() },
        { group: 'actions', icon: 'search', label: A.rescan, run: () => homeKit.actions.rescan() },
        { group: 'actions', icon: 'folder-plus', label: A.addFolder, run: () => homeKit.actions.addFolder() },
        { group: 'actions', icon: 'cloud-upload', label: A.adoptAll, run: () => homeKit.actions.adoptAll() },
        { group: 'actions', icon: 'cookie', label: A.feedAll, run: () => homeKit.actions.careAll('feed') },
        { group: 'actions', icon: 'volleyball', label: A.playAll, run: () => homeKit.actions.careAll('play') },
        { group: 'actions', icon: 'hand-heart', label: A.patAll, run: () => homeKit.actions.careAll('pat') },
        { group: 'actions', icon: 'archive', label: A.backup, run: () => homeKit.actions.exportBackup() },
      );
      if (MODE === 'desktop') items.push({ group: 'actions', icon: 'monitor', label: A.float, run: () => homeKit.actions.toggleFloat() });
    }
    items.push(
      { group: 'actions', icon: { auto: 'sun-moon', light: 'sun', dark: 'moon' }[store.theme], label: A.theme, run: cycleTheme },
      { group: 'actions', icon: 'gauge', label: A.motion, run: () => setMotion(MOTIONS[(MOTIONS.indexOf(store.motion) + 1) % MOTIONS.length]) },
      { group: 'actions', icon: 'languages', label: A.lang, run: () => setLang(store.ui === 'vi' ? 'en' : 'vi') },
    );
    return items;
  },
});

$('#side-search').addEventListener('click', () => palette.open());
$('#side-toggle').addEventListener('click', () => {
  store.side = store.side === 'collapsed' ? 'open' : 'collapsed';
  save();
  drawSide();
});

darkQuery.addEventListener('change', () => { if (store.theme === 'auto') { codexCache.clear(); current?.redraw?.(); } });
onMotionPreference(() => { if (store.motion === 'auto') current?.redraw?.(); });
window.addEventListener('hashchange', render);
// Sticky bars inside a view (the codex index) sit right under the top bar on small screens.
const wide = matchMedia('(min-width: 960px)');
const navHeight = () => document.documentElement.style.setProperty('--nav-h', `${wide.matches ? 0 : $('#side').offsetHeight}px`);
window.addEventListener('resize', navHeight);
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    palette.open();
    return;
  }
  if (e.target.closest('input, select, textarea, [contenteditable], dialog')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '/') {
    e.preventDefault();
    if (!current?.focusSearch?.()) palette.open();
    return;
  }
  current?.keys?.(e);
});

// The app on this computer: live updates from the server, notifications, and the GitHub
// token for the repo picker when "GitHub details" is on.
async function bootLocal() {
  document.documentElement.classList.add('is-app', `mode-${MODE}`);
  if (desktop?.platform) document.documentElement.classList.add(`os-${desktop.platform}`);
  const state = await homeKit.load().catch(() => null);
  if (!state) return;
  // The app remembers the interface language for its notifications and its menu bar menu;
  // a window that has nothing saved yet (a new desktop window) takes it from there.
  if (freshStore && ['vi', 'en'].includes(state.config.ui) && state.config.ui !== store.ui) {
    store.ui = state.config.ui;
    store.cfg.lang = state.config.ui;
    save();
  } else if (state.config.ui !== store.ui) api('config', { ui: store.ui }).catch(() => {});
  // Same for how much the pets move, which the desktop pet's window follows too.
  if (freshStore && MOTIONS.includes(state.config.motion)) store.motion = state.config.motion;
  else if (state.config.motion !== store.motion) api('config', { motion: store.motion }).catch(() => {});
  if (state.config.online) api('token').then((r) => { if (r.token) ghToken = r.token; }).catch(() => {});
  homeKit.subscribe(() => drawNav(route().view));
  listen({
    onChange: () => homeKit.load().then(() => current?.redraw?.()).catch(() => {}),
    onEvent: (e) => {
      // Muted kinds only land under "Just happened"; quiet hours only silence system notifications.
      if (e.muted) return;
      toast(e.text, e.urgent ? '' : 'gold');
      // The desktop app shows native notifications itself.
      if (MODE !== 'desktop' && (e.notify ?? homeKit.state?.config.notify) && document.hidden && globalThis.Notification?.permission === 'granted') {
        new Notification('LegacyPet', { body: e.text, tag: `lp-${e.id}` });
      }
    },
  });
  render();
}

applyTheme();
render();
navHeight();
if (LOCAL) bootLocal();
