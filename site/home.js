// "My pets", Settings and the download page. Home and Settings only exist when the
// playground runs as the LegacyPet app on someone's computer (see local.js).
import { api, byNeed, desktop, LOCAL, MODE, petOf } from './local.js';

export function homeViews(kit) {
  const { h, img, svgSrc, toast, t, tr, store, cardTheme, checkupList, questList, codeBlock, seg, select, go_, LP } = kit;

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

  function vitalBars(vitals) {
    const L = tr();
    return h('div.bars', ['fullness', 'health', 'joy', 'energy'].map((k) => {
      const v = vitals?.[k] ?? 0;
      return h('div.bar', { title: `${L.stats[k]} ${v}` },
        h('span', { 'aria-hidden': 'true' }, { fullness: '🍖', health: '❤️', joy: '😊', energy: '⚡' }[k]),
        h(`div.meter.${v < 35 ? 'low' : v < 60 ? 'mid' : 'ok'}`, h('i', { style: { width: `${v}%` } })));
    }));
  }

  // ----- Onboarding: ask before looking anywhere --------------------------------
  function onboarding(root) {
    const T = t().home;
    const chosen = new Map(state.suggestions.map((s) => [s.path, s]));
    const list = h('ul.folder-list');
    const status = h('p.status', { role: 'status' });
    const allowBtn = h('button.primary.big', { type: 'button' }, T.allow);
    const pathInput = h('input', { type: 'text', placeholder: T.typePath, class: 'mono', spellcheck: 'false', autocomplete: 'off' });

    function drawList() {
      list.replaceChildren(...[...chosen.values()].map((s) => {
        const box = h('input', { type: 'checkbox', checked: s.checked });
        box.onchange = () => { s.checked = box.checked; };
        const tag = s.label === '~' ? T.wholeHome : s.exists === null ? T.maybe : s.current ? T.current : T.found;
        return h('li', h('label.check', box, h('span.mono', s.label), h('span.pick-tag', tag)));
      }));
    }
    const addPath = (path) => {
      if (!path) return;
      chosen.set(path, { path, label: path, exists: true, checked: true });
      drawList();
    };
    pathInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addPath(pathInput.value.trim()); pathInput.value = ''; } };
    const pickBtn = h('button', {
      type: 'button',
      onclick: async () => {
        try {
          const { path } = desktop?.pickFolder ? { path: await desktop.pickFolder() } : await api('pick-folder', {});
          addPath(path);
        } catch { pathInput.focus(); }
      },
    }, T.addFolder);

    allowBtn.onclick = async () => {
      const roots = [...chosen.values()].filter((s) => s.checked).map((s) => s.path);
      if (!roots.length) { status.textContent = T.pickOne; status.className = 'status bad'; return; }
      allowBtn.disabled = true;
      root.replaceChildren(scanningScreen());
      try {
        use(await api('allow', { roots }));
        kit.render();
      } catch (err) {
        toast(err.message);
        kit.render();
      }
    };

    const eggs = ['egg', 'happy', 'party'].map((mood, i) => h('img.mini-img', {
      src: svgSrc(LP.renderMini(kit.demoPet({ mood, species: ['bunny', 'duck', 'cat'][i] }), { theme: cardTheme() })), alt: '',
    }));
    drawList();
    root.append(h('section.onboard',
      h('div.onboard-pets', eggs),
      h('h2', T.welcome),
      h('p.lead', T.welcomeLead),
      h('ul.privacy', T.privacy.map((line) => h('li', line))),
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
      h('img.mini-img.wobble', { src: svgSrc(LP.renderMini(kit.demoPet({ mood: 'egg', species: 'duck' }), { theme: cardTheme() })), alt: '' }),
      h('p', T.scanning));
  }

  // ----- Dashboard: every pet at a glance ---------------------------------------
  function dashboard(root) {
    const T = t().home;
    const filterKey = 'homeFilter';
    let filter = store[filterKey] ?? 'all';
    const search = h('input', { type: 'search', placeholder: T.search, 'aria-label': T.search, autocomplete: 'off', spellcheck: 'false' });
    const grid = h('div.pet-grid');
    const summary = h('p.lead', { style: { margin: '2px 0 0' } });
    const updated = h('span.small.muted');
    const filters = h('div.seg.filters', { role: 'group' });
    const banner = h('div');
    const feed = h('div');
    const refreshBtn = h('button', { type: 'button' }, T.refresh);
    refreshBtn.onclick = async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = T.refreshing;
      try { use(await api('refresh', {})); } catch (err) { toast(err.message); }
      refreshBtn.disabled = false;
      refreshBtn.textContent = T.refresh;
    };
    search.oninput = () => draw();

    function tile(p) {
      const L = tr();
      const s = p.summary;
      if (!s) {
        return h('div.pet-tile.broken', h('div.pet-info', h('b', p.folder), h('span.small.muted', p.error ?? '?')));
      }
      const chips = [
        h(`span.pill.${p.status}`, T.status[p.status]),
        p.dirty ? h('span.pill', T.dirty(p.dirty)) : null,
        p.ahead ? h('span.pill.warn', T.ahead(p.ahead)) : null,
      ];
      const last = p.snapshot?.commits?.lastDate;
      return h(`a.pet-tile.${s.attention}`, { href: `#/home/${p.id}`, title: s.speech },
        h('div.pet-stage', h('img', { src: pic(p, 'mini'), alt: s.displayName, loading: 'lazy', width: 120, height: 144 })),
        h('div.pet-info',
          h('div.pet-name', h('b', s.name), h('span.lv', `Lv.${s.level}`)),
          h('div.pet-repo.mono', p.github ? p.fullName : p.folder),
          h('div.pet-mood', `${s.emoji} ${L.moods[s.mood]}`, h('span.muted', ` · ${last ? T.lastCommit(ago(last)) : T.noCommits}`)),
          vitalBars(s.vitals),
          h('div.pills', chips)));
    }

    function draw() {
      if (!state) return;
      const all = state.projects.slice().sort(byNeed);
      const c = counts(all);
      summary.textContent = T.summary(c.all, c.care, c.live);
      updated.textContent = state.scanning ? T.refreshing : state.projects[0]?.now ? T.updated(ago(state.projects.map((p) => p.now).sort().pop())) : '';
      filters.replaceChildren(...Object.entries(T.filters).map(([id, label]) => h('button', {
        type: 'button', 'aria-pressed': String(filter === id),
        onclick: () => { filter = id; store[filterKey] = id; kit.save(); draw(); },
      }, `${label} `, h('span.count', c[id]))));
      const q = search.value.trim().toLowerCase();
      const shown = all.filter((p) => (filter === 'all' || (filter === 'care' ? p.summary?.attention !== 'good' : p.status === filter))
        && (!q || `${p.folder} ${p.fullName} ${p.summary?.name ?? ''}`.toLowerCase().includes(q)));
      if (!all.length) grid.replaceChildren(emptyState());
      else if (!shown.length) grid.replaceChildren(h('div.empty', T.noMatch));
      else grid.replaceChildren(...shown.map(tile));

      const adoptable = all.filter((p) => p.status === 'none' && p.github && !p.empty);
      banner.replaceChildren(...(adoptable.length && filter !== 'live'
        ? [h('div.banner',
          h('span', `🥚 ${T.filters.none}: ${adoptable.length}`),
          h('button.primary', { type: 'button', onclick: () => adoptAll(adoptable) }, T.adoptAll(adoptable.length)))]
        : []));
      const recent = (state.events ?? []).filter((e) => Date.now() - Date.parse(e.at) < 3 * 86_400_000).slice(0, 4);
      feed.replaceChildren(...(recent.length
        ? [h('div.feed', h('b.small', T.events), ...recent.map((e) => h('a.feed-item', { href: `#/home/${e.projectId}` }, e.text, h('span.muted.small', ` · ${ago(e.at)}`))))]
        : []));
    }

    function emptyState() {
      const box = h('div.empty.stack');
      box.append(h('p', { style: { margin: 0 } }, T.empty), h('p.small', { style: { margin: 0 } }, T.emptyHint),
        h('div.row', { style: { justifyContent: 'center' } }, h('button.primary', { type: 'button', onclick: addFolder }, T.addFolder)));
      return box;
    }

    root.append(
      h('div.page-head',
        h('div', h('h2', T.title), summary),
        h('div.row', updated, refreshBtn)),
      feed,
      h('div.home-tools', h('div.search-box', search), filters),
      banner,
      grid);
    draw();
    return { redraw: draw };
  }

  async function addFolder() {
    try {
      const path = desktop?.pickFolder ? await desktop.pickFolder() : (await api('pick-folder', {})).path;
      if (!path) return;
      use(await api('config', { roots: [...new Set([...state.config.roots, path])] }));
      toast('🔍');
    } catch (err) {
      toast(err.message);
    }
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

  function publishResult(box, result, project) {
    const T = t().home;
    if (!result) return;
    if (result.pushed) box.append(h('p.ok', T.pushed));
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
      h('li', h('code', '.github/workflows/legacypet.yml'), ' ', h('span.muted', T.fileWorkflow), project.hasWorkflow ? null : h('span.pill.live', T.fileNew)),
      project.readmeHasPet ? null : h('li', h('code', 'README'), ' ', h('span.muted', T.fileReadme)));
    const out = h('div.stack');
    const pushBtn = h('button.primary', { type: 'button' }, T.adoptPush);
    const onlyBtn = h('button', { type: 'button' }, T.adoptOnly);
    const branch = project.branch && project.branch !== 'HEAD' ? project.branch : project.defaultBranch;
    async function go(publish) {
      pushBtn.disabled = true;
      onlyBtn.disabled = true;
      out.replaceChildren(h('p.muted', T.working));
      try {
        const res = await api(`projects/${project.id}/adopt`, { style, publish, force: update, readme: !update });
        await load();
        out.replaceChildren(h('p.ok', publish ? (res.publish?.pushed ? T.adopted : '') : T.written));
        publishResult(out, res.publish, project);
        if (res.publish?.pushed || !publish) toast(publish ? T.adopted : T.written, 'good');
      } catch (err) {
        out.replaceChildren(h('div.callout.bad', err.message));
      } finally {
        pushBtn.disabled = false;
        onlyBtn.disabled = false;
      }
    }
    pushBtn.onclick = () => go(true);
    onlyBtn.onclick = () => go(false);
    const el = dialog(
      h('form', { method: 'dialog' }, h('button.ghost.close', { 'aria-label': t().common.close }, '✕')),
      h('h2', update ? T.updateGithub : T.adoptTitle),
      h('p.muted', T.adoptFiles), files,
      update ? null : h('label.field', T.style, seg(Object.entries(t().adopt.styles).filter(([k]) => k !== 'park'), style, (v) => { style = v; }, T.style)),
      h('p.small.muted', T.pushNote(branch)),
      branch !== project.defaultBranch ? h('p.small.warn-text', T.notDefault(branch, project.defaultBranch)) : null,
      h('div.row', pushBtn, onlyBtn),
      out);
    return el;
  }

  function adoptAll(projects) {
    const T = t().home;
    const boxes = projects.map((p) => [p, h('input', { type: 'checkbox', checked: true })]);
    const out = h('div.stack');
    const go = h('button.primary', { type: 'button' }, T.adoptAllGo(projects.length));
    const count = () => boxes.filter(([, b]) => b.checked).length;
    for (const [, b] of boxes) b.onchange = () => { go.textContent = T.adoptAllGo(count()); go.disabled = !count(); };
    go.onclick = async () => {
      go.disabled = true;
      const picked = boxes.filter(([, b]) => b.checked).map(([p]) => p);
      let ok = 0;
      out.replaceChildren();
      for (const p of picked) {
        const line = h('div.small', `⏳ ${p.fullName}`);
        out.append(line);
        try {
          const res = await api(`projects/${p.id}/adopt`, { style: 'card', publish: true, options: {} });
          if (res.publish?.pushed) { ok += 1; line.textContent = `✔ ${p.fullName}`; } else {
            line.textContent = `✖ ${p.fullName}: ${res.publish?.hint ? T.hints[res.publish.hint] : res.publish?.error ?? '?'}`;
          }
        } catch (err) {
          line.textContent = `✖ ${p.fullName}: ${err.message}`;
        }
      }
      out.append(h('p.ok', T.adoptAllDone(ok, picked.length)));
      await load();
    };
    dialog(
      h('form', { method: 'dialog' }, h('button.ghost.close', { 'aria-label': t().common.close }, '✕')),
      h('h2', T.adoptAllTitle), h('p.muted', T.adoptAllLead),
      h('ul.files.scroll', boxes.map(([p, b]) => h('li', h('label.check', b, h('span.mono', p.fullName))))),
      h('div.row', go), out);
  }

  // ----- One pet up close ---------------------------------------------------------
  function detail(root, id) {
    const T = t().home;
    const C = t().common;
    const box = { card: h('div.card-wrap'), vitals: h('div.vitals'), github: h('div.stack'), todo: h('div'), quests: h('div'), look: h('div'), chart: h('div'), title: h('div'), actions: h('div.row.actions-row') };

    async function care(name) {
      try {
        const { project } = await api(`projects/${id}/care`, { name });
        const i = state.projects.findIndex((p) => p.id === id);
        if (i !== -1) state.projects[i] = project;
        publish();
        const L = tr();
        const pet = petOf(project, { lang: lang() });
        const outcome = project.summary.careOutcome;
        const msg = outcome === 'again' ? L.command.again[name]
          : outcome === 'cant' ? (L.command.cant[pet.mood] ?? L.command.cant.egg)
            : LP.commandReply(pet, project.snapshot, { command: name, user: project.user }).split('\n').find((l) => l.startsWith('> '))?.slice(2);
        if (msg) toast(msg, outcome === 'ok' ? 'good' : '');
      } catch (err) {
        toast(err.message);
      }
    }

    const careRow = h('div.big-actions',
      h('button', { type: 'button', onclick: () => care('feed') }, t().sim.feed),
      h('button', { type: 'button', onclick: () => care('play') }, t().sim.play),
      h('button', { type: 'button', onclick: () => care('pat') }, t().sim.pat));

    function popOut() {
      const url = `float.html?id=${id}`;
      if ('documentPictureInPicture' in window) {
        window.documentPictureInPicture.requestWindow({ width: 230, height: 280 }).then((pip) => {
          pip.document.body.style.margin = '0';
          pip.document.body.append(h('iframe', { src: url, style: { border: '0', width: '100%', height: '100vh' }, title: 'LegacyPet' }));
        }).catch(() => window.open(url, 'legacypet-float', 'width=230,height=280'));
      } else window.open(url, 'legacypet-float', 'width=230,height=280');
    }

    function draw() {
      const p = state.projects.find((x) => x.id === id);
      if (!p) {
        root.replaceChildren(h('a.back', { href: '#/home' }, T.back), h('div.empty', T.notFound));
        return;
      }
      const L = tr();
      const pet = petOf(p, { lang: lang() });
      const s = p.summary;
      box.title.replaceChildren(
        h('h2', `${s.emoji} ${pet.displayName}`),
        h('p.lead', { style: { margin: '2px 0 0' } }, h('span.mono', p.github ? p.fullName : p.folder), ` · ${L.moods[s.mood]} · ${pet.rank.emoji} ${L.level(pet.level)}`));
      box.card.replaceChildren(h('img.card-img', { src: pic(p, 'card'), alt: `${pet.displayName}: ${pet.speech}` }));
      box.vitals.replaceChildren(...['fullness', 'health', 'joy', 'energy'].map((k) => h('div.vital', L.stats[k], h('b', pet.vitals[k]))));

      // GitHub: where the pet lives, and the one button that moves it there.
      const gh = [h('h3', `${T.status[p.status]}`)];
      if (p.status === 'local') gh.push(h('p.muted', T.localNote));
      else if (p.status === 'live') {
        gh.push(h('p.muted', T.liveNote), h('div.row',
          h('a.button', { href: `https://github.com/${p.fullName}`, target: '_blank', rel: 'noopener' }, T.openGithub),
          h('a.button', { href: `https://github.com/${p.fullName}/blob/legacypet/DIARY.md`, target: '_blank', rel: 'noopener' }, T.openDiary)));
      } else if (p.status === 'waiting') {
        const out = h('div.stack');
        const btn = h('button.primary', {
          type: 'button',
          onclick: async () => {
            btn.disabled = true;
            out.replaceChildren(h('p.muted', T.working));
            try {
              const res = await api(`projects/${p.id}/publish`, {});
              out.replaceChildren();
              publishResult(out, res.publish, p);
              await load();
            } catch (err) { out.replaceChildren(h('div.callout.bad', err.message)); }
            btn.disabled = false;
          },
        }, T.pushNow);
        gh.push(h('p.muted', T.waitingNote), p.ahead ? h('p.small', T.ahead(p.ahead)) : null, h('div.row', btn), out);
      } else {
        gh.push(h('p.muted', T.noneNote), h('div.row', h('button.primary.big', { type: 'button', onclick: () => adoptDialog(p) }, T.adopt)));
      }
      box.github.replaceChildren(...gh.filter(Boolean));

      // To do: what only a local copy knows, then the regular checkup.
      const local = [
        p.dirty ? { level: 'tip', text: T.dirty(p.dirty) } : null,
        p.ahead ? { level: 'warn', text: T.ahead(p.ahead) } : null,
        p.behind ? { level: 'tip', text: T.behind(p.behind) } : null,
      ].filter(Boolean);
      box.todo.replaceChildren(
        local.length ? h('ul.checkup', { style: { marginBottom: '10px' } }, local.map((x) => h(`li.${x.level}`, h('span.dot'), h('span', x.text)))) : null,
        checkupList(pet, p.snapshot),
        h('p.small.muted', { style: { margin: '10px 0 0' } }, p.snapshot.source === 'github' ? T.sourceGithub : T.sourceLocal));
      box.quests.replaceChildren(questList(pet, L));
      const history = p.prev?.history ?? [];
      box.chart.replaceChildren(history.length >= 2
        ? h('img.card-img', { src: svgSrc(LP.renderStats(pet, [{ date: pet.date, mood: pet.mood, vitals: ['fullness', 'health', 'joy', 'energy'].map((k) => pet.vitals[k]) }, ...history.filter((x) => x.date !== pet.date)], { theme: cardTheme() })), alt: 'stats' })
        : h('p.muted', T.noStats));

      const isFloat = state.config.float && state.config.favorite === p.id;
      box.actions.replaceChildren(
        h('button', { type: 'button', onclick: () => api(`projects/${p.id}/reveal`, {}).catch((e) => toast(e.message)) }, T.openFolder),
        p.github && p.status !== 'live' ? h('a.button', { href: `https://github.com/${p.fullName}`, target: '_blank', rel: 'noopener' }, T.openGithub) : null,
        h('button', {
          type: 'button',
          onclick: () => { kit.stopAuto(); store.world = kit.Sim.worldFromSnapshot(p.snapshot); kit.save(); go_('sim'); },
        }, T.raise),
        MODE === 'desktop'
          ? h('button', { type: 'button', 'aria-pressed': String(isFloat), onclick: async () => use(await api('config', { float: true, favorite: p.id })) }, isFloat ? T.floating : T.float)
          : h('button', { type: 'button', onclick: popOut }, T.popOut),
        h('button.ghost', {
          type: 'button',
          onclick: async () => { use(await api(`projects/${p.id}/hide`, {})); toast(T.hidden); go_('home'); },
        }, T.hide));
    }

    // Customizing writes to the app's settings for this repo; adopted pets can push it to GitHub.
    function drawLook() {
      const p = state.projects.find((x) => x.id === id);
      if (!p) return;
      const L = tr();
      const opts = { ...p.options };
      const set = (key) => async (v) => {
        opts[key] = v;
        const mine = { ...(state.config.options?.[id] ?? {}), [key]: v };
        try {
          await api('config', { options: { [id]: mine } });
          use(await api('refresh', { ids: [id] }));
        } catch (err) { toast(err.message); }
      };
      const name = h('input', { type: 'text', value: opts.name ?? '', placeholder: C.namePlaceholder, maxlength: 40 });
      name.onchange = () => set('name')(name.value.trim());
      box.look.replaceChildren(
        h('div.fields',
          h('label.field', C.species, select([['auto', `${C.auto} 🎲`], ...LP.SPECIES_IDS.map((s) => [s, L.species[s]])], opts.species || 'auto', set('species'))),
          h('label.field', C.scenery, select([['auto', C.auto], ...LP.HOMES.map((x) => [x, t().homes[x]])], opts.scenery || 'auto', set('scenery'))),
          h('label.field', C.petLang, select([['', `${C.auto}`], ...Object.entries(LP.LANG_NAMES)], opts.lang || '', set('lang'))),
          h('label.field', C.name, name)),
        h('p.small.muted', { style: { margin: '10px 0 0' } }, T.customizeNote),
        ['live', 'waiting'].includes(p.status) ? h('div.row', { style: { marginTop: '10px' } }, h('button', { type: 'button', onclick: () => adoptDialog(p, { update: true }) }, T.updateGithub)) : null);
    }

    root.append(
      h('a.back', { href: '#/home' }, T.back),
      box.title,
      h('div.grid2.detail',
        h('div.stack',
          h('section.panel.stage', box.card, box.vitals, careRow, h('p.small.muted', { style: { margin: 0 } }, T.careNote), box.actions),
          h('section.panel', h('h3', T.stats), box.chart)),
        h('div.stack',
          h('section.panel.github-panel', box.github),
          h('section.panel', h('h3', `🩺 ${T.todo}`), box.todo),
          h('section.panel', h('h3', `📜 ${t().hatch.quests}`), box.quests),
          h('section.panel', h('h3', `🎨 ${T.customize}`), box.look))));
    draw();
    drawLook();
    return { redraw: draw };
  }

  // ----- Settings ----------------------------------------------------------------
  function settings(root) {
    const T = t().settings;
    const H = t().home;
    const body = h('div.stack');
    let resetArmed = false;

    function toggle(checked, label, onchange) {
      const box = h('input', { type: 'checkbox', role: 'switch', checked });
      box.onchange = () => onchange(box.checked);
      return h('label.switch', box, h('span.track', { 'aria-hidden': 'true' }), h('span', label));
    }
    const save = async (patch) => {
      try { use(await api('config', patch)); } catch (err) { toast(err.message); }
      draw();
    };

    function draw() {
      const cfg = state.config;
      const token = h('input', { type: 'password', placeholder: T.tokenPlaceholder, autocomplete: 'off' });
      const hidden = state.hiddenProjects ?? [];
      const resetBtn = h('button.danger', { type: 'button' }, T.reset);
      resetBtn.onclick = async () => {
        if (!resetArmed) { resetArmed = true; resetBtn.textContent = T.resetConfirm; setTimeout(() => { resetArmed = false; resetBtn.textContent = T.reset; }, 3500); return; }
        use(await api('reset', {}));
        go_('home');
      };
      const notifyNote = h('p.small.muted', { style: { margin: 0 } });
      if (MODE !== 'desktop' && typeof Notification !== 'undefined' && Notification.permission === 'denied') notifyNote.textContent = T.notifyBlocked;

      body.replaceChildren(
        h('section.panel.stack',
          h('h3', T.folders),
          h('p.small.muted', { style: { margin: 0 } }, T.foldersNote),
          h('ul.folder-list', cfg.roots.map((r) => h('li.row', { style: { justifyContent: 'space-between' } },
            h('span.mono', r),
            h('button.ghost', { type: 'button', onclick: () => save({ roots: cfg.roots.filter((x) => x !== r) }) }, T.remove)))),
          h('div.row',
            h('button', { type: 'button', onclick: addFolder }, H.addFolder),
            h('button', { type: 'button', onclick: async () => { toast(H.refreshing); use(await api('scan', {})); draw(); } }, T.rescan))),
        h('section.panel.stack',
          h('h3', T.online),
          toggle(cfg.online, T.onlineToggle, (v) => save({ online: v })),
          h('p.small.muted', { style: { margin: 0 } }, T.onlineNote),
          cfg.online ? h('p.small', { style: { margin: 0 } }, state.tokenSource ? T.tokenFrom[state.tokenSource] : T.noToken) : null,
          cfg.online ? h('form.row', { onsubmit: (e) => { e.preventDefault(); if (token.value.trim()) save({ token: token.value.trim() }); } },
            h('div', { style: { flex: '1 1 220px' } }, token), h('button', { type: 'submit' }, T.saveToken),
            cfg.hasToken ? h('button.ghost', { type: 'button', onclick: () => save({ token: '' }) }, T.clearToken) : null) : null),
        h('section.panel.stack',
          h('h3', T.notify),
          toggle(cfg.notify, T.notifyToggle, async (v) => {
            if (v && MODE !== 'desktop' && typeof Notification !== 'undefined' && Notification.permission === 'default') await Notification.requestPermission();
            save({ notify: v });
          }),
          notifyNote,
          h('label.field', T.refresh, select([5, 15, 30, 60].map((n) => [String(n), T.every(n)]), String(cfg.refreshMinutes), (v) => save({ refreshMinutes: Number(v) })))),
        MODE === 'desktop' ? h('section.panel.stack',
          h('h3', T.desktop),
          toggle(cfg.float, T.floatToggle, (v) => save({ float: v })),
          h('label.field', T.floatWho, select([['', T.neediest], ...state.projects.filter((p) => p.summary).map((p) => [p.id, `${p.summary.emoji} ${p.summary.name} · ${p.folder}`])], cfg.favorite ?? '', (v) => save({ favorite: v || null }))),
          state.desktop?.loginItem != null ? toggle(state.desktop.loginItem, T.login, async (v) => { use(await api('login-item', { on: v })); draw(); }) : null) : null,
        hidden.length ? h('section.panel.stack',
          h('h3', T.hiddenTitle),
          h('ul.folder-list', hidden.map((x) => h('li.row', { style: { justifyContent: 'space-between' } },
            h('span.mono', x.name),
            h('button.ghost', { type: 'button', onclick: () => save({ hidden: cfg.hidden.filter((id) => id !== x.id) }) }, T.unhide))))) : null,
        h('section.panel.stack',
          h('h3', T.privacy),
          h('ul.privacy.compact', T.privacyItems.map((x) => h('li', x))),
          h('div.small.muted', T.dataDir, ' ', h('code', state.dataDir ?? '~/.legacypet')),
          h('div.row', resetBtn)),
        h('p.small.muted', { style: { textAlign: 'center' } }, T.version(state.version, state.mode)));
    }

    root.append(h('h2', T.title), h('p.lead', T.lead), body);
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
    const names = { mac: `🍎 ${T.mac}`, win: `🪟 ${T.win}`, linux: `🐧 ${T.linux}` };
    const block = (id, primary) => h('div.dl', h('b', names[id]),
      h('div.row', builds[id].map(([label, href], i) => h(`a.button${primary && i === 0 ? '.primary' : ''}`, { href }, `⬇ ${label}`))));
    const order = os ? [os, ...Object.keys(builds).filter((x) => x !== os)] : Object.keys(builds);
    root.append(
      h('section.get-hero',
        h('div.onboard-pets', ['happy', 'party', 'sleepy'].map((mood, i) => h('img.mini-img', { src: svgSrc(LP.renderMini(kit.demoPet({ mood, species: ['cat', 'duck', 'octopus'][i] }), { theme: cardTheme() })), alt: '' }))),
        h('h2', T.title),
        h('p.lead', T.lead)),
      h('div.grid2',
        h('section.panel.stack',
          h('h3', `⬇ ${T.download}`),
          os ? h('p.small.muted', { style: { margin: 0 } }, T.forYou) : null,
          ...order.map((id, i) => block(id, i === 0 && Boolean(os))),
          h('p.small.muted', { style: { margin: 0 } }, T.macWarn),
          h('p.small.muted', { style: { margin: 0 } }, T.winWarn),
          h('a.small', { href: RELEASES }, T.allReleases)),
        h('div.stack',
          h('section.panel.points', T.points.map(([icon, title, text]) => h('div.point', h('span.em', icon), h('div', h('b', title), h('p.small.muted', { style: { margin: 0 } }, text))))),
          h('section.panel.stack', h('h3', T.node), codeBlock('npx github:Tanx-1811/legacypet app'), h('p.small.muted', { style: { margin: 0 } }, T.nodeNote)))));
    return {};
  }

  function home(root, arg) {
    if (!state) {
      root.append(h('div.scanning', h('p.muted', '…')));
      load().then(() => kit.render()).catch((err) => root.replaceChildren(h('div.empty', err.message)));
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
  };
}
