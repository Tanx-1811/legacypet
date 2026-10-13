// The Tools page: small utilities around the pets' repos. Work reports and a timeline of
// commits across every project, a git status board, the TODOs left in the code and exports
// (these need the app on this computer), plus a focus timer and a commit message composer that
// work everywhere. Like the rest of the app, nothing here writes to a repo on its own: fetch and
// pull only run when asked, and pull only moves forward (see src/local/projects.js: sync).
import { localDayKey } from './charts.js';
import { kindOf } from './insights.js';
import { api, LOCAL } from './local.js';

const TOOLS = [
  { id: 'report', icon: 'clipboard-list', local: true, tone: 'teal' },
  { id: 'timeline', icon: 'history', local: true, tone: 'blue' },
  { id: 'git', icon: 'git-branch', local: true, tone: 'violet' },
  { id: 'todos', icon: 'list-todo', local: true, tone: 'amber' },
  { id: 'focus', icon: 'timer', tone: 'rose' },
  { id: 'commit', icon: 'message-square-text', tone: 'green' },
  { id: 'export', icon: 'file-spreadsheet', local: true, tone: 'slate' },
];
const DAY = 86_400_000;
const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function toolsViews(kit) {
  const { h, t, icon, btn, toast, store, save, dialog, closeX, download, copyText, select, seg, LP, homeKit, insights, focus } = kit;
  const fill = (el, ...kids) => el.replaceChildren(...kids.flat().filter((k) => k != null && k !== false && k !== ''));
  const projects = () => (homeKit.state?.projects ?? []).filter((p) => p.summary);
  const byId = (id) => homeKit.state?.projects.find((p) => p.id === id);
  const nameOf = (p) => (p ? p.folder : '?');
  const num = (n) => Number(n ?? 0).toLocaleString(store.ui);
  const time = (iso) => new Intl.DateTimeFormat(store.ui, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const dayTitle = (d) => new Intl.DateTimeFormat(store.ui, { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  const shortDate = (d) => new Intl.DateTimeFormat(store.ui, { day: 'numeric', month: 'numeric', year: 'numeric' }).format(d);
  const ago = (iso) => {
    const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
    const fmt = new Intl.RelativeTimeFormat(store.ui, { numeric: 'auto' });
    if (Math.abs(mins) < 60) return fmt.format(-mins, 'minute');
    const hours = Math.round(mins / 60);
    if (hours < 24) return fmt.format(-hours, 'hour');
    return fmt.format(-Math.round(hours / 24), 'day');
  };

  // The page's head: an icon tile, the title, a line under it, and room for actions.
  const pageHead = (iconName, title, sub, ...actions) => h('header.page-head',
    h('div.page-title', h('span.page-icon', icon(iconName, { size: 20 })), h('div', h('h1', title), sub ? h('p.page-sub', sub) : null)),
    actions.length ? h('div.page-actions', ...actions) : null);
  const crumbs = (label) => h('nav.crumbs', { 'aria-label': 'breadcrumb' }, h('a', { href: '#/tools' }, t().nav.tools), icon('chevron-right', { size: 14 }), h('span', label));
  const needsApp = () => h('div.empty.stack', icon('monitor-down', { size: 26 }), h('p', { style: { margin: 0 } }, t().tools.needsApp),
    h('div.row', { style: { justifyContent: 'center' } }, btn(t().side.getApp, { icon: 'download', kind: 'primary', href: '#/get' })));

  // Commits across every project, asked of the app once per range and kept a minute.
  const reports = new Map();
  function report({ since, until = null, mine = true }) {
    const key = `${since}|${until}|${mine}`;
    const hit = reports.get(key);
    if (hit && Date.now() - hit.at < 60_000) return hit.promise;
    const promise = api('report', { since, until, mine });
    reports.set(key, { at: Date.now(), promise });
    promise.catch(() => { if (reports.get(key)?.promise === promise) reports.delete(key); });
    return promise;
  }

  // ----- The hub ------------------------------------------------------------------------------
  function hub(root) {
    const T = t().tools;
    const card = (tool) => {
      const locked = tool.local && !LOCAL;
      const note = h('span.tool-meta');
      const el = h(`a.tool-card.tone-${tool.tone}${locked ? '.locked' : ''}`, { href: locked ? '#/get' : `#/tools/${tool.id}` },
        h('span.tool-icon', icon(tool.icon, { size: 22 })),
        h('div.tool-text', h('b', T.names[tool.id]), h('span.small.muted', T.notes[tool.id]), note),
        locked ? h('span.pill', icon('lock', { size: 11 }), T.appOnly) : icon('arrow-right', { size: 16, cls: 'row-go' }));
      fill(note, liveNote(tool.id));
      return el;
    };
    const grid = h('div.tool-grid');
    const draw = () => fill(grid, TOOLS.map(card));
    root.append(pageHead('wrench', T.title, T.lead), grid);
    draw();
    return { redraw: draw };
  }

  // A line about now on each card: today's commits, repos with changes, focus sessions.
  function liveNote(id) {
    const T = t().tools;
    const list = projects();
    if (id === 'focus') {
      const f = focus.state;
      return f.phase !== 'idle' ? T.focusRunning(fmtClock(focus.left())) : f.done.day === localDayKey(new Date()) && f.done.n ? T.focusToday(f.done.n) : null;
    }
    if (!LOCAL || !list.length) return null;
    if (id === 'report') {
      const today = list.reduce((s, p) => s + (p.activity?.[localDayKey(new Date())] ?? 0), 0);
      return today ? T.commitsToday(today) : null;
    }
    if (id === 'git') {
      const dirty = list.filter((p) => p.dirty).length;
      const behind = list.filter((p) => p.behind).length;
      return dirty || behind ? T.gitNote(dirty, behind) : T.allClean;
    }
    return null;
  }

  // ----- Work report ---------------------------------------------------------------------------
  const RANGES = ['today', 'yesterday', 'week', 'd7', 'd30', 'custom'];
  function rangeOf(id, custom) {
    const today = startOfDay();
    if (id === 'yesterday') return [addDays(today, -1), today];
    if (id === 'week') {
      const monday = addDays(today, -((today.getDay() + 6) % 7));
      return [monday, null];
    }
    if (id === 'd7') return [addDays(today, -6), null];
    if (id === 'd30') return [addDays(today, -29), null];
    if (id === 'custom') {
      const from = custom.from ? new Date(`${custom.from}T00:00:00`) : addDays(today, -6);
      const to = custom.to ? addDays(new Date(`${custom.to}T00:00:00`), 1) : null;
      return [from, to];
    }
    return [today, null];
  }

  function reportView(root) {
    const T = t().tools.report;
    const opts = { range: 'today', mine: true, group: 'project', from: '', to: '', ...store.report };
    const keep = () => { store.report = { ...opts }; save(); };
    const out = h('div.report-out');
    const summary = h('div.report-summary');
    const actions = h('div.row');
    const from = h('input', { type: 'date', value: opts.from, 'aria-label': T.from });
    const to = h('input', { type: 'date', value: opts.to, 'aria-label': T.to });
    const customRow = h('div.row.custom-range', h('label.field.inline', T.from, from), h('label.field.inline', T.to, to));
    from.onchange = () => { opts.from = from.value; keep(); run(); };
    to.onchange = () => { opts.to = to.value; keep(); run(); };
    let last = null;

    function markdown(data, [since, until]) {
      const L = T;
      const range = until && until - since > DAY ? `${shortDate(since)} – ${shortDate(new Date(until - 1))}` : shortDate(since);
      const linesOut = [`## ${L.mdTitle} · ${range}`, '', `_${L.summary(data.commits.length, groups(data).length)}_`, ''];
      for (const [title, commits] of groups(data)) {
        linesOut.push(`### ${title}`);
        for (const c of commits) linesOut.push(`- ${opts.group === 'day' ? `**${nameOf(byId(c.projectId))}** · ` : ''}${c.subject} (\`${c.sha}\`)${opts.mine ? '' : ` · ${c.author}`}`);
        linesOut.push('');
      }
      return linesOut.join('\n').trim();
    }
    const plain = (md) => md.replace(/^#+ /gm, '').replace(/\*\*|_|`/g, '').replace(/^- /gm, '• ');

    // [title, commits] in order: by project (busiest first) or by day (newest first).
    function groups(data) {
      const map = new Map();
      for (const c of data.commits) {
        const key = opts.group === 'day' ? localDayKey(new Date(c.date)) : c.projectId;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(c);
      }
      const entries = [...map];
      if (opts.group === 'day') return entries.map(([day, list]) => [dayTitle(new Date(`${day}T12:00:00`)), list]);
      return entries.sort((a, b) => b[1].length - a[1].length).map(([id, list]) => {
        const p = byId(id);
        return [p?.github ? `${nameOf(p)} (${p.fullName})` : nameOf(p), list];
      });
    }

    async function run() {
      const range = rangeOf(opts.range, opts);
      customRow.hidden = opts.range !== 'custom';
      fill(out, h('div.loading-row', icon('loader-circle', { size: 16, cls: 'spin' }), h('span', t().insights.loading)));
      fill(summary);
      fill(actions);
      try {
        const data = await report({ since: range[0].toISOString(), until: range[1]?.toISOString() ?? null, mine: opts.mine });
        last = { data, range };
        draw();
      } catch (err) { fill(out, h('div.callout.bad', err.message)); }
    }

    function draw() {
      const { data, range } = last;
      const md = markdown(data, range);
      const kinds = Object.entries(data.types).sort((a, b) => b[1] - a[1]);
      fill(summary,
        h('b', T.summary(data.commits.length, groups(data).length)),
        h('div.kind-chips', kinds.map(([k, n]) => h('span.kind-chip', { style: { '--k': kindOf(k).color } }, `${kindOf(k).emoji} ${t().insights.kindNames[k] ?? k}`, h('span.muted', n)))));
      fill(actions,
        btn(T.copyMd, { icon: 'copy', kind: 'primary', disabled: !data.commits.length, onclick: () => copyText(md) }),
        btn(T.copyText, { icon: 'copy', disabled: !data.commits.length, onclick: () => copyText(plain(md)) }),
        btn(T.download, { icon: 'download', disabled: !data.commits.length, onclick: () => download(new Blob([`${md}\n`], { type: 'text/markdown' }), `report-${localDayKey(range[0])}.md`) }));
      if (!data.commits.length) return fill(out, h('div.empty', opts.mine ? T.emptyMine : T.empty));
      // Within one day (or grouped by day) the time says enough; longer ranges add the date.
      const when = (iso) => (opts.group === 'day' || ['today', 'yesterday'].includes(opts.range) ? time(iso) : `${shortDate(new Date(iso))} ${time(iso)}`);
      fill(out, groups(data).map(([title, commits]) => h('section.report-group',
        h('h3', title, h('span.count-pill', commits.length)),
        h('ul.commit-list.tight', commits.map((c) => {
          const p = byId(c.projectId);
          return h('li',
            h('span.kind-dot', { style: { '--k': kindOf(c.kind).color }, title: t().insights.kindNames[c.kind] ?? c.kind }, kindOf(c.kind).emoji),
            h('div.commit-main',
              h('span.commit-subject', { title: c.subject }, c.subject),
              h('span.small.muted', [opts.group === 'day' ? nameOf(p) : null, opts.mine ? null : c.author, when(c.date)].filter(Boolean).join(' · '))),
            h('code.sha', c.sha));
        })))));
    }

    root.append(
      crumbs(t().tools.names.report),
      pageHead('clipboard-list', t().tools.names.report, T.lead),
      h('section.panel.report-controls',
        h('div.control-row',
          h('div.field', h('span', T.range), seg(RANGES.map((id) => [id, T.ranges[id]]), opts.range, (v) => { opts.range = v; keep(); run(); }, T.range)),
          h('div.field', h('span', T.who), seg([['mine', T.mine], ['all', T.everyone]], opts.mine ? 'mine' : 'all', (v) => { opts.mine = v === 'mine'; keep(); run(); }, T.who)),
          h('div.field', h('span', T.group), seg([['project', T.byProject], ['day', T.byDay]], opts.group, (v) => { opts.group = v; keep(); if (last) draw(); }, T.group))),
        customRow,
        h('p.small.muted', { style: { margin: 0 } }, T.note)),
      h('div.report-bar', summary, actions),
      out);
    customRow.hidden = opts.range !== 'custom';
    run();
    return { redraw: () => { if (last) draw(); } };
  }

  // ----- Timeline --------------------------------------------------------------------------------
  function timelineView(root) {
    const T = t().tools.timeline;
    const opts = { days: 7, mine: false, project: '', kinds: [], ...store.timeline };
    const keep = () => { store.timeline = { ...opts, kinds: [...opts.kinds] }; save(); };
    const search = h('input', { type: 'search', placeholder: T.search, 'aria-label': T.search, autocomplete: 'off', spellcheck: 'false' });
    const kindBox = h('div.kind-chips.toggles');
    const listBox = h('div.timeline-list');
    const status = h('span.small.muted');
    let data = null;
    let shown = 200;
    const projectSel = select([['', T.allProjects], ...projects().map((p) => [p.id, `${p.summary.emoji} ${p.folder}`])], opts.project, (v) => { opts.project = v; keep(); shown = 200; draw(); }, T.project);

    async function run() {
      fill(listBox, h('div.loading-row', icon('loader-circle', { size: 16, cls: 'spin' }), h('span', t().insights.loading)));
      try {
        data = await report({ since: addDays(startOfDay(), -(opts.days - 1)).toISOString(), mine: opts.mine });
        draw();
      } catch (err) { fill(listBox, h('div.callout.bad', err.message)); }
    }

    function draw() {
      if (!data) return;
      const q = search.value.trim().toLowerCase();
      const pool = data.commits.filter((c) => !opts.project || c.projectId === opts.project);
      const counts = {};
      for (const c of pool) counts[c.kind] = (counts[c.kind] ?? 0) + 1;
      fill(kindBox, Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => h('button.kind-chip', {
        type: 'button', 'aria-pressed': String(opts.kinds.includes(k)), style: { '--k': kindOf(k).color },
        onclick: () => { opts.kinds = opts.kinds.includes(k) ? opts.kinds.filter((x) => x !== k) : [...opts.kinds, k]; keep(); draw(); },
      }, `${kindOf(k).emoji} ${t().insights.kindNames[k] ?? k}`, h('span.muted', n))));
      const list = pool.filter((c) => (!opts.kinds.length || opts.kinds.includes(c.kind))
        && (!q || `${c.subject} ${c.author} ${c.sha} ${nameOf(byId(c.projectId))}`.toLowerCase().includes(q)));
      status.textContent = T.count(list.length);
      if (!list.length) return fill(listBox, h('div.empty', T.empty));
      const days = new Map();
      for (const c of list.slice(0, shown)) {
        const key = localDayKey(new Date(c.date));
        if (!days.has(key)) days.set(key, []);
        days.get(key).push(c);
      }
      const todayKey = localDayKey(new Date());
      const yesterdayKey = localDayKey(addDays(startOfDay(), -1));
      fill(listBox, [...days].map(([day, commits]) => h('section.tl-day',
        h('h3.tl-head', day === todayKey ? T.today : day === yesterdayKey ? T.yesterday : dayTitle(new Date(`${day}T12:00:00`)), h('span.count-pill', commits.length)),
        h('ol.tl-items', commits.map((c) => {
          const p = byId(c.projectId);
          return h('li.tl-item', { style: { '--k': kindOf(c.kind).color } },
            h('span.tl-time.mono', time(c.date)),
            h('span.tl-dot', kindOf(c.kind).emoji),
            h('div.tl-main',
              h('span.commit-subject', { title: c.subject }, c.subject),
              h('span.small.muted', h('a.tl-project', { href: `#/home/${c.projectId}` }, nameOf(p)), ` · ${c.author} · `, h('code', c.sha))),
            p?.github ? h('a.commit-link', { href: `https://github.com/${p.fullName}/commit/${c.sha}`, target: '_blank', rel: 'noopener', title: 'GitHub', 'aria-label': 'GitHub' }, icon('arrow-up-right', { size: 14 })) : null);
        })))),
      list.length > shown ? h('div.row', { style: { justifyContent: 'center' } }, btn(T.more(list.length - shown), { kind: 'ghost', onclick: () => { shown += 300; draw(); } })) : null);
    }
    search.oninput = () => draw();

    root.append(
      crumbs(t().tools.names.timeline),
      pageHead('history', t().tools.names.timeline, T.lead),
      h('section.panel.tl-controls',
        h('div.control-row',
          h('div.field', h('span', T.days), seg([1, 7, 14, 30, 90].map((n) => [String(n), T.daysN(n)]), String(opts.days), (v) => { opts.days = Number(v); keep(); shown = 200; run(); }, T.days)),
          h('div.field', h('span', t().tools.report.who), seg([['mine', t().tools.report.mine], ['all', t().tools.report.everyone]], opts.mine ? 'mine' : 'all', (v) => { opts.mine = v === 'mine'; keep(); run(); })),
          h('label.field', T.project, projectSel)),
        h('div.toolbar-row.tight', h('div.search-box', icon('search', { size: 16 }), search), status),
        kindBox),
      listBox);
    run();
    return { redraw: draw, focusSearch: () => { search.focus(); return true; } };
  }

  // ----- Git status board -------------------------------------------------------------------------
  function gitView(root) {
    const T = t().tools.git;
    let filter = store.gitFilter ?? 'attention';
    const box = h('div');
    const bulk = h('div.stack');
    let busy = false;
    const FILTERS = {
      attention: (p) => p.dirty || p.ahead || p.behind,
      all: () => true,
      dirty: (p) => p.dirty,
      ahead: (p) => p.ahead,
      behind: (p) => p.behind,
    };

    async function runAll(action, list) {
      if (busy) return;
      busy = true;
      const lines = new Map(list.map((p) => [p.id, h('div.small.progress-line', icon('loader-circle', { size: 14, cls: 'spin' }), h('span', p.folder))]));
      fill(bulk, h('section.panel.stack.tight', h('h3', icon(action === 'pull' ? 'arrow-down-to-line' : 'refresh-cw', { size: 16 }), action === 'pull' ? T.pulling : T.fetching), [...lines.values()]));
      let ok = 0;
      // Two at a time: a fetch waits on the network, and a slow computer stays usable.
      const queue = [...list];
      await Promise.all([0, 1].map(async () => {
        while (queue.length) {
          const p = queue.shift();
          const line = lines.get(p.id);
          try {
            const res = await api(`projects/${p.id}/git`, { action });
            if (res.ok) {
              ok += 1;
              fill(line, icon('circle-check', { size: 14, cls: 'ok-icon' }), h('span', `${p.folder}${res.project?.behind ? ` · ${T.behindN(res.project.behind)}` : ''}`));
            } else fill(line, icon('circle-x', { size: 14, cls: 'bad-icon' }), h('span', `${p.folder}: ${res.hint ? t().home.hints[res.hint] : res.error ?? '?'}`));
          } catch (err) {
            fill(line, icon('circle-x', { size: 14, cls: 'bad-icon' }), h('span', `${p.folder}: ${err.message}`));
          }
        }
      }));
      busy = false;
      toast(T.done(ok, list.length), ok === list.length ? 'good' : '');
      // Live updates that came in meanwhile were held back: draw the board once, with the news.
      await homeKit.load().catch(() => {});
      if (root.isConnected) draw();
    }

    function confirmPull(list) {
      const go = btn(T.pullGo(list.length), { icon: 'arrow-down-to-line', kind: 'primary' });
      const el = dialog(closeX(), h('h2', T.pullTitle), h('p.muted', T.pullLead),
        h('ul.files.scroll', list.map((p) => h('li', icon('folder-git-2', { size: 15 }), h('span.mono', p.folder), h('span.pill', icon('arrow-down', { size: 11 }), p.behind), p.dirty ? h('span.pill.warn', T.dirtyN(p.dirty)) : null))),
        h('div.row', go));
      go.onclick = () => { el.close(); runAll('pull', list); };
    }

    function draw() {
      const all = projects().filter((p) => p.remote || p.dirty || p.ahead);
      const withRemote = projects().filter((p) => p.remote);
      const behind = withRemote.filter((p) => p.behind);
      const counts = Object.fromEntries(Object.entries(FILTERS).map(([id, f]) => [id, all.filter(f).length]));
      const shown = all.filter(FILTERS[filter]).sort((a, b) => (b.dirty + b.ahead * 3 + b.behind * 2) - (a.dirty + a.ahead * 3 + a.behind * 2));
      const tools = homeKit.state?.tools ?? { editors: [], terminals: [] };
      fill(box,
        h('div.kpis',
          tile('pencil', T.kpiDirty, counts.dirty, 'amber'),
          tile('cloud-upload', T.kpiAhead, counts.ahead, 'violet'),
          tile('arrow-down-to-line', T.kpiBehind, counts.behind, 'blue'),
          tile('circle-check', T.kpiClean, projects().length - all.filter(FILTERS.attention).length, 'green')),
        h('div.toolbar-row',
          h('div.seg.filters', { role: 'group' }, Object.keys(FILTERS).map((id) => h('button', {
            type: 'button', 'aria-pressed': String(filter === id),
            onclick: () => { filter = id; store.gitFilter = id; save(); draw(); },
          }, T.filters[id], h('span.count', counts[id])))),
          h('div.toolbar-end',
            btn(T.fetchAll(withRemote.length), { icon: 'refresh-cw', disabled: !withRemote.length, onclick: () => runAll('fetch', withRemote) }),
            btn(T.pullAll(behind.length), { icon: 'arrow-down-to-line', kind: behind.length ? 'primary' : '', disabled: !behind.length, onclick: () => confirmPull(behind) }))),
        bulk,
        shown.length
          ? h('div.pet-table.git-table',
            h('div.git-row.head', h('span', T.cols.project), h('span', T.cols.changes), h('span', T.cols.ahead), h('span', T.cols.behind), h('span', T.cols.last), h('span')),
            shown.map((p) => h('div.git-row',
              h('a.git-name', { href: `#/home/${p.id}` },
                h('div.scene.row-pet', h('img', { src: homeKit.pic(p), alt: '', decoding: 'async', loading: 'lazy' })),
                h('div.row-main', h('b', p.folder), h('span.small.muted.mono', icon('git-branch', { size: 11 }), ` ${p.branch ?? '–'}`))),
              h('span', p.dirty ? h('span.pill.warn', icon('pencil', { size: 11 }), p.dirty) : h('span.muted', '–')),
              h('span', p.ahead ? h('span.pill.warn', icon('arrow-up', { size: 11 }), p.ahead) : h('span.muted', p.remote ? '0' : '–')),
              h('span', p.behind ? h('span.pill.live', icon('arrow-down', { size: 11 }), p.behind) : h('span.muted', p.remote ? '0' : '–')),
              h('span.small.muted', p.snapshot?.commits?.lastDate ? ago(p.snapshot.commits.lastDate) : '–'),
              h('div.row-actions',
                tools.editors.length ? btn('', { icon: 'code-xml', kind: 'ghost sm', title: T.editor, onclick: () => homeKit.actions.openWith(p, 'editor') }) : null,
                tools.terminals.length ? btn('', { icon: 'square-terminal', kind: 'ghost sm', title: T.terminal, onclick: () => homeKit.actions.openWith(p, 'terminal') }) : null,
                p.remote ? btn('', { icon: 'refresh-cw', kind: 'ghost sm', title: 'git fetch', onclick: () => runAll('fetch', [p]) }) : null,
                p.behind ? btn('', { icon: 'arrow-down-to-line', kind: 'ghost sm', title: 'git pull --ff-only', onclick: () => runAll('pull', [p]) }) : null))))
          : h('div.empty', filter === 'attention' ? T.allGood : T.none),
        h('p.small.muted', T.note));
    }
    const tile = (name, label, value, tone) => h(`div.stat.tone-${tone}`, h('div.stat-label', h('span.stat-icon', icon(name, { size: 15 })), h('span', label)), h('div.stat-body', h('div.stat-text', h('div.stat-value', num(value)))));

    root.append(crumbs(t().tools.names.git), pageHead('git-branch', t().tools.names.git, T.lead), box);
    draw();
    return { redraw: () => { if (!busy) draw(); } };
  }

  // ----- TODOs ---------------------------------------------------------------------------------------
  function todosView(root) {
    const T = t().tools.todos;
    const list = projects();
    const pick = list.find((p) => p.id === store.todoProject) ?? list[0];
    const panelBox = h('div');
    const scanBox = h('div');
    const sel = select(list.map((p) => [p.id, `${p.summary.emoji} ${p.folder}`]), pick?.id ?? '', (v) => { store.todoProject = v; save(); show(byId(v)); }, T.project);
    function show(p) { fill(panelBox, p ? insights.todoPanel(p, { limit: 100 }) : h('div.empty', T.none)); }
    async function scanAll() {
      fill(scanBox, h('section.panel', h('div.loading-row', icon('loader-circle', { size: 16, cls: 'spin' }), h('span', T.scanning(list.length)))));
      const rows = await Promise.all(list.map(async (p) => {
        try { return [p, await insights.load(p, 'todos')]; } catch { return [p, null]; }
      }));
      rows.sort((a, b) => (b[1]?.total ?? -1) - (a[1]?.total ?? -1));
      fill(scanBox, h('section.panel',
        h('div.panel-head', h('h3', icon('list-todo', { size: 16 }), T.byProject)),
        h('ul.bar-list', rows.map(([p, d]) => h('li', h('button.bar-row.as-button', {
          type: 'button', onclick: () => { sel.value = p.id; store.todoProject = p.id; save(); show(p); panelBox.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
        },
        h('div.bar-head', h('span.bar-label', p.folder), h('span.bar-sub', d ? Object.entries(countTags(d.items)).map(([k, n]) => `${k} ${n}`).join(' · ') || T.clean : '?')),
        h('div.bar-track', h('i', { style: { width: `${Math.max(2, ((d?.total ?? 0) / Math.max(1, rows[0][1]?.total ?? 1)) * 100)}%` } }), h('span.bar-value', d ? num(d.total) : '–'))))))));
    }
    const countTags = (items) => items.reduce((acc, x) => ({ ...acc, [x.tag]: (acc[x.tag] ?? 0) + 1 }), {});
    root.append(
      crumbs(t().tools.names.todos),
      pageHead('list-todo', t().tools.names.todos, T.lead, list.length ? btn(T.scanAll, { icon: 'search', onclick: scanAll }) : null),
      h('div.toolbar-row', list.length ? h('label.field.inline', T.project, sel) : null),
      scanBox,
      panelBox);
    show(pick);
    return {};
  }

  // ----- Export ----------------------------------------------------------------------------------------
  function exportView(root) {
    const T = t().tools.export;
    const csvCell = (v) => {
      const s = String(v ?? '');
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    // A BOM up front, so Excel reads accents (Vietnamese names, say) right.
    const csv = (rows) => `﻿${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
    const day = localDayKey(new Date());
    function projectRows() {
      const L = kit.tr();
      return [
        ['folder', 'repo', 'pet', 'species', 'mood', 'level', 'rank', 'streak', 'commits_7d', 'uncommitted', 'to_push', 'to_pull', 'branch', 'github_status', 'last_commit', 'path'],
        ...projects().map((p) => [p.folder, p.github ? p.fullName : '', p.summary.name, L.species[p.summary.species] ?? p.summary.species, L.moods[p.summary.mood] ?? p.summary.mood,
          p.summary.level, L.ranks[p.summary.rank] ?? p.summary.rank, p.summary.streak, p.summary.commits7, p.dirty ?? 0, p.ahead ?? '', p.behind ?? '', p.branch ?? '', p.status,
          p.snapshot?.commits?.lastDate ?? '', p.path]),
      ];
    }
    const item = (iconName, title, note, ...buttons) => h('div.export-item', h('span.tool-icon.small', icon(iconName, { size: 18 })), h('div', h('b', title), h('p.small.muted', { style: { margin: 0 } }, note)), h('div.row', ...buttons));
    async function commits(days, format) {
      try {
        const data = await report({ since: addDays(startOfDay(), -(days - 1)).toISOString(), mine: false });
        if (format === 'json') return download(new Blob([`${JSON.stringify(data.commits.map((c) => ({ ...c, project: nameOf(byId(c.projectId)) })), null, 2)}\n`], { type: 'application/json' }), `commits-${days}d-${day}.json`);
        download(new Blob([csv([['date', 'project', 'sha', 'author', 'kind', 'subject'], ...data.commits.map((c) => [c.date, nameOf(byId(c.projectId)), c.sha, c.author, c.kind, c.subject])])], { type: 'text/csv' }), `commits-${days}d-${day}.csv`);
      } catch (err) { toast(err.message, 'bad'); }
    }
    root.append(
      crumbs(t().tools.names.export),
      pageHead('file-spreadsheet', t().tools.names.export, T.lead),
      h('section.panel.export-list',
        item('paw-print', T.projects, T.projectsNote(projects().length),
          btn('CSV', { icon: 'download', kind: 'primary', onclick: () => download(new Blob([csv(projectRows())], { type: 'text/csv' }), `legacypet-projects-${day}.csv`) }),
          btn('JSON', { icon: 'download', onclick: () => download(new Blob([`${JSON.stringify(projects().map((p) => ({ folder: p.folder, repo: p.github ? p.fullName : null, path: p.path, branch: p.branch, status: p.status, dirty: p.dirty, ahead: p.ahead, behind: p.behind, pet: p.summary })), null, 2)}\n`], { type: 'application/json' }), `legacypet-projects-${day}.json`) })),
        item('git-commit-horizontal', T.commits, T.commitsNote,
          select([[7, T.daysN(7)], [30, T.daysN(30)], [90, T.daysN(90)], [365, T.daysN(365)]].map(([v, l]) => [String(v), l]), String(store.exportDays ?? 30), (v) => { store.exportDays = Number(v); save(); }, T.commits),
          btn('CSV', { icon: 'download', onclick: () => commits(store.exportDays ?? 30, 'csv') }),
          btn('JSON', { icon: 'download', onclick: () => commits(store.exportDays ?? 30, 'json') })),
        item('archive', T.backup, T.backupNote, btn(t().settings.exportBackup, { icon: 'download', onclick: () => homeKit.actions.exportBackup() }))));
    return {};
  }

  // ----- Commit message composer -------------------------------------------------------------------
  const TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];
  const SUBJECT_MAX = 72;
  function commitView(root) {
    const T = t().tools.commit;
    const d = { type: 'feat', scope: '', subject: '', body: '', breaking: false, breakingNote: '', refs: '', refWord: 'Closes', shell: 'bash', ...store.commitDraft };
    const keep = () => { store.commitDraft = { ...d }; save(); };
    const preview = h('pre.commit-preview');
    const hints = h('ul.lint-list');
    const meal = h('div.meal');
    const counter = h('span.small.mono.counter');
    const cmd = h('pre.commit-cmd');
    const input = (key, attrs = {}) => {
      const el = h(attrs.rows ? 'textarea' : 'input', { type: attrs.rows ? null : 'text', value: d[key], ...attrs });
      if (attrs.rows) el.value = d[key];
      el.oninput = () => { d[key] = el.value; keep(); paint(); };
      return el;
    };
    const typeBox = h('div.type-grid', { role: 'radiogroup', 'aria-label': T.type });
    function drawTypes() {
      fill(typeBox, TYPES.map((ty) => h('button.type-chip', {
        type: 'button', role: 'radio', 'aria-checked': String(d.type === ty), style: { '--k': kindOf(ty).color },
        onclick: () => { d.type = ty; keep(); drawTypes(); paint(); },
      }, h('span.type-emoji', kindOf(ty).emoji), h('b.mono', ty), h('span.small.muted', T.types[ty]))));
    }
    const breaking = h('input', { type: 'checkbox', checked: d.breaking });
    const breakingNote = input('breakingNote', { placeholder: T.breakingPlaceholder });
    breaking.onchange = () => { d.breaking = breaking.checked; keep(); paint(); };

    function message() {
      const head = `${d.type}${d.scope.trim() ? `(${d.scope.trim()})` : ''}${d.breaking ? '!' : ''}: ${d.subject.trim()}`;
      const refs = d.refs.split(/[\s,]+/).map((r) => r.trim()).filter(Boolean).map((r) => (/^\d+$/.test(r) ? `#${r}` : r));
      const footer = [d.breaking && d.breakingNote.trim() ? `BREAKING CHANGE: ${d.breakingNote.trim()}` : null, refs.length ? `${d.refWord} ${refs.join(', ')}` : null].filter(Boolean);
      return { head, body: d.body.trim(), footer: footer.join('\n') };
    }
    const quote = (s) => (d.shell === 'powershell' ? `'${s.replace(/'/g, "''")}'` : `'${s.replace(/'/g, `'\\''`)}'`);

    function paint() {
      const m = message();
      const text = [m.head, m.body, m.footer].filter(Boolean).join('\n\n');
      preview.textContent = text;
      cmd.textContent = `git commit ${[m.head, m.body, m.footer].filter(Boolean).map((part) => `-m ${quote(part)}`).join(' ')}`;
      const len = d.subject.trim().length;
      counter.textContent = `${m.head.length}/${SUBJECT_MAX}`;
      counter.className = `small mono counter${m.head.length > SUBJECT_MAX ? ' bad' : m.head.length > 50 ? ' warn' : ''}`;
      const lint = [
        !len ? T.lint.empty : null,
        m.head.length > SUBJECT_MAX ? T.lint.long(m.head.length) : null,
        /\.$/.test(d.subject.trim()) ? T.lint.period : null,
        /^[A-Z][a-z]/.test(d.subject.trim()) ? T.lint.lower : null,
        /^(added|adds|fixed|fixes|updated|updates|changed|removed)\b/i.test(d.subject.trim()) ? T.lint.imperative : null,
        d.breaking && !d.breakingNote.trim() ? T.lint.breaking : null,
      ].filter(Boolean);
      fill(hints, lint.length ? lint.map((x) => h('li.warn', icon('triangle-alert', { size: 14 }), h('span', x))) : h('li.ok', icon('circle-check', { size: 14 }), h('span', T.lint.ok)));
      const food = LP.termWords(store.ui).food;
      fill(meal, h('span.meal-emoji', kindOf(d.type).emoji), h('div', h('b', T.mealTitle), h('span.small.muted', food[d.type] ?? food.other)));
    }

    drawTypes();
    root.append(
      crumbs(t().tools.names.commit),
      pageHead('message-square-text', t().tools.names.commit, T.lead,
        btn(T.clear, { icon: 'rotate-ccw', kind: 'ghost', onclick: () => { store.commitDraft = null; save(); kit.render(); } })),
      h('div.grid2.commit-grid',
        h('div.stack',
          h('section.panel.stack.tight', h('h3', T.type), typeBox),
          h('section.panel.stack.tight',
            h('div.fields',
              h('label.field', T.scope, input('scope', { placeholder: T.scopePlaceholder, maxlength: 30, class: 'mono' })),
              h('label.field.wide', h('span.label-row', T.subject, counter), input('subject', { placeholder: T.subjectPlaceholder, maxlength: 120 }))),
            h('label.field', T.body, input('body', { rows: 4, placeholder: T.bodyPlaceholder })),
            h('label.check', breaking, T.breaking),
            breakingNote,
            h('div.fields',
              h('label.field', T.refs, input('refs', { placeholder: '12, 34', class: 'mono' })),
              h('div.field', h('span', T.refWord), seg([['Closes', 'Closes'], ['Fixes', 'Fixes'], ['Refs', 'Refs']], d.refWord, (v) => { d.refWord = v; keep(); paint(); }, T.refWord))))),
        h('div.stack.sticky-col',
          h('section.panel.stack.tight',
            h('div.panel-head', h('h3', icon('file-text', { size: 16 }), T.preview), btn(t().common.copy, { icon: 'copy', kind: 'sm primary', onclick: () => copyText(preview.textContent) })),
            preview,
            hints,
            meal),
          h('section.panel.stack.tight',
            h('div.panel-head', h('h3', icon('square-terminal', { size: 16 }), T.command),
              seg([['bash', 'bash / zsh'], ['powershell', 'PowerShell']], d.shell, (v) => { d.shell = v; keep(); paint(); }, T.command)),
            cmd,
            h('div.row', btn(t().common.copy, { icon: 'copy', kind: 'sm', onclick: () => copyText(cmd.textContent) })),
            h('p.small.muted', { style: { margin: 0 } }, T.commandNote)))));
    paint();
    return {};
  }

  // ----- Focus timer -------------------------------------------------------------------------------
  function focusView(root) {
    const T = t().tools.focus;
    const ring = h('div.focus-ring');
    const label = h('div.focus-phase');
    const clock = h('div.focus-clock.mono');
    const controls = h('div.row.focus-controls');
    const today = h('div.focus-today');
    const logBox = h('ul.mini-list.plain.focus-log');
    const pet = h('div.focus-pet');
    const f = focus.state;
    const task = h('input', { type: 'text', value: f.task, placeholder: T.taskPlaceholder, maxlength: 80 });
    task.oninput = () => { focus.update({ task: task.value }); };
    const list = projects();
    const projectSel = LOCAL && list.length
      ? select([['', T.noProject], ...list.map((p) => [p.id, `${p.summary.emoji} ${p.folder}`])], f.project ?? '', (v) => { focus.update({ project: v || null }); drawPet(); }, T.project)
      : null;
    const PRESETS = { classic: [25, 5], long: [50, 10], short: [15, 3] };
    const presetOf = () => Object.entries(PRESETS).find(([, [a, b]]) => a === f.focusMin && b === f.breakMin)?.[0] ?? 'classic';

    function drawPet() {
      const p = f.project ? byId(f.project) : null;
      const src = p ? homeKit.pic(p) : kit.svgSrc(LP.renderMini(kit.demoPet({ mood: f.phase === 'break' ? 'sleepy' : f.phase === 'focus' ? 'ecstatic' : 'happy', species: 'cat', name: T.buddy }), { theme: kit.cardTheme(), still: true }));
      fill(pet, h('img', { src, alt: '', decoding: 'async' }), h('span.small.muted', p ? T.cheering(p.summary.name) : T.cheeringDemo));
    }

    function draw() {
      const left = focus.left();
      const total = (f.phase === 'break' ? f.breakMin : f.focusMin) * 60_000;
      const share = f.phase === 'idle' ? 0 : 1 - left / total;
      ring.style.setProperty('--p', String(Math.max(0, Math.min(1, share))));
      ring.dataset.phase = f.phase;
      label.textContent = f.paused ? T.paused : T.phases[f.phase];
      clock.textContent = fmtClock(f.phase === 'idle' ? f.focusMin * 60_000 : left);
      const running = f.phase !== 'idle';
      fill(controls,
        !running ? btn(T.start, { icon: 'play', kind: 'primary big', onclick: () => focus.start() }) : null,
        running && !f.paused ? btn(T.pause, { icon: 'pause', kind: 'big', onclick: () => focus.pause() }) : null,
        running && f.paused ? btn(T.resume, { icon: 'play', kind: 'primary big', onclick: () => focus.resume() }) : null,
        running ? btn(f.phase === 'break' ? T.skipBreak : T.finish, { icon: 'check', kind: 'big', onclick: () => focus.skip() }) : null,
        running ? btn('', { icon: 'square', kind: 'ghost big', title: T.stop, onclick: () => focus.stop() }) : null);
      const done = f.done.day === localDayKey(new Date()) ? f.done : { n: 0, minutes: 0 };
      fill(today,
        h('div.focus-stat', h('b', num(done.n)), h('span.small.muted', T.sessions)),
        h('div.focus-stat', h('b', T.minutes(done.minutes)), h('span.small.muted', T.focused)),
        h('div.focus-stat', h('b', '🍅'.repeat(Math.min(done.n, 8)) || '–'), h('span.small.muted', T.tomatoes)));
      fill(logBox, f.log.length ? f.log.slice(0, 8).map((x) => h('li', h('div.mini-text', h('span', x.task || T.untitled), h('span.small.muted', [T.minutes(x.minutes), x.project ? nameOf(byId(x.project)) : null, ago(x.at)].filter(Boolean).join(' · '))))) : h('li.muted.small', T.noLog));
    }

    const off = focus.subscribe(draw);
    drawPet();
    root.append(
      crumbs(t().tools.names.focus),
      pageHead('timer', t().tools.names.focus, T.lead),
      h('div.grid2.focus-grid',
        h('section.panel.focus-stage',
          h('div.focus-dial', ring, h('div.focus-center', label, clock)),
          controls,
          pet),
        h('div.stack',
          h('section.panel.stack.tight',
            h('h3', icon('target', { size: 16 }), T.setup),
            h('label.field', T.task, task),
            projectSel ? h('label.field', T.project, projectSel) : null,
            h('div.field', h('span', T.preset), seg(Object.keys(PRESETS).map((id) => [id, T.presets[id]]), presetOf(), (v) => {
              const [a, b] = PRESETS[v];
              focus.update({ focusMin: a, breakMin: b });
            }, T.preset)),
            h('p.small.muted', { style: { margin: 0 } }, T.note)),
          h('section.panel.stack.tight', h('h3', icon('calendar-days', { size: 16 }), T.todayTitle), today),
          h('section.panel.stack.tight', h('h3', icon('history', { size: 16 }), T.logTitle), logBox))));
    draw();
    return { leave: off, redraw: draw, keys: (e) => { if (e.key === ' ') { e.preventDefault(); if (f.phase === 'idle') focus.start(); else if (f.paused) focus.resume(); else focus.pause(); } } };
  }

  // ----- Routing inside the page -------------------------------------------------------------------
  const PAGES = { report: reportView, timeline: timelineView, git: gitView, todos: todosView, focus: focusView, commit: commitView, export: exportView };
  function view(root, arg) {
    const tool = TOOLS.find((x) => x.id === arg);
    if (!tool) return hub(root);
    if (tool.local && !LOCAL) { root.append(crumbs(t().tools.names[tool.id]), pageHead(tool.icon, t().tools.names[tool.id], t().tools.notes[tool.id]), needsApp()); return {}; }
    // Opened (or reloaded) straight on a tool: wait for the app's projects first.
    if (tool.local && !homeKit.state) {
      root.append(h('div.scanning', icon('loader-circle', { size: 24, cls: 'spin' })));
      homeKit.load().then(() => kit.render()).catch((err) => fill(root, h('div.empty', err.message)));
      return {};
    }
    return PAGES[tool.id](root);
  }

  return { view, TOOLS };
}

// ----- The focus timer, shared by every page (the chip in the corner) -----------------------------------
// Its state lives in this browser (a per-person convenience): the phase, when it ends, today's tally.
const FOCUS_KEY = 'legacypet.focus.v1';
export const fmtClock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export function createFocus({ onDone = () => {} } = {}) {
  const fresh = () => ({ phase: 'idle', endsAt: null, paused: false, left: null, focusMin: 25, breakMin: 5, task: '', project: null, done: { day: '', n: 0, minutes: 0 }, log: [] });
  const state = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FOCUS_KEY) ?? 'null');
      if (saved && typeof saved === 'object') return { ...fresh(), ...saved };
    } catch { /* storage is optional */ }
    return fresh();
  })();
  const listeners = new Set();
  let timer = null;
  const persist = () => { try { localStorage.setItem(FOCUS_KEY, JSON.stringify(state)); } catch { /* storage is optional */ } };
  const emit = () => { for (const fn of listeners) fn(state); };
  const left = () => (state.phase === 'idle' ? 0 : state.paused ? state.left ?? 0 : Math.max(0, (state.endsAt ?? 0) - Date.now()));

  // One tick a second, and only while a phase runs and isn't paused.
  function arm() {
    clearInterval(timer);
    timer = null;
    if (state.phase === 'idle' || state.paused) return;
    timer = setInterval(() => {
      if (left() <= 0) finish();
      else emit();
    }, 1000);
  }

  function begin(phase) {
    const minutes = phase === 'break' ? state.breakMin : state.focusMin;
    Object.assign(state, { phase, paused: false, left: null, endsAt: Date.now() + minutes * 60_000 });
    persist();
    arm();
    emit();
  }

  // A focus session counts for today's tally and the log, with the minutes actually spent.
  function tally() {
    const minutes = Math.max(1, Math.round((state.focusMin * 60_000 - left()) / 60_000));
    const day = localDayKey(new Date());
    state.done = state.done.day === day ? { day, n: state.done.n + 1, minutes: state.done.minutes + minutes } : { day, n: 1, minutes };
    state.log = [{ at: new Date().toISOString(), minutes, task: state.task, project: state.project }, ...state.log].slice(0, 30);
  }
  const idle = () => Object.assign(state, { phase: 'idle', endsAt: null, paused: false, left: null });

  function finish({ skipped = false } = {}) {
    const was = state.phase;
    if (was === 'focus') {
      tally();
      begin('break');
    } else {
      idle();
      persist();
      arm();
      emit();
    }
    onDone(was, { skipped, state });
  }

  // A page that was closed mid-phase: a phase that ended meanwhile is wrapped up quietly
  // (a finished focus session still counts), and nothing pops up about it.
  if (state.phase !== 'idle' && !state.paused && left() <= 0) {
    if (state.phase === 'focus') tally();
    idle();
    persist();
  }
  arm();

  return {
    state,
    left,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    start() {
      if (globalThis.Notification?.permission === 'default') Notification.requestPermission().catch(() => {});
      begin('focus');
    },
    pause() { if (state.phase === 'idle' || state.paused) return; state.left = left(); state.paused = true; persist(); arm(); emit(); },
    resume() { if (!state.paused) return; state.endsAt = Date.now() + (state.left ?? 0); state.paused = false; state.left = null; persist(); arm(); emit(); },
    skip() { finish({ skipped: true }); },
    stop() { idle(); persist(); arm(); emit(); },
    update(patch) { Object.assign(state, patch); persist(); emit(); },
  };
}
