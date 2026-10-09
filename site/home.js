// "My pets", Settings and the download page. Home and Settings only exist when the
// playground runs as the LegacyPet app on someone's computer (see local.js).
import { barList, heatmap, localDayKey, statTile } from './charts.js';
import { api, byNeed, desktop, LOCAL, MODE, petOf } from './local.js';

export function homeViews(kit) {
  const { h, svgSrc, toast, t, tr, store, cardTheme, checkupList, questList, codeBlock, seg, select, go_, LP, icon, btn } = kit;
  // replaceChildren() would print "null" for a missing piece: drop those first.
  const fill = (el, ...kids) => el.replaceChildren(...kids.flat().filter((k) => k != null && k !== false && k !== ''));

  // ----- Shared state from the local server --------------------------------------
  let state = null;
  let loading = null;
  const subscribers = new Set();
  const publish = () => { for (const fn of subscribers) fn(state); };
  async function load() {
    loading ??= api('state').then((s) => { state = s; return s; }).finally(() => { loading = null; });
    await loading;
    publish();
    return state;
  }
  const use = (next) => { state = next; publish(); return state; };

  const lang = () => store.cfg.lang;
  const ago = (iso) => {
    if (!iso) return '';
    const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
    const fmt = new Intl.RelativeTimeFormat(store.ui, { numeric: 'auto' });
    if (Math.abs(mins) < 60) return fmt.format(-mins, 'minute');
    const hours = Math.round(mins / 60);
    if (hours < 24) return fmt.format(-hours, 'hour');
    const days = Math.round(hours / 24);
    if (days < 60) return fmt.format(-days, 'day');
    return days < 730 ? fmt.format(-Math.round(days / 30), 'month') : fmt.format(-Math.round(days / 365), 'year');
  };
  const num = (n) => Number(n ?? 0).toLocaleString(store.ui);

  // Pictures are the slow part: draw each pet once per (run, language, theme).
  const pics = new Map();
  function pic(project, kind) {
    const key = `${project.id}|${project.now}|${kind}|${lang()}|${cardTheme()}|${JSON.stringify(project.options)}`;
    if (!pics.has(key)) {
      const pet = petOf(project, { lang: lang() });
      if (!pet) return null;
      const svg = kind === 'card' ? LP.renderCard(pet, { theme: cardTheme() }) : LP.renderMini(pet, { theme: cardTheme() });
      if (pics.size > 400) pics.clear();
      pics.set(key, svgSrc(svg));
    }
    return pics.get(key);
  }

  const counts = (list) => ({
    all: list.length,
    care: list.filter((p) => p.summary && p.summary.attention !== 'good').length,
    none: list.filter((p) => p.status === 'none').length,
    live: list.filter((p) => p.status === 'live').length,
  });
  const careCount = () => (state ? counts(state.projects).care : 0);
  const isPinned = (id) => (state?.config.pinned ?? []).includes(id);

  async function togglePin(id) {
    const pinned = state.config.pinned ?? [];
    try {
      use(await api('config', { pinned: pinned.includes(id) ? pinned.filter((x) => x !== id) : [...pinned, id] }));
    } catch (err) { toast(err.message, 'bad'); }
  }

  // Commits per day, summed over the given projects: { 'YYYY-MM-DD': n }.
  function combined(projects) {
    const out = {};
    for (const p of projects) for (const [day, n] of Object.entries(p.activity ?? {})) out[day] = (out[day] ?? 0) + n;
    return out;
  }
  function lastDays(activity, from, to) {
    let total = 0;
    const d = new Date();
    d.setHours(12);
    d.setDate(d.getDate() - from);
    for (let i = from; i < to; i++) {
      total += activity[localDayKey(d)] ?? 0;
      d.setDate(d.getDate() - 1);
    }
    return total;
  }

  const VITAL_ICONS = { fullness: 'utensils', health: 'heart', joy: 'smile', energy: 'zap' };
  // Just the pet's little world, without the name plate under it (the page already says that).
  const scene = (p, cls = '', alt = '') => h(`div.scene${cls ? `.${cls}` : ''}`, h('img', { src: pic(p, 'mini'), alt, loading: 'lazy' }));
  function vitalBars(vitals) {
    const L = tr();
    return h('div.bars', ['fullness', 'health', 'joy', 'energy'].map((k) => {
      const v = vitals?.[k] ?? 0;
      return h('div.bar', { title: `${L.stats[k]}: ${v}` },
        icon(VITAL_ICONS[k], { size: 13 }),
        h(`div.meter.${v < 35 ? 'low' : v < 60 ? 'mid' : 'ok'}`, h('i', { style: { width: `${v}%` } })));
    }));
  }

  function statusPill(p, { quiet = false } = {}) {
    // On cards, "not adopted" is the usual case: the filter and the banner already say it.
    if (quiet && p.status === 'none') return null;
    return h(`span.pill.${p.status}`, h('i.dot'), t().home.status[p.status]);
  }
  function workPills(p) {
    const T = t().home;
    return [
      p.dirty ? h('span.pill', { title: T.dirty(p.dirty) }, icon('pencil', { size: 11 }), p.dirty) : null,
      p.ahead ? h('span.pill.warn', { title: T.ahead(p.ahead) }, icon('cloud-upload', { size: 11 }), p.ahead) : null,
      p.summary?.streak >= 2 ? h('span.pill.flame', { title: `${t().home.facts.streak}: ${t().home.kpi.days(p.summary.streak)}` }, icon('flame', { size: 11 }), p.summary.streak) : null,
    ];
  }

  // A small dropdown menu: [{ icon, label, run, href }].
  function menu(trigger, items) {
    const box = h('div.menu', { role: 'menu', hidden: true });
    const wrap = h('div.menu-wrap', trigger, box);
    const close = () => { box.hidden = true; document.removeEventListener('pointerdown', outside); };
    const outside = (e) => { if (!wrap.contains(e.target)) close(); };
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.addEventListener('click', () => {
      if (!box.hidden) return close();
      fill(box, ...items.filter(Boolean).map((item) => (item === '-' ? h('div.menu-sep') : h(item.href ? 'a.menu-item' : 'button.menu-item', {
        role: 'menuitem', type: item.href ? null : 'button', href: item.href ?? null,
        target: item.href && /^https?:/.test(item.href) ? '_blank' : null, rel: item.href ? 'noopener' : null,
        onclick: () => { close(); item.run?.(); },
      }, icon(item.icon, { size: 15 }), h('span', item.label)))));
      box.hidden = false;
      document.addEventListener('pointerdown', outside);
    });
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); trigger.focus(); } });
    return wrap;
  }

  // ----- Actions shared by pages and the ⌘K palette ---------------------------------
  async function refreshAll(button) {
    const T = t().home;
    if (button) button.disabled = true;
    try { use(await api('refresh', {})); toast(T.updated(ago(new Date().toISOString())), 'good'); } catch (err) { toast(err.message, 'bad'); }
    if (button) button.disabled = false;
  }
  async function rescan() {
    toast(t().home.refreshing);
    try { use(await api('scan', {})); } catch (err) { toast(err.message, 'bad'); }
  }
  async function addFolder() {
    try {
      const path = desktop?.pickFolder ? await desktop.pickFolder() : (await api('pick-folder', {})).path;
      if (!path) return;
      toast(t().home.refreshing);
      use(await api('config', { roots: [...new Set([...state.config.roots, path])] }));
    } catch (err) {
      toast(err.message, 'bad');
    }
  }
  async function openWith(p, kind) {
    try {
      const res = await api(`projects/${p.id}/open`, { with: kind });
      toast(t().home.opened(res.tool), 'good');
    } catch (err) {
      toast(err.message, 'bad');
    }
  }
  async function copyPath(p) {
    try { await navigator.clipboard.writeText(p.path); toast(t().home.pathCopied, 'good'); } catch { toast(p.path); }
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast(t().home.share.copied, 'good'); } catch { toast(text); }
  }

  const CARE_ICONS = { feed: 'cookie', play: 'volleyball', pat: 'hand-heart' };
  const careLabel = (name) => t().sim[name].replace(/^\S+\s/, '');
  // One snack, game or pat for every pet; each pet still takes one of each a day.
  async function careAll(name) {
    try {
      const res = await api('care-all', { name });
      use(res.state);
      toast(t().home.careAllDone(t().sim[name], res.ok, res.again + res.cant), res.ok ? 'good' : '');
    } catch (err) { toast(err.message, 'bad'); }
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name, hidden: true });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  // The card as a picture for chats and slides: drawn at twice its size, pixels kept sharp.
  async function svgToPng(svg, scale = 2) {
    const image = new Image();
    await new Promise((done, fail) => { image.onload = done; image.onerror = () => fail(new Error('PNG')); image.src = svgSrc(svg); });
    const canvas = h('canvas', { width: image.naturalWidth * scale, height: image.naturalHeight * scale });
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return new Promise((done) => canvas.toBlob(done, 'image/png'));
  }

  async function exportBackup() {
    try {
      const data = await api('backup');
      download(new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' }), `legacypet-backup-${localDayKey(new Date())}.json`);
      toast(t().settings.exported, 'good');
    } catch (err) { toast(err.message, 'bad'); }
  }
  function importBackup() {
    const T = t().settings;
    const input = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;
      let data;
      try { data = JSON.parse(await file.text()); } catch { toast(T.badFile, 'bad'); return; }
      try {
        toast(t().home.refreshing);
        const res = await api('restore', data);
        use(res.state);
        toast(T.restored(res.pets, res.folders), 'good');
        kit.render();
      } catch (err) { toast(err.status === 400 ? T.badFile : err.message, 'bad'); }
    };
    document.body.append(input);
    input.click();
  }

  // The last fetch or pull per project, so its result survives the redraw that follows it.
  const syncNotes = new Map();
  async function syncGit(p, action) {
    const S = t().home.sync;
    try {
      const res = await api(`projects/${p.id}/git`, { action });
      syncNotes.set(p.id, res.ok ? null : res);
      const i = state.projects.findIndex((x) => x.id === p.id);
      if (i !== -1) state.projects[i] = res.project;
      publish();
      if (res.ok) toast(action === 'pull' ? S.pulled : S.fetched(res.project.behind ?? 0), 'good');
      else toast(res.hint ? t().home.hints[res.hint] : S.failed, 'bad');
    } catch (err) { toast(err.message, 'bad'); }
  }

  // ----- Onboarding: ask before looking anywhere --------------------------------
  function onboarding(root) {
    const T = t().home;
    const chosen = new Map(state.suggestions.map((s) => [s.path, s]));
    const list = h('ul.folder-list');
    const status = h('p.status', { role: 'status' });
    const allowBtn = btn(T.allow, { icon: 'search', kind: 'primary big' });
    const pathInput = h('input', { type: 'text', placeholder: T.typePath, class: 'mono', spellcheck: 'false', autocomplete: 'off' });

    function drawList() {
      fill(list, ...[...chosen.values()].map((s) => {
        const box = h('input', { type: 'checkbox', checked: s.checked });
        box.onchange = () => { s.checked = box.checked; };
        const tag = s.label === '~' ? T.wholeHome : s.exists === null ? T.maybe : s.current ? T.current : T.found;
        return h('li', h('label.check', box, icon(s.label === '~' ? 'house' : 'folder-git-2', { size: 16 }), h('span.mono', s.label), h('span.pick-tag', tag)));
      }));
    }
    const addPath = (path) => {
      if (!path) return;
      chosen.set(path, { path, label: path, exists: true, checked: true });
      drawList();
    };
    pathInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addPath(pathInput.value.trim()); pathInput.value = ''; } };
    const pickBtn = btn(T.addFolder, {
      icon: 'folder-plus',
      onclick: async () => {
        try {
          const { path } = desktop?.pickFolder ? { path: await desktop.pickFolder() } : await api('pick-folder', {});
          addPath(path);
        } catch { pathInput.focus(); }
      },
    });

    allowBtn.onclick = async () => {
      const roots = [...chosen.values()].filter((s) => s.checked).map((s) => s.path);
      if (!roots.length) { status.textContent = T.pickOne; status.className = 'status bad'; return; }
      allowBtn.disabled = true;
      fill(root, scanningScreen());
      try {
        use(await api('allow', { roots }));
        kit.render();
      } catch (err) {
        toast(err.message, 'bad');
        kit.render();
      }
    };

    const eggs = ['egg', 'happy', 'party'].map((mood, i) => h('img.mini-img', {
      src: svgSrc(LP.renderMini(kit.demoPet({ mood, species: ['bunny', 'duck', 'cat'][i], fullName: `you/${['notes', 'app', 'website'][i]}` }), { theme: cardTheme() })), alt: '',
    }));
    drawList();
    root.append(h('section.onboard',
      h('div.onboard-pets', eggs),
      h('h1', T.welcome),
      h('p.lead', T.welcomeLead),
      h('ul.privacy', T.privacy.map((line, i) => h('li', icon(['shield-check', 'folder-open', 'eye-off'][i], { size: 16 }), h('span', line)))),
      h('div.panel.stack',
        h('h3', T.where),
        list,
        h('div.row', pickBtn, h('div', { style: { flex: '1 1 220px' } }, pathInput)),
        status,
        allowBtn,
        state.platform === 'darwin' ? h('p.small.muted', { style: { margin: 0 } }, T.allowNote) : null)));
    return {};
  }

  function scanningScreen() {
    const T = t().home;
    return h('div.scanning',
      h('img.mini-img.wobble', { src: svgSrc(LP.renderMini(kit.demoPet({ mood: 'egg', species: 'duck', fullName: 'you/app' }), { theme: cardTheme() })), alt: '' }),
      h('p', T.scanning));
  }

  // ----- Dashboard: the overview, then every pet ------------------------------------
  const SORTS = {
    need: byNeed,
    recent: (a, b) => Date.parse(b.snapshot?.commits?.lastDate ?? 0) - Date.parse(a.snapshot?.commits?.lastDate ?? 0),
    name: (a, b) => (a.summary?.name ?? a.folder).localeCompare(b.summary?.name ?? b.folder, store.ui),
    level: (a, b) => (b.summary?.level ?? 0) - (a.summary?.level ?? 0),
  };

  function dashboard(root) {
    const T = t().home;
    const K = T.kpi;
    let filter = store.homeFilter ?? 'all';
    const search = h('input', { type: 'search', placeholder: T.search, 'aria-label': T.search, autocomplete: 'off', spellcheck: 'false' });
    const box = {
      summary: h('p.page-sub'), updated: h('span.small.muted'), kpis: h('div.kpis'), heat: h('div'), top: h('div'), side: h('div.side-col'), notes: h('div.notes'),
      filters: h('div.seg.filters', { role: 'group' }), banner: h('div'), pets: h('div'),
    };
    const refreshBtn = btn(T.refresh, { icon: 'refresh-cw', onclick: (e) => refreshAll(e.currentTarget) });
    const sortSel = select(Object.entries(T.sorts), store.homeSort ?? 'need', (v) => { store.homeSort = v; kit.save(); drawPets(); }, T.sortLabel);
    const viewSeg = h('div.seg.view-seg', { role: 'group', 'aria-label': T.views.grid },
      ...['grid', 'list'].map((v) => h('button', {
        type: 'button', title: T.views[v], 'aria-label': T.views[v], 'aria-pressed': String((store.homeView ?? 'grid') === v),
        onclick: (e) => { store.homeView = v; kit.save(); for (const b of viewSeg.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); drawPets(); },
      }, icon(v === 'grid' ? 'layout-grid' : 'list', { size: 16 }))));
    search.oninput = () => drawPets();

    function card(p) {
      const L = tr();
      const s = p.summary;
      if (!s) return h('div.pet-card.broken', h('div.pet-info', h('b', p.folder), h('span.small.muted', p.error ?? '?')));
      const last = p.snapshot?.commits?.lastDate;
      const pin = btn('', { icon: isPinned(p.id) ? 'pin-off' : 'pin', kind: `ghost pin${isPinned(p.id) ? ' on' : ''}`, title: isPinned(p.id) ? T.unpin : T.pin, onclick: (e) => { e.preventDefault(); togglePin(p.id); } });
      return h(`a.pet-card.${s.attention}`, { href: `#/home/${p.id}`, title: s.speech },
        scene(p, 'pet-stage', s.displayName),
        h('div.pet-info',
          h('div.pet-name', h('b', s.name), h('span.lv', `Lv.${s.level}`), pin),
          h('div.pet-repo.mono', p.github ? p.fullName : p.folder),
          h('div.pet-mood', h('span', s.emoji), ` ${L.moods[s.mood]}`),
          h('div.pet-when', icon('history', { size: 12 }), last ? ago(last) : T.noCommits),
          vitalBars(s.vitals),
          h('div.pills', statusPill(p, { quiet: true }), workPills(p))));
    }

    function row(p) {
      const L = tr();
      const s = p.summary;
      if (!s) return h('div.pet-row.broken', h('span'), h('b', p.folder), h('span.small.muted', p.error ?? '?'));
      const last = p.snapshot?.commits?.lastDate;
      return h(`a.pet-row.${s.attention}`, { href: `#/home/${p.id}`, title: s.speech },
        scene(p, 'row-pet'),
        h('div.row-main', h('div.pet-name', h('b', s.name), h('span.lv', `Lv.${s.level}`), isPinned(p.id) ? icon('pin', { size: 13, cls: 'pinned-mark' }) : null), h('div.pet-repo.mono', p.github ? p.fullName : p.folder)),
        h('div.row-mood', `${s.emoji} ${L.moods[s.mood]}`),
        h('div.row-vitals', vitalBars(s.vitals)),
        h('div.row-last.small.muted', last ? ago(last) : T.noCommits),
        h('div.pills', statusPill(p), workPills(p)),
        icon('chevron-right', { size: 16, cls: 'row-go' }));
    }

    function drawOverview() {
      const all = state.projects.filter((p) => p.summary);
      const c = counts(state.projects);
      const activity = combined(all);
      const week = lastDays(activity, 0, 7);
      const before = lastDays(activity, 7, 14);
      const best = all.slice().sort((a, b) => b.summary.streak - a.summary.streak)[0];
      box.summary.textContent = T.summary(c.all, c.care, c.live);
      box.updated.textContent = state.scanning ? T.refreshing : all.length ? T.updated(ago(all.map((p) => p.now).sort().pop())) : '';
      fill(box.kpis,
        statTile({ icon: icon('paw-print', { size: 15 }), label: K.pets, value: num(c.all), sub: K.live(c.live) }),
        statTile({ icon: icon('git-commit-horizontal', { size: 15 }), label: K.commits, value: num(week), sub: K.vsLast(week - before), trend: week > before ? 'up' : week < before ? 'down' : '' }),
        statTile({ icon: icon('flame', { size: 15 }), label: K.streak, value: best?.summary.streak ? K.days(best.summary.streak) : '–', sub: best?.summary.streak ? `${best.summary.name} · ${best.folder}` : K.noStreak }),
        statTile({ icon: icon('heart', { size: 15 }), label: K.care, value: num(c.care), sub: c.care ? K.careOf(c.all) : K.allGood, trend: c.care ? 'down' : 'up' }));
      const total = Object.values(activity).reduce((a, b) => a + b, 0);
      fill(box.heat,
        h('div.panel-head', h('h3', T.activityTitle), h('span.small.muted', T.activityTotal(total))),
        heatmap(activity, { locale: store.ui, title: T.activityTitle, value: (n) => T.cell(n, '').replace(/ · $/, ''), less: T.less, more: T.more }),
        heatFacts(activity));
      const top = all.filter((p) => p.summary.commits7 > 0).sort((a, b) => b.summary.commits7 - a.summary.commits7).slice(0, 5);
      fill(box.top, h('h3', T.topTitle), top.length
        ? barList(top.map((p) => ({ label: p.summary.name, sub: p.folder, value: p.summary.commits7, href: `#/home/${p.id}` })), { format: num })
        : h('p.muted.small', T.topEmpty));
      const risky = all.filter((p) => p.summary.streak >= 2 && !p.summary.committedToday).sort((a, b) => b.summary.streak - a.summary.streak).slice(0, 4);
      const recent = (state.events ?? []).filter((e) => Date.now() - Date.parse(e.at) < 3 * 86_400_000).slice(0, 4);
      fill(box.side, h('section.panel.top-panel', box.top));
      fill(box.notes,
        risky.length ? h('section.panel.note-panel', h('h3', icon('flame', { size: 16 }), T.atRisk), h('ul.mini-list', risky.map((p) => h('li', h('a', { href: `#/home/${p.id}` },
          scene(p, 'mini-avatar'), h('span.mini-text', h('b', p.summary.name), h('span.muted.small', T.atRiskItem(p.summary.streak))), icon('chevron-right', { size: 14, cls: 'row-go' }))))))
          : null,
        recent.length ? h('section.panel.note-panel', h('h3', icon('bell', { size: 16 }), T.events), h('ul.mini-list', recent.map((e) => h('li', h('a', { href: `#/home/${e.projectId}` },
          h('span.mini-text', h('span', e.text), h('span.muted.small', ago(e.at))), icon('chevron-right', { size: 14, cls: 'row-go' }))))))
          : null);
      box.notes.hidden = !risky.length && !recent.length;
    }

    // Three quick facts under the calendar: the busiest day, how many days saw a commit, today's run.
    function heatFacts(activity) {
      const F = T.heatFacts;
      const d = new Date();
      d.setHours(12);
      let active = 0;
      let streak = 0;
      let counting = true;
      for (let i = 0; i < 365; i++) {
        const n = activity[localDayKey(d)] ?? 0;
        if (n) active += 1;
        if (counting && n) streak += 1;
        else if (counting && i > 0) counting = false; // today may still be empty
        d.setDate(d.getDate() - 1);
      }
      const best = Object.entries(activity).sort((a, b) => b[1] - a[1])[0];
      const fmt = new Intl.DateTimeFormat(store.ui, { day: 'numeric', month: 'short', year: 'numeric' });
      const fact = (label, value, sub) => h('div.heat-fact', h('span.small.muted', label), h('b', value), sub ? h('span.small.muted', sub) : null);
      return h('div.heat-facts',
        fact(F.best, best ? T.cell(best[1], '').replace(/ · $/, '') : '–', best ? fmt.format(new Date(`${best[0]}T12:00:00`)) : ''),
        fact(F.active, F.of(active, 365)),
        fact(F.streak, K.days(streak)));
    }

    function drawPets() {
      const all = state.projects.slice().sort(SORTS[store.homeSort ?? 'need'] ?? byNeed).sort((a, b) => Number(isPinned(b.id)) - Number(isPinned(a.id)));
      const c = counts(all);
      fill(box.filters, ...Object.entries(T.filters).map(([id, label]) => h('button', {
        type: 'button', 'aria-pressed': String(filter === id),
        onclick: () => { filter = id; store.homeFilter = id; kit.save(); drawPets(); },
      }, label, h('span.count', c[id]))));
      const q = search.value.trim().toLowerCase();
      const shown = all.filter((p) => (filter === 'all' || (filter === 'care' ? p.summary?.attention !== 'good' : p.status === filter))
        && (!q || `${p.folder} ${p.fullName} ${p.summary?.name ?? ''}`.toLowerCase().includes(q)));
      const asList = (store.homeView ?? 'grid') === 'list';
      if (!all.length) fill(box.pets, emptyState());
      else if (!shown.length) fill(box.pets, h('div.empty', T.noMatch));
      else if (asList) {
        const C = T.cols;
        fill(box.pets, h('div.pet-table',
          h('div.pet-row.head', h('span'), h('span', C.pet), h('span', C.mood), h('span', C.vitals), h('span', C.last), h('span', C.status), h('span')),
          shown.map(row)));
      } else fill(box.pets, h('div.pet-grid', shown.map(card)));

      const adoptable = all.filter((p) => p.status === 'none' && p.github && !p.empty);
      fill(box.banner, adoptable.length && filter !== 'live'
        ? h('div.banner', icon('cloud-upload', { size: 18 }), h('span', `${T.filters.none}: ${adoptable.length}`),
          btn(T.adoptAll(adoptable.length), { kind: 'primary', onclick: () => adoptAll(adoptable) }))
        : null);
    }

    function emptyState() {
      return h('div.empty.stack',
        icon('folder-git-2', { size: 28 }),
        h('p', { style: { margin: 0 } }, T.empty), h('p.small', { style: { margin: 0 } }, T.emptyHint),
        h('div.row', { style: { justifyContent: 'center' } }, btn(T.addFolder, { icon: 'folder-plus', kind: 'primary', onclick: addFolder })));
    }

    const draw = () => { if (state) { drawOverview(); drawPets(); } };
    root.append(
      h('header.page-head',
        h('div', h('h1', T.title), box.summary),
        h('div.page-actions', box.updated,
          menu(btn(T.careAll, { icon: 'hand-heart' }), ['feed', 'play', 'pat'].map((name) => ({ icon: CARE_ICONS[name], label: careLabel(name), run: () => careAll(name) }))),
          refreshBtn, btn('', { icon: 'folder-plus', title: T.addFolder, onclick: addFolder }))),
      box.kpis,
      h('div.overview', h('section.panel', box.heat), box.side),
      box.notes,
      h('div.toolbar-row', h('div.search-box', icon('search', { size: 16 }), search), box.filters, h('div.toolbar-end', sortSel, viewSeg)),
      box.banner,
      box.pets);
    draw();
    return { redraw: draw, focusSearch: () => { search.focus(); return true; } };
  }

  // ----- Adopting: a dialog that says exactly what will change -------------------
  function dialog(...children) {
    const el = h('dialog.sheet', ...children);
    el.addEventListener('close', () => el.remove());
    el.addEventListener('click', (e) => { if (e.target === el) el.close(); });
    document.body.append(el);
    el.showModal();
    return el;
  }
  const closeX = () => h('form', { method: 'dialog' }, btn('', { icon: 'x', kind: 'ghost close', title: t().common.close, type: 'submit' }));

  function publishResult(box, result, project) {
    const T = t().home;
    if (!result) return;
    if (result.pushed) box.append(h('p.ok', icon('circle-check', { size: 16 }), T.pushed));
    else if (result.error) {
      box.append(h('div.callout.bad',
        h('b', T.pushFailed), h('pre.small', result.error),
        result.hint ? h('p', { style: { margin: '6px 0 0' } }, T.hints[result.hint]) : null),
      h('div.small.muted', T.copyCommand), codeBlock(`cd "${project.path}"\ngit push`));
    }
  }

  function adoptDialog(project, { update = false } = {}) {
    const T = t().home;
    let style = 'card';
    const files = h('ul.files',
      h('li', icon('file-plus', { size: 15 }), h('code', '.github/workflows/legacypet.yml'), h('span.muted', T.fileWorkflow), project.hasWorkflow ? null : h('span.pill.live', T.fileNew)),
      project.readmeHasPet ? null : h('li', icon('notebook-pen', { size: 15 }), h('code', 'README'), h('span.muted', T.fileReadme)));
    const out = h('div.stack');
    const pushBtn = btn(update ? T.updateGithub : T.adoptPush, { icon: 'cloud-upload', kind: 'primary' });
    const onlyBtn = btn(T.adoptOnly, { icon: 'file-plus' });
    const branch = project.branch && project.branch !== 'HEAD' ? project.branch : project.defaultBranch;
    async function go(publish) {
      pushBtn.disabled = true;
      onlyBtn.disabled = true;
      fill(out, h('p.muted', icon('loader-circle', { size: 16, cls: 'spin' }), T.working));
      try {
        const res = await api(`projects/${project.id}/adopt`, { style, publish, force: update, readme: !update });
        await load();
        if (!publish) fill(out, h('p.ok', icon('circle-check', { size: 16 }), T.written));
        else if (res.publish?.pushed) fill(out, h('p.ok', icon('circle-check', { size: 16 }), T.adopted));
        else { fill(out); publishResult(out, res.publish, project); }
        if (res.publish?.pushed || !publish) toast(publish ? T.adopted : T.written, 'good');
      } catch (err) {
        fill(out, h('div.callout.bad', err.message));
      } finally {
        pushBtn.disabled = false;
        onlyBtn.disabled = false;
      }
    }
    pushBtn.onclick = () => go(true);
    onlyBtn.onclick = () => go(false);
    return dialog(
      closeX(),
      h('h2', update ? T.updateGithub : T.adoptTitle),
      h('p.muted', T.adoptFiles), files,
      update ? null : h('label.field', T.style, seg(Object.entries(t().adopt.styles).filter(([k]) => k !== 'park'), style, (v) => { style = v; }, T.style)),
      h('p.small.muted', T.pushNote(branch)),
      branch !== project.defaultBranch ? h('p.small.warn-text', icon('triangle-alert', { size: 14 }), T.notDefault(branch, project.defaultBranch)) : null,
      h('div.row', pushBtn, update ? null : onlyBtn),
      out);
  }

  function adoptAll(projects = state?.projects.filter((p) => p.status === 'none' && p.github && !p.empty) ?? []) {
    const T = t().home;
    if (!projects.length) return toast(T.noMatch);
    const boxes = projects.map((p) => [p, h('input', { type: 'checkbox', checked: true })]);
    const out = h('div.stack');
    const go = btn(T.adoptAllGo(projects.length), { icon: 'cloud-upload', kind: 'primary' });
    const count = () => boxes.filter(([, b]) => b.checked).length;
    for (const [, b] of boxes) b.onchange = () => { go.querySelector('span').textContent = T.adoptAllGo(count()); go.disabled = !count(); };
    go.onclick = async () => {
      go.disabled = true;
      const picked = boxes.filter(([, b]) => b.checked).map(([p]) => p);
      let ok = 0;
      fill(out);
      for (const p of picked) {
        const line = h('div.small.progress-line', icon('loader-circle', { size: 14, cls: 'spin' }), h('span', p.fullName));
        out.append(line);
        try {
          const res = await api(`projects/${p.id}/adopt`, { style: 'card', publish: true, options: {} });
          if (res.publish?.pushed) { ok += 1; fill(line, icon('circle-check', { size: 14, cls: 'ok-icon' }), h('span', p.fullName)); } else {
            fill(line, icon('circle-x', { size: 14, cls: 'bad-icon' }), h('span', `${p.fullName}: ${res.publish?.hint ? T.hints[res.publish.hint] : res.publish?.error ?? '?'}`));
          }
        } catch (err) {
          fill(line, icon('circle-x', { size: 14, cls: 'bad-icon' }), h('span', `${p.fullName}: ${err.message}`));
        }
      }
      out.append(h('p.ok', T.adoptAllDone(ok, picked.length)));
      await load();
    };
    dialog(
      closeX(),
      h('h2', T.adoptAllTitle), h('p.muted', T.adoptAllLead),
      h('ul.files.scroll', boxes.map(([p, b]) => h('li', h('label.check', b, h('span.mono', p.fullName))))),
      h('div.row', go), out);
  }

  // ----- One pet up close ---------------------------------------------------------
  function detail(root, id) {
    const T = t().home;
    const C = t().common;
    const TABS = ['overview', 'activity', 'progress', 'customize'];
    let tab = TABS.includes(store.detailTab) ? store.detailTab : 'overview';
    const head = h('header.detail-head');
    const tabsBar = h('div.tabs-bar', { role: 'tablist' });
    const panel = h('div.tab-panel', { role: 'tabpanel' });
    const project = () => state.projects.find((x) => x.id === id);

    async function care(name) {
      try {
        const { project: fresh } = await api(`projects/${id}/care`, { name });
        const i = state.projects.findIndex((p) => p.id === id);
        if (i !== -1) state.projects[i] = fresh;
        publish();
        const L = tr();
        const pet = petOf(fresh, { lang: lang() });
        const outcome = fresh.summary.careOutcome;
        const msg = outcome === 'again' ? L.command.again[name]
          : outcome === 'cant' ? (L.command.cant[pet.mood] ?? L.command.cant.egg)
            : LP.commandReply(pet, fresh.snapshot, { command: name, user: fresh.user }).split('\n').find((l) => l.startsWith('> '))?.slice(2);
        if (msg) toast(msg, outcome === 'ok' ? 'good' : '');
      } catch (err) {
        toast(err.message, 'bad');
      }
    }

    function popOut() {
      const url = `float.html?id=${id}`;
      if ('documentPictureInPicture' in window) {
        window.documentPictureInPicture.requestWindow({ width: 230, height: 280 }).then((pip) => {
          pip.document.body.style.margin = '0';
          pip.document.body.append(h('iframe', { src: url, style: { border: '0', width: '100%', height: '100vh' }, title: 'LegacyPet' }));
        }).catch(() => window.open(url, 'legacypet-float', 'width=230,height=280'));
      } else window.open(url, 'legacypet-float', 'width=230,height=280');
    }

    function drawHead(p, pet) {
      const L = tr();
      const tools = state.tools ?? { editors: [], terminals: [] };
      const editor = tools.editors.find((e) => e.id === state.config.editor) ?? tools.editors[0];
      const gh = p.github ? `https://github.com/${p.fullName}` : null;
      const more = menu(btn('', { icon: 'ellipsis', title: T.more }), [
        { icon: 'copy', label: T.copyPath, run: () => copyPath(p) },
        { icon: 'folder-open', label: T.openFolder, run: () => api(`projects/${p.id}/reveal`, {}).catch((e) => toast(e.message, 'bad')) },
        tools.terminals.length ? { icon: 'square-terminal', label: T.openTerminal, run: () => openWith(p, 'terminal') } : null,
        p.remote ? '-' : null,
        p.remote ? { icon: 'refresh-cw', label: `git ${T.sync.fetch.toLowerCase()}`, run: () => syncGit(p, 'fetch') } : null,
        p.remote ? { icon: 'arrow-down-to-line', label: `git ${p.behind ? T.sync.pullN(p.behind).toLowerCase() : T.sync.pull.toLowerCase()}`, run: () => syncGit(p, 'pull') } : null,
        gh ? '-' : null,
        gh ? { icon: 'external-link', label: T.links.repo, href: gh } : null,
        gh ? { icon: 'circle-dot', label: T.links.issues, href: `${gh}/issues` } : null,
        gh ? { icon: 'git-pull-request', label: T.links.pulls, href: `${gh}/pulls` } : null,
        gh ? { icon: 'activity', label: T.links.actions, href: `${gh}/actions` } : null,
        '-',
        { icon: isPinned(p.id) ? 'pin-off' : 'pin', label: isPinned(p.id) ? T.unpin : T.pin, run: () => togglePin(p.id) },
        MODE === 'desktop'
          ? { icon: 'monitor', label: state.config.float && state.config.favorite === p.id ? T.floating : T.float, run: async () => use(await api('config', { float: true, favorite: p.id })) }
          : { icon: 'arrow-up-right', label: T.popOut, run: popOut },
        { icon: 'eye-off', label: T.hide, run: async () => { use(await api(`projects/${p.id}/hide`, {})); toast(T.hidden); go_('home'); } },
      ]);
      fill(head,
        h('nav.crumbs', { 'aria-label': 'breadcrumb' }, h('a', { href: '#/home' }, T.title), icon('chevron-right', { size: 14 }), h('span', pet.name)),
        h('div.detail-title',
          scene(p, 'detail-avatar'),
          h('div',
            h('h1', pet.displayName),
            h('div.detail-meta',
              h('span.mono', p.github ? p.fullName : p.folder),
              h('span', `${p.summary.emoji} ${L.moods[p.summary.mood]}`),
              h('span', `${pet.rank.emoji} ${L.level(pet.level)}`),
              p.branch ? h('span', icon('git-branch', { size: 13 }), p.branch) : null,
              statusPill(p))),
          h('div.page-actions',
            editor ? btn(T.openEditor(editor.name), { icon: 'code-xml', kind: 'primary', onclick: () => openWith(p, 'editor') })
              : btn(T.openFolder, { icon: 'folder-open', onclick: () => api(`projects/${p.id}/reveal`, {}).catch((e) => toast(e.message, 'bad')) }),
            btn('', { icon: 'gamepad-2', title: T.raise, onclick: () => { kit.stopAuto(); store.world = kit.Sim.worldFromSnapshot(p.snapshot); kit.save(); go_('sim'); } }),
            more)));
      fill(tabsBar, ...TABS.map((id_) => h('button.tab', {
        type: 'button', role: 'tab', 'aria-selected': String(tab === id_),
        onclick: () => { tab = id_; store.detailTab = id_; kit.save(); draw(); },
      }, icon({ overview: 'gauge', activity: 'activity', progress: 'trophy', customize: 'sliders-horizontal' }[id_], { size: 15 }), T.tabs[id_])));
    }

    function overviewTab(p, pet) {
      const L = tr();
      // GitHub: where the pet lives, and the one button that moves it there.
      const gh = [h('div.panel-head', h('h3', T.onGithub), statusPill(p))];
      if (p.status === 'local') gh.push(h('p.muted', T.localNote));
      else if (p.status === 'live') {
        gh.push(h('p.muted', T.liveNote), h('div.row',
          btn(T.links.repo, { icon: 'external-link', href: `https://github.com/${p.fullName}` }),
          btn(T.openDiary, { icon: 'notebook-pen', href: `https://github.com/${p.fullName}/blob/legacypet/DIARY.md` })));
      } else if (p.status === 'waiting') {
        const out = h('div.stack');
        const push = btn(T.pushNow, {
          icon: 'cloud-upload', kind: 'primary',
          onclick: async () => {
            push.disabled = true;
            fill(out, h('p.muted', icon('loader-circle', { size: 16, cls: 'spin' }), T.working));
            try {
              const res = await api(`projects/${p.id}/publish`, {});
              fill(out);
              publishResult(out, res.publish, p);
              await load();
            } catch (err) { fill(out, h('div.callout.bad', err.message)); }
            push.disabled = false;
          },
        });
        gh.push(h('p.muted', T.waitingNote), p.ahead ? h('p.small', T.ahead(p.ahead)) : null, h('div.row', push), out);
      } else {
        gh.push(h('p.muted', T.noneNote), h('div.row', btn(T.adopt, { icon: 'cloud-upload', kind: 'primary big', onclick: () => adoptDialog(p) })));
      }
      const local = [
        p.dirty ? { level: 'tip', text: T.dirty(p.dirty) } : null,
        p.ahead ? { level: 'warn', text: T.ahead(p.ahead) } : null,
        p.behind ? { level: 'tip', text: T.behind(p.behind) } : null,
      ].filter(Boolean);
      return h('div.grid2.detail',
        h('div.stack',
          h('section.panel.stage',
            h('img.card-img', { src: pic(p, 'card'), alt: `${pet.displayName}: ${pet.speech}` }),
            h('div.vitals', ['fullness', 'health', 'joy', 'energy'].map((k) => h('div.vital', h('span.vital-name', icon(VITAL_ICONS[k], { size: 13 }), L.stats[k]), h('b', pet.vitals[k]),
              h(`div.meter.${pet.vitals[k] < 35 ? 'low' : pet.vitals[k] < 60 ? 'mid' : 'ok'}`, h('i', { style: { width: `${pet.vitals[k]}%` } }))))),
            h('div.care-row', ['feed', 'play', 'pat'].map((name) => btn(careLabel(name), { icon: CARE_ICONS[name], onclick: () => care(name) }))),
            h('p.small.muted', { style: { margin: 0 } }, T.careNote)),
          sharePanel(p, pet)),
        h('div.stack',
          h('section.panel.github-panel', gh),
          p.remote ? syncPanel(p) : null,
          h('section.panel',
            h('h3', T.todo),
            local.length ? h('ul.checkup', { style: { marginBottom: '10px' } }, local.map((x) => h(`li.${x.level}`, h('span.dot'), h('span', x.text)))) : null,
            checkupList(pet, p.snapshot),
            h('p.small.muted', { style: { margin: '10px 0 0' } }, p.snapshot.source === 'github' ? T.sourceGithub : T.sourceLocal)),
          notesPanel(p)));
    }

    // The card, mini card and badge as files, a PNG for chats, and the README lines.
    function sharePanel(p, pet) {
      const S = T.share;
      const theme = ['light', 'dark'].includes(p.options?.theme) ? p.options.theme : cardTheme();
      const svgs = { card: () => LP.renderCard(pet, { theme }), mini: () => LP.renderMini(pet, { theme }), badge: () => LP.renderBadge(pet) };
      const file = (kind, ext) => `${p.folder}-${kind}.${ext}`;
      const svgBtn = (kind) => btn(S[kind], { icon: 'download', onclick: () => download(new Blob([svgs[kind]()], { type: 'image/svg+xml' }), file(kind, 'svg')) });
      const pngBtn = btn(S.png, {
        icon: 'image-down',
        onclick: async () => {
          try { download(await svgToPng(svgs.card()), file('card', 'png')); } catch (err) { toast(err.message, 'bad'); }
        },
      });
      const snippet = (style) => LP.snippetFor(p.fullName, style, 'legacypet', { isPrivate: Boolean(p.isPrivate) });
      return h('section.panel.stack.tight',
        h('h3', icon('image-down', { size: 16 }), S.title),
        h('div.row', svgBtn('card'), svgBtn('mini'), svgBtn('badge'), pngBtn),
        p.github ? h('div.row',
          btn(S.readme, { icon: 'copy', kind: 'ghost', onclick: () => copyText(snippet('card')) }),
          btn(S.badgeMd, { icon: 'copy', kind: 'ghost', onclick: () => copyText(snippet('badge')) })) : null);
    }

    function syncPanel(p) {
      const S = T.sync;
      const failed = syncNotes.get(p.id);
      const run = (action) => async (e) => {
        const b = e.currentTarget;
        b.disabled = true;
        await syncGit(p, action);
        b.disabled = false;
      };
      return h('section.panel.stack.tight',
        h('h3', icon('git-branch', { size: 16 }), S.title),
        h('div.row',
          btn(S.fetch, { icon: 'refresh-cw', onclick: run('fetch') }),
          btn(p.behind ? S.pullN(p.behind) : S.pull, { icon: 'arrow-down-to-line', kind: p.behind ? 'primary' : '', onclick: run('pull') })),
        failed ? h('div.callout.bad', h('b', S.failed), h('pre.small', failed.error ?? ''), failed.hint ? h('p', { style: { margin: '6px 0 0' } }, T.hints[failed.hint]) : null) : null,
        h('p.small.muted', { style: { margin: 0 } }, S.note));
    }

    // Notes to self, saved a moment after typing stops (and when leaving the box).
    function notesPanel(p) {
      const N = T.notes;
      const area = h('textarea.notes', { rows: 4, placeholder: N.placeholder, maxlength: 4000, 'aria-label': N.title });
      area.value = state.config.notes?.[p.id] ?? '';
      let saved = area.value;
      let timer = null;
      const status = h('span.small.muted', { role: 'status' });
      const save = async () => {
        clearTimeout(timer);
        if (area.value === saved) return;
        saved = area.value;
        try {
          await api('config', { notes: { [p.id]: saved } });
          state.config.notes = { ...state.config.notes, [p.id]: saved };
          status.textContent = `✓ ${N.saved}`;
        } catch (err) { toast(err.message, 'bad'); }
      };
      area.oninput = () => { status.textContent = ''; clearTimeout(timer); timer = setTimeout(save, 800); };
      area.onblur = save;
      return h('section.panel.stack.tight',
        h('div.panel-head', h('h3', icon('sticky-note', { size: 16 }), N.title), status),
        area,
        h('p.small.muted', { style: { margin: 0 } }, N.note));
    }

    function activityTab(p, pet) {
      const F = T.facts;
      const first = p.snapshot.repo.createdAt;
      const history = p.prev?.history ?? [];
      const total = Object.values(p.activity ?? {}).reduce((a, b) => a + b, 0);
      return h('div.stack',
        h('div.kpis',
          statTile({ icon: icon('git-commit-horizontal', { size: 15 }), label: F.total, value: num(p.snapshot.commits.total) }),
          statTile({ icon: icon('users', { size: 15 }), label: F.contributors, value: num(p.snapshot.contributors?.total ?? 1) }),
          statTile({ icon: icon('flame', { size: 15 }), label: F.streak, value: t().home.kpi.days(pet.facts.streak) }),
          statTile({ icon: icon('calendar-days', { size: 15 }), label: F.since, value: first ? new Intl.DateTimeFormat(store.ui, { dateStyle: 'medium' }).format(new Date(first)) : '–', sub: first ? ago(first) : '' })),
        h('section.panel',
          h('div.panel-head', h('h3', T.activityTitle), h('span.small.muted', T.activityOne(total))),
          heatmap(p.activity ?? {}, { locale: store.ui, title: T.activityTitle, value: (n) => T.cell(n, '').replace(/ · $/, ''), less: T.less, more: T.more })),
        h('div.grid2',
          h('section.panel',
            h('h3', T.recentCommits),
            p.log?.length ? h('ul.commit-list', p.log.slice(0, 8).map((c) => h('li',
              h('code.sha', c.sha),
              h('div.commit-main', h('span.commit-subject', c.subject), h('span.small.muted', `${c.author} · ${ago(c.date)}`)),
              p.github ? h('a.commit-link', { href: `https://github.com/${p.fullName}/commit/${c.sha}`, target: '_blank', rel: 'noopener', title: 'GitHub', 'aria-label': 'GitHub' }, icon('arrow-up-right', { size: 14 })) : null)))
              : h('p.muted', T.noCommits)),
          h('section.panel',
            h('h3', T.stats),
            history.length >= 2
              ? h('img.card-img', { src: svgSrc(LP.renderStats(pet, [{ date: pet.date, mood: pet.mood, vitals: ['fullness', 'health', 'joy', 'energy'].map((k) => pet.vitals[k]) }, ...history.filter((x) => x.date !== pet.date)], { theme: cardTheme() })), alt: T.stats })
              : h('p.muted', T.noStats))));
    }

    function progressTab(p, pet) {
      const L = tr();
      const got = new Map(pet.achievements.map((a) => [a.id, a]));
      return h('div.grid2',
        h('section.panel', h('h3', t().hatch.quests), questList(pet, L), h('p.small.muted', { style: { margin: '10px 0 0' } }, L.questBoard.reward)),
        h('section.panel',
          h('div.panel-head', h('h3', T.trophies), h('span.small.muted', `${got.size}/${LP.ACHIEVEMENTS.length}`)),
          h('div.tiles.compact', LP.ACHIEVEMENTS.map((a) => h(`div.tile${got.has(a.id) ? '' : '.locked'}`, { title: t().trophyHow[a.id] },
            h('span.em', a.emoji), h('span.name', L.achievements[a.id]), h('span.hint', got.has(a.id) ? got.get(a.id).unlockedAt : t().trophyHow[a.id]))))));
    }

    // Customizing writes to the app's settings for this repo; adopted pets can push it to GitHub.
    // The preview changes at once; saving and the fresh look at the repo catch up behind it.
    let refreshLook = null;
    function customizeTab(p) {
      const L = tr();
      const K = T.look;
      const o = { ...p.options };
      const status = h('span.small.muted', { role: 'status' });
      const preview = h('img.card-img', { alt: '' });
      const swatches = h('div.swatches', { role: 'group', 'aria-label': K.coat });
      const wardrobe = h('div.stack');
      const count = h('span.small.muted');
      let saving = Promise.resolve();

      function set(patch) {
        const cur = project();
        if (!cur) return;
        const mine = { ...(state.config.options?.[id] ?? {}), ...patch };
        cur.options = { ...cur.options, ...patch };
        state.config.options = { ...state.config.options, [id]: mine };
        status.textContent = '';
        drawLook();
        saving = saving.then(async () => {
          try {
            await api('config', { options: { [id]: mine } });
            use(await api('refresh', { ids: [id] }));
            status.textContent = `✓ ${K.saved}`;
          } catch (err) { toast(err.message, 'bad'); }
        });
      }

      const name = h('input', { type: 'text', value: o.name ?? '', placeholder: C.namePlaceholder, maxlength: 40 });
      name.onchange = () => set({ name: name.value.trim() });
      const dice = btn('', { icon: 'dices', title: C.randomName, onclick: () => { name.value = LP.randomName(); set({ name: name.value }); } });
      const motto = h('input', { type: 'text', value: o.motto ?? '', placeholder: C.mottoPlaceholder, maxlength: LP.MOTTO_MAX });
      motto.onchange = () => set({ motto: motto.value.trim() });
      const picker = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(o.color ?? '') ? o.color : '#ff8800', 'aria-label': C.colors.custom });
      picker.onchange = () => set({ color: picker.value });

      function drawLook() {
        const cur = project();
        if (!cur?.summary) return;
        const pet = petOf(cur, { lang: lang() });
        const theme = ['light', 'dark'].includes(cur.options?.theme) ? cur.options.theme : cardTheme();
        preview.src = svgSrc(LP.renderCard(pet, { theme }));
        preview.alt = `${pet.displayName}: ${pet.speech}`;

        // A swatch per color, in the shade it takes; "its own" shows the species' body color.
        const color = String(cur.options?.color || 'auto').toLowerCase();
        const custom = color.startsWith('#');
        const shade = (c) => (c === 'auto' ? pet.species.palette.b : c === 'mono' ? '#a3a8b1' : `hsl(${LP.PET_COLORS[c]} 72% 56%)`);
        fill(swatches,
          ['auto', ...LP.COLOR_IDS].map((c) => h(`button.swatch${c === 'auto' ? '.own' : ''}`, {
            type: 'button', title: C.colors[c], 'aria-label': C.colors[c], 'aria-pressed': String(color === c),
            style: `--sw:${shade(c)}`, onclick: () => set({ color: c }),
          })),
          h(`label.swatch.custom${custom ? '.on' : ''}`, { title: C.colors.custom, style: custom ? `--sw:${color}` : null }, icon('palette', { size: 14 }), picker));

        // The wardrobe: one item per slot, only what this pet has unlocked.
        const worn = new Set(pet.wardrobe.worn);
        const unlocked = new Set(pet.wardrobe.unlocked);
        count.textContent = K.unlocked(unlocked.size, LP.ITEMS.length);
        const wear = (slot, item) => {
          const next = LP.ITEMS.filter((i) => worn.has(i.id) && i.slot !== slot).map((i) => i.id);
          if (item) next.push(item);
          set({ wear: next.length ? next.join(', ') : 'none' });
        };
        fill(wardrobe, LP.SLOTS.map((slot) => {
          const items = LP.ITEMS.filter((i) => i.slot === slot);
          const bare = !items.some((i) => worn.has(i.id));
          return h('div.slot',
            h('div.slot-head', L.slots[slot]),
            h('div.tiles.compact',
              h(`button.tile${bare ? '.on' : ''}`, { type: 'button', 'aria-pressed': String(bare), onclick: () => wear(slot, null) }, h('span.em', '∅'), h('span.name', K.none)),
              items.map((item) => {
                const open = unlocked.has(item.id);
                return h(`button.tile${worn.has(item.id) ? '.on' : ''}${open ? '' : '.locked'}`, {
                  type: 'button', disabled: !open, title: LP.unlockHint(L, item), 'aria-pressed': String(worn.has(item.id)),
                  onclick: () => wear(slot, worn.has(item.id) ? null : item.id),
                }, h('span.em', item.emoji), h('span.name', L.items[item.id]), open ? null : h('span.hint', `🔒 ${LP.unlockHint(L, item)}`));
              })));
        }));
      }

      const reset = btn(K.reset, {
        icon: 'rotate-ccw', kind: 'ghost',
        onclick: async () => {
          try {
            await api('config', { options: { [id]: {} } });
            use(await api('refresh', { ids: [id] }));
            panel.dataset.tab = ''; // rebuild the fields with the defaults
            draw();
            toast(K.resetDone, 'good');
          } catch (err) { toast(err.message, 'bad'); }
        },
      });

      refreshLook = drawLook;
      drawLook();
      return h('div.grid2.customize',
        h('div.stack',
          h('section.panel.stack.tight',
            h('h3', icon('user', { size: 16 }), K.identity),
            h('div.fields',
              h('label.field', C.name, h('div.input-row', name, dice)),
              h('label.field', C.species, select([['auto', `${C.auto} 🎲`], ...LP.SPECIES_IDS.map((s) => [s, L.species[s]])], o.species || 'auto', (v) => set({ species: v }))),
              h('label.field', C.petLang, select([['', C.auto], ...Object.entries(LP.LANG_NAMES)], o.lang || '', (v) => set({ lang: v })))),
            h('label.field', C.motto, motto),
            h('p.small.muted', { style: { margin: 0 } }, K.mottoNote)),
          h('section.panel.stack.tight',
            h('h3', icon('palette', { size: 16 }), K.coat),
            swatches,
            h('p.small.muted', { style: { margin: 0 } }, K.coatNote)),
          h('section.panel.stack.tight',
            h('h3', icon('house', { size: 16 }), K.place),
            h('div.fields',
              h('label.field', C.scenery, select([['auto', C.auto], ...LP.HOMES.map((x) => [x, t().homes[x]])], o.scenery || 'auto', (v) => set({ scenery: v }))),
              h('label.field', K.cardTheme, seg(Object.entries(C.themes), o.theme || 'auto', (v) => set({ theme: v }), K.cardTheme)))),
          h('section.panel.stack.tight',
            h('div.panel-head', h('h3', icon('shirt', { size: 16 }), K.wardrobe), count),
            h('p.small.muted', { style: { margin: 0 } }, K.wardrobeNote),
            wardrobe)),
        h('div.stack.sticky-col',
          h('section.panel.stack.tight',
            h('div.panel-head', h('h3', K.preview), status),
            preview,
            h('p.small.muted', { style: { margin: 0 } }, T.customizeNote),
            h('div.row',
              ['live', 'waiting'].includes(p.status) ? btn(T.updateGithub, { icon: 'cloud-upload', kind: 'primary', onclick: () => adoptDialog(p, { update: true }) }) : null,
              reset))));
    }

    // Someone is typing (notes, a name): leave the page as it is and catch up once they're done.
    let stale = false;
    const typing = () => panel.contains(document.activeElement) && document.activeElement.matches('input[type=text], textarea');
    panel.addEventListener('focusout', () => {
      // Late enough that a click on a button next to the box still lands on that button.
      if (stale) setTimeout(() => { if (stale && !typing()) { stale = false; draw(); } }, 300);
    });

    function draw() {
      const p = project();
      if (!p?.summary) {
        fill(root, h('a.back', { href: '#/home' }, icon('chevron-left', { size: 16 }), T.back), h('div.empty', T.notFound));
        return;
      }
      const pet = petOf(p, { lang: lang() });
      drawHead(p, pet);
      if (typing()) { stale = true; return; }
      const make = { overview: overviewTab, activity: activityTab, progress: progressTab, customize: customizeTab }[tab];
      // The customize tab keeps its fields while the pet refreshes around it.
      if (tab === 'customize' && panel.dataset.tab === 'customize' && panel.dataset.id === id) { refreshLook?.(); return; }
      panel.dataset.tab = tab;
      panel.dataset.id = id;
      fill(panel, make(p, pet));
    }

    root.append(head, tabsBar, panel);
    draw();
    return { redraw: draw };
  }

  // ----- Settings ----------------------------------------------------------------
  function settings(root) {
    // Opened (or reloaded) straight on this page: wait for the app's state first.
    if (!state) {
      root.append(h('div.scanning', icon('loader-circle', { size: 24, cls: 'spin' })));
      load().then(() => kit.render()).catch((err) => fill(root, h('div.empty', err.message)));
      return {};
    }
    const T = t().settings;
    const H = t().home;
    const body = h('div.settings');
    let resetArmed = false;

    function check(checked, label, onchange) {
      const box = h('input', { type: 'checkbox', checked });
      box.onchange = () => onchange(box.checked);
      return h('label.check', box, h('span', label));
    }
    function toggle(checked, label, onchange) {
      const box = h('input', { type: 'checkbox', role: 'switch', checked });
      box.onchange = () => onchange(box.checked);
      return h('label.switch', box, h('span.track', { 'aria-hidden': 'true' }), h('span', label));
    }
    const save = async (patch) => {
      try { use(await api('config', patch)); } catch (err) { toast(err.message, 'bad'); }
      draw();
    };
    const section = (iconName, title, ...kids) => h('section.panel.setting', h('h3', icon(iconName, { size: 17 }), title), h('div.stack', ...kids));

    function draw() {
      const cfg = state.config;
      const token = h('input', { type: 'password', placeholder: T.tokenPlaceholder, autocomplete: 'off' });
      const hidden = state.hiddenProjects ?? [];
      const tools = state.tools ?? { editors: [], terminals: [] };
      const resetBtn = btn(T.reset, { icon: 'trash-2', kind: 'danger' });
      resetBtn.onclick = async () => {
        if (!resetArmed) { resetArmed = true; resetBtn.querySelector('span').textContent = T.resetConfirm; setTimeout(() => { resetArmed = false; resetBtn.querySelector('span').textContent = T.reset; }, 3500); return; }
        use(await api('reset', {}));
        go_('home');
      };
      const notifyNote = h('p.small.muted', { style: { margin: 0 } });
      if (MODE !== 'desktop' && typeof Notification !== 'undefined' && Notification.permission === 'denied') notifyNote.textContent = T.notifyBlocked;
      const mute = cfg.mute ?? [];
      // The usual evening hours, plus whatever was picked before (a backup from elsewhere, say).
      const hours = [...new Set([16, 17, 18, 19, 20, 21, 22, ...(cfg.reminderHour == null ? [] : [cfg.reminderHour])])].sort((a, b) => a - b);
      const quiet = [[21, 7], [22, 8], [23, 7], [0, 8]];
      if (cfg.quietHours && !quiet.some(([a, b]) => a === cfg.quietHours.from && b === cfg.quietHours.to)) quiet.push([cfg.quietHours.from, cfg.quietHours.to]);
      const toolSelect = (list, key) => select([['', T.firstFound(list[0]?.name ?? '–')], ...list.map((x) => [x.id, x.name])], cfg[key] ?? '', (v) => save({ [key]: v || null }), T[key]);

      fill(body,
        section('folder-open', T.folders,
          h('p.small.muted', { style: { margin: 0 } }, T.foldersNote),
          h('ul.folder-list', cfg.roots.map((r) => h('li.row.folder-row',
            icon('folder-git-2', { size: 16 }), h('span.mono', r),
            btn('', { icon: 'x', kind: 'ghost', title: T.remove, onclick: () => save({ roots: cfg.roots.filter((x) => x !== r) }) })))),
          h('div.row', btn(H.addFolder, { icon: 'folder-plus', onclick: addFolder }), btn(T.rescan, { icon: 'search', onclick: async () => { await rescan(); draw(); } }))),
        section('code-xml', T.tools,
          tools.editors.length
            ? h('div.fields', h('label.field', T.editor, toolSelect(tools.editors, 'editor')), tools.terminals.length ? h('label.field', T.terminal, toolSelect(tools.terminals, 'terminal')) : null)
            : h('p.small.muted', { style: { margin: 0 } }, T.noTools)),
        section('globe', T.online,
          toggle(cfg.online, T.onlineToggle, (v) => save({ online: v })),
          h('p.small.muted', { style: { margin: 0 } }, T.onlineNote),
          cfg.online ? h('p.small', { style: { margin: 0 } }, state.tokenSource ? T.tokenFrom[state.tokenSource] : T.noToken) : null,
          cfg.online ? h('form.row', { onsubmit: (e) => { e.preventDefault(); if (token.value.trim()) save({ token: token.value.trim() }); } },
            h('div', { style: { flex: '1 1 220px' } }, token), btn(T.saveToken, { type: 'submit' }),
            cfg.hasToken ? btn(T.clearToken, { kind: 'ghost', onclick: () => save({ token: '' }) }) : null) : null),
        section('bell', T.notify,
          toggle(cfg.notify, T.notifyToggle, async (v) => {
            if (v && MODE !== 'desktop' && typeof Notification !== 'undefined' && Notification.permission === 'default') await Notification.requestPermission();
            save({ notify: v });
          }),
          notifyNote,
          cfg.notify ? h('div.stack.sub-settings',
            h('div.small.muted', T.notifyKinds),
            h('div.checks', Object.entries(T.groups).map(([group, label]) => check(!mute.includes(group), label,
              (on) => save({ mute: on ? mute.filter((g) => g !== group) : [...mute, group] })))),
            h('div.fields',
              h('label.field', T.reminder, select([['', T.reminderOff], ...hours.map((n) => [String(n), T.at(n)])], cfg.reminderHour == null ? '' : String(cfg.reminderHour),
                (v) => save({ reminderHour: v === '' ? null : Number(v) }), T.reminder)),
              h('label.field', T.quiet, select([['', T.quietOff], ...quiet.map(([a, b]) => [`${a}-${b}`, T.quietRange(a, b)])], cfg.quietHours ? `${cfg.quietHours.from}-${cfg.quietHours.to}` : '',
                (v) => save({ quietHours: v ? { from: Number(v.split('-')[0]), to: Number(v.split('-')[1]) } : null }), T.quiet))),
            h('p.small.muted', { style: { margin: 0 } }, T.quietNote)) : null,
          h('label.field', T.refresh, select([5, 15, 30, 60].map((n) => [String(n), T.every(n)]), String(cfg.refreshMinutes), (v) => save({ refreshMinutes: Number(v) })))),
        MODE === 'desktop' ? section('monitor', T.desktop,
          toggle(cfg.float, T.floatToggle, (v) => save({ float: v })),
          h('div.fields',
            h('label.field', T.floatWho, select([['', T.neediest], ...state.projects.filter((p) => p.summary).map((p) => [p.id, `${p.summary.emoji} ${p.summary.name} · ${p.folder}`])], cfg.favorite ?? '', (v) => save({ favorite: v || null }))),
            h('label.field', T.floatSize, seg(Object.entries(T.sizes), cfg.floatSize ?? 'medium', (v) => save({ floatSize: v }), T.floatSize))),
          toggle(cfg.floatBubbles !== false, T.floatBubbles, (v) => save({ floatBubbles: v })),
          state.desktop?.loginItem != null ? toggle(state.desktop.loginItem, T.login, async (v) => { use(await api('login-item', { on: v })); draw(); }) : null) : null,
        section('archive', T.backup,
          h('p.small.muted', { style: { margin: 0 } }, T.backupNote),
          h('div.row', btn(T.exportBackup, { icon: 'download', onclick: exportBackup }), btn(T.importBackup, { icon: 'upload', onclick: importBackup }))),
        hidden.length ? section('eye-off', T.hiddenTitle,
          h('ul.folder-list', hidden.map((x) => h('li.row.folder-row',
            h('span.mono', x.name),
            btn(T.unhide, { icon: 'eye', kind: 'ghost', onclick: () => save({ hidden: cfg.hidden.filter((id) => id !== x.id) }) }))))) : null,
        section('shield-check', T.privacy,
          h('ul.privacy.compact', T.privacyItems.map((x) => h('li', icon('check', { size: 15 }), h('span', x)))),
          h('div.small.muted', T.dataDir, ' ', h('code', state.dataDir ?? '~/.legacypet')),
          h('div.row', resetBtn)),
        h('p.small.muted.version', T.version(state.version, state.mode)));
    }

    root.append(h('header.page-head', h('div', h('h1', T.title), h('p.page-sub', T.lead))), body);
    draw();
    return { redraw: draw };
  }

  // ----- The desktop app's download page (on GitHub Pages) -----------------------
  const RELEASES = 'https://github.com/Tanx-1811/legacypet/releases';
  const asset = (name) => `${RELEASES}/latest/download/${name}`;
  function guessOs() {
    const p = `${navigator.userAgentData?.platform ?? ''} ${navigator.platform ?? ''} ${navigator.userAgent}`.toLowerCase();
    if (p.includes('mac')) return 'mac';
    if (p.includes('win')) return 'win';
    if (p.includes('linux') || p.includes('x11')) return 'linux';
    return null;
  }
  function getApp(root) {
    const T = t().get;
    const os = guessOs();
    const builds = {
      mac: [[T.macArm, asset('LegacyPet-mac-arm64.dmg')], [T.macIntel, asset('LegacyPet-mac-x64.dmg')]],
      win: [[T.winNote, asset('LegacyPet-win-x64.exe')]],
      linux: [[T.appImage, asset('LegacyPet-linux-x86_64.AppImage')], [T.deb, asset('LegacyPet-linux-amd64.deb')]],
    };
    const names = { mac: T.mac, win: T.win, linux: T.linux };
    const block = (id, primary) => h('div.dl', h('b', icon('monitor', { size: 16 }), names[id]),
      h('div.row', builds[id].map(([label, href], i) => btn(label, { icon: 'download', kind: primary && i === 0 ? 'primary' : '', href }))));
    const order = os ? [os, ...Object.keys(builds).filter((x) => x !== os)] : Object.keys(builds);
    root.append(
      h('section.get-hero',
        h('div.onboard-pets', ['happy', 'party', 'sleepy'].map((mood, i) => h('img.mini-img', { src: svgSrc(LP.renderMini(kit.demoPet({ mood, species: ['cat', 'duck', 'octopus'][i], fullName: `you/${['api', 'app', 'blog'][i]}` }), { theme: cardTheme() })), alt: '' }))),
        h('h1', T.title),
        h('p.lead', T.lead)),
      h('div.grid2',
        h('section.panel.stack',
          h('h3', icon('download', { size: 17 }), T.download),
          os ? h('p.small.muted', { style: { margin: 0 } }, T.forYou) : null,
          ...order.map((id, i) => block(id, i === 0 && Boolean(os))),
          h('p.small.muted', { style: { margin: 0 } }, T.macWarn),
          h('p.small.muted', { style: { margin: 0 } }, T.winWarn),
          h('a.small', { href: RELEASES }, T.allReleases)),
        h('div.stack',
          h('section.panel.points', T.points.map(([name, title, text]) => h('div.point', h('span.point-icon', icon(name, { size: 18 })), h('div', h('b', title), h('p.small.muted', { style: { margin: 0 } }, text))))),
          h('section.panel.stack', h('h3', icon('square-terminal', { size: 17 }), T.node), codeBlock('npx github:Tanx-1811/legacypet app'), h('p.small.muted', { style: { margin: 0 } }, T.nodeNote)))));
    return {};
  }

  function home(root, arg) {
    if (!state) {
      root.append(h('div.scanning', icon('loader-circle', { size: 24, cls: 'spin' })));
      load().then(() => kit.render()).catch((err) => fill(root, h('div.empty', err.message)));
      return {};
    }
    if (!state.config.consented) return onboarding(root);
    if (state.scanning && !state.projects.length) {
      root.append(scanningScreen());
      return { redraw: () => { if (!state.scanning) kit.render(); } };
    }
    if (arg) return detail(root, arg);
    return dashboard(root);
  }

  return {
    LOCAL,
    MODE,
    load,
    get state() { return state; },
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    careCount,
    views: { home, settings, get: getApp },
    actions: {
      refresh: () => refreshAll(),
      rescan,
      addFolder,
      adoptAll: () => adoptAll(),
      careAll,
      exportBackup,
      toggleFloat: async () => { try { use(await api('config', { float: !state.config.float })); } catch (err) { toast(err.message, 'bad'); } },
    },
  };
}
